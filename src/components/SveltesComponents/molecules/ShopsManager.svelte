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
        city: string;
        seller_type: string;
        tax_number: string;
        iban: string;
        bic: string;
        account_holder: string;
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

    // Modal gestion des objets
    let viewingShopItems = $state<Shop | null>(null);
    let shopItems = $state<any[]>([]);
    let isLoadingItems = $state(false);
    let rejectingItem = $state<any | null>(null);
    let itemRejectionReason = $state("");

    async function viewShopItems(shop: Shop) {
        viewingShopItems = shop;
        isLoadingItems = true;
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
                class="retro-btn text-xs font-black {activeFilter === 'pending' ? 'bg-[#FFD166] shadow-[2px_2px_0px_0px_#000]' : 'bg-white'}"
            >
                ⏳ En Attente ({pendingCount})
            </button>
            <button 
                onclick={() => activeFilter = 'pending_items'}
                class="retro-btn text-xs font-black {activeFilter === 'pending_items' ? 'bg-[#FFAEC1] shadow-[2px_2px_0px_0px_#000]' : 'bg-white'}"
            >
                🔴 Objets à vérifier ({pendingItemsShopsCount})
            </button>
            <button 
                onclick={() => activeFilter = 'approved'}
                class="retro-btn text-xs font-black {activeFilter === 'approved' ? 'bg-[#86E2D5] shadow-[2px_2px_0px_0px_#000]' : 'bg-white'}"
            >
                ✅ Validées ({approvedCount})
            </button>
            <button 
                onclick={() => activeFilter = 'rejected'}
                class="retro-btn text-xs font-black {activeFilter === 'rejected' ? 'bg-[#FFAEC1] shadow-[2px_2px_0px_0px_#000]' : 'bg-white'}"
            >
                ⚠️ Refusées / Suspendues ({rejectedCount})
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
            <span class="absolute left-2.5 top-2.5 text-xs text-black/40">🔍</span>
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
            <span class="text-3xl block">🏪</span>
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
                                    <div class="w-full h-full flex items-center justify-center text-xl font-bold">🏪</div>
                                {/if}
                            </div>
                            <div>
                                <div class="flex items-center gap-2 flex-wrap">
                                    {#if s.approval_status === 'approved' && s.is_approved}
                                        <span class="retro-badge bg-[#86E2D5] text-black text-[9px] font-black">● VALIDÉE</span>
                                    {:else if s.approval_status === 'rejected'}
                                        <span class="retro-badge bg-[#FFAEC1] text-black text-[9px] font-black">✕ REJETÉE</span>
                                    {:else if s.approval_status === 'suspended'}
                                        <span class="retro-badge bg-black text-white text-[9px] font-black">⏸️ SUSPENDUE</span>
                                    {:else}
                                        <span class="retro-badge bg-[#FFD166] text-black text-[9px] font-black animate-pulse">⏳ EN ATTENTE DE VALIDATION</span>
                                    {/if}

                                    <span class="retro-badge bg-[#EDE9DF] text-black text-[9px]">
                                        {s.seller_type === 'societe' ? '🏢 SOCIÉTÉ' : '👤 PARTICULIER'}
                                    </span>

                                    <span class="retro-badge bg-[#BFD7FE] text-black text-[9px]">
                                        FORMULE {s.type_abonnement?.toUpperCase()}
                                    </span>
                                </div>

                                <h3 class="text-xl font-black uppercase text-black mt-1">{s.name}</h3>
                                <p class="text-xs text-black/60">
                                    Slug: <code class="bg-[#F6F4EE] px-1 border border-black/20">{s.slug}</code> • Ville : <strong>{s.city || 'Non renseignée'}</strong>
                                </p>
                            </div>
                        </div>
                        </div>

                        <!-- Actions Rapides de Modération -->
                        <div class="flex items-center gap-2 flex-wrap self-end lg:self-center">
                            <button 
                                onclick={() => editingShop = JSON.parse(JSON.stringify(s))}
                                class="retro-btn bg-[#FFD166] hover:bg-[#F0C055] text-xs font-black py-2 px-3 shadow-[2px_2px_0px_0px_#000]"
                            >
                                ✏️ Modifier
                            </button>
                            <button 
                                onclick={() => viewShopItems(s)}
                                class="retro-btn bg-[#BFD7FE] hover:bg-[#A3C4FD] text-xs font-black py-2 px-3 shadow-[2px_2px_0px_0px_#000]"
                            >
                                📦 Gérer les objets
                            </button>
                            {#if (s.approval_status !== 'approved' || !s.is_approved) && s.approval_status !== 'rejected'}
                                <button 
                                    onclick={() => approveShop(s.id)}
                                    disabled={isProcessing}
                                    class="retro-btn bg-[#86E2D5] hover:bg-[#65C4B5] text-xs font-black py-2 px-4 shadow-[2px_2px_0px_0px_#000]"
                                >
                                    ✅ Valider la boutique
                                </button>
                            {/if}

                            {#if s.approval_status !== 'rejected'}
                                <button 
                                    onclick={() => { rejectingShop = s; rejectionReason = ""; }}
                                    disabled={isProcessing}
                                    class="retro-btn bg-[#FFAEC1] hover:bg-[#FF8CA4] text-xs font-black py-2 px-4 shadow-[2px_2px_0px_0px_#000]"
                                >
                                    ❌ Rejeter
                                </button>
                            {/if}

                            {#if s.approval_status === 'approved' && s.is_active}
                                <button 
                                    onclick={() => suspendShop(s.id)}
                                    disabled={isProcessing}
                                    class="retro-btn bg-white hover:bg-[#EDE9DF] text-xs font-black py-2 px-3 shadow-[2px_2px_0px_0px_#000]"
                                >
                                    ⏸️ Suspendre
                                </button>
                            {/if}
                        </div>
                    </div>

                    <!-- Ligne 2 : Détails Bancaires & Fiscaux -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        <!-- Bloc Coordonnées Bancaires -->
                        <div class="p-4 bg-[#F6F4EE] border-2 border-black space-y-2">
                            <span class="text-[10px] font-black uppercase text-black/60 block">💳 Coordonnées Bancaires (Reversements)</span>
                            <div>
                                <span class="text-black/60 block text-[10px]">Titulaire :</span>
                                <strong class="text-black">{s.account_holder || 'Non renseigné'}</strong>
                            </div>
                            <div>
                                <span class="text-black/60 block text-[10px]">IBAN :</span>
                                <code class="font-mono bg-white px-1.5 py-0.5 border border-black block mt-0.5 font-bold">{s.iban || 'Non renseigné'}</code>
                            </div>
                            <div>
                                <span class="text-black/60 block text-[10px]">BIC / SWIFT :</span>
                                <strong class="font-mono">{s.bic || '--'}</strong>
                            </div>
                        </div>

                        <!-- Bloc Juridique & Formule -->
                        <div class="p-4 bg-[#F6F4EE] border-2 border-black space-y-2">
                            <span class="text-[10px] font-black uppercase text-black/60 block">📜 Données Administratives</span>
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
                                <span class="text-black/60 block text-[10px]">Identifiant Utilisateur Clerk :</span>
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
                            <span class="text-[10px] font-black uppercase text-black/60 block">📊 Activité Catalogue</span>
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
                            <strong class="uppercase block font-black">⚠️ Motif du refus communiqué au vendeur :</strong>
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


    <!-- MODAL GESTION DES OBJETS -->
    {#if viewingShopItems}
        <div class="fixed inset-0 z-[99990] bg-black/70 flex items-center justify-center p-4 font-sans">
            <div class="w-full max-w-4xl max-h-[90vh] bg-[#EDE9DF] border-3 border-black shadow-[8px_8px_0px_0px_#000] flex flex-col">
                <div class="bg-[#2B2D42] text-white px-4 py-3 border-b-2 border-black flex items-center justify-between font-black">
                    <span>📦 OBJETS // {viewingShopItems.name}</span>
                    <button 
                        type="button" 
                        onclick={() => viewingShopItems = null}
                        class="w-6 h-6 bg-[#FFAEC1] border-2 border-black text-black text-xs flex items-center justify-center font-black"
                    >
                        ✕
                    </button>
                </div>

                <div class="p-4 overflow-y-auto flex-1 space-y-4 bg-[#F6F4EE]">
                    {#if isLoadingItems}
                        <div class="text-center font-bold text-black/60 p-10">Chargement des objets...</div>
                    {:else if shopItems.length === 0}
                        <div class="text-center font-bold text-black/60 p-10">Aucun objet trouvé pour cette boutique.</div>
                    {:else}
                        {#each shopItems as item}
                            <div class="bg-white border-2 border-black p-4 flex flex-col md:flex-row gap-4 shadow-[4px_4px_0px_0px_#000]">
                                <div class="w-24 h-24 border-2 border-black bg-gray-100 flex-shrink-0">
                                    {#if item.images && item.images.length > 0}
                                        <img src={item.images[0].url} alt={item.name} class="w-full h-full object-cover"/>
                                    {/if}
                                </div>
                                <div class="flex-1 space-y-2">
                                    <div class="flex justify-between items-start">
                                        <h4 class="font-black text-lg">{item.name}</h4>
                                        <span class="font-black border-2 border-black px-2 py-1 bg-[#FFD166]">{item.price} €</span>
                                    </div>
                                    <p class="text-xs line-clamp-2">{item.description}</p>
                                    
                                    <div class="flex items-center gap-2 text-[10px] font-bold">
                                        Statut: 
                                        {#if item.approval_status === 'pending'}
                                            <span class="bg-[#FFD166] border border-black px-1.5 py-0.5">EN ATTENTE</span>
                                        {:else if item.approval_status === 'approved'}
                                            <span class="bg-[#86E2D5] border border-black px-1.5 py-0.5">APPROUVÉ</span>
                                        {:else if item.approval_status === 'rejected'}
                                            <span class="bg-[#FFAEC1] border border-black px-1.5 py-0.5">REJETÉ</span>
                                        {/if}
                                    </div>
                                    {#if item.approval_status === 'rejected' && item.rejection_reason}
                                        <p class="text-[10px] text-red-600 font-bold bg-red-50 p-1 border border-red-200">Motif: {item.rejection_reason}</p>
                                    {/if}
                                </div>
                                <div class="flex flex-col gap-2 justify-center">

                                    <a 
                                        href={`/antiquites/${item.id}`}
                                        class="retro-btn bg-white hover:bg-[#FFE600] text-[10px] font-black py-1.5 px-3 shadow-[2px_2px_0px_0px_#000] whitespace-nowrap text-center block mb-1"
                                    >
                                        ✏️ Modifier
                                    </a>\n                                    {#if item.approval_status !== 'approved'}
                                        <button 
                                            onclick={() => approveItem(item.id)}
                                            disabled={isProcessing}
                                            class="retro-btn bg-[#86E2D5] hover:bg-[#65C4B5] text-[10px] font-black py-1.5 px-3 shadow-[2px_2px_0px_0px_#000] whitespace-nowrap"
                                        >
                                            ✅ Approuver
                                        </button>
                                    {/if}
                                    {#if item.approval_status !== 'rejected'}
                                        <button 
                                            onclick={() => { rejectingItem = item; itemRejectionReason = ""; }}
                                            disabled={isProcessing}
                                            class="retro-btn bg-[#FFAEC1] hover:bg-[#FF8CA4] text-[10px] font-black py-1.5 px-3 shadow-[2px_2px_0px_0px_#000] whitespace-nowrap"
                                        >
                                            ❌ Rejeter
                                        </button>
                                    {/if}
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

