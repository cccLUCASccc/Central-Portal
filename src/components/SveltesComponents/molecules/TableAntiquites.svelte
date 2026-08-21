<script lang="ts">
    import { onMount, untrack } from "svelte";
    import BulkAntiquitesImporter from "../atoms/BulkAntiquitesImporter.svelte";
    import CustomTable from "../atoms/CustomTable.svelte";
    import DataModifier from "../atoms/DataModifier.svelte";
    import PaginationComponent from "../atoms/Pagination.svelte";
    import { filterStore } from "../../../store.svelte";
    import type { Antiquite, Pagination } from "../../../type";
    import { apiFetch } from "../../../lib/api";

    interface Props {
        apiUrl: string;
        antiquites : Antiquite[];
        pagination ?: Pagination;
    }

    let { apiUrl, antiquites: initialAntiquites, pagination: initialPagination }: Props = $props();

    let currentAntiquites = $state(initialAntiquites);
    let currentPagination = $state(initialPagination);
    let isLoading = $state(false);
    let is_visible : boolean = $state(false);
    let isMounted = $state(false);

    onMount(() => {
        filterStore.initFromUrl();
        setTimeout(() => { isMounted = true; }, 50);
    });

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
        // Track changes to filters
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
</script>

<div class="flex flex-col gap-6 w-full font-mono">
    <!-- Header Rétro -->
    <div class="retro-card-blue p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <div class="flex items-center gap-2">
                <span class="retro-badge bg-black text-white text-[10px]">MODULE INVENTAIRE</span>
                <span class="text-xs font-bold tracking-widest text-black/70">CATALOGUE BOUTIQUE</span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-black uppercase tracking-tight text-black mt-1">
                Gestion de l'Inventaire
            </h1>
            <p class="text-xs text-black/80 mt-1 max-w-xl">
                Suivez votre catalogue d'antiquités, ajustez les prix, gérez les statuts et publiez vos trésors.
            </p>
        </div>
        
        <div class="flex flex-wrap items-center gap-2.5">
            <button 
                onclick={() => {is_visible = !is_visible}} 
                class="retro-btn bg-white hover:bg-[#FFE600] text-xs py-2 px-3.5"
            >
                <span>📦</span>
                <span>Import / Export Lot</span>
            </button>
            <a href="/antiquites/add" class="retro-btn-primary text-xs py-2 px-4 font-black shadow-[3px_3px_0px_0px_#000]">
                <span>➕</span>
                <span>Nouvel Objet</span>
            </a>            
        </div>
    </div>

    <!-- Barre de Filtres Rétro avec Dropdowns Stylisés -->
    <div class="retro-card p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end relative z-30">
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

    {#if is_visible}
        <div class="animate-in fade-in duration-200 relative z-20">
            <BulkAntiquitesImporter />
        </div>
    {/if}

    <div class="relative z-0">
        {#if isLoading}
            <div class="absolute inset-0 bg-[#F6F4EE]/60 backdrop-blur-xs z-10 flex items-center justify-center border-2 border-black">
                <div class="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_#000] flex items-center gap-3 font-bold text-xs uppercase">
                    <span class="loading loading-spinner loading-md text-black"></span>
                    <span>Actualisation du catalogue...</span>
                </div>
            </div>
        {/if}

        <CustomTable antiquites={currentAntiquites} mode={"antiquites"}/>
        
        {#if currentPagination && currentPagination.total_pages > 1}
            <PaginationComponent pagination={currentPagination} onPageChange={handlePageChange} />
        {/if}
    </div>
</div>