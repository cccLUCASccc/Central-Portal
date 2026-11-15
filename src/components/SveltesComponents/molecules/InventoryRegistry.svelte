<script lang="ts">
    import { onMount } from "svelte";
    import writeExcelFile from "write-excel-file/browser";
    import { apiFetch } from "../../../lib/api";
    import { compressImageFile } from "../../../lib/imageCompressor";
    import { isPublished, siteItemUrl } from "../../../lib/siteLink";
    import PaginationBar from "../atoms/Pagination.svelte";

    interface LinkedAntiquite {
        id: number;
        name: string;
        status: number;
        approval_status?: string;
    }
    interface Entry {
        nom: string;
        categorie: string;
        date_acquisition: string | null;
        prix_achat: number | null;
        prix_vente: number | null;
        vendu: boolean | null;
        photo: boolean | null;
        publie: boolean | null;
        provenance: string | null;
    }
    interface Item extends Entry {
        id: number;
        code: string;
        antiquite_id: number | null;
        antiquite?: LinkedAntiquite | null;
    }
    type BoolField = "vendu" | "photo" | "publie";
    type ColumnKey = keyof Entry | "code" | "lien_site";

    const COLUMNS: { key: ColumnKey; label: string; width: number }[] = [
        { key: "code", label: "Code", width: 10 },
        { key: "nom", label: "Nom", width: 34 },
        { key: "categorie", label: "Catégorie", width: 18 },
        { key: "date_acquisition", label: "Date d'acquisition", width: 16 },
        { key: "prix_achat", label: "Prix d'achat (€)", width: 14 },
        { key: "prix_vente", label: "Prix de vente (€)", width: 14 },
        { key: "vendu", label: "Vendu", width: 8 },
        { key: "photo", label: "Photo", width: 8 },
        { key: "publie", label: "Publié", width: 8 },
        { key: "provenance", label: "Provenance", width: 22 },
        { key: "lien_site", label: "Lien site", width: 50 },
    ];
    const BOOL_FIELDS: { key: BoolField; label: string }[] = [
        { key: "vendu", label: "Vendu" },
        { key: "photo", label: "Photo" },
        { key: "publie", label: "Publié" },
    ];
    const PAGE_SIZE = 50;

    let items = $state<Item[]>([]);
    let isLoading = $state(true);
    let error = $state("");
    let notice = $state("");
    let search = $state("");
    let page = $state(1);
    let selected = $state<Set<number>>(new Set());

    // Import Gemini
    let files = $state<File[]>([]);
    let fileInput: HTMLInputElement;
    let isExtracting = $state(false);
    let isSaving = $state(false);
    let drafts = $state<Entry[]>([]);

    // Ajout manuel
    let showManual = $state(false);
    let manual = $state<Entry>(emptyEntry());

    // Liaison au site
    let linkingItem = $state<Item | null>(null);
    let siteSearch = $state("");
    let siteResults = $state<LinkedAntiquite[]>([]);
    let siteTimer: ReturnType<typeof setTimeout>;

    // Export Excel
    let showExport = $state(false);
    let exportColumns = $state<Set<ColumnKey>>(new Set(COLUMNS.map((c) => c.key)));
    let exportScope = $state<"selection" | "filtered" | "all">("filtered");
    let exportFileName = $state(`inventaire-${new Date().toISOString().slice(0, 10)}`);
    let isExporting = $state(false);

    function emptyEntry(): Entry {
        return {
            nom: "",
            categorie: "",
            date_acquisition: null,
            prix_achat: null,
            prix_vente: null,
            vendu: null,
            photo: null,
            publie: null,
            provenance: null,
        };
    }

    const byDate = (a: Item, b: Item) => {
        const da = a.date_acquisition, db = b.date_acquisition;
        if (da !== db) {
            if (!da) return 1;
            if (!db) return -1;
            return da < db ? -1 : 1;
        }
        return a.code.localeCompare(b.code);
    };

    const sorted = $derived([...items].sort(byDate));
    const filtered = $derived.by(() => {
        const q = search.trim().toUpperCase().replace(/\s+/g, "");
        if (!q) return sorted;
        const exact = /^\d+$/.test(q) ? `D${q.padStart(4, "0")}` : q;
        const matches = sorted.filter((i) => i.code.toUpperCase().includes(q));
        // Correspondance exacte (ex : "12" → D0012) en premier.
        return [...matches.filter((i) => i.code === exact), ...matches.filter((i) => i.code !== exact)];
    });
    const totalPages = $derived(Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
    const pageItems = $derived(filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
    const allFilteredSelected = $derived(filtered.length > 0 && filtered.every((i) => selected.has(i.id)));
    const stats = $derived({
        total: items.length,
        vendus: items.filter((i) => i.vendu).length,
        achats: items.reduce((s, i) => s + (i.prix_achat ?? 0), 0),
        ventes: items.reduce((s, i) => s + (i.vendu ? i.prix_vente ?? 0 : 0), 0),
    });

    $effect(() => {
        search;
        page = 1;
    });
    $effect(() => {
        if (page > totalPages) page = totalPages;
    });

    const euro = (n: number) => n.toLocaleString("fr-BE", { style: "currency", currency: "EUR" });

    async function readError(res: Response, fallback: string) {
        try {
            const body = await res.json();
            return body.error || fallback;
        } catch {
            return fallback;
        }
    }

    async function load() {
        isLoading = true;
        try {
            const res = await apiFetch("/api/inventaire");
            if (res.ok) items = await res.json();
            else error = await readError(res, "Impossible de charger l'inventaire.");
        } catch {
            error = "Erreur réseau.";
        } finally {
            isLoading = false;
        }
    }

    onMount(load);

    // ---------- Import via Gemini ----------
    function onFilesChosen(e: Event) {
        files = Array.from((e.currentTarget as HTMLInputElement).files ?? []);
    }

    async function extract() {
        if (files.length === 0) return;
        isExtracting = true;
        error = "";
        try {
            const form = new FormData();
            for (const f of files) {
                // Résolution élevée pour garder l'écriture manuscrite lisible.
                const img = await compressImageFile(f, { maxWidth: 2400, maxHeight: 2400, quality: 0.9, mimeType: "image/jpeg" });
                form.append("images", img, img.name);
            }
            const res = await apiFetch("/api/inventaire/extract", { method: "POST", body: form });
            if (!res.ok) {
                error = await readError(res, "L'analyse de l'image a échoué.");
                return;
            }
            const body = await res.json();
            const extracted: Entry[] = (body.items ?? []).map((e: Partial<Entry>) => ({ ...emptyEntry(), ...e }));
            if (extracted.length === 0) {
                error = "Aucun objet n'a été détecté sur l'image.";
                return;
            }
            drafts = [...drafts, ...extracted];
            files = [];
            if (fileInput) fileInput.value = "";
        } catch {
            error = "Erreur réseau pendant l'analyse.";
        } finally {
            isExtracting = false;
        }
    }

    async function saveEntries(entries: Entry[]) {
        const res = await apiFetch("/api/inventaire", {
            method: "POST",
            body: JSON.stringify({ items: entries }),
        });
        if (!res.ok) {
            error = await readError(res, "Enregistrement impossible.");
            return null;
        }
        const created: Item[] = await res.json();
        items = [...items, ...created];
        return created;
    }

    async function saveDrafts() {
        const valid = drafts.filter((d) => d.nom.trim());
        if (valid.length === 0) {
            error = "Chaque objet doit avoir un nom.";
            return;
        }
        isSaving = true;
        try {
            const created = await saveEntries(valid);
            if (created) {
                drafts = [];
                notice = `${created.length} objet(s) ajouté(s) : ${created[0].code} → ${created[created.length - 1].code}`;
            }
        } finally {
            isSaving = false;
        }
    }

    async function addManual(e: Event) {
        e.preventDefault();
        if (!manual.nom.trim()) return;
        const created = await saveEntries([manual]);
        if (created) {
            notice = `Objet ajouté avec le code ${created[0].code}`;
            manual = emptyEntry();
            showManual = false;
        }
    }

    // ---------- Édition ----------
    async function patch(item: Item, body: Record<string, unknown>) {
        const res = await apiFetch(`/api/inventaire/${item.id}`, {
            method: "PATCH",
            body: JSON.stringify(body),
        });
        if (res.ok) {
            const updated: Item = await res.json();
            items = items.map((i) => (i.id === item.id ? updated : i));
        } else {
            error = await readError(res, "Mise à jour impossible.");
            items = [...items]; // Réaffiche la valeur enregistrée.
        }
    }

    function editText(item: Item, field: "nom" | "categorie" | "provenance", e: Event) {
        const input = e.currentTarget as HTMLInputElement;
        const value = input.value.trim();
        if (field === "nom" && !value) {
            input.value = item.nom;
            return;
        }
        if (value !== (item[field] ?? "")) patch(item, { [field]: field === "provenance" && !value ? null : value });
    }

    function editNumber(item: Item, field: "prix_achat" | "prix_vente", e: Event) {
        const raw = (e.currentTarget as HTMLInputElement).value;
        const value = raw === "" ? null : Number(raw);
        if (value !== item[field]) patch(item, { [field]: value });
    }

    function editDate(item: Item, e: Event) {
        const value = (e.currentTarget as HTMLInputElement).value || null;
        if (value !== item.date_acquisition) patch(item, { date_acquisition: value });
    }

    const boolToSelect = (v: boolean | null) => (v === null || v === undefined ? "" : String(v));
    const selectToBool = (v: string) => (v === "" ? null : v === "true");

    function editBool(item: Item, field: BoolField, e: Event) {
        patch(item, { [field]: selectToBool((e.currentTarget as HTMLSelectElement).value) });
    }

    async function remove(item: Item) {
        if (!confirm(`Supprimer ${item.code} « ${item.nom} » ?`)) return;
        const res = await apiFetch(`/api/inventaire/${item.id}`, { method: "DELETE" });
        if (res.ok) {
            items = items.filter((i) => i.id !== item.id);
            selected.delete(item.id);
            selected = new Set(selected);
        } else {
            error = "Suppression impossible.";
        }
    }

    // ---------- Sélection ----------
    function toggle(id: number) {
        const next = new Set(selected);
        next.has(id) ? next.delete(id) : next.add(id);
        selected = next;
    }

    function toggleAllFiltered() {
        const next = new Set(selected);
        if (allFilteredSelected) filtered.forEach((i) => next.delete(i.id));
        else filtered.forEach((i) => next.add(i.id));
        selected = next;
    }

    // ---------- Liaison au site ----------
    function openLink(item: Item) {
        linkingItem = item;
        siteSearch = item.nom;
        searchSite();
    }

    function onSiteSearch() {
        clearTimeout(siteTimer);
        siteTimer = setTimeout(searchSite, 300);
    }

    async function searchSite() {
        const params = new URLSearchParams({ limit: "15" });
        if (siteSearch.trim()) params.set("q", siteSearch.trim());
        const res = await apiFetch(`/api/antiquites?${params.toString()}`);
        if (res.ok) {
            const r = await res.json();
            siteResults = Array.isArray(r) ? r : r.data || [];
        }
    }

    async function linkTo(a: LinkedAntiquite) {
        if (!linkingItem) return;
        await patch(linkingItem, { antiquite_id: a.id, publie: isPublished(a) ? true : linkingItem.publie });
        linkingItem = null;
    }

    // ---------- Export Excel ----------
    function toggleColumn(key: ColumnKey) {
        const next = new Set(exportColumns);
        next.has(key) ? next.delete(key) : next.add(key);
        exportColumns = next;
    }

    function openExport() {
        exportScope = selected.size > 0 ? "selection" : "filtered";
        showExport = true;
    }

    const exportRows = $derived(
        exportScope === "selection"
            ? sorted.filter((i) => selected.has(i.id))
            : exportScope === "filtered"
              ? filtered
              : sorted,
    );

    function cellFor(item: Item, key: ColumnKey) {
        switch (key) {
            case "date_acquisition": {
                if (!item.date_acquisition) return null;
                const [y, m, d] = item.date_acquisition.split("-").map(Number);
                return { value: new Date(Date.UTC(y, m - 1, d)), format: "dd/mm/yyyy" };
            }
            case "prix_achat":
            case "prix_vente":
                return item[key] === null ? null : { value: item[key] as number, format: "#,##0.00" };
            case "vendu":
            case "photo":
            case "publie":
                return item[key] === null ? null : item[key] ? "Oui" : "Non";
            case "lien_site":
                return item.antiquite ? siteItemUrl(item.antiquite) : null;
            case "provenance":
                return item.provenance ?? null;
            default:
                return (item[key] as string) || null;
        }
    }

    async function exportExcel() {
        const cols = COLUMNS.filter((c) => exportColumns.has(c.key));
        if (cols.length === 0 || exportRows.length === 0) return;
        isExporting = true;
        try {
            const header = cols.map((c) => ({ value: c.label, fontWeight: "bold" as const, backgroundColor: "#FFE600" }));
            const rows = exportRows.map((item) => cols.map((c) => cellFor(item, c.key)));
            const name = (exportFileName.trim() || "inventaire").replace(/\.xlsx$/i, "");
            await writeExcelFile([header, ...rows] as any, {
                sheet: "Inventaire",
                columns: cols.map((c) => ({ width: c.width })),
                stickyRowsCount: 1,
            }).toFile(`${name}.xlsx`);
            showExport = false;
        } catch (e) {
            console.error(e);
            error = "Export Excel impossible.";
        } finally {
            isExporting = false;
        }
    }
</script>

<div class="space-y-6 font-mono">
    <div class="retro-card-yellow p-6">
        <span class="retro-badge bg-black text-white text-[10px] font-black uppercase">REGISTRE</span>
        <h1 class="text-2xl sm:text-3xl font-black uppercase tracking-tight text-black mt-1">Registre d'inventaire</h1>
        <p class="text-xs text-black/80 mt-1">
            {stats.total} objet(s) · {stats.vendus} vendu(s) · Achats : {euro(stats.achats)} · Ventes : {euro(stats.ventes)}
        </p>
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

    <!-- Import depuis une photo -->
    <div class="retro-card p-4 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-sm font-black uppercase flex items-center gap-2">
                <span class="material-symbols-outlined text-[18px]">document_scanner</span> Importer une photo d'inventaire
            </h2>
            <button class="retro-btn text-xs px-3 py-1 bg-white flex items-center gap-1" onclick={() => (showManual = !showManual)}>
                <span class="material-symbols-outlined text-[16px]">add</span> Ajouter manuellement
            </button>
        </div>
        <p class="text-[11px] text-black/70">
            Photographiez votre inventaire manuscrit : l'agent Gemini lit chaque ligne. Vérifiez le résultat avant de l'enregistrer —
            les objets sont triés par date et reçoivent un code D0000.
        </p>
        <div class="flex flex-wrap items-center gap-3">
            <input
                bind:this={fileInput}
                type="file"
                accept="image/*,application/pdf"
                multiple
                class="file-input file-input-bordered file-input-sm text-xs border-2 border-black"
                onchange={onFilesChosen}
            />
            <button
                class="retro-btn-primary text-xs py-2 px-4 font-black flex items-center gap-1.5"
                disabled={files.length === 0 || isExtracting}
                onclick={extract}
            >
                <span class="material-symbols-outlined text-[16px]">auto_awesome</span>
                {isExtracting ? "Analyse en cours..." : `Analyser avec Gemini${files.length ? ` (${files.length})` : ""}`}
            </button>
        </div>

        {#if showManual}
            <form onsubmit={addManual} class="border-2 border-black p-3 bg-[#FFF8D6] grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
                <label class="text-[10px] font-bold uppercase col-span-2">Nom
                    <input class="retro-input text-xs w-full" bind:value={manual.nom} required />
                </label>
                <label class="text-[10px] font-bold uppercase">Catégorie
                    <input class="retro-input text-xs w-full" bind:value={manual.categorie} />
                </label>
                <label class="text-[10px] font-bold uppercase">Date d'acquisition
                    <input type="date" class="retro-input text-xs w-full" bind:value={manual.date_acquisition} />
                </label>
                <label class="text-[10px] font-bold uppercase">Provenance
                    <input class="retro-input text-xs w-full" bind:value={manual.provenance} />
                </label>
                <label class="text-[10px] font-bold uppercase">Prix d'achat
                    <input type="number" step="0.01" min="0" class="retro-input text-xs w-full" bind:value={manual.prix_achat} />
                </label>
                <label class="text-[10px] font-bold uppercase">Prix de vente
                    <input type="number" step="0.01" min="0" class="retro-input text-xs w-full" bind:value={manual.prix_vente} />
                </label>
                {#each BOOL_FIELDS as f (f.key)}
                    <label class="text-[10px] font-bold uppercase">{f.label}
                        <select
                            class="retro-select text-xs w-full"
                            value={boolToSelect(manual[f.key])}
                            onchange={(e) => (manual[f.key] = selectToBool(e.currentTarget.value))}
                        >
                            <option value="">—</option><option value="true">Oui</option><option value="false">Non</option>
                        </select>
                    </label>
                {/each}
                <button type="submit" class="retro-btn-primary text-xs py-2 px-4 font-black col-span-2 md:col-span-5">Créer l'objet</button>
            </form>
        {/if}

        {#if drafts.length > 0}
            <div class="border-2 border-black bg-[#F4F9FF]">
                <div class="px-3 py-2 border-b-2 border-black flex flex-wrap justify-between items-center gap-2 bg-[#BFD7FE]">
                    <span class="text-xs font-black uppercase">{drafts.length} objet(s) détecté(s) — vérifiez avant d'enregistrer</span>
                    <div class="flex gap-2">
                        <button class="retro-btn text-xs px-3 py-1 bg-white" onclick={() => (drafts = [])}>Annuler</button>
                        <button class="retro-btn-primary text-xs px-3 py-1 font-black" disabled={isSaving} onclick={saveDrafts}>
                            {isSaving ? "Enregistrement..." : "Enregistrer dans l'inventaire"}
                        </button>
                    </div>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-[11px]">
                        <thead class="bg-white text-left uppercase">
                            <tr>
                                <th class="p-1">Nom</th><th class="p-1">Catégorie</th><th class="p-1">Date</th>
                                <th class="p-1">Achat</th><th class="p-1">Vente</th>
                                {#each BOOL_FIELDS as f (f.key)}<th class="p-1">{f.label}</th>{/each}
                                <th class="p-1">Provenance</th><th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each drafts as d, i (i)}
                                <tr class="border-t border-black/10">
                                    <td class="p-1"><input class="retro-input text-[11px] w-48 {d.nom.trim() ? '' : '!bg-[#FFC2D1]'}" bind:value={d.nom} /></td>
                                    <td class="p-1"><input class="retro-input text-[11px] w-28" bind:value={d.categorie} /></td>
                                    <td class="p-1"><input type="date" class="retro-input text-[11px] w-32" bind:value={d.date_acquisition} /></td>
                                    <td class="p-1"><input type="number" step="0.01" class="retro-input text-[11px] w-20" bind:value={d.prix_achat} /></td>
                                    <td class="p-1"><input type="number" step="0.01" class="retro-input text-[11px] w-20" bind:value={d.prix_vente} /></td>
                                    {#each BOOL_FIELDS as f (f.key)}
                                        <td class="p-1">
                                            <select class="retro-select text-[11px]" value={boolToSelect(d[f.key])} onchange={(e) => (d[f.key] = selectToBool(e.currentTarget.value))}>
                                                <option value="">—</option><option value="true">Oui</option><option value="false">Non</option>
                                            </select>
                                        </td>
                                    {/each}
                                    <td class="p-1"><input class="retro-input text-[11px] w-28" bind:value={d.provenance} /></td>
                                    <td class="p-1">
                                        <button class="retro-btn-error text-xs px-2 py-1" title="Retirer" onclick={() => (drafts = drafts.filter((_, j) => j !== i))}>
                                            <span class="material-symbols-outlined text-[14px]">close</span>
                                        </button>
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            </div>
        {/if}
    </div>

    <!-- Table de l'inventaire -->
    <div class="retro-card p-4 space-y-3">
        <div class="flex flex-wrap items-center gap-3">
            <div class="relative flex-1 min-w-56">
                <span class="material-symbols-outlined text-[16px] absolute left-2 top-1/2 -translate-y-1/2 text-black/50">search</span>
                <input class="retro-input text-xs w-full !pl-8" bind:value={search} placeholder="Rechercher par code (ex : D0012 ou 12)" />
            </div>
            <span class="text-[11px] font-bold">{selected.size} sélectionné(s)</span>
            {#if selected.size > 0}
                <button class="text-[11px] underline" onclick={() => (selected = new Set())}>Vider la sélection</button>
            {/if}
            <button class="retro-btn-accent text-xs py-2 px-4 font-black flex items-center gap-1.5" disabled={items.length === 0} onclick={openExport}>
                <span class="material-symbols-outlined text-[16px]">download</span> Exporter Excel
            </button>
        </div>

        {#if isLoading}
            <p class="text-xs font-bold uppercase">Chargement...</p>
        {:else if filtered.length === 0}
            <p class="text-xs font-bold uppercase text-black/60">{items.length === 0 ? "L'inventaire est vide." : "Aucun objet ne correspond à ce code."}</p>
        {:else}
            <div class="overflow-x-auto border-2 border-black">
                <table class="w-full text-[11px]">
                    <thead class="bg-[#FFE600] text-left uppercase border-b-2 border-black">
                        <tr>
                            <th class="p-2"><input type="checkbox" class="checkbox checkbox-xs" checked={allFilteredSelected} onchange={toggleAllFiltered} title="Tout sélectionner" /></th>
                            <th class="p-2">Code</th><th class="p-2">Nom</th><th class="p-2">Catégorie</th><th class="p-2">Date</th>
                            <th class="p-2">Achat €</th><th class="p-2">Vente €</th>
                            {#each BOOL_FIELDS as f (f.key)}<th class="p-2">{f.label}</th>{/each}
                            <th class="p-2">Provenance</th><th class="p-2">Site</th><th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each pageItems as item (item.id)}
                            <tr class="border-t border-black/10 {selected.has(item.id) ? 'bg-[#FFF394]/40' : ''} {item.vendu ? 'text-black/60' : ''}">
                                <td class="p-1 text-center"><input type="checkbox" class="checkbox checkbox-xs" checked={selected.has(item.id)} onchange={() => toggle(item.id)} /></td>
                                <td class="p-1 font-black whitespace-nowrap">{item.code}</td>
                                <td class="p-1"><input class="retro-input text-[11px] w-52" value={item.nom} onchange={(e) => editText(item, "nom", e)} /></td>
                                <td class="p-1"><input class="retro-input text-[11px] w-28" value={item.categorie} onchange={(e) => editText(item, "categorie", e)} /></td>
                                <td class="p-1"><input type="date" class="retro-input text-[11px] w-32" value={item.date_acquisition ?? ""} onchange={(e) => editDate(item, e)} /></td>
                                <td class="p-1"><input type="number" step="0.01" min="0" class="retro-input text-[11px] w-20" value={item.prix_achat ?? ""} onchange={(e) => editNumber(item, "prix_achat", e)} /></td>
                                <td class="p-1"><input type="number" step="0.01" min="0" class="retro-input text-[11px] w-20" value={item.prix_vente ?? ""} onchange={(e) => editNumber(item, "prix_vente", e)} /></td>
                                {#each BOOL_FIELDS as f (f.key)}
                                    <td class="p-1">
                                        <select class="retro-select text-[11px] {item[f.key] ? '!bg-[#99E7DC]' : ''}" value={boolToSelect(item[f.key])} onchange={(e) => editBool(item, f.key, e)}>
                                            <option value="">—</option><option value="true">Oui</option><option value="false">Non</option>
                                        </select>
                                    </td>
                                {/each}
                                <td class="p-1"><input class="retro-input text-[11px] w-28" value={item.provenance ?? ""} onchange={(e) => editText(item, "provenance", e)} /></td>
                                <td class="p-1">
                                    {#if item.antiquite}
                                        <div class="flex items-center gap-1">
                                            <a href={siteItemUrl(item.antiquite)} target="_blank" rel="noreferrer" class="retro-badge bg-[#99E7DC] text-[10px] max-w-36 truncate" title="Voir sur le site">
                                                {item.antiquite.name}
                                            </a>
                                            <a href={`/antiquites/${item.antiquite.id}`} class="material-symbols-outlined text-[16px]" title="Éditer l'objet du site">edit</a>
                                            <button class="material-symbols-outlined text-[16px]" title="Délier" onclick={() => patch(item, { antiquite_id: null })}>link_off</button>
                                        </div>
                                    {:else}
                                        <button class="retro-btn text-[10px] px-2 py-1 bg-white flex items-center gap-1 whitespace-nowrap" onclick={() => openLink(item)}>
                                            <span class="material-symbols-outlined text-[14px]">link</span> Lier
                                        </button>
                                    {/if}
                                </td>
                                <td class="p-1">
                                    <button class="retro-btn-error text-xs px-2 py-1" onclick={() => remove(item)} title="Supprimer">
                                        <span class="material-symbols-outlined text-[14px]">delete</span>
                                    </button>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
            {#if totalPages > 1}
                <PaginationBar
                    pagination={{ total_items: filtered.length, total_pages: totalPages, current_page: page, page_size: pageItems.length }}
                    onPageChange={(p) => (page = p)}
                />
            {/if}
        {/if}
    </div>

    {#if linkingItem}
        <div class="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center p-4" role="presentation" onclick={() => (linkingItem = null)}>
            <div class="bg-white border-3 border-black shadow-[8px_8px_0px_0px_#000] max-w-md w-full" role="dialog" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
                <div class="bg-[#FFE600] border-b-2 border-black px-4 py-2 flex justify-between items-center gap-2">
                    <span class="font-black text-xs uppercase truncate">Lier {linkingItem.code} « {linkingItem.nom} » au site</span>
                    <button onclick={() => (linkingItem = null)} class="w-6 h-6 border border-black bg-white text-xs font-bold shrink-0">✕</button>
                </div>
                <div class="p-4 space-y-3">
                    <input class="retro-input text-xs w-full" bind:value={siteSearch} oninput={onSiteSearch} placeholder="Rechercher un objet sur le site" />
                    <div class="max-h-64 overflow-y-auto divide-y divide-black/10">
                        {#each siteResults as a (a.id)}
                            <button class="w-full text-left text-xs py-2 px-1 hover:bg-[#FFF394] flex justify-between gap-2" onclick={() => linkTo(a)}>
                                <span class="truncate">#{a.id} · {a.name}</span>
                                {#if isPublished(a)}
                                    <span class="retro-badge bg-[#99E7DC] text-[9px] shrink-0">Publié</span>
                                {:else}
                                    <span class="retro-badge bg-[#EDE9DF] text-[9px] shrink-0">Non publié</span>
                                {/if}
                            </button>
                        {:else}
                            <p class="text-xs text-black/60 py-2">Aucun résultat.</p>
                        {/each}
                    </div>
                </div>
            </div>
        </div>
    {/if}

    {#if showExport}
        <div class="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center p-4" role="presentation" onclick={() => (showExport = false)}>
            <div class="bg-white border-3 border-black shadow-[8px_8px_0px_0px_#000] max-w-lg w-full" role="dialog" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
                <div class="bg-[#86E2D5] border-b-2 border-black px-4 py-2 flex justify-between items-center">
                    <span class="font-black text-xs uppercase">Exporter au format Excel</span>
                    <button onclick={() => (showExport = false)} class="w-6 h-6 border border-black bg-white text-xs font-bold">✕</button>
                </div>
                <div class="p-4 space-y-4 text-xs">
                    <fieldset class="space-y-1">
                        <legend class="font-black uppercase mb-1">Objets à exporter</legend>
                        <label class="flex items-center gap-2">
                            <input type="radio" class="radio radio-xs" bind:group={exportScope} value="selection" disabled={selected.size === 0} />
                            Sélection ({selected.size})
                        </label>
                        <label class="flex items-center gap-2">
                            <input type="radio" class="radio radio-xs" bind:group={exportScope} value="filtered" />
                            Résultats de la recherche ({filtered.length})
                        </label>
                        <label class="flex items-center gap-2">
                            <input type="radio" class="radio radio-xs" bind:group={exportScope} value="all" />
                            Tout l'inventaire ({items.length})
                        </label>
                    </fieldset>

                    <fieldset>
                        <legend class="font-black uppercase mb-1 flex gap-3 items-center">
                            Colonnes
                            <button type="button" class="underline font-normal normal-case" onclick={() => (exportColumns = new Set(COLUMNS.map((c) => c.key)))}>Toutes</button>
                            <button type="button" class="underline font-normal normal-case" onclick={() => (exportColumns = new Set())}>Aucune</button>
                        </legend>
                        <div class="grid grid-cols-2 gap-1">
                            {#each COLUMNS as col (col.key)}
                                <label class="flex items-center gap-2">
                                    <input type="checkbox" class="checkbox checkbox-xs" checked={exportColumns.has(col.key)} onchange={() => toggleColumn(col.key)} />
                                    {col.label}
                                </label>
                            {/each}
                        </div>
                    </fieldset>

                    <label class="block font-black uppercase">Nom du fichier
                        <div class="flex items-center gap-1 mt-1">
                            <input class="retro-input text-xs flex-1 font-normal normal-case" bind:value={exportFileName} />
                            <span>.xlsx</span>
                        </div>
                    </label>

                    <button
                        class="retro-btn-primary w-full text-xs py-2 font-black flex items-center justify-center gap-1.5"
                        disabled={isExporting || exportColumns.size === 0 || exportRows.length === 0}
                        onclick={exportExcel}
                    >
                        <span class="material-symbols-outlined text-[16px]">download</span>
                        {isExporting ? "Export..." : `Exporter ${exportRows.length} objet(s) · ${exportColumns.size} colonne(s)`}
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>
