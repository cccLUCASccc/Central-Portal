<script lang="ts">
    interface Props {
        name: string;
    }

    let { name }: Props = $props();
</script>

<input 
    type="text" 
    placeholder={name} 
    class="rounded-md px-4 py-4 w-full input"
/>