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

        <div class="card bg-base-100 shadow-xl border border-base-200 overflow-hidden">
            <div class="overflow-x-auto">
                <table class="table table-zebra w-full">
                    <thead class="bg-base-200/50">
                        <tr>
                            <th>Objet</th>
                            <th>Titre sur eBay</th>
                            <th class="text-right">Prix eBay</th>
                            <th class="text-center">Catégorie eBay</th>
                            <th class="text-center">Statut eBay</th>
                            <th class="text-right">Actions</th>
                        </tr>
                    </thead>
                    
                    <tbody>
                        {#each currentAntiquites as antiquite (antiquite.id)}
                            <tr class="hover:bg-base-200/50 transition-colors group cursor-pointer"
                                onclick={() => window.location.href = `/ebay/${antiquite.id}`}>
                                
                                <!-- Object Details -->
                                <td>
                                    <div class="flex items-center gap-4">
                                        <div class="avatar">
                                            <div class="mask mask-squircle w-14 h-14 bg-base-200 shadow-inner group-hover:scale-105 transition-transform">
                                                {#if import.meta.env.PUBLIC_DISABLE_IMAGES !== "true" && (antiquite.images && antiquite.images.length > 0)}
                                                    <img src={antiquite.images[0].url} alt={antiquite.name} />
                                                {:else}
                                                    <div class="flex items-center justify-center h-full text-[10px] opacity-40 uppercase font-bold">
                                                        {antiquite.images?.length > 0 ? 'OFF' : 'N/A'}
                                                    </div>
                                                {/if}
                                            </div>
                                        </div>
                                        <div>
                                            <div class="font-bold text-base">{antiquite.name}</div>
                                            <div class="text-xs opacity-50 font-mono">SKU: ANTIQUITE-BE-{antiquite.id}</div>
                                        </div>
                                    </div>
                                </td>

                                <!-- eBay Custom Title -->
                                <td>
                                    {#if antiquite.ebay_title}
                                        <span class="text-sm font-semibold">{antiquite.ebay_title}</span>
                                    {:else}
                                        <span class="text-sm opacity-50 italic">{antiquite.name} <span class="text-[10px] uppercase font-bold not-italic px-1 py-0.5 rounded bg-base-200 text-base-content/60">défaut</span></span>
                                    {/if}
                                </td>

                                <!-- eBay Custom Price -->
                                <td class="text-right font-mono font-bold whitespace-nowrap">
                                    {#if antiquite.ebay_price && antiquite.ebay_price > 0}
                                        <span class="text-info">{formatPrice(antiquite.ebay_price)}</span>
                                    {:else}
                                        <span class="opacity-50 font-normal">{formatPrice(antiquite.price)} <span class="text-[10px] uppercase font-bold px-1 py-0.5 rounded bg-base-200 text-base-content/60">défaut</span></span>
                                    {/if}
                                </td>

                                <!-- eBay Category ID -->
                                <td class="text-center font-mono text-xs font-semibold">
                                    {antiquite.ebay_category_id || "119168"}
                                    {#if !antiquite.ebay_category_id}
                                        <span class="text-[9px] uppercase font-bold bg-base-200 text-base-content/50 px-1 py-0.5 rounded ml-1">défaut</span>
                                    {/if}
                                </td>

                                <!-- eBay Listing Status -->
                                <td class="text-center">
                                    {#if antiquite.ebay_status === "PUBLISHED"}
                                        <span class="badge badge-success gap-1.5 font-bold uppercase text-[10px] px-3 py-2">
                                            <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                                            En Ligne
                                        </span>
                                    {:else if antiquite.ebay_status === "NOT_LISTED" || !antiquite.ebay_status}
                                        <span class="badge badge-ghost font-bold uppercase text-[10px] opacity-60 px-3 py-2">
                                            Non publié
                                        </span>
                                    {:else}
                                        <span class="badge badge-warning font-bold uppercase text-[10px] px-3 py-2">
                                            {antiquite.ebay_status}
                                        </span>
                                    {/if}
                                </td>

                                <!-- Action Buttons -->
                                <td onclick={(e) => e.stopPropagation()} class="text-right">
                                    <div class="flex justify-end gap-2">
                                        <a href={`/ebay/${antiquite.id}`} class="btn btn-outline btn-info btn-xs rounded-lg px-3">
                                            Configurer
                                        </a>
                                        {#if antiquite.ebay_listing_id}
                                            <a 
                                                href={`https://www.ebay.be/itm/${antiquite.ebay_listing_id}`} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                class="btn btn-ghost btn-xs btn-square text-success"
                                                title="Voir l'annonce sur eBay"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
                                                    <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                                </svg>
                                            </a>
                                        {/if}
                                    </div>
                                </td>
                            </tr>
                        {:else}
                            <tr>
                                <td colspan="6" class="text-center py-20 bg-base-200/20">
                                    <div class="flex flex-col items-center gap-3">
                                        <span class="text-5xl opacity-20">📦</span>
                                        <p class="text-base-content/50 font-medium">Aucune antiquité trouvée pour eBay.</p>
                                    </div>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        </div>

        {#if currentPagination && currentPagination.total_pages > 1}
            <div class="mt-4">
                <PaginationComponent pagination={currentPagination} onPageChange={handlePageChange} />
            </div>
        {/if}
    </div>
</div>
