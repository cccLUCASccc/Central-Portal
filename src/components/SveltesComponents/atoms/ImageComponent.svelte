<script lang="ts">
    interface Props {
        src: string;
        alt: string;
        class?: string;
        background?: string;
        ondelete?: () => void
    }

    let { 
        src, 
        alt, 
        class: className = "",
        background = "bg-white",
        ondelete
    }: Props = $props();
</script>

<div class="group relative aspect-square w-full overflow-hidden rounded-2xl border border-base-300 {background} shadow-sm hover:shadow-md transition-all duration-300">
    {#if import.meta.env.PUBLIC_DISABLE_IMAGES !== "true"}
        <img 
            src={src} 
            alt={alt} 
            class="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
        />
    {:else}
        <div class="h-full w-full flex items-center justify-center bg-base-200 text-xs font-bold opacity-30">
            IMAGE OFF
        </div>
    {/if}
    
    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2">
        <button 
            type="button" 
            onclick={() => ondelete?.()} 
            class="btn btn-error btn-circle btn-sm shadow-lg hover:scale-110 active:scale-95 transition-transform"
            title="Supprimer l'image"
        >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
    </div>

    <!-- Drag Handle Indicator (Visible on hover) -->
    <div class="absolute top-2 left-2 p-1.5 bg-base-100/80 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4 opacity-50"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
    </div>
</div>
