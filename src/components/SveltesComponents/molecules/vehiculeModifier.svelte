<script lang="ts">
    import DataModifier from "../atoms/DataModifier.svelte";
    import ImagesContainer from "./ImagesContainer.svelte";
    import type { Vehicule } from "../../../type";

    interface Props {
        vehicule: Vehicule
    }

    let { vehicule }: Props = $props();
    
    let model = $state(vehicule.model);
    let description = $state(vehicule.description);
    let year = $state(vehicule.year);
    let price = $state(vehicule.price);
    let images = $state(vehicule.images);
    let status = $state(vehicule.status)
    
    let newFiles = $state<File[]>([]); 

    async function modifyVehicule(id: number) {
        const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
        
        const formData = new FormData();
        
        console.log("Valeurs envoyées :", { model, description, price, year, newFiles });
        
        formData.append("model", model);
        formData.append("description", description);
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

        const response = await fetch(`${PUBLIC_API_URL}/api/vehicules/${id}`, {
            method: "PATCH",
            body: formData 
        });

        if (response.ok) {
            alert("Véhicule mis à jour avec succès ! ✨");
            window.location.href = '/'
        }

        return response;
    }
    
</script>

<div class="space-y-6 max-w-4xl mx-auto">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-4">
            <DataModifier bind:data_string={model} type={1} type_name='Modèle'/>
            <DataModifier bind:data_string={description} type={2} type_name='Description'/>
        </div>
        <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
                <DataModifier bind:data_number={year} type={3} type_name='Année'/>
                <DataModifier bind:data_number={status} type={4} type_name="Statut"/>
            </div>
            <DataModifier bind:data_number={price} type={3} type_name='Prix'/>
        </div>
    </div>

    <div class="divider">Médias et Images</div>

    <div class="bg-base-200/30 p-4 rounded-2xl border border-base-200">
        <ImagesContainer 
            item={vehicule} 
            bind:images={images} 
            bind:new_Files={newFiles} 
        />
    </div>

    <div class="flex justify-end gap-4 mt-12 pt-6 border-t border-base-200">
        <button onclick={() => window.location.href = '/'} class="btn btn-ghost">Annuler</button>
        <button onclick={() => {modifyVehicule(vehicule.id)}} class="btn btn-primary px-10 shadow-lg shadow-primary/20">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
            Enregistrer les modifications
        </button>
    </div>
</div>