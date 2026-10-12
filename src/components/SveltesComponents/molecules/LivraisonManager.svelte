<script lang="ts">
    import { apiFetch } from "../../../lib/api";
    import type { Livraison } from "../../../type";
    import { onMount } from "svelte";
    import { initialCountryRates, ratesForCountry, selectedCountryRates } from "../../../lib/delivery-rates";

    let livraisons = $state<Livraison[]>([]);
    let isLoading = $state(false);
    let isEditing = $state<number | null>(null);

    // Form state for adding/editing
    let providerName = $state("");
    let countries = $state<string[]>([]);
    const deliveryCountries = [
        { code: "BE", name: "Belgique" }, { code: "FR", name: "France" },
        { code: "CH", name: "Suisse" }, { code: "LU", name: "Luxembourg" },
        { code: "DE", name: "Allemagne" }, { code: "IT", name: "Italie" },
        { code: "ES", name: "Espagne" }, { code: "NL", name: "Pays-Bas" }
    ];
    let countryRates = $state(initialCountryRates(deliveryCountries.map(country => country.code)));

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
        try {
            const payload = {
                providername: providerName,
                countries,
                country_rates: selectedCountryRates(countries, countryRates)
            };
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
                const result = await response.json();
                alert(result.error || "Erreur lors de l'enregistrement.");
            }
        } catch (error) {
            console.error("Error saving livraison:", error);
            alert("Impossible d'enregistrer le transporteur. Réessayez.");
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
        countries = [...(l.countries || [])];
        countryRates = initialCountryRates(deliveryCountries.map(country => country.code), l);
    }

    function resetForm() {
        isEditing = null;
        providerName = "";
        countries = [];
        countryRates = initialCountryRates(deliveryCountries.map(country => country.code));
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
                Livraison Automatique & Transport
            </h1>
            <p class="text-xs text-black/80 mt-0.5">
                Configurez le coût par objet et par pays pour chaque gabarit (S, M, L, XL).
                Daisy choisit le transporteur le moins cher capable de livrer tous les objets de la commande dans le pays du client.
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

        <div class="pt-2 border-t-2 border-black">
            <div class="space-y-1">
                <label for="delivery-provider" class="text-xs font-bold uppercase text-black">Transporteur</label>
                <input id="delivery-provider" type="text" bind:value={providerName} maxlength="120" placeholder="ex: Colissimo, UPS..." class="retro-input" />
            </div>
        </div>

        <p class="text-xs font-bold">Un tarif vide ou nul indique un gabarit non pris en charge. Les coûts sont additionnés par objet, sans être facturés au client.</p>
        <fieldset class="space-y-2">
            <legend class="text-xs font-black uppercase">Pays desservis à domicile</legend>
            <div class="flex flex-wrap gap-3">
                {#each deliveryCountries as country}
                    <label class="flex items-center gap-2 text-xs font-bold">
                        <input type="checkbox" bind:group={countries} value={country.code} />
                        {country.name}
                    </label>
                {/each}
            </div>
            <p class="text-xs text-black/70">Sans pays sélectionné, le transporteur est désactivé pour l'attribution automatique. Ne configurez que les services réellement disponibles pour ces destinations.</p>
        </fieldset>

        {#if countries.length > 0}
            <div class="overflow-x-auto">
                <table class="w-full text-left text-xs border-collapse">
                    <caption class="text-left font-black uppercase pb-2">Coûts plateforme par pays et par objet (€)</caption>
                    <thead>
                        <tr class="bg-[#EDE9DF] border-2 border-black">
                            <th class="p-3">Pays</th>
                            <th class="p-3">S (€)</th>
                            <th class="p-3">M (€)</th>
                            <th class="p-3">L (€)</th>
                            <th class="p-3">XL (€)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each deliveryCountries.filter(country => countries.includes(country.code)) as country (country.code)}
                            <tr class="border-2 border-black">
                                <th scope="row" class="p-3">{country.name}</th>
                                <td class="p-2"><input aria-label={`Prix S pour ${country.name}`} type="number" min="0" max="1000000" step="0.01" bind:value={countryRates[country.code].pricesmall} placeholder="Non pris en charge" class="retro-input min-w-24" /></td>
                                <td class="p-2"><input aria-label={`Prix M pour ${country.name}`} type="number" min="0" max="1000000" step="0.01" bind:value={countryRates[country.code].pricemedium} placeholder="Non pris en charge" class="retro-input min-w-24" /></td>
                                <td class="p-2"><input aria-label={`Prix L pour ${country.name}`} type="number" min="0" max="1000000" step="0.01" bind:value={countryRates[country.code].pricelarge} placeholder="Non pris en charge" class="retro-input min-w-24" /></td>
                                <td class="p-2"><input aria-label={`Prix XL pour ${country.name}`} type="number" min="0" max="1000000" step="0.01" bind:value={countryRates[country.code].pricextralarge} placeholder="Non pris en charge" class="retro-input min-w-24" /></td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
            <p class="text-xs text-black/70">Chaque pays possède ses propres tarifs. Lors de la modification d'un ancien transporteur, ses tarifs existants sont préremplis pour conserver votre configuration.</p>
        {/if}

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
                        <th class="p-3 border-r border-black font-black uppercase">Tarifs par pays (€ / objet)</th>
                        <th class="p-3 font-black uppercase text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {#each livraisons as l, index (l.id)}
                        <tr class="border-b border-black {index % 2 === 0 ? 'bg-white' : 'bg-[#F6F4EE]'} hover:bg-[#FFE600]/20">
                            <td class="p-3 border-r border-black font-black text-black">{l.providername}</td>
                            <td class="p-3 border-r border-black">
                                {#if l.countries?.length}
                                    <table class="w-full text-xs">
                                        <thead>
                                            <tr><th class="p-1 text-left">Pays</th><th class="p-1">S</th><th class="p-1">M</th><th class="p-1">L</th><th class="p-1">XL</th></tr>
                                        </thead>
                                        <tbody>
                                            {#each l.countries as country (country)}
                                                {@const rates = ratesForCountry(l, country)}
                                                <tr>
                                                    <th scope="row" class="p-1 text-left">{country}</th>
                                                    <td class="p-1 text-center font-mono">{rates.pricesmall ? `${rates.pricesmall} €` : '-'}</td>
                                                    <td class="p-1 text-center font-mono">{rates.pricemedium ? `${rates.pricemedium} €` : '-'}</td>
                                                    <td class="p-1 text-center font-mono">{rates.pricelarge ? `${rates.pricelarge} €` : '-'}</td>
                                                    <td class="p-1 text-center font-mono">{rates.pricextralarge ? `${rates.pricextralarge} €` : '-'}</td>
                                                </tr>
                                            {/each}
                                        </tbody>
                                    </table>
                                {:else}
                                    <span class="font-bold">À configurer — non disponible</span>
                                {/if}
                            </td>
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
                                <td colspan="3" class="text-center py-12 text-black/60 bg-[#F6F4EE]">
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
