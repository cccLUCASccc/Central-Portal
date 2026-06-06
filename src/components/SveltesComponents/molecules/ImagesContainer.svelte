<script lang="ts">
    import ImageComponent from '../atoms/ImageComponent.svelte';
    import type { Vehicule, Image, Antiquite } from '../../../type';
    
    interface Props {
        vehicule?: Vehicule
        antiquite?: Antiquite
        images?: Image[];
        new_Files?: File[];
        mode?: string;
    }

    let { vehicule, antiquite, images = $bindable([]), new_Files = $bindable([]), mode }: Props = $props();
    let gallery = $state<Image[]>(images || [])
    let isDraggingOver = $state(false);

    // Synchronisation locale si images change de l'extérieur
    $effect(() => {
        gallery = images;
    });

    function deleteImage(indexToDelete: number){
        gallery = gallery.filter((_, index) => index !== indexToDelete)
        images = gallery
    }

    function handleDragStart(event: DragEvent, imageId: number) {
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", imageId.toString());
        }
    }

    function handleDrop(event: DragEvent, targetIndex: number) {
        event.preventDefault();
        isDraggingOver = false;
        
        const draggedId = Number(event.dataTransfer?.getData("text/plain"));
        const fromIndex = gallery.findIndex(img => img.id === draggedId);

        if (fromIndex !== -1 && fromIndex !== targetIndex) {
            const newGallery = [...gallery];
            const [movedItem] = newGallery.splice(fromIndex, 1);
            newGallery.splice(targetIndex, 0, movedItem);
            
            gallery = newGallery;
            images = gallery;
        }
    }

    function handleFileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

        const filesArray = Array.from(input.files);
        const nouvellesImages: Image[] = [];
        const nouveauxFichiers: File[] = [];

        filesArray.forEach((file, index) => {
            const temporaryUrl = URL.createObjectURL(file);
            nouvellesImages.push({
                id: Date.now() + index, 
                url: temporaryUrl,
            });
            nouveauxFichiers.push(file);
        });

        new_Files = [...(new_Files || []), ...nouveauxFichiers];
        gallery = [...gallery, ...nouvellesImages];
        images = gallery;
        
        input.value = '';
    }
</script>

<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-2 w-full">
    {#each gallery as image, index (image.id)}
        <div 
            draggable="true"
            class="transition-all duration-300"
            ondragstart={(e) => handleDragStart(e, image.id)}
            ondragover={(e) => { e.preventDefault(); isDraggingOver = true; }}
            ondragleave={() => isDraggingOver = false}
            ondrop={(e) => handleDrop(e, index)}
        >
            <ImageComponent
                src={image.url} 
                alt={antiquite?.name || "Objet"} 
                ondelete={() => deleteImage(index)}
            />
        </div>
    {/each}

    <!-- Zone d'upload stylisée -->
    <label class="group relative flex flex-col items-center justify-center aspect-square w-full rounded-2xl border-2 border-dashed border-base-300 bg-base-100 hover:bg-base-200 hover:border-primary/50 transition-all cursor-pointer overflow-hidden">
        <input 
            multiple 
            onchange={handleFileChange} 
            type="file" 
            accept="image/*"
            class="hidden" 
        />
        
        <div class="flex flex-col items-center gap-4 p-4 text-center">
            <div class="p-3 rounded-full bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            </div>
            <div class="space-y-1">
                <p class="text-sm font-bold">Ajouter des images</p>
                <p class="text-xs opacity-50">PNG, JPG jusqu'à 10MB</p>
            </div>
        </div>
    </label>
</div>
