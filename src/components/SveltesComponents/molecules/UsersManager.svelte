<script lang="ts">
  import { onMount } from "svelte";
  import { apiFetch } from "../../../lib/api";
  import { readUsersResponse, type UserSummary } from "../../../lib/users";
  import type { Pagination } from "../../../type";
  import PaginationComponent from "../atoms/Pagination.svelte";

  let users = $state<UserSummary[]>([]);
  let pagination = $state<Pagination | null>(null);
  let loading = $state(true);
  let error = $state("");
  let search = $state("");
  let appliedSearch = $state("");
  let controller: AbortController | undefined;
  let requestedPage = 1;

  async function load(page = 1, query = appliedSearch) {
    if (loading && controller) return;
    loading = true;
    error = "";
    requestedPage = page;
    appliedSearch = query.trim();
    const current = new AbortController();
    controller = current;
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (appliedSearch) params.set("q", appliedSearch);
      const result = await readUsersResponse(await apiFetch(`/api/users?${params}`, {
        signal: AbortSignal.any([current.signal, AbortSignal.timeout(30000)])
      }));
      if (current.signal.aborted) return;
      users = result.data;
      pagination = result.pagination;
    } catch (cause) {
      if (!current.signal.aborted) {
        console.error("Erreur chargement utilisateurs :", cause);
        error = cause instanceof Error ? cause.message : String(cause);
      }
    } finally {
      if (!current.signal.aborted) loading = false;
    }
  }

  onMount(() => {
    void load();
    return () => controller?.abort();
  });
</script>

<section class="space-y-6 font-mono" aria-labelledby="users-title">
  <header class="border-b-2 border-black pb-6">
    <h1 id="users-title" class="text-3xl font-black uppercase">Users</h1>
    <p class="mt-2 text-sm text-black/65">Comptes utilisateurs du site Daisy Brocante.</p>
  </header>

  <form class="flex flex-wrap items-end gap-3" onsubmit={(event) => { event.preventDefault(); void load(1, search); }}>
    <div class="flex-1">
      <label for="users-search" class="mb-2 block text-xs font-bold">Rechercher par nom ou email</label>
      <input id="users-search" type="search" bind:value={search} maxlength="200" disabled={loading} class="w-full border-2 border-black bg-white px-3 py-2 text-sm" />
    </div>
    <button type="submit" disabled={loading} class="retro-btn bg-[#BFD7FE] px-3 py-2 text-xs">Rechercher</button>
    <button type="button" disabled={loading} onclick={() => load(pagination?.current_page ?? 1)} class="retro-btn bg-white px-3 py-2 text-xs">Actualiser</button>
  </form>

  <div aria-busy={loading}>
    {#if error}
      <div role="alert" class="border-2 border-black bg-[#FFE2E2] p-4 text-sm">
        <p class="whitespace-pre-wrap break-words">{error}</p>
        <button type="button" onclick={() => load(requestedPage)} class="retro-btn mt-3 bg-white px-3 py-2 text-xs">Réessayer</button>
      </div>
    {:else if loading}
      <p role="status" class="text-sm">Chargement des utilisateurs…</p>
    {:else if users.length === 0}
      <p class="border-2 border-black bg-white p-5 text-sm">Aucun utilisateur trouvé.</p>
    {:else}
      <div class="overflow-x-auto border-2 border-black bg-white shadow-[4px_4px_0px_0px_#000]" tabindex="0" role="region" aria-label="Tableau des utilisateurs">
        <table class="w-full text-left text-xs">
          <caption class="sr-only">Utilisateurs, abonnement newsletter, statut client et vendeur, articles en vente et achats</caption>
          <thead class="border-b-2 border-black bg-[#BFD7FE]">
            <tr>
              <th scope="col" class="p-3 font-black">Utilisateur</th>
              <th scope="col" class="p-3 font-black">Email</th>
              <th scope="col" class="p-3 font-black">Newsletter</th>
              <th scope="col" class="p-3 font-black">Client</th>
              <th scope="col" class="p-3 font-black">Vendeur</th>
              <th scope="col" class="p-3 text-right font-black whitespace-nowrap">Articles en vente</th>
              <th scope="col" class="p-3 text-right font-black">Achats</th>
            </tr>
          </thead>
          <tbody>
            {#each users as user (user.id)}
              <tr class="border-b border-black/20 last:border-0">
                <th scope="row" class="p-3 font-bold">
                  {user.name}
                  <span class="mt-1 block text-[10px] font-normal text-black/55">{user.id}</span>
                </th>
                <td class="p-3">{user.email || "Non renseigné"}</td>
                <td class="p-3">{user.newsletter_subscribed ? "Oui" : "Non enregistré"}</td>
                <td class="p-3">{user.is_customer ? "Oui" : "Non"}</td>
                <td class="p-3">{user.is_seller ? "Oui" : "Non"}</td>
                <td class="p-3 text-right font-bold">{user.active_articles}</td>
                <td class="p-3 text-right font-bold">{user.purchases}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      {#if pagination && pagination.total_pages > 1}
        <PaginationComponent {pagination} onPageChange={(page) => { void load(page); }} />
      {/if}
    {/if}
  </div>

  <div class="space-y-2 text-xs leading-relaxed text-black/65">
    <p>Client : au moins une commande payée ou terminée. Achats : nombre de ces commandes, hors commandes annulées.</p>
    <p>Vendeur : un compte ayant créé une boutique. Articles en vente : articles actifs et approuvés, pas les articles vendus ou en attente.</p>
    <p>Newsletter : inscriptions enregistrées depuis la mise en place du suivi, reliées aux emails vérifiés du compte. Les anciennes inscriptions non enregistrées ne sont pas récupérables.</p>
  </div>
</section>
