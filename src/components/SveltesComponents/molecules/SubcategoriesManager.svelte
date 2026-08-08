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

<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
    <!-- Formulaire d'ajout -->
    <div class="card bg-base-100 shadow-sm border border-base-200 p-6 h-fit">
        <h2 class="text-xl font-bold mb-4">Nouvelle sous-catégorie</h2>
        <form onsubmit={(e) => { e.preventDefault(); addSubcategory(); }} class="space-y-4">
            <fieldset class="fieldset">
                <legend class="fieldset-legend font-semibold">Nom de la sous-catégorie</legend>
                <input 
                    type="text" 
                    placeholder="Ex: Tables, Vases, Assiettes..." 
                    bind:value={name} 
                    class="input input-bordered w-full rounded-md" 
                    required 
                />
            </fieldset>

            <fieldset class="fieldset">
                <legend class="fieldset-legend font-semibold">Catégorie parente (Galerie)</legend>
                <select bind:value={category} class="select select-bordered w-full rounded-md">
                    {#each categories as cat}
                        <option value={cat}>{cat}</option>
                    {/each}
                </select>
            </fieldset>

            <button type="submit" disabled={isCreating} class="btn btn-primary w-full mt-4 rounded-xl">
                {#if isCreating}
                    <span class="loading loading-spinner loading-sm"></span>
                {:else}
                    Ajouter
                {/if}
            </button>
        </form>
    </div>

    <!-- Liste des sous-catégories -->
    <div class="lg:col-span-2 card bg-base-100 shadow-sm border border-base-200 p-6">
        <h2 class="text-xl font-bold mb-4">Sous-catégories existantes</h2>
        
        {#if isLoading}
            <div class="flex justify-center py-12">
                <span class="loading loading-spinner loading-lg text-primary"></span>
            </div>
        {:else if subcategories.length === 0}
            <p class="text-base-content/60 py-12 text-center">Aucune sous-catégorie pour le moment.</p>
        {:else}
            <div class="space-y-6">
                {#each categories as cat}
                    {@const catSubs = subcategories.filter(s => s.category === cat)}
                    {#if catSubs.length > 0}
                        <div class="border-b border-base-200 pb-4 last:border-none">
                            <h3 class="font-bold text-lg text-primary mb-3">{cat}</h3>
                            <div class="flex flex-wrap gap-2">
                                {#each catSubs as sub}
                                    <div class="flex items-center gap-2 bg-base-200 px-3 py-1.5 rounded-lg border border-base-300 text-sm">
                                        <span>{sub.name}</span>
                                        <button 
                                            onclick={() => deleteSubcategory(sub.id)}
                                            class="btn btn-ghost btn-xs btn-circle text-error hover:bg-error/10"
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
