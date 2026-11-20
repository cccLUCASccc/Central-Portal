<script lang="ts">
    import { onMount } from "svelte";
    import writeExcelFile from "write-excel-file/browser";
    import { apiFetch } from "../../../lib/api";
    import { compressImageFile } from "../../../lib/imageCompressor";
    import { expandInventoryUnits } from "../../../lib/inventory-export";
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
        quantite: number | null;
        emplacement: string | null;
        vendu: boolean | null;
        photo: boolean | null;
        publie: boolean | null;
        etiquette_imprimee: boolean | null;
        provenance: string | null;
    }
    interface Item extends Entry {
        id: number;
        code: string;
        antiquite_id: number | null;
        antiquite?: LinkedAntiquite | null;
        document_id: number | null;
        document?: PurchaseDoc | null;
        doc_fields: string[] | null;
    }
    type BoolField = "vendu" | "photo" | "publie" | "etiquette_imprimee";
    interface PurchaseDoc {
        id: number;
        title: string;
        file_name: string;
        folder: string;
        subfolder: string;
        content_type: string;
        created_at: string;
    }
    type ColumnKey = keyof Entry | "code" | "lien_site" | "document";

    const COLUMNS: { key: ColumnKey; label: string; width: number }[] = [
        { key: "code", label: "Code", width: 10 },
        { key: "nom", label: "Nom", width: 34 },
        { key: "categorie", label: "Catégorie", width: 18 },
        { key: "date_acquisition", label: "Date d'acquisition", width: 16 },
        { key: "prix_achat", label: "Prix d'achat (€)", width: 14 },
        { key: "prix_vente", label: "Prix de vente (€)", width: 14 },
        { key: "quantite", label: "Quantité", width: 10 },
        { key: "emplacement", label: "Emplacement", width: 20 },
        { key: "vendu", label: "Vendu", width: 8 },
        { key: "photo", label: "Photo", width: 8 },
        { key: "publie", label: "Publié", width: 8 },
        { key: "etiquette_imprimee", label: "Étiquette imprimée", width: 16 },
        { key: "provenance", label: "Provenance", width: 22 },
        { key: "lien_site", label: "Lien site", width: 50 },
        { key: "document", label: "Document d'achat", width: 30 },
    ];
    const BOOL_FIELDS: { key: BoolField; label: string }[] = [
        { key: "vendu", label: "Vendu" },
        { key: "photo", label: "Photo" },
        { key: "publie", label: "Publié" },
        { key: "etiquette_imprimee", label: "Étiquette imprimée" },
    ];
    const PAGE_SIZE = 50;

    // Largeurs (px) des colonnes de la table, modifiables à la souris et mémorisées dans le navigateur.
    const TABLE_COLUMNS: { key: string; label: string; width: number }[] = [
        { key: "select", label: "", width: 32 },
        { key: "code", label: "Code", width: 64 },
        { key: "nom", label: "Nom", width: 240 },
        { key: "categorie", label: "Catégorie", width: 130 },
        { key: "date_acquisition", label: "Date", width: 130 },
        { key: "prix_achat", label: "Achat €", width: 90 },
        { key: "prix_vente", label: "Vente €", width: 90 },
        { key: "quantite", label: "Qté", width: 64 },
        { key: "emplacement", label: "Emplacement", width: 140 },
        { key: "vendu", label: "Vendu", width: 72 },
        { key: "photo", label: "Photo", width: 72 },
        { key: "publie", label: "Publié", width: 72 },
        { key: "etiquette_imprimee", label: "Étiquette", width: 92 },
        { key: "provenance", label: "Provenance", width: 140 },
        { key: "document", label: "Document", width: 200 },
        { key: "site", label: "Site", width: 240 },
        { key: "actions", label: "", width: 48 },
    ];
    const DEFAULT_WIDTHS = Object.fromEntries(TABLE_COLUMNS.map((c) => [c.key, c.width]));
    const WIDTHS_STORAGE_KEY = "registre-inventaire-col-widths";
    const MIN_COL_WIDTH = 32;
    let colWidths = $state<Record<string, number>>({ ...DEFAULT_WIDTHS });
    const tableWidth = $derived(TABLE_COLUMNS.reduce((s, c) => s + colWidths[c.key], 0));

    function loadColWidths() {
        try {
            const saved = JSON.parse(localStorage.getItem(WIDTHS_STORAGE_KEY) || "{}");
            for (const c of TABLE_COLUMNS) {
                if (typeof saved[c.key] === "number" && saved[c.key] >= MIN_COL_WIDTH) colWidths[c.key] = saved[c.key];
            }
        } catch {
            // Largeurs par défaut si la valeur mémorisée est illisible.
        }
    }

    function saveColWidths() {
        localStorage.setItem(WIDTHS_STORAGE_KEY, JSON.stringify(colWidths));
    }

    function resetColWidths() {
        colWidths = { ...DEFAULT_WIDTHS };
        localStorage.removeItem(WIDTHS_STORAGE_KEY);
    }

    function startResize(key: string, e: PointerEvent) {
        e.preventDefault();
        const handle = e.currentTarget as HTMLElement;
        handle.setPointerCapture(e.pointerId);
        const startX = e.clientX;
        const startWidth = colWidths[key];
        const onMove = (ev: PointerEvent) => {
            colWidths[key] = Math.max(MIN_COL_WIDTH, Math.round(startWidth + ev.clientX - startX));
        };
        const onUp = () => {
            handle.removeEventListener("pointermove", onMove);
            handle.removeEventListener("pointerup", onUp);
            handle.removeEventListener("pointercancel", onUp);
            saveColWidths();
        };
        handle.addEventListener("pointermove", onMove);
        handle.addEventListener("pointerup", onUp);
        handle.addEventListener("pointercancel", onUp);
    }

    function resetColWidth(key: string) {
        colWidths[key] = DEFAULT_WIDTHS[key];
        saveColWidths();
    }

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
            quantite: 1,
            emplacement: null,
            vendu: false,
            photo: false,
            publie: false,
            etiquette_imprimee: false,
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
    // Filtres : nom, provenance (NO_PROVENANCE = sans provenance) et états « Publié » / « Étiquette ».
    const NO_PROVENANCE = "\u0000";
    let nameSearch = $state("");
    let provenanceFilter = $state<string | null>(null);
    let publishedFilter = $state<"all" | "yes" | "no">("all");
    let labelFilter = $state<"all" | "yes" | "no">("all");
    const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    // Clé de regroupement : majuscules et espaces réduits (« Brocante » = « BROCANTE »), comme l'API.
    const provKey = (p: string | null | undefined) => (p ?? "").trim().replace(/\s+/g, " ").toUpperCase();
    const provenances = $derived(
        [...new Set(items.map((i) => provKey(i.provenance)).filter((p) => !!p))].sort((a, b) => a.localeCompare(b, "fr")),
    );
    const hasFilters = $derived(
        !!search.trim() ||
            !!nameSearch.trim() ||
            provenanceFilter !== null ||
            publishedFilter !== "all" ||
            labelFilter !== "all",
    );

    function resetFilters() {
        search = "";
        nameSearch = "";
        provenanceFilter = null;
        publishedFilter = "all";
        labelFilter = "all";
    }

    const filtered = $derived.by(() => {
        const name = normalize(nameSearch);
        let list = sorted.filter(
            (i) =>
                (!name || normalize(i.nom).includes(name)) &&
                (provenanceFilter === null ||
                    (provenanceFilter === NO_PROVENANCE ? !provKey(i.provenance) : provKey(i.provenance) === provenanceFilter)) &&
                (publishedFilter === "all" || (publishedFilter === "yes") === (i.publie === true)) &&
                (labelFilter === "all" || (labelFilter === "yes") === (i.etiquette_imprimee === true)),
        );
        const q = search.trim().toUpperCase().replace(/\s+/g, "");
        if (!q) return list;
        const exact = /^\d+$/.test(q) ? `D${q.padStart(4, "0")}` : q;
        const matches = list.filter((i) => i.code.toUpperCase().includes(q));
        // Correspondance exacte (ex : "12" → D0012) en premier.
        return [...matches.filter((i) => i.code === exact), ...matches.filter((i) => i.code !== exact)];
    });
    const purchaseTotal = $derived({
        amount: filtered.reduce((s, i) => s + (i.prix_achat ?? 0), 0),
        missing: filtered.filter((i) => i.prix_achat == null).length,
    });
    const totalLabel = $derived(
        provenanceFilter === NO_PROVENANCE
            ? "sans provenance"
            : provenanceFilter !== null
              ? provenanceFilter
              : hasFilters
                ? "objets filtrés"
                : "tout l'inventaire",
    );
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
        nameSearch;
        provenanceFilter;
        publishedFilter;
        labelFilter;
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

    onMount(() => {
        loadColWidths();
        load();
        loadSiteObjects();
        loadPurchaseDocs();
    });

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
        if (field === "provenance" ? provKey(value) !== provKey(item.provenance) : value !== (item[field] ?? ""))
            patch(item, { [field]: field === "provenance" && !value ? null : value });
    }

    function editNumber(item: Item, field: "prix_achat" | "prix_vente" | "quantite", e: Event) {
        const input = e.currentTarget as HTMLInputElement;
        const raw = input.value;
        if (field === "prix_vente" && item.antiquite_id != null && raw === "") {
            input.value = String(item.prix_vente ?? "");
            error = "Le prix de vente d'un objet lié au site ne peut pas être vide.";
            return;
        }
        if (field === "quantite" && raw === "") {
            input.value = String(item.quantite ?? 1);
            error = "La quantité ne peut pas être vide.";
            return;
        }
        const value = raw === "" ? null : Math.round(Number(raw));
        input.value = value === null ? "" : String(value);
        if (value !== item[field]) patch(item, { [field]: value });
    }

    function editDate(item: Item, e: Event) {
        const value = (e.currentTarget as HTMLInputElement).value || null;
        if (value !== item.date_acquisition) patch(item, { date_acquisition: value });
    }

    // ---------- Popup de choix (remplace les listes déroulantes) ----------
    interface PickerOption {
        value: string;
        label: string;
        hint?: string;
        badge?: { text: string; cls: string };
    }
    interface Picker {
        title: string;
        options: PickerOption[];
        current: string;
        searchable: boolean;
        empty?: string;
        onPick: (value: string) => void;
    }
    let picker = $state<Picker | null>(null);
    let pickerSearch = $state("");
    const pickerOptions = $derived.by(() => {
        if (!picker) return [];
        const q = pickerSearch.trim().toLowerCase();
        return q ? picker.options.filter((o) => o.label.toLowerCase().includes(q)) : picker.options;
    });

    function openPicker(p: Picker) {
        pickerSearch = "";
        picker = p;
    }

    function choose(value: string) {
        const p = picker;
        picker = null;
        p?.onPick(value);
    }

    const BOOL_OPTIONS: PickerOption[] = [
        { value: "true", label: "Oui" },
        { value: "false", label: "Non" },
    ];
    const boolKey = (v: boolean | null | undefined) => String(v === true);
    const keyToBool = (v: string) => v === "true";
    const boolLabel = (v: boolean | null | undefined) => (v === true ? "Oui" : "Non");

    function pickBool(title: string, current: boolean | null, onPick: (v: boolean | null) => void) {
        openPicker({ title, options: BOOL_OPTIONS, current: boolKey(current), searchable: false, onPick: (v) => onPick(keyToBool(v)) });
    }

    const EMPLACEMENT_OPTIONS: PickerOption[] = [
        { value: "", label: "Non renseigné" },
        { value: "sallon", label: "Sallon" },
        { value: "garage", label: "Garage" },
        { value: "salle_à_manger", label: "Salle à manger" },
    ];
    const emplacementLabel = (value: string | null) =>
        EMPLACEMENT_OPTIONS.find((option) => option.value === (value ?? ""))?.label ?? value ?? "Non renseigné";

    function pickEmplacement(title: string, current: string | null, onPick: (value: string | null) => void) {
        openPicker({ title, options: EMPLACEMENT_OPTIONS, current: current ?? "", searchable: false, onPick: (value) => onPick(value || null) });
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
    let siteObjects = $state<LinkedAntiquite[]>([]);
    let siteObjectsLoading = $state(false);
    const publishedSiteObjects = $derived(siteObjects.filter(isPublished).sort((a, b) => a.name.localeCompare(b.name, "fr")));
    const otherSiteObjects = $derived(siteObjects.filter((a) => !isPublished(a)).sort((a, b) => a.name.localeCompare(b.name, "fr")));
    const linkedCodeBySite = $derived(
        new Map(items.filter((i) => i.antiquite_id != null).map((i) => [i.antiquite_id as number, i.code]))
    );

    // ---------- Liaison à un document d'achat ----------
    const DOC_FIELD_LABELS: Record<string, string> = {
        nom: "nom",
        categorie: "catégorie",
        date_acquisition: "date",
        prix_achat: "prix d'achat",
        provenance: "provenance",
    };
    let purchaseDocs = $state<PurchaseDoc[]>([]);
    let readingIds = $state<Set<number>>(new Set());

    const fromDoc = (item: Item, field: string) => item.document_id != null && (item.doc_fields ?? []).includes(field);
    const docClass = (item: Item, field: string) => (fromDoc(item, field) ? "!bg-[#C9F2C7] !border-[#1F7A3A] cursor-not-allowed" : "");
    const docTitle = (item: Item, field: string) =>
        fromDoc(item, field)
            ? `🔒 Valeur issue du document « ${item.document?.title ?? ""} » : relisez ou déliez le document pour la modifier`
            : undefined;

    async function loadPurchaseDocs() {
        try {
            const res = await apiFetch("/api/documents?folder=achats");
            if (!res.ok) {
                error = await readError(res, "Impossible de charger les factures de marchandise.");
                return;
            }
            const docs: PurchaseDoc[] = await res.json();
            purchaseDocs = docs.filter((d) => d.folder === "achats" && d.subfolder === "marchandise");
        } catch {
            error = "Impossible de charger les factures de marchandise.";
        }
    }

    function setReading(id: number, on: boolean) {
        const next = new Set(readingIds);
        on ? next.add(id) : next.delete(id);
        readingIds = next;
    }

    function pickDocument(item: Item) {
        openPicker({
            title: `Lier ${item.code} « ${item.nom} » à une facture de marchandise`,
            options: purchaseDocs.map((d) => {
                const codes = items.filter((i) => i.document_id === d.id && i.id !== item.id).map((i) => i.code);
                return {
                    value: String(d.id),
                    label: d.title,
                    hint: `${d.file_name}${codes.length ? ` · déjà lié à ${codes.join(", ")}` : ""}`,
                    badge: { text: (d.file_name.split(".").pop() || "").toUpperCase().slice(0, 5), cls: "bg-[#FFD2A6]" },
                };
            }),
            current: item.document_id != null ? String(item.document_id) : "",
            searchable: true,
            empty: "Aucune facture dans Achats → Marchandise. Classez-y vos factures depuis Documents.",
            onPick: (v) => linkDocument(item, Number(v)),
        });
    }

    async function linkDocument(item: Item, documentId: number) {
        setReading(item.id, true);
        error = "";
        try {
            const res = await apiFetch(`/api/inventaire/${item.id}/document`, {
                method: "PUT",
                body: JSON.stringify({ document_id: documentId }),
            });
            if (!res.ok) {
                error = await readError(res, "Lecture du document impossible.");
                return;
            }
            const body: { item: Item; found: boolean; changes: { field: string }[] } = await res.json();
            items = items.map((i) => (i.id === item.id ? body.item : i));
            const title = body.item.document?.title ?? "le document";
            if (!body.found) {
                notice = `${item.code} lié à « ${title} », mais Gemini n'y a pas trouvé cet objet : aucun champ modifié.`;
            } else if (body.changes.length === 0) {
                notice = `${item.code} lié à « ${title} » : les informations du document confirment la fiche.`;
            } else {
                const labels = body.changes.map((c) => DOC_FIELD_LABELS[c.field] ?? c.field).join(", ");
                notice = `${item.code} lié à « ${title} » : ${body.changes.length} champ(s) rempli(s) ou corrigé(s) (${labels}).`;
            }
        } catch {
            error = "Erreur réseau pendant la lecture du document.";
        } finally {
            setReading(item.id, false);
        }
    }

    async function unlinkDocument(item: Item) {
        const res = await apiFetch(`/api/inventaire/${item.id}/document`, { method: "DELETE" });
        if (res.ok) {
            const updated: Item = await res.json();
            items = items.map((i) => (i.id === item.id ? updated : i));
        } else {
            error = await readError(res, "Impossible de délier le document.");
        }
    }

    async function loadSiteObjects() {
        siteObjectsLoading = true;
        try {
            const all: LinkedAntiquite[] = [];
            for (let p = 1, pages = 1; p <= pages; p++) {
                const res = await apiFetch(`/api/antiquites?limit=200&page=${p}`);
                if (!res.ok) break;
                const r = await res.json();
                all.push(...(Array.isArray(r) ? r : r.data || []).map((a: LinkedAntiquite) => ({
                    id: a.id,
                    name: a.name,
                    status: a.status,
                    approval_status: a.approval_status,
                })));
                pages = r.pagination?.total_pages ?? 1;
            }
            siteObjects = all;
        } catch {
            error = "Impossible de charger les objets du site.";
        } finally {
            siteObjectsLoading = false;
        }
    }

    function siteOption(a: LinkedAntiquite): PickerOption {
        const code = linkedCodeBySite.get(a.id);
        return {
            value: String(a.id),
            label: `#${a.id} · ${a.name}`,
            hint: code ? `Déjà lié à ${code}` : undefined,
            badge: isPublished(a) ? { text: "Publié", cls: "bg-[#99E7DC]" } : { text: "Non publié", cls: "bg-[#EDE9DF]" },
        };
    }

    function pickProvenance() {
        openPicker({
            title: "Filtrer par provenance",
            options: [
                { value: "__all__", label: "Toutes les provenances" },
                { value: NO_PROVENANCE, label: "Sans provenance", hint: `${items.filter((i) => !provKey(i.provenance)).length} objet(s)` },
                ...provenances.map((p) => ({
                    value: p,
                    label: p,
                    hint: `${items.filter((i) => provKey(i.provenance) === p).length} objet(s)`,
                })),
            ],
            current: provenanceFilter ?? "__all__",
            searchable: true,
            onPick: (v) => (provenanceFilter = v === "__all__" ? null : v),
        });
    }

    function pickSite(item: Item) {
        openPicker({
            title: `Lier ${item.code} « ${item.nom} » à un objet du site`,
            options: [...publishedSiteObjects, ...otherSiteObjects].map(siteOption),
            current: item.antiquite_id != null ? String(item.antiquite_id) : "",
            searchable: true,
            onPick: (v) => {
                const a = siteObjects.find((o) => o.id === Number(v));
                // L'API passe aussi Photo et Publié à Oui.
                if (a) patch(item, { antiquite_id: a.id });
            },
        });
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
    const exportUnitCount = $derived(exportRows.reduce((total, item) => total + (item.quantite ?? 1), 0));

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
            case "quantite":
                return item.quantite === null ? 1 : item.quantite;
            case "vendu":
            case "photo":
            case "publie":
            case "etiquette_imprimee":
                return item[key] === null ? null : item[key] ? "Oui" : "Non";
            case "document":
                return item.document?.title ?? null;
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
        if (cols.length === 0 || exportUnitCount === 0) return;
        isExporting = true;
        try {
            const header = cols.map((c) => ({ value: c.label, fontWeight: "bold" as const, backgroundColor: "#FFE600" }));
            const rows = expandInventoryUnits(exportRows).map((item) => cols.map((c) => cellFor(item, c.key)));
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

<div class="space-y-2 font-mono">
    {#snippet pickerButton(text: string, active: boolean, onclick: () => void, title = "", activeClass = "!bg-[#99E7DC]", inactiveClass = "")}
        <button
            type="button"
            class="retro-input text-[11px] w-full min-w-0 flex items-center justify-between gap-1 text-left cursor-pointer hover:bg-[#FFF394] {active ? activeClass : inactiveClass}"
            {title}
            {onclick}
        >
            <span class="truncate">{text}</span>
            <span class="material-symbols-outlined text-[14px] shrink-0">unfold_more</span>
        </button>
    {/snippet}
    <div class="retro-card-yellow px-3 py-2">
        <span class="retro-badge bg-black text-white text-[10px] font-black uppercase">INVENTAIRE</span>
        <h1 class="text-xl sm:text-2xl font-black uppercase tracking-tight text-black mt-1">Inventaire</h1>
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
    <div class="retro-card p-2 space-y-2">
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
                {#if isExtracting}
                    <span class="daisy-loader daisy-loader-xs" aria-hidden="true"></span>
                {:else}
                    <span class="material-symbols-outlined text-[16px]">auto_awesome</span>
                {/if}
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
                    <input class="retro-input text-xs w-full uppercase" bind:value={manual.provenance} />
                </label>
                <label class="text-[10px] font-bold uppercase">Prix d'achat
                    <input type="number" step="1" inputmode="numeric" min="0" class="retro-input text-xs w-full" bind:value={manual.prix_achat} />
                </label>
                <label class="text-[10px] font-bold uppercase">Prix de vente
                    <input type="number" step="1" inputmode="numeric" min="0" class="retro-input text-xs w-full" bind:value={manual.prix_vente} />
                </label>
                <label class="text-[10px] font-bold uppercase">Quantité
                    <input type="number" step="1" inputmode="numeric" min="0" class="retro-input text-xs w-full" bind:value={manual.quantite} required />
                </label>
                <div class="text-[10px] font-bold uppercase">Emplacement
                    {@render pickerButton(emplacementLabel(manual.emplacement), !!manual.emplacement, () =>
                        pickEmplacement("Emplacement — nouvel objet", manual.emplacement, (v) => (manual.emplacement = v)))}
                </div>
                {#each BOOL_FIELDS as f (f.key)}
                    <div class="text-[10px] font-bold uppercase">{f.label}
                        {@render pickerButton(boolLabel(manual[f.key]), manual[f.key] === true, () =>
                            pickBool(`${f.label} — nouvel objet`, manual[f.key], (v) => (manual[f.key] = v)))}
                    </div>
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
                                <th class="p-1">Quantité</th>
                                <th class="p-1">Emplacement</th>
                                {#each BOOL_FIELDS as f (f.key)}<th class="p-1">{f.label}</th>{/each}
                                <th class="p-1">Provenance</th><th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each drafts as d, i (i)}
                                <tr class="border-t border-black/10">
                                    <td class="p-1"><input class="retro-input text-[11px] !w-48 {d.nom.trim() ? '' : '!bg-[#FFC2D1]'}" bind:value={d.nom} /></td>
                                    <td class="p-1"><input class="retro-input text-[11px] !w-28" bind:value={d.categorie} /></td>
                                    <td class="p-1"><input type="date" class="retro-input text-[11px] !w-32" bind:value={d.date_acquisition} /></td>
                                    <td class="p-1"><input type="number" step="1" inputmode="numeric" class="retro-input text-[11px] !w-24" bind:value={d.prix_achat} /></td>
                                    <td class="p-1"><input type="number" step="1" inputmode="numeric" class="retro-input text-[11px] !w-24" bind:value={d.prix_vente} /></td>
                                    <td class="p-1"><input type="number" step="1" inputmode="numeric" min="0" class="retro-input text-[11px] !w-20" bind:value={d.quantite} required /></td>
                                    <td class="p-1 min-w-32">
                                        {@render pickerButton(emplacementLabel(d.emplacement), !!d.emplacement, () =>
                                            pickEmplacement(`Emplacement — ${d.nom || "objet détecté"}`, d.emplacement, (v) => (d.emplacement = v)))}
                                    </td>
                                    {#each BOOL_FIELDS as f (f.key)}
                                        <td class="p-1 min-w-20">
                                            {@render pickerButton(boolLabel(d[f.key]), d[f.key] === true, () =>
                                                pickBool(`${f.label} — ${d.nom || "objet détecté"}`, d[f.key], (v) => (d[f.key] = v)))}
                                        </td>
                                    {/each}
                                    <td class="p-1"><input class="retro-input text-[11px] !w-28 uppercase" bind:value={d.provenance} /></td>
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
    <div class="retro-card p-1 space-y-1">
        <div class="flex flex-wrap items-center gap-2">
            <div class="relative flex-1 min-w-56">
                <span class="material-symbols-outlined text-[16px] absolute left-2 top-1/2 -translate-y-1/2 text-black/50">search</span>
                <input class="retro-input text-xs w-full !pl-8" bind:value={search} placeholder="Rechercher par code (ex : D0012 ou 12)" />
            </div>
            <div class="relative flex-1 min-w-56">
                <span class="material-symbols-outlined text-[16px] absolute left-2 top-1/2 -translate-y-1/2 text-black/50">match_case</span>
                <input class="retro-input text-xs w-full !pl-8" bind:value={nameSearch} placeholder="Rechercher par nom" />
            </div>
            <div class="w-52">
                {@render pickerButton(
                    provenanceFilter === null ? "Provenance : toutes" : provenanceFilter === NO_PROVENANCE ? "Provenance : aucune" : `Provenance : ${provenanceFilter}`,
                    provenanceFilter !== null,
                    pickProvenance,
                    "Filtrer par provenance",
                )}
            </div>
            <div class="flex" role="group" aria-label="Filtrer par état Publié">
                {#each [["all", "Tous"], ["yes", "Publiés"], ["no", "Non publiés"]] as [value, label] (value)}
                    <button
                        class="retro-btn text-xs py-2 px-3 {publishedFilter === value ? 'bg-[#99E7DC]' : 'bg-white'}"
                        aria-pressed={publishedFilter === value}
                        onclick={() => (publishedFilter = value as "all" | "yes" | "no")}
                    >{label}</button>
                {/each}
            </div>
            <div class="flex" role="group" aria-label="Filtrer par état Étiquette imprimée">
                {#each [["all", "Étiquettes : toutes"], ["yes", "Imprimées"], ["no", "Non imprimées"]] as [value, label] (value)}
                    <button
                        class="retro-btn text-xs py-2 px-3 {labelFilter === value ? 'bg-[#FFE600]' : 'bg-white'}"
                        aria-pressed={labelFilter === value}
                        onclick={() => (labelFilter = value as "all" | "yes" | "no")}
                    >{label}</button>
                {/each}
            </div>
            {#if hasFilters}
                <button class="text-[11px] underline" onclick={resetFilters}>Effacer les filtres</button>
                <span class="text-[11px] font-bold">{filtered.length} / {items.length} objet(s)</span>
            {/if}
            <span class="text-[11px] font-bold">{selected.size} sélectionné(s)</span>
            {#if selected.size > 0}
                <button class="text-[11px] underline" onclick={() => (selected = new Set())}>Vider la sélection</button>
            {/if}
            <button class="retro-btn text-xs py-2 px-3 bg-white flex items-center gap-1" onclick={resetColWidths} title="Rétablir les largeurs de colonnes par défaut">
                <span class="material-symbols-outlined text-[16px]">width</span> Largeurs par défaut
            </button>
            <button class="retro-btn-accent text-xs py-2 px-4 font-black flex items-center gap-1.5" disabled={items.length === 0} onclick={openExport}>
                <span class="material-symbols-outlined text-[16px]">download</span> Exporter Excel
            </button>
        </div>

        {#if isLoading}
            <div role="status" class="daisy-loading-state gap-2 py-6"><span class="daisy-loader" aria-hidden="true"></span><p class="text-xs font-bold uppercase">Chargement de l'inventaire...</p></div>
        {:else if filtered.length === 0}
            <p class="text-xs font-bold uppercase text-black/60">{items.length === 0 ? "L'inventaire est vide." : "Aucun objet ne correspond à ces filtres."}</p>
        {:else}
            <div class="overflow-x-auto border-2 border-black">
                <table class="table-fixed text-[11px]" style={`width: ${tableWidth}px; min-width: 100%;`}>
                    <colgroup>
                        {#each TABLE_COLUMNS as c (c.key)}<col style={`width: ${colWidths[c.key]}px`} />{/each}
                    </colgroup>
                    <thead class="bg-[#FFE600] text-left uppercase border-b-2 border-black">
                        <tr>
                            {#each TABLE_COLUMNS as c (c.key)}
                                <th class="relative p-1 truncate select-none" title={c.label}>
                                    {#if c.key === "select"}
                                        <input type="checkbox" class="checkbox checkbox-xs" checked={allFilteredSelected} onchange={toggleAllFiltered} title="Tout sélectionner" />
                                    {:else}
                                        {c.label}
                                    {/if}
                                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                                    <span
                                        class="absolute top-0 right-0 h-full w-2 cursor-col-resize touch-none border-r-2 border-black/20 hover:border-black"
                                        title="Glisser pour redimensionner (double-clic : largeur par défaut)"
                                        onpointerdown={(e) => startResize(c.key, e)}
                                        ondblclick={() => resetColWidth(c.key)}
                                    ></span>
                                </th>
                            {/each}
                        </tr>
                    </thead>
                    <tbody>
                        {#each pageItems as item (item.id)}
                            <tr class="border-t border-black/10 {selected.has(item.id) ? 'bg-[#FFF394]/40' : ''} {item.vendu ? 'text-black/60' : ''}">
                                <td class="p-0.5 text-center"><input type="checkbox" class="checkbox checkbox-xs" checked={selected.has(item.id)} onchange={() => toggle(item.id)} /></td>
                                <td class="p-0.5 font-black truncate" title={item.code}>{item.code}</td>
                                <td class="p-0.5"><input class="retro-input text-[11px] w-full min-w-0 {docClass(item, 'nom')}" value={item.nom} title={docTitle(item, "nom") ?? item.nom} readonly={fromDoc(item, "nom")} onchange={(e) => editText(item, "nom", e)} /></td>
                                <td class="p-0.5"><input class="retro-input text-[11px] w-full min-w-0 {docClass(item, 'categorie')}" value={item.categorie} title={docTitle(item, "categorie")} readonly={fromDoc(item, "categorie")} onchange={(e) => editText(item, "categorie", e)} /></td>
                                <td class="p-0.5"><input type="date" class="retro-input text-[11px] w-full min-w-0 {docClass(item, 'date_acquisition')}" value={item.date_acquisition ?? ""} title={docTitle(item, "date_acquisition")} readonly={fromDoc(item, "date_acquisition")} onchange={(e) => editDate(item, e)} /></td>
                                <td class="p-0.5"><input type="number" step="1" inputmode="numeric" min="0" class="retro-input text-[11px] w-full min-w-0 {docClass(item, 'prix_achat')}" value={item.prix_achat ?? ""} title={docTitle(item, "prix_achat")} readonly={fromDoc(item, "prix_achat")} onchange={(e) => editNumber(item, "prix_achat", e)} /></td>
                                <td class="p-0.5"><input type="number" step="1" inputmode="numeric" min="0" class="retro-input text-[11px] w-full min-w-0 {item.antiquite_id != null ? '!bg-[#E3EDFF]' : ''}" value={item.prix_vente ?? ""} title={item.antiquite ? `Prix synchronisé avec le site (« ${item.antiquite.name} »)` : undefined} onchange={(e) => editNumber(item, "prix_vente", e)} /></td>
                                <td class="p-0.5"><input type="number" step="1" inputmode="numeric" min="0" class="retro-input text-[11px] w-full min-w-0" value={item.quantite ?? 1} onchange={(e) => editNumber(item, "quantite", e)} /></td>
                                <td class="p-0.5">
                                    {@render pickerButton(emplacementLabel(item.emplacement), !!item.emplacement, () =>
                                        pickEmplacement(`Emplacement — ${item.code} « ${item.nom} »`, item.emplacement, (v) => patch(item, { emplacement: v })))}
                                </td>
                                {#each BOOL_FIELDS as f (f.key)}
                                    <td class="p-0.5">
                                        {@render pickerButton(boolLabel(item[f.key]), item[f.key] === true, () =>
                                            pickBool(`${f.label} — ${item.code} « ${item.nom} »`, item[f.key], (v) => patch(item, { [f.key]: v })),
                                            "",
                                            f.key === "etiquette_imprimee" ? "!bg-[#FFE600]" : "!bg-[#99E7DC]",
                                            f.key === "publie" ? "!bg-[#FFC2D1]" : "")}
                                    </td>
                                {/each}
                                <td class="p-0.5"><input class="retro-input text-[11px] w-full min-w-0 uppercase {docClass(item, 'provenance')}" value={item.provenance ?? ""} title={docTitle(item, "provenance")} readonly={fromDoc(item, "provenance")} onchange={(e) => editText(item, "provenance", e)} /></td>
                                <td class="p-0.5 overflow-hidden">
                                    {#if readingIds.has(item.id)}
                                        <span role="status" class="retro-input text-[11px] w-full flex items-center gap-1 !bg-[#FFF394]">
                                            <span class="daisy-loader daisy-loader-xs" aria-hidden="true"></span> Lecture Gemini…
                                        </span>
                                    {:else if item.document}
                                        <div class="flex items-center gap-1 min-w-0">
                                            <a
                                                href={`/documents?doc=${item.document.id}`}
                                                class="retro-badge bg-[#C9F2C7] text-[10px] min-w-0 flex-1 truncate flex items-center gap-1 hover:bg-[#FFF394] hover:underline"
                                                title={`Ouvrir « ${item.document.title} » (${item.document.file_name})`}
                                            >
                                                <span class="material-symbols-outlined text-[13px] shrink-0">description</span>
                                                <span class="truncate">{item.document.title}</span>
                                            </a>
                                            <button class="material-symbols-outlined text-[16px]" title="Relire le document avec Gemini" onclick={() => item.document_id && linkDocument(item, item.document_id)}>refresh</button>
                                            <button class="material-symbols-outlined text-[16px]" title="Changer de document" onclick={() => pickDocument(item)}>swap_horiz</button>
                                            <button class="material-symbols-outlined text-[16px]" title="Délier le document" onclick={() => unlinkDocument(item)}>link_off</button>
                                        </div>
                                    {:else}
                                        {@render pickerButton("Lier un document…", false, () => pickDocument(item), "Lier à une facture du dossier Achats → Marchandise")}
                                    {/if}
                                </td>
                                <td class="p-0.5 overflow-hidden">
                                    {#if item.antiquite}
                                        <div class="flex items-center gap-1 min-w-0">
                                            <a href={siteItemUrl(item.antiquite)} target="_blank" rel="noreferrer" class="retro-badge bg-[#99E7DC] text-[10px] min-w-0 flex-1 truncate" title="Voir sur le site">
                                                {item.antiquite.name}
                                            </a>
                                            <a href={`/antiquites/${item.antiquite.id}`} class="material-symbols-outlined text-[16px]" title="Éditer l'objet du site">edit</a>
                                            <button class="material-symbols-outlined text-[16px]" title="Délier" onclick={() => patch(item, { antiquite_id: null })}>link_off</button>
                                        </div>
                                    {:else}
                                        {@render pickerButton(siteObjectsLoading ? "Chargement..." : "Lier à un objet…", false, () => pickSite(item), "Lier à un objet du site")}
                                    {/if}
                                </td>
                                <td class="p-0.5">
                                    <button class="retro-btn-error text-xs px-2 py-1" onclick={() => remove(item)} title="Supprimer">
                                        <span class="material-symbols-outlined text-[14px]">delete</span>
                                    </button>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
            <div class="flex flex-wrap items-baseline justify-end gap-x-3 gap-y-1 border-2 border-black bg-[#FFF394] px-3 py-2 text-xs" role="status">
                <span class="font-black uppercase">Total d'achat — {totalLabel}</span>
                <span class="text-base font-black">{euro(purchaseTotal.amount)}</span>
                <span class="text-black/70">
                    {filtered.length} objet(s){purchaseTotal.missing ? ` · ${purchaseTotal.missing} sans prix d'achat` : ""}
                </span>
            </div>
            {#if totalPages > 1}
                <PaginationBar
                    pagination={{ total_items: filtered.length, total_pages: totalPages, current_page: page, page_size: pageItems.length }}
                    onPageChange={(p) => (page = p)}
                />
            {/if}
        {/if}
    </div>

    {#if picker}
        <div class="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center p-4" role="presentation" onclick={() => (picker = null)}>
            <div
                class="bg-white border-3 border-black shadow-[8px_8px_0px_0px_#000] max-w-md w-full max-h-[80vh] flex flex-col"
                role="dialog"
                aria-modal="true"
                tabindex="-1"
                onclick={(e) => e.stopPropagation()}
                onkeydown={(e) => e.key === "Escape" && (picker = null)}
            >
                <div class="bg-[#FFE600] border-b-2 border-black px-4 py-2 flex justify-between items-center gap-2">
                    <span class="font-black text-xs uppercase truncate" title={picker.title}>{picker.title}</span>
                    <button onclick={() => (picker = null)} class="w-6 h-6 border border-black bg-white text-xs font-bold shrink-0">✕</button>
                </div>
                <div class="p-4 space-y-3 flex flex-col min-h-0">
                    {#if picker.searchable}
                        <!-- svelte-ignore a11y_autofocus -->
                        <input class="retro-input text-xs w-full" bind:value={pickerSearch} placeholder="Rechercher..." autofocus />
                    {/if}
                    <div class="overflow-y-auto min-h-0 space-y-1.5">
                        {#each pickerOptions as o (o.value)}
                            <button
                                class="retro-btn w-full justify-between text-left text-xs py-2 px-3 bg-white hover:bg-[#FFF394] flex items-center gap-2 {o.value === picker.current ? '!bg-[#99E7DC]' : ''}"
                                onclick={() => choose(o.value)}
                            >
                                <span class="min-w-0">
                                    <span class="block truncate font-bold">{o.label}</span>
                                    {#if o.hint}<span class="block text-[10px] text-black/60">{o.hint}</span>{/if}
                                </span>
                                {#if o.badge}<span class="retro-badge {o.badge.cls} text-[9px] shrink-0">{o.badge.text}</span>{/if}
                            </button>
                        {:else}
                            <p class="text-xs text-black/60 py-2">{pickerSearch.trim() ? "Aucun résultat." : (picker.empty ?? (siteObjectsLoading ? "Chargement..." : "Aucun résultat."))}</p>
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
                        <p class="mb-1">Une ligne par unité ; les objets de quantité zéro ne sont pas exportés. Les autres valeurs, y compris les prix, sont répétées.</p>
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
                        disabled={isExporting || exportColumns.size === 0 || exportUnitCount === 0}
                        onclick={exportExcel}
                    >
                        <span class="material-symbols-outlined text-[16px]">download</span>
                        {isExporting ? "Export..." : `Exporter ${exportUnitCount} ligne(s) · ${exportColumns.size} colonne(s)`}
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>
