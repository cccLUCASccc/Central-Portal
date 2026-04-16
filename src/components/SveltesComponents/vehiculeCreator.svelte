<script lang="ts">
    import type { Image } from "../../type";
    import DataModifier from "./DataModifier.svelte";
    import ImagesContainer from "./ImagesContainer.svelte";

    let model = $state("");
    let description = $state("");
    let year = $state<number | undefined>();
    let price = $state<number | undefined>();
    let status = $state<number | undefined>();
    
    let images = $state<Image[]>([]); 
    let newFiles = $state<File[]>([]); 

    async function createVehicule() {
        const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
        const formData = new FormData();
        
        console.log("Création du véhicule :", { model, description, price, year, newFiles });
        
        formData.append("model", model);
        formData.append("description", description);
        
        if (price !== undefined) formData.append("price", price.toString());
        if (year !== undefined) formData.append("year", year.toString());
        if (status !== undefined) formData.append("status", status.toString());

        newFiles.forEach(file => {
            formData.append("image", file);  
        });

        const response = await fetch(`${PUBLIC_API_URL}/api/vehicules/add`, {
            method: "POST",
            body: formData 
        });

        if (response.ok) {
            alert("Véhicule créé avec succès ! ✨");
            window.location.href = "/"; 
        } else {
            alert("Erreur lors de la création du véhicule.");
        }
    }
</script>

<div class="flex flex-col w-full align-center justify-center">
    <DataModifier bind:data_string={model} type={1} type_name='Modele'/>
    <DataModifier bind:data_string={description} type={2}/>
    <DataModifier bind:data_number={year} type={3} type_name='Année'/>
    <DataModifier bind:data_number={price} type={3} type_name='Prix'/>
    <DataModifier bind:data_number={status} type={4} type_name='Status'/>
    
    <div class="grid grid-cols-2 gap-4 mt-8">
        <ImagesContainer 
            item={{ id: 0, model: model, description: description, price: price || 0, year: year || 0, sold: false, images: [], status: 1 }} 
            bind:images={images} 
            bind:new_Files={newFiles} 
        />
    </div>

    <button onclick={createVehicule} class="btn btn-primary mt-16 w-full">Créer</button>
</div>