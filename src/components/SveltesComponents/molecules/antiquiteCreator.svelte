<script lang="ts">
    import { apiFetch } from "../../../lib/api";
    import type { Image } from "../../../type";
    import DataModifier from "../atoms/DataModifier.svelte";
    import ImagesContainer from "./ImagesContainer.svelte";

    let name = $state("");
    let description = $state("");
    let year = $state<number>(new Date().getFullYear());
    let price = $state<number>(0);
    let status = $state<number>(0);
    let category = $state("Mobilier");
    let size = $state("S");
    let nouveaute = $state(false);
    
    let isEnhancing = $state(false);
    let images = $state<Image[]>([]); 
    let newFiles = $state<File[]>([]); 

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
        const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
        const formData = new FormData();
        
        formData.append("name", name);
        formData.append("description", description);
        formData.append("price", price.toString());
        formData.append("year", year.toString());
        formData.append("status", status.toString());
        formData.append("category", category);
        formData.append("size", size);
        formData.append("nouveaute", nouveaute.toString());

        newFiles.forEach(file => {
            formData.append("image", file);  
        });

        const response = await apiFetch(`${PUBLIC_API_URL}/api/antiquites/add`, {
            method: "POST",
            body: formData 
        });

        if (response.ok) {
            alert("Objet créé avec succès ! ✨");
            window.location.href = "/"; 
        } else {
            alert("Erreur lors de la création de l'objet.");
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
            mode="antiquites"
            bind:images={images} 
            bind:new_Files={newFiles} 
        />
    </div>

    <div class="flex justify-end gap-4 mt-12 pt-6 border-t border-base-200">
        <button onclick={() => window.location.href = '/'} class="btn btn-ghost">Annuler</button>
        <button onclick={() => createAntiquity()} class="btn btn-primary px-10 shadow-lg shadow-primary/20">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Créer l'objet
        </button>
    </div>
</div>
