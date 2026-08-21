<script lang="ts">
    import { onMount, untrack } from "svelte";
    import DataModifier from "../atoms/DataModifier.svelte";
    import PaginationComponent from "../atoms/Pagination.svelte";
    import { filterStore } from "../../../store.svelte";
    import type { Antiquite, Pagination } from "../../../type";
    import { apiFetch } from "../../../lib/api";

    interface Props {
        apiUrl: string;
        antiquites: Antiquite[];
        pagination ?: Pagination;
    }

    let { apiUrl, antiquites: initialAntiquites, pagination: initialPagination }: Props = $props();

    let currentAntiquites = $state(initialAntiquites);
    let currentPagination = $state(initialPagination);
    let isLoading = $state(false);
    let isMounted = $state(false);

    onMount(() => {
        filterStore.initFromUrl();
        setTimeout(() => { isMounted = true; }, 50);
    });

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('fr-BE', { 
            style: 'currency', 
            currency: 'EUR',
            maximumFractionDigits: 2
        }).format(price);
    };

    async function fetchData(page = 1) {
        if (typeof window === 'undefined') return;
        
        isLoading = true;
        const params = new URLSearchParams({ page: page.toString() });
        
        if (filterStore.category_filter) params.set('category', filterStore.category_filter);
        if (filterStore.status_filter !== null) params.set('status', filterStore.status_filter.toString());
        if (filterStore.price_filter) params.set('priceMax', filterStore.price_filter.toString());
        if (filterStore.nouveaute_filter !== null) params.set('nouveaute', filterStore.nouveaute_filter.toString());

        try {
            const response = await apiFetch(`${apiUrl}/api/antiquites?${params.toString()}`);
            if (response.ok) {
                const result = await response.json();
                currentAntiquites = result.data;
                currentPagination = result.pagination;
                
                const url = new URL(window.location.href);
                url.searchParams.forEach((_, key) => { if (key !== 'project') url.searchParams.delete(key) });
                params.forEach((value, key) => url.searchParams.set(key, value));
                window.history.pushState({}, '', url.toString());
            }
        } catch (e) {
            console.error("❌ Erreur lors de la récupération des données :", e);
        } finally {
            isLoading = false;
        }
    }

    $effect(() => {
        const _cat = filterStore.category_filter;
        const _stat = filterStore.status_filter;
        const _price = filterStore.price_filter;
        const _nouv = filterStore.nouveaute_filter;

        if (isMounted) {
            untrack(() => {
                fetchData(1);
            });
        }
    });

    function handlePageChange(page: number) {
        fetchData(page);
    }

    function resetFilters() {
        filterStore.reset();
        fetchData(1);
    }

    let isRedirecting = $state(false);

    async function handleConnectEbay() {
        isRedirecting = true;
        try {
            const response = await apiFetch(`${apiUrl}/api/ebay/auth/login`);
            if (response.ok) {
                const data = await response.json();
                if (data.url) {
                    window.location.href = data.url;
                } else {
                    alert("URL d'authentification introuvable");
                }
            } else {
                alert("Erreur lors de la récupération du lien de connexion eBay.");
            }
        } catch (e) {
            console.error(e);
            alert("Erreur réseau");
        } finally {
            isRedirecting = false;
        }
    }
</script>

<div class="flex flex-col gap-6 w-full max-w-7xl mx-auto font-mono">
    <!-- Header Rétro eBay -->
    <div class="retro-card-yellow p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <div class="flex items-center gap-2">
                <span class="retro-badge bg-black text-white text-[10px]">MARKETPLACE</span>
                <span class="text-xs font-bold text-black/70">EBAY INVENTORY CONNECTOR</span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-black uppercase tracking-tight text-black mt-1">
                Passerelle eBay
            </h1>
            <p class="text-xs text-black/80 mt-1 max-w-xl">
                Synchronisez vos antiquités sur votre boutique eBay Belgique & Internationale en un clic.
            </p>
        </div>

        <button 
            onclick={handleConnectEbay} 
            disabled={isRedirecting}
            class="retro-btn py-2 px-4 text-xs bg-white hover:bg-[#99E7DC] font-black shadow-[3px_3px_0px_0px_#000]"
        >
            {#if isRedirecting}
                <span class="loading loading-spinner loading-xs mr-1"></span>
            {:else}
                🔗
            {/if}
            Connexion Compte eBay
        </button>
    </div>

    <!-- Barre de Filtres Rétro -->
    <div class="retro-card p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
        <div>
            <DataModifier type={5} type_name="Catégorie" mode="filter" bind:data_string={filterStore.category_filter} />
        </div>
        <div>
            <DataModifier type={3} type_name="Prix Max (€)" mode="filter" bind:data_number={filterStore.price_filter} />
        </div>
        <div>
            <DataModifier type={4} type_name="Statut" mode="filter" bind:data_number={filterStore.status_filter} />
        </div>
        <div>
            <DataModifier type={7} type_name="Filtre Nouveauté" mode="filter" bind:data_bool={filterStore.nouveaute_filter} />
        </div>
        <div>
            <button class="retro-btn bg-white hover:bg-[#FFC2D1] w-full py-2 text-xs" onclick={resetFilters}>
                🔄 Réinitialiser
            </button>
        </div>
    </div>

    <!-- Grille des Annonces eBay -->
    <div class="relative">
        {#if isLoading}
            <div class="absolute inset-0 bg-[#F6F4EE]/60 backdrop-blur-xs z-10 flex items-center justify-center border-2 border-black">
                <div class="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_#000] flex items-center gap-3 font-bold text-xs uppercase">
                    <span class="loading loading-spinner loading-md text-black"></span>
                    <span>Actualisation du catalogue eBay...</span>
                </div>
            </div>
        {/if}

        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {#each currentAntiquites as antiquite (antiquite.id)}
                <div 
                    class="retro-card overflow-hidden flex flex-col justify-between group cursor-pointer"
                    onclick={() => window.location.href = `/ebay/${antiquite.id}`}
                >
                    <!-- Cover Image -->
                    <div class="relative aspect-[4/3] bg-[#EDE9DF] border-b-2 border-black overflow-hidden flex items-center justify-center">
                        {#if import.meta.env.PUBLIC_DISABLE_IMAGES !== "true" && (antiquite.images && antiquite.images.length > 0)}
                            <img src={antiquite.images[0].url} alt={antiquite.name} class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                        {:else}
                            <div class="flex items-center justify-center h-full text-[10px] opacity-40 uppercase font-bold">
                                {antiquite.images?.length > 0 ? 'OFF' : 'N/A'}
                            </div>
                        {/if}

                        <!-- Dynamic Status Badge -->
                        <div class="absolute top-2 right-2 z-10">
                            {#if antiquite.ebay_status === "PUBLISHED"}
                                <span class="retro-badge bg-[#99E7DC] text-[9px]">
                                    En ligne
                                </span>
                            {:else if antiquite.ebay_status === "NOT_LISTED" || !antiquite.ebay_status}
                                <span class="retro-badge bg-white text-[9px]">
                                    Non publié
                                </span>
                            {:else}
                                <span class="retro-badge bg-[#FFF394] text-[9px]">
                                    {antiquite.ebay_status}
                                </span>
                            {/if}
                        </div>

                        <!-- Price Tag Overlay -->
                        <div class="absolute bottom-2 left-2 bg-black text-white text-xs font-mono font-bold px-2 py-0.5 border border-white">
                            {#if antiquite.ebay_price && antiquite.ebay_price > 0}
                                <span>{formatPrice(antiquite.ebay_price)}</span>
                            {:else}
                                <span>{formatPrice(antiquite.price)} <span class="text-[9px] text-white/60">(std)</span></span>
                            {/if}
                        </div>
                    </div>

                    <!-- Card Body -->
                    <div class="p-3 bg-white flex flex-col justify-between flex-grow gap-2">
                        <div class="space-y-1">
                            <div class="font-bold text-xs text-black line-clamp-1 group-hover:underline">
                                {antiquite.ebay_title || antiquite.name}
                            </div>
                            
                            <div class="flex items-center justify-between text-[10px] text-black/60 font-mono">
                                <span>SKU: #{antiquite.id}</span>
                                <span>Cat: {antiquite.ebay_category_id || "119168"}</span>
                            </div>
                        </div>

                        <!-- Card Footer / Actions -->
                        <div class="flex items-center gap-1.5 mt-1 pt-2 border-t border-black/20" onclick={(e) => e.stopPropagation()}>
                            <a href={`/ebay/${antiquite.id}`} class="retro-btn text-[10px] py-1 px-2.5 flex-1 bg-white hover:bg-[#FFE600] font-black text-center">
                                Configurer ⚙️
                            </a>
                            {#if antiquite.ebay_listing_id}
                                <a 
                                    href={`https://www.ebay.be/itm/${antiquite.ebay_listing_id}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    class="retro-btn text-[10px] py-1 px-2 bg-[#99E7DC] hover:bg-[#7ce0d3]"
                                    title="Voir sur eBay"
                                >
                                    ↗
                                </a>
                            {/if}
                        </div>
                    </div>
                </div>
            {:else}
                <div class="col-span-full text-center py-16 retro-card">
                    <div class="text-4xl mb-2">📦</div>
                    <p class="text-xs font-bold uppercase text-black">Aucune antiquité trouvée pour eBay.</p>
                </div>
            {/each}
        </div>

        {#if currentPagination && currentPagination.total_pages > 1}
            <div class="mt-4">
                <PaginationComponent pagination={currentPagination} onPageChange={handlePageChange} />
            </div>
        {/if}
    </div>
</div>
