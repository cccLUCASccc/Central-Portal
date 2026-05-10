<script lang="ts">
    import { filterStore } from "../../../store.svelte";
    interface Props {
        data_string?: string;
        data_number?: number;
        data_bool?: boolean;
        type: number;
        type_name?: string;
        mode?: string;
    }

    let { data_string = $bindable(), data_number = $bindable(), data_bool = $bindable(), type, type_name, mode }: Props = $props();
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
        class="select w-full"
        onchange={(e) => {
            if (mode === 'filter') {
                const target = e.currentTarget as HTMLSelectElement;
                filterStore.setCategory_filter(target.value || null);
            }
        }}
    >
        {#if mode === 'filter'}
            <option value={""}>Toutes les catégories</option>
        {/if}
        <option value={"Mobilier"}>Mobilier</option>
        <option value={"Objets d'art & Décoration"}>Objets d'art & Décoration</option>
        <option value={"Art de la table"}>Art de la table</option>
        <option value={"Curiosités & Divers"}>Curiosités & Divers</option>
    </select>
</fieldset>

{:else if type === 6}
<fieldset class="fieldset flex flex-row items-center justify-between p-4 bg-base-200/50 rounded-xl border border-base-200">
    <legend class="fieldset-legend font-medium">{type_name}</legend>
    <div class="flex items-center gap-3">
        <span class="text-sm opacity-60">{data_bool ? 'Oui' : 'Non'}</span>
        <input 
            type="checkbox" 
            class="toggle toggle-primary" 
            bind:checked={data_bool} 
        />
    </div>
</fieldset>

{:else if type === 7}
<fieldset class="fieldset">
    <legend class="fieldset-legend">{type_name}</legend>
    <select 
        class="select w-full"
        onchange={(e) => {
            const target = e.currentTarget as HTMLSelectElement;
            const val = target.value === "true" ? true : target.value === "false" ? false : null;
            if (mode === 'filter') {
                filterStore.setNouveaute_filter(val);
            }
            data_bool = val as any;
        }}
    >
        <option value="">Tout</option>
        <option value="true">Nouveautés</option>
        <option value="false">Anciens</option>
    </select>
</fieldset>
{:else if type === 8}
<fieldset class="fieldset">
    <legend class="fieldset-legend">{type_name}</legend>
    <select 
        bind:value={data_string} 
        class="select w-full"
    >
        <option value={"S"}>Petit (S)</option>
        <option value={"M"}>Moyen (M)</option>
        <option value={"L"}>Grand (L)</option>
        <option value={"XL"}>Très Grand (XL)</option>
    </select>
</fieldset>
{/if}