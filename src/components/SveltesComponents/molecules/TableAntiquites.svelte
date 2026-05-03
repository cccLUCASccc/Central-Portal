<script lang="ts">
    import BulkAntiquitesImporter from "../atoms/BulkAntiquitesImporter.svelte";
    import CustomTable from "../atoms/CustomTable.svelte";
    import DataModifier from "../atoms/DataModifier.svelte";
    import PaginationComponent from "../atoms/Pagination.svelte";
    import { filterStore } from "../../../store.svelte";
    import type { Antiquite, Pagination } from "../../../type";

    interface Props {
        antiquites : Antiquite[];
        pagination ?: Pagination;
    }

    let { antiquites, pagination }:Props = $props()

    let is_visible : boolean = $state(false)

    function handlePageChange(page: number) {
        const url = new URL(window.location.href);
        url.searchParams.set('page', page.toString());
        window.location.href = url.toString();
    }

    function handleFilterChange() {
        const url = new URL(window.location.href);
        url.searchParams.set('page', '1'); // Reset to page 1 on filter change
        
        if (filterStore.category_filter) url.searchParams.set('category', filterStore.category_filter);
        else url.searchParams.delete('category');
        
        if (filterStore.status_filter !== null) url.searchParams.set('status', filterStore.status_filter.toString());
        else url.searchParams.delete('status');
        
        if (filterStore.price_filter) url.searchParams.set('priceMax', filterStore.price_filter.toString());
        else url.searchParams.delete('priceMax');
        
        if (filterStore.nouveaute_filter !== null) url.searchParams.set('nouveaute', filterStore.nouveaute_filter.toString());
        else url.searchParams.delete('nouveaute');

        window.location.href = url.toString();
    }

    function resetFilters() {
        filterStore.reset();
        const url = new URL(window.location.href);
        url.searchParams.delete('category');
        url.searchParams.delete('status');
        url.searchParams.delete('priceMax');
        url.searchParams.delete('nouveaute');
        url.searchParams.set('page', '1');
        window.location.href = url.toString();
    }

</script>

<div class="flex flex-col gap-6 w-full max-w-7xl mx-auto">
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-base-100 p-6 rounded-2xl shadow-sm border border-base-200">
        <div>
            <h1 class="text-3xl font-extrabold tracking-tight">Gestion de l'Inventaire</h1>
            <p class="text-base-content/60 mt-1">Gérez vos antiquités, modifiez les prix et suivez les statuts.</p>
        </div>
        
        <div class="flex flex-wrap gap-3">
            <button 
                onclick={() => {is_visible = !is_visible}} 
                class="btn btn-outline btn-secondary rounded-xl shadow-sm hover:shadow-secondary/20 transition-all"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                Import/Export Lot
            </button>
            <a href="/antiquites/add" class="btn btn-primary rounded-xl shadow-md hover:shadow-primary/30 transition-all px-6">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                Nouvel Objet
            </a>            
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

    {#if is_visible}
        <div class="animate-in fade-in zoom-in duration-300">
            <BulkAntiquitesImporter />
        </div>
    {/if}

    <div class="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
        <CustomTable antiquites={antiquites} mode={"antiquites"}/>
        
        {#if pagination && pagination.total_pages > 1}
            <PaginationComponent {pagination} onPageChange={handlePageChange} />
        {/if}
    </div>
</div>