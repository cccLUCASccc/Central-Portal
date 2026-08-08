<script lang="ts">
    import DataModifier from "../atoms/DataModifier.svelte";
    import ImagesContainer from "./ImagesContainer.svelte";
    import type { Antiquite, Subcategory } from "../../../type";
    import { apiFetch } from "../../../lib/api";
    import { untrack } from "svelte";

    interface Props {
        antiquite: Antiquite
    }

    let { antiquite }: Props = $props();
    
    let name = $state(antiquite.name);
    let description = $state(antiquite.description);

    let year = $state(antiquite.year);
    let price = $state(antiquite.price);
    let category = $state(antiquite.category);
    let subcategory_id = $state<number | null>(antiquite.subcategory_id ?? null);
    let subcategories = $state<Subcategory[]>([]);
    let size = $state(antiquite.size);
    let images = $state(antiquite.images);
    let status = $state(antiquite.status)
    let nouveaute = $state(antiquite.nouveaute ?? false);

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

    async function saveAntiquity(id: number): Promise<boolean> {
        const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
        const formData = new FormData();
        
        formData.append("name", name);
        formData.append("description", description);
        formData.append("category", category);
        formData.append("subcategory_id", subcategory_id !== null ? subcategory_id.toString() : "");
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

        try {
            const response = await apiFetch(`${PUBLIC_API_URL}/api/antiquites/${id}`, {
                method: "PATCH",
                body: formData 
            });
            return response.ok;
        } catch (error) {
            console.error("Error saving antiquity:", error);
            return false;
        }
    }

    import { onMount } from "svelte";

    let isSaving = $state(false);

    async function saveAndNavigate(targetId: number, path: string = 'antiquites') {
        if (isSaving) return;
        isSaving = true;
        const ok = await saveAntiquity(antiquite.id);
        isSaving = false;
        if (ok) {
            window.location.href = `/${path}/${targetId}`;
        } else {
            alert("❌ Erreur lors de l'enregistrement de l'objet. Navigation annulée.");
        }
    }

    onMount(() => {
        (window as any).saveAndNavigateTo = (targetId: number, path: string = 'antiquites') => {
            saveAndNavigate(targetId, path);
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            const activeElement = document.activeElement;
            if (activeElement) {
                const tagName = activeElement.tagName.toLowerCase();
                const isContentEditable = activeElement.getAttribute('contenteditable') === 'true';
                if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || isContentEditable) {
                    return;
                }
            }

            if (e.key === 'ArrowLeft' && antiquite.prev_id) {
                saveAndNavigate(antiquite.prev_id, 'antiquites');
            } else if (e.key === 'ArrowRight' && antiquite.next_id) {
                saveAndNavigate(antiquite.next_id, 'antiquites');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            delete (window as any).saveAndNavigateTo;
        };
    });

    async function modifyAntiquity(id: number) {
        isSaving = true;
        const ok = await saveAntiquity(id);
        isSaving = false;
        if (ok) {
            alert("Objet mis à jour avec succès ! ✨");
            window.history.back();
        } else {
            alert("Une erreur est survenue lors de la mise à jour de l'objet.");
        }
    }
    let isPublishingFB = $state(false);

    async function publishToFacebook(id: number) {
        if (!confirm("Voulez-vous enregistrer les modifications et publier cet objet sur la Page Facebook et l'ajouter au Catalogue ?")) return;
        
        isPublishingFB = true;
        const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
        try {
            const saved = await saveAntiquity(id);
            if (!saved) {
                alert("❌ Impossible d'enregistrer les modifications de l'objet. Publication annulée.");
                return;
            }

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
        if (!confirm("Voulez-vous enregistrer les modifications et publier/mettre à jour cet objet sur eBay ?")) return;
        
        isPublishingEbay = true;
        const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
        
        try {
            const saved = await saveAntiquity(id);
            if (!saved) {
                alert("❌ Impossible d'enregistrer les modifications de l'objet. Publication/Mise à jour annulée.");
                return;
            }

            const response = await apiFetch(`${PUBLIC_API_URL}/api/antiquites/${id}/publish-ebay`, {
                method: "POST",
            });

            const res = await response.json();
            if (response.ok) {
                alert(`✅ ${res.message || "Objet synchronisé sur eBay avec succès !"} \nListing ID: ${res.listingId}`);
            } else {
                alert(`❌ Erreur lors de la publication/mise à jour : ${res.error || 'Erreur inconnue'}`);
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
            
            <fieldset class="fieldset">
                <legend class="fieldset-legend font-semibold">Sous-catégorie</legend>
                <select bind:value={subcategory_id} class="select select-bordered w-full rounded-md">
                    <option value={null}>Aucune sous-catégorie</option>
                    {#each subcategories as sub}
                        <option value={sub.id}>{sub.name}</option>
                    {/each}
                </select>
            </fieldset>

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
    <div class="flex flex-col sm:flex-row justify-between items-center gap-4 mt-12 pt-6 border-t border-base-200">
        <div class="flex gap-2 w-full sm:w-auto justify-center sm:justify-start">
            {#if antiquite.id}
            <button 
                onclick={() => publishToFacebook(antiquite.id)} 
                disabled={isPublishingFB}
                class="btn btn-sm bg-[#1877F2] hover:bg-[#0C5DC7] text-white border-none shadow-md"
            >
                {#if isPublishingFB}
                    <span class="loading loading-spinner loading-xs"></span>
                {:else}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4 mr-1"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                {/if}
                Publier sur Facebook
            </button>
            {/if}
        </div>
        
        <div class="flex flex-wrap items-center justify-center sm:justify-end gap-3 w-full sm:w-auto">
            {#if antiquite.prev_id || antiquite.next_id}
                <div class="join shadow-xs">
                    {#if antiquite.prev_id}
                        <button 
                            type="button"
                            onclick={() => saveAndNavigate(antiquite.prev_id!)}
                            disabled={isSaving}
                            class="join-item btn btn-outline btn-sm gap-1"
                            title="Enregistrer et aller à l'objet précédent (←)"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                            <span>Enregistrer & Précédent</span>
                        </button>
                    {/if}

                    {#if antiquite.next_id}
                        <button 
                            type="button"
                            onclick={() => saveAndNavigate(antiquite.next_id!)}
                            disabled={isSaving}
                            class="join-item btn btn-outline btn-sm gap-1"
                            title="Enregistrer et aller à l'objet suivant (→)"
                        >
                            <span>Enregistrer & Suivant</span>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                        </button>
                    {/if}
                </div>
            {/if}
            
            <div class="flex items-center gap-2">
                <button onclick={() => window.history.back()} class="btn btn-ghost btn-sm">Annuler</button>
                <button onclick={() => {modifyAntiquity(antiquite.id)}} disabled={isSaving} class="btn btn-primary btn-sm px-6 shadow-lg shadow-primary/20">
                    {#if isSaving}
                        <span class="loading loading-spinner loading-xs mr-2"></span>
                    {:else}
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mr-2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                    {/if}
                    Enregistrer les modifications
                </button>
            </div>
        </div>
    </div>
</div>