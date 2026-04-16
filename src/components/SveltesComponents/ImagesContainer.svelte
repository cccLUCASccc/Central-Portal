<script lang="ts">
    import ImageComponent from './ImageComponent.svelte';
    import type { Vehicule, Image } from '../../type';
    interface Props {
        item?: Vehicule
        images?: Image[];
        new_Files?: File[];
    }

    let { item, images = $bindable(), new_Files = $bindable() }: Props = $props();
    let gallery = $state<Image[]>(images || [])

    function deleteImage(indexToDelete: number){
        gallery = gallery.filter((_, index) => index !== indexToDelete)
        images = gallery
    }

    function handleDragStart(event: DragEvent, imageId: number) {
        event.dataTransfer?.setData("text/plain", imageId.toString());
    }

    function handleDrop(event: DragEvent, targetIndex: number) {
        event.preventDefault();
        const draggedId = Number(event.dataTransfer?.getData("text/plain"));

        const fromIndex = gallery.findIndex(img => img.id === draggedId);

        if (fromIndex !== -1 && fromIndex !== targetIndex) {
            const newGallery = [...gallery];
            const [movedItem] = newGallery.splice(fromIndex, 1);
            newGallery.splice(targetIndex, 0, movedItem);
            
            gallery = newGallery;
            images = gallery
        }
    }

    function handleFileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

        const filesArray = Array.from(input.files);
        
        const nouvellesImages: any[] = [];
        const nouveauxFichiers: any[] = [];

        filesArray.forEach((file, index) => {
            const temporaryUrl = URL.createObjectURL(file);
            
            nouvellesImages.push({
                id: Date.now() + index, 
                url: temporaryUrl,
            });
            nouveauxFichiers.push(file);
        });

        new_Files = [...new_Files as File[], ...nouveauxFichiers];
        gallery = [...gallery, ...nouvellesImages];
        images = gallery;
        
        input.value = '';
    }

</script>

{#each gallery as image, index (image.id)}
<div 
    draggable="true"
    class="cursor-move"
    ondragstart={(e) => handleDragStart(e, image.id)}
    ondragover={(e) => e.preventDefault()}
    ondrop={(e) => handleDrop(e, index)}
>
    <ImageComponent
            src={image.url} 
            alt={item?.model as string} 
            class="w-[400px] h-[250px]"
            ondelete={() => {console.log(`Click sur l image ${index}`); deleteImage(index)}}
        />
</div>
{/each}
    <input multiple onchange={(e) => handleFileChange(e)} type="file" class="file-input file-input-bordered w-[400px] h-[250px]" />