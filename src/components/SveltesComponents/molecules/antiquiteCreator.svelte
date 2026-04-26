<script lang="ts">
    import type { Image } from "../../../type";
    import DataModifier from "../atoms/DataModifier.svelte";
    import ImagesContainer from "./ImagesContainer.svelte";

    let name = $state("");
    let description = $state("");
    let year = $state<number>(new Date().getFullYear());
    let price = $state<number>(0);
    let status = $state<number>(0);
    let category = $state("");
    let nouveaute = $state(false);
    
    let images = $state<Image[]>([]); 
    let newFiles = $state<File[]>([]); 

    async function createAntiquity() {
        const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
        const formData = new FormData();
        
        formData.append("name", name);
        formData.append("description", description);
        formData.append("price", price.toString());
        formData.append("year", year.toString());
        formData.append("status", status.toString());
        formData.append("category", category);
        formData.append("nouveaute", nouveaute.toString());

        newFiles.forEach(file => {
            formData.append("image", file);  
        });

        const response = await fetch(`${PUBLIC_API_URL}/api/antiquites/add`, {
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
            <DataModifier bind:data_string={description} type={2} type_name='Description'/>
        </div>
        <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
                <DataModifier bind:data_number={year} type={3} type_name='Année'/>
                <DataModifier bind:data_number={status} type={4} type_name="Statut"/>
            </div>
            <DataModifier bind:data_number={price} type={3} type_name='Prix'/>
            <DataModifier bind:data_string={category} type={1} type_name='Catégorie'/>
            
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
