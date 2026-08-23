<script lang="ts">
  import type { Antiquite, Subcategory } from '../../../type'
  import { apiFetch } from '../../../lib/api';
  import { onMount } from 'svelte';
  import QRCode from 'qrcode';

  interface Props {
      antiquites?: Antiquite[];
      mode?: string;
  }
  
  let { antiquites, mode }: Props = $props();

  let current_antiquites = $state(antiquites || []);
  let selectedIds = $state<number[]>([]);

  let subcategories = $state<Subcategory[]>([]);
  let isSubcatModalOpen = $state(false);
  let selectedSubcatId = $state<number | null>(null);
  let isUpdating = $state(false);
  let updatingQuantityId = $state<number | null>(null);

  async function updateQuantity(antiquiteId: number, newQty: number) {
    if (newQty < 0) return;
    updatingQuantityId = antiquiteId;
    const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
    
    try {
      const formData = new FormData();
      formData.append("quantity", newQty.toString());
      
      const res = await apiFetch(`${PUBLIC_API_URL}/api/antiquites/${antiquiteId}`, {
        method: "PATCH",
        body: formData
      });
      
      if (res.ok) {
        current_antiquites = current_antiquites.map(item => 
          item.id === antiquiteId ? { ...item, quantity: newQty } : item
        );
      } else {
        alert("Erreur lors de la mise à jour de la quantité.");
      }
    } catch (err) {
      console.error("Erreur mise à jour quantité:", err);
      alert("Erreur de connexion lors de la mise à jour.");
    } finally {
      updatingQuantityId = null;
    }
  }

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

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        if (node.parentNode) node.parentNode.removeChild(node);
      }
    };
  }

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
        if (selectedSubcatId) {
          formData.append("subcategory_id", selectedSubcatId.toString());
          if (selectedSubcat) {
            formData.append("category", selectedSubcat.category);
          }
        } else {
          formData.append("subcategory_id", "null");
        }
        return apiFetch(`${PUBLIC_API_URL}/api/antiquites/${id}`, {
          method: "PATCH",
          body: formData
        });
      });

      await Promise.all(promises);
      
      current_antiquites = current_antiquites.map(a => {
        if (selectedIds.includes(a.id)) {
          return {
            ...a,
            subcategory_id: selectedSubcatId || undefined,
            subcategory: selectedSubcat || undefined,
            category: selectedSubcat ? selectedSubcat.category : a.category
          };
        }
        return a;
      });

      alert(`Sous-catégorie mise à jour pour ${selectedIds.length} élément(s) !`);
      isSubcatModalOpen = false;
      selectedIds = [];
    } catch (err) {
      console.error("Erreur mise à jour sous-catégories groupée:", err);
      alert("Une erreur est survenue lors de la mise à jour.");
    } finally {
      isUpdating = false;
    }
  }

  async function DeleteAntiquite(id: number){
      if(!confirm("Êtes-vous sûr de vouloir supprimer cette antiquité ?")) return;
      const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
      try{
        const response = await apiFetch(`${PUBLIC_API_URL}/api/antiquites/${id}`, { method: "DELETE" });
        if(response.ok){
          current_antiquites = current_antiquites.filter((antiquite) => antiquite.id !== id);
        }
      }
      catch(error){
        console.error("Erreur lors de la suppression:", error);
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
            body { font-family: monospace; padding: 20px; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 15px; text-align: center; }
            .item { border: 2px solid #000; padding: 10px; page-break-inside: avoid; }
            img { max-width: 130px; height: auto; margin-bottom: 5px; }
            h3 { font-size: 12px; margin: 0 0 5px 0; text-transform: uppercase; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h2>CENTRAL.SYS - ${selectedItems.length} QR Codes</h2>
          <div class="grid">
    `;
    
    for (const item of selectedItems) {
      const currentUrl = window.location.origin;
      const url = `${currentUrl}/inventoryt5hr4hr85g48412r/${item.id}`;
      try {
        const qrUrl = await QRCode.toDataURL(url, { margin: 1, width: 130 });
        htmlContent += `
          <div class="item">
            <img src="${qrUrl}" alt="QR Code ${item.id}" />
            <h3>${item.name}</h3>
            <p>ID: #${item.id}</p>
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
    { label: "Actif", class: "bg-[#99E7DC]" },
    { label: "Inactif", class: "bg-white" },
    { label: "Vendu", class: "bg-[#FFC2D1]" }
  ];
</script>

<div class="relative font-mono">
  <!-- Barre d'actions groupées flottante (Rétro) -->
  {#if selectedIds.length > 0}
    <div use:portal class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div class="bg-[#FFE600] text-black px-5 py-3 border-3 border-black shadow-[6px_6px_0px_0px_#000] flex flex-wrap items-center gap-4">
        <div class="flex items-center gap-2">
          <span class="bg-black text-white px-2 py-0.5 text-xs font-black">{selectedIds.length}</span>
          <span class="text-xs font-black uppercase">Sélectionné(s)</span>
        </div>
        
        <div class="h-6 w-0.5 bg-black hidden sm:block"></div>
        
        <div class="flex flex-wrap items-center gap-2">
          <button onclick={printBulkQRCodes} class="retro-btn text-xs py-1 px-2.5 bg-white">
            🖨️ QR Codes
          </button>

          <button onclick={() => { selectedSubcatId = null; isSubcatModalOpen = true; }} class="retro-btn text-xs py-1 px-2.5 bg-white">
            🏷️ Sous-catégorie
          </button>

          <button onclick={bulkDelete} class="retro-btn-error text-xs py-1 px-2.5 font-black">
            🗑️ Supprimer
          </button>
          
          <button onclick={() => selectedIds = []} class="retro-btn text-xs py-1 px-2 bg-white">
            ✕
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Modale Sous-catégorie (Rétro Window) -->
  {#if isSubcatModalOpen}
    <div use:portal class="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center p-4" onclick={() => isSubcatModalOpen = false}>
      <div class="bg-[#EDE9DF] border-3 border-black shadow-[8px_8px_0px_0px_#000] max-w-md w-full overflow-hidden" onclick={(e) => e.stopPropagation()}>
        <div class="bg-[#FFE600] border-b-2 border-black px-4 py-2 flex items-center justify-between">
          <span class="font-black text-xs uppercase text-black">
            🗔 ASSIGNER SOUS-CATÉGORIE
          </span>
          <button onclick={() => isSubcatModalOpen = false} class="w-6 h-6 border border-black bg-white hover:bg-[#FFC2D1] flex items-center justify-center font-bold text-xs">
            ✕
          </button>
        </div>

        <div class="p-6 space-y-4 bg-white">
          <p class="text-xs text-black/80">
            Sélectionnez la sous-catégorie à appliquer aux <strong class="underline">{selectedIds.length}</strong> éléments sélectionnés.
          </p>
          
          <div class="space-y-1">
            <label class="text-xs font-bold uppercase text-black">Sous-catégorie cible</label>
            <select bind:value={selectedSubcatId} class="retro-select text-xs">
              <option value={null}>Aucune sous-catégorie (Désassocier)</option>
              {#each ["Mobilier", "Objets d'art & Décoration", "Art de la table", "Curiosités & Divers"] as cat}
                {@const catSubs = subcategories.filter(s => s.category === cat)}
                {#if catSubs.length > 0}
                  <optgroup label={cat} class="font-bold">
                    {#each catSubs as sub}
                      <option value={sub.id}>{sub.name}</option>
                    {/each}
                  </optgroup>
                {/if}
              {/each}
            </select>
          </div>
          
          <div class="flex justify-end gap-2 pt-2 border-t-2 border-black">
            <button onclick={() => isSubcatModalOpen = false} disabled={isUpdating} class="retro-btn text-xs bg-white">
              Annuler
            </button>
            <button onclick={bulkUpdateSubcategory} disabled={isUpdating} class="retro-btn-primary text-xs font-black">
              {#if isUpdating}
                <span class="loading loading-spinner loading-xs mr-1"></span>
              {/if}
              Appliquer
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Tableau Rétro -->
  <div class="retro-card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs border-collapse">
        <thead>
          <tr class="bg-[#D4E2FD] border-b-2 border-black text-black">
            <th class="p-3 border-r border-black w-10 text-center">
              <input 
                type="checkbox" 
                class="checkbox checkbox-xs border-2 border-black rounded-none bg-white checked:bg-black checked:text-white" 
                checked={selectedIds.length === current_antiquites.length && current_antiquites.length > 0}
                onchange={toggleAll}
              />
            </th>
            <th class="p-3 border-r border-black font-black uppercase">Article</th>
            <th class="p-3 border-r border-black font-black uppercase text-center w-36">Quantité</th>
            <th class="p-3 border-r border-black font-black uppercase text-right">Prix</th>
            <th class="p-3 border-r border-black font-black uppercase text-center">Taille</th>
            <th class="p-3 border-r border-black font-black uppercase text-center">Catégorie</th>
            <th class="p-3 border-r border-black font-black uppercase text-center">Statut</th>
            <th class="p-3 font-black uppercase text-right">Actions</th>
          </tr>
        </thead>
        
        <tbody>
          {#each current_antiquites as antiquite, index (antiquite.id)}
            {@const isSelected = selectedIds.includes(antiquite.id)}
            <tr 
              class="border-b border-black {index % 2 === 0 ? 'bg-white' : 'bg-[#F6F4EE]'} {isSelected ? '!bg-[#FFE600]/30' : ''} hover:bg-[#FFE600]/20 transition-colors group cursor-pointer" 
              onclick={() => window.location.href = `/antiquites/${antiquite.id}`}
            >
              <td class="p-3 border-r border-black text-center" onclick={(e) => e.stopPropagation()}>
                <input 
                  type="checkbox" 
                  class="checkbox checkbox-xs border-2 border-black rounded-none bg-white checked:bg-black checked:text-white" 
                  checked={isSelected}
                  onchange={() => toggleSelect(antiquite.id)}
                />
              </td>
              
              <td class="p-3 border-r border-black">
                <div class="flex items-center gap-3">
                  <div class="w-12 h-12 border-2 border-black bg-white flex-shrink-0 overflow-hidden shadow-[2px_2px_0px_0px_#000]">
                    {#if import.meta.env.PUBLIC_DISABLE_IMAGES !== "true" && (antiquite.images && antiquite.images.length > 0)}
                      <img src={antiquite.images[0].url} alt={antiquite.name} class="w-full h-full object-cover" />
                    {:else}
                      <div class="flex items-center justify-center h-full text-[9px] opacity-40 uppercase font-bold bg-[#EDE9DF]">
                        {antiquite.images?.length > 0 ? 'OFF' : 'N/A'}
                      </div>
                    {/if}
                  </div>
                  <div>
                    <div class="font-bold text-sm text-black flex items-center gap-1.5">
                      <span>{antiquite.name}</span>
                      {#if antiquite.status === 2}
                        <span class="retro-badge bg-[#FFC2D1] text-[9px] px-1 py-0">VENDU</span>
                      {/if}
                      {#if antiquite.nouveaute}
                        <span class="retro-badge bg-[#FFE600] text-[9px] px-1 py-0">NOUVEAU</span>
                      {/if}
                    </div>
                    <div class="text-[10px] text-black/60 font-mono">
                      <span>ID: #{antiquite.id}</span>
                    </div>
                  </div>
                </div>
              </td>
              
              <td class="p-3 border-r border-black text-center" onclick={(e) => e.stopPropagation()}>
                <div class="inline-flex items-center border-2 border-black bg-white shadow-[2px_2px_0px_0px_#000]">
                  <button
                    type="button"
                    onclick={() => updateQuantity(antiquite.id, Math.max(0, (antiquite.quantity ?? 1) - 1))}
                    disabled={updatingQuantityId === antiquite.id || (antiquite.quantity ?? 1) <= 0}
                    class="w-7 h-7 flex items-center justify-center font-bold text-xs bg-[#EDE9DF] hover:bg-[#FFC2D1] border-r-2 border-black disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    title="Diminuer la quantité"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={antiquite.quantity ?? 1}
                    disabled={updatingQuantityId === antiquite.id}
                    onchange={(e) => {
                      const val = parseInt((e.target as HTMLInputElement).value, 10);
                      if (!isNaN(val) && val >= 0) {
                        updateQuantity(antiquite.id, val);
                      }
                    }}
                    class="w-12 h-7 text-center text-xs font-black text-black bg-white focus:outline-none focus:bg-[#FFF394]"
                  />
                  <button
                    type="button"
                    onclick={() => updateQuantity(antiquite.id, (antiquite.quantity ?? 1) + 1)}
                    disabled={updatingQuantityId === antiquite.id}
                    class="w-7 h-7 flex items-center justify-center font-bold text-xs bg-[#EDE9DF] hover:bg-[#99E7DC] border-l-2 border-black disabled:opacity-40 cursor-pointer transition-colors"
                    title="Augmenter la quantité"
                  >
                    +
                  </button>
                </div>
                {#if updatingQuantityId === antiquite.id}
                  <div class="text-[9px] text-black/60 font-bold animate-pulse mt-0.5">MAJ...</div>
                {/if}
              </td>
              
              <td class="p-3 border-r border-black text-right font-black text-sm whitespace-nowrap text-black">
                {formatPrice(antiquite.price)}
              </td>

              <td class="p-3 border-r border-black text-center">
                <span class="border border-black px-2 py-0.5 bg-white font-bold text-xs">{antiquite.size || "S"}</span>
              </td>

              <td class="p-3 border-r border-black text-center">
                <div class="flex flex-col items-center gap-1">
                  <span class="retro-badge bg-[#D4E2FD] text-[10px]">
                    {antiquite.category || "Inconnu"}
                  </span>
                  {#if antiquite.subcategory}
                    <span class="text-[10px] text-black/60 italic">({antiquite.subcategory.name})</span>
                  {/if}
                </div>
              </td>
              
              <td class="p-3 border-r border-black text-center">
                <span class="retro-badge {statusList[antiquite.status]?.class || 'bg-white'} text-[10px]">
                  {statusList[antiquite.status]?.label || "Inconnu"}
                </span>
              </td>
              
              <td onclick={(e) => e.stopPropagation()} class="p-3 text-right">
                <div class="flex justify-end gap-1.5">
                  <a href={`/antiquites/${antiquite.id}`} class="retro-btn py-1 px-2 text-[10px] bg-white hover:bg-[#FFE600]" title="Modifier">
                    ✏️
                  </a>
                  <a href={`/ebay/${antiquite.id}`} class="retro-btn py-1 px-2 text-[10px] bg-[#FFE600] hover:bg-[#ffe169]" title="eBay">
                    eBay
                  </a>
                  <button type="button" onclick={() => DeleteAntiquite(antiquite.id)} class="retro-btn py-1 px-2 text-[10px] bg-[#FFC2D1] hover:bg-[#fca5b9]" title="Supprimer">
                    🗑️
                  </button>
                </div>
              </td>        
            </tr>
          {:else}
            <tr>
              <td colspan="8" class="text-center py-16 bg-[#F6F4EE]">
                <div class="flex flex-col items-center gap-2">
                  <span class="text-4xl">📭</span>
                  <p class="text-sm font-bold uppercase text-black">Aucun objet dans l'inventaire</p>
                  <a href="/antiquites/add" class="retro-btn-primary text-xs py-1.5 px-4 mt-2">
                    ➕ Ajouter un objet
                  </a>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
