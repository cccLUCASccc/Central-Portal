<script lang="ts">
    import { onMount } from "svelte";
    import { apiFetch } from "../../../lib/api";

    interface OrderItem {
        id: number;
        order_id: number;
        article_id: number;
        article?: {
            id: number;
            name: string;
            price: number;
            images?: { url: string }[];
        };
        shop_id?: number;
        shop?: {
            id: number;
            name: string;
            city?: string;
            user_id?: string;
        };
        price: number;
        shipping_status: string;
        shipping_label_url?: string;
        packaging_photos?: string;
        tracking_number?: string;
        tracking_url?: string;
        shipping_proof_url?: string;
        shipped_at?: string;
        buyer_confirmed: boolean;
        delivered_at?: string;
        buyer_notes?: string;
        created_at: string;
    }

    interface Order {
        id: number;
        order_number: string;
        buyer_id: string;
        buyer_email: string;
        buyer_name: string;
        buyer_phone?: string;
        shipping_address: string;
        shipping_city: string;
        shipping_postal: string;
        shipping_country: string;
        total_amount: number;
        delivery_price: number;
        delivery_provider: string;
        status: string;
        created_at: string;
        items: OrderItem[];
    }

    let orders = $state<Order[]>([]);
    let isLoading = $state(true);
    let searchQuery = $state("");
    let activeFilter = $state<'all' | 'preparation' | 'shipped' | 'delivered' | 'late' | 'cancelled'>('all');

    // Modale de détail
    let selectedOrder = $state<Order | null>(null);
    let isUpdatingStatus = $state(false);
    let previewPhotos = $state<string[] | null>(null);

    const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;

    async function fetchOrders() {
        isLoading = true;
        try {
            const res = await apiFetch(`${PUBLIC_API_URL}/api/orders`);
            if (res.ok) {
                orders = await res.json();
            } else {
                console.error("Erreur récupération commandes:", res.status);
            }
        } catch (e) {
            console.error("Erreur fetchOrders:", e);
        } finally {
            isLoading = false;
        }
    }

    onMount(() => {
        fetchOrders();
    });

    function getElapsedDays(dateStr: string): number {
        const created = new Date(dateStr).getTime();
        return Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24));
    }

    function isOrderLate(order: Order): boolean {
        const days = getElapsedDays(order.created_at);
        if (days < 4) return false;
        return order.items.some(it => it.shipping_status === 'preparation');
    }

    // Statistiques rapides
    let totalOrders = $derived(orders.length);
    let lateOrdersCount = $derived(orders.filter(o => isOrderLate(o)).length);
    let prepOrdersCount = $derived(orders.filter(o => o.items.some(it => it.shipping_status === 'preparation')).length);
    let shippedOrdersCount = $derived(orders.filter(o => o.items.every(it => it.shipping_status === 'shipped')).length);
    let deliveredOrdersCount = $derived(orders.filter(o => o.items.every(it => it.shipping_status === 'delivered' || it.buyer_confirmed)).length);

    // Filtrage
    let filteredOrders = $derived(orders.filter(order => {
        // Filtre texte
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchNumber = order.order_number?.toLowerCase().includes(q);
            const matchBuyer = order.buyer_name?.toLowerCase().includes(q) || order.buyer_email?.toLowerCase().includes(q);
            const matchShop = order.items.some(it => it.shop?.name?.toLowerCase().includes(q));
            const matchArticle = order.items.some(it => it.article?.name?.toLowerCase().includes(q));
            if (!matchNumber && !matchBuyer && !matchShop && !matchArticle) return false;
        }

        // Filtre onglet
        if (activeFilter === 'late') return isOrderLate(order);
        if (activeFilter === 'cancelled') return order.status === 'cancelled' || order.items.some(it => it.shipping_status === 'cancelled');
        if (activeFilter === 'preparation') return order.items.some(it => it.shipping_status === 'preparation');
        if (activeFilter === 'shipped') return order.items.some(it => it.shipping_status === 'shipped');
        if (activeFilter === 'delivered') return order.items.every(it => it.shipping_status === 'delivered' || it.buyer_confirmed);

        return true;
    }));

    async function updateItemStatus(itemId: number, newStatus: string) {
        isUpdatingStatus = true;
        try {
            const res = await apiFetch(`${PUBLIC_API_URL}/api/orders/items/${itemId}/status`, {
                method: "PATCH",
                body: JSON.stringify({ shipping_status: newStatus })
            });
            if (res.ok) {
                await fetchOrders();
                if (selectedOrder) {
                    const refreshed = orders.find(o => o.id === selectedOrder!.id);
                    if (refreshed) selectedOrder = refreshed;
                }
            } else {
                alert("Erreur lors de la mise à jour du statut");
            }
        } catch (e) {
            alert("Erreur de connexion");
        } finally {
            isUpdatingStatus = false;
        }
    }
</script>

<div class="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
    <!-- EN-TÊTE DE LA PAGE -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-3 border-black pb-4">
        <div>
            <div class="flex items-center gap-2">
                <span class="w-7 h-7 bg-black text-white flex items-center justify-center text-xs font-black">CMD</span>
                <h1 class="text-2xl font-serif font-black uppercase text-black tracking-tight">Supervision des Commandes</h1>
            </div>
            <p class="text-xs font-mono font-bold text-black/70 mt-1">
                Suivi logistique en temps réel de toutes les ventes de la plateforme Daisy Brocante.
            </p>
        </div>

        <button 
            type="button" 
            onclick={fetchOrders}
            class="retro-btn bg-[#FFD166] hover:bg-[#f3be4b] py-2 px-4 text-xs font-black flex items-center gap-2 shadow-[2px_2px_0px_0px_#000] cursor-pointer self-start sm:self-auto"
        >
            <span class="material-symbols-outlined text-sm {isLoading ? 'animate-spin' : ''}">refresh</span>
            <span>Actualiser</span>
        </button>
    </div>

    <!-- BANNIÈRE D'ALERTE COMMANDES EN RETARD -->
    {#if lateOrdersCount > 0}
        <div class="p-4 bg-[#FFAEC1] border-3 border-black shadow-[4px_4px_0px_0px_#000] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-pulse">
            <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-2xl text-black">warning</span>
                <div>
                    <h3 class="text-sm font-serif font-black uppercase text-black">
                        {lateOrdersCount} commande(s) en retard d'expédition (> 4 jours) !
                    </h3>
                    <p class="text-xs font-bold text-black/80">
                        Ces commandes n'ont pas encore été expédiées par les vendeurs. Cliquez pour filtrer et contacter les vendeurs concernés.
                    </p>
                </div>
            </div>
            <button 
                type="button"
                onclick={() => activeFilter = 'late'}
                class="retro-btn bg-black text-white hover:bg-black/80 text-xs font-black py-1.5 px-3 uppercase tracking-wider shadow-[2px_2px_0px_0px_#fff]"
            >
                Voir les retards
            </button>
        </div>
    {/if}

    <!-- BARRE DE STATISTIQUES RAPIDES -->
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div class="p-3 bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            <span class="text-[10px] font-mono font-black uppercase text-black/60 block">Total Commandes</span>
            <span class="text-xl font-mono font-black text-black">{totalOrders}</span>
        </div>
        <div class="p-3 bg-[#FFD166]/30 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            <span class="text-[10px] font-mono font-black uppercase text-black/60 block">À Préparer</span>
            <span class="text-xl font-mono font-black text-black">{prepOrdersCount}</span>
        </div>
        <div class="p-3 bg-[#FFAEC1]/40 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            <span class="text-[10px] font-mono font-black uppercase text-[#D90429] block">En Retard (&gt;4j)</span>
            <span class="text-xl font-mono font-black text-[#D90429]">{lateOrdersCount}</span>
        </div>
        <div class="p-3 bg-[#BFD7FE]/30 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            <span class="text-[10px] font-mono font-black uppercase text-black/60 block">Expédiées</span>
            <span class="text-xl font-mono font-black text-black">{shippedOrdersCount}</span>
        </div>
        <div class="p-3 bg-[#86E2D5]/30 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            <span class="text-[10px] font-mono font-black uppercase text-black/60 block">Livrées</span>
            <span class="text-xl font-mono font-black text-black">{deliveredOrdersCount}</span>
        </div>
    </div>

    <!-- FILTRES & RECHERCHE -->
    <div class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex flex-wrap items-center gap-1.5">
                <button 
                    type="button" 
                    onclick={() => activeFilter = 'all'} 
                    class="retro-btn py-1 px-3 text-xs font-black shadow-[2px_2px_0px_0px_#000] {activeFilter === 'all' ? 'bg-black text-white' : 'bg-white text-black'}"
                >
                    Toutes ({orders.length})
                </button>
                <button 
                    type="button" 
                    onclick={() => activeFilter = 'late'} 
                    class="retro-btn py-1 px-3 text-xs font-black shadow-[2px_2px_0px_0px_#000] {activeFilter === 'late' ? 'bg-[#FFAEC1] text-black ring-2 ring-black font-black' : 'bg-white text-black'}"
                >
                    ⚠️ En retard ({lateOrdersCount})
                </button>
                <button 
                    type="button" 
                    onclick={() => activeFilter = 'preparation'} 
                    class="retro-btn py-1 px-3 text-xs font-black shadow-[2px_2px_0px_0px_#000] {activeFilter === 'preparation' ? 'bg-[#FFD166] text-black font-black' : 'bg-white text-black'}"
                >
                    À préparer
                </button>
                <button 
                    type="button" 
                    onclick={() => activeFilter = 'shipped'} 
                    class="retro-btn py-1 px-3 text-xs font-black shadow-[2px_2px_0px_0px_#000] {activeFilter === 'shipped' ? 'bg-[#BFD7FE] text-black font-black' : 'bg-white text-black'}"
                >
                    Expédiées
                </button>
                <button 
                    type="button" 
                    onclick={() => activeFilter = 'delivered'} 
                    class="retro-btn py-1 px-3 text-xs font-black shadow-[2px_2px_0px_0px_#000] {activeFilter === 'delivered' ? 'bg-[#86E2D5] text-black font-black' : 'bg-white text-black'}"
                >
                    Livrées
                </button>
                <button 
                    type="button" 
                    onclick={() => activeFilter = 'cancelled'} 
                    class="retro-btn py-1 px-3 text-xs font-black shadow-[2px_2px_0px_0px_#000] {activeFilter === 'cancelled' ? 'bg-[#FFAEC1] text-black' : 'bg-white text-black'}"
                >
                    Annulées
                </button>
            </div>

            <!-- Champ de recherche -->
            <div class="relative w-full sm:w-72">
                <input 
                    type="text" 
                    bind:value={searchQuery}
                    placeholder="N° commande, acheteur, boutique..."
                    class="w-full bg-white border-2 border-black px-3 py-1.5 text-xs font-mono font-bold shadow-[2px_2px_0px_0px_#000] outline-none"
                />
            </div>
        </div>
    </div>

    <!-- TABLEAU DES COMMANDES -->
    {#if isLoading}
        <div class="p-12 text-center bg-white border-2 border-black shadow-[3px_3px_0px_0px_#000] space-y-2 font-mono">
            <span class="material-symbols-outlined text-3xl animate-spin">progress_activity</span>
            <p class="text-xs font-black uppercase">Chargement des commandes en cours...</p>
        </div>
    {:else if filteredOrders.length === 0}
        <div class="p-12 text-center bg-white border-2 border-black shadow-[3px_3px_0px_0px_#000] space-y-2">
            <span class="material-symbols-outlined text-3xl text-black/50">inbox</span>
            <p class="text-xs font-black uppercase text-black/70">Aucune commande ne correspond aux filtres sélectionnés.</p>
        </div>
    {:else}
        <div class="overflow-x-auto border-2 border-black shadow-[4px_4px_0px_0px_#000] bg-white">
            <table class="w-full text-left border-collapse text-xs font-sans">
                <thead>
                    <tr class="bg-[#EDE9DF] border-b-2 border-black font-mono font-black uppercase text-[11px]">
                        <th class="p-3 border-r border-black">Commande</th>
                        <th class="p-3 border-r border-black">Date</th>
                        <th class="p-3 border-r border-black">Acheteur</th>
                        <th class="p-3 border-r border-black">Boutique Vendeuse</th>
                        <th class="p-3 border-r border-black">Article & Prix</th>
                        <th class="p-3 border-r border-black">Transport</th>
                        <th class="p-3 border-r border-black text-center">Statut Logistique</th>
                        <th class="p-3 text-center">Actions</th>
                    </tr>
                </thead>
                <tbody class="divide-y border-black font-medium">
                    {#each filteredOrders as order (order.id)}
                        {@const late = isOrderLate(order)}
                        {@const days = getElapsedDays(order.created_at)}
                        {#each order.items as item, itemIndex}
                            <tr class="hover:bg-[#FBF8EE] transition-colors {late ? 'bg-[#FFF0F3]' : ''}">
                                {#if itemIndex === 0}
                                    <td rowspan={order.items.length} class="p-3 border-r border-black font-mono font-black align-top bg-white/50">
                                        <div class="space-y-1">
                                            <span class="retro-badge bg-black text-white text-[10px] font-black uppercase block text-center">
                                                {order.order_number}
                                            </span>
                                            <span class="text-[10px] text-black/60 block text-center font-bold">
                                                Total: {order.total_amount?.toFixed(2)} €
                                            </span>
                                            {#if late}
                                                <span class="retro-badge bg-[#E63946] text-white text-[9px] font-black uppercase block text-center mt-1 animate-pulse">
                                                    RETARD ({days}j)
                                                </span>
                                            {/if}
                                        </div>
                                    </td>
                                    <td rowspan={order.items.length} class="p-3 border-r border-black font-mono text-[11px] align-top bg-white/50">
                                        <div>{new Date(order.created_at).toLocaleDateString('fr-FR')}</div>
                                        <div class="text-[10px] text-black/50">{new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                                        <div class="text-[9px] font-bold text-black/70 mt-1">il y a {days} jour(s)</div>
                                    </td>
                                    <td rowspan={order.items.length} class="p-3 border-r border-black align-top bg-white/50">
                                        <div class="font-black text-black">{order.buyer_name || "Acheteur"}</div>
                                        <div class="text-[10px] text-black/70 font-mono truncate max-w-[150px]">{order.buyer_email}</div>
                                        <div class="text-[10px] text-black/60 mt-0.5">{order.shipping_city} ({order.shipping_country || 'FR'})</div>
                                    </td>
                                {/if}

                                <!-- Info Boutique -->
                                <td class="p-3 border-r border-black">
                                    <div class="font-bold text-black">{item.shop?.name || "Boutique N/A"}</div>
                                    <div class="text-[10px] text-black/60 font-mono">{item.shop?.city || "Ville non renseignée"}</div>
                                </td>

                                <!-- Article & Prix -->
                                <td class="p-3 border-r border-black">
                                    <div class="flex items-center gap-2">
                                        {#if item.article?.images?.[0]?.url}
                                            <img 
                                                src={item.article.images[0].url} 
                                                alt={item.article?.name} 
                                                class="w-9 h-9 object-cover border border-black flex-shrink-0"
                                            />
                                        {/if}
                                        <div class="min-w-0">
                                            <div class="font-black text-black truncate max-w-[180px]">{item.article?.name || "Objet"}</div>
                                            <div class="text-[10px] font-mono font-bold text-black/80">{item.price?.toFixed(2)} €</div>
                                        </div>
                                    </div>
                                </td>

                                <!-- Transporteur -->
                                <td class="p-3 border-r border-black">
                                    <div class="font-black text-xs">{order.delivery_provider || "Standard"}</div>
                                    <div class="text-[10px] font-mono text-black/60">Frais: {order.delivery_price?.toFixed(2)} €</div>
                                </td>

                                <!-- Statut Logistique 3 Étapes -->
                                <td class="p-3 border-r border-black text-center">
                                    {#if item.shipping_status === 'cancelled'}
                                        <span class="retro-badge bg-[#E63946] text-white text-[9px] font-black uppercase">
                                            Annulée
                                        </span>
                                    {:else if item.shipping_status === 'delivered' || item.buyer_confirmed}
                                        <span class="retro-badge bg-[#86E2D5] text-black text-[9px] font-black uppercase flex items-center justify-center gap-1">
                                            <span class="material-symbols-outlined text-[12px]">check_circle</span>
                                            <span>Livrée</span>
                                        </span>
                                    {:else if item.shipping_status === 'shipped'}
                                        <span class="retro-badge bg-[#BFD7FE] text-black text-[9px] font-black uppercase flex items-center justify-center gap-1">
                                            <span class="material-symbols-outlined text-[12px]">local_shipping</span>
                                            <span>Expédiée</span>
                                        </span>
                                        {#if item.tracking_number}
                                            <span class="text-[9px] font-mono block mt-0.5 text-black/70">N° {item.tracking_number}</span>
                                        {/if}
                                    {:else}
                                        <span class="retro-badge bg-[#FFD166] text-black text-[9px] font-black uppercase flex items-center justify-center gap-1">
                                            <span class="material-symbols-outlined text-[12px]">inventory_2</span>
                                            <span>À Préparer</span>
                                        </span>
                                        {#if late}
                                            <span class="text-[9px] font-black text-[#D90429] block mt-0.5">En retard</span>
                                        {/if}
                                    {/if}
                                </td>

                                <!-- Actions -->
                                <td class="p-3 text-center">
                                    <button 
                                        type="button" 
                                        onclick={() => selectedOrder = order}
                                        class="retro-btn bg-white hover:bg-[#FFD166] py-1 px-2.5 text-[10px] font-black border border-black shadow-[1px_1px_0px_0px_#000] cursor-pointer"
                                    >
                                        Détails
                                    </button>
                                </td>
                            </tr>
                        {/each}
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}
</div>

<!-- MODALE DÉTAIL COMMANDE -->
{#if selectedOrder}
    {@const late = isOrderLate(selectedOrder)}
    {@const days = getElapsedDays(selectedOrder.created_at)}
    <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
        <div class="bg-[#FBF8EE] border-3 border-black shadow-[8px_8px_0px_0px_#000] w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-6">
            <!-- En-tête modale -->
            <div class="flex items-center justify-between border-b-2 border-black pb-3">
                <div class="flex items-center gap-2">
                    <span class="retro-badge bg-black text-white text-xs font-black uppercase">
                        {selectedOrder.order_number}
                    </span>
                    <span class="text-xs font-bold text-black">
                        Passée le {new Date(selectedOrder.created_at).toLocaleDateString('fr-FR')} (il y a {days}j)
                    </span>
                    {#if late}
                        <span class="retro-badge bg-[#E63946] text-white text-[9px] font-black uppercase animate-pulse">
                            EXPÉDITION EN RETARD
                        </span>
                    {/if}
                </div>
                <button 
                    type="button" 
                    onclick={() => selectedOrder = null}
                    class="w-7 h-7 bg-white border-2 border-black flex items-center justify-center font-black hover:bg-[#FFAEC1] cursor-pointer"
                >
                    ✕
                </button>
            </div>

            <!-- Destinataire & Livraison -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="p-3 bg-white border-2 border-black text-xs space-y-1 shadow-[2px_2px_0px_0px_#000]">
                    <span class="text-[10px] font-black uppercase text-black/60 block">Acheteur & Coordonnées :</span>
                    <div class="font-black text-sm text-black">{selectedOrder.buyer_name}</div>
                    <div class="font-mono text-black/80">{selectedOrder.buyer_email}</div>
                    {#if selectedOrder.buyer_phone}
                        <div class="font-mono text-black/80">Tél : {selectedOrder.buyer_phone}</div>
                    {/if}
                    <div class="text-black/80 pt-1 border-t border-black/10">
                        {selectedOrder.shipping_address}<br/>
                        {selectedOrder.shipping_postal} {selectedOrder.shipping_city}, {selectedOrder.shipping_country}
                    </div>
                </div>

                <div class="p-3 bg-white border-2 border-black text-xs space-y-1 shadow-[2px_2px_0px_0px_#000]">
                    <span class="text-[10px] font-black uppercase text-black/60 block">Informations Financières :</span>
                    <div class="flex justify-between py-0.5">
                        <span class="text-black/70 font-bold">Total Articles :</span>
                        <span class="font-mono font-black text-black">{(selectedOrder.total_amount - selectedOrder.delivery_price).toFixed(2)} €</span>
                    </div>
                    <div class="flex justify-between py-0.5">
                        <span class="text-black/70 font-bold">Frais de port ({selectedOrder.delivery_provider}) :</span>
                        <span class="font-mono font-black text-black">{selectedOrder.delivery_price.toFixed(2)} €</span>
                    </div>
                    <div class="flex justify-between py-1 border-t-2 border-black font-black text-sm">
                        <span>Total Payé :</span>
                        <span class="font-mono">{selectedOrder.total_amount.toFixed(2)} €</span>
                    </div>
                </div>
            </div>

            <!-- Articles de la commande -->
            <div class="space-y-3">
                <h4 class="text-xs font-black uppercase text-black tracking-wider">Articles & Suivi Logistique</h4>
                {#each selectedOrder.items as item}
                    <div class="p-4 bg-white border-2 border-black shadow-[3px_3px_0px_0px_#000] space-y-3">
                        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-black/20 pb-2">
                            <div class="flex items-center gap-3">
                                {#if item.article?.images?.[0]?.url}
                                    <img src={item.article.images[0].url} alt={item.article?.name} class="w-12 h-12 object-cover border border-black" />
                                {/if}
                                <div>
                                    <h5 class="font-black text-sm text-black">{item.article?.name || "Objet"}</h5>
                                    <div class="text-xs font-mono font-bold text-black/70">
                                        Boutique : <strong>{item.shop?.name}</strong> &bull; Prix : <strong>{item.price?.toFixed(2)} €</strong>
                                    </div>
                                </div>
                            </div>

                            <!-- Statut actuel -->
                            <div>
                                {#if item.shipping_status === 'delivered' || item.buyer_confirmed}
                                    <span class="retro-badge bg-[#86E2D5] text-black text-[10px] font-black uppercase">Livré</span>
                                {:else if item.shipping_status === 'shipped'}
                                    <span class="retro-badge bg-[#BFD7FE] text-black text-[10px] font-black uppercase">Expédié</span>
                                {:else}
                                    <span class="retro-badge bg-[#FFD166] text-black text-[10px] font-black uppercase">En Préparation</span>
                                {/if}
                            </div>
                        </div>

                        <!-- Preuves & Tracking -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <!-- Preuves d'emballage du vendeur -->
                            <div class="p-2.5 bg-[#FBF8EE] border border-black space-y-1">
                                <span class="font-bold text-[10px] uppercase text-black/70 block">Photos d'emballage colis :</span>
                                {#if item.packaging_photos}
                                    {@const photos = item.packaging_photos.split(',')}
                                    <div class="flex items-center gap-2">
                                        <button 
                                            type="button" 
                                            onclick={() => previewPhotos = photos}
                                            class="retro-btn bg-[#86E2D5] text-[10px] font-black py-1 px-2.5 flex items-center gap-1 shadow-[1px_1px_0px_0px_#000]"
                                        >
                                            <span class="material-symbols-outlined text-[13px]">photo_library</span>
                                            <span>Voir les {photos.length} photo(s)</span>
                                        </button>
                                    </div>
                                {:else}
                                    <span class="text-[11px] italic text-black/50">Aucune photo d'emballage téléversée</span>
                                {/if}
                            </div>

                            <!-- Preuve de dépôt et n° de suivi -->
                            <div class="p-2.5 bg-[#FBF8EE] border border-black space-y-1">
                                <span class="font-bold text-[10px] uppercase text-black/70 block">Suivi & Preuve de dépôt :</span>
                                {#if item.tracking_number}
                                    <div class="font-mono font-black text-black">N° {item.tracking_number}</div>
                                    {#if item.tracking_url}
                                        <a href={item.tracking_url} target="_blank" rel="noopener noreferrer" class="text-[10px] font-black underline block">
                                            Suivre sur le site transporteur ↗
                                        </a>
                                    {/if}
                                {:else}
                                    <span class="text-[11px] italic text-black/50">Aucun suivi renseigné</span>
                                {/if}
                                {#if item.shipping_proof_url}
                                    <button 
                                        type="button" 
                                        onclick={() => previewPhotos = [item.shipping_proof_url!]}
                                        class="text-[10px] font-black underline flex items-center gap-1 mt-1"
                                    >
                                        <span class="material-symbols-outlined text-xs">receipt_long</span>
                                        <span>Voir le reçu de dépôt</span>
                                    </button>
                                {/if}
                            </div>
                        </div>

                        <!-- Actions Administrateur de changement de statut -->
                        <div class="pt-2 border-t border-black/10 flex flex-wrap items-center justify-between gap-2">
                            <span class="text-[10px] font-black uppercase text-black/60">Modifier le statut (Action Admin) :</span>
                            <div class="flex items-center gap-2">
                                <button 
                                    type="button" 
                                    disabled={isUpdatingStatus}
                                    onclick={() => updateItemStatus(item.id, 'preparation')}
                                    class="retro-btn bg-white hover:bg-[#FFD166] text-[10px] font-black py-1 px-2 border border-black shadow-[1px_1px_0px_0px_#000]"
                                >
                                    À Préparer
                                </button>
                                <button 
                                    type="button" 
                                    disabled={isUpdatingStatus}
                                    onclick={() => updateItemStatus(item.id, 'shipped')}
                                    class="retro-btn bg-white hover:bg-[#BFD7FE] text-[10px] font-black py-1 px-2 border border-black shadow-[1px_1px_0px_0px_#000]"
                                >
                                    Expédié
                                </button>
                                <button 
                                    type="button" 
                                    disabled={isUpdatingStatus}
                                    onclick={() => updateItemStatus(item.id, 'delivered')}
                                    class="retro-btn bg-white hover:bg-[#86E2D5] text-[10px] font-black py-1 px-2 border border-black shadow-[1px_1px_0px_0px_#000]"
                                >
                                    Livré
                                </button>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>

            <!-- Pied de modale -->
            <div class="pt-4 border-t-2 border-black flex flex-wrap items-center justify-between gap-3">
                <div class="text-xs font-mono text-black/60">
                    ID Commande #{selectedOrder.id}
                </div>
                <button 
                    type="button" 
                    onclick={() => selectedOrder = null}
                    class="retro-btn bg-black text-white hover:bg-black/80 py-2 px-6 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#86E2D5]"
                >
                    Fermer
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- MODALE DE PRÉVISUALISATION DES PHOTOS -->
{#if previewPhotos}
    <div class="fixed inset-0 bg-black/80 z-60 flex items-center justify-center p-4">
        <div class="bg-white border-3 border-black shadow-[8px_8px_0px_0px_#000] max-w-2xl w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between border-b-2 border-black pb-2">
                <h4 class="font-serif font-black text-sm uppercase">Photos du colis / Reçu</h4>
                <button type="button" onclick={() => previewPhotos = null} class="font-black text-sm px-2">✕</button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {#each previewPhotos as photo}
                    <div class="border-2 border-black overflow-hidden bg-black/5">
                        <img src={photo} alt="Photo colis" class="w-full h-auto object-contain max-h-72" />
                    </div>
                {/each}
            </div>
            <div class="text-right">
                <button type="button" onclick={() => previewPhotos = null} class="retro-btn bg-black text-white text-xs font-black py-1.5 px-4">
                    Fermer
                </button>
            </div>
        </div>
    </div>
{/if}
