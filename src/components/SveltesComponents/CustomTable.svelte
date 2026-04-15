<script lang="ts">
  import type { Vehicule } from '../../type'
  
  let { vehicules }: { vehicules: Vehicule[] } = $props()

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', { 
      style: 'currency', 
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(price);
  };

  async function handleDelete(id: number){
      const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
      
      await fetch(`${PUBLIC_API_URL}/api/vehicules/${id}`, {
            method: "DELETE",
            body: "" 
        });
      
      window.location.reload;
  }
</script>

<div class="overflow-x-auto bg-base-100 rounded-xl shadow-sm">
  <table class="table table w-full">
    <thead>
      <tr>
        <th>
          <label>
            <input type="checkbox" class="checkbox checkbox-sm" />
          </label>
        </th>
        <th>Aperçu</th>
        <th>Modèle</th>
        <th>Description</th>
        <th>Prix</th>
        <th>Statut</th>
        <th>Supprimer</th>
      </tr>
    </thead>
    
    <tbody>
       {#each vehicules as vehicule (vehicule.id)}
        <tr class="hover:bg-pink-100 cursor-pointer" onclick={() => window.location.href =`/vehicules/${vehicule.id}`}>
          <th onclick={(e) => e.stopPropagation()}>
            <label>
              <input type="checkbox" class="checkbox checkbox-sm" />
            </label>
          </th>
          
          <td>
            <div class="w-24 h-24 rounded-lg overflow-hidden border border-base-300 shadow-sm">
              {#if vehicule.images && vehicule.images.length > 0}
                <img
                  class="w-full h-full object-cover"
                  src={vehicule.images[0].url}
                  alt={vehicule.model} 
                />
              {:else}
                <div class="w-full h-full bg-base-200 flex items-center justify-center text-xs opacity-50">
                  Sans image
                </div>
              {/if}
            </div>
          </td>
          
          <td class="font-bold text-base">
            {vehicule.model}
          </td>
          
          <td class="max-w-xs">
            <p class="text-sm opacity-70 line-clamp-2" title={vehicule.description}>
              {vehicule.description}
            </p>
          </td>
          
          <td class="font-mono font-medium">
            {formatPrice(vehicule.price)}
          </td>
          
          <td>
            {#if vehicule.sold}
              <span class="badge badge-error badge-sm font-semibold">Vendu</span>
            {:else}
              <span class="badge badge-success badge-sm font-semibold">Disponible</span>
            {/if}
          </td>
          <td onclick={(e) => e.stopPropagation()} class="align-middle text-center">
            <button type="button" onclick={(e) => {handleDelete(vehicule.id)}} class="btn btn-primary rounded-xl btn-sm">X</button>
          </td>        
        </tr>
      {:else}
        <tr>
          <td colspan="7" class="text-center py-8 text-base-content/50">
            Aucun véhicule à afficher pour le moment.
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>