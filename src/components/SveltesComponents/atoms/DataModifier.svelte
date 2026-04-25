<script lang="ts">
    import { filterStore } from "../../../store.svelte";
    interface Props {
        data_string?: string;
        data_number?: number;
        type: number;
        type_name?: string;
        mode?: string;
    }

    let { data_string = $bindable(), data_number = $bindable(), type, type_name, mode }: Props = $props();
</script>

{#if type === 1}
<fieldset class="fieldset">
    <legend class="fieldset-legend">{type_name}</legend>
    <input 
        type="text" 
        placeholder={data_string}
        bind:value={data_string}
        class="rounded-md px-4 py-4 w-full input"
        oninput={(e) => {
            if (mode === 'filter') {
                const target = e.currentTarget as HTMLInputElement;
                if (type_name === 'Catégorie') filterStore.setCategory_filter(target.value || null);
            }
        }}
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
        oninput={(e) => {
            if (mode === 'filter') {
                const target = e.currentTarget as HTMLInputElement;
                const val = Number(target.value) || null;
                if (type_name === 'Prix Max') filterStore.setPrice_filter(val);
                if (type_name === 'Année') filterStore.setYear_filter(val);
            }
        }}
    />
</fieldset>

{:else if type === 4}
<fieldset class="fieldset">
    <legend class="fieldset-legend">{type_name}</legend>
    <select 
        bind:value={data_number} 
        class="select"
        onchange={(e) => {
            if (mode === 'filter') {
                const target = e.currentTarget as HTMLSelectElement;
                filterStore.setStatus_filter(target.value !== "" ? Number(target.value) : null);
            }
        }}
    >
        <option value={null}>Tous les statuts</option>
        <option value={0}>Actif</option>
        <option value={1}>Inactif</option>
        <option value={2}>Vendu</option>
    </select>
</fieldset>

{:else if type === 5}
<fieldset class="fieldset">
    <legend class="fieldset-legend">{type_name}</legend>
    <select 
        bind:value={data_string} 
        class="select"
        onchange={(e) => {
            if (mode === 'filter') {
                const target = e.currentTarget as HTMLSelectElement;
                filterStore.setCategory_filter(target.value || null);
            }
        }}
    >
        <option value={""}>Toutes les catégories</option>
        <option value={"Nouveauté"}>Nouveauté</option>
        <option value={"Mobilier"}>Mobilier</option>
        <option value={"Objets d'art & Décoration"}>Objets d'art & Décoration</option>
        <option value={"Art de la table"}>Art de la table</option>
    </select>
</fieldset>
{/if}