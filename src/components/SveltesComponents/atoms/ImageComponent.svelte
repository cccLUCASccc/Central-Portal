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

<div class="group relative aspect-square w-full overflow-hidden border-2 border-black {background} shadow-[3px_3px_0px_0px_#000] rounded-none">
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
            class="retro-btn bg-[#FFE600] hover:bg-[#fff066] text-xs p-1.5 shadow-[2px_2px_0px_0px_#000] flex items-center justify-center"
            title="Tourner la photo de 90° vers la droite"
        >
            <span class="material-symbols-outlined text-[16px]">rotate_right</span>
        </button>

        <!-- Bouton Supprimer -->
        <button 
            type="button" 
            onclick={(e) => { e.stopPropagation(); ondelete?.()} } 
            disabled={isRotating}
            class="retro-btn bg-[#FFC2D1] hover:bg-[#fa99ad] text-xs p-1.5 shadow-[2px_2px_0px_0px_#000] flex items-center justify-center"
            title="Supprimer la photo"
        >
            <span class="material-symbols-outlined text-[16px]">delete</span>
        </button>
    </div>

    <!-- Drag Handle Indicator -->
    <div class="absolute top-1.5 right-1.5 p-0.5 bg-white border border-black opacity-0 group-hover:opacity-100 transition-opacity shadow-[1px_1px_0px_0px_#000] pointer-events-none flex items-center justify-center">
        <span class="material-symbols-outlined text-[14px] text-black">drag_indicator</span>
    </div>
</div>
