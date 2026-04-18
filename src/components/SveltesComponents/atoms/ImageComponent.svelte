<script lang="ts">
    interface Props {
        src: string;
        alt: string;
        class?: string;
        ondelete?: () => void
    }

    let { 
        src, 
        alt, 
        class: className = "w-full h-auto",
        ondelete
    }: Props = $props();
</script>

<div class="relative w-fit h-fit">
    <button type="button" on:click={() => ondelete?.()} class="absolute z-50 top-2 right-2 bg-black/90 text-white hover:bg-gray-800 cursor-pointer rounded-full w-8 h-8 flex items-center justify-center shadow-md transition-all">X</button>
    <img 
        src={src} 
        alt={alt} 
        class={`object-cover rounded-xl shadow-sm ${className}`}
    />
</div>
