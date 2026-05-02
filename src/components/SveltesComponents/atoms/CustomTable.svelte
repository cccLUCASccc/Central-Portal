<script lang="ts">
  import type { Vehicule, Antiquite } from '../../../type'
  import { apiFetch } from '../../../lib/api';

  interface Props {
      vehicules?: Vehicule[];
      antiquites?: Antiquite[];
      mode: string;
  }
  
  let { vehicules, antiquites, mode = $bindable() }: Props = $props()

  let current_vehicules = $state(vehicules || [])
  let current_antiquites = $state(antiquites || [])
  let selectedIds = $state<number[]>([])

  // Action pour téléporter l'élément vers le body (Portal)
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        if (node.parentNode) node.parentNode.removeChild(node);
      }
    };
  }

  // Synchronisation réactive pour le filtrage
  $effect(() => {
    current_antiquites = antiquites || [];
    current_vehicules = vehicules || [];
    selectedIds = []; 
  });

  let current_mode = $state(mode)

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', { 
      style: 'currency', 
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(price);
  };

  function toggleSelect(id: number) {
    if (selectedIds.includes(id)) {
      selectedIds = selectedIds.filter(i => i !== id);
    } else {
      selectedIds = [...selectedIds, id];
    }
  }

  function toggleAll() {
    const currentList = current_mode === 'vehicules' ? current_vehicules : current_antiquites;
    if (selectedIds.length === currentList.length && currentList.length > 0) {
      selectedIds = [];
    } else {
      selectedIds = currentList.map(item => item.id);
    }
  }

  async function bulkDelete() {
    if (!confirm(`Supprimer définitivement les ${selectedIds.length} éléments sélectionnés ?`)) return;
    
    const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
    const endpoint = current_mode === 'vehicules' ? 'vehicules' : 'antiquites';
    
    try {
      const promises = selectedIds.map(id => 
        apiFetch(`${PUBLIC_API_URL}/api/${endpoint}/${id}`, { method: "DELETE" })
      );
      
      await Promise.all(promises);
      
      if (current_mode === 'vehicules') {
        current_vehicules = current_vehicules.filter(v => !selectedIds.includes(v.id));
      } else {
        current_antiquites = current_antiquites.filter(a => !selectedIds.includes(a.id));
      }
      
      alert(`${selectedIds.length} éléments supprimés.`);
      selectedIds = [];
    } catch (error) {
      console.error("Erreur lors de la suppression groupée:", error);
      alert("Une erreur est survenue lors de la suppression.");
    }
  }

  async function DeleteVehicule(id: number){
      const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
      try {
        const response = await apiFetch(`${PUBLIC_API_URL}/api/vehicules/${id}`, { method: "DELETE" });
        if (response.ok) {
          current_vehicules = current_vehicules.filter(vehicule => vehicule.id !== id);
        }
      } catch (error) {
        console.error("Erreur lors de la suppression:", error);
      }
  }

  async function DeleteAntiquite(id: number){
      const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
      try {
        const response = await apiFetch(`${PUBLIC_API_URL}/api/antiquites/${id}`, { method: "DELETE" });
        if (response.ok) {
          current_antiquites = current_antiquites.filter(antiquite => antiquite.id !== id);
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

<div class="relative">
  <!-- Barre d'actions groupées flottante (Portalisée vers le body) -->
  {#if selectedIds.length > 0}
    <div use:portal class="fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div class="bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 border border-white/10">
        <div class="flex flex-col">
          <span class="font-bold text-sm text-white">{selectedIds.length} sélectionné(s)</span>
          <span class="text-[10px] opacity-60 uppercase tracking-widest text-white/70">Actions groupées</span>
        </div>
        
        <div class="h-8 w-px bg-white/20"></div>
        
        <div class="flex gap-2">
          <button onclick={bulkDelete} class="btn btn-error btn-sm border-none bg-red-500 hover:bg-red-600 text-white">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
            Supprimer
          </button>
          
          <button onclick={() => selectedIds = []} class="btn btn-ghost btn-sm hover:bg-white/10 text-white">Annuler</button>
        </div>
      </div>
    </div>
  {/if}

  {#if current_mode === "vehicules"}
  <div class="card bg-base-100 shadow-xl border border-base-200 overflow-hidden">
    <div class="overflow-x-auto">
      <table class="table table-zebra w-full">
        <thead class="bg-base-200/50">
          <tr>
            <th class="w-12">
              <input 
                type="checkbox" 
                class="checkbox checkbox-primary checkbox-sm" 
                checked={selectedIds.length === current_vehicules.length && current_vehicules.length > 0}
                onchange={toggleAll}
              />
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
            <tr class="hover:bg-base-200/50 transition-colors group cursor-pointer {selectedIds.includes(vehicule.id) ? 'bg-primary/10' : ''}" 
                onclick={() => window.location.href =`/vehicules/${vehicule.id}`}>
              <th onclick={(e) => e.stopPropagation()}>
                <input 
                  type="checkbox" 
                  class="checkbox checkbox-primary checkbox-sm" 
                  checked={selectedIds.includes(vehicule.id)}
                  onchange={() => toggleSelect(vehicule.id)}
                />
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
                    <div class="font-bold text-lg flex items-center gap-2">
                      {vehicule.model}
                      {#if vehicule.status === 2}
                        <span class="badge badge-error badge-xs font-bold text-[8px]">VENDU</span>
                      {/if}
                    </div>
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
                  <button type="button" onclick={() => DeleteVehicule(vehicule.id)} class="btn btn-error btn-outline btn-xs btn-square">
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
  {:else if current_mode === "antiquites"}
  <div class="card bg-base-100 shadow-xl border border-base-200 overflow-hidden">
    <div class="overflow-x-auto">
      <table class="table table-zebra w-full">
        <thead class="bg-base-200/50">
          <tr>
            <th class="w-12">
              <input 
                type="checkbox" 
                class="checkbox checkbox-primary checkbox-sm" 
                checked={selectedIds.length === current_antiquites.length && current_antiquites.length > 0}
                onchange={toggleAll}
              />
            </th>
            <th>Antiquité</th>
            <th>Description</th>
            <th class="text-right">Prix</th>
            <th class="text-center">Categorie</th>
            <th class="text-center">Statut</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        
        <tbody>
          {#each current_antiquites as antiquite (antiquite.id)}
            <tr class="hover:bg-base-200/50 transition-colors group cursor-pointer {selectedIds.includes(antiquite.id) ? 'bg-primary/10' : ''}" 
                onclick={() => window.location.href =`/antiquites/${antiquite.id}`}>
              <th onclick={(e) => e.stopPropagation()}>
                <input 
                  type="checkbox" 
                  class="checkbox checkbox-primary checkbox-sm" 
                  checked={selectedIds.includes(antiquite.id)}
                  onchange={() => toggleSelect(antiquite.id)}
                />
              </th>
              
              <td>
                <div class="flex items-center gap-4">
                  <div class="avatar">
                    <div class="mask mask-squircle w-16 h-16 bg-base-200 shadow-inner group-hover:scale-105 transition-transform">
                      {#if antiquite.images && antiquite.images.length > 0}
                        <img src={antiquite.images[0].url} alt={antiquite.name} />
                      {:else}
                        <div class="flex items-center justify-center h-full text-[10px] opacity-40 uppercase font-bold">N/A</div>
                      {/if}
                    </div>
                  </div>
                  <div>
                    <div class="font-bold text-lg flex items-center gap-2">
                      {antiquite.name}
                      {#if antiquite.status === 2}
                        <span class="badge badge-error badge-xs font-bold text-[8px]">VENDU</span>
                      {/if}
                      {#if antiquite.nouveaute}
                        <span class="badge badge-primary badge-xs font-bold text-[8px]">NOUVEAUTÉ</span>
                      {/if}
                    </div>
                    <div class="text-xs opacity-50 font-mono uppercase tracking-wider">ID: {antiquite.id}</div>
                  </div>
                </div>
              </td>
              
              <td class="max-w-xs">
                <p class="text-sm opacity-70 line-clamp-2 leading-relaxed">
                  {antiquite.description}
                </p>
              </td>
              
              <td class="text-right font-bold text-primary font-mono whitespace-nowrap">
                {formatPrice(antiquite.price)}
              </td>

              <td class="text-center">
                  <span class="badge badge-info h-auto py-1 px-3 font-bold uppercase text-[10px] leading-tight text-center">
                    {antiquite.category || "Inconnu"}
                  </span>
              </td>
              
              <td class="text-center">
                  <span class="badge {statusList[antiquite.status]?.class || 'badge-ghost'} badge-sm font-bold uppercase tracking-tighter">
                    {statusList[antiquite.status]?.label || "Inconnu"}
                  </span>
              </td>
              
              <td onclick={(e) => e.stopPropagation()} class="text-right">
                <div class="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a href={`/antiquites/${antiquite.id}`} class="btn btn-ghost btn-xs btn-square">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                  </a>
                  <button type="button" onclick={() => DeleteAntiquite(antiquite.id)} class="btn btn-error btn-outline btn-xs btn-square">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                  </button>
                </div>
              </td>        
            </tr>
          {:else}
            <tr>
              <td colspan="7" class="text-center py-20 bg-base-200/20">
                <div class="flex flex-col items-center gap-3">
                  <span class="text-5xl opacity-20">📭</span>
                  <p class="text-base-content/50 font-medium">Aucun objet à afficher pour le moment.</p>
                  <a href="/antiquites/add" class="btn btn-primary btn-sm mt-2">Ajouter un objet</a>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
  {/if}
</div>
