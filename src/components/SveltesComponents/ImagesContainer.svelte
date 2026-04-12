<script lang="ts">
    import ImageComponent from './ImageComponent.svelte';
    import type { Vehicule, Image } from '../../type';
    interface Props {
        item: Vehicule
        images: Image[];
    }

    let { item, images }: Props = $props();
</script>

{#each images as image}
    <ImageComponent
        src={image.url} 
        alt={item.model} 
        class="w-[400px] h-[250px]"
    />
{/each}
    <input type="file" class="file-input file-input-bordered w-[400px] h-[250px]" />