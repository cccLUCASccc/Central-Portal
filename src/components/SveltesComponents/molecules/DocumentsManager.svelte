<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import { apiFetch } from "../../../lib/api";

    interface Doc {
        id: number;
        title: string;
        file_name: string;
        content_type: string;
        size: number;
        created_at: string;
    }

    const MAX_FILES = 10;
    const MAX_BYTES = 25 * 1024 * 1024;

    let docs = $state<Doc[]>([]);
    let isLoading = $state(true);
    let error = $state("");
    let notice = $state("");
    let search = $state("");

    let files = $state<File[]>([]);
    let uploadTitle = $state("");
    let isUploading = $state(false);
    let isDragging = $state(false);
    let fileInput: HTMLInputElement;

    let openId = $state<number | null>(null);
    let editingTitle = $state("");
    let isDeleting = $state(false);

    // URLs blob des fichiers déjà chargés (les fichiers sont privés : chargés avec le jeton admin).
    let blobUrls = $state<Record<number, string>>({});
    const pending = new Set<number>();

    const filtered = $derived.by(() => {
        const q = search.trim().toLowerCase();
        return q ? docs.filter((d) => `${d.title} ${d.file_name}`.toLowerCase().includes(q)) : docs;
    });
    const openIndex = $derived(openId === null ? -1 : filtered.findIndex((d) => d.id === openId));
    const openDoc = $derived(openIndex >= 0 ? filtered[openIndex] : null);

    const kind = (d: Doc) =>
        d.content_type.startsWith("image/") && d.content_type !== "image/svg+xml"
            ? "image"
            : d.content_type === "application/pdf"
              ? "pdf"
              : d.content_type === "text/plain"
                ? "text"
                : "other";
    const hasPreview = (d: Doc) => kind(d) !== "other";
    const ext = (d: Doc) => (d.file_name.split(".").pop() || "").toUpperCase().slice(0, 5);
    const icon = (d: Doc) =>
        ({ image: "image", pdf: "picture_as_pdf", text: "description", other: "draft" })[kind(d)];

    function formatSize(n: number) {
        if (n < 1024) return `${n} o`;
        if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
        return `${(n / 1024 / 1024).toFixed(1)} Mo`;
    }
    const formatDate = (s: string) =>
        new Date(s).toLocaleDateString("fr-BE", { day: "2-digit", month: "short", year: "numeric" });

    async function readError(res: Response, fallback: string) {
        try {
            return (await res.json()).error || fallback;
        } catch {
            return fallback;
        }
    }

    async function load() {
        isLoading = true;
        try {
            const res = await apiFetch("/api/documents");
            if (res.ok) docs = await res.json();
            else error = await readError(res, "Impossible de charger les documents.");
        } catch {
            error = "Erreur réseau.";
        } finally {
            isLoading = false;
        }
    }

    async function ensureBlob(d: Doc) {
        if (blobUrls[d.id] || pending.has(d.id)) return;
        pending.add(d.id);
        try {
            const res = await apiFetch(`/api/documents/${d.id}/file`);
            if (!res.ok) return;
            const blob = await res.blob();
            blobUrls[d.id] = URL.createObjectURL(new Blob([blob], { type: d.content_type }));
        } finally {
            pending.delete(d.id);
        }
    }

    $effect(() => {
        for (const d of filtered) if (hasPreview(d)) ensureBlob(d);
    });

    onMount(load);
    onDestroy(() => Object.values(blobUrls).forEach((u) => URL.revokeObjectURL(u)));

    // ---------- Envoi ----------
    function addFiles(list: FileList | null) {
        if (!list) return;
        const incoming = Array.from(list);
        const tooBig = incoming.filter((f) => f.size > MAX_BYTES);
        if (tooBig.length) error = `Trop volumineux (25 Mo max) : ${tooBig.map((f) => f.name).join(", ")}`;
        files = [...files, ...incoming.filter((f) => f.size <= MAX_BYTES)].slice(0, MAX_FILES);
        if (fileInput) fileInput.value = "";
    }

    function onDrop(e: DragEvent) {
        e.preventDefault();
        isDragging = false;
        addFiles(e.dataTransfer?.files ?? null);
    }

    async function upload() {
        if (!files.length) return;
        isUploading = true;
        error = "";
        try {
            const form = new FormData();
            files.forEach((f) => form.append("files", f));
            if (files.length === 1 && uploadTitle.trim()) form.append("title", uploadTitle.trim());
            const res = await apiFetch("/api/documents", { method: "POST", body: form });
            const body = await res.json().catch(() => ({}));
            const created: Doc[] = Array.isArray(body) ? body : body.created || [];
            docs = [...created, ...docs];
            if (res.ok) {
                notice = `${created.length} document(s) ajouté(s).`;
                files = [];
                uploadTitle = "";
            } else {
                error = body.error || "Envoi impossible.";
                files = files.filter((f) => !created.some((d) => d.file_name === f.name));
            }
        } catch {
            error = "Erreur réseau pendant l'envoi.";
        } finally {
            isUploading = false;
        }
    }

    // ---------- Agrandissement ----------
    function openDocument(d: Doc) {
        openId = d.id;
        editingTitle = d.title;
        ensureBlob(d);
    }

    function step(delta: number) {
        if (openIndex < 0 || !filtered.length) return;
        openDocument(filtered[(openIndex + delta + filtered.length) % filtered.length]);
    }

    function onKeydown(e: KeyboardEvent) {
        if (openId === null || (e.target as HTMLElement)?.tagName === "INPUT") return;
        if (e.key === "Escape") openId = null;
        else if (e.key === "ArrowRight") step(1);
        else if (e.key === "ArrowLeft") step(-1);
    }

    async function rename() {
        const d = openDoc;
        const title = editingTitle.trim();
        if (!d || !title || title === d.title) {
            if (d) editingTitle = d.title;
            return;
        }
        const res = await apiFetch(`/api/documents/${d.id}`, { method: "PATCH", body: JSON.stringify({ title }) });
        if (res.ok) {
            const updated: Doc = await res.json();
            docs = docs.map((x) => (x.id === d.id ? updated : x));
        } else {
            error = await readError(res, "Renommage impossible.");
            editingTitle = d.title;
        }
    }

    async function download(d: Doc) {
        await ensureBlob(d);
        const url = blobUrls[d.id];
        if (!url) {
            error = "Téléchargement impossible.";
            return;
        }
        const a = document.createElement("a");
        a.href = url;
        a.download = d.file_name;
        a.click();
    }

    async function remove(d: Doc) {
        if (!confirm(`Supprimer définitivement « ${d.title} » ?`)) return;
        isDeleting = true;
        try {
            const res = await apiFetch(`/api/documents/${d.id}`, { method: "DELETE" });
            if (!res.ok) {
                error = await readError(res, "Suppression impossible.");
                return;
            }
            docs = docs.filter((x) => x.id !== d.id);
            if (blobUrls[d.id]) {
                URL.revokeObjectURL(blobUrls[d.id]);
                delete blobUrls[d.id];
            }
            if (openId === d.id) openId = null;
        } finally {
            isDeleting = false;
        }
    }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="space-y-4 font-mono">
    <div class="retro-card-blue p-5">
        <span class="retro-badge bg-black text-white text-[10px] font-black uppercase">DOCUMENTS</span>
        <h1 class="text-2xl sm:text-3xl font-black uppercase tracking-tight text-black mt-1">Documents</h1>
        <p class="text-xs text-black/80 mt-1">{docs.length} document(s). Fichiers privés, visibles uniquement depuis le portail.</p>
    </div>

    {#if error}
        <div class="p-3 border-2 border-black bg-[#FFC2D1] text-xs font-bold flex justify-between gap-3">
            <span>{error}</span>
            <button onclick={() => (error = "")}>✕</button>
        </div>
    {/if}
    {#if notice}
        <div class="p-3 border-2 border-black bg-[#99E7DC] text-xs font-bold flex justify-between gap-3">
            <span>{notice}</span>
            <button onclick={() => (notice = "")}>✕</button>
        </div>
    {/if}

    <!-- Envoi -->
    <div class="retro-card p-4 space-y-3">
        <h2 class="text-sm font-black uppercase flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">upload_file</span> Ajouter des documents
        </h2>
        <button
            type="button"
            class="w-full border-2 border-dashed border-black p-6 text-center text-xs font-bold uppercase transition-colors {isDragging ? 'bg-[#FFF394]' : 'bg-[#F6F4EE] hover:bg-[#FFF8D6]'}"
            onclick={() => fileInput.click()}
            ondragover={(e) => {
                e.preventDefault();
                isDragging = true;
            }}
            ondragleave={() => (isDragging = false)}
            ondrop={onDrop}
        >
            <span class="material-symbols-outlined text-[32px] block mb-1">cloud_upload</span>
            Glissez vos fichiers ici ou cliquez pour choisir
            <span class="block text-[10px] font-normal normal-case text-black/60 mt-1">PDF, images, documents… {MAX_FILES} fichiers et 25 Mo max par fichier</span>
        </button>
        <input bind:this={fileInput} type="file" multiple class="hidden" onchange={(e) => addFiles(e.currentTarget.files)} />

        {#if files.length}
            <ul class="space-y-1">
                {#each files as f, i (f.name + i)}
                    <li class="flex items-center justify-between gap-2 border-2 border-black bg-white px-2 py-1 text-xs">
                        <span class="truncate">{f.name}</span>
                        <span class="flex items-center gap-2 shrink-0">
                            <span class="text-black/60">{formatSize(f.size)}</span>
                            <button class="font-bold" title="Retirer" onclick={() => (files = files.filter((_, j) => j !== i))}>✕</button>
                        </span>
                    </li>
                {/each}
            </ul>
            <div class="flex flex-wrap items-end gap-3">
                {#if files.length === 1}
                    <label class="flex-1 min-w-56 text-[10px] font-bold uppercase">Titre (facultatif)
                        <input class="retro-input text-xs w-full" bind:value={uploadTitle} placeholder={files[0].name.replace(/\.[^.]+$/, "")} />
                    </label>
                {/if}
                <button class="retro-btn-primary text-xs py-2 px-4 font-black flex items-center gap-1.5" disabled={isUploading} onclick={upload}>
                    <span class="material-symbols-outlined text-[16px]">upload</span>
                    {isUploading ? "Envoi en cours..." : `Téléverser (${files.length})`}
                </button>
            </div>
        {/if}
    </div>

    <!-- Cartes -->
    <div class="retro-card p-4 space-y-3">
        <div class="relative">
            <span class="material-symbols-outlined text-[16px] absolute left-2 top-1/2 -translate-y-1/2 text-black/50">search</span>
            <input class="retro-input text-xs w-full !pl-8" bind:value={search} placeholder="Rechercher un document..." />
        </div>

        {#if isLoading}
            <p class="text-xs font-bold uppercase">Chargement...</p>
        {:else if filtered.length === 0}
            <p class="text-xs font-bold uppercase text-black/60">{docs.length ? "Aucun document ne correspond." : "Aucun document pour le moment."}</p>
        {:else}
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {#each filtered as d (d.id)}
                    <div class="group flex flex-col border-2 border-black bg-white shadow-[4px_4px_0px_0px_#000] transition-transform hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#000]">
                        <button class="relative aspect-[4/3] border-b-2 border-black bg-[#F6F4EE] overflow-hidden cursor-zoom-in" title="Agrandir" onclick={() => openDocument(d)}>
                            {#if kind(d) === "image" && blobUrls[d.id]}
                                <img src={blobUrls[d.id]} alt={d.title} class="h-full w-full object-cover" />
                            {:else if (kind(d) === "pdf" || kind(d) === "text") && blobUrls[d.id]}
                                <iframe src={kind(d) === "pdf" ? `${blobUrls[d.id]}#toolbar=0&navpanes=0&view=FitH` : blobUrls[d.id]} title={d.title} class="pointer-events-none h-full w-full bg-white" tabindex="-1" loading="lazy"></iframe>
                            {:else}
                                <span class="absolute inset-0 grid place-items-center">
                                    <span class="text-center">
                                        <span class="material-symbols-outlined text-[48px] block">{icon(d)}</span>
                                        <span class="text-[10px] font-black">{hasPreview(d) ? "Chargement..." : ext(d)}</span>
                                    </span>
                                </span>
                            {/if}
                            <span class="absolute top-2 right-2 retro-badge bg-white text-[9px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                <span class="material-symbols-outlined text-[12px]">open_in_full</span> Agrandir
                            </span>
                        </button>
                        <div class="p-3 flex items-start justify-between gap-2">
                            <div class="min-w-0">
                                <h3 class="text-xs font-black uppercase truncate" title={d.title}>{d.title}</h3>
                                <p class="text-[10px] text-black/60 mt-0.5">{ext(d) || "FICHIER"} · {formatSize(d.size)} · {formatDate(d.created_at)}</p>
                            </div>
                            <div class="flex gap-1 shrink-0">
                                <button class="material-symbols-outlined text-[18px]" title="Télécharger" onclick={() => download(d)}>download</button>
                                <button class="material-symbols-outlined text-[18px] text-red-700" title="Supprimer" disabled={isDeleting} onclick={() => remove(d)}>delete</button>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    {#if openDoc}
        <div class="fixed inset-0 z-[10000] bg-black/70 flex items-center justify-center p-2 sm:p-6" role="presentation" onclick={() => (openId = null)}>
            <div
                class="bg-white border-3 border-black shadow-[8px_8px_0px_0px_#000] w-full max-w-6xl h-full max-h-[92vh] flex flex-col"
                role="dialog"
                aria-modal="true"
                aria-label={openDoc.title}
                tabindex="-1"
                onclick={(e) => e.stopPropagation()}
                onkeydown={() => {}}
            >
                <div class="bg-[#FFE600] border-b-2 border-black px-3 py-2 flex flex-wrap items-center gap-2">
                    <input
                        class="retro-input text-xs font-black uppercase flex-1 min-w-40"
                        bind:value={editingTitle}
                        onchange={rename}
                        onkeydown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                        title="Renommer"
                    />
                    <span class="text-[10px] font-bold">{openIndex + 1} / {filtered.length}</span>
                    <button class="retro-btn bg-white text-xs px-2 py-1" title="Précédent (←)" onclick={() => step(-1)}>
                        <span class="material-symbols-outlined text-[16px]">chevron_left</span>
                    </button>
                    <button class="retro-btn bg-white text-xs px-2 py-1" title="Suivant (→)" onclick={() => step(1)}>
                        <span class="material-symbols-outlined text-[16px]">chevron_right</span>
                    </button>
                    <button class="retro-btn bg-white text-xs px-2 py-1 flex items-center gap-1" onclick={() => openDoc && download(openDoc)}>
                        <span class="material-symbols-outlined text-[16px]">download</span> Télécharger
                    </button>
                    <button class="retro-btn-error text-xs px-2 py-1" title="Supprimer" disabled={isDeleting} onclick={() => openDoc && remove(openDoc)}>
                        <span class="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                    <button onclick={() => (openId = null)} class="w-7 h-7 border-2 border-black bg-white text-xs font-bold" title="Fermer (Échap)">✕</button>
                </div>
                <div class="flex-1 min-h-0 bg-[#F6F4EE] grid place-items-center overflow-auto">
                    {#if !hasPreview(openDoc)}
                        <div class="text-center p-6 space-y-3">
                            <span class="material-symbols-outlined text-[64px] block">{icon(openDoc)}</span>
                            <p class="text-xs font-bold">{openDoc.file_name}</p>
                            <p class="text-[11px] text-black/60">Aperçu indisponible pour ce type de fichier.</p>
                            <button class="retro-btn-primary text-xs py-2 px-4 font-black" onclick={() => openDoc && download(openDoc)}>Télécharger</button>
                        </div>
                    {:else if !blobUrls[openDoc.id]}
                        <p class="text-xs font-bold uppercase">Chargement...</p>
                    {:else if kind(openDoc) === "image"}
                        <img src={blobUrls[openDoc.id]} alt={openDoc.title} class="max-h-full max-w-full object-contain" />
                    {:else}
                        <iframe src={blobUrls[openDoc.id]} title={openDoc.title} class="h-full w-full bg-white"></iframe>
                    {/if}
                </div>
                <div class="border-t-2 border-black px-3 py-1 text-[10px] text-black/60 flex justify-between gap-2">
                    <span class="truncate">{openDoc.file_name}</span>
                    <span class="shrink-0">{formatSize(openDoc.size)} · ajouté le {formatDate(openDoc.created_at)}</span>
                </div>
            </div>
        </div>
    {/if}
</div>
