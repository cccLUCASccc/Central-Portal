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
        seller_type: string;
        tax_number: string;
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
    }

    let shops = $state<Shop[]>([]);
    let isLoading = $state(true);
    let activeFilter = $state<'pending' | 'approved' | 'rejected' | 'all' | 'pending_items'>('pending');
    let searchQuery = $state("");

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
                    city: editingShop.city,
                    iban: editingShop.iban,
                    bic: editingShop.bic,
                    account_holder: editingShop.account_holder,
                    tax_number: editingShop.tax_number,
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
                alert("Erreur lors de l'approbation.");
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
            const res = await apiFetch(`${PUBLIC_API_URL}/api/shops/${rejectingShop.id}/reject`, {
                method: "PATCH",
                body: JSON.stringify({ reason: rejectionReason })
            });
            if (res.ok) {
                rejectingShop = null;
                rejectionReason = "";
                await fetchShops();
            } else {
                alert("Erreur lors du rejet.");
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

    let filteredShops = $derived(
        shops.filter(s => {
            // Filtre par statut
            if (activeFilter === 'pending') {
                if (s.approval_status !== 'pending' && s.is_approved) return false;
            } else if (activeFilter === 'approved') {
                if (s.approval_status !== 'approved' || !s.is_approved) return false;
            } else if (activeFilter === 'rejected') {
                if (s.approval_status !== 'rejected' && s.approval_status !== 'suspended' && s.is_active) return false;
            } else if (activeFilter === 'pending_items') {
                if (!s.pending_items_count || s.pending_items_count <= 0) return false;
            }

            // Filtre par recherche
            if (searchQuery.trim() !== "") {
                const q = searchQuery.toLowerCase();
                const matchName = s.name?.toLowerCase().includes(q);
                const matchCity = s.city?.toLowerCase().includes(q);
                const matchHolder = s.account_holder?.toLowerCase().includes(q);
                const matchIBAN = s.iban?.toLowerCase().includes(q);
                return matchName || matchCity || matchHolder || matchIBAN;
            }

            return true;
        })
    );

    let pendingCount = $derived(shops.filter(s => s.approval_status === 'pending' || !s.is_approved).length);
    let approvedCount = $derived(shops.filter(s => s.approval_status === 'approved' && s.is_approved).length);
    let rejectedCount = $derived(shops.filter(s => s.approval_status === 'rejected' || s.approval_status === 'suspended').length);
    let pendingItemsShopsCount = $derived(shops.filter(s => s.pending_items_count && s.pending_items_count > 0).length);
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
                Validez les demandes d'ouverture de boutique, vérifiez les coordonnées bancaires (IBAN) pour les reversements et contrôlez les quotas d'annonces.
            </p>
        </div>

        <div class="flex items-center gap-3">
            <div class="bg-white border-2 border-black p-4 shadow-[3px_3px_0px_0px_#000] text-center min-w-[120px]">
                <span class="text-[10px] uppercase font-bold text-black/60 block">En attente</span>
                <span class="text-2xl font-black {pendingCount > 0 ? 'text-[#D1495B] animate-pulse' : 'text-black'}">{pendingCount}</span>
            </div>
            <div class="bg-[#86E2D5] border-2 border-black p-4 shadow-[3px_3px_0px_0px_#000] text-center min-w-[120px]">
                <span class="text-[10px] uppercase font-bold text-black/60 block">Validées</span>
                <span class="text-2xl font-black text-black">{approvedCount}</span>
            </div>
        </div>
    </div>

    <!-- Barre d'actions & Filtres -->
    <div class="bg-white border-3 border-black p-4 shadow-[4px_4px_0px_0px_#000] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        
        <!-- Onglets Filtres -->
        <div class="flex flex-wrap gap-2">
            <button 
                onclick={() => activeFilter = 'pending'}
                class="retro-btn text-xs font-black {activeFilter === 'pending' ? 'bg-[#FFD166] shadow-[2px_2px_0px_0px_#000]' : 'bg-white'} flex items-center gap-1"
            >
                <span class="material-symbols-outlined text-[14px]">hourglass_empty</span>
                <span>En Attente ({pendingCount})</span>
            </button>
            <button 
                onclick={() => activeFilter = 'pending_items'}
                class="retro-btn text-xs font-black {activeFilter === 'pending_items' ? 'bg-[#FFAEC1] shadow-[2px_2px_0px_0px_#000]' : 'bg-white'} flex items-center gap-1.5"
            >
                <span class="w-2 h-2 rounded-full bg-red-600 inline-block animate-pulse"></span>
                <span>Objets à vérifier ({pendingItemsShopsCount})</span>
            </button>
            <button 
                onclick={() => activeFilter = 'approved'}
                class="retro-btn text-xs font-black {activeFilter === 'approved' ? 'bg-[#86E2D5] shadow-[2px_2px_0px_0px_#000]' : 'bg-white'} flex items-center gap-1"
            >
                <span class="material-symbols-outlined text-[14px]">check_circle</span>
                <span>Validées ({approvedCount})</span>
            </button>
            <button 
                onclick={() => activeFilter = 'rejected'}
                class="retro-btn text-xs font-black {activeFilter === 'rejected' ? 'bg-[#FFAEC1] shadow-[2px_2px_0px_0px_#000]' : 'bg-white'} flex items-center gap-1"
            >
                <span class="material-symbols-outlined text-[14px]">warning</span>
                <span>Refusées / Suspendues ({rejectedCount})</span>
            </button>
            <button 
                onclick={() => activeFilter = 'all'}
                class="retro-btn text-xs font-black {activeFilter === 'all' ? 'bg-black text-white shadow-[2px_2px_0px_0px_#000]' : 'bg-white'}"
            >
                Toutes ({shops.length})
            </button>
        </div>

        <!-- Recherche -->
        <div class="relative min-w-[240px]">
            <input 
                type="text" 
                bind:value={searchQuery}
                placeholder="Rechercher nom, ville, IBAN..."
                class="retro-input text-xs w-full pl-8"
            />
            <span class="absolute left-2.5 top-2.5 text-black/40 flex items-center">
                <span class="material-symbols-outlined text-[16px]">search</span>
            </span>
        </div>
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
                <div class="bg-white border-3 border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-6">
                    
                    <!-- Ligne 1 : En-tête Boutique & Statuts -->
                    <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b-2 border-black pb-4">
                        <div class="flex flex-col items-start gap-3">
                            {#if s.pending_items_count && s.pending_items_count > 0}
                                <div class="bg-[#FFAEC1] border-2 border-black shadow-[2px_2px_0px_0px_#000] px-2 py-1 text-[10px] font-black uppercase text-black flex items-center gap-2">
                                    <span class="relative flex h-2 w-2">
                                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                      <span class="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                    </span>
                                    {s.pending_items_count} objet{s.pending_items_count > 1 ? 's' : ''} en attente
                                </div>
                            {/if}
                            <div class="flex items-center gap-4">
                            <div class="w-16 h-16 border-2 border-black bg-[#EDE9DF] overflow-hidden flex-shrink-0 shadow-[2px_2px_0px_0px_#000]">
                                {#if s.avatar_url}
                                    <img src={s.avatar_url} alt={s.name} class="w-full h-full object-cover" />
                                {:else}
                                    <div class="w-full h-full flex items-center justify-center text-xl font-bold">
                                        <span class="material-symbols-outlined text-2xl text-black/40">storefront</span>
                                    </div>
                                {/if}
                            </div>
                            <div>
                                <div class="flex items-center gap-2 flex-wrap">
                                    {#if s.approval_status === 'approved' && s.is_approved}
                                        <span class="retro-badge bg-[#86E2D5] text-black text-[9px] font-black">VALIDÉE</span>
                                    {:else if s.approval_status === 'rejected'}
                                        <span class="retro-badge bg-[#FFAEC1] text-black text-[9px] font-black">REJETÉE</span>
                                    {:else if s.approval_status === 'suspended'}
                                        <span class="retro-badge bg-black text-white text-[9px] font-black">SUSPENDUE</span>
                                    {:else}
                                        <span class="retro-badge bg-[#FFD166] text-black text-[9px] font-black animate-pulse">EN ATTENTE DE VALIDATION</span>
                                    {/if}

                                    <span class="retro-badge bg-[#EDE9DF] text-black text-[9px] font-bold">
                                        {s.seller_type === 'societe' ? 'SOCIÉTÉ' : 'PARTICULIER'}
                                    </span>

                                    <span class="retro-badge bg-[#BFD7FE] text-black text-[9px]">
                                        FORMULE {s.type_abonnement?.toUpperCase()}
                                    </span>
                                </div>

                                <h3 class="text-xl font-black uppercase text-black mt-1">{s.name}</h3>
                                <p class="text-xs text-black/60 flex items-center gap-1 flex-wrap">
                                    <span>Slug: <code class="bg-[#F6F4EE] px-1 border border-black/20">{s.slug}</code></span>
                                    <span>•</span>
                                    <span class="material-symbols-outlined text-[14px]">location_on</span>
                                    <strong>{s.address || (s.street ? `${s.street}, ${s.postal_code} ${s.city} (${s.country || 'BE'})` : s.city || 'Non renseignée')}</strong>
                                </p>
                            </div>
                        </div>
                        </div>

                        <!-- Actions Rapides de Modération -->
                        <div class="flex items-center gap-2 flex-wrap self-end lg:self-center">
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
                            {#if (s.approval_status !== 'approved' || !s.is_approved) && s.approval_status !== 'rejected'}
                                <button 
                                    onclick={() => approveShop(s.id)}
                                    disabled={isProcessing}
                                    class="retro-btn bg-[#86E2D5] hover:bg-[#65C4B5] text-xs font-black py-2 px-4 shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5"
                                >
                                    <span class="material-symbols-outlined text-[16px]">check</span>
                                    <span>Valider la boutique</span>
                                </button>
                            {/if}

                            {#if s.approval_status !== 'rejected'}
                                <button 
                                    onclick={() => { rejectingShop = s; rejectionReason = ""; }}
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

                    <!-- Ligne 2 : Détails Bancaires & Fiscaux -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        <!-- Bloc Coordonnées Bancaires Stripe Connect -->
                        <div class="p-4 bg-[#F6F4EE] border-2 border-black space-y-2">
                            <span class="text-[10px] font-black uppercase text-black/60 flex items-center gap-1">
                                <span class="material-symbols-outlined text-[14px]">credit_card</span>
                                <span>Paiements Stripe Connect</span>
                            </span>
                            <div>
                                <span class="text-black/60 block text-[10px]">Statut Reversements :</span>
                                {#if s.stripe_connect_payouts_enabled}
                                    <span class="retro-badge bg-[#86E2D5] text-black text-[9px] font-black inline-flex items-center gap-1 mt-0.5">
                                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-700"></span> ACTIF & VÉRIFIÉ
                                    </span>
                                {:else if s.stripe_connect_account_id}
                                    <span class="retro-badge bg-[#FFD166] text-black text-[9px] font-black inline-flex items-center gap-1 mt-0.5">
                                        <span class="w-1.5 h-1.5 rounded-full bg-amber-600"></span> ONBOARDING EN ATTENTE
                                    </span>
                                {:else}
                                    <span class="retro-badge bg-[#FFAEC1] text-black text-[9px] font-black inline-flex items-center gap-1 mt-0.5">
                                        <span class="w-1.5 h-1.5 rounded-full bg-neutral-400"></span> NON CONFIGURÉ
                                    </span>
                                {/if}
                            </div>
                            <div>
                                <span class="text-black/60 block text-[10px]">Compte Stripe ID :</span>
                                <code class="font-mono bg-white px-1.5 py-0.5 border border-black block mt-0.5 font-bold text-[10px] truncate">{s.stripe_connect_account_id || 'Aucun compte associé'}</code>
                            </div>
                            <div>
                                <span class="text-black/60 block text-[10px]">Détails validés :</span>
                                <strong class="font-mono text-[10px]">{s.stripe_connect_details_submitted ? 'Soumis' : 'Incomplet'}</strong>
                            </div>
                        </div>

                        <!-- Bloc Juridique & Formule -->
                        <div class="p-4 bg-[#F6F4EE] border-2 border-black space-y-2">
                            <span class="text-[10px] font-black uppercase text-black/60 flex items-center gap-1">
                                <span class="material-symbols-outlined text-[14px]">description</span>
                                <span>Données Administratives</span>
                            </span>
                            <div>
                                <span class="text-black/60 block text-[10px]">Statut Vendeur :</span>
                                <strong class="uppercase">{s.seller_type}</strong>
                            </div>
                            {#if s.seller_type === 'societe'}
                                <div>
                                    <span class="text-black/60 block text-[10px]">N° TVA / Entreprise :</span>
                                    <strong class="font-mono bg-white px-1 border border-black">{s.tax_number || 'Non renseigné'}</strong>
                                </div>
                            {/if}
                            <div>
                                <span class="text-black/60 block text-[10px]">Email :</span>
                                <strong class="text-black text-xs block">{s.email || 'Non trouvé'}</strong>
                            </div>
                            <div>
                                <span class="text-black/60 block text-[10px]">ID Clerk :</span>
                                <code class="text-[10px] text-black/60 truncate block">{s.user_id}</code>
                            </div>
                        </div>

                        <!-- Bloc Activité & Statistiques -->
                        <div class="p-4 bg-[#F6F4EE] border-2 border-black space-y-2">
                            <span class="text-[10px] font-black uppercase text-black/60 flex items-center gap-1">
                                <span class="material-symbols-outlined text-[14px]">bar_chart</span>
                                <span>Activité Catalogue</span>
                            </span>
                            <div class="flex justify-between border-b border-black/10 pb-1">
                                <span class="text-black/60">Annonces actives :</span>
                                <strong class="font-black">{s.active_items_count ?? 0}</strong>
                            </div>
                            <div class="flex justify-between border-b border-black/10 pb-1">
                                <span class="text-black/60">Pièces vendues :</span>
                                <strong class="font-black">{s.sold_items_count ?? 0}</strong>
                            </div>
                            <div class="flex justify-between pt-1">
                                <span class="text-black/60">Date d'inscription :</span>
                                <span class="text-[11px] font-bold">{new Date(s.created_at).toLocaleDateString('fr-FR')}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Motif du rejet (si applicable) -->
                    {#if s.rejection_reason}
                        <div class="p-3 bg-[#FFAEC1] border-2 border-black text-xs space-y-1">
                            <strong class="uppercase block font-black flex items-center gap-1">
                                <span class="material-symbols-outlined text-[14px]">warning</span>
                                <span>Motif du refus communiqué au vendeur :</span>
                            </strong>
                            <p class="text-black/90">{s.rejection_reason}</p>
                        </div>
                    {/if}

                    <!-- Description de la boutique -->
                    {#if s.description}
                        <div class="text-xs text-black/75 bg-white border border-black/20 p-3 italic">
                            "{s.description}"
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}

    <!-- MODAL DE REJET AVEC MOTIF -->
    {#if rejectingShop}
        <div class="fixed inset-0 z-[99999] bg-black/70 flex items-center justify-center p-4 font-mono">
            <div class="w-full max-w-lg bg-[#EDE9DF] border-3 border-black shadow-[8px_8px_0px_0px_#000] p-1">
                <div class="bg-[#2B2D42] text-white px-4 py-2 border-b-2 border-black flex items-center justify-between text-xs font-bold mb-3">
                    <span>REJET DE LA BOUTIQUE // {rejectingShop.name}</span>
                    <button 
                        type="button" 
                        onclick={() => rejectingShop = null}
                        class="w-4 h-4 bg-[#FFAEC1] border border-black text-black text-[9px] flex items-center justify-center font-black"
                    >
                        ✕
                    </button>
                </div>

                <form onsubmit={handleRejectSubmit} class="p-6 bg-white border-2 border-black m-1 space-y-4">
                    <div class="space-y-2">
                        <label class="text-xs font-black uppercase text-black" for="reason_text">
                            Motif du rejet (transmis au vendeur) *
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
                            {isProcessing ? "Traitement..." : "Confirmer le Rejet"}
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

                                            {#if item.subcategory?.name}
                                                <span class="text-[10px] font-mono text-black/60 bg-[#F6F4EE] px-1 border border-black/20">
                                                    {item.subcategory.name}
                                                </span>
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

