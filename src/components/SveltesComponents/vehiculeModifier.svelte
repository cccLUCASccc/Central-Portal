<script lang="ts">
    import DataModifier from "./DataModifier.svelte";
    import ImagesContainer from "./ImagesContainer.svelte";
    import type { Vehicule } from "../../type";

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

<div class="flex flex-col w-full align-center justify-center">
    <DataModifier bind:data_string={model} type={1} type_name='Modele'/>
    <DataModifier bind:data_string={description} type={2}/>
    <DataModifier bind:data_number={year} type={3} type_name='Année'/>
    <DataModifier bind:data_number={price} type={3} type_name='Prix'/>
    <DataModifier bind:data_number={status} type={4} type_name="Status"/>
    
    <div class="grid grid-cols-2 gap-4 mt-8">
        <ImagesContainer 
            item={vehicule} 
            bind:images={images} 
            bind:new_Files={newFiles} 
        />
    </div>

    <button onclick={() => {modifyVehicule(vehicule.id)}} class="btn btn-primary mt-16 w-full">Save</button>
</div>