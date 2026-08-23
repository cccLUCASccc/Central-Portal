<script lang="ts">
    import { filterStore } from "../../../store.svelte";
    import RetroSelect from "./RetroSelect.svelte";

    interface Props {
        data_string?: string | null;
        data_number?: number | null;
        data_bool?: boolean | null;
        type: number;
        type_name?: string;
        mode?: string;
    }

    let { data_string = $bindable(), data_number = $bindable(), data_bool = $bindable(), type, type_name, mode }: Props = $props();

    const statusOptions = [
        { value: null, label: "Tous les statuts" },
        { value: 0, label: "🟢 Actif" },
        { value: 1, label: "⚪ Inactif" },
        { value: 2, label: "🔴 Vendu" }
    ];

    const categoryOptionsFilter = [
        { value: "", label: "Toutes les catégories" },
        { value: "Mobilier", label: "🪑 Mobilier" },
        { value: "Objets d'art & Décoration", label: "🏺 Objets d'art & Décoration" },
        { value: "Art de la table", label: "🍽️ Art de la table" },
        { value: "Curiosités & Divers", label: "🔮 Curiosités & Divers" }
    ];

    const categoryOptionsForm = [
        { value: "Mobilier", label: "🪑 Mobilier" },
        { value: "Objets d'art & Décoration", label: "🏺 Objets d'art & Décoration" },
        { value: "Art de la table", label: "🍽️ Art de la table" },
        { value: "Curiosités & Divers", label: "🔮 Curiosités & Divers" }
    ];

    const nouveauteOptions = [
        { value: null, label: "Tout le catalogue" },
        { value: true, label: "⭐ Nouveautés uniquement" },
        { value: false, label: "Catalogues standards" }
    ];

    const sizeOptions = [
        { value: "S", label: "Petit (S) - Colis standard" },
        { value: "M", label: "Moyen (M) - Colis moyen" },
        { value: "L", label: "Grand (L) - Pièce volumineuse" },
        { value: "XL", label: "Très Grand (XL) - Transporteur" }
    ];

    const epoqueOptions = [
        { value: "vintage", label: "⏳ Vintage" },
        { value: "art-deco", label: "🏛️ Art Déco" },
        { value: "art-nouveau", label: "🌿 Art Nouveau" },
        { value: "avant 1850", label: "📜 Avant 1850" },
        { value: "contemporain", label: "✨ Contemporain" }
    ];
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
<!-- Statut Dropdown Customisé -->
<RetroSelect 
    label={type_name}
    options={statusOptions}
    bind:value={data_number}
    onchange={(val) => {
        if (mode === 'filter') {
            filterStore.setStatus_filter(val !== null && val !== undefined ? Number(val) : null);
        }
    }}
/>

{:else if type === 5}
<!-- Catégorie Dropdown Customisé -->
<RetroSelect 
    label={type_name}
    options={mode === 'filter' ? categoryOptionsFilter : categoryOptionsForm}
    bind:value={data_string}
    onchange={(val) => {
        if (mode === 'filter') {
            filterStore.setCategory_filter(val || null);
        }
    }}
/>

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
<!-- Nouveauté Dropdown Customisé -->
<RetroSelect 
    label={type_name}
    options={nouveauteOptions}
    bind:value={data_bool}
    onchange={(val) => {
        if (mode === 'filter') {
            filterStore.setNouveaute_filter(val);
        }
    }}
/>

{:else if type === 8}
<!-- Taille Dropdown Customisé -->
<RetroSelect 
    label={type_name}
    options={sizeOptions}
    bind:value={data_string}
/>

{:else if type === 9}
<!-- Époque Dropdown Customisé -->
<RetroSelect 
    label={type_name || "Époque"}
    options={epoqueOptions}
    bind:value={data_string}
/>
{/if}