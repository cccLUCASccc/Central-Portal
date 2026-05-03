<script lang="ts">
    import BulkVehiculesImporter from "../atoms/BulkVehiculesImporter.svelte";
    import CustomTable from "../atoms/CustomTable.svelte";
    import PaginationComponent from "../atoms/Pagination.svelte";
    import type { Vehicule, Pagination } from "../../../type";

    interface Props {
        vehicules : Vehicule[];
        pagination ?: Pagination;
    }

    let { vehicules, pagination }:Props = $props()

    let is_visible : boolean = $state(false)

    function handlePageChange(page: number) {
        const url = new URL(window.location.href);
        url.searchParams.set('page', page.toString());
        window.location.href = url.toString();
    }

</script>

<div class="flex flex-col gap-6 w-full max-w-7xl mx-auto">
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-base-100 p-6 rounded-2xl shadow-sm border border-base-200">
        <div>
            <h1 class="text-3xl font-extrabold tracking-tight">Gestion de l'Inventaire</h1>
            <p class="text-base-content/60 mt-1">Gérez vos véhicules, modifiez les prix et suivez les statuts.</p>
        </div>
        
        <div class="flex flex-wrap gap-3">
            <button 
                onclick={() => {is_visible = !is_visible}} 
                class="btn btn-outline btn-secondary rounded-xl shadow-sm hover:shadow-secondary/20 transition-all"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                Import/Export Lot
            </button>
            <a href="/vehicules/add" class="btn btn-primary rounded-xl shadow-md hover:shadow-primary/30 transition-all px-6">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                Nouveau Véhicule
            </a>            
        </div>
    </div>

    {#if is_visible}
        <div class="animate-in fade-in zoom-in duration-300">
            <BulkVehiculesImporter />
        </div>
    {/if}

    <div class="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
        <CustomTable vehicules={vehicules} mode={"vehicules"}/>

        {#if pagination && pagination.total_pages > 1}
            <PaginationComponent {pagination} onPageChange={handlePageChange} />
        {/if}
    </div>
</div>