<script lang="ts">
  import type { Antiquite, Subcategory } from '../../../type'
  import { apiFetch } from '../../../lib/api';
  import { onMount } from 'svelte';
  import QRCode from 'qrcode';

  interface Props {
      antiquites?: Antiquite[];
  }
  
  let { antiquites }: Props = $props()

  let current_antiquites = $state(antiquites || [])
  let selectedIds = $state<number[]>([])

  let subcategories = $state<Subcategory[]>([]);
  let isSubcatModalOpen = $state(false);
  let selectedSubcatId = $state<number | null>(null);
  let isUpdating = $state(false);

  onMount(async () => {
    const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
    try {
      const res = await fetch(`${PUBLIC_API_URL}/front/subcategories`);
      if (res.ok) {
        subcategories = await res.json();
      }
    } catch (e) {
      console.error("Error loading subcategories:", e);
    }
  });

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
    selectedIds = []; 
  });

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
    if (selectedIds.length === current_antiquites.length && current_antiquites.length > 0) {
      selectedIds = [];
    } else {
      selectedIds = current_antiquites.map(item => item.id);
    }
  }

  async function bulkDelete() {
    if (!confirm(`Supprimer définitivement les ${selectedIds.length} éléments sélectionnés ?`)) return;
    
    const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
    
    try {
      const promises = selectedIds.map(id => 
        apiFetch(`${PUBLIC_API_URL}/api/antiquites/${id}`, { method: "DELETE" })
      );
      
      await Promise.all(promises);
      
      current_antiquites = current_antiquites.filter(a => !selectedIds.includes(a.id));
      
      alert(`${selectedIds.length} éléments supprimés.`);
      selectedIds = [];
    } catch (error) {
      console.error("Erreur lors de la suppression groupée:", error);
      alert("Une erreur est survenue lors de la suppression.");
    }
  }

  async function bulkUpdateSubcategory() {
    if (selectedIds.length === 0) return;
    isUpdating = true;
    const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
    
    const selectedSubcat = subcategories.find(s => Number(s.id) === Number(selectedSubcatId));
    
    try {
      const promises = selectedIds.map(id => {
        const formData = new FormData();
        formData.append("subcategory_id", selectedSubcatId !== null ? selectedSubcatId.toString() : "null");
        if (selectedSubcat) {
          formData.append("category", selectedSubcat.category);
        }
        
        return apiFetch(`${PUBLIC_API_URL}/api/antiquites/${id}`, {
          method: "PATCH",
          body: formData
        });
      });
      
      await Promise.all(promises);
      
      // Mettre à jour l'état local immédiatement
      current_antiquites = current_antiquites.map(item => {
        if (selectedIds.includes(item.id)) {
          return {
            ...item,
            subcategory_id: selectedSubcatId ?? undefined,
            subcategory: selectedSubcat ?? undefined,
            category: selectedSubcat ? selectedSubcat.category : item.category
          };
        }
        return item;
      });
      
      alert(`Mise à jour réussie pour ${selectedIds.length} éléments.`);
      selectedIds = [];
      isSubcatModalOpen = false;
    } catch (error) {
      console.error("Erreur lors de la mise à jour groupée:", error);
      alert("Une erreur est survenue lors de la mise à jour.");
    } finally {
      isUpdating = false;
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

  let isPublishing = $state<Record<number, boolean>>({});

  async function PublishToEbay(id: number, e: Event){
      e.stopPropagation();
      const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
      isPublishing[id] = true;
      try {
        const response = await apiFetch(`${PUBLIC_API_URL}/api/antiquites/${id}/publish-ebay`, { method: "POST" });
        const result = await response.json();
        if (response.ok) {
          alert(`Succès: ${result.message}\nListing ID: ${result.listingId}`);
        } else {
          alert(`Erreur: ${result.error}`);
        }
      } catch (error) {
        console.error("Erreur lors de la publication:", error);
        alert("Une erreur est survenue lors de la publication sur eBay.");
      } finally {
        isPublishing[id] = false;
      }
  }

  async function printBulkQRCodes() {
    if (selectedIds.length === 0) return;
    
    const selectedItems = current_antiquites.filter(a => selectedIds.includes(a.id));
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Veuillez autoriser les pop-ups pour imprimer.");
      return;
    }
    
    let htmlContent = `
      <html>
        <head>
          <title>Impression Groupée - QR Codes</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; text-align: center; }
            .item { border: 1px dashed #ccc; padding: 15px; page-break-inside: avoid; }
            img { max-width: 150px; height: auto; margin-bottom: 10px; }
            h3 { font-size: 14px; margin: 0 0 5px 0; }
            p { font-size: 16px; font-weight: bold; margin: 0; }
            @media print {
              body { padding: 0; }
              .item { border: 1px solid #000; }
            }
          </style>
        </head>
        <body>
          <h2>Impression de ${selectedItems.length} QR Codes</h2>
          <div class="grid">
    `;
    
    for (const item of selectedItems) {
      const currentUrl = window.location.origin;
      const url = `${currentUrl}/inventoryt5hr4hr85g48412r/${item.id}`;
      try {
        const qrUrl = await QRCode.toDataURL(url, { margin: 1, width: 150 });
        htmlContent += `
          <div class="item">
            <img src="${qrUrl}" alt="QR Code ${item.id}" />
            <h3>${item.name}</h3>
            <p>${item.price} €</p>
          </div>
        `;
      } catch (err) {
        console.error("Erreur QR code pour", item.id, err);
      }
    }
    
    htmlContent += `
          </div>
          <scr` + `ipt>
            window.onload = function() { window.print(); window.close(); }
          </scr` + `ipt>
        </body>
      </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
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
          <button onclick={printBulkQRCodes} class="btn btn-outline btn-sm text-white hover:bg-white/10 border-white/20">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" /></svg>
            Imprimer QR Codes
          </button>

          <button onclick={() => { selectedSubcatId = null; isSubcatModalOpen = true; }} class="btn btn-outline btn-sm text-white hover:bg-white/10 border-white/20">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581a1.5 1.5 0 002.122 0l4.318-4.318a1.5 1.5 0 000-2.122L11.159 3.659A2.25 2.25 0 009.568 3z" /><path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6z" /></svg>
            Associer sous-catégorie
          </button>

          <button onclick={bulkDelete} class="btn btn-error btn-sm border-none bg-red-500 hover:bg-red-600 text-white">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
            Supprimer
          </button>
          
          <button onclick={() => selectedIds = []} class="btn btn-ghost btn-sm hover:bg-white/10 text-white">Annuler</button>
        </div>
      </div>
    </div>
  {/if}

  {#if isSubcatModalOpen}
    <div use:portal class="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4" onclick={() => isSubcatModalOpen = false}>
      <div class="bg-base-100 border border-base-200 rounded-2xl shadow-2xl p-6 max-w-md w-full space-y-4 animate-in fade-in zoom-in-95 duration-200" onclick={(e) => e.stopPropagation()}>
        <h3 class="text-lg font-bold text-base-content">Modifier la sous-catégorie</h3>
        <p class="text-sm text-base-content/70">
          Sélectionnez la nouvelle sous-catégorie à appliquer aux {selectedIds.length} éléments sélectionnés.
          La galerie parente des objets sera automatiquement mise en cohérence.
        </p>
        
        <fieldset class="fieldset">
          <legend class="fieldset-legend font-semibold">Sous-catégorie</legend>
          <select bind:value={selectedSubcatId} class="select select-bordered w-full rounded-md text-base-content">
            <option value={null}>Aucune sous-catégorie (Désassocier)</option>
            {#each ["Mobilier", "Objets d'art & Décoration", "Art de la table", "Curiosités & Divers"] as cat}
              {@const catSubs = subcategories.filter(s => s.category === cat)}
              {#if catSubs.length > 0}
                <optgroup label={cat} class="text-base-content font-bold">
                  {#each catSubs as sub}
                    <option value={sub.id} class="text-base-content font-normal">{sub.name}</option>
                  {/each}
                </optgroup>
              {/if}
            {/each}
          </select>
        </fieldset>
        
        <div class="flex justify-end gap-3 pt-2">
          <button onclick={() => isSubcatModalOpen = false} disabled={isUpdating} class="btn btn-ghost btn-sm">Annuler</button>
          <button onclick={bulkUpdateSubcategory} disabled={isUpdating} class="btn btn-primary btn-sm px-6">
            {#if isUpdating}
              <span class="loading loading-spinner loading-xs mr-1"></span>
            {/if}
            Appliquer
          </button>
        </div>
      </div>
    </div>
  {/if}

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
            <th class="text-center">Taille</th>
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
                      {#if import.meta.env.PUBLIC_DISABLE_IMAGES !== "true" && (antiquite.images && antiquite.images.length > 0)}
                        <img src={antiquite.images[0].url} alt={antiquite.name} />
                      {:else}
                        <div class="flex items-center justify-center h-full text-[10px] opacity-40 uppercase font-bold">
                          {antiquite.images?.length > 0 ? 'OFF' : 'N/A'}
                        </div>
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

              <td class="text-center font-bold">
                {antiquite.size || "S"}
              </td>

              <td class="text-center">
                  <div class="flex flex-col items-center gap-1">
                      <span class="badge badge-info h-auto py-1 px-3 font-bold uppercase text-[10px] leading-tight text-center">
                        {antiquite.category || "Inconnu"}
                      </span>
                      {#if antiquite.subcategory}
                        <span class="text-[10px] opacity-70 italic">({antiquite.subcategory.name})</span>
                      {/if}
                  </div>
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
                  <a href={`/ebay/${antiquite.id}`} class="btn btn-outline btn-info btn-xs">
                    eBay
                  </a>
                  <button type="button" onclick={() => DeleteAntiquite(antiquite.id)} class="btn btn-error btn-outline btn-xs btn-square">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                  </button>
                </div>
              </td>        
            </tr>
          {:else}
            <tr>
              <td colspan="8" class="text-center py-20 bg-base-200/20">
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
</div>
