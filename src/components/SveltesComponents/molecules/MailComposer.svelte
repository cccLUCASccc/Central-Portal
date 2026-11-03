<script lang="ts">
  import { onMount } from "svelte";
  import { apiFetch } from "../../../lib/api";
  import {
    MAX_MAIL_ITEMS,
    MAX_RECIPIENTS,
    defaultDocument,
    draftKey,
    fallbackPreview,
    formatPrice,
    imageLayouts,
    inventorySearchURL,
    itemFromArticle,
    objectLayouts,
    parseRecipients,
    readDraft,
    renderMail,
    textLayouts,
    type MailArticle,
    type MailDocument,
    type MailDraft
  } from "../../../lib/mail-composer";
  import { readInventoryResponse } from "../../../lib/social-publication";
  import type { Pagination } from "../../../type";
  import PaginationComponent from "../atoms/Pagination.svelte";
  import {
    assistantOptions, assistantRequest, currentCopy, readMailCopy,
    type AssistantSettings, type MailCopy
  } from "../../../lib/mail-assistant";

  let { apiUrl, userId }: { apiUrl?: string; userId: string } = $props();

  type Tab = "content" | "objects" | "layout" | "send";
  type MailStatus = { authorized: boolean; configured: boolean; user_id?: string; from?: string; configuration_error?: string };
  type SendResult = { email: string; sent: boolean; error?: string };
  type HistoryEntry = { id: number; recipient: string; subject: string; status: string; error?: string; created_at: string };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "content", label: "Texte", icon: "edit_note" },
    { id: "objects", label: "Objets", icon: "inventory_2" },
    { id: "layout", label: "Mise en page", icon: "dashboard_customize" },
    { id: "send", label: "Envoi", icon: "send" }
  ];
  const accentPresets = ["#C2185B", "#111111", "#2E7D6B", "#B5651D", "#1F4E79", "#8E6C1A"];
  const showImages = import.meta.env.PUBLIC_DISABLE_IMAGES !== "true";
  const base = $derived((apiUrl ?? "").replace(/\/+$/, ""));

  let tab = $state<Tab>("content");
  let doc = $state<MailDocument>(defaultDocument());
  let recipients = $state("");
  let replyTo = $state("");
  let draftReady = $state(false);
  let draftNotice = $state("");
  let draftError = $state("");

  let articles = $state<MailArticle[]>([]);
  let pagination = $state<Pagination | null>(null);
  let search = $state("");
  let inventoryLoading = $state(false);
  let inventoryError = $state("");
  let inventoryLoaded = $state(false);
  let inventoryController: AbortController | undefined;

  let previewWidth = $state<"desktop" | "mobile">("desktop");
  let previewMode = $state<"interactive" | "fallback">("interactive");
  let previewHtml = $state("");
  let previewFrame = $state<HTMLIFrameElement | null>(null);
  let previewScroll = 0;

  let status = $state<MailStatus | null>(null);
  let statusError = $state("");
  let sending = $state(false);
  let sendError = $state("");
  let sendNotice = $state("");
  let sendResults = $state<SendResult[]>([]);
  let history = $state<HistoryEntry[]>([]);
  let historyError = $state("");
  let historyLoading = $state(false);
  let exportNotice = $state("");
  let assistant = $state<AssistantSettings>({
    objective: "partnership", audience: "decorator", tone: "warm", length: "short", instructions: ""
  });
  let assistantLoading = $state(false);
  let assistantError = $state("");
  let assistantNotice = $state("");
  let suggestion = $state<MailCopy | null>(null);
  let suggestionSource = "";
  let previousCopy = $state<MailCopy | null>(null);
  let appliedCopy = "";
  let assistantController: AbortController | undefined;
  const assistantLabels = {
    subject: "Objet", preheader: "Texte d'aperçu", title: "Titre",
    intro: "Introduction", outro: "Conclusion", ctaLabel: "Libellé du bouton"
  };

  async function generateCopy(mode: "draft" | "improve") {
    if (assistantLoading) return;
    assistantError = "";
    assistantNotice = "";
    if (mode === "draft" && !assistant.instructions.trim()) {
      assistantError = "Indiquez votre proposition et les avantages réels dans les consignes.";
      return;
    }
    if (mode === "improve" && !(doc.intro + doc.outro).trim()) {
      assistantError = "Rédigez d'abord une introduction ou une conclusion.";
      return;
    }
    assistantLoading = true;
    suggestion = null;
    const controller = new AbortController();
    assistantController = controller;
    const source = JSON.stringify(currentCopy(doc));
    try {
      const response = await apiFetch(`${base}/api/mails/assist`, {
        method: "POST",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(55000)]),
        body: JSON.stringify(assistantRequest(doc, assistant, mode))
      });
      const body: unknown = await readJSON(response);
      if (controller.signal.aborted) return;
      if (!response.ok) {
        const message = typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
          ? body.error : `Rédaction indisponible (HTTP ${response.status}).`;
        throw new Error(message);
      }
      suggestion = readMailCopy(body);
      suggestionSource = source;
    } catch (cause) {
      if (!controller.signal.aborted) assistantError = errorMessage(cause);
    } finally {
      if (assistantController === controller) assistantLoading = false;
    }
  }

  function applySuggestion() {
    if (!suggestion) return;
    if (JSON.stringify(currentCopy(doc)) !== suggestionSource &&
      !window.confirm("Le texte a changé depuis cette demande. Remplacer les six champs de rédaction par la proposition IA ?")) return;
    previousCopy = currentCopy(doc);
    doc = { ...doc, ...suggestion };
    appliedCopy = JSON.stringify(currentCopy(doc));
    suggestion = null;
    assistantNotice = "Proposition appliquée. Vérifiez le texte et la destination du bouton avant l'envoi.";
  }

  function undoSuggestion() {
    if (!previousCopy) return;
    if (JSON.stringify(currentCopy(doc)) !== appliedCopy &&
      !window.confirm("Le texte a été modifié. Restaurer la version précédant l'application de l'IA ?")) return;
    doc = { ...doc, ...previousCopy };
    previousCopy = null;
    assistantNotice = "Texte précédent restauré.";
  }

  const rendered = $derived(renderMail(doc));
  const parsedRecipients = $derived(parseRecipients(recipients));
  const selectedIds = $derived(new Set(doc.items.map((item) => item.article.id)));
  const canSend = $derived(
    !!status?.authorized && !!status?.configured && !sending &&
    !appointmentError &&
    doc.subject.trim().length > 0 && parsedRecipients.valid.length > 0 &&
    parsedRecipients.valid.length <= MAX_RECIPIENTS && parsedRecipients.invalid.length === 0
  );
  let testAddress = $state("");
  const appointmentError = $derived(
    doc.showAppointment && (!URL.canParse(doc.appointmentUrl.trim()) ||
      !["https:", "http:"].includes(new URL(doc.appointmentUrl.trim()).protocol))
      ? "Ajoutez un lien de réservation Google Agenda valide avant l'envoi, ou désactivez le rendez-vous." : ""
  );

  function errorMessage(cause: unknown): string {
    if (cause instanceof TypeError) {
      return `Impossible de contacter Central-API : ${cause.message}. Vérifiez le réseau, l'adresse API_URL et les autorisations CORS.`;
    }
    return cause instanceof Error ? cause.message : String(cause);
  }

  async function readJSON(response: Response): Promise<any> {
    try {
      return await response.json();
    } catch {
      throw new Error(`Réponse illisible de Central-API (HTTP ${response.status}).`);
    }
  }

  // ---------- Aperçu ----------
  let previewTimer: ReturnType<typeof setTimeout> | undefined;
  let firstPreview = true;
  $effect(() => {
    const next = previewMode === "fallback" ? fallbackPreview(rendered.html) : rendered.html;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      try {
        previewScroll = previewFrame?.contentWindow?.scrollY ?? previewScroll;
      } catch {
        // Lecture impossible : on garde la dernière position connue.
      }
      previewHtml = next;
    }, firstPreview ? 0 : 150);
    firstPreview = false;
  });

  function restorePreviewScroll() {
    try {
      previewFrame?.contentWindow?.scrollTo(0, previewScroll);
    } catch {
      // Sans accès au document, l'aperçu repart du haut.
    }
  }

  // ---------- Brouillon ----------
  let draftTimer: ReturnType<typeof setTimeout> | undefined;
  let lastSavedContent = "";
  $effect(() => {
    const content = JSON.stringify({ document: $state.snapshot(doc), recipients, replyTo });
    if (!draftReady || content === lastSavedContent) return;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      try {
        const draft: MailDraft = { version: 1, ...JSON.parse(content), savedAt: new Date().toISOString() };
        localStorage.setItem(draftKey(userId), JSON.stringify(draft));
        lastSavedContent = content;
        draftError = "";
        draftNotice = `Brouillon enregistré automatiquement à ${new Date().toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" })}.`;
      } catch (cause) {
        draftError = `Le brouillon n'a pas pu être enregistré dans ce navigateur : ${errorMessage(cause)}`;
      }
    }, 600);
  });

  function loadDraft() {
    try {
      const raw = localStorage.getItem(draftKey(userId));
      if (raw) {
        const draft = readDraft(raw);
        doc = draft.document;
        recipients = draft.recipients;
        replyTo = draft.replyTo;
        lastSavedContent = JSON.stringify({ document: draft.document, recipients: draft.recipients, replyTo: draft.replyTo });
        draftNotice = "Brouillon précédent retrouvé dans ce navigateur.";
      }
    } catch (cause) {
      draftError = errorMessage(cause);
    } finally {
      draftReady = true;
    }
  }

  function resetMail() {
    if (!window.confirm("Effacer le mail en cours et repartir d'un mail vierge ?")) return;
    assistantController?.abort();
    assistantController = undefined;
    assistantLoading = false;
    suggestion = null;
    previousCopy = null;
    assistantError = "";
    assistantNotice = "";
    assistant.instructions = "";
    doc = defaultDocument();
    recipients = "";
    replyTo = "";
    sendResults = [];
    sendNotice = "";
    sendError = "";
    draftNotice = "Nouveau mail.";
  }

  // ---------- Inventaire ----------
  async function loadInventory(page = 1) {
    inventoryController?.abort();
    const current = new AbortController();
    inventoryController = current;
    inventoryLoading = true;
    inventoryError = "";
    try {
      const response = await apiFetch(inventorySearchURL(apiUrl, page, search), {
        signal: AbortSignal.any([current.signal, AbortSignal.timeout(30000)])
      });
      const result = await readInventoryResponse(response);
      if (current.signal.aborted) return;
      articles = result.data;
      pagination = result.pagination;
      inventoryLoaded = true;
    } catch (cause) {
      if (!current.signal.aborted) inventoryError = errorMessage(cause);
    } finally {
      if (!current.signal.aborted) inventoryLoading = false;
    }
  }

  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  function onSearchInput() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => void loadInventory(1), 350);
  }

  function toggleArticle(article: MailArticle) {
    const index = doc.items.findIndex((item) => item.article.id === article.id);
    if (index >= 0) {
      doc.items.splice(index, 1);
      return;
    }
    if (doc.items.length >= MAX_MAIL_ITEMS) {
      inventoryError = `Un mail peut contenir au maximum ${MAX_MAIL_ITEMS} objets.`;
      return;
    }
    doc.items.push(itemFromArticle(article));
  }

  function moveItem(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= doc.items.length) return;
    const [item] = doc.items.splice(index, 1);
    doc.items.splice(target, 0, item);
  }

  $effect(() => {
    if (tab === "objects" && !inventoryLoaded && !inventoryLoading && !inventoryError) void loadInventory(1);
  });

  // ---------- Export ----------
  async function copyHtml() {
    exportNotice = "";
    try {
      await navigator.clipboard.writeText(rendered.html);
      exportNotice = "Code HTML copié.";
    } catch (cause) {
      exportNotice = `Copie impossible : ${errorMessage(cause)}`;
    }
  }

  function downloadHtml() {
    const name = (doc.subject || doc.title || "mail").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "mail";
    const url = URL.createObjectURL(new Blob([rendered.html], { type: "text/html;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name}.html`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    exportNotice = "Fichier HTML téléchargé.";
  }

  // ---------- Envoi ----------
  async function loadStatus() {
    statusError = "";
    try {
      const response = await apiFetch(`${base}/api/mails/status`);
      const body = await readJSON(response);
      if (!response.ok) throw new Error(body?.error ?? `Statut d'envoi indisponible (HTTP ${response.status}).`);
      status = body as MailStatus;
      testAddress = (window as any).Clerk?.user?.primaryEmailAddress?.emailAddress ?? "";
      if (status.authorized) void loadHistory();
    } catch (cause) {
      statusError = errorMessage(cause);
    }
  }

  async function loadHistory() {
    historyLoading = true;
    historyError = "";
    try {
      const response = await apiFetch(`${base}/api/mails/history?limit=50`);
      const body = await readJSON(response);
      if (!response.ok) throw new Error(body?.error ?? `Historique indisponible (HTTP ${response.status}).`);
      history = Array.isArray(body?.data) ? body.data : [];
    } catch (cause) {
      historyError = errorMessage(cause);
    } finally {
      historyLoading = false;
    }
  }

  async function send(to: string[], isTest: boolean) {
    if (sending) return;
    sendError = "";
    sendNotice = "";
    sendResults = [];
    if (appointmentError) {
      sendError = appointmentError;
      return;
    }
    if (!doc.subject.trim()) {
      sendError = "Ajoutez un objet au mail avant de l'envoyer (onglet Texte).";
      return;
    }
    const label = isTest ? `un mail de test à ${to[0]}` : `ce mail à ${to.length} destinataire(s)`;
    if (!window.confirm(`Envoyer ${label} ? Chaque destinataire reçoit un mail individuel.`)) return;
    sending = true;
    try {
      const response = await apiFetch(`${base}/api/mails/send`, {
        method: "POST",
        body: JSON.stringify({
          recipients: to,
          subject: isTest ? `[TEST] ${doc.subject.trim()}` : doc.subject.trim(),
          html: rendered.html,
          text: rendered.text,
          reply_to: replyTo.trim()
        })
      });
      const body = await readJSON(response);
      if (Array.isArray(body?.results)) sendResults = body.results;
      if (!response.ok && !Array.isArray(body?.results)) {
        throw new Error(body?.error ?? `Envoi impossible (HTTP ${response.status}).`);
      }
      const sent = Number(body?.sent ?? 0);
      const failed = Number(body?.failed ?? 0);
      if (sent > 0) sendNotice = `${sent} mail(s) envoyé(s)${failed ? `, ${failed} échec(s)` : ""}.`;
      else sendError = "Aucun mail n'a pu être envoyé. Consultez le détail ci-dessous.";
      void loadHistory();
    } catch (cause) {
      sendError = errorMessage(cause);
    } finally {
      sending = false;
    }
  }

  onMount(() => {
    loadDraft();
    void loadStatus();
    return () => {
      assistantController?.abort();
      inventoryController?.abort();
      clearTimeout(previewTimer);
      clearTimeout(draftTimer);
      clearTimeout(searchTimer);
    };
  });

  const inputClass = "w-full border-2 border-black bg-white p-2 text-sm focus:outline focus:outline-2 focus:outline-black";
  const labelClass = "mb-1 block text-xs font-bold uppercase";
  const optionClass = (active: boolean) =>
    `flex h-full cursor-pointer flex-col gap-1 border-2 border-black p-3 text-left text-xs transition-colors ${active ? "bg-[#86E2D5] shadow-[3px_3px_0px_0px_#000]" : "bg-white hover:bg-[#FFF394]"}`;
</script>

<section class="space-y-6 font-mono" aria-labelledby="mail-title">
  <header class="flex flex-col gap-4 border-b-2 border-black pb-6 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 id="mail-title" class="text-3xl font-black uppercase">Rédaction de mail</h1>
      <p class="mt-2 max-w-2xl text-sm text-black/65">
        Composez un mail pour vos prospects, ajoutez des objets de l'inventaire et choisissez leur mise en forme. L'aperçu se met à jour en temps réel.
      </p>
    </div>
    <div class="flex flex-wrap gap-2">
      <button type="button" class="retro-btn bg-white px-3 py-2 text-xs" onclick={resetMail}>
        <span class="material-symbols-outlined text-[16px]" aria-hidden="true">note_add</span> Nouveau mail
      </button>
    </div>
  </header>

  {#if draftError}
    <div role="alert" class="border-2 border-black bg-[#FFE2E2] p-3 text-xs">{draftError}</div>
  {/if}

  <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
    <!-- Éditeur -->
    <div class="min-w-0 space-y-4">
      <div role="tablist" aria-label="Étapes de rédaction" class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {#each tabs as item (item.id)}
          <button
            type="button"
            role="tab"
            id={`mail-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`mail-panel-${item.id}`}
            class="retro-btn justify-center px-2 py-2 text-xs {tab === item.id ? '!bg-[#FFAEC1]' : 'bg-white'}"
            onclick={() => (tab = item.id)}
          >
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">{item.icon}</span>
            {item.label}
            {#if item.id === "objects" && doc.items.length}
              <span class="border border-black bg-white px-1 text-[10px]">{doc.items.length}</span>
            {/if}
          </button>
        {/each}
      </div>

      <div class="border-2 border-black bg-white p-5 shadow-[4px_4px_0px_0px_#000]">
        {#if tab === "content"}
          <div id="mail-panel-content" role="tabpanel" aria-labelledby="mail-tab-content" class="space-y-4">
            <section aria-labelledby="mail-ai-title" class="space-y-3 border-2 border-black bg-[#F4F1EA] p-4">
              <h2 id="mail-ai-title" class="font-bold">Assistant de rédaction IA</h2>
              <div class="grid gap-3 sm:grid-cols-2">
                <div>
                  <label for="mail-ai-objective" class={labelClass}>Objectif</label>
                  <select id="mail-ai-objective" class={inputClass} bind:value={assistant.objective}>
                    {#each assistantOptions.objective as option}<option value={option.id}>{option.label}</option>{/each}
                  </select>
                </div>
                <div>
                  <label for="mail-ai-audience" class={labelClass}>Public visé</label>
                  <select id="mail-ai-audience" class={inputClass} bind:value={assistant.audience}>
                    {#each assistantOptions.audience as option}<option value={option.id}>{option.label}</option>{/each}
                  </select>
                </div>
                <div>
                  <label for="mail-ai-tone" class={labelClass}>Ton</label>
                  <select id="mail-ai-tone" class={inputClass} bind:value={assistant.tone}>
                    {#each assistantOptions.tone as option}<option value={option.id}>{option.label}</option>{/each}
                  </select>
                </div>
                <div>
                  <label for="mail-ai-length" class={labelClass}>Longueur</label>
                  <select id="mail-ai-length" class={inputClass} bind:value={assistant.length}>
                    {#each assistantOptions.length as option}<option value={option.id}>{option.label}</option>{/each}
                  </select>
                </div>
              </div>
              <div>
                <label for="mail-ai-instructions" class={labelClass}>Votre proposition et vos consignes</label>
                <textarea id="mail-ai-instructions" class={inputClass} rows="4" maxlength="4000" bind:value={assistant.instructions}
                  placeholder="Ex. : Présenter notre sélection de pièces anciennes à des décorateurs et proposer un échange sur leurs projets. Ne pas proposer de remise."></textarea>
              </div>
              <p class="text-[11px]">En cliquant, vous transmettez à Gemini vos consignes, les six champs de rédaction ci-dessous et les noms des objets sélectionnés. Ni destinataires, ni historique, ni photos, ni signature ne sont transmis. N'incluez pas d'informations confidentielles. Relisez les engagements proposés ; l'IA ne doit inventer aucun avantage commercial.</p>
              <div class="flex flex-wrap gap-2">
                <button type="button" class="retro-btn bg-[#86E2D5] text-xs" disabled={assistantLoading || !status?.authorized} onclick={() => generateCopy("draft")}>
                  {assistantLoading ? "Rédaction en cours…" : "Rédiger une proposition"}
                </button>
                <button type="button" class="retro-btn bg-white text-xs" disabled={assistantLoading || !status?.authorized} onclick={() => generateCopy("improve")}>Améliorer mon texte</button>
              </div>
              {#if status && !status.authorized}<p class="text-xs">Votre compte doit être autorisé dans MAIL_ALLOWED_SENDERS pour utiliser l'assistant.</p>{/if}
              {#if statusError}<p role="alert" class="text-xs">{statusError}</p><button type="button" class="retro-btn bg-white text-xs" onclick={loadStatus}>Vérifier l'accès</button>{/if}
              {#if assistantError}<p role="alert" class="text-xs text-red-800">{assistantError}</p>{/if}
              {#if assistantNotice}<p role="status" class="text-xs">{assistantNotice}</p>{/if}
              {#if suggestion}
                <div class="space-y-3 border-2 border-black bg-white p-3" aria-label="Proposition IA à relire">
                  <h3 class="font-bold">Proposition — brouillon inchangé</h3>
                  {#each Object.entries(assistantLabels) as [key, label]}
                    <div><h4 class="text-xs font-bold">{label}</h4><p class="whitespace-pre-wrap break-words text-sm">{suggestion[key as keyof MailCopy] || "(vide)"}</p></div>
                  {/each}
                  <p class="text-[11px]">Appliquer remplace ces six champs seulement. Objets, mise en page, signature, pied de page et lien du bouton restent inchangés. Aucun mail n'est envoyé.</p>
                  <div class="flex flex-wrap gap-2">
                    <button type="button" class="retro-btn bg-[#86E2D5] text-xs" onclick={applySuggestion}>Appliquer au brouillon</button>
                    <button type="button" class="retro-btn bg-white text-xs" onclick={() => suggestion = null}>Ignorer</button>
                  </div>
                </div>
              {/if}
              {#if previousCopy}<button type="button" class="retro-btn bg-white text-xs" onclick={undoSuggestion}>Restaurer le texte précédent</button>{/if}
            </section>
            <div>
              <label for="mail-subject" class={labelClass}>Objet du mail *</label>
              <input id="mail-subject" class={inputClass} bind:value={doc.subject} maxlength="200" placeholder="Ex. : Nouveautés de la semaine chez Daisy Brocante" />
            </div>
            <div>
              <label for="mail-preheader" class={labelClass}>Texte d'aperçu</label>
              <input id="mail-preheader" class={inputClass} bind:value={doc.preheader} maxlength="150" placeholder="Affiché à côté de l'objet dans la boîte de réception" />
            </div>
            <div>
              <label for="mail-heading" class={labelClass}>Titre</label>
              <input id="mail-heading" class={inputClass} bind:value={doc.title} />
            </div>
            <div>
              <label for="mail-intro" class={labelClass}>Introduction (avant les objets)</label>
              <textarea id="mail-intro" class={inputClass} rows="6" bind:value={doc.intro}></textarea>
            </div>
            <div>
              <label for="mail-outro" class={labelClass}>Conclusion (après les objets)</label>
              <textarea id="mail-outro" class={inputClass} rows="4" bind:value={doc.outro}></textarea>
            </div>
            <p class="text-[11px] text-black/60">Astuce : laissez une ligne vide entre deux paragraphes, entourez un mot de **doubles astérisques** pour le mettre en gras ; les liens https:// deviennent cliquables.</p>
            <div class="space-y-2 border-2 border-black bg-[#F4F1EA] p-3">
              <label class="flex items-center gap-2 text-xs font-bold">
                <input type="checkbox" bind:checked={doc.showProfessionalTerms} /> Mentionner les conditions pour professionnels
              </label>
              {#if doc.showProfessionalTerms}
                <label for="mail-professional-terms" class={labelClass}>Mention professionnelle (avant la signature)</label>
                <textarea id="mail-professional-terms" class={inputClass} rows="3" bind:value={doc.professionalTerms}></textarea>
                <p class="text-[11px]">À activer uniquement si ces conditions existent. Indiquez uniquement vos engagements réels ; aucune remise n'est ajoutée automatiquement.</p>
              {/if}
            </div>
            <div class="space-y-2 border-2 border-black bg-[#F4F1EA] p-3">
              <label class="flex items-center gap-2 text-xs font-bold">
                <input type="checkbox" bind:checked={doc.showAppointment} /> Proposer un rendez-vous en visioconférence
              </label>
              {#if doc.showAppointment}
                <label for="mail-appointment-url" class={labelClass}>Lien de votre page de réservation Google Agenda</label>
                <input id="mail-appointment-url" type="url" class={inputClass} bind:value={doc.appointmentUrl} placeholder="https://calendar.google.com/calendar/appointments/…" />
                <p class="text-[11px]">Dans Google Agenda, créez un planning de rendez-vous, choisissez Google Meet comme lieu de réunion, puis copiez le lien de la page de réservation. Le destinataire choisira son créneau sur cette page ; l'invitation Meet sera gérée par Google Agenda.</p>
                <p class="text-[11px]">Le bouton « Prendre rendez-vous en visioconférence » est ajouté avant la signature, sans remplacer le bouton de la boutique. Le portail ne crée pas lui-même de réunion.</p>
                {#if appointmentError}<p role="alert" class="text-xs text-red-800">{appointmentError}</p>{/if}
              {/if}
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label for="mail-cta-label" class={labelClass}>Bouton : libellé</label>
                <input id="mail-cta-label" class={inputClass} bind:value={doc.ctaLabel} placeholder="Laisser vide pour masquer" />
              </div>
              <div>
                <label for="mail-cta-url" class={labelClass}>Bouton : lien</label>
                <input id="mail-cta-url" type="url" class={inputClass} bind:value={doc.ctaUrl} placeholder="https://daisybrocante.com/boutique" />
              </div>
            </div>
            <div>
              <label for="mail-signature" class={labelClass}>Signature</label>
              <textarea id="mail-signature" class={inputClass} rows="2" bind:value={doc.signature}></textarea>
            </div>
            <div>
              <label for="mail-footer" class={labelClass}>Pied de page</label>
              <textarea id="mail-footer" class={inputClass} rows="3" bind:value={doc.footer}></textarea>
              <p class="mt-1 text-[11px] text-black/60">Gardez une mention permettant au prospect de ne plus être contacté.</p>
            </div>
            <label class="flex items-center gap-2 text-xs font-bold">
              <input type="checkbox" bind:checked={doc.showLogo} /> Afficher le logo Daisy Brocante en en-tête
            </label>
          </div>
        {:else if tab === "objects"}
          <div id="mail-panel-objects" role="tabpanel" aria-labelledby="mail-tab-objects" class="space-y-6">
            <section aria-labelledby="mail-selected-title" class="space-y-3">
              <h2 id="mail-selected-title" class="text-sm font-black uppercase">Objets du mail ({doc.items.length}/{MAX_MAIL_ITEMS})</h2>
              <label class="flex items-center gap-2 text-xs font-bold">
                <input type="checkbox" bind:checked={doc.showPrices} /> Afficher les prix des objets dans le mail
              </label>
              <p class="text-[11px] text-black/60">Décochez pour masquer tous les prix, y compris ceux des objets ajoutés ensuite. Les choix individuels sont conservés.</p>
              {#if doc.items.length === 0}
                <p class="border-2 border-dashed border-black/40 p-4 text-xs text-black/60">Aucun objet. Choisissez-en dans l'inventaire ci-dessous.</p>
              {/if}
              {#each doc.items as item, index (item.article.id)}
                <article class="space-y-3 border-2 border-black bg-[#F6F4EE] p-3">
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <h3 class="text-sm font-black uppercase">{index + 1}. {item.article.name}</h3>
                      <p class="text-xs">{formatPrice(item.article.price)}</p>
                    </div>
                    <div class="flex shrink-0 gap-1">
                      <button type="button" class="retro-btn bg-white px-2 py-1 text-xs" disabled={index === 0} aria-label={`Monter ${item.article.name}`} onclick={() => moveItem(index, -1)}>↑</button>
                      <button type="button" class="retro-btn bg-white px-2 py-1 text-xs" disabled={index === doc.items.length - 1} aria-label={`Descendre ${item.article.name}`} onclick={() => moveItem(index, 1)}>↓</button>
                      <button type="button" class="retro-btn bg-[#FFE2E2] px-2 py-1 text-xs" aria-label={`Retirer ${item.article.name}`} onclick={() => doc.items.splice(index, 1)}>✕</button>
                    </div>
                  </div>
                  {#if item.article.images.length}
                    <fieldset>
                      <legend class="mb-1 text-[11px] font-bold">Photos ({item.imageIds.length}/{item.article.images.length})</legend>
                      <div class="flex flex-wrap gap-2">
                        {#each item.article.images as image, imageIndex (image.id)}
                          <label class="flex cursor-pointer flex-col items-center gap-1 border-2 p-1 text-[10px] {item.imageIds.includes(image.id) ? 'border-black bg-white' : 'border-black/20 opacity-60'}">
                            {#if showImages}
                              <img src={image.url} alt={`${item.article.name} — photo ${imageIndex + 1}`} class="h-12 w-12 object-cover" loading="lazy" />
                            {/if}
                            <span class="flex items-center gap-1">
                              <input type="checkbox" value={image.id} bind:group={item.imageIds} />
                              {imageIndex + 1}
                            </span>
                          </label>
                        {/each}
                      </div>
                    </fieldset>
                  {/if}
                  <div>
                    <label for={`mail-item-text-${item.article.id}`} class="mb-1 block text-[11px] font-bold">Texte de l'objet</label>
                    <textarea id={`mail-item-text-${item.article.id}`} class={inputClass} rows="3" bind:value={item.text}></textarea>
                  </div>
                  <div class="flex flex-wrap gap-4 text-xs">
                    <label class="flex items-center gap-1"><input type="checkbox" bind:checked={item.showPrice} disabled={!doc.showPrices} /> Afficher le prix</label>
                    <label class="flex items-center gap-1"><input type="checkbox" bind:checked={item.showLink} /> Bouton « Voir l'objet »</label>
                  </div>
                </article>
              {/each}
            </section>

            <section aria-labelledby="mail-inventory-title" class="space-y-3 border-t-2 border-black pt-5" aria-busy={inventoryLoading}>
              <h2 id="mail-inventory-title" class="text-sm font-black uppercase">Inventaire actif</h2>
              <label for="mail-search" class="sr-only">Rechercher un objet</label>
              <input id="mail-search" type="search" class={inputClass} placeholder="Rechercher un objet…" bind:value={search} oninput={onSearchInput} />
              {#if inventoryError}
                <div role="alert" class="border-2 border-black bg-[#FFE2E2] p-3 text-xs">
                  <p class="whitespace-pre-wrap break-words">{inventoryError}</p>
                  <button type="button" class="retro-btn mt-2 bg-white px-3 py-1 text-xs" onclick={() => loadInventory(pagination?.current_page ?? 1)}>Réessayer</button>
                </div>
              {/if}
              {#if inventoryLoading}
                <p role="status" class="text-xs">Chargement des objets…</p>
              {:else if inventoryLoaded && articles.length === 0}
                <p class="text-xs text-black/60">Aucun objet actif ne correspond.</p>
              {:else}
                <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {#each articles as article (article.id)}
                    {@const chosen = selectedIds.has(article.id)}
                    <button
                      type="button"
                      aria-pressed={chosen}
                      onclick={() => toggleArticle(article)}
                      class="overflow-hidden border-2 border-black text-left transition-transform hover:-translate-y-0.5 {chosen ? 'bg-[#86E2D5] shadow-[3px_3px_0px_0px_#000]' : 'bg-white'}"
                    >
                      <div class="aspect-square border-b-2 border-black bg-[#EDE9DF]">
                        {#if showImages && article.images[0]?.url}
                          <img src={article.images[0].url} alt="" class="h-full w-full object-cover" loading="lazy" />
                        {:else}
                          <span class="grid h-full place-items-center text-[10px] text-black/50">Sans photo</span>
                        {/if}
                      </div>
                      <div class="space-y-1 p-2">
                        <p class="line-clamp-2 text-[11px] font-black uppercase">{article.name}</p>
                        <p class="flex items-center justify-between text-[11px]">
                          <span>{formatPrice(article.price)}</span>
                          <span class="font-bold">{chosen ? "✓ Ajouté" : "+ Ajouter"}</span>
                        </p>
                      </div>
                    </button>
                  {/each}
                </div>
                {#if pagination && pagination.total_pages > 1}
                  <PaginationComponent {pagination} onPageChange={(page) => { void loadInventory(page); }} />
                {/if}
              {/if}
            </section>
          </div>
        {:else if tab === "layout"}
          <div id="mail-panel-layout" role="tabpanel" aria-labelledby="mail-tab-layout" class="space-y-6">
            <fieldset>
              <legend class={labelClass}>Affichage des photos de chaque objet</legend>
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {#each imageLayouts as option (option.id)}
                  <label class={optionClass(doc.imageLayout === option.id)}>
                    <span class="flex items-center gap-2 font-black uppercase"><input type="radio" name="image-layout" value={option.id} bind:group={doc.imageLayout} /> {option.label}</span>
                    <span class="text-black/65">{option.hint}</span>
                  </label>
                {/each}
              </div>
              {#if doc.imageLayout === "gallery"}
                <div class="mt-3 flex items-center gap-3 text-xs">
                  <span class="font-bold">Colonnes de la galerie :</span>
                  <label class="flex items-center gap-1"><input type="radio" name="gallery-columns" value={2} bind:group={doc.galleryColumns} /> 2</label>
                  <label class="flex items-center gap-1"><input type="radio" name="gallery-columns" value={3} bind:group={doc.galleryColumns} /> 3</label>
                </div>
              {/if}
              {#if doc.objectLayout === "carousel"}
                <p class="mt-2 text-[11px] text-black/60">Avec le « Slider d'objets », seule la première photo de chaque objet est utilisée.</p>
              {/if}
            </fieldset>

            <fieldset>
              <legend class={labelClass}>Disposition des objets</legend>
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {#each objectLayouts as option (option.id)}
                  <label class={optionClass(doc.objectLayout === option.id)}>
                    <span class="flex items-center gap-2 font-black uppercase"><input type="radio" name="object-layout" value={option.id} bind:group={doc.objectLayout} /> {option.label}</span>
                    <span class="text-black/65">{option.hint}</span>
                  </label>
                {/each}
              </div>
            </fieldset>

            <fieldset>
              <legend class={labelClass}>Disposition du texte</legend>
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {#each textLayouts as option (option.id)}
                  <label class={optionClass(doc.textLayout === option.id)}>
                    <span class="flex items-center gap-2 font-black uppercase"><input type="radio" name="text-layout" value={option.id} bind:group={doc.textLayout} /> {option.label}</span>
                    <span class="text-black/65">{option.hint}</span>
                  </label>
                {/each}
              </div>
            </fieldset>

            <div class="grid gap-4 sm:grid-cols-2">
              <fieldset disabled={doc.textLayout === "centered"}>
                <legend class={labelClass}>Alignement du texte</legend>
                <div class="flex flex-wrap gap-3 text-xs">
                  <label class="flex items-center gap-1"><input type="radio" name="text-align" value="left" bind:group={doc.textAlign} /> Gauche</label>
                  <label class="flex items-center gap-1"><input type="radio" name="text-align" value="center" bind:group={doc.textAlign} /> Centré</label>
                  <label class="flex items-center gap-1"><input type="radio" name="text-align" value="justify" bind:group={doc.textAlign} /> Justifié</label>
                </div>
              </fieldset>
              <fieldset>
                <legend class={labelClass}>Police</legend>
                <div class="flex flex-wrap gap-3 text-xs">
                  <label class="flex items-center gap-1"><input type="radio" name="font" value="sans" bind:group={doc.font} /> <span style="font-family:Helvetica,Arial,sans-serif">Moderne</span></label>
                  <label class="flex items-center gap-1"><input type="radio" name="font" value="serif" bind:group={doc.font} /> <span style="font-family:Georgia,serif">Classique</span></label>
                </div>
              </fieldset>
            </div>

            <fieldset>
              <legend class={labelClass}>Couleur d'accent</legend>
              <div class="flex flex-wrap items-center gap-2">
                {#each accentPresets as color (color)}
                  <button type="button" aria-label={`Couleur ${color}`} aria-pressed={doc.accentColor.toUpperCase() === color} class="h-8 w-8 border-2 border-black {doc.accentColor.toUpperCase() === color ? 'outline outline-2 outline-offset-2 outline-black' : ''}" style="background:{color}" onclick={() => (doc.accentColor = color)}></button>
                {/each}
                <label class="ml-2 flex items-center gap-2 text-xs">
                  Personnalisée <input type="color" bind:value={doc.accentColor} class="h-8 w-12 cursor-pointer border-2 border-black" />
                </label>
              </div>
            </fieldset>
          </div>
        {:else}
          <div id="mail-panel-send" role="tabpanel" aria-labelledby="mail-tab-send" class="space-y-4">
            {#if statusError}
              <div role="alert" class="border-2 border-black bg-[#FFE2E2] p-3 text-xs">
                {statusError}
                <button type="button" class="retro-btn ml-2 bg-white px-2 py-1 text-xs" onclick={loadStatus}>Réessayer</button>
              </div>
            {:else if !status}
              <p role="status" class="text-xs">Vérification de la configuration d'envoi…</p>
            {:else if !status.authorized}
              <div class="border-2 border-black bg-[#FFF394] p-3 text-xs leading-relaxed">
                <p class="font-bold">Votre compte n'est pas autorisé à envoyer des mails.</p>
                <p>Ajoutez votre identifiant Clerk <code class="border border-black bg-white px-1">{status.user_id}</code> à la variable <code>MAIL_ALLOWED_SENDERS</code> de Central-API. Vous pouvez toutefois exporter le HTML.</p>
              </div>
            {:else if !status.configured}
              <div class="border-2 border-black bg-[#FFF394] p-3 text-xs">
                <p class="font-bold">Le serveur SMTP n'est pas configuré.</p>
                <p>{status.configuration_error}</p>
              </div>
            {:else}
              <p class="border-2 border-black bg-[#D9F5EF] p-3 text-xs">Expéditeur : <strong>{status.from}</strong></p>
            {/if}

            <div>
              <label for="mail-recipients" class={labelClass}>Destinataires *</label>
              <textarea id="mail-recipients" class={inputClass} rows="4" bind:value={recipients} placeholder="prospect@exemple.com, autre@exemple.be" aria-describedby="mail-recipients-help"></textarea>
              <p id="mail-recipients-help" class="mt-1 text-[11px] text-black/60">
                Séparez les adresses par une virgule, un point-virgule ou un retour à la ligne. Chaque prospect reçoit un mail individuel (les autres adresses restent invisibles). Maximum {MAX_RECIPIENTS}.
              </p>
              <p class="mt-1 text-xs">
                <strong>{parsedRecipients.valid.length}</strong> adresse(s) valide(s)
                {#if parsedRecipients.valid.length > MAX_RECIPIENTS}<span class="font-bold text-[#B00020]"> — limite de {MAX_RECIPIENTS} dépassée</span>{/if}
              </p>
              {#if parsedRecipients.invalid.length}
                <p class="text-xs font-bold text-[#B00020]">Adresse(s) invalide(s) : {parsedRecipients.invalid.join(", ")}</p>
              {/if}
            </div>
            <div>
              <label for="mail-reply-to" class={labelClass}>Adresse de réponse (optionnel)</label>
              <input id="mail-reply-to" type="email" class={inputClass} bind:value={replyTo} placeholder="Par défaut : l'adresse d'expédition" />
            </div>
            {#if !doc.subject.trim()}
              <p class="text-xs font-bold text-[#B00020]">L'objet du mail est vide (onglet Texte).</p>
            {/if}
            <div class="flex flex-wrap gap-2">
              <button type="button" class="retro-btn bg-[#86E2D5] px-4 py-2 text-xs disabled:opacity-50" disabled={!canSend} onclick={() => send(parsedRecipients.valid, false)}>
                <span class="material-symbols-outlined text-[16px]" aria-hidden="true">send</span>
                {sending ? "Envoi en cours…" : `Envoyer à ${parsedRecipients.valid.length} destinataire(s)`}
              </button>
              {#if testAddress}
                <button type="button" class="retro-btn bg-white px-4 py-2 text-xs disabled:opacity-50" disabled={!status?.authorized || !status?.configured || sending || !doc.subject.trim()} onclick={() => send([testAddress], true)}>
                  M'envoyer un test ({testAddress})
                </button>
              {/if}
            </div>
            {#if sendError}
              <div role="alert" class="border-2 border-black bg-[#FFE2E2] p-3 text-xs whitespace-pre-wrap break-words">{sendError}</div>
            {/if}
            {#if sendNotice}
              <p role="status" class="border-2 border-black bg-[#D9F5EF] p-3 text-xs font-bold">{sendNotice}</p>
            {/if}
            {#if sendResults.length}
              <ul class="space-y-1 text-xs">
                {#each sendResults as result (result.email)}
                  <li class="flex flex-wrap gap-2 border-b border-black/10 py-1">
                    <span class={result.sent ? "font-bold text-[#1B7F5F]" : "font-bold text-[#B00020]"}>{result.sent ? "✓" : "✕"}</span>
                    <span>{result.email}</span>
                    {#if result.error}<span class="text-black/60">— {result.error}</span>{/if}
                  </li>
                {/each}
              </ul>
            {/if}

            {#if status?.authorized}
              <section class="space-y-2 border-t-2 border-black pt-4" aria-labelledby="mail-history-title">
                <div class="flex items-center justify-between">
                  <h2 id="mail-history-title" class="text-sm font-black uppercase">Derniers envois</h2>
                  <button type="button" class="retro-btn bg-white px-2 py-1 text-[11px]" disabled={historyLoading} onclick={loadHistory}>Actualiser</button>
                </div>
                {#if historyError}
                  <p role="alert" class="text-xs text-[#B00020]">{historyError}</p>
                {:else if history.length === 0}
                  <p class="text-xs text-black/60">{historyLoading ? "Chargement…" : "Aucun envoi pour le moment."}</p>
                {:else}
                  <div class="max-h-64 overflow-auto border-2 border-black">
                    <table class="w-full text-left text-[11px]">
                      <thead class="sticky top-0 bg-[#EDE9DF]">
                        <tr><th class="p-2">Date</th><th class="p-2">Destinataire</th><th class="p-2">Objet</th><th class="p-2">Statut</th></tr>
                      </thead>
                      <tbody>
                        {#each history as entry (entry.id)}
                          <tr class="border-t border-black/10">
                            <td class="whitespace-nowrap p-2">{new Date(entry.created_at).toLocaleString("fr-BE", { dateStyle: "short", timeStyle: "short" })}</td>
                            <td class="p-2">{entry.recipient}</td>
                            <td class="p-2">{entry.subject}</td>
                            <td class="p-2" title={entry.error ?? ""}>{entry.status === "sent" ? "✓ Envoyé" : "✕ Échec"}</td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                {/if}
              </section>
            {/if}
          </div>
        {/if}
      </div>
      {#if draftNotice}
        <p role="status" class="text-[11px] text-black/60">{draftNotice} Le brouillon reste uniquement dans ce navigateur.</p>
      {/if}
    </div>

    <!-- Aperçu -->
    <section class="min-w-0 xl:sticky xl:top-20 xl:self-start" aria-labelledby="mail-preview-title">
      <div class="border-2 border-black bg-[#EDE9DF] shadow-[4px_4px_0px_0px_#000]">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black p-3">
          <h2 id="mail-preview-title" class="text-sm font-black uppercase">Aperçu en direct</h2>
          <div class="flex flex-wrap gap-1 text-[11px]">
            <button type="button" aria-pressed={previewWidth === "desktop"} class="retro-btn px-2 py-1 {previewWidth === 'desktop' ? '!bg-[#BFD7FE]' : 'bg-white'}" onclick={() => (previewWidth = "desktop")}>
              <span class="material-symbols-outlined text-[14px]" aria-hidden="true">desktop_windows</span> Ordinateur
            </button>
            <button type="button" aria-pressed={previewWidth === "mobile"} class="retro-btn px-2 py-1 {previewWidth === 'mobile' ? '!bg-[#BFD7FE]' : 'bg-white'}" onclick={() => (previewWidth = "mobile")}>
              <span class="material-symbols-outlined text-[14px]" aria-hidden="true">smartphone</span> Mobile
            </button>
          </div>
        </div>
        <div class="space-y-1 border-b-2 border-black bg-white p-3 text-xs">
          <p class="truncate"><span class="text-black/50">Objet :</span> <strong>{doc.subject || "(sans objet)"}</strong></p>
          {#if doc.preheader}<p class="truncate text-black/60">{doc.preheader}</p>{/if}
        </div>
        {#if doc.imageLayout === "slider" || doc.objectLayout === "carousel"}
          <div class="flex flex-wrap items-center gap-2 border-b-2 border-black bg-[#FFF8D6] p-2 text-[11px]" role="group" aria-label="Rendu du slider">
            <span class="font-bold">Slider :</span>
            <label class="flex items-center gap-1"><input type="radio" name="preview-mode" value="interactive" bind:group={previewMode} /> Interactif (Apple Mail, iOS)</label>
            <label class="flex items-center gap-1"><input type="radio" name="preview-mode" value="fallback" bind:group={previewMode} /> Repli (Gmail, Outlook…)</label>
          </div>
        {/if}
        <div class="flex justify-center overflow-auto bg-[#D8D3C7] p-3">
          <iframe
            bind:this={previewFrame}
            title="Aperçu du mail"
            srcdoc={previewHtml}
            sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            onload={restorePreviewScroll}
            class="h-[75vh] border-2 border-black bg-white transition-[width] duration-200"
            style="width:{previewWidth === 'mobile' ? '375px' : '100%'};max-width:100%;"
          ></iframe>
        </div>
        <div class="flex flex-wrap items-center gap-2 border-t-2 border-black p-3">
          <button type="button" class="retro-btn bg-white px-3 py-1 text-xs" onclick={copyHtml}>
            <span class="material-symbols-outlined text-[14px]" aria-hidden="true">content_copy</span> Copier le HTML
          </button>
          <button type="button" class="retro-btn bg-white px-3 py-1 text-xs" onclick={downloadHtml}>
            <span class="material-symbols-outlined text-[14px]" aria-hidden="true">download</span> Télécharger .html
          </button>
          {#if exportNotice}<span role="status" class="text-[11px]">{exportNotice}</span>{/if}
        </div>
      </div>
    </section>
  </div>
</section>
