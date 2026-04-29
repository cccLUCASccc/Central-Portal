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
    let images = $state(antiquite.images);
    let status = $state(antiquite.status)
    
    let newFiles = $state<File[]>([]); 

    async function modifyAntiquity(id: number) {
        const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
        
        const formData = new FormData();
        
        console.log("Valeurs envoyées :", { name, description, category, price, year, newFiles });
        
        formData.append("name", name);
        formData.append("description", description);
        formData.append("category", category);
        formData.append("price", price.toString());
        formData.append("year", year.toString());
        formData.append("status", status.toString());

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
            window.location.href = '/'
        }

        return response;
    }
    
</script>

<div class="space-y-6 max-w-4xl mx-auto">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-4">
            <DataModifier bind:data_string={name} type={1} type_name='Nom'/>
            <DataModifier bind:data_string={description} type={2} type_name='Description'/>
        </div>
        <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
                <DataModifier bind:data_number={year} type={3} type_name='Année'/>
                <DataModifier bind:data_number={status} type={4} type_name="Statut"/>
            </div>
            <DataModifier bind:data_number={price} type={3} type_name='Prix'/>
            <DataModifier bind:data_string={category} type={5} type_name='Catégorie'/>
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

    <div class="flex justify-end gap-4 mt-12 pt-6 border-t border-base-200">
        <button onclick={() => window.location.href = '/'} class="btn btn-ghost">Annuler</button>
        <button onclick={() => {modifyAntiquity(antiquite.id)}} class="btn btn-primary px-10 shadow-lg shadow-primary/20">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
            Enregistrer les modifications
        </button>
    </div>
</div>