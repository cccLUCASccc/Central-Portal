<script lang="ts">
    import DataModifier from "../atoms/DataModifier.svelte";
    import ImagesContainer from "./ImagesContainer.svelte";
    import type { Antiquite } from "../../../type";
    import { apiFetch } from "../../../lib/api";

    interface Props {
        antiquite: Antiquite
    }

    let { antiquite }: Props = $props();
    
    let name = $state(antiquite.name);
    let description = $state(antiquite.description);
    let year = $state(antiquite.year);
    let price = $state(antiquite.price);
    let category = $state(antiquite.category);
    let size = $state(antiquite.size);
    let images = $state(antiquite.images);
    let status = $state(antiquite.status)
    let nouveaute = $state(antiquite.nouveaute ?? false);
    
    let ebayTitle = $state(antiquite.ebay_title ?? "");
    let ebayDescription = $state(antiquite.ebay_description ?? "");
    let ebayPrice = $state(antiquite.ebay_price ?? 0);
    let ebayCategoryID = $state(antiquite.ebay_category_id ?? "");
    let isPublishingEbay = $state(false);
    
    let isEnhancing = $state(false);
    let newFiles = $state<File[]>([]); 

    async function enhanceDescription() {
        console.log("🪄 [AI] Bouton Améliorer cliqué !");
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

    async function modifyAntiquity(id: number) {
        const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
        
        const formData = new FormData();
        
        console.log("Valeurs envoyées :", { name, description, category, size, price, year, nouveaute, newFiles });
        
        formData.append("name", name);
        formData.append("description", description);
        formData.append("category", category);
        formData.append("size", size);
        formData.append("price", price.toString());
        formData.append("year", year.toString());
        formData.append("status", status.toString());
        formData.append("nouveaute", nouveaute.toString());
        formData.append("ebay_title", ebayTitle);
        formData.append("ebay_description", ebayDescription);
        formData.append("ebay_price", ebayPrice !== null ? ebayPrice.toString() : "0");
        formData.append("ebay_category_id", ebayCategoryID);

        const existingIds = images
            .filter(img => !img.url.startsWith('blob:'))
            .map(img => img.id)
            .join(',');
        
        formData.append("existing_ids", existingIds);

        newFiles.forEach(file => {
            formData.append("new_images", file);  
        });

        const response = await apiFetch(`${PUBLIC_API_URL}/api/antiquites/${id}`, {
            method: "PATCH",
            body: formData 
        });

        if (response.ok) {
            alert("Objet mis à jour avec succès ! ✨");
            window.history.back();
        }

        return response;
    }
    let isPublishingFB = $state(false);

    async function publishToFacebook(id: number) {
        if (!confirm("Voulez-vous publier cet objet sur la Page Facebook et l'ajouter au Catalogue ?")) return;
        
        isPublishingFB = true;
        const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
        // The API endpoint requires the object to be saved first, but we can just trigger it.
        try {
            // Note: Make sure the object is saved before publishing!
            const response = await apiFetch(`${PUBLIC_API_URL}/api/antiquites/${id}/publish-facebook`, {
                method: "POST",
            });

            if (response.ok) {
                alert("✅ Objet publié avec succès sur Facebook et ajouté au catalogue !");
            } else {
                const res = await response.json();
                alert(`❌ Erreur lors de la publication : ${res.error || 'Erreur inconnue'}`);
            }
        } catch (error) {
            console.error("Error publishing to FB:", error);
            alert("Une erreur de connexion est survenue.");
        } finally {
            isPublishingFB = false;
        }
    }

    async function publishToEbay(id: number) {
        if (!confirm("Voulez-vous publier cet objet sur eBay ?")) return;
        
        isPublishingEbay = true;
        const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
        
        try {
            const response = await apiFetch(`${PUBLIC_API_URL}/api/antiquites/${id}/publish-ebay`, {
                method: "POST",
            });

            const res = await response.json();
            if (response.ok) {
                alert(`✅ Objet publié avec succès sur eBay ! \nListing ID: ${res.listingId}`);
            } else {
                alert(`❌ Erreur lors de la publication : ${res.error || 'Erreur inconnue'}`);
            }
        } catch (error) {
            console.error("Error publishing to eBay:", error);
            alert("Une erreur de connexion est survenue.");
        } finally {
            isPublishingEbay = false;
        }
    }

</script>

<div class="space-y-6 max-w-4xl mx-auto">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-4">
            <DataModifier bind:data_string={name} type={1} type_name='Nom'/>
            <div class="relative">
                <DataModifier bind:data_string={description} type={2} type_name='Description'/>
                <button 
                    onclick={enhanceDescription} 
                    disabled={isEnhancing}
                    class="btn btn-xs btn-outline btn-secondary absolute top-0 right-0 gap-1 border-none hover:bg-secondary/10"
                >
                    {#if isEnhancing}
                        <span class="loading loading-spinner loading-xs"></span>
                    {:else}
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3 h-3"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>
                    {/if}
                    Améliorer
                </button>
            </div>
        </div>
        <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
                <DataModifier bind:data_number={year} type={3} type_name='Année'/>
                <DataModifier bind:data_number={status} type={4} type_name="Statut"/>
            </div>
            <DataModifier bind:data_number={price} type={3} type_name='Prix'/>
            <DataModifier bind:data_string={category} type={5} type_name='Catégorie'/>
            <DataModifier bind:data_string={size} type={8} type_name='Taille'/>
            
            <DataModifier bind:data_bool={nouveaute} type={6} type_name="Nouveauté"/>
        </div>
    </div>

    <div class="divider">Médias et Images</div>
    
    <div class="bg-base-200/30 p-6 rounded-2xl border border-base-200">
        <ImagesContainer 
            antiquite={antiquite} 
            bind:images={images} 
            bind:new_Files={newFiles} 
            mode={"antiquites"}
        />
    </div>

    <div class="divider">eBay (Optionnel)</div>
    
    <div class="collapse collapse-arrow bg-base-200/30 border border-base-200 rounded-2xl">
        <input type="checkbox" class="peer" /> 
        <div class="collapse-title text-base font-bold flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            Personnaliser les informations eBay
        </div>
        <div class="collapse-content">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <div class="space-y-4">
                    <fieldset class="fieldset">
                        <legend class="fieldset-legend font-semibold">Titre de l'objet sur eBay</legend>
                        <input type="text" placeholder="Par défaut : {name}" bind:value={ebayTitle} class="input input-bordered w-full rounded-md" />
                        <span class="text-xs opacity-50">Si vide, le nom principal sera envoyé à eBay.</span>
                    </fieldset>
                    
                    <fieldset class="fieldset">
                        <legend class="fieldset-legend font-semibold">Description sur eBay</legend>
                        <textarea placeholder="Par défaut : {description}" bind:value={ebayDescription} class="textarea textarea-bordered h-28 w-full rounded-md"></textarea>
                        <span class="text-xs opacity-50">Si vide, la description principale sera envoyée à eBay.</span>
                    </fieldset>
                </div>
                
                <div class="space-y-4">
                    <fieldset class="fieldset">
                        <legend class="fieldset-legend font-semibold">Prix sur eBay (EUR)</legend>
                        <input type="number" step="0.01" placeholder="Par défaut : {price}" bind:value={ebayPrice} class="input input-bordered w-full rounded-md" />
                        <span class="text-xs opacity-50">Si à 0 ou vide, le prix standard sera envoyé.</span>
                    </fieldset>
                    
                    <fieldset class="fieldset">
                        <legend class="fieldset-legend font-semibold">ID Catégorie eBay</legend>
                        <input type="text" placeholder="Par défaut : 119168" bind:value={ebayCategoryID} class="input input-bordered w-full rounded-md" />
                        <span class="text-xs opacity-50">Saisissez l'ID de catégorie eBay (ex: 119168 pour Architecture/Matériaux).</span>
                    </fieldset>
                </div>
            </div>
        </div>
    </div>

    <div class="flex flex-col sm:flex-row justify-between items-center gap-4 mt-12 pt-6 border-t border-base-200">
        <div class="flex gap-2">
            {#if antiquite.id}
            <button 
                onclick={() => publishToFacebook(antiquite.id)} 
                disabled={isPublishingFB}
                class="btn bg-[#1877F2] hover:bg-[#0C5DC7] text-white border-none shadow-md"
            >
                {#if isPublishingFB}
                    <span class="loading loading-spinner loading-sm"></span>
                {:else}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 mr-1"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                {/if}
                Publier sur Facebook
            </button>
            <button 
                onclick={() => publishToEbay(antiquite.id)} 
                disabled={isPublishingEbay}
                class="btn bg-[#0064D2] hover:bg-[#0050a8] text-white border-none shadow-md"
            >
                {#if isPublishingEbay}
                    <span class="loading loading-spinner loading-sm"></span>
                {:else}
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" class="w-5 h-5 mr-1">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                {/if}
                Publier sur eBay
            </button>
            {/if}
        </div>
        
        <div class="flex gap-4">
            <button onclick={() => window.history.back()} class="btn btn-ghost">Annuler</button>
            <button onclick={() => {modifyAntiquity(antiquite.id)}} class="btn btn-primary px-10 shadow-lg shadow-primary/20">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                Enregistrer les modifications
            </button>
        </div>
    </div>
</div>