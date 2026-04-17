<script lang="ts">
    import BulkImporter from "./BulkImporter.svelte";
    import CustomTable from "./CustomTable.svelte";
    import type { Vehicule } from "../../type";

    interface Props {
        vehicules : Vehicule[]
    }

    let { vehicules }:Props = $props()

    let is_visible : boolean = $state(false)

</script>

<div class="flex w-full gap-4 m-4">
<a href="/vehicules/add" class="btn btn-primary">Ajouter un véhicule</a>            
<button onclick={() => {is_visible = !is_visible}} class="btn btn-secondary">Ajouter/Modifer par lot</button>
</div>
{#if is_visible}
<BulkImporter />
{/if}
<CustomTable vehicules={vehicules}/>