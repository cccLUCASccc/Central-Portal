<script lang="ts">
    import { onMount } from "svelte";
    import { apiFetch } from "../../../lib/api";
    import { siteItemUrl } from "../../../lib/siteLink";

    interface LinkedAntiquite {
        id: number;
        name: string;
        status: number;
        approval_status?: string;
    }
    interface StoreItem {
        id: number;
        name: string;
        quantity: number;
        antiquite_id: number | null;
        antiquite?: LinkedAntiquite | null;
    }

    let items = $state<StoreItem[]>([]);
    let isLoading = $state(true);
    let search = $state("");
    let newName = $state("");
    let newQty = $state(1);
    let error = $state("");

    // Liaison à un objet du site
    let linkingItem = $state<StoreItem | null>(null);
    let siteSearch = $state("");
    let siteResults = $state<LinkedAntiquite[]>([]);
    let siteTimer: ReturnType<typeof setTimeout>;

    const filtered = $derived(
        items.filter((i) => i.name.toLowerCase().includes(search.trim().toLowerCase()))
    );
    const totalUnits = $derived(items.reduce((s, i) => s + i.quantity, 0));

    async function load() {
        isLoading = true;
        try {
            const res = await apiFetch("/api/store-items");
            if (res.ok) items = await res.json();
            else error = "Impossible de charger l'inventaire magasin.";
        } catch {
            error = "Erreur réseau.";
        } finally {
            isLoading = false;
        }
    }

    onMount(load);

    let isImporting = $state(false);
    async function importSite() {
        isImporting = true;
        try {
            const res = await apiFetch("/api/store-items/import-site", { method: "POST" });
            if (res.ok) {
                const { created } = await res.json();
                await load();
                alert(created ? `${created} objet(s) du site ajouté(s) et lié(s).` : "Tous les objets publiés ont déjà une ligne.");
            } else {
                error = "Import impossible.";
            }
        } finally {
            isImporting = false;
        }
    }
    async function addItem(e: Event) {
        e.preventDefault();
        if (!newName.trim()) return;
        const res = await apiFetch("/api/store-items", {
            method: "POST",
            body: JSON.stringify({ name: newName.trim(), quantity: newQty }),
        });
        if (res.ok) {
            items = [...items, await res.json()];
            newName = "";
            newQty = 1;
        } else {
            error = "Ajout impossible.";
        }
    }

    async function patch(item: StoreItem, body: Record<string, unknown>) {
        const res = await apiFetch(`/api/store-items/${item.id}`, {
            method: "PATCH",
            body: JSON.stringify(body),
        });
        if (res.ok) {
            const updated: StoreItem = await res.json();
            items = items.map((i) => (i.id === item.id ? updated : i));
        } else {
            error = "Mise à jour impossible.";
        }
    }

    function changeQty(item: StoreItem, delta: number) {
        const q = item.quantity + delta;
        if (q < 0) return;
        patch(item, { quantity: q });
    }

    function rename(item: StoreItem, e: Event) {
        const value = (e.currentTarget as HTMLInputElement).value.trim();
        if (value && value !== item.name) patch(item, { name: value });
        else (e.currentTarget as HTMLInputElement).value = item.name;
    }

    async function remove(item: StoreItem) {
        if (!confirm(`Supprimer « ${item.name} » ?`)) return;
        const res = await apiFetch(`/api/store-items/${item.id}`, { method: "DELETE" });
        if (res.ok) items = items.filter((i) => i.id !== item.id);
    }

    function openLink(item: StoreItem) {
        linkingItem = item;
        siteSearch = item.name;
        searchSite();
    }

    function onSiteSearch() {
        clearTimeout(siteTimer);
        siteTimer = setTimeout(searchSite, 300);
    }

    async function searchSite() {
        const params = new URLSearchParams({ limit: "10" });
        if (siteSearch.trim()) params.set("q", siteSearch.trim());
        const res = await apiFetch(`/api/antiquites?${params.toString()}`);
        if (res.ok) {
            const r = await res.json();
            siteResults = Array.isArray(r) ? r : r.data || [];
        }
    }

    async function linkTo(a: LinkedAntiquite) {
        if (!linkingItem) return;
        await patch(linkingItem, { antiquite_id: a.id });
        linkingItem = null;
    }
</script>

<div class="space-y-6 font-mono">
    <div class="retro-card-blue p-6">
        <span class="retro-badge bg-black text-white text-[10px] font-black uppercase">MAGASIN</span>
        <h1 class="text-2xl sm:text-3xl font-black uppercase tracking-tight text-black mt-1">Inventaire Magasin</h1>
        <p class="text-xs text-black/80 mt-1">
            {items.length} référence(s) · {totalUnits} unité(s). Liez un article à un objet du site s'il y est publié.
        </p>
        <button type="button" onclick={importSite} disabled={isImporting} class="retro-btn bg-white hover:bg-[#FFE600] text-xs py-2 px-3.5 mt-3 flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[16px]">sync_alt</span>
            <span>{isImporting ? "Import..." : "Importer les objets du site"}</span>
        </button>
    </div>

    <form onsubmit={addItem} class="retro-card p-4 flex flex-wrap items-end gap-3">
        <div class="flex-1 min-w-48">
            <label class="text-xs font-bold uppercase" for="si-name">Nom de l'objet</label>
            <input id="si-name" class="retro-input text-xs w-full" bind:value={newName} placeholder="Ex : Vase Art Déco" required />
        </div>
        <div class="w-24">
            <label class="text-xs font-bold uppercase" for="si-qty">Qté</label>
            <input id="si-qty" type="number" min="0" class="retro-input text-xs w-full" bind:value={newQty} />
        </div>
        <button type="submit" class="retro-btn-primary text-xs py-2 px-4 font-black flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[16px]">add</span> Ajouter
        </button>
    </form>

    {#if error}
        <div class="p-3 border-2 border-black bg-[#FFC2D1] text-xs font-bold flex justify-between">
            <span>{error}</span>
            <button onclick={() => (error = "")}>✕</button>
        </div>
    {/if}

    <div class="retro-card p-4 space-y-3">
        <input class="retro-input text-xs w-full" bind:value={search} placeholder="Rechercher dans l'inventaire magasin..." />

        {#if isLoading}
            <p class="text-xs font-bold uppercase">Chargement...</p>
        {:else if filtered.length === 0}
            <p class="text-xs font-bold uppercase text-black/60">Aucun article.</p>
        {:else}
            <div class="divide-y-2 divide-black/10">
                {#each filtered as item (item.id)}
                    <div class="py-2 flex flex-wrap items-center gap-3">
                        <input
                            class="retro-input text-xs flex-1 min-w-48"
                            value={item.name}
                            onchange={(e) => rename(item, e)}
                        />

                        <div class="flex items-center gap-1">
                            <button class="retro-btn text-xs px-2 py-1 bg-white" onclick={() => changeQty(item, -1)} disabled={item.quantity === 0}>−</button>
                            <span class="w-10 text-center text-sm font-black">{item.quantity}</span>
                            <button class="retro-btn text-xs px-2 py-1 bg-white" onclick={() => changeQty(item, 1)}>+</button>
                        </div>

                        <div class="flex items-center gap-2 min-w-44">
                            {#if item.antiquite}
                                <a
                                    href={siteItemUrl(item.antiquite)}
                                    target="_blank"
                                    rel="noreferrer"
                                    class="retro-badge bg-[#99E7DC] text-[10px] max-w-48 truncate"
                                    title="Voir sur le site"
                                >
                                    Site : {item.antiquite.name}
                                </a>
                                <a href={`/antiquites/${item.antiquite.id}`} class="material-symbols-outlined text-[16px]" title="Éditer l'objet">edit</a>
                                <button class="text-[10px] underline" onclick={() => patch(item, { unlink: true })}>Délier</button>
                            {:else}
                                <button class="retro-btn text-[10px] px-2 py-1 bg-white flex items-center gap-1" onclick={() => openLink(item)}>
                                    <span class="material-symbols-outlined text-[14px]">link</span> Lier au site
                                </button>
                            {/if}
                        </div>

                        <button class="retro-btn-error text-xs px-2 py-1" onclick={() => remove(item)} title="Supprimer">
                            <span class="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    {#if linkingItem}
        <div class="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center p-4" role="presentation" onclick={() => (linkingItem = null)}>
            <div class="bg-white border-3 border-black shadow-[8px_8px_0px_0px_#000] max-w-md w-full" role="dialog" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
                <div class="bg-[#FFE600] border-b-2 border-black px-4 py-2 flex justify-between items-center">
                    <span class="font-black text-xs uppercase">Lier « {linkingItem.name} » à un objet du site</span>
                    <button onclick={() => (linkingItem = null)} class="w-6 h-6 border border-black bg-white text-xs font-bold">✕</button>
                </div>
                <div class="p-4 space-y-3">
                    <input class="retro-input text-xs w-full" bind:value={siteSearch} oninput={onSiteSearch} placeholder="Nom de l'objet du site" />
                    <div class="max-h-64 overflow-y-auto divide-y divide-black/10">
                        {#each siteResults as a (a.id)}
                            <button class="w-full text-left text-xs py-2 px-1 hover:bg-[#FFF394]" onclick={() => linkTo(a)}>
                                #{a.id} · {a.name}
                            </button>
                        {:else}
                            <p class="text-xs text-black/60 py-2">Aucun résultat.</p>
                        {/each}
                    </div>
                </div>
            </div>
        </div>
    {/if}
</div>
