<script lang="ts">
    interface Props {
        data_string?: string;
        data_number?: number;
        type: number;
        type_name?: string;
    }

    let { data_string = $bindable(), data_number = $bindable(), type, type_name }: Props = $props();
</script>

{#if type === 1}
<fieldset class="fieldset">
    <legend class="fieldset-legend">{type_name}</legend>
    <input 
        type="text" 
        placeholder={data_string}
        bind:value={data_string}
        class="rounded-md px-4 py-4 w-full input"
    />
</fieldset>

{:else if type === 2}

<fieldset class="fieldset">
  <legend class="fieldset-legend">Description</legend>
  <textarea class="textarea h-24 w-full" placeholder={data_string} bind:value={data_string}></textarea>
</fieldset>

{:else if type === 3}
<fieldset class="fieldset">
    <legend class="fieldset-legend">{type_name}</legend>
    <input 
        type="number" 
        placeholder={data_number + ''}
        bind:value={data_number}
        class="rounded-md px-4 py-4 w-full input"
    />
</fieldset>

{/if}