<script lang="ts">
    import { onMount } from "svelte";
    import { apiFetch } from "../../../lib/api";

    interface Shop {
        id: number;
        user_id: string;
        name: string;
        slug: string;
        description: string;
        avatar_url: string;
        banner_url: string;
        street?: string;
        postal_code?: string;
        city: string;
        country?: string;
        address?: string;
        iban?: string;
        bic?: string;
        account_holder?: string;
        seller_type: string;
        tax_number: string;
        contact_email?: string;
        stripe_customer_id?: string;
        stripe_subscription_id?: string;
        stripe_connect_account_id?: string;
        stripe_connect_payouts_enabled?: boolean;
        stripe_connect_details_submitted?: boolean;
        abonnement_actif: boolean;
        type_abonnement: string;
        is_approved: boolean;
        approval_status: string;
        rejection_reason: string;
        is_active: boolean;
        history: string;
        hours: string;
        links: string;
        created_at: string;
        active_items_count?: number;
        sold_items_count?: number;
        pending_items_count?: number;
        email?: string;
        is_official?: boolean;
        is_complete?: boolean;
        missing_fields?: string[];
    }

    let shops = $state<Shop[]>([]);
    let isLoading = $state(true);
    let activeFilter = $state<'pending' | 'approved' | 'rejected'>('approved');

    // Modal de rejet
    let rejectingShop = $state<Shop | null>(null);
    let editingShop = $state<Shop | null>(null);

    async function handleEditShopSubmit(e: Event) {
        e.preventDefault();
        if (!editingShop) return;
        isProcessing = true;
        try {
            const res = await apiFetch(`${PUBLIC_API_URL}/api/shops/${editingShop.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: editingShop.name,
                    description: editingShop.description,
                    history: editingShop.history,
                    hours: editingShop.hours,
                    links: editingShop.links,
                    street: editingShop.street,
                    postal_code: editingShop.postal_code,
                    city: editingShop.city,
                    country: editingShop.country,
                    address: editingShop.address,
                    seller_type: editingShop.seller_type,
                    iban: editingShop.iban,
                    bic: editingShop.bic,
                    account_holder: editingShop.account_holder,
                    tax_number: editingShop.tax_number,
                    contact_email: editingShop.contact_email ?? "",
                    type_abonnement: editingShop.type_abonnement,
                    abonnement_actif: editingShop.abonnement_actif
                })
            });
            if (res.ok) {
                editingShop = null;
                await fetchShops();
            } else {
                const err = await res.json();
                alert(err.error || "Erreur lors de la modification");
            }
        } catch(e) {
            alert("Erreur lors de la modification");
        } finally {
            isProcessing = false;
        }
    }
    let rejectionReason = $state("");
    // 'changes' = demande de corrections (dossier conservé), 'reject' = refus définitif (Stripe purgé, réinscription complète)
    let reviewMode = $state<'reject' | 'changes'>('reject');
    let isProcessing = $state(false);

    // Modal gestion de l'inventaire d'une boutique
    let viewingShopItems = $state<Shop | null>(null);
    let shopItems = $state<any[]>([]);
    let isLoadingItems = $state(false);
    let rejectingItem = $state<any | null>(null);
    let itemRejectionReason = $state("");
    let itemSearchQuery = $state("");
    let itemFilterStatus = $state<'all' | 'active' | 'pending' | 'sold' | 'rejected'>('all');

    function getItemImageUrl(item: any): string | null {
        if (!item?.images || item.images.length === 0) return null;
        const img = item.images[0]?.url;
        if (!img) return null;
        if (img.startsWith("http://") || img.startsWith("https://")) return img;
        return `${PUBLIC_API_URL}${img.startsWith('/') ? '' : '/'}${img}`;
    }

    let filteredShopItems = $derived(
        shopItems.filter(item => {
            // Filtre par statut
            if (itemFilterStatus === 'active') {
                if (item.status !== 0 || item.approval_status !== 'approved') return false;
            } else if (itemFilterStatus === 'pending') {
                if (item.approval_status !== 'pending') return false;
            } else if (itemFilterStatus === 'sold') {
                if (item.status !== 2) return false;
            } else if (itemFilterStatus === 'rejected') {
                if (item.approval_status !== 'rejected') return false;
            }

            // Filtre texte
            if (itemSearchQuery.trim() !== '') {
                const q = itemSearchQuery.toLowerCase();
                const matchName = item.name?.toLowerCase().includes(q);
                const matchDesc = item.description?.toLowerCase().includes(q);
                const matchId = item.id?.toString().includes(q);
                return matchName || matchDesc || matchId;
            }

            return true;
        })
    );

    let shopTotalItems = $derived(shopItems.length);
    let shopActiveItems = $derived(shopItems.filter(i => i.status === 0 && i.approval_status === 'approved').length);
    let shopPendingItems = $derived(shopItems.filter(i => i.approval_status === 'pending').length);
    let shopSoldItems = $derived(shopItems.filter(i => i.status === 2).length);
    let shopRejectedItems = $derived(shopItems.filter(i => i.approval_status === 'rejected').length);
    let shopTotalValue = $derived(shopItems.filter(i => i.status === 0).reduce((acc, i) => acc + (Number(i.price) || 0), 0));

    async function viewShopItems(shop: Shop) {
        viewingShopItems = shop;
        isLoadingItems = true;
        itemSearchQuery = "";
        itemFilterStatus = "all";
        try {
            const res = await apiFetch(`${PUBLIC_API_URL}/api/shops/${shop.id}/items`);
            if (res.ok) {
                shopItems = await res.json();
            }
        } catch(e) {
            console.error("Erreur chargement objets:", e);
        } finally {
            isLoadingItems = false;
        }
    }

    async function approveItem(itemId: number) {
        isProcessing = true;
        try {
            await apiFetch(`${PUBLIC_API_URL}/api/antiquites/${itemId}/approve`, { method: "PATCH" });
            const item = shopItems.find(i => i.id === itemId);
            if(item) item.approval_status = "approved";
        } catch(e) {
            console.error("Erreur:", e);
        } finally {
            isProcessing = false;
        }
    }

    async function handleRejectItemSubmit(e: Event) {
        e.preventDefault();
        if (!rejectingItem) return;
        isProcessing = true;
        try {
            await apiFetch(`${PUBLIC_API_URL}/api/antiquites/${rejectingItem.id}/reject`, { 
                method: "PATCH",
                body: JSON.stringify({ reason: itemRejectionReason }) 
            });
            const item = shopItems.find(i => i.id === rejectingItem.id);
            if(item) {
                item.approval_status = "rejected";
                item.rejection_reason = itemRejectionReason;
            }
            rejectingItem = null;
        } catch(e) {
            console.error("Erreur:", e);
        } finally {
            isProcessing = false;
        }
    }

    const PUBLIC_API_URL = (import.meta as any).env.PUBLIC_API_URL || "https://central-api-production-a031.up.railway.app";

    onMount(async () => {
        await fetchShops();
    });

    async function fetchShops() {
        isLoading = true;
        try {
            const res = await apiFetch(`${PUBLIC_API_URL}/api/shops`);
            if (res.ok) {
                const data = await res.json();
                shops = data.data || [];
            } else {
                console.error("Erreur API Shops:", res.status);
            }
        } catch (error) {
            console.error("Error fetching shops:", error);
        } finally {
            isLoading = false;
        }
    }

    async function approveShop(shopId: number) {
        if (!confirm("Confirmer la validation de cette boutique ? Ses pièces seront visibles publiquement.")) return;
        isProcessing = true;
        try {
            const res = await apiFetch(`${PUBLIC_API_URL}/api/shops/${shopId}/approve`, {
                method: "PATCH"
            });
            if (res.ok) {
                await fetchShops();
            } else {
                const err = await res.json().catch(() => null);
                const missing: string[] = err?.missing_fields || [];
                alert(`${err?.error || "Erreur lors de l'approbation."}${missing.length ? `\n\nÉléments manquants :\n- ${missing.join("\n- ")}` : ""}`);
            }
        } catch (e) {
            alert("Erreur de connexion.");
        } finally {
            isProcessing = false;
        }
    }

    async function handleRejectSubmit(e: Event) {
        e.preventDefault();
        if (!rejectingShop) return;
        isProcessing = true;
        try {
            const endpoint = reviewMode === 'changes' ? 'request-changes' : 'reject';
            const res = await apiFetch(`${PUBLIC_API_URL}/api/shops/${rejectingShop.id}/${endpoint}`, {
                method: "PATCH",
                body: JSON.stringify({ reason: rejectionReason })
            });
            const data = await res.json().catch(() => null);
            if (res.ok) {
                rejectingShop = null;
                rejectionReason = "";
                const warnings: string[] = data?.stripe_warnings || [];
                if (warnings.length) {
                    alert(`Boutique refusée, mais le nettoyage Stripe est incomplet (il sera retenté lors de la réinscription) :\n- ${warnings.join("\n- ")}`);
                }
                await fetchShops();
            } else {
                alert(data?.error || (reviewMode === 'changes' ? "Erreur lors de la demande de modifications." : "Erreur lors du rejet."));
            }
        } catch (e) {
            alert("Erreur de connexion.");
        } finally {
            isProcessing = false;
        }
    }

    async function suspendShop(shopId: number) {
        if (!confirm("Voulez-vous suspendre temporairement cette boutique ?")) return;
        isProcessing = true;
        try {
            const res = await apiFetch(`${PUBLIC_API_URL}/api/shops/${shopId}/suspend`, {
                method: "PATCH"
            });
            if (res.ok) {
                await fetchShops();
            } else {
                alert("Erreur lors de la suspension.");
            }
        } catch (e) {
            alert("Erreur de connexion.");
        } finally {
            isProcessing = false;
        }
    }

    // États exclusifs : désactivée > en attente > active
    function shopState(s: Shop): 'active' | 'pending' | 'disabled' {
        if (s.approval_status === 'rejected' || s.approval_status === 'suspended' || (s.approval_status === 'approved' && !s.is_active)) return 'disabled';
        if (s.approval_status === 'approved' && s.is_approved) return 'active';
        return 'pending';
    }

    let filteredShops = $derived(
        shops.filter(s => {
            // Filtre par statut
            if (activeFilter === 'pending') {
                if (shopState(s) !== 'pending') return false;
            } else if (activeFilter === 'approved') {
                if (shopState(s) !== 'active') return false;
            } else if (activeFilter === 'rejected') {
                if (shopState(s) !== 'disabled') return false;
            }

            return true;
        })
    );

    let pendingCount = $derived(shops.filter(s => shopState(s) === 'pending').length);
    let approvedCount = $derived(shops.filter(s => shopState(s) === 'active').length);
    let rejectedCount = $derived(shops.filter(s => shopState(s) === 'disabled').length);
</script>

<div class="space-y-6 font-mono">
    
    <!-- En-tête / Hero Modération -->
    <div class="retro-card-yellow p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-3 border-black shadow-[6px_6px_0px_0px_#000]">
        <div class="space-y-2">
            <div class="flex items-center gap-2 flex-wrap">
                <a href="/" class="retro-badge bg-black text-white text-xs hover:bg-[#FFAEC1] hover:text-black transition-colors">« RETOUR AU HUB</a>
                <span class="retro-badge bg-[#86E2D5] text-black text-xs font-black">MARKETPLACE // VENDEURS</span>
                <span class="retro-badge bg-white text-black text-xs">V2.0</span>
            </div>
            <h1 class="text-3xl sm:text-4xl font-black uppercase tracking-tight text-black">
                Modération & Gestion des Boutiques
            </h1>
            <p class="text-xs sm:text-sm text-black/80 font-medium max-w-2xl leading-relaxed">
                Validez les demandes d'ouverture de boutique, vérifiez la complétude des dossiers (Stripe Connect, TVA, coordonnées) et contrôlez les quotas d'annonces.
            </p>
        </div>
    </div>

    <!-- KPIs boutiques -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button onclick={() => activeFilter = 'approved'} class="bg-[#86E2D5] border-3 border-black p-4 shadow-[4px_4px_0px_0px_#000] text-left cursor-pointer">
            <span class="text-[10px] uppercase font-bold text-black/60 block">Boutiques actives</span>
            <span class="text-3xl font-black text-black">{approvedCount}</span>
        </button>
        <button onclick={() => activeFilter = 'pending'} class="bg-[#FFD166] border-3 border-black p-4 shadow-[4px_4px_0px_0px_#000] text-left cursor-pointer">
            <span class="text-[10px] uppercase font-bold text-black/60 block">En attente</span>
            <span class="text-3xl font-black text-black">{pendingCount}</span>
        </button>
        <button onclick={() => activeFilter = 'rejected'} class="bg-[#FFAEC1] border-3 border-black p-4 shadow-[4px_4px_0px_0px_#000] text-left cursor-pointer">
            <span class="text-[10px] uppercase font-bold text-black/60 block">Désactivées</span>
            <span class="text-3xl font-black text-black">{rejectedCount}</span>
        </button>
    </div>

    <!-- Liste des Boutiques -->
    {#if isLoading}
        <div class="bg-white border-3 border-black p-12 text-center shadow-[4px_4px_0px_0px_#000] space-y-3">
            <div class="w-8 h-8 border-3 border-black border-t-[#FFD166] rounded-full animate-spin mx-auto"></div>
            <p class="text-xs font-bold uppercase text-black/70">Chargement des boutiques...</p>
        </div>
    {:else if filteredShops.length === 0}
        <div class="bg-white border-3 border-black p-12 text-center shadow-[4px_4px_0px_0px_#000] space-y-2">
            <span class="material-symbols-outlined text-4xl text-black/40 block">storefront</span>
            <p class="text-sm font-black uppercase text-black">Aucune boutique trouvée pour ce filtre.</p>
        </div>
    {:else}
        <div class="grid grid-cols-1 gap-6">
            {#each filteredShops as s}
                <article class="overflow-hidden border border-slate-300 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
                    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        <span>Daisy Brocante <span class="mx-1 text-slate-300">/</span> Dossier vendeur</span>
                        <span class="font-mono tracking-normal">Référence boutique : DB-{s.id}</span>
                    </div>
                    {#if s.banner_url}
                        <img src={s.banner_url} alt={`Bannière de ${s.name}`} class="h-36 w-full border-0 border-b border-slate-200 object-cover" loading="lazy" />
                    {/if}
                    
                    <!-- Ligne 1 : En-tête Boutique & Statuts -->
                    <div class="flex flex-col gap-5 border-b border-slate-200 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
                        <div class="flex flex-col items-start gap-3">
                            {#if s.pending_items_count && s.pending_items_count > 0}
                                <div class="flex items-center gap-2 border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold uppercase text-rose-800">
                                    <span class="relative flex h-2 w-2">
                                      <span class="relative inline-flex h-2 w-2 rounded-full bg-rose-600"></span>
                                    </span>
                                    {s.pending_items_count} objet{s.pending_items_count > 1 ? 's' : ''} en attente
                                </div>
                            {/if}
                            <div class="flex items-center gap-4">
                            <div class="h-20 w-20 flex-shrink-0 overflow-hidden border border-slate-300 bg-slate-100">
                                {#if s.avatar_url}
                                    <img src={s.avatar_url} alt={`Logo de ${s.name}`} class="h-full w-full object-cover" loading="lazy" />
                                {:else}
                                    <div class="w-full h-full flex items-center justify-center text-xl font-bold">
                                        <span class="material-symbols-outlined text-2xl text-slate-400">storefront</span>
                                    </div>
                                {/if}
                            </div>
                            <div>
                                <div class="flex items-center gap-2 flex-wrap">
                                    {#if s.approval_status === 'approved' && s.is_approved}
                                        <span class="border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-emerald-800">Validée</span>
                                    {:else if s.approval_status === 'rejected'}
                                        <span class="border border-rose-200 bg-rose-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-rose-800">Rejetée</span>
                                    {:else if s.approval_status === 'changes_requested'}
                                        <span class="border border-orange-200 bg-orange-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-orange-800">Modifications demandées</span>
                                    {:else if s.approval_status === 'suspended'}
                                        <span class="border border-slate-300 bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-700">Suspendue</span>
                                    {:else}
                                        <span class="border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-amber-800">En attente de validation</span>
                                    {/if}

                                    <span class="border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-600">
                                        {s.seller_type === 'societe' ? 'SOCIÉTÉ' : 'PARTICULIER'}
                                    </span>

                                    <span class="border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-600">
                                        FORMULE {s.type_abonnement?.toUpperCase()}
                                    </span>
                                </div>

                                <h3 class="mt-2 text-2xl font-bold tracking-tight text-slate-900">{s.name}</h3>
                                <p class="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-600">
                                    <span>{s.address || (s.street ? `${s.street}, ${s.postal_code} ${s.city} (${s.country || 'BE'})` : s.city || 'Adresse non renseignée')}</span>
                                    <span class="text-slate-300">|</span>
                                    <span class="font-mono text-slate-500">/{s.slug}</span>
                                </p>
                            </div>
                        </div>
                        </div>

                        <!-- Actions Rapides de Modération -->
                        <div class="flex flex-wrap items-center gap-2 self-end lg:self-center">
                            <button 
                                onclick={() => editingShop = JSON.parse(JSON.stringify(s))}
                                class="retro-btn bg-[#FFD166] hover:bg-[#F0C055] text-xs font-black py-2 px-3 shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5"
                            >
                                <span class="material-symbols-outlined text-[16px]">edit</span>
                                <span>Modifier</span>
                            </button>
                            <button 
                                onclick={() => viewShopItems(s)}
                                class="retro-btn bg-[#BFD7FE] hover:bg-[#A3C4FD] text-xs font-black py-2 px-3 shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer"
                                title="Consulter et gérer l'inventaire de cette boutique"
                            >
                                <span class="material-symbols-outlined text-[16px]">inventory_2</span>
                                <span>Voir inventaire</span>
                                {#if s.pending_items_count && s.pending_items_count > 0}
                                    <span class="bg-[#FFAEC1] border border-black px-1.5 py-0.2 text-[9px] font-black rounded-none">
                                        {s.pending_items_count}
                                    </span>
                                {/if}
                            </button>
                            {#if s.approval_status === 'pending' || s.approval_status === 'suspended'}
                                <button 
                                    onclick={() => approveShop(s.id)}
                                    disabled={isProcessing || s.is_complete === false}
                                    title={s.is_complete === false ? 'Dossier incomplet : validation impossible' : undefined}
                                    class="retro-btn bg-[#86E2D5] hover:bg-[#65C4B5] text-xs font-black py-2 px-4 shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <span class="material-symbols-outlined text-[16px]">check</span>
                                    <span>{s.approval_status === 'suspended' ? 'Réactiver la boutique' : 'Valider la boutique'}</span>
                                </button>
                            {/if}

                            {#if s.approval_status === 'pending'}
                                <button 
                                    onclick={() => { rejectingShop = s; rejectionReason = ""; reviewMode = 'changes'; }}
                                    disabled={isProcessing}
                                    class="retro-btn bg-[#FFB87B] hover:bg-[#F5A462] text-xs font-black py-2 px-4 shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5"
                                >
                                    <span class="material-symbols-outlined text-[16px]">edit_note</span>
                                    <span>Demander des modifications</span>
                                </button>
                            {/if}

                            {#if s.approval_status === 'pending' || s.approval_status === 'changes_requested'}
                                <button 
                                    onclick={() => { rejectingShop = s; rejectionReason = ""; reviewMode = 'reject'; }}
                                    disabled={isProcessing}
                                    class="retro-btn bg-[#FFAEC1] hover:bg-[#FF8CA4] text-xs font-black py-2 px-4 shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5"
                                >
                                    <span class="material-symbols-outlined text-[16px]">close</span>
                                    <span>Rejeter</span>
                                </button>
                            {/if}

                            {#if s.approval_status === 'approved' && s.is_active}
                                <button 
                                    onclick={() => suspendShop(s.id)}
                                    disabled={isProcessing}
                                    class="retro-btn bg-white hover:bg-[#EDE9DF] text-xs font-black py-2 px-3 shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5"
                                >
                                    <span class="material-symbols-outlined text-[16px]">pause</span>
                                    <span>Suspendre</span>
                                </button>
                            {/if}
                        </div>
                    </div>

                    <!-- Contrôle de complétude du dossier -->
                    {#if s.missing_fields && s.missing_fields.length > 0}
                        <div class="border-b border-rose-200 bg-rose-50 px-5 py-3 text-xs text-rose-900">
                            <strong class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em]">
                                <span class="material-symbols-outlined text-[16px]">report</span>
                                Dossier incomplet — {s.missing_fields.length} élément{s.missing_fields.length > 1 ? 's' : ''} manquant{s.missing_fields.length > 1 ? 's' : ''}
                            </strong>
                            <ul class="mt-2 flex flex-wrap gap-1.5">
                                {#each s.missing_fields as field}
                                    <li class="border border-rose-200 bg-white px-2 py-0.5 text-[10px] font-semibold">{field}</li>
                                {/each}
                            </ul>
                        </div>
                    {:else if s.is_complete}
                        <div class="flex items-center gap-1.5 border-b border-emerald-200 bg-emerald-50 px-5 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-800">
                            <span class="material-symbols-outlined text-[16px]">task_alt</span>
                            Dossier complet{s.is_official ? ' — boutique officielle Daisy Brocante' : ''}
                        </div>
                    {/if}

                    <!-- Ligne 2 : Détails Bancaires & Fiscaux -->
                    <div class="grid grid-cols-1 gap-0 divide-y divide-slate-200 text-xs md:grid-cols-3 md:divide-x md:divide-y-0">
                        <!-- Bloc Coordonnées Bancaires Stripe Connect -->
                        <div class="space-y-3 p-5">
                            <span class="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                                <span class="material-symbols-outlined text-[16px]">credit_card</span>
                                <span>Paiements Stripe Connect</span>
                            </span>
                            <div>
                                <span class="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">Statut des reversements</span>
                                {#if s.is_official}
                                    <span class="inline-flex items-center gap-1.5 border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-bold uppercase text-slate-600">
                                        <span class="h-1.5 w-1.5 rounded-full bg-slate-400"></span> Non applicable — encaissement direct
                                    </span>
                                {:else if s.stripe_connect_payouts_enabled}
                                    <span class="inline-flex items-center gap-1.5 border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] font-bold uppercase text-emerald-800">
                                        <span class="h-1.5 w-1.5 rounded-full bg-emerald-700"></span> Actif et vérifié
                                    </span>
                                {:else if s.stripe_connect_account_id}
                                    <span class="inline-flex items-center gap-1.5 border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-bold uppercase text-amber-800">
                                        <span class="h-1.5 w-1.5 rounded-full bg-amber-600"></span> Configuration en attente
                                    </span>
                                {:else}
                                    <span class="inline-flex items-center gap-1.5 border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-bold uppercase text-slate-600">
                                        <span class="h-1.5 w-1.5 rounded-full bg-slate-400"></span> Non configuré
                                    </span>
                                {/if}
                            </div>
                            <div>
                                <span class="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">Compte Stripe Connect</span>
                                <code class="block break-all border border-slate-200 bg-slate-50 px-2 py-1.5 font-mono text-[10px] text-slate-800">{s.stripe_connect_account_id || 'Aucun compte associé'}</code>
                            </div>
                            {#if s.stripe_customer_id || s.stripe_subscription_id}
                                <div>
                                    <span class="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">Client Stripe</span>
                                    <code class="block break-all font-mono text-[10px] text-slate-700">{s.stripe_customer_id || '—'}</code>
                                </div>
                                <div>
                                    <span class="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">Abonnement Stripe</span>
                                    <code class="block break-all font-mono text-[10px] text-slate-700">{s.stripe_subscription_id || '—'}</code>
                                </div>
                            {/if}
                            <div>
                                <span class="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">Dossier Stripe</span>
                                <strong class="font-medium text-slate-800">{s.is_official ? 'Non applicable (boutique officielle)' : s.stripe_connect_details_submitted ? 'Informations soumises' : 'Informations incomplètes'}</strong>
                            </div>
                            {#if s.iban || s.bic || s.account_holder}
                                <div class="border-t border-slate-100 pt-3">
                                    <span class="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">IBAN / BIC saisis par l'administration</span>
                                    <code class="block break-all font-mono text-[10px] text-slate-800">{s.iban || 'IBAN non renseigné'}{s.bic ? ` · ${s.bic}` : ''}</code>
                                    {#if s.account_holder}
                                        <span class="mt-1 block text-[10px] text-slate-600">Titulaire : {s.account_holder}</span>
                                    {/if}
                                </div>
                            {:else}
                                <p class="border-t border-slate-100 pt-3 text-[10px] leading-relaxed text-slate-500">Les coordonnées bancaires (IBAN) sont détenues par Stripe et ne sont pas stockées par Daisy Brocante.</p>
                            {/if}
                        </div>

                        <!-- Bloc Juridique & Formule -->
                        <div class="space-y-3 p-5">
                            <span class="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                                <span class="material-symbols-outlined text-[16px]">description</span>
                                <span>Données Administratives</span>
                            </span>
                            <div>
                                <span class="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">Type de vendeur</span>
                                <strong class="font-medium uppercase text-slate-800">{s.seller_type || 'Non renseigné'}</strong>
                            </div>
                            <div>
                                <span class="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">N° TVA / entreprise</span>
                                <strong class="block break-all font-mono font-medium text-slate-800">{s.tax_number || 'Non renseigné'}</strong>
                            </div>
                            <div>
                                <span class="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">Email de contact</span>
                                {#if s.email}
                                    <a class="block break-all font-medium text-blue-800 underline decoration-blue-200 underline-offset-2 hover:text-blue-950" href={`mailto:${s.email}`}>{s.email}</a>
                                {:else}
                                    <span class="text-slate-500">Email non disponible</span>
                                {/if}
                            </div>
                            <div>
                                <span class="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">Identifiant vendeur</span>
                                <code class="block break-all font-mono text-[10px] text-slate-600">{s.user_id || 'Non renseigné'}</code>
                            </div>
                        </div>

                        <!-- Bloc Activité & Statistiques -->
                        <div class="space-y-3 p-5">
                            <span class="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                                <span class="material-symbols-outlined text-[16px]">bar_chart</span>
                                <span>Activité Catalogue</span>
                            </span>
                            <div class="flex justify-between border-b border-slate-100 pb-2">
                                <span class="text-slate-500">Annonces actives</span>
                                <strong class="font-semibold text-slate-900">{s.active_items_count ?? 0}</strong>
                            </div>
                            <div class="flex justify-between border-b border-slate-100 pb-2">
                                <span class="text-slate-500">Pièces vendues</span>
                                <strong class="font-semibold text-slate-900">{s.sold_items_count ?? 0}</strong>
                            </div>
                            <div class="flex justify-between gap-3 pt-1">
                                <span class="text-slate-500">Inscription</span>
                                <span class="text-right font-medium text-slate-800">{new Date(s.created_at).toLocaleDateString('fr-FR')}</span>
                            </div>
                            <div class="flex justify-between gap-3">
                                <span class="text-slate-500">Objets à vérifier</span>
                                <strong class="font-semibold text-slate-900">{s.pending_items_count ?? 0}</strong>
                            </div>
                        </div>
                    </div>

                    <!-- Motif du rejet / des modifications demandées (si applicable) -->
                    {#if s.rejection_reason && (s.approval_status === 'rejected' || s.approval_status === 'changes_requested')}
                        <div class="m-5 border p-4 text-xs {s.approval_status === 'changes_requested' ? 'border-orange-200 bg-orange-50 text-orange-950' : 'border-rose-200 bg-rose-50 text-rose-950'}">
                            <strong class="mb-1 flex items-center gap-1 font-semibold uppercase">
                                <span class="material-symbols-outlined text-[14px]">warning</span>
                                <span>{s.approval_status === 'changes_requested' ? 'Corrections demandées au vendeur (en attente de resoumission) :' : 'Motif du refus communiqué au vendeur :'}</span>
                            </strong>
                            <p>{s.rejection_reason}</p>
                        </div>
                    {/if}

                    <!-- Description de la boutique -->
                    {#if s.description}
                        <div class="border-t border-slate-200 bg-slate-50 px-5 py-4 text-xs leading-relaxed text-slate-600">
                            <span class="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Présentation de la boutique</span>
                            <p>{s.description}</p>
                        </div>
                    {/if}
                </article>
            {/each}
        </div>
    {/if}

    {#if editingShop}
        <div class="fixed inset-0 z-[99998] flex items-center justify-center bg-black/70 p-3 font-mono sm:p-5" role="presentation" onclick={(event) => event.target === event.currentTarget && (editingShop = null)} onkeydown={(event) => event.key === 'Escape' && (editingShop = null)}>
            <section class="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden border-3 border-black bg-[#EDE9DF] p-1 shadow-[8px_8px_0px_0px_#000]" role="dialog" aria-modal="true" aria-labelledby="edit-shop-title">
                <header class="flex items-center justify-between border-b-2 border-black bg-[#2B2D42] px-4 py-3 text-white">
                    <div>
                        <h2 id="edit-shop-title" class="text-sm font-black uppercase">Modifier {editingShop.name}</h2>
                        <p class="mt-1 text-[10px] text-white/70">Les identifiants Stripe et les images sont affichés en lecture seule.</p>
                    </div>
                    <button type="button" onclick={() => editingShop = null} aria-label="Fermer" class="border border-black bg-[#FFAEC1] px-2 py-1 text-xs font-black text-black">Fermer</button>
                </header>
                <form onsubmit={handleEditShopSubmit} class="overflow-y-auto bg-white p-4 sm:p-6">
                    <div class="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div class="space-y-2">
                            <span class="edit-shop-label">Avatar de la boutique</span>
                            {#if editingShop.avatar_url}<img src={editingShop.avatar_url} alt={`Avatar de ${editingShop.name}`} class="h-24 w-24 border-2 border-black object-cover" />{:else}<p class="text-xs text-black/60">Aucun avatar enregistré</p>{/if}
                        </div>
                        <div class="space-y-2">
                            <span class="edit-shop-label">Bannière de la boutique</span>
                            {#if editingShop.banner_url}<img src={editingShop.banner_url} alt={`Bannière de ${editingShop.name}`} class="h-24 w-full border-2 border-black object-cover" />{:else}<p class="text-xs text-black/60">Aucune bannière enregistrée</p>{/if}
                        </div>
                        <div class="space-y-2">
                            <span class="edit-shop-label">Compte Stripe Connect</span>
                            <code class="block break-all border border-black/20 bg-[#F6F4EE] p-2 text-xs">{editingShop.stripe_connect_account_id || 'Non configuré'}</code>
                        </div>
                        <div class="space-y-2">
                            <span class="edit-shop-label">État Stripe</span>
                            <p class="border border-black/20 bg-[#F6F4EE] p-2 text-xs">{editingShop.stripe_connect_payouts_enabled ? 'Reversements activés' : 'Reversements non activés'} · {editingShop.stripe_connect_details_submitted ? 'Dossier soumis' : 'Dossier incomplet'}</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <label class="edit-shop-field">Nom de la boutique<input required bind:value={editingShop.name} /></label>
                        <label class="edit-shop-field">Type de vendeur<select bind:value={editingShop.seller_type}><option value="particulier">Particulier</option><option value="societe">Société</option></select></label>
                        <label class="edit-shop-field sm:col-span-2">Description<textarea rows="3" bind:value={editingShop.description}></textarea></label>
                        <label class="edit-shop-field">Rue<input bind:value={editingShop.street} /></label>
                        <label class="edit-shop-field">Adresse complémentaire<input bind:value={editingShop.address} /></label>
                        <label class="edit-shop-field">Code postal<input bind:value={editingShop.postal_code} /></label>
                        <label class="edit-shop-field">Ville<input bind:value={editingShop.city} /></label>
                        <label class="edit-shop-field">Pays<input bind:value={editingShop.country} /></label>
                        <label class="edit-shop-field">N° TVA / entreprise<input bind:value={editingShop.tax_number} /></label>
                        <label class="edit-shop-field">Email de contact<input type="email" autocomplete="off" placeholder={editingShop.email || "Repris du compte Stripe"} bind:value={editingShop.contact_email} /></label>
                        <label class="edit-shop-field">Titulaire du compte<input bind:value={editingShop.account_holder} /></label>
                        <label class="edit-shop-field">IBAN<input autocomplete="off" bind:value={editingShop.iban} /></label>
                        <label class="edit-shop-field">BIC<input autocomplete="off" bind:value={editingShop.bic} /></label>
                        <label class="edit-shop-field">Formule<select bind:value={editingShop.type_abonnement}><option value="tier1">Tier 1</option><option value="tier2">Tier 2</option><option value="tier3">Tier 3</option><option value="tier4">Tier 4</option></select></label>
                        <label class="flex items-center gap-3 border-2 border-black p-3 text-xs font-bold"><input type="checkbox" bind:checked={editingShop.abonnement_actif} /> Abonnement actif</label>
                        <label class="edit-shop-field sm:col-span-2">Histoire<textarea rows="3" bind:value={editingShop.history}></textarea></label>
                        <label class="edit-shop-field sm:col-span-2">Horaires<textarea rows="2" bind:value={editingShop.hours}></textarea></label>
                        <label class="edit-shop-field sm:col-span-2">Liens<textarea rows="2" bind:value={editingShop.links}></textarea></label>
                    </div>
                    <div class="mt-5 flex justify-end gap-3 border-t-2 border-black pt-4">
                        <button type="button" onclick={() => editingShop = null} class="retro-btn bg-white px-4 py-2 text-xs font-black">Annuler</button>
                        <button type="submit" disabled={isProcessing} class="retro-btn bg-[#86E2D5] px-5 py-2 text-xs font-black shadow-[2px_2px_0px_0px_#000]">{isProcessing ? "Enregistrement..." : "Enregistrer les modifications"}</button>
                    </div>
                </form>
            </section>
        </div>
    {/if}

    <!-- MODAL DE REJET AVEC MOTIF -->
    {#if rejectingShop}
        <div class="fixed inset-0 z-[99999] bg-black/70 flex items-center justify-center p-4 font-mono">
            <div class="w-full max-w-lg bg-[#EDE9DF] border-3 border-black shadow-[8px_8px_0px_0px_#000] p-1">
                <div class="bg-[#2B2D42] text-white px-4 py-2 border-b-2 border-black flex items-center justify-between text-xs font-bold mb-3">
                    <span>{reviewMode === 'changes' ? 'DEMANDE DE MODIFICATIONS' : 'REFUS DÉFINITIF'} // {rejectingShop.name}</span>
                    <button 
                        type="button" 
                        onclick={() => rejectingShop = null}
                        class="w-4 h-4 bg-[#FFAEC1] border border-black text-black text-[9px] flex items-center justify-center font-black"
                    >
                        ✕
                    </button>
                </div>

                <form onsubmit={handleRejectSubmit} class="p-6 bg-white border-2 border-black m-1 space-y-4">
                    {#if reviewMode === 'reject'}
                        <div class="p-3 bg-[#FFAEC1] border-2 border-black text-[11px] font-bold text-black leading-relaxed">
                            Refus définitif : l'abonnement et le compte Stripe Connect du vendeur seront supprimés. Le vendeur ne pourra plus accéder à cette boutique et devra refaire toute l'inscription.
                            Pour de simples corrections, utilisez plutôt « Demander des modifications ».
                        </div>
                    {:else}
                        <div class="p-3 bg-[#FFD166] border-2 border-black text-[11px] font-bold text-black leading-relaxed">
                            Le vendeur conserve son dossier et son compte Stripe : il corrige ses informations dans ses paramètres puis resoumet la boutique.
                        </div>
                    {/if}
                    <div class="space-y-2">
                        <label class="text-xs font-black uppercase text-black" for="reason_text">
                            {reviewMode === 'changes' ? 'Modifications attendues (transmises au vendeur)' : 'Motif du refus (transmis au vendeur)'} *
                        </label>
                        <textarea 
                            id="reason_text" 
                            rows="4" 
                            required
                            bind:value={rejectionReason}
                            placeholder="ex: Coordonnées bancaires erronées, description incomplète ou pièces d'identité requises..."
                            class="retro-input resize-none text-xs"
                        ></textarea>
                    </div>

                    <div class="flex justify-end gap-3 pt-3 border-t-2 border-black">
                        <button 
                            type="button" 
                            onclick={() => rejectingShop = null}
                            class="retro-btn bg-white text-xs font-black py-2 px-4"
                        >
                            Annuler
                        </button>
                        <button 
                            type="submit" 
                            disabled={isProcessing}
                            class="retro-btn bg-[#FFAEC1] text-xs font-black py-2 px-6 shadow-[2px_2px_0px_0px_#000]"
                        >
                            {isProcessing ? "Traitement..." : reviewMode === 'changes' ? "Envoyer la demande" : "Confirmer le refus définitif"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    {/if}


    <!-- MODAL INVENTAIRE D'UNE BOUTIQUE -->
    {#if viewingShopItems}
        <div class="fixed inset-0 z-[99990] bg-black/70 flex items-center justify-center p-3 sm:p-5 font-sans backdrop-blur-xs">
            <div class="w-full max-w-5xl max-h-[92vh] bg-[#EDE9DF] border-3 border-black shadow-[8px_8px_0px_0px_#000] flex flex-col overflow-hidden">
                <!-- En-tête -->
                <div class="bg-[#2B2D42] text-white px-5 py-3.5 border-b-3 border-black flex items-center justify-between font-mono">
                    <div class="flex items-center gap-2.5 flex-wrap">
                        <span class="w-3 h-3 bg-[#86E2D5]"></span>
                        <span class="font-black text-sm uppercase tracking-wide">
                            INVENTAIRE BOUTIQUE // {viewingShopItems.name}
                        </span>
                        <span class="retro-badge bg-[#FFD166] text-black text-[9px] font-black">
                            FORMULE {viewingShopItems.type_abonnement?.toUpperCase()}
                        </span>
                    </div>
                    <div class="flex items-center gap-2">
                        <a 
                            href={`/antiquites?shop_id=${viewingShopItems.id}`}
                            target="_blank"
                            class="retro-btn bg-[#86E2D5] text-black hover:bg-[#65C4B5] text-[10px] py-1 px-2.5 flex items-center gap-1 font-black shadow-[1px_1px_0px_0px_#000] cursor-pointer"
                            title="Ouvrir dans l'interface complète de tableau"
                        >
                            <span class="material-symbols-outlined text-[13px]">open_in_new</span>
                            <span>Vue Tableau Plein Écran</span>
                        </a>
                        <button 
                            type="button" 
                            onclick={() => viewingShopItems = null}
                            class="w-7 h-7 bg-[#FFAEC1] hover:bg-[#FF8CA4] border-2 border-black text-black text-xs flex items-center justify-center font-black cursor-pointer shadow-[1px_1px_0px_0px_#000]"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <!-- Bandeau KPIs Inventaire Boutique -->
                <div class="bg-white border-b-2 border-black p-3.5 grid grid-cols-2 sm:grid-cols-5 gap-2.5 font-mono text-xs">
                    <div class="p-2 border border-black bg-[#F6F4EE]">
                        <span class="text-[9px] font-black uppercase text-black/60 block">Total Pièces</span>
                        <span class="text-base font-black text-black">{shopTotalItems}</span>
                    </div>
                    <div class="p-2 border border-black bg-[#86E2D5]/20">
                        <span class="text-[9px] font-black uppercase text-emerald-800 block">En Vente (Actif)</span>
                        <span class="text-base font-black text-emerald-900">{shopActiveItems}</span>
                    </div>
                    <div class="p-2 border border-black bg-[#FFD166]/30">
                        <span class="text-[9px] font-black uppercase text-amber-800 block">En Attente</span>
                        <span class="text-base font-black text-amber-900">{shopPendingItems}</span>
                    </div>
                    <div class="p-2 border border-black bg-[#BFD7FE]/30">
                        <span class="text-[9px] font-black uppercase text-blue-800 block">Vendus</span>
                        <span class="text-base font-black text-blue-900">{shopSoldItems}</span>
                    </div>
                    <div class="p-2 border border-black bg-[#FFAEC1]/20">
                        <span class="text-[9px] font-black uppercase text-[#D90429] block">Valeur Stock Actif</span>
                        <span class="text-base font-black text-[#D90429]">{shopTotalValue.toFixed(0)} €</span>
                    </div>
                </div>

                <!-- Barre d'outils : Filtres & Recherche -->
                <div class="bg-[#FBF8EE] border-b-2 border-black p-3 flex flex-wrap items-center justify-between gap-2.5 font-mono text-xs">
                    <div class="flex flex-wrap items-center gap-1.5">
                        <button 
                            type="button" 
                            onclick={() => itemFilterStatus = 'all'} 
                            class="retro-btn py-1 px-2.5 text-[10px] font-black {itemFilterStatus === 'all' ? 'bg-black text-white' : 'bg-white text-black'}"
                        >
                            Tous ({shopTotalItems})
                        </button>
                        <button 
                            type="button" 
                            onclick={() => itemFilterStatus = 'active'} 
                            class="retro-btn py-1 px-2.5 text-[10px] font-black {itemFilterStatus === 'active' ? 'bg-[#86E2D5] text-black font-black' : 'bg-white text-black'}"
                        >
                            En vente ({shopActiveItems})
                        </button>
                        <button 
                            type="button" 
                            onclick={() => itemFilterStatus = 'pending'} 
                            class="retro-btn py-1 px-2.5 text-[10px] font-black {itemFilterStatus === 'pending' ? 'bg-[#FFD166] text-black font-black' : 'bg-white text-black'}"
                        >
                            En attente ({shopPendingItems})
                        </button>
                        <button 
                            type="button" 
                            onclick={() => itemFilterStatus = 'sold'} 
                            class="retro-btn py-1 px-2.5 text-[10px] font-black {itemFilterStatus === 'sold' ? 'bg-[#BFD7FE] text-black font-black' : 'bg-white text-black'}"
                        >
                            Vendus ({shopSoldItems})
                        </button>
                        {#if shopRejectedItems > 0}
                            <button 
                                type="button" 
                                onclick={() => itemFilterStatus = 'rejected'} 
                                class="retro-btn py-1 px-2.5 text-[10px] font-black {itemFilterStatus === 'rejected' ? 'bg-[#FFAEC1] text-black font-black' : 'bg-white text-black'}"
                            >
                                Rejetés ({shopRejectedItems})
                            </button>
                        {/if}
                    </div>

                    <div class="relative w-full sm:w-64">
                        <input 
                            type="text" 
                            bind:value={itemSearchQuery}
                            placeholder="Rechercher nom, description, réf #..."
                            class="w-full bg-white border border-black px-2.5 py-1 text-xs font-mono font-bold outline-none shadow-[1px_1px_0px_0px_#000]"
                        />
                    </div>
                </div>

                <!-- Liste des Pièces de l'inventaire -->
                <div class="p-4 overflow-y-auto flex-1 space-y-3 bg-[#F6F4EE]">
                    {#if isLoadingItems}
                        <div class="p-12 text-center bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000] space-y-2 font-mono">
                            <span class="material-symbols-outlined text-3xl animate-spin">progress_activity</span>
                            <p class="text-xs font-black uppercase">Chargement de l'inventaire de la boutique...</p>
                        </div>
                    {:else if filteredShopItems.length === 0}
                        <div class="p-12 text-center bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000] space-y-2 font-mono">
                            <span class="material-symbols-outlined text-3xl text-black/40">inventory_2</span>
                            <p class="text-xs font-black uppercase text-black/70">Aucune pièce ne correspond aux filtres sélectionnés dans cet inventaire.</p>
                        </div>
                    {:else}
                        {#each filteredShopItems as item}
                            <div class="bg-white border-2 border-black p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-[3px_3px_0px_0px_#000]">
                                <div class="flex items-center gap-3.5 flex-1 min-w-0">
                                    <div class="w-16 h-16 border-2 border-black bg-[#EDE9DF] flex-shrink-0 overflow-hidden flex items-center justify-center shadow-[1px_1px_0px_0px_#000]">
                                        {#if getItemImageUrl(item)}
                                            <img 
                                                src={getItemImageUrl(item)} 
                                                alt={item.name} 
                                                class="w-full h-full object-cover"
                                                onerror={(e) => {
                                                    const target = e.currentTarget as HTMLImageElement;
                                                    target.style.display = 'none';
                                                }}
                                            />
                                        {:else}
                                            <span class="material-symbols-outlined text-lg text-black/40">image_not_supported</span>
                                        {/if}
                                    </div>

                                    <div class="min-w-0 space-y-1">
                                        <div class="flex items-center gap-2 flex-wrap">
                                            <span class="font-mono text-[10px] font-bold text-black/50">#{item.id}</span>
                                            {#if item.status === 0}
                                                <span class="retro-badge bg-[#86E2D5] text-black text-[9px] font-black">EN VENTE</span>
                                            {:else if item.status === 2}
                                                <span class="retro-badge bg-[#BFD7FE] text-black text-[9px] font-black">VENDU</span>
                                            {:else}
                                                <span class="retro-badge bg-[#EDE9DF] text-black text-[9px] font-black">INACTIF</span>
                                            {/if}

                                            {#if item.approval_status === 'pending'}
                                                <span class="retro-badge bg-[#FFD166] text-black text-[9px] font-black animate-pulse">EN ATTENTE VALIDATION</span>
                                            {:else if item.approval_status === 'approved'}
                                                <span class="retro-badge bg-[#86E2D5] text-black text-[9px] font-black">APPROUVÉ</span>
                                            {:else if item.approval_status === 'rejected'}
                                                <span class="retro-badge bg-[#FFAEC1] text-black text-[9px] font-black">REJETÉ</span>
                                            {/if}

                                            {#if item.subcategories?.length}
                                                <span class="text-[10px] font-mono text-black/60 bg-[#F6F4EE] px-1 border border-black/20">
                                                    {item.subcategories.map(subcategory => subcategory.name).join(', ')}
                                                </span>
                                            {:else if item.subcategory?.name}
                                                <span class="text-[10px] font-mono text-black/60 bg-[#F6F4EE] px-1 border border-black/20">{item.subcategory.name}</span>
                                            {/if}
                                        </div>

                                        <h4 class="font-black text-sm text-black truncate max-w-md">{item.name}</h4>
                                        <p class="text-xs text-black/70 line-clamp-1 max-w-md">{item.description || "Aucune description"}</p>
                                        {#if item.approval_status === 'rejected' && item.rejection_reason}
                                            <div class="text-[10px] text-[#D90429] font-bold bg-[#FFAEC1]/20 p-1 border border-[#D90429]/30">
                                                Motif du rejet : {item.rejection_reason}
                                            </div>
                                        {/if}
                                    </div>
                                </div>

                                <div class="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-2 md:pt-0 border-black/10">
                                    <div class="text-right font-mono pr-2">
                                        <div class="font-black text-base text-black">{item.price?.toFixed(2)} €</div>
                                        <div class="text-[10px] text-black/50">Qté: {item.quantity || 1}</div>
                                    </div>

                                    <div class="flex items-center gap-1.5 flex-wrap">
                                        <a 
                                            href={`/antiquites/${item.id}`}
                                            target="_blank"
                                            class="retro-btn bg-white hover:bg-[#FFE600] text-[10px] font-black py-1.5 px-2.5 shadow-[1px_1px_0px_0px_#000] flex items-center gap-1"
                                            title="Modifier l'objet"
                                        >
                                            <span class="material-symbols-outlined text-[14px]">edit</span>
                                            <span>Modifier</span>
                                        </a>
                                        <a 
                                            href={`/inventoryt5hr4hr85g48412r/${item.id}`}
                                            target="_blank"
                                            class="retro-btn bg-white hover:bg-[#FFD166] text-[10px] font-black py-1.5 px-2.5 shadow-[1px_1px_0px_0px_#000] flex items-center gap-1"
                                            title="Fiche Inventaire QR Tag"
                                        >
                                            <span class="material-symbols-outlined text-[14px]">qr_code_2</span>
                                            <span>Tag</span>
                                        </a>
                                        {#if item.approval_status !== 'approved'}
                                            <button 
                                                onclick={() => approveItem(item.id)}
                                                disabled={isProcessing}
                                                class="retro-btn bg-[#86E2D5] hover:bg-[#65C4B5] text-[10px] font-black py-1.5 px-2.5 shadow-[1px_1px_0px_0px_#000] flex items-center gap-1 cursor-pointer"
                                            >
                                                <span class="material-symbols-outlined text-[14px]">check</span>
                                                <span>Valider</span>
                                            </button>
                                        {/if}
                                        {#if item.approval_status !== 'rejected'}
                                            <button 
                                                onclick={() => { rejectingItem = item; itemRejectionReason = ""; }}
                                                disabled={isProcessing}
                                                class="retro-btn bg-[#FFAEC1] hover:bg-[#FF8CA4] text-[10px] font-black py-1.5 px-2.5 shadow-[1px_1px_0px_0px_#000] flex items-center gap-1 cursor-pointer"
                                            >
                                                <span class="material-symbols-outlined text-[14px]">close</span>
                                                <span>Rejeter</span>
                                            </button>
                                        {/if}
                                    </div>
                                </div>
                            </div>
                        {/each}
                    {/if}
                </div>
            </div>
        </div>
    {/if}

    <!-- MODAL REJET D'OBJET -->
    {#if rejectingItem}
        <div class="fixed inset-0 z-[99999] bg-black/70 flex items-center justify-center p-4 font-mono">
            <div class="w-full max-w-md bg-[#EDE9DF] border-3 border-black shadow-[8px_8px_0px_0px_#000] p-1">
                <div class="bg-[#2B2D42] text-white px-4 py-2 border-b-2 border-black flex items-center justify-between text-xs font-bold mb-3">
                    <span>REJET DE L'OBJET</span>
                    <button 
                        type="button" 
                        onclick={() => rejectingItem = null}
                        class="w-4 h-4 bg-[#FFAEC1] border border-black text-black text-[9px] flex items-center justify-center font-black"
                    >
                        ✕
                    </button>
                </div>
                <form onsubmit={handleRejectItemSubmit} class="p-6 bg-white border-2 border-black m-1 space-y-4">
                    <div class="space-y-2">
                        <label class="text-xs font-black uppercase text-black" for="item_reason_text">
                            Motif du rejet de l'objet *
                        </label>
                        <textarea 
                            id="item_reason_text" 
                            rows="4" 
                            required
                            bind:value={itemRejectionReason}
                            class="retro-input resize-none text-xs"
                        ></textarea>
                    </div>
                    <div class="flex justify-end gap-3 pt-3 border-t-2 border-black">
                        <button type="button" onclick={() => rejectingItem = null} class="retro-btn bg-white text-xs font-black py-2 px-4">Annuler</button>
                        <button type="submit" disabled={isProcessing} class="retro-btn bg-[#FFAEC1] text-xs font-black py-2 px-6 shadow-[2px_2px_0px_0px_#000]">
                            Confirmer
                        </button>
                    </div>
                </form>
            </div>
        </div>
    {/if}
</div>

<style>
    .edit-shop-field {
        display: grid;
        gap: 0.4rem;
        color: rgba(0, 0, 0, 0.7);
        font-size: 0.7rem;
        font-weight: 800;
        text-transform: uppercase;
    }

    .edit-shop-field input,
    .edit-shop-field select,
    .edit-shop-field textarea {
        width: 100%;
        border: 2px solid #000;
        border-radius: 0;
        background: #fff;
        padding: 0.65rem 0.75rem;
        color: #000;
        font-family: inherit;
        font-size: 0.8rem;
        font-weight: 500;
        text-transform: none;
    }

    .edit-shop-field input:focus,
    .edit-shop-field select:focus,
    .edit-shop-field textarea:focus {
        outline: 3px solid #86e2d5;
        outline-offset: 1px;
    }

    .edit-shop-label {
        color: rgba(0, 0, 0, 0.7);
        font-size: 0.7rem;
        font-weight: 800;
        text-transform: uppercase;
    }
</style>
