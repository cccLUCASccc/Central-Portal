<script lang="ts">
    import ImageComponent from '../atoms/ImageComponent.svelte';
    import S3ImagePickerModal from '../atoms/S3ImagePickerModal.svelte';
    import type { Vehicule, Image, Antiquite } from '../../../type';
    import { compressImageFile } from '../../../lib/imageCompressor';
    
    interface Props {
        vehicule?: Vehicule;
        antiquite?: Antiquite;
        images?: Image[];
        new_Files?: File[];
        s3_Keys?: string[];
        mode?: string;
    }

    let { vehicule, antiquite, images = $bindable([]), new_Files = $bindable([]), s3_Keys = $bindable([]), mode }: Props = $props();
    let gallery = $state<Image[]>(images || []);
    let isDraggingOver = $state(false);
    let isCompressing = $state(false);
    let isS3PickerOpen = $state(false);
    
    const fileMap = new Map<number, File>();

    // Synchronisation locale si images change de l'extérieur
    $effect(() => {
        gallery = images;
    });

    function syncGallery() {
        new_Files = gallery.map(img => fileMap.get(img.id)).filter((f): f is File => f !== undefined);
        s3_Keys = gallery.filter(img => img.s3_key !== undefined).map(img => img.s3_key as string);
        images = gallery;
    }

    function deleteImage(indexToDelete: number){
        const deleted = gallery[indexToDelete];
        if (deleted) {
            fileMap.delete(deleted.id);
        }
        gallery = gallery.filter((_, index) => index !== indexToDelete);
        syncGallery();
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
            syncGallery();
        }
    }

    async function handleFileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

        const filesArray = Array.from(input.files);
        input.value = '';

        isCompressing = true;
        try {
            const compressedFiles = await Promise.all(
                filesArray.map(async (file) => {
                    return await compressImageFile(file, {
                        maxWidth: 1600,
                        maxHeight: 1600,
                        quality: 0.8,
                        mimeType: 'image/webp'
                    });
                })
            );

            const nouvellesImages: Image[] = [];
            compressedFiles.forEach((file, index) => {
                const temporaryUrl = URL.createObjectURL(file);
                const id = Date.now() + index + Math.floor(Math.random() * 1000);
                nouvellesImages.push({
                    id: id, 
                    url: temporaryUrl,
                });
                fileMap.set(id, file);
            });

            gallery = [...gallery, ...nouvellesImages];
            syncGallery();
        } catch (err) {
            console.error("Erreur lors de la compression des images :", err);
        } finally {
            isCompressing = false;
        }
    }

    function handleS3ImagesSelected(selectedS3Images: Array<{ key: string; url: string }>) {
        const newS3Items: Image[] = selectedS3Images.map((s3Img, idx) => ({
            id: Date.now() + idx + Math.floor(Math.random() * 1000),
            url: s3Img.url,
            s3_key: s3Img.key
        }));

        gallery = [...gallery, ...newS3Items];
        syncGallery();
    }
</script>

<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 w-full">
    {#each gallery as image, index (image.id)}
        <div 
            draggable="true"
            class="transition-all duration-300 relative group"
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

            {#if image.s3_key}
                <div class="absolute top-2 left-2 z-10 pointer-events-none">
                    <span class="badge badge-primary badge-xs gap-1 shadow-sm font-semibold">
                        ☁️ S3
                    </span>
                </div>
            {/if}
        </div>
    {/each}

    <!-- Bouton 1 : Téléverser un fichier local (avec compression auto) -->
    <label class="group relative flex flex-col items-center justify-center aspect-square w-full rounded-2xl border-2 border-dashed border-base-300 bg-base-100 hover:bg-base-200 hover:border-primary/50 transition-all cursor-pointer overflow-hidden {isCompressing ? 'opacity-70 pointer-events-none' : ''}">
        <input 
            multiple 
            onchange={handleFileChange} 
            type="file" 
            accept="image/*"
            class="hidden" 
            disabled={isCompressing}
        />
        
        <div class="flex flex-col items-center gap-3 p-3 text-center">
            {#if isCompressing}
                <div class="p-2.5 rounded-full bg-primary/10 text-primary">
                    <span class="loading loading-spinner loading-md text-primary"></span>
                </div>
                <div class="space-y-0.5">
                    <p class="text-xs font-bold text-primary">Optimisation...</p>
                    <p class="text-[10px] opacity-50">Compression WebP</p>
                </div>
            {:else}
                <div class="p-2.5 rounded-full bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                </div>
                <div class="space-y-0.5">
                    <p class="text-xs font-bold">Importer photos</p>
                    <p class="text-[10px] opacity-50">Fichiers locaux</p>
                </div>
            {/if}
        </div>
    </label>

    <!-- Bouton 2 : Choisir depuis S3 -->
    <button 
        type="button"
        onclick={() => isS3PickerOpen = true}
        class="group relative flex flex-col items-center justify-center aspect-square w-full rounded-2xl border-2 border-dashed border-info/40 bg-info/5 hover:bg-info/10 hover:border-info transition-all cursor-pointer overflow-hidden text-center p-3 gap-3"
    >
        <div class="p-2.5 rounded-full bg-info/10 text-info group-hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
        </div>
        <div class="space-y-0.5">
            <p class="text-xs font-bold text-info">Choisir sur S3</p>
            <p class="text-[10px] opacity-60">Photos cloud existantes</p>
        </div>
    </button>
</div>

<!-- Modal S3 Image Picker -->
<S3ImagePickerModal 
    isOpen={isS3PickerOpen}
    onclose={() => isS3PickerOpen = false}
    onselect={handleS3ImagesSelected}
/>
