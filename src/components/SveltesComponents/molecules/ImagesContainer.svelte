<script lang="ts">
    import ImageComponent from '../atoms/ImageComponent.svelte';
    import S3ImagePickerModal from '../atoms/S3ImagePickerModal.svelte';
    import type { Vehicule, Image, Antiquite } from '../../../type';
    import { compressImageFile, rotateImage } from '../../../lib/imageCompressor';
    
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
    let rotatingIndex = $state<number | null>(null);
    
    const fileMap = new Map<number, File>();

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

    async function rotateImageAt(index: number) {
        const targetImage = gallery[index];
        if (!targetImage || rotatingIndex !== null) return;

        rotatingIndex = index;
        try {
            const existingFile = fileMap.get(targetImage.id);
            const source = existingFile || targetImage.url;

            const rotatedFile = await rotateImage(source, 90);
            const newUrl = URL.createObjectURL(rotatedFile);

            fileMap.set(targetImage.id, rotatedFile);

            const updatedGallery = [...gallery];
            updatedGallery[index] = {
                ...targetImage,
                url: newUrl,
                s3_key: undefined
            };

            gallery = updatedGallery;
            syncGallery();
        } catch (err) {
            console.error("Erreur lors de la rotation de l'image :", err);
            alert("Impossible de faire pivoter cette image.");
        } finally {
            rotatingIndex = null;
        }
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

<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 w-full">
    {#each gallery as image, index (image.id)}
        <div 
            draggable="true"
            class="transition-all duration-150 relative group cursor-grab active:cursor-grabbing"
            ondragstart={(e) => handleDragStart(e, image.id)}
            ondragover={(e) => { e.preventDefault(); isDraggingOver = true; }}
            ondragleave={() => isDraggingOver = false}
            ondrop={(e) => handleDrop(e, index)}
        >
            <ImageComponent
                src={image.url} 
                alt={antiquite?.name || "Objet"} 
                isRotating={rotatingIndex === index}
                onrotate={() => rotateImageAt(index)}
                ondelete={() => deleteImage(index)}
            />

            {#if image.s3_key}
                <div class="absolute top-2 left-2 z-10 pointer-events-none">
                    <span class="retro-badge bg-[#99E7DC] text-[10px] flex items-center gap-1">
                        <span class="material-symbols-outlined text-[12px]">cloud</span> S3
                    </span>
                </div>
            {/if}
        </div>
    {/each}

    <!-- Bouton 1 : Téléverser un fichier local -->
    <label class="group relative flex flex-col items-center justify-center aspect-square w-full border-2 border-dashed border-black bg-white hover:bg-[#D4E2FD] shadow-[3px_3px_0px_0px_#000] transition-all cursor-pointer overflow-hidden text-center p-3 {isCompressing ? 'opacity-70 pointer-events-none' : ''}">
        <input 
            multiple 
            onchange={handleFileChange} 
            type="file" 
            accept="image/*"
            class="hidden" 
            disabled={isCompressing}
        />
        
        <div class="flex flex-col items-center gap-2">
            {#if isCompressing}
                <span class="loading loading-spinner loading-md text-black"></span>
                <p class="text-xs font-mono font-bold uppercase text-black">Compression...</p>
            {:else}
                <div class="w-8 h-8 border-2 border-black bg-[#FFE600] flex items-center justify-center text-sm shadow-[2px_2px_0px_0px_#000]">
                    <span class="material-symbols-outlined text-[18px]">add</span>
                </div>
                <div class="space-y-0.5 font-mono">
                    <p class="text-xs font-bold uppercase text-black">Importer</p>
                    <p class="text-[10px] text-black/60">Fichiers locaux</p>
                </div>
            {/if}
        </div>
    </label>

    <!-- Bouton 2 : Choisir depuis S3 -->
    <button 
        type="button"
        onclick={() => isS3PickerOpen = true}
        class="group relative flex flex-col items-center justify-center aspect-square w-full border-2 border-dashed border-black bg-[#FFD2A6] hover:bg-[#fcae6c] shadow-[3px_3px_0px_0px_#000] transition-all cursor-pointer overflow-hidden text-center p-3"
    >
        <div class="w-8 h-8 border-2 border-black bg-white flex items-center justify-center text-sm shadow-[2px_2px_0px_0px_#000]">
            <span class="material-symbols-outlined text-[18px]">photo_library</span>
        </div>
        <div class="space-y-0.5 font-mono mt-2">
            <p class="text-xs font-bold uppercase text-black">Choisir sur S3</p>
            <p class="text-[10px] text-black/70">Images cloud</p>
        </div>
    </button>
</div>

<!-- Modal S3 Image Picker -->
<S3ImagePickerModal 
    isOpen={isS3PickerOpen}
    onclose={() => isS3PickerOpen = false}
    onselect={handleS3ImagesSelected}
/>
