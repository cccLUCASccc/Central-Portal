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
    let priceExtraLarge = $state<number | null>(null);

    const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;

    async function fetchLivraisons() {
        isLoading = true;
        try {
            const response = await apiFetch(`${PUBLIC_API_URL}/api/livraisons`);
            if (response.ok) {
                livraisons = await response.json();
            } else {
                console.error("Erreur API Livraisons:", response.status);
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
            pricelarge: priceLarge,
            pricextralarge: priceExtraLarge
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
        priceExtraLarge = l.pricextralarge;
    }

    function resetForm() {
        isEditing = null;
        providerName = "";
        priceSmall = null;
        priceMedium = null;
        priceLarge = null;
        priceExtraLarge = null;
    }

    onMount(() => {
        fetchLivraisons();
    });
</script>

<div class="space-y-6 max-w-7xl mx-auto font-mono">
    <!-- Header Rétro -->
    <div class="retro-card-rose p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <div class="flex items-center gap-2">
                <span class="retro-badge bg-black text-white text-[10px]">LOGISTIQUE</span>
                <span class="text-xs font-bold text-black/70">GRILLE TARIFAIRE EXPÉDITIONS</span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-black uppercase tracking-tight text-black mt-1">
                Frais de Livraison & Transport
            </h1>
            <p class="text-xs text-black/80 mt-0.5">
                Configurez les tarifs d'expédition par gabarit (S, M, L, XL) calculés automatiquement sur la boutique.
            </p>
        </div>
        <div class="retro-icon-box bg-white flex items-center justify-center">
            <span class="material-symbols-outlined text-2xl text-black">local_shipping</span>
        </div>
    </div>

    <!-- Formulaire d'ajout/modification Rétro -->
    <div class="retro-card p-6 space-y-4">
        <div class="flex items-center gap-2">
            <span class="retro-badge bg-[#FFE600] text-[10px]">{isEditing ? 'ÉDITION' : 'NOUVEAU'}</span>
            <h2 class="text-lg font-black uppercase tracking-tight text-black">
                {isEditing ? `Modifier le transporteur #${isEditing}` : 'Ajouter un nouveau transporteur'}
            </h2>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end pt-2 border-t-2 border-black">
            <div class="space-y-1">
                <label class="text-xs font-bold uppercase text-black">Transporteur</label>
                <input type="text" bind:value={providerName} placeholder="ex: Colissimo, UPS..." class="retro-input" />
            </div>
            <div class="space-y-1">
                <label class="text-xs font-bold uppercase text-black">Prix S (€)</label>
                <input type="number" step="0.5" bind:value={priceSmall} placeholder="0.00" class="retro-input" />
            </div>
            <div class="space-y-1">
                <label class="text-xs font-bold uppercase text-black">Prix M (€)</label>
                <input type="number" step="0.5" bind:value={priceMedium} placeholder="0.00" class="retro-input" />
            </div>
            <div class="space-y-1">
                <label class="text-xs font-bold uppercase text-black">Prix L (€)</label>
                <input type="number" step="0.5" bind:value={priceLarge} placeholder="0.00" class="retro-input" />
            </div>
            <div class="space-y-1">
                <label class="text-xs font-bold uppercase text-black">Prix XL (€)</label>
                <input type="number" step="0.5" bind:value={priceExtraLarge} placeholder="0.00" class="retro-input" />
            </div>
        </div>

        <div class="flex justify-end gap-2 pt-3 border-t-2 border-black">
            {#if isEditing}
                <button onclick={resetForm} class="retro-btn py-1.5 px-4 text-xs bg-white">
                    Annuler
                </button>
            {/if}
            <button onclick={saveLivraison} class="retro-btn-primary py-1.5 px-6 text-xs font-black shadow-[3px_3px_0px_0px_#000] flex items-center gap-1.5" disabled={!providerName}>
                <span class="material-symbols-outlined text-[16px]">{isEditing ? 'save' : 'add'}</span>
                <span>{isEditing ? 'Mettre à jour' : 'Enregistrer le transporteur'}</span>
            </button>
        </div>
    </div>

    <!-- Liste des transporteurs Rétro -->
    <div class="retro-card overflow-hidden">
        <div class="bg-[#D4E2FD] p-3 border-b-2 border-black flex justify-between items-center">
            <span class="font-black text-xs uppercase text-black">
                Transporteurs et barèmes configurés
            </span>
            <button onclick={fetchLivraisons} class="retro-btn py-1 px-2.5 text-xs bg-white hover:bg-[#FFE600] flex items-center justify-center" title="Rafraîchir">
                <span class="material-symbols-outlined text-[16px] {isLoading ? 'animate-spin' : ''}">refresh</span>
            </button>
        </div>

        <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
                <thead>
                    <tr class="bg-[#EDE9DF] border-b-2 border-black text-black">
                        <th class="p-3 border-r border-black font-black uppercase">Transporteur</th>
                        <th class="p-3 border-r border-black font-black uppercase text-center">Petit (S)</th>
                        <th class="p-3 border-r border-black font-black uppercase text-center">Moyen (M)</th>
                        <th class="p-3 border-r border-black font-black uppercase text-center">Grand (L)</th>
                        <th class="p-3 border-r border-black font-black uppercase text-center">Très Grand (XL)</th>
                        <th class="p-3 font-black uppercase text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {#each livraisons as l, index (l.id)}
                        <tr class="border-b border-black {index % 2 === 0 ? 'bg-white' : 'bg-[#F6F4EE]'} hover:bg-[#FFE600]/20">
                            <td class="p-3 border-r border-black font-black text-black">{l.providername}</td>
                            <td class="p-3 border-r border-black text-center font-mono font-bold">{l.pricesmall ? l.pricesmall + ' €' : '-'}</td>
                            <td class="p-3 border-r border-black text-center font-mono font-bold">{l.pricemedium ? l.pricemedium + ' €' : '-'}</td>
                            <td class="p-3 border-r border-black text-center font-mono font-bold">{l.pricelarge ? l.pricelarge + ' €' : '-'}</td>
                            <td class="p-3 border-r border-black text-center font-mono font-bold">{l.pricextralarge ? l.pricextralarge + ' €' : '-'}</td>
                            <td class="p-3 text-right">
                                <div class="flex justify-end gap-1.5">
                                    <button onclick={() => editLivraison(l)} class="retro-btn py-0.5 px-2 text-[10px] bg-white hover:bg-[#FFE600] flex items-center justify-center" title="Modifier">
                                        <span class="material-symbols-outlined text-[14px]">edit</span>
                                    </button>
                                    <button onclick={() => deleteLivraison(l.id!)} class="retro-btn py-0.5 px-2 text-[10px] bg-[#FFC2D1] hover:bg-[#fca5b9] flex items-center justify-center" title="Supprimer">
                                        <span class="material-symbols-outlined text-[14px]">delete</span>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    {:else}
                        {#if !isLoading}
                            <tr>
                                <td colspan="6" class="text-center py-12 text-black/60 bg-[#F6F4EE]">
                                    Aucun transporteur enregistré.
                                </td>
                            </tr>
                        {/if}
                    {/each}
                </tbody>
            </table>
        </div>
    </div>
</div>
