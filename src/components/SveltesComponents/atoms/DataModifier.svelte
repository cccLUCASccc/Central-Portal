<script lang="ts">
    import { filterStore } from "../../../store.svelte";
    interface Props {
        data_string?: string | null;
        data_number?: number | null;
        data_bool?: boolean | null;
        type: number;
        type_name?: string;
        mode?: string;
    }

    let { data_string = $bindable(), data_number = $bindable(), data_bool = $bindable(), type, type_name, mode }: Props = $props();
</script>

{#if type === 1}
<div class="flex flex-col gap-1 w-full font-mono">
    <label class="text-xs font-bold uppercase tracking-wider text-black">{type_name}</label>
    <input 
        type="text" 
        placeholder={data_string || `Saisir ${type_name}...`}
        bind:value={data_string}
        class="retro-input"
        oninput={(e) => {
            if (mode === 'filter') {
                const target = e.currentTarget as HTMLInputElement;
                if (type_name === 'Catégorie') filterStore.setCategory_filter(target.value || null);
            }
        }}
    />
</div>

{:else if type === 2}
<div class="flex flex-col gap-1 w-full font-mono">
    <label class="text-xs font-bold uppercase tracking-wider text-black">Description</label>
    <textarea 
        class="retro-input h-28 resize-y" 
        placeholder={data_string || "Description détaillée..."} 
        bind:value={data_string}
    ></textarea>
</div>

{:else if type === 3}
<div class="flex flex-col gap-1 w-full font-mono">
    <label class="text-xs font-bold uppercase tracking-wider text-black">{type_name}</label>
    <input 
        type="number" 
        placeholder={data_number !== undefined && data_number !== null ? data_number.toString() : "0"}
        bind:value={data_number}
        class="retro-input"
        oninput={(e) => {
            if (mode === 'filter') {
                const target = e.currentTarget as HTMLInputElement;
                const val = Number(target.value) || null;
                if (type_name === 'Prix Max') filterStore.setPrice_filter(val);
                if (type_name === 'Année') filterStore.setYear_filter(val);
            }
        }}
    />
</div>

{:else if type === 4}
<div class="flex flex-col gap-1 w-full font-mono">
    <label class="text-xs font-bold uppercase tracking-wider text-black">{type_name}</label>
    <select 
        bind:value={data_number} 
        class="retro-select"
        onchange={(e) => {
            if (mode === 'filter') {
                const target = e.currentTarget as HTMLSelectElement;
                filterStore.setStatus_filter(target.value !== "" ? Number(target.value) : null);
            }
        }}
    >
        <option value={null}>Tous les statuts</option>
        <option value={0}>🟢 Actif</option>
        <option value={1}>⚪ Inactif</option>
        <option value={2}>🔴 Vendu</option>
    </select>
</div>

{:else if type === 5}
<div class="flex flex-col gap-1 w-full font-mono">
    <label class="text-xs font-bold uppercase tracking-wider text-black">{type_name}</label>
    <select 
        bind:value={data_string} 
        class="retro-select"
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
        <option value={"Mobilier"}>🪑 Mobilier</option>
        <option value={"Objets d'art & Décoration"}>🏺 Objets d'art & Décoration</option>
        <option value={"Art de la table"}>🍽️ Art de la table</option>
        <option value={"Curiosités & Divers"}>🔮 Curiosités & Divers</option>
    </select>
</div>

{:else if type === 6}
<div class="flex items-center justify-between p-3.5 bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000] font-mono">
    <span class="text-xs font-bold uppercase tracking-wider text-black">{type_name}</span>
    <label class="cursor-pointer flex items-center gap-2">
        <input 
            type="checkbox" 
            class="checkbox checkbox-sm border-2 border-black rounded-none bg-white checked:bg-[#99E7DC] checked:text-black" 
            bind:checked={data_bool} 
        />
        <span class="text-xs font-bold {data_bool ? 'text-black' : 'text-black/50'}">{data_bool ? 'OUI (Nouveauté)' : 'NON'}</span>
    </label>
</div>

{:else if type === 7}
<div class="flex flex-col gap-1 w-full font-mono">
    <label class="text-xs font-bold uppercase tracking-wider text-black">{type_name}</label>
    <select 
        class="retro-select"
        onchange={(e) => {
            const target = e.currentTarget as HTMLSelectElement;
            const val = target.value === "true" ? true : target.value === "false" ? false : null;
            if (mode === 'filter') {
                filterStore.setNouveaute_filter(val);
            }
            data_bool = val as any;
        }}
    >
        <option value="">Tout le catalogue</option>
        <option value="true">⭐ Nouveautés uniquement</option>
        <option value="false">Catalogues standards</option>
    </select>
</div>

{:else if type === 8}
<div class="flex flex-col gap-1 w-full font-mono">
    <label class="text-xs font-bold uppercase tracking-wider text-black">{type_name}</label>
    <select 
        bind:value={data_string} 
        class="retro-select"
    >
        <option value={"S"}>Petit (S) - Colis standard</option>
        <option value={"M"}>Moyen (M) - Colis moyen</option>
        <option value={"L"}>Grand (L) - Pièce volumineuse</option>
        <option value={"XL"}>Très Grand (XL) - Transporteur Meuble</option>
    </select>
</div>
{/if}