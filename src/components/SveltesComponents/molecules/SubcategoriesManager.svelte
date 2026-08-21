<script lang="ts">
    import { apiFetch } from "../../../lib/api";
    import { onMount } from "svelte";
    import type { Subcategory } from "../../../type";

    let { apiUrl }: { apiUrl: string } = $props();

    let name = $state("");
    let category = $state("Mobilier");
    let subcategories = $state<Subcategory[]>([]);
    let isLoading = $state(false);
    let isCreating = $state(false);

    const categories = [
        "Mobilier",
        "Objets d'art & Décoration",
        "Art de la table",
        "Curiosités & Divers"
    ];

    async function loadSubcategories() {
        isLoading = true;
        try {
            const response = await apiFetch(`${apiUrl}/api/subcategories`);
            if (response.ok) {
                subcategories = await response.json();
            }
        } catch (error) {
            console.error("Error loading subcategories:", error);
        } finally {
            isLoading = false;
        }
    }

    async function addSubcategory() {
        if (!name.trim()) return;
        isCreating = true;
        try {
            const response = await apiFetch(`${apiUrl}/api/subcategories/add`, {
                method: "POST",
                body: JSON.stringify({
                    name: name.trim(),
                    category
                })
            });
            if (response.ok) {
                name = "";
                await loadSubcategories();
            } else {
                const err = await response.json();
                alert(`Erreur : ${err.error || "Impossible d'ajouter la sous-catégorie"}`);
            }
        } catch (error) {
            console.error("Error creating subcategory:", error);
        } finally {
            isCreating = false;
        }
    }

    async function deleteSubcategory(id: number) {
        if (!confirm("Voulez-vous vraiment supprimer cette sous-catégorie ? Les objets associés n'auront plus de sous-catégorie.")) return;
        try {
            const response = await apiFetch(`${apiUrl}/api/subcategories/${id}`, {
                method: "DELETE"
            });
            if (response.ok) {
                await loadSubcategories();
            } else {
                alert("Erreur lors de la suppression");
            }
        } catch (error) {
            console.error("Error deleting subcategory:", error);
        }
    }

    onMount(() => {
        loadSubcategories();
    });
</script>

<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto font-mono">
    <!-- Formulaire d'ajout Rétro -->
    <div class="retro-card p-6 h-fit space-y-4">
        <div class="flex items-center gap-2">
            <span class="retro-badge bg-[#FFE600] text-[10px]">CRÉATION</span>
            <span class="text-xs font-bold text-black/70">NOUVELLE SOUS-CATÉGORIE</span>
        </div>
        <h2 class="text-xl font-black uppercase tracking-tight text-black">
            Ajouter un filtre
        </h2>
        
        <form onsubmit={(e) => { e.preventDefault(); addSubcategory(); }} class="space-y-4 pt-2 border-t-2 border-black">
            <div class="space-y-1">
                <label class="text-xs font-bold uppercase tracking-wider text-black">Nom de la sous-catégorie</label>
                <input 
                    type="text" 
                    placeholder="Ex: Fauteuils, Vases, Argenterie..." 
                    bind:value={name} 
                    class="retro-input" 
                    required 
                />
            </div>

            <div class="space-y-1">
                <label class="text-xs font-bold uppercase tracking-wider text-black">Galerie parente</label>
                <select bind:value={category} class="retro-select">
                    {#each categories as cat}
                        <option value={cat}>{cat}</option>
                    {/each}
                </select>
            </div>

            <button type="submit" disabled={isCreating} class="retro-btn-primary w-full py-2.5 mt-2 font-black shadow-[3px_3px_0px_0px_#000]">
                {#if isCreating}
                    <span class="loading loading-spinner loading-xs mr-2"></span>
                    Création...
                {:else}
                    ➕ Ajouter la sous-catégorie
                {/if}
            </button>
        </form>
    </div>

    <!-- Liste des sous-catégories Rétro -->
    <div class="lg:col-span-2 retro-card p-6 space-y-4">
        <div class="flex items-center justify-between">
            <div>
                <div class="flex items-center gap-2">
                    <span class="retro-badge bg-[#D4E2FD] text-[10px]">RÉPERTOIRE</span>
                    <span class="text-xs font-bold text-black/70">CATÉGORIES & SOUS-GROUPES</span>
                </div>
                <h2 class="text-xl font-black uppercase tracking-tight text-black mt-0.5">
                    Sous-catégories actives
                </h2>
            </div>
            <div class="retro-icon-box bg-white">
                🏷️
            </div>
        </div>
        
        {#if isLoading}
            <div class="flex flex-col items-center justify-center py-16 gap-3">
                <span class="loading loading-spinner loading-lg text-black"></span>
                <p class="text-xs font-bold uppercase text-black">Chargement des sous-catégories...</p>
            </div>
        {:else if subcategories.length === 0}
            <div class="p-12 text-center border-2 border-dashed border-black/40 bg-[#F6F4EE]">
                <p class="text-xs font-bold uppercase text-black/60">Aucune sous-catégorie configurée.</p>
            </div>
        {:else}
            <div class="space-y-6 pt-2 border-t-2 border-black">
                {#each categories as cat}
                    {@const catSubs = subcategories.filter(s => s.category === cat)}
                    {#if catSubs.length > 0}
                        <div class="border-2 border-black p-4 bg-[#EDE9DF] shadow-[2px_2px_0px_0px_#000]">
                            <div class="flex items-center justify-between mb-3">
                                <h3 class="font-black text-sm uppercase text-black flex items-center gap-2">
                                    <span class="w-2.5 h-2.5 bg-black"></span>
                                    <span>{cat}</span>
                                </h3>
                                <span class="retro-badge bg-white text-[10px]">{catSubs.length} élément(s)</span>
                            </div>

                            <div class="flex flex-wrap gap-2">
                                {#each catSubs as sub}
                                    <div class="flex items-center gap-2 bg-white px-3 py-1.5 border-2 border-black text-xs font-bold text-black shadow-[1.5px_1.5px_0px_0px_#000]">
                                        <span>{sub.name}</span>
                                        <button 
                                            onclick={() => deleteSubcategory(sub.id)}
                                            class="w-4 h-4 border border-black bg-[#FFC2D1] hover:bg-[#fca2b4] flex items-center justify-center font-bold text-[10px]"
                                            title="Supprimer"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}
                {/each}
            </div>
        {/if}
    </div>
</div>
