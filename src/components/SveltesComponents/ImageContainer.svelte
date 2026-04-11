<script lang="ts">
    interface Props {
        src: string;
        alt: string;
        class?: string;
    }

    let { 
        src, 
        alt, 
        class: className = "w-full h-auto" 
    }: Props = $props();
</script>

<img 
    src={src} 
    alt={alt} 
    class={`object-cover rounded-xl shadow-sm ${className}`} 
/>