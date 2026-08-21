<script lang="ts">
    interface Props {
        src: string;
        alt: string;
        class?: string;
        background?: string;
        isRotating?: boolean;
        ondelete?: () => void;
        onrotate?: () => void;
    }

    let { 
        src, 
        alt, 
        class: className = "",
        background = "bg-white",
        isRotating = false,
        ondelete,
        onrotate
    }: Props = $props();
</script>

<div class="group relative aspect-square w-full overflow-hidden border-2 border-black {background} shadow-[3px_3px_0px_0px_#000] hover:shadow-[5px_5px_0px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-150 rounded-none">
    {#if import.meta.env.PUBLIC_DISABLE_IMAGES !== "true"}
        <img 
            src={src} 
            alt={alt} 
            class="h-full w-full object-contain p-1 {isRotating ? 'opacity-30 filter blur-xs' : ''} transition-all duration-200"
        />
    {:else}
        <div class="h-full w-full flex items-center justify-center bg-[#EDE9DF] text-xs font-mono font-bold opacity-40">
            [IMG_OFF]
        </div>
    {/if}

    {#if isRotating}
        <div class="absolute inset-0 bg-white/70 flex flex-col items-center justify-center gap-1 z-20">
            <span class="loading loading-spinner loading-sm text-black"></span>
            <span class="text-[9px] font-mono font-bold uppercase text-black">Rotation...</span>
        </div>
    {/if}
    
    <!-- Hover Action Overlay -->
    <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center gap-2 z-10">
        <!-- Bouton Tourner 90° -->
        <button 
            type="button" 
            onclick={(e) => { e.stopPropagation(); onrotate?.(); }} 
            disabled={isRotating}
            class="retro-btn bg-[#FFE600] hover:bg-[#fff066] text-xs p-2 py-1 shadow-[2px_2px_0px_0px_#000]"
            title="Tourner la photo de 90° vers la droite"
        >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
        </button>

        <!-- Bouton Supprimer -->
        <button 
            type="button" 
            onclick={(e) => { e.stopPropagation(); ondelete?.()} } 
            disabled={isRotating}
            class="retro-btn bg-[#FFC2D1] hover:bg-[#fa99ad] text-xs p-2 py-1 shadow-[2px_2px_0px_0px_#000]"
            title="Supprimer la photo"
        >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
    </div>

    <!-- Drag Handle Indicator -->
    <div class="absolute top-1.5 right-1.5 p-1 bg-white border border-black opacity-0 group-hover:opacity-100 transition-opacity shadow-[1px_1px_0px_0px_#000] pointer-events-none">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5 text-black"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
    </div>
</div>
