<script lang="ts">
  import { onMount, tick } from "svelte";
  import { apiFetch } from "../../../lib/api";
  import {
    contactStatuses, contactEdit, contactPath, statusLabel,
    readContactPage, readContactHistory, readContactsJSON,
    type MailContact, type ContactEdit, type ContactHistory
  } from "../../../lib/mail-contacts";
  import type { Pagination } from "../../../type";

  let { apiUrl }: { apiUrl?: string } = $props();
  const base = $derived((apiUrl ?? "").replace(/\/+$/, ""));
  let contacts = $state<MailContact[]>([]);
  let pagination = $state<Pagination | null>(null);
  let search = $state("");
  let status = $state("");
  let blocked = $state("");
  let applied = { q: "", status: "", blocked: "" };
  let loading = $state(true);
  let error = $state("");
  let notice = $state("");
  let controller: AbortController | undefined;
  let requestedPage = 1;
  let selected = $state<MailContact | null>(null);
  let edit = $state<ContactEdit>({ name: "", company: "", profession: "", status: "contacted", do_not_contact: false, version: 0 });
  let saving = $state(false);
  let saveError = $state("");
  let history = $state<ContactHistory[]>([]);
  let historyPage = $state<Pagination | null>(null);
  let historyLoading = $state(false);
  let historyError = $state("");
  let historyController: AbortController | undefined;
  let requestedHistoryPage = 1;
  let detailTitle = $state<HTMLHeadingElement | null>(null);
  const dirty = $derived(selected !== null && JSON.stringify(edit) !== JSON.stringify(contactEdit(selected)));
  const inputClass = "w-full border-2 border-black bg-white p-2 text-sm";
  const date = (value: string) => new Date(value).toLocaleString("fr-BE", { dateStyle: "short", timeStyle: "short" });
  const message = (cause: unknown) => cause instanceof Error ? cause.message : String(cause);
  const normalize = (value: ContactEdit): ContactEdit => ({
    ...value, name: value.name.trim(), company: value.company.trim(), profession: value.profession.trim()
  });

  async function persistContact(email: string, changes: ContactEdit): Promise<number> {
    const result = await readContactsJSON(await apiFetch(`${base}${contactPath(email)}`, {
      method: "PATCH", body: JSON.stringify(changes), signal: AbortSignal.timeout(30000)
    }));
    if (typeof result !== "object" || result === null || !("saved" in result) || result.saved !== true ||
      !("version" in result) || typeof result.version !== "number" || result.version !== changes.version + 1) {
      throw new Error("L'enregistrement n'a pas été confirmé par Central-API.");
    }
    return result.version;
  }

  async function load(page = 1, filters = applied) {
    controller?.abort();
    const current = new AbortController();
    controller = current;
    applied = { ...filters };
    requestedPage = page;
    loading = true;
    error = "";
    try {
      const params = new URLSearchParams({ page: String(page), ...filters });
      const result = await readContactPage(await apiFetch(`${base}/api/mails/contacts?${params}`, {
        signal: AbortSignal.any([current.signal, AbortSignal.timeout(30000)])
      }));
      if (current.signal.aborted) return;
      contacts = result.data;
      pagination = result.pagination;
    } catch (cause) {
      if (!current.signal.aborted) error = message(cause);
    } finally {
      if (!current.signal.aborted) loading = false;
    }
  }

  async function loadHistory(page = 1) {
    if (!selected) return;
    historyController?.abort();
    const current = new AbortController();
    historyController = current;
    const email = selected.email;
    requestedHistoryPage = page;
    historyLoading = true;
    historyError = "";
    try {
      const result = await readContactHistory(await apiFetch(`${base}${contactPath(email, true)}&page=${page}`, {
        signal: AbortSignal.any([current.signal, AbortSignal.timeout(30000)])
      }));
      if (current.signal.aborted) return;
      history = result.data;
      historyPage = result.pagination;
    } catch (cause) {
      if (!current.signal.aborted) historyError = message(cause);
    } finally {
      if (!current.signal.aborted) historyLoading = false;
    }
  }

  function canLeave() {
    return !saving && (!dirty || window.confirm("Abandonner les modifications non enregistrées de ce contact ?"));
  }
  async function openContact(contact: MailContact) {
    if (!canLeave()) return;
    selected = { ...contact };
    edit = contactEdit(contact);
    saveError = "";
    history = [];
    historyPage = null;
    void loadHistory();
    await tick();
    detailTitle?.focus();
    detailTitle?.scrollIntoView({ block: "start" });
  }
  function closeContact() {
    if (!canLeave()) return;
    historyController?.abort();
    selected = null;
  }

  async function save() {
    if (!selected || saving) return;
    if (edit.do_not_contact !== selected.do_not_contact &&
      !window.confirm(edit.do_not_contact
        ? `Bloquer les futurs envois à ${selected.email}, pour tous les utilisateurs ? Un message déjà transmis au serveur SMTP ne peut pas être rappelé.`
        : `Autoriser de nouveau les envois à ${selected.email} ? Vérifiez que cette personne accepte d'être recontactée.`)) return;
    saving = true;
    saveError = "";
    notice = "";
    const changes = normalize(contactEdit(edit));
    const email = selected.email;
    try {
      const version = await persistContact(email, changes);
      selected = { ...selected, ...changes, version };
      edit = contactEdit(selected);
      notice = `Fiche enregistrée : ${email}.`;
      void load(pagination?.current_page ?? 1);
    } catch (cause) {
      saveError = message(cause);
    } finally {
      saving = false;
    }
  }

  async function unsubscribeFromStop() {
    if (!selected || saving) return;
    if (!window.confirm(`Désabonner immédiatement ${selected.email} ? Le contact passera en « Refus » et « Ne plus contacter ».`)) return;
    saving = true;
    saveError = "";
    notice = "";
    const email = selected.email;
    const changes = normalize({ ...contactEdit(edit), status: "declined", do_not_contact: true });
    try {
      const version = await persistContact(email, changes);
      selected = { ...selected, ...changes, version };
      edit = contactEdit(selected);
      notice = `Contact désabonné : ${email}.`;
      window.alert(`Désabonnement confirmé : ${email} est désormais en refus et ne sera plus contacté.`);
      void load(pagination?.current_page ?? 1);
    } catch (cause) {
      saveError = message(cause);
    } finally {
      saving = false;
    }
  }

  onMount(() => {
    void load();
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty || saving) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      controller?.abort();
      historyController?.abort();
      window.removeEventListener("beforeunload", beforeUnload);
    };
  });
</script>

<section class="space-y-6 font-mono" aria-labelledby="contacts-title">
  <header class="flex flex-wrap items-end justify-between gap-4 border-b-2 border-black pb-6">
    <div>
      <h1 id="contacts-title" class="text-3xl font-black uppercase">Suivi des contacts</h1>
      <p class="mt-2 text-sm">Contacts issus de l'historique des mails, partagés entre les utilisateurs autorisés.</p>
    </div>
    <a href="/mails" class="retro-btn bg-[#FFAEC1] text-xs">Rédiger un mail</a>
  </header>
  <p class="text-xs text-black/65">« Accepté SMTP » signifie que le serveur a accepté le message, pas qu'il a été livré ou lu. Les réponses et rendez-vous ne sont pas détectés : mettez le statut à jour manuellement. Les tests apparaissent aussi dans l'historique.</p>
  {#if notice}<p role="status" class="border-2 border-black bg-[#86E2D5] p-3 text-xs">{notice}</p>{/if}

  <form class="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4" onsubmit={(event) => {
    event.preventDefault(); void load(1, { q: search.trim(), status, blocked });
  }}>
    <div>
      <label for="contacts-search" class="mb-1 block text-xs font-bold">Email, nom, entreprise ou métier</label>
      <input id="contacts-search" type="search" class={inputClass} maxlength="200" bind:value={search} disabled={saving} />
    </div>
    <div>
      <label for="contacts-status-filter" class="mb-1 block text-xs font-bold">Statut de suivi</label>
      <select id="contacts-status-filter" class={inputClass} bind:value={status} disabled={saving}>
        <option value="">Tous</option>
        {#each contactStatuses as option}<option value={option.id}>{option.label}</option>{/each}
      </select>
    </div>
    <div>
      <label for="contacts-blocked-filter" class="mb-1 block text-xs font-bold">Droit de contact</label>
      <select id="contacts-blocked-filter" class={inputClass} bind:value={blocked} disabled={saving}>
        <option value="">Tous</option><option value="false">Envoi autorisé</option><option value="true">Ne plus contacter</option>
      </select>
    </div>
    <div class="flex flex-wrap gap-2">
      <button type="submit" class="retro-btn bg-[#BFD7FE] text-xs" disabled={saving || loading}>Rechercher</button>
      <button type="button" class="retro-btn bg-white text-xs" disabled={saving || loading} onclick={() => load(pagination?.current_page ?? 1)}>Actualiser</button>
    </div>
  </form>

  <div aria-busy={loading}>
    {#if error}
      <div role="alert" class="border-2 border-black bg-[#FFE2E2] p-4 text-xs">
        <p>{error}</p><button type="button" class="retro-btn mt-2 bg-white text-xs" onclick={() => load(requestedPage)}>Réessayer</button>
      </div>
    {:else if loading}
      <p role="status">Chargement des contacts…</p>
    {:else if contacts.length === 0}
      <p class="border-2 border-black bg-white p-4 text-sm">Aucun contact pour ces filtres. Les adresses apparaissent dès qu'une tentative d'envoi est enregistrée.</p>
    {:else}
      <div class="overflow-x-auto border-2 border-black bg-white" role="region" aria-label="Tableau du suivi des contacts" tabindex="0">
        <table class="w-full text-left text-xs">
          <thead class="border-b-2 border-black bg-[#BFD7FE]">
            <tr>
              <th scope="col" class="p-3">Contact</th><th scope="col" class="p-3">Entreprise / métier</th>
              <th scope="col" class="p-3">Suivi</th><th scope="col" class="p-3">Envois</th>
              <th scope="col" class="p-3">Première / dernière tentative</th><th scope="col" class="p-3">Fiche</th>
            </tr>
          </thead>
          <tbody>
            {#each contacts as contact (contact.email)}
              <tr class="border-b border-black/20">
                <th scope="row" class="p-3"><span class="block">{contact.name || "Nom à renseigner"}</span><span class="break-all font-normal">{contact.email}</span></th>
                <td class="p-3">{contact.company || "—"}<span class="block text-black/60">{contact.profession || "—"}</span></td>
                <td class="p-3">
                  <span class="block font-bold">{statusLabel(contact.status)}</span>
                  {#if contact.do_not_contact}<span class="mt-1 inline-block bg-[#FFE2E2] p-1 font-bold">Ne plus contacter</span>{/if}
                </td>
                <td class="whitespace-nowrap p-3">{contact.sent_count} accepté(s) SMTP<br />{contact.failed_count} échec(s)<br />{contact.blocked_count} bloqué(s)<br /><span class="text-black/60">{contact.attempts} tentative(s)</span></td>
                <td class="whitespace-nowrap p-3">{date(contact.first_sent_at)}<br />{date(contact.last_sent_at)}</td>
                <td class="p-3"><button type="button" class="retro-btn bg-white text-xs" disabled={saving} onclick={() => openContact(contact)} aria-label={`Ouvrir la fiche de ${contact.email}`}>Fiche et historique</button></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      {#if pagination}
        <nav class="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs" aria-label="Pagination des contacts">
          <span>{pagination.total_items} contact(s) — page {pagination.current_page} / {pagination.total_pages}</span>
          <div class="flex gap-2">
            <button type="button" class="retro-btn bg-white text-xs" disabled={saving || pagination.current_page <= 1} onclick={() => load(pagination!.current_page - 1)}>Précédent</button>
            <button type="button" class="retro-btn bg-white text-xs" disabled={saving || pagination.current_page >= pagination.total_pages} onclick={() => load(pagination!.current_page + 1)}>Suivant</button>
          </div>
        </nav>
      {/if}
    {/if}
  </div>

  {#if selected}
    <section class="space-y-4 border-2 border-black bg-[#F4F1EA] p-4" aria-labelledby="contact-detail-title">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <h2 id="contact-detail-title" bind:this={detailTitle} tabindex="-1" class="scroll-mt-24 break-all font-black">Fiche : {selected.email}</h2>
        <button type="button" class="retro-btn bg-white text-xs" disabled={saving} onclick={closeContact}>Fermer la fiche</button>
      </header>
      <form class="space-y-4" onsubmit={(event) => { event.preventDefault(); void save(); }}>
        <fieldset disabled={saving} class="grid gap-3 sm:grid-cols-2">
          <div><label for="contact-name" class="mb-1 block text-xs font-bold">Nom du contact</label><input id="contact-name" class={inputClass} maxlength="200" bind:value={edit.name} /></div>
          <div><label for="contact-company" class="mb-1 block text-xs font-bold">Entreprise</label><input id="contact-company" class={inputClass} maxlength="200" bind:value={edit.company} /></div>
          <div><label for="contact-profession" class="mb-1 block text-xs font-bold">Métier</label><input id="contact-profession" class={inputClass} maxlength="200" bind:value={edit.profession} /></div>
          <div>
            <label for="contact-status" class="mb-1 block text-xs font-bold">Statut manuel</label>
            <select id="contact-status" class={inputClass} bind:value={edit.status}>{#each contactStatuses as option}<option value={option.id}>{option.label}</option>{/each}</select>
          </div>
          <label class="flex items-center gap-2 text-xs font-bold"><input type="checkbox" bind:checked={edit.do_not_contact} /> Ne plus contacter : bloquer les futurs envois</label>
        </fieldset>
        <div class="space-y-2">
          <p class="text-xs">Le blocage est partagé, indépendant du statut de suivi et s'applique aussi aux tests. Enregistrez pour l'activer ; les mails déjà transmis ne peuvent pas être rappelés.</p>
          <button type="button" class="retro-btn bg-[#FFE2E2] text-xs" disabled={saving} onclick={() => void unsubscribeFromStop()}>
            STOP : désabonner immédiatement ce contact
          </button>
        </div>
        {#if saveError}<p role="alert" class="text-sm text-red-800">{saveError}</p>{/if}
        <button type="submit" class="retro-btn bg-[#86E2D5] text-xs" disabled={saving || !dirty}>{saving ? "Enregistrement…" : "Enregistrer la fiche"}</button>
        {#if dirty}<span class="ml-2 text-xs">Modifications non enregistrées</span>{/if}
      </form>

      <h3 class="border-t-2 border-black pt-4 text-sm font-bold">Historique de ce contact</h3>
      {#if historyError}
        <div role="alert" class="text-xs"><p>{historyError}</p><button type="button" class="retro-btn mt-2 bg-white text-xs" onclick={() => loadHistory(requestedHistoryPage)}>Recharger l'historique</button></div>
      {:else if historyLoading}<p role="status" class="text-xs">Chargement de l'historique…</p>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full bg-white text-left text-xs">
            <thead><tr class="border-b-2 border-black"><th scope="col" class="p-2">Date</th><th scope="col" class="p-2">Objet</th><th scope="col" class="p-2">Résultat</th></tr></thead>
            <tbody>{#each history as entry (entry.id)}
              <tr class="border-b border-black/20"><td class="whitespace-nowrap p-2">{date(entry.created_at)}</td><td class="p-2">{entry.subject}</td><td class="p-2">{entry.status === "sent" ? "Accepté SMTP" : entry.status === "blocked" ? "Bloqué" : "Échec"}{#if entry.error}<span class="mt-1 block break-words text-red-800">{entry.error}</span>{/if}</td></tr>
            {/each}</tbody>
          </table>
        </div>
        {#if history.length === 0}<p class="text-xs">Aucune tentative enregistrée.</p>{/if}
        {#if historyPage && historyPage.total_pages > 1}
          <nav class="flex flex-wrap items-center gap-3 text-xs" aria-label="Pagination de l'historique">
            <button type="button" class="retro-btn bg-white text-xs" disabled={historyPage.current_page <= 1} onclick={() => loadHistory(historyPage!.current_page - 1)}>Historique précédent</button>
            <span>Page {historyPage.current_page} / {historyPage.total_pages}</span>
            <button type="button" class="retro-btn bg-white text-xs" disabled={historyPage.current_page >= historyPage.total_pages} onclick={() => loadHistory(historyPage!.current_page + 1)}>Historique suivant</button>
          </nav>
        {/if}
      {/if}
    </section>
  {/if}
</section>
