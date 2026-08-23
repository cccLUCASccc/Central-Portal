<script lang="ts">
    import { apiFetch } from "../../../lib/api";
    import type { Image, Subcategory } from "../../../type";
    import { untrack } from "svelte";
    import DataModifier from "../atoms/DataModifier.svelte";
    import ImagesContainer from "./ImagesContainer.svelte";
    import RetroSelect from "../atoms/RetroSelect.svelte";

    let name = $state("");
    let description = $state("");
    let year = $state("vintage");
    let price = $state<number>(0);
    let quantity = $state<number>(1);
    let status = $state<number>(0);
    let category = $state("Mobilier");
    let subcategories = $state<Subcategory[]>([]);
    let subcategory_id = $state<number | null>(null);
    let size = $state("S");
    let nouveaute = $state(false);

    // Charge les sous-catégories à chaque fois que la catégorie change
    $effect(() => {
        const currentCategory = category;
        if (currentCategory) {
            const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
            fetch(`${PUBLIC_API_URL}/front/subcategories?category=${encodeURIComponent(currentCategory)}`)
                .then(res => {
                    if (res.ok) return res.json();
                    return [];
                })
                .then(data => {
                    subcategories = data;
                    untrack(() => {
                        if (subcategory_id !== null && !subcategories.find(s => Number(s.id) === Number(subcategory_id))) {
                            subcategory_id = null;
                        }
                    });
                })
                .catch(err => console.error("Error fetching subcategories:", err));
        } else {
            subcategories = [];
            subcategory_id = null;
        }
    });

    let subcatOptions = $derived([
        { value: null, label: "Aucune sous-catégorie" },
        ...subcategories.map(s => ({ value: s.id, label: s.name }))
    ]);
    
    let ebayTitle = $state("");
    let ebayDescription = $state("");
    let ebayPrice = $state<number>(0);
    let ebayCategoryID = $state("");
    
    let isCreating = $state(false);
    let isEnhancing = $state(false);
    let images = $state<Image[]>([]); 
    let newFiles = $state<File[]>([]); 
    let s3Keys = $state<string[]>([]); 

    async function enhanceDescription() {
        if (!name || !category) {
            alert("Veuillez renseigner le nom et la catégorie pour aider l'IA.");
            return;
        }

        isEnhancing = true;
        const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
        
        try {
            const response = await apiFetch(`${PUBLIC_API_URL}/api/ai/enhance`, {
                method: "POST",
                body: JSON.stringify({
                    name,
                    category,
                    description
                })
            });

            if (response.ok) {
                const result = await response.json();
                description = result.enhanced_description;
            } else {
                alert("Erreur lors de l'amélioration de la description.");
            }
        } catch (error) {
            console.error("Error enhancing description:", error);
            alert("Une erreur est survenue avec l'IA.");
        } finally {
            isEnhancing = false;
        }
    }

    async function createAntiquity() {
        if (isCreating) return;
        isCreating = true;
        const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
        const formData = new FormData();
        
        formData.append("name", name);
        formData.append("description", description);
        formData.append("price", price.toString());
        formData.append("quantity", (quantity !== null && quantity !== undefined ? quantity : 1).toString());
        formData.append("year", year.toString());
        formData.append("status", status.toString());
        formData.append("category", category);
        formData.append("subcategory_id", subcategory_id !== null ? subcategory_id.toString() : "");
        formData.append("size", size);
        formData.append("nouveaute", nouveaute.toString());
        formData.append("ebay_title", ebayTitle);
        formData.append("ebay_description", ebayDescription);
        formData.append("ebay_price", ebayPrice !== null ? ebayPrice.toString() : "0");
        formData.append("ebay_category_id", ebayCategoryID);

        if (s3Keys.length > 0) {
            formData.append("s3_keys", s3Keys.join(","));
        }

        newFiles.forEach(file => {
            formData.append("image", file);  
        });

        try {
            const response = await apiFetch(`${PUBLIC_API_URL}/api/antiquites/add`, {
                method: "POST",
                body: formData 
            });

            if (response.ok) {
                alert("Objet créé avec succès ! ✨");
                window.location.href = "/antiquites"; 
            } else {
                alert("Erreur lors de la création de l'objet.");
            }
        } catch (error) {
            console.error("Error creating object:", error);
            alert("Une erreur de connexion est survenue.");
        } finally {
            isCreating = false;
        }
    }
</script>

<div class="space-y-6 max-w-4xl mx-auto font-mono">
    <!-- Header Rétro -->
    <div class="retro-card-mint p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <div class="flex items-center gap-2">
                <span class="retro-badge bg-black text-white text-[10px]">NOUVELLE ENTRÉE</span>
                <span class="text-xs font-bold text-black/70">ENREGISTREMENT CATALOGUE</span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-black uppercase tracking-tight text-black mt-1">
                Créer une Nouvelle Antiquité
            </h1>
            <p class="text-xs text-black/80 mt-0.5">Remplissez les détails pour enregistrer la pièce dans la base.</p>
        </div>
        <div class="retro-icon-box bg-white">
            ✍️
        </div>
    </div>

    <!-- Formulaire Principal -->
    <div class="retro-card p-6 space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Colonne 1 : Nom & Description -->
            <div class="space-y-4">
                <DataModifier bind:data_string={name} type={1} type_name='Nom de la pièce'/>
                
                <div class="relative flex flex-col gap-1">
                    <div class="flex items-center justify-between">
                        <label class="text-xs font-bold uppercase tracking-wider text-black">Description</label>
                        <button 
                            onclick={enhanceDescription} 
                            disabled={isEnhancing}
                            class="retro-btn text-[11px] py-1 px-2.5 bg-[#FFE600] hover:bg-[#fff066]"
                        >
                            {#if isEnhancing}
                                <span class="loading loading-spinner loading-xs"></span>
                            {:else}
                                🪄 Améliorer IA
                            {/if}
                        </button>
                    </div>
                    <textarea 
                        class="retro-input h-48 resize-y" 
                        placeholder="Description détaillée de l'objet, époque, matière, état..." 
                        bind:value={description}
                    ></textarea>
                </div>
            </div>

            <!-- Colonne 2 : Données Techniques -->
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-3">
                    <DataModifier bind:data_string={year} type={9} type_name='Époque'/>
                    <DataModifier bind:data_number={status} type={4} type_name="Statut boutique"/>
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <DataModifier bind:data_number={price} type={3} type_name='Prix de vente (€)'/>
                    <DataModifier bind:data_number={quantity} type={3} type_name='Quantité en stock'/>
                </div>
                
                <DataModifier bind:data_string={category} type={5} type_name='Catégorie Principale'/>
                
                <RetroSelect
                    label="Sous-catégorie"
                    options={subcatOptions}
                    bind:value={subcategory_id}
                />

                <DataModifier bind:data_string={size} type={8} type_name='Gabarit / Taille Livraison'/>
                
                <DataModifier bind:data_bool={nouveaute} type={6} type_name="Mettre en Nouveauté"/>
            </div>
        </div>

        <!-- Section Médias -->
        <div class="border-t-2 border-black pt-6">
            <div class="flex items-center gap-2 mb-4">
                <span class="retro-badge bg-[#FFD2A6] text-xs">PHOTOS</span>
                <h3 class="text-sm font-black uppercase tracking-wider text-black">Galerie & Visuels</h3>
            </div>
            
            <div class="p-4 bg-[#EDE9DF] border-2 border-black shadow-[3px_3px_0px_0px_#000]">
                <ImagesContainer 
                    mode="antiquites"
                    bind:images={images} 
                    bind:new_Files={newFiles} 
                    bind:s3_Keys={s3Keys}
                />
            </div>
        </div>

        <!-- Section eBay Optionnelle -->
        <div class="border-t-2 border-black pt-6">
            <details class="group border-2 border-black bg-[#F6F4EE] shadow-[3px_3px_0px_0px_#000]">
                <summary class="p-4 cursor-pointer font-black text-xs uppercase flex items-center justify-between bg-[#FFF394] select-none">
                    <div class="flex items-center gap-2">
                        <span>📦</span>
                        <span>Personnalisation des informations eBay (Optionnel)</span>
                    </div>
                    <span class="font-bold text-sm group-open:rotate-180 transition-transform">▼</span>
                </summary>
                
                <div class="p-4 space-y-4 border-t-2 border-black bg-white">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="space-y-3">
                            <div>
                                <label class="text-xs font-bold uppercase text-black block mb-1">Titre eBay</label>
                                <input type="text" placeholder={name || "Titre sur eBay..."} bind:value={ebayTitle} class="retro-input text-xs" />
                                <span class="text-[10px] text-black/60">Si vide, le nom principal sera utilisé.</span>
                            </div>
                            <div>
                                <label class="text-xs font-bold uppercase text-black block mb-1">Description eBay</label>
                                <textarea placeholder={description || "Description sur eBay..."} bind:value={ebayDescription} class="retro-input text-xs h-24"></textarea>
                            </div>
                        </div>

                        <div class="space-y-3">
                            <div>
                                <label class="text-xs font-bold uppercase text-black block mb-1">Prix Spécifique eBay (€)</label>
                                <input type="number" step="0.01" placeholder={price.toString()} bind:value={ebayPrice} class="retro-input text-xs" />
                            </div>
                            <div>
                                <label class="text-xs font-bold uppercase text-black block mb-1">ID Catégorie eBay</label>
                                <input type="text" placeholder="119168" bind:value={ebayCategoryID} class="retro-input text-xs" />
                            </div>
                        </div>
                    </div>
                </div>
            </details>
        </div>

        <!-- Boutons d'Action -->
        <div class="flex flex-wrap justify-end gap-3 pt-6 border-t-2 border-black">
            <button onclick={() => window.location.href = '/antiquites'} disabled={isCreating} class="retro-btn py-2 px-5 text-xs bg-white hover:bg-[#FFC2D1]">
                Annuler
            </button>
            <button onclick={createAntiquity} disabled={isCreating} class="retro-btn-primary py-2 px-8 text-xs font-black shadow-[4px_4px_0px_0px_#000]">
                {#if isCreating}
                    <span class="loading loading-spinner loading-xs mr-2"></span>
                    Création en cours...
                {:else}
                    ✨ Enregistrer l'objet
                {/if}
            </button>
        </div>
    </div>
</div>
