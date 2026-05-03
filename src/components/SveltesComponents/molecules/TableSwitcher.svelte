<script lang="ts">
    import TableVehicules from './TableVehicules.svelte';
    import TableAntiquites from './TableAntiquites.svelte';
    import type { Vehicule, Antiquite, Project, Pagination } from "../../../type";
    import { projectStore } from "../../../store.svelte";


    interface Props {
        vehicules ?: Vehicule[],
        vehiculesPagination ?: Pagination,
        antiquites ?: Antiquite[],
        antiquitesPagination ?: Pagination,
        projets ?: Project[],
        projetsPagination ?: Pagination
    }

    let { vehicules, vehiculesPagination, antiquites, antiquitesPagination, projets, projetsPagination }:Props = $props()
</script>

{#if projectStore.selectedProject?.name === "Junction Retro" && vehicules}
    <TableVehicules vehicules={vehicules} pagination={vehiculesPagination} />
{:else if projectStore.selectedProject?.name === "Daisy Brocante" && antiquites}
    <TableAntiquites antiquites={antiquites} pagination={antiquitesPagination} />
{:else if !projectStore.selectedProject}
    <div class="alert shadow-lg">
        <div>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-info flex-shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span>Veuillez sélectionner un projet pour afficher les données.</span>
        </div>
    </div>
{:else}
    <div class="p-10 text-center">
        <h2 class="text-2xl font-bold opacity-50">Aucun inventaire disponible pour {projectStore.selectedProject.name}</h2>
    </div>
{/if}