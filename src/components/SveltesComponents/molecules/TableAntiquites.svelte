<script lang="ts">
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

    let { apiUrl, antiquites: initialAntiquites, pagination: initialPagination }:Props = $props()

    // État local réactif pour permettre la mise à jour sans reload
    let currentAntiquites = $state(initialAntiquites);
    let currentPagination = $state(initialPagination);
    let isLoading = $state(false);
    let is_visible : boolean = $state(false)

    async function fetchData(page = 1) {
        if (typeof window === 'undefined') return;
        
        isLoading = true;
        const params = new URLSearchParams({ page: page.toString() });
        
        if (filterStore.category_filter) params.set('category', filterStore.category_filter);
        if (filterStore.status_filter !== null) params.set('status', filterStore.status_filter.toString());
        if (filterStore.price_filter) params.set('priceMax', filterStore.price_filter.toString());
        if (filterStore.nouveaute_filter !== null) params.set('nouveaute', filterStore.nouveaute_filter.toString());

        try {
            // Utilisation de apiFetch pour gérer le token Clerk automatiquement
            const response = await apiFetch(`${apiUrl}/api/antiquites?${params.toString()}`);
            if (response.ok) {
                const result = await response.json();
                currentAntiquites = result.data;
                currentPagination = result.pagination;
                
                // Mise à jour silencieuse de l'URL pour que le bouton "Retour" fonctionne
                const url = new URL(window.location.href);
                // On nettoie les anciens paramètres et on met les nouveaux
                url.searchParams.forEach((_, key) => { if (key !== 'project') url.searchParams.delete(key) }); // On garde juste le projet si présent
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
        fetchData(1); // Retour à la page 1 lors d'un changement de filtre
    }

    function resetFilters() {
        filterStore.reset();
        fetchData(1);
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

    <div class="relative animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
        {#if isLoading}
            <div class="absolute inset-0 bg-base-100/50 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-2xl">
                <span class="loading loading-spinner loading-lg text-primary"></span>
            </div>
        {/if}

        <CustomTable antiquites={currentAntiquites} mode={"antiquites"}/>
        
        {#if currentPagination && currentPagination.total_pages > 1}
            <PaginationComponent pagination={currentPagination} onPageChange={handlePageChange} />
        {/if}
    </div>
</div>