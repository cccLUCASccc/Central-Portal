<script lang="ts">
  import type { Vehicule } from '../../../type'
  
  let { vehicules }: { vehicules: Vehicule[] } = $props()

  let current_vehicules = $state(vehicules)

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', { 
      style: 'currency', 
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(price);
  };

  async function handleDelete(id: number){
      const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
      
      try {
        const response = await fetch(`${PUBLIC_API_URL}/api/vehicules/${id}`, {
              method: "DELETE"
        });
        if (response.ok) {
          current_vehicules = current_vehicules.filter(vehicule => vehicule.id !== id);
        }
      } catch (error) {
        console.error("Erreur lors de la suppression:", error);
      }
  }

  const statusList = [
    { label: "Actif", class: "badge-success" },
    { label: "Inactif", class: "badge-ghost" },
    { label: "Vendu", class: "badge-error" }
  ];
</script>

<div class="card bg-base-100 shadow-xl border border-base-200 overflow-hidden">
  <div class="overflow-x-auto">
    <table class="table table-zebra w-full">
      <thead class="bg-base-200/50">
        <tr>
          <th class="w-12">
            <input type="checkbox" class="checkbox checkbox-primary checkbox-sm" />
          </th>
          <th>Véhicule</th>
          <th>Description</th>
          <th class="text-right">Prix</th>
          <th class="text-center">Statut</th>
          <th class="text-right">Actions</th>
        </tr>
      </thead>
      
      <tbody>
         {#each current_vehicules as vehicule (vehicule.id)}
          <tr class="hover:bg-base-200/50 transition-colors group cursor-pointer" onclick={() => window.location.href =`/vehicules/${vehicule.id}`}>
            <th onclick={(e) => e.stopPropagation()}>
              <input type="checkbox" class="checkbox checkbox-primary checkbox-sm" />
            </th>
            
            <td>
              <div class="flex items-center gap-4">
                <div class="avatar">
                  <div class="mask mask-squircle w-16 h-16 bg-base-200 shadow-inner group-hover:scale-105 transition-transform">
                    {#if vehicule.images && vehicule.images.length > 0}
                      <img src={vehicule.images[0].url} alt={vehicule.model} />
                    {:else}
                      <div class="flex items-center justify-center h-full text-[10px] opacity-40 uppercase font-bold">N/A</div>
                    {/if}
                  </div>
                </div>
                <div>
                  <div class="font-bold text-lg">{vehicule.model}</div>
                  <div class="text-xs opacity-50 font-mono uppercase tracking-wider">ID: {vehicule.id}</div>
                </div>
              </div>
            </td>
            
            <td class="max-w-xs">
              <p class="text-sm opacity-70 line-clamp-2 leading-relaxed">
                {vehicule.description}
              </p>
            </td>
            
            <td class="text-right font-bold text-primary font-mono whitespace-nowrap">
              {formatPrice(vehicule.price)}
            </td>
            
            <td class="text-center">
                <span class="badge {statusList[vehicule.status]?.class || 'badge-ghost'} badge-sm font-bold uppercase tracking-tighter">
                  {statusList[vehicule.status]?.label || "Inconnu"}
                </span>
            </td>
            
            <td onclick={(e) => e.stopPropagation()} class="text-right">
              <div class="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <a href={`/vehicules/${vehicule.id}`} class="btn btn-ghost btn-xs btn-square">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                </a>
                <button type="button" onclick={() => handleDelete(vehicule.id)} class="btn btn-error btn-outline btn-xs btn-square">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                </button>
              </div>
            </td>        
          </tr>
        {:else}
          <tr>
            <td colspan="6" class="text-center py-20 bg-base-200/20">
              <div class="flex flex-col items-center gap-3">
                <span class="text-5xl opacity-20">📭</span>
                <p class="text-base-content/50 font-medium">Aucun véhicule à afficher pour le moment.</p>
                <a href="/vehicules/add" class="btn btn-primary btn-sm mt-2">Ajouter un véhicule</a>
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>