<script lang="ts">
  import { onMount } from "svelte";
  import { apiFetch } from "../../../lib/api";
  import { channels } from "../../../lib/channels";
  import {
    draftKey,
    initialPublicationText,
    inventoryURL,
    readDraft,
    readInventoryResponse,
    type PublicationArticle,
    type PublicationDraft,
    type SocialChannelID
  } from "../../../lib/social-publication";
  import type { Pagination } from "../../../type";
  import PaginationComponent from "../atoms/Pagination.svelte";

  let { channel, apiUrl, userId }: { channel: SocialChannelID; apiUrl?: string; userId: string } = $props();
  const definition = $derived(channels.find((item) => item.id === channel)!);
  let articles = $state<PublicationArticle[]>([]);
  let pagination = $state<Pagination | null>(null);
  let loading = $state(true);
  let inventoryError = $state("");
  let editorError = $state("");
  let notice = $state("");
  let selected = $state<PublicationArticle | null>(null);
  let text = $state("");
  let imageId = $state<number | null>(null);
  let savedText = $state("");
  let savedImageId = $state<number | null>(null);
  let copying = $state(false);
  let controller: AbortController | undefined;
  const dirty = $derived(selected !== null && (text !== savedText || imageId !== savedImageId));
  const selectedImage = $derived(selected?.images.find((image) => image.id === imageId));
  const hasText = $derived(text.trim().length > 0);
  const formattedPrice = (price: number) =>
    new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(price);

  function reportError(cause: unknown, target: "inventory" | "editor") {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error(`[${channel}] Préparation de publication :`, cause);
    if (target === "inventory") inventoryError = message;
    else editorError = message;
  }

  async function loadInventory(page = 1) {
    if (loading && controller) return;
    loading = true;
    inventoryError = "";
    const current = new AbortController();
    controller = current;
    try {
      const response = await apiFetch(inventoryURL(apiUrl, page), {
        signal: AbortSignal.any([current.signal, AbortSignal.timeout(30000)])
      });
      const result = await readInventoryResponse(response);
      if (current.signal.aborted) return;
      articles = result.data;
      pagination = result.pagination;
    } catch (cause) {
      if (!current.signal.aborted) {
        reportError(cause instanceof TypeError
          ? new Error(`Impossible de contacter Central-API : ${cause.message}. Vérifiez le réseau, l'adresse API_URL et les autorisations CORS.`)
          : cause, "inventory");
      }
    } finally {
      if (!current.signal.aborted) loading = false;
    }
  }

  function selectArticle(article: PublicationArticle) {
    if (selected?.id === article.id) return;
    if (dirty && !window.confirm("Le brouillon contient des modifications non enregistrées. Les abandonner pour choisir un autre article ?")) return;
    selected = article;
    text = initialPublicationText(article);
    imageId = article.images[0]?.id ?? null;
    editorError = "";
    notice = "";
    try {
      const raw = localStorage.getItem(draftKey(userId, channel, article.id));
      if (raw !== null) {
        const draft = readDraft(raw, article.id);
        text = draft.text;
        if (draft.imageId !== null && article.images.some((image) => image.id === draft.imageId)) {
          imageId = draft.imageId;
        } else if (draft.imageId !== null) {
          notice = "La photo du brouillon n'est plus dans l'inventaire. La première photo disponible a été sélectionnée.";
        }
        if (!notice) notice = "Brouillon enregistré retrouvé dans ce navigateur.";
      }
    } catch (cause) {
      reportError(cause, "editor");
    }
    savedText = text;
    savedImageId = imageId;
  }

  function saveDraft() {
    if (!selected || !hasText) return;
    editorError = "";
    notice = "";
    try {
      const draft: PublicationDraft = {
        version: 1,
        articleId: selected.id,
        text,
        imageId,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(draftKey(userId, channel, selected.id), JSON.stringify(draft));
      savedText = text;
      savedImageId = imageId;
      notice = "Brouillon enregistré dans ce navigateur. Rien n'a été publié.";
    } catch (cause) {
      reportError(cause, "editor");
    }
  }

  async function copyText() {
    if (!hasText || copying) return;
    copying = true;
    editorError = "";
    notice = "";
    try {
      await navigator.clipboard.writeText(text);
      notice = "Texte copié. Rien n'a été publié.";
    } catch (cause) {
      reportError(new Error(`Impossible de copier le texte : ${cause instanceof Error ? cause.message : String(cause)}. Sélectionnez et copiez le texte dans le champ de rédaction.`), "editor");
    } finally {
      copying = false;
    }
  }

  onMount(() => {
    void loadInventory();
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      controller?.abort();
      window.removeEventListener("beforeunload", beforeUnload);
    };
  });
</script>

<section class="space-y-6 font-mono" aria-labelledby="publication-title">
  <header class="space-y-2 border-t-2 border-black pt-6">
    <h2 id="publication-title" class="text-xl font-black uppercase">Préparer une publication</h2>
    <p class="text-xs leading-relaxed text-black/65">
      Choisissez un article actif de votre inventaire Daisy Brocante et rédigez votre publication {definition.name}.
      Cette préparation est disponible même sans connexion au réseau. Aucun envoi n'est effectué.
    </p>
  </header>

  <div aria-busy={loading}>
    {#if inventoryError}
      <div role="alert" class="mb-4 border-2 border-black bg-[#FFE2E2] p-4 text-xs">
        <p class="whitespace-pre-wrap break-words">{inventoryError}</p>
        <button type="button" class="retro-btn mt-3 bg-white px-3 py-2 text-xs" disabled={loading} onclick={() => loadInventory(pagination?.current_page ?? 1)}>Réessayer</button>
      </div>
    {/if}
    {#if loading}
      <p role="status" class="text-sm">Chargement des articles actifs…</p>
    {:else if !inventoryError}
      {#if articles.length === 0}
        <p class="border-2 border-black bg-white p-5 text-sm">Aucun article actif dans votre inventaire Daisy Brocante.</p>
      {:else}
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {#each articles as article (article.id)}
            <button
              type="button"
              aria-pressed={selected?.id === article.id}
              aria-label={`Choisir ${article.name}`}
              onclick={() => selectArticle(article)}
              class="group overflow-hidden border-2 border-black bg-white text-left shadow-[4px_4px_0px_0px_#000] transition-transform hover:-translate-y-1 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-black"
            >
              <div class="aspect-[4/3] border-b-2 border-black bg-[#EDE9DF]">
                {#if import.meta.env.PUBLIC_DISABLE_IMAGES !== "true" && article.images[0]?.url}
                  <img src={article.images[0].url} alt={article.name} class="h-full w-full object-cover" loading="lazy" />
                {:else}
                  <span class="grid h-full place-items-center text-xs text-black/55">Sans aperçu photo</span>
                {/if}
              </div>
              <div class="space-y-2 p-4">
                <h3 class="text-sm font-black uppercase">{article.name}</h3>
                <div class="flex items-center justify-between gap-3 text-xs">
                  <span>{formattedPrice(article.price)}</span>
                  <span class={selected?.id === article.id ? "bg-[#86E2D5] px-2 py-1 font-bold" : "font-bold"}>
                    {selected?.id === article.id ? "Sélectionné" : "Choisir"}
                  </span>
                </div>
              </div>
            </button>
          {/each}
        </div>
        {#if pagination && pagination.total_pages > 1}
          <PaginationComponent {pagination} onPageChange={(page) => { void loadInventory(page); }} />
        {/if}
      {/if}
    {/if}
  </div>

  {#if selected}
    <div class="grid gap-6 lg:grid-cols-2">
      <section class="space-y-4 border-2 border-black bg-white p-5 shadow-[4px_4px_0px_0px_#000]" aria-labelledby="editor-title">
        <h3 id="editor-title" class="text-lg font-black uppercase">Rédiger · {selected.name}</h3>
        {#if selected.images.length > 0}
          <fieldset>
            <legend class="mb-2 text-xs font-bold">Photo de la publication</legend>
            <div class="flex flex-wrap gap-3">
              {#each selected.images as image, index (image.id)}
                <label class="flex cursor-pointer flex-col gap-2 border-2 border-black p-2 text-xs">
                  {#if import.meta.env.PUBLIC_DISABLE_IMAGES !== "true"}
                    <img src={image.url} alt={`${selected.name} — photo ${index + 1}`} class="h-16 w-16 object-cover" loading="lazy" />
                  {/if}
                  <span class="flex items-center gap-1">
                    <input type="radio" name="publication-photo" value={image.id} bind:group={imageId} />
                    Photo {index + 1}
                  </span>
                </label>
              {/each}
            </div>
          </fieldset>
        {:else}
          <p class="text-xs text-black/65">Cet article n'a pas de photo. Vous pouvez préparer son texte.</p>
        {/if}
        <div>
          <label for="publication-text" class="mb-2 block text-xs font-bold">Texte de la publication {definition.name}</label>
          <textarea id="publication-text" bind:value={text} rows="10" class="w-full border-2 border-black bg-white p-3 text-sm leading-relaxed focus:outline focus:outline-2 focus:outline-black" aria-describedby="publication-help"></textarea>
          <p id="publication-help" class="mt-2 text-xs text-black/65">{text.length} caractères · Modifiez le texte et ajoutez vos hashtags.</p>
        </div>
        <div class="flex flex-wrap gap-3">
          <button type="button" onclick={saveDraft} disabled={!hasText} class="retro-btn bg-[#86E2D5] px-3 py-2 text-xs disabled:opacity-50">Enregistrer le brouillon</button>
          <button type="button" onclick={copyText} disabled={!hasText || copying} class="retro-btn bg-white px-3 py-2 text-xs disabled:opacity-50">{copying ? "Copie en cours…" : "Copier le texte"}</button>
        </div>
        <p class="text-xs text-black/65">Les brouillons sont propres à votre compte, à chaque réseau et à chaque article. Ils restent uniquement dans ce navigateur.</p>
        {#if dirty}
          <p class="text-xs font-bold">Modifications non enregistrées.</p>
        {/if}
        {#if editorError}
          <div role="alert" class="border-2 border-black bg-[#FFE2E2] p-3 text-xs whitespace-pre-wrap break-words">{editorError}</div>
        {/if}
        {#if notice}
          <p role="status" class="text-xs">{notice}</p>
        {/if}
      </section>
      <section class="space-y-4 border-2 border-black bg-white p-5 shadow-[4px_4px_0px_0px_#000]" aria-labelledby="preview-title">
        <h3 id="preview-title" class="text-lg font-black uppercase">Aperçu · {definition.name}</h3>
        <p class="text-xs text-black/65">Aperçu indicatif, pas une publication envoyée.</p>
        {#if selectedImage && import.meta.env.PUBLIC_DISABLE_IMAGES !== "true"}
          <img src={selectedImage.url} alt={selected.name} class="max-h-96 w-full border-2 border-black object-contain" />
        {/if}
        <p class="whitespace-pre-wrap break-words text-sm leading-relaxed">{text || "Votre texte apparaîtra ici."}</p>
        {#if channel === "tiktok"}
          <p class="border-t-2 border-black pt-3 text-xs text-black/65">La photo sert de référence et le texte prépare votre légende TikTok. Aucune vidéo n'est créée ou envoyée.</p>
        {/if}
      </section>
    </div>
  {/if}
</section>
