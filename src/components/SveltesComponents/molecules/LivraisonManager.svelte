<script lang="ts">
    import { apiFetch } from "../../../lib/api";
    import type { Livraison } from "../../../type";
    import { onMount } from "svelte";

    let livraisons = $state<Livraison[]>([]);
    let isLoading = $state(false);
    let isEditing = $state<number | null>(null);

    // Form state for adding/editing
    let providerName = $state("");
    let priceSmall = $state<number | null>(null);
    let priceMedium = $state<number | null>(null);
    let priceLarge = $state<number | null>(null);

    const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;

    async function fetchLivraisons() {
        isLoading = true;
        try {
            const response = await apiFetch(`${PUBLIC_API_URL}/api/livraisons/`);
            if (response.ok) {
                livraisons = await response.json();
            }
        } catch (error) {
            console.error("Error fetching livraisons:", error);
        } finally {
            isLoading = false;
        }
    }

    async function saveLivraison() {
        const payload = {
            providername: providerName,
            pricesmall: priceSmall,
            pricemedium: priceMedium,
            pricelarge: priceLarge
        };

        try {
            const method = isEditing ? "PATCH" : "POST";
            const endpoint = isEditing ? `${PUBLIC_API_URL}/api/livraisons/${isEditing}` : `${PUBLIC_API_URL}/api/livraisons/add`;
            
            const response = await apiFetch(endpoint, {
                method,
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                alert(isEditing ? "Modifié avec succès !" : "Ajouté avec succès !");
                resetForm();
                await fetchLivraisons();
            } else {
                alert("Erreur lors de l'enregistrement.");
            }
        } catch (error) {
            console.error("Error saving livraison:", error);
        }
    }

    async function deleteLivraison(id: number) {
        if (!confirm("Supprimer ce transporteur ?")) return;

        try {
            const response = await apiFetch(`${PUBLIC_API_URL}/api/livraisons/${id}`, {
                method: "DELETE"
            });

            if (response.ok) {
                await fetchLivraisons();
            }
        } catch (error) {
            console.error("Error deleting livraison:", error);
        }
    }

    function editLivraison(l: Livraison) {
        isEditing = l.id!;
        providerName = l.providername;
        priceSmall = l.pricesmall;
        priceMedium = l.pricemedium;
        priceLarge = l.pricelarge;
    }

    function resetForm() {
        isEditing = null;
        providerName = "";
        priceSmall = null;
        priceMedium = null;
        priceLarge = null;
    }

    onMount(() => {
        fetchLivraisons();
    });
</script>

<div class="space-y-8">
    <!-- Formulaire d'ajout/modification -->
    <div class="card bg-base-100 shadow-xl border border-base-200 overflow-hidden">
        <div class="bg-primary/5 p-4 border-b border-base-200">
            <h2 class="text-xl font-bold">{isEditing ? 'Modifier le transporteur' : 'Ajouter un transporteur'}</h2>
        </div>
        <div class="p-6">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div class="form-control">
                    <label class="label"><span class="label-text font-bold">Nom du transporteur</span></label>
                    <input type="text" bind:value={providerName} placeholder="ex: DHL, UPS..." class="input input-bordered w-full" />
                </div>
                <div class="form-control">
                    <label class="label"><span class="label-text">Prix Petit (S)</span></label>
                    <input type="number" bind:value={priceSmall} placeholder="0.00" class="input input-bordered w-full" />
                </div>
                <div class="form-control">
                    <label class="label"><span class="label-text">Prix Moyen (M)</span></label>
                    <input type="number" bind:value={priceMedium} placeholder="0.00" class="input input-bordered w-full" />
                </div>
                <div class="form-control">
                    <label class="label"><span class="label-text">Prix Grand (L/XL)</span></label>
                    <input type="number" bind:value={priceLarge} placeholder="0.00" class="input input-bordered w-full" />
                </div>
            </div>
            <div class="mt-6 flex justify-end gap-2">
                {#if isEditing}
                    <button onclick={resetForm} class="btn btn-ghost">Annuler</button>
                {/if}
                <button onclick={saveLivraison} class="btn btn-primary px-8" disabled={!providerName}>
                    {isEditing ? 'Mettre à jour' : 'Ajouter'}
                </button>
            </div>
        </div>
    </div>

    <!-- Liste des transporteurs -->
    <div class="card bg-base-100 shadow-xl border border-base-200 overflow-hidden">
        <div class="bg-base-200/50 p-4 border-b border-base-200 flex justify-between items-center">
            <h2 class="text-xl font-bold">Transporteurs enregistrés</h2>
            <button onclick={fetchLivraisons} class="btn btn-ghost btn-sm btn-circle" title="Rafraîchir">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 {isLoading ? 'animate-spin' : ''}"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
            </button>
        </div>
        <div class="overflow-x-auto">
            <table class="table table-zebra w-full">
                <thead>
                    <tr>
                        <th>Transporteur</th>
                        <th class="text-center">Prix S</th>
                        <th class="text-center">Prix M</th>
                        <th class="text-center">Prix L/XL</th>
                        <th class="text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {#each livraisons as l (l.id)}
                        <tr class="hover">
                            <td class="font-bold">{l.providername}</td>
                            <td class="text-center">{l.pricesmall ? l.pricesmall + ' €' : '-'}</td>
                            <td class="text-center">{l.pricemedium ? l.pricemedium + ' €' : '-'}</td>
                            <td class="text-center">{l.pricelarge ? l.pricelarge + ' €' : '-'}</td>
                            <td class="text-right flex justify-end gap-2">
                                <button onclick={() => editLivraison(l)} class="btn btn-ghost btn-xs btn-square">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                                </button>
                                <button onclick={() => deleteLivraison(l.id!)} class="btn btn-error btn-outline btn-xs btn-square">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                                </button>
                            </td>
                        </tr>
                    {:else}
                        {#if !isLoading}
                            <tr>
                                <td colspan="5" class="text-center py-10 opacity-50">Aucun transporteur enregistré.</td>
                            </tr>
                        {/if}
                    {/each}
                </tbody>
            </table>
        </div>
    </div>
</div>
