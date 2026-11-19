<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import { apiFetch } from "../../../lib/api";

    interface Doc {
        id: number;
        title: string;
        file_name: string;
        download_name?: string;
        content_type: string;
        size: number;
        folder: Folder | "";
        subfolder: Subfolder | "";
        sort_date: string;
        rotation: number;
        created_at: string;
    }
    type Folder = "achats" | "ventes";
    type Subfolder = "marchandise" | "materiel";
    type PurchaseTab = "achats-marchandise" | "achats-materiel";
    type Tab = Folder | PurchaseTab | "all" | "unsorted";

    const FOLDERS: { key: Folder; label: string; icon: string; tint: string }[] = [
        { key: "achats", label: "Achats", icon: "shopping_cart", tint: "bg-[#FFD2A6]" },
        { key: "ventes", label: "Ventes", icon: "sell", tint: "bg-[#99E7DC]" },
    ];
    const SUBFOLDERS: { key: Subfolder; label: string; tint: string }[] = [
        { key: "marchandise", label: "Marchandise", tint: "bg-[#FFE0BD]" },
        { key: "materiel", label: "Matériel", tint: "bg-[#E7D7FF]" },
    ];
    const folderInfo = (f: string) => FOLDERS.find((x) => x.key === f);
    const subfolderInfo = (f: string) => SUBFOLDERS.find((x) => x.key === f);
    const purchaseTab = (f: Subfolder): PurchaseTab =>
        f === "marchandise" ? "achats-marchandise" : "achats-materiel";
    const classementDate = (d: Doc) => d.sort_date || d.created_at.slice(0, 10);
    const hasAutomaticTitle = (d: Doc) => d.folder === "achats" && d.subfolder === "marchandise";
    const sortDocuments = (items: Doc[]) =>
        [...items].sort(
            (a, b) =>
                classementDate(b).localeCompare(classementDate(a)) ||
                b.created_at.localeCompare(a.created_at) ||
                b.id - a.id
        );

    const MAX_FILES = 10;
    const MAX_BYTES = 25 * 1024 * 1024;

    let docs = $state<Doc[]>([]);
    let isLoading = $state(true);
    let error = $state("");
    let notice = $state("");
    let search = $state("");
    let tab = $state<Tab>("achats");
    let uploadFolder = $state<Folder>("achats");
    let uploadSubfolder = $state<Subfolder | "">("");

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

    const counts = $derived({
        all: docs.length,
        achats: docs.filter((d) => d.folder === "achats").length,
        marchandise: docs.filter((d) => d.folder === "achats" && d.subfolder === "marchandise").length,
        materiel: docs.filter((d) => d.folder === "achats" && d.subfolder === "materiel").length,
        ventes: docs.filter((d) => d.folder === "ventes").length,
        unsorted: docs.filter((d) => d.folder !== "achats" && d.folder !== "ventes").length,
    });
    const filtered = $derived.by(() => {
        const q = search.trim().toLowerCase();
        return docs.filter(
            (d) =>
                (tab === "all" ||
                    (tab === "unsorted"
                        ? d.folder !== "achats" && d.folder !== "ventes"
                        : tab === "achats-marchandise"
                          ? d.folder === "achats" && d.subfolder === "marchandise"
                          : tab === "achats-materiel"
                            ? d.folder === "achats" && d.subfolder === "materiel"
                            : d.folder === tab)) &&
                (!q || `${d.title} ${d.file_name}`.toLowerCase().includes(q))
        );
    });
    $effect(() => {
        if (tab === "achats" || tab === "ventes") uploadFolder = tab;
        if (tab === "achats-marchandise" || tab === "achats-materiel") {
            uploadFolder = "achats";
            uploadSubfolder = tab === "achats-marchandise" ? "marchandise" : "materiel";
        }
    });
    $effect(() => {
        if (tab === "unsorted" && counts.unsorted === 0) tab = "achats";
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

    // Lien direct depuis un autre service (ex. Inventaire) : /documents?doc=<id> ouvre ce document.
    const requestedDocId =
        typeof window !== "undefined" ? Number(new URLSearchParams(window.location.search).get("doc")) || null : null;

    $effect(() => {
        if (openId !== null) return;
        const url = new URL(window.location.href);
        if (url.searchParams.has("doc")) {
            url.searchParams.delete("doc");
            history.replaceState(history.state, "", url);
        }
    });

    async function load() {
        isLoading = true;
        try {
            const res = await apiFetch("/api/documents");
            if (res.ok) {
                docs = sortDocuments(await res.json());
                const requested = requestedDocId ? docs.find((d) => d.id === requestedDocId) : null;
                if (requested) {
                    tab =
                        requested.folder === "achats" && (requested.subfolder === "marchandise" || requested.subfolder === "materiel")
                            ? purchaseTab(requested.subfolder)
                            : requested.folder === "achats" || requested.folder === "ventes"
                              ? requested.folder
                              : "unsorted";
                    openDocument(requested);
                } else {
                    if (requestedDocId) error = "Ce document n'existe plus.";
                    if (docs.some((d) => d.folder !== "achats" && d.folder !== "ventes")) tab = "unsorted";
                }
            } else error = await readError(res, "Impossible de charger les documents.");
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
        const selectedSubfolder = uploadSubfolder;
        if (uploadFolder === "achats" && !selectedSubfolder) {
            error = "Choisissez un sous-dossier pour les achats.";
            return;
        }
        isUploading = true;
        error = "";
        try {
            const form = new FormData();
            form.append("folder", uploadFolder);
            if (uploadFolder === "achats" && selectedSubfolder) form.append("subfolder", selectedSubfolder);
            files.forEach((f) => form.append("files", f));
            if (files.length === 1 && !(uploadFolder === "achats" && selectedSubfolder === "marchandise") && uploadTitle.trim()) {
                form.append("title", uploadTitle.trim());
            }
            const res = await apiFetch("/api/documents", { method: "POST", body: form });
            const body = await res.json().catch(() => ({}));
            const created: Doc[] = Array.isArray(body) ? body : body.created || [];
            docs = sortDocuments([...created, ...docs]);
            if (res.ok) {
                notice = `${created.length} document(s) ajouté(s) dans ${folderInfo(uploadFolder)?.label}${uploadFolder === "achats" ? ` · ${subfolderInfo(selectedSubfolder)?.label}` : ""}.`;
                tab = uploadFolder === "achats" && selectedSubfolder ? purchaseTab(selectedSubfolder) : uploadFolder;
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

    async function update(d: Doc, body: Partial<Pick<Doc, "title" | "folder" | "subfolder" | "sort_date" | "rotation">>, fallback: string) {
        const previous = d;
        docs = docs.map((x) => (x.id === d.id ? { ...x, ...body } : x));
        const res = await apiFetch(`/api/documents/${d.id}`, { method: "PATCH", body: JSON.stringify(body) });
        if (res.ok) {
            const updated: Doc = await res.json();
            docs = sortDocuments(docs.map((x) => (x.id === d.id ? updated : x)));
            return true;
        }
        error = await readError(res, fallback);
        docs = docs.map((x) => (x.id === d.id ? previous : x));
        return false;
    }

    async function rename() {
        const d = openDoc;
        const title = editingTitle.trim();
        if (!d || !title || title === d.title) {
            if (d) editingTitle = d.title;
            return;
        }
        if (!(await update(d, { title }, "Renommage impossible."))) editingTitle = d.title;
    }

    function rotate(d: Doc, delta: number) {
        update(d, { rotation: (((d.rotation + delta) % 360) + 360) % 360 }, "Rotation impossible.");
    }

    async function moveTo(d: Doc, folder: Folder, subfolder: Subfolder | "" = "") {
        if (d.folder === folder && d.subfolder === subfolder) return;
        const destinationTab = folder === "achats" && subfolder ? purchaseTab(subfolder) : folder;
        // Tri à la chaîne : si le document quitte l'onglet affiché, la popup passe directement au suivant.
        if (openId === d.id && tab !== "all" && tab !== destinationTab) {
            const i = filtered.findIndex((x) => x.id === d.id);
            const next = filtered[i + 1] ?? filtered[i - 1] ?? null;
            if (next) openDocument(next);
            else openId = null;
        }
        if (await update(d, { folder, subfolder }, "Déplacement impossible.")) {
            if (openDoc?.id === d.id) editingTitle = openDoc.title;
        }
    }

    const quarter = (d: Doc) => d.rotation === 90 || d.rotation === 270;
    let stageW = $state(0);
    let stageH = $state(0);

    async function download(d: Doc) {
        await ensureBlob(d);
        const url = blobUrls[d.id];
        if (!url) {
            error = "Téléchargement impossible.";
            return;
        }
        const a = document.createElement("a");
        a.href = url;
        a.download = d.download_name ?? d.file_name;
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
                <div class="text-[10px] font-bold uppercase">Dossier
                    <div class="flex gap-1 mt-0.5">
                        {#each FOLDERS as f (f.key)}
                            <button
                                type="button"
                                class="retro-btn text-xs py-1.5 px-3 flex items-center gap-1 {uploadFolder === f.key ? f.tint : 'bg-white'}"
                                aria-pressed={uploadFolder === f.key}
                                onclick={() => (uploadFolder = f.key)}
                            >
                                <span class="material-symbols-outlined text-[16px]">{f.icon}</span> {f.label}
                            </button>
                        {/each}
                    </div>
                </div>
                {#if uploadFolder === "achats"}
                    <div class="text-[10px] font-bold uppercase">Sous-dossier
                        <div class="flex gap-1 mt-0.5">
                            {#each SUBFOLDERS as f (f.key)}
                                <button
                                    type="button"
                                    class="retro-btn text-xs py-1.5 px-3 flex items-center gap-1 {uploadSubfolder === f.key ? f.tint : 'bg-white'}"
                                    aria-pressed={uploadSubfolder === f.key}
                                    onclick={() => (uploadSubfolder = f.key)}
                                >
                                    {f.label}
                                </button>
                            {/each}
                        </div>
                        {#if !uploadSubfolder}<span class="block text-[10px] normal-case text-red-700 mt-1">Choisissez une catégorie pour continuer.</span>{/if}
                    </div>
                {/if}
                {#if uploadFolder === "achats" && uploadSubfolder === "marchandise"}
                    <p class="text-[10px] text-black/70">Le titre est généré à partir de la date du badge.</p>
                {:else if files.length === 1}
                    <label class="flex-1 min-w-56 text-[10px] font-bold uppercase">Titre (facultatif)
                        <input class="retro-input text-xs w-full" bind:value={uploadTitle} placeholder={files[0].name.replace(/\.[^.]+$/, "")} />
                    </label>
                {/if}
                <button class="retro-btn-primary text-xs py-2 px-4 font-black flex items-center gap-1.5" disabled={isUploading || (uploadFolder === "achats" && !uploadSubfolder)} onclick={upload}>
                    {#if isUploading}
                        <span class="daisy-loader daisy-loader-xs" aria-hidden="true"></span>
                    {:else}
                        <span class="material-symbols-outlined text-[16px]">upload</span>
                    {/if}
                    {isUploading ? "Envoi en cours..." : `Téléverser (${files.length})`}
                </button>
            </div>
        {/if}
    </div>

    <!-- Cartes -->
    <div class="retro-card p-4 space-y-3">
        <div class="flex flex-wrap gap-2 border-b-2 border-black pb-3" role="tablist">
            {#each FOLDERS as f (f.key)}
                <button
                    role="tab"
                    aria-selected={tab === f.key}
                    class="retro-btn text-xs py-2 px-4 font-black flex items-center gap-1.5 {tab === f.key ? f.tint : 'bg-white'}"
                    onclick={() => (tab = f.key)}
                >
                    <span class="material-symbols-outlined text-[18px]">{tab === f.key ? "folder_open" : "folder"}</span>
                    {f.label} ({counts[f.key]})
                </button>
            {/each}
            {#if counts.unsorted > 0}
                <button
                    role="tab"
                    aria-selected={tab === "unsorted"}
                    class="retro-btn text-xs py-2 px-4 font-black flex items-center gap-1.5 {tab === 'unsorted' ? 'bg-[#FFC2D1]' : 'bg-white'}"
                    onclick={() => (tab = "unsorted")}
                >
                    <span class="material-symbols-outlined text-[18px]">folder_off</span> Non classés ({counts.unsorted})
                </button>
            {/if}
            <button
                role="tab"
                aria-selected={tab === "all"}
                class="retro-btn text-xs py-2 px-4 flex items-center gap-1.5 {tab === 'all' ? 'bg-[#FFF394]' : 'bg-white'}"
                onclick={() => (tab = "all")}
            >
                <span class="material-symbols-outlined text-[18px]">folder_copy</span> Tous ({counts.all})
            </button>
        </div>
        {#if tab === "achats" || tab === "achats-marchandise" || tab === "achats-materiel"}
            <div class="flex flex-wrap gap-2" role="tablist" aria-label="Sous-dossiers des achats">
                {#each SUBFOLDERS as f (f.key)}
                    {@const subTab = purchaseTab(f.key)}
                    <button
                        role="tab"
                        aria-selected={tab === subTab}
                        class="retro-btn text-xs py-1.5 px-3 font-bold flex items-center gap-1 {tab === subTab ? f.tint : 'bg-white'}"
                        onclick={() => (tab = subTab)}
                    >
                        <span class="material-symbols-outlined text-[16px]">folder</span>
                        {f.label} ({counts[f.key]})
                    </button>
                {/each}
            </div>
        {/if}
        <div class="relative">
            <span class="material-symbols-outlined text-[16px] absolute left-2 top-1/2 -translate-y-1/2 text-black/50">search</span>
            <input class="retro-input text-xs w-full !pl-8" bind:value={search} placeholder="Rechercher un document..." />
        </div>

        {#if isLoading}
            <div role="status" class="daisy-loading-state gap-2 py-6"><span class="daisy-loader" aria-hidden="true"></span><p class="text-xs font-bold uppercase">Chargement des documents...</p></div>
        {:else if filtered.length === 0}
            <p class="text-xs font-bold uppercase text-black/60">{search.trim() ? "Aucun document ne correspond." : "Aucun document dans ce dossier."}</p>
        {:else}
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {#each filtered as d (d.id)}
                    <div class="group relative flex flex-col border-2 border-black bg-white shadow-[4px_4px_0px_0px_#000] transition-transform hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#000]">
                        <button class="relative aspect-[4/3] border-b-2 border-black bg-[#F6F4EE] overflow-hidden cursor-zoom-in" title="Agrandir" onclick={() => openDocument(d)}>
                            {#if hasPreview(d) && blobUrls[d.id]}
                                <!-- Boîte 4/3 : à 90°/270°, l'élément prend 75 % × 133 % pour couvrir la carte une fois tourné. -->
                                <div
                                    class="absolute left-1/2 top-1/2 transition-transform"
                                    style={`width: ${quarter(d) ? "75%" : "100%"}; height: ${quarter(d) ? "133.334%" : "100%"}; transform: translate(-50%, -50%) rotate(${d.rotation}deg);`}
                                >
                                    {#if kind(d) === "image"}
                                        <img src={blobUrls[d.id]} alt={d.title} class="h-full w-full object-cover" />
                                    {:else}
                                        <iframe src={kind(d) === "pdf" ? `${blobUrls[d.id]}#toolbar=0&navpanes=0&view=FitH` : blobUrls[d.id]} title={d.title} class="pointer-events-none h-full w-full bg-white" tabindex="-1" loading="lazy"></iframe>
                                    {/if}
                                </div>
                            {:else}
                                <span class="absolute inset-0 grid place-items-center">
                                    {#if hasPreview(d)}
                                        <span class="daisy-loader daisy-loader-md" role="status" aria-label="Chargement de l'aperçu"></span>
                                    {:else}
                                        <span class="text-center">
                                            <span class="material-symbols-outlined text-[48px] block">{icon(d)}</span>
                                            <span class="text-[10px] font-black">{ext(d)}</span>
                                        </span>
                                    {/if}
                                </span>
                            {/if}
                            <span class="absolute bottom-2 right-2 retro-badge bg-white text-[9px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                <span class="material-symbols-outlined text-[12px]">open_in_full</span> Agrandir
                            </span>
                        </button>
                        <label class="absolute top-2 right-2 z-10 flex items-center gap-1 border-2 border-black bg-[#E7D7FF] px-2 py-1 text-[10px] font-black shadow-[2px_2px_0px_0px_#000]" title="Date de classement utilisée pour trier les documents">
                            <span class="material-symbols-outlined text-[14px]" aria-hidden="true">event</span>
                            <input
                                type="date"
                                class="w-[110px] bg-transparent text-[10px] font-bold focus:outline-none"
                                aria-label={`Date de classement de ${d.title}`}
                                value={classementDate(d)}
                                onchange={(e) => update(d, { sort_date: e.currentTarget.value }, "Modification de date impossible.")}
                            />
                        </label>
                        <div class="p-3 flex items-start justify-between gap-2">
                            <div class="min-w-0">
                                <h3 class="text-xs font-black uppercase truncate" title={d.title}>{d.title}</h3>
                                <p class="text-[10px] text-black/60 mt-0.5">{ext(d) || "FICHIER"} · {formatSize(d.size)} · {formatDate(d.created_at)}</p>
                            </div>
                            <div class="flex gap-1 shrink-0">
                                {#if hasPreview(d)}
                                    <button class="material-symbols-outlined text-[18px]" title="Tourner de 90° vers la droite" onclick={() => rotate(d, 90)}>rotate_right</button>
                                {/if}
                                <button class="material-symbols-outlined text-[18px]" title="Télécharger" onclick={() => download(d)}>download</button>
                                <button class="material-symbols-outlined text-[18px] text-red-700" title="Supprimer" disabled={isDeleting} onclick={() => remove(d)}>delete</button>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 border-t-2 border-black" role="group" aria-label={`Dossier de ${d.title}`}>
                            <button
                                class="text-[11px] font-black uppercase py-1.5 flex items-center justify-center gap-1 transition-colors {d.folder === 'achats' && !d.subfolder ? 'bg-[#FFD2A6]' : 'bg-white hover:bg-[#FFF394]'}"
                                aria-pressed={d.folder === "achats" && !d.subfolder}
                                title="Classer dans Achats sans sous-dossier"
                                onclick={() => moveTo(d, "achats")}
                            >
                                <span class="material-symbols-outlined text-[15px]">{d.folder === "achats" && !d.subfolder ? "check" : "shopping_cart"}</span> Achats
                            </button>
                            {#each SUBFOLDERS as f (f.key)}
                                <button
                                    class="text-[11px] font-black uppercase py-1.5 flex items-center justify-center gap-1 transition-colors {d.folder === 'achats' && d.subfolder === f.key ? f.tint : 'bg-white hover:bg-[#FFF394]'}"
                                    aria-pressed={d.folder === "achats" && d.subfolder === f.key}
                                    title={`Classer dans Achats / ${f.label}`}
                                    onclick={() => moveTo(d, "achats", f.key)}
                                >
                                    <span class="material-symbols-outlined text-[15px]">{d.folder === "achats" && d.subfolder === f.key ? "check" : "folder"}</span> {f.label}
                                </button>
                            {/each}
                            <button
                                class="text-[11px] font-black uppercase py-1.5 flex items-center justify-center gap-1 transition-colors {d.folder === 'ventes' ? 'bg-[#99E7DC]' : 'bg-white hover:bg-[#FFF394]'}"
                                aria-pressed={d.folder === "ventes"}
                                title="Classer dans Ventes"
                                onclick={() => moveTo(d, "ventes")}
                            >
                                <span class="material-symbols-outlined text-[15px]">{d.folder === "ventes" ? "check" : "sell"}</span> Ventes
                            </button>
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
                    {#if hasAutomaticTitle(openDoc)}
                        <span class="text-xs font-black flex-1 min-w-40" title="Titre automatique basé sur la date de classement">{openDoc.title}</span>
                    {:else}
                        <input
                            class="retro-input text-xs font-black uppercase flex-1 min-w-40"
                            bind:value={editingTitle}
                            onchange={rename}
                            onkeydown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                            title="Renommer"
                        />
                    {/if}
                    <div class="flex flex-wrap gap-1" role="group" aria-label="Dossier">
                        <button
                            class="retro-btn text-xs px-2 py-1 flex items-center gap-1 {openDoc.folder === 'achats' && !openDoc.subfolder ? 'bg-[#FFD2A6]' : 'bg-white'}"
                            aria-pressed={openDoc.folder === "achats" && !openDoc.subfolder}
                            title="Classer dans Achats sans sous-dossier"
                            onclick={() => openDoc && moveTo(openDoc, "achats")}
                        >
                            <span class="material-symbols-outlined text-[16px]">shopping_cart</span> Achats
                        </button>
                        {#each SUBFOLDERS as f (f.key)}
                            <button
                                class="retro-btn text-xs px-2 py-1 flex items-center gap-1 {openDoc.folder === 'achats' && openDoc.subfolder === f.key ? f.tint : 'bg-white'}"
                                aria-pressed={openDoc.folder === "achats" && openDoc.subfolder === f.key}
                                title={`Classer dans Achats / ${f.label}`}
                                onclick={() => openDoc && moveTo(openDoc, "achats", f.key)}
                            >
                                <span class="material-symbols-outlined text-[16px]">folder</span> {f.label}
                            </button>
                        {/each}
                        <button
                            class="retro-btn text-xs px-2 py-1 flex items-center gap-1 {openDoc.folder === 'ventes' ? 'bg-[#99E7DC]' : 'bg-white'}"
                            aria-pressed={openDoc.folder === "ventes"}
                            title="Classer dans Ventes"
                            onclick={() => openDoc && moveTo(openDoc, "ventes")}
                        >
                            <span class="material-symbols-outlined text-[16px]">sell</span> Ventes
                        </button>
                    </div>
                    {#if hasPreview(openDoc)}
                        <button class="retro-btn bg-white text-xs px-2 py-1" title="Tourner à gauche" onclick={() => openDoc && rotate(openDoc, -90)}>
                            <span class="material-symbols-outlined text-[16px]">rotate_left</span>
                        </button>
                        <button class="retro-btn bg-white text-xs px-2 py-1" title="Tourner à droite" onclick={() => openDoc && rotate(openDoc, 90)}>
                            <span class="material-symbols-outlined text-[16px]">rotate_right</span>
                        </button>
                    {/if}
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
                <div class="relative flex-1 min-h-0 bg-[#F6F4EE] grid place-items-center overflow-hidden" bind:clientWidth={stageW} bind:clientHeight={stageH}>
                    {#if !hasPreview(openDoc)}
                        <div class="text-center p-6 space-y-3">
                            <span class="material-symbols-outlined text-[64px] block">{icon(openDoc)}</span>
                            <p class="text-xs font-bold">{openDoc.file_name}</p>
                            <p class="text-[11px] text-black/60">Aperçu indisponible pour ce type de fichier.</p>
                            <button class="retro-btn-primary text-xs py-2 px-4 font-black" onclick={() => openDoc && download(openDoc)}>Télécharger</button>
                        </div>
                    {:else if !blobUrls[openDoc.id]}
                        <div role="status" class="daisy-loading-state gap-2 py-6"><span class="daisy-loader" aria-hidden="true"></span><p class="text-xs font-bold uppercase">Chargement du document...</p></div>
                    {:else}
                        <!-- À 90°/270°, largeur et hauteur sont inversées pour remplir la zone une fois tourné. -->
                        <div
                            class="absolute left-1/2 top-1/2 transition-transform"
                            style={`width: ${quarter(openDoc) ? stageH : stageW}px; height: ${quarter(openDoc) ? stageW : stageH}px; transform: translate(-50%, -50%) rotate(${openDoc.rotation}deg);`}
                        >
                            {#if kind(openDoc) === "image"}
                                <img src={blobUrls[openDoc.id]} alt={openDoc.title} class="h-full w-full object-contain" />
                            {:else}
                                <iframe src={blobUrls[openDoc.id]} title={openDoc.title} class="h-full w-full bg-white"></iframe>
                            {/if}
                        </div>
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
