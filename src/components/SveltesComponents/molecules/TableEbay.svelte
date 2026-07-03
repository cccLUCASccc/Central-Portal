<script lang="ts">
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

    function handlePageChange(page: number) {
        fetchData(page);
    }

    function handleFilterChange() {
        fetchData(1);
    }

    function resetFilters() {
        filterStore.reset();
        fetchData(1);
    }
</script>

<div class="flex flex-col gap-6 w-full max-w-7xl mx-auto">
    <!-- Header -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-base-100 p-6 rounded-2xl shadow-sm border border-base-200">
        <div>
            <h1 class="text-3xl font-extrabold tracking-tight flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                Annonces eBay
            </h1>
            <p class="text-base-content/60 mt-1">Gérez vos publications eBay, ajustez vos prix spécifiques et suivez l'état des annonces en temps réel.</p>
        </div>
    </div>

    <!-- Barre de Filtres -->
    <div class="bg-base-100 p-4 rounded-2xl shadow-sm border border-base-200 grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
        <div onchange={handleFilterChange}>
            <DataModifier type={5} type_name="Catégorie" mode="filter" bind:data_string={filterStore.category_filter} />
        </div>
        <div onfocusout={handleFilterChange}>
            <DataModifier type={3} type_name="Prix Max" mode="filter" bind:data_number={filterStore.price_filter} />
        </div>
        <div onchange={handleFilterChange}>
            <DataModifier type={4} type_name="Statut" mode="filter" bind:data_number={filterStore.status_filter} />
        </div>
        <div onchange={handleFilterChange}>
            <DataModifier type={7} type_name="Nouveauté" mode="filter" bind:data_bool={filterStore.nouveaute_filter} />
        </div>
        <div class="flex gap-2">
            <button class="btn btn-ghost flex-1" onclick={resetFilters}>Réinitialiser</button>
        </div>
    </div>

    <!-- Inventory Grid/Table -->
    <div class="relative animate-in fade-in slide-in-from-bottom-2 duration-500">
        {#if isLoading}
            <div class="absolute inset-0 bg-base-100/50 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-2xl">
                <span class="loading loading-spinner loading-lg text-primary"></span>
            </div>
        {/if}

        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {#each currentAntiquites as antiquite (antiquite.id)}
                <div class="card bg-base-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-base-200 overflow-hidden relative flex flex-col h-full group cursor-pointer"
                     onclick={() => window.location.href = `/ebay/${antiquite.id}`}>
                    
                    <!-- Cover Image -->
                    <div class="relative aspect-[4/3] bg-base-200 overflow-hidden flex items-center justify-center">
                        {#if import.meta.env.PUBLIC_DISABLE_IMAGES !== "true" && (antiquite.images && antiquite.images.length > 0)}
                            <img src={antiquite.images[0].url} alt={antiquite.name} class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        {:else}
                            <div class="flex items-center justify-center h-full text-[10px] opacity-40 uppercase font-bold">
                                {antiquite.images?.length > 0 ? 'OFF' : 'N/A'}
                            </div>
                        {/if}

                        <!-- Dynamic Status Badge (Overlay top-right) -->
                        <div class="absolute top-3 right-3 z-10">
                            {#if antiquite.ebay_status === "PUBLISHED"}
                                <span class="badge badge-success gap-1.5 font-bold uppercase text-[9px] px-2 py-1.5 shadow-md text-white border-none">
                                    <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                                    En ligne
                                </span>
                            {:else if antiquite.ebay_status === "NOT_LISTED" || !antiquite.ebay_status}
                                <span class="badge badge-neutral bg-black/60 text-white font-bold uppercase text-[9px] px-2 py-1.5 shadow-md border-none backdrop-blur-xs">
                                    Non publié
                                </span>
                            {:else}
                                <span class="badge badge-warning font-bold uppercase text-[9px] px-2 py-1.5 shadow-md">
                                    {antiquite.ebay_status}
                                </span>
                            {/if}
                        </div>

                        <!-- Price Tag Overlay (Overlay bottom-left) -->
                        <div class="absolute bottom-3 left-3 bg-neutral-900/80 backdrop-blur-xs text-white text-xs font-mono font-bold px-2.5 py-1 rounded shadow-md border border-white/10">
                            {#if antiquite.ebay_price && antiquite.ebay_price > 0}
                                <span>{formatPrice(antiquite.ebay_price)}</span>
                            {:else}
                                <span class="opacity-80">{formatPrice(antiquite.price)} <span class="text-[8px] uppercase opacity-60 font-sans font-bold">défaut</span></span>
                            {/if}
                        </div>
                    </div>

                    <!-- Card Body -->
                    <div class="card-body p-4 flex flex-col justify-between flex-grow gap-3 bg-base-100">
                        <div class="space-y-1">
                            <!-- Title -->
                            <div class="font-bold text-sm text-base-content line-clamp-1 group-hover:text-primary transition-colors">
                                {#if antiquite.ebay_title}
                                    {antiquite.ebay_title}
                                {:else}
                                    {antiquite.name}
                                {/if}
                            </div>
                            
                            <!-- SKU / Metadata -->
                            <div class="flex items-center justify-between text-[10px] opacity-60 font-mono">
                                <span>SKU: BE-{antiquite.id}</span>
                                <span>Catégorie: {antiquite.ebay_category_id || "119168"}</span>
                            </div>
                        </div>

                        <!-- Card Footer / Actions -->
                        <div class="flex items-center gap-2 mt-2 pt-3 border-t border-base-200" onclick={(e) => e.stopPropagation()}>
                            <a href={`/ebay/${antiquite.id}`} class="btn btn-primary btn-sm flex-1 font-bold text-xs rounded-xl">
                                Configurer
                            </a>
                            {#if antiquite.ebay_listing_id}
                                <a 
                                    href={`https://www.ebay.be/itm/${antiquite.ebay_listing_id}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    class="btn btn-outline btn-square btn-sm border-success text-success hover:bg-success hover:text-white rounded-xl"
                                    title="Voir l'annonce sur eBay"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                    </svg>
                                </a>
                            {/if}
                        </div>
                    </div>
                </div>
            {:else}
                <div class="col-span-full text-center py-20 bg-base-100 border border-base-200 rounded-2xl">
                    <div class="flex flex-col items-center gap-3">
                        <span class="text-5xl opacity-20">📦</span>
                        <p class="text-base-content/50 font-medium">Aucune antiquité trouvée pour eBay.</p>
                    </div>
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
