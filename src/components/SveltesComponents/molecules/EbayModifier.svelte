<script lang="ts">
    import { onMount } from "svelte";
    import type { Antiquite } from "../../../type";
    import { apiFetch } from "../../../lib/api";

    interface Props {
        antiquite: Antiquite;
    }

    let { antiquite }: Props = $props();

    let ebayTitle = $state(antiquite.ebay_title ?? "");
    let ebayDescription = $state(antiquite.ebay_description ?? "");
    let ebayPrice = $state(antiquite.ebay_price ?? 0);
    let ebayCategoryID = $state(antiquite.ebay_category_id ?? "");

    let dynamicStatus = $state("LOADING");
    let dynamicListingId = $state(antiquite.ebay_listing_id ?? "");
    let isCheckingStatus = $state(false);
    let isSaving = $state(false);
    let isPublishing = $state(false);
    let feedbackMessage = $state("");
    let feedbackType = $state<"success" | "error" | "info" | "">("");

    let previewTitle = $derived(ebayTitle.trim() !== "" ? ebayTitle : antiquite.name);
    let previewDescription = $derived(ebayDescription.trim() !== "" ? ebayDescription : antiquite.description);
    let previewPrice = $derived(ebayPrice && ebayPrice > 0 ? ebayPrice : antiquite.price);
    let previewCategory = $derived(ebayCategoryID.trim() !== "" ? ebayCategoryID : "119168");

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('fr-BE', { 
            style: 'currency', 
            currency: 'EUR'
        }).format(price);
    };

    const getEstimatedDelivery = () => {
        const today = new Date();
        const start = new Date(today);
        start.setDate(today.getDate() + 3);
        const end = new Date(today);
        end.setDate(today.getDate() + 7);

        const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
        const startStr = start.toLocaleDateString('fr-FR', options);
        const endStr = end.toLocaleDateString('fr-FR', options);
        return `estimée entre le ${startStr} et le ${endStr}`;
    };

    async function checkLiveStatus() {
        isCheckingStatus = true;
        feedbackMessage = "";
        try {
            const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
            const response = await apiFetch(`${PUBLIC_API_URL}/api/antiquites/${antiquite.id}/ebay-status`);
            if (response.status === 404) {
                dynamicStatus = "NOT_AVAILABLE";
            } else if (response.ok) {
                const data = await response.json();
                dynamicStatus = data.status;
                dynamicListingId = data.listingId;
            } else {
                dynamicStatus = "ERROR";
            }
        } catch (e) {
            console.error("Erreur checkLiveStatus:", e);
            dynamicStatus = "ERROR";
        } finally {
            isCheckingStatus = false;
        }
    }

    onMount(() => {
        checkLiveStatus();
    });

    async function saveEbayConfig(): Promise<boolean> {
        isSaving = true;
        feedbackMessage = "";
        const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
        
        const formData = new FormData();
        formData.append("ebay_title", ebayTitle);
        formData.append("ebay_description", ebayDescription);
        formData.append("ebay_price", ebayPrice !== null ? ebayPrice.toString() : "0");
        formData.append("ebay_category_id", ebayCategoryID);
        
        const existingIds = antiquite.images
            .map(img => img.id)
            .join(',');
        formData.append("existing_ids", existingIds);

        try {
            const response = await apiFetch(`${PUBLIC_API_URL}/api/antiquites/${antiquite.id}`, {
                method: "PATCH",
                body: formData
            });

            if (response.ok) {
                feedbackMessage = "Configuration eBay enregistrée localement avec succès !";
                feedbackType = "success";
                return true;
            } else {
                feedbackMessage = "Erreur lors de la sauvegarde de la configuration locale.";
                feedbackType = "error";
                return false;
            }
        } catch (error) {
            console.error("Error saving eBay config:", error);
            feedbackMessage = "Erreur de connexion avec le serveur.";
            feedbackType = "error";
            return false;
        } finally {
            isSaving = false;
        }
    }

    async function publishToEbay() {
        if (!confirm("Voulez-vous enregistrer les modifications et publier/mettre à jour cet objet sur eBay ?")) return;

        isPublishing = true;
        feedbackMessage = "";
        const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;

        try {
            const saved = await saveEbayConfig();
            if (!saved) return;

            feedbackMessage = "Publication/Mise à jour en cours sur eBay...";
            feedbackType = "info";

            const response = await apiFetch(`${PUBLIC_API_URL}/api/antiquites/${antiquite.id}/publish-ebay`, {
                method: "POST"
            });

            const res = await response.json();
            if (response.ok) {
                feedbackMessage = `${res.message || "Objet synchronisé sur eBay avec succès !"} \nID d'annonce : ${res.listingId}`;
                feedbackType = "success";
                dynamicStatus = "PUBLISHED";
                dynamicListingId = res.listingId;
            } else {
                feedbackMessage = `Erreur eBay : ${res.error || 'Erreur inconnue'}`;
                feedbackType = "error";
            }
        } catch (error) {
            console.error("Error publishing to eBay:", error);
            feedbackMessage = "Une erreur de connexion est survenue lors de la publication.";
            feedbackType = "error";
        } finally {
            isPublishing = false;
        }
    }
</script>

<div class="space-y-6 max-w-5xl mx-auto font-mono">
    <!-- eBay Live Status Banner Rétro -->
    <div class="retro-card-yellow p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div class="flex flex-wrap items-center gap-3">
            <span class="text-xs font-black uppercase text-black">Statut de l'annonce :</span>
            {#if dynamicStatus === "LOADING"}
                <span class="retro-badge bg-white text-[10px]">
                    <span class="loading loading-spinner loading-xs mr-1"></span>
                    Vérification...
                </span>
            {:else if dynamicStatus === "PUBLISHED" || dynamicStatus === "ACTIVE"}
                <span class="retro-badge bg-[#99E7DC] text-[10px] inline-flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                    <span>En ligne</span>
                </span>
            {:else if dynamicStatus === "NOT_LISTED"}
                <span class="retro-badge bg-white text-[10px] inline-flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-neutral-400"></span>
                    <span>Non publié</span>
                </span>
            {:else if dynamicStatus === "NOT_CONFIGURED"}
                <span class="retro-badge bg-[#FFD2A6] text-[10px] inline-flex items-center gap-1">
                    <span class="material-symbols-outlined text-[12px]">warning</span>
                    <span>Non configuré</span>
                </span>
            {:else if dynamicStatus === "NOT_AVAILABLE"}
                <span class="retro-badge bg-[#FFC2D1] text-[10px]">
                    Aperçu limité
                </span>
            {:else}
                <span class="retro-badge bg-[#FFC2D1] text-[10px]">
                    Indisponible
                </span>
            {/if}

            {#if dynamicListingId}
                <span class="border border-black bg-white px-2 py-0.5 text-xs font-bold">ID: {dynamicListingId}</span>
            {/if}
        </div>

        <div class="flex gap-2">
            {#if dynamicListingId}
                <a 
                    href={`https://www.ebay.be/itm/${dynamicListingId}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    class="retro-btn text-xs py-1.5 px-3 bg-[#99E7DC] hover:bg-[#78ded0] font-black flex items-center gap-1"
                >
                    <span>Voir l'annonce</span>
                    <span class="material-symbols-outlined text-[14px]">open_in_new</span>
                </a>
            {/if}
            <button 
                type="button" 
                onclick={checkLiveStatus} 
                disabled={isCheckingStatus || dynamicStatus === "NOT_AVAILABLE"}
                class="retro-btn text-xs py-1.5 px-3 bg-white flex items-center gap-1"
            >
                {#if isCheckingStatus}
                    <span class="loading loading-spinner loading-xs mr-1"></span>
                {:else}
                    <span class="material-symbols-outlined text-[14px]">refresh</span>
                {/if}
                <span>Actualiser</span>
            </button>
        </div>
    </div>

    <!-- Feedback Alerts -->
    {#if feedbackMessage}
        <div class="border-2 border-black p-3 text-xs font-bold uppercase shadow-[3px_3px_0px_0px_#000] {feedbackType === 'success' ? 'bg-[#99E7DC]' : feedbackType === 'error' ? 'bg-[#FFC2D1]' : 'bg-[#D4E2FD]'} text-black">
            <span>{feedbackMessage}</span>
        </div>
    {/if}

    <!-- Configuration Form -->
    <div class="retro-card p-6 space-y-4">
        <div class="flex items-center gap-2">
            <span class="retro-badge bg-[#D4E2FD] text-[10px]">PARAMÈTRES</span>
            <h2 class="text-lg font-black uppercase tracking-tight text-black">
                Personnaliser l'annonce eBay
            </h2>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t-2 border-black">
            <!-- Left Inputs Column -->
            <div class="space-y-3">
                <div class="space-y-1">
                    <label class="text-xs font-bold uppercase text-black">Titre personnalisé eBay</label>
                    <input 
                        type="text" 
                        placeholder={antiquite.name} 
                        bind:value={ebayTitle} 
                        class="retro-input" 
                    />
                    <span class="text-[10px] text-black/60">Par défaut : {antiquite.name}</span>
                </div>

                <div class="space-y-1">
                    <label class="text-xs font-bold uppercase text-black">Prix spécifique eBay (€)</label>
                    <input 
                        type="number" 
                        step="0.01" 
                        placeholder={antiquite.price.toString()} 
                        bind:value={ebayPrice} 
                        class="retro-input" 
                    />
                    <span class="text-[10px] text-black/60">Par défaut : {formatPrice(antiquite.price)}</span>
                </div>
            </div>

            <!-- Right Inputs Column -->
            <div class="space-y-3">
                <div class="space-y-1">
                    <label class="text-xs font-bold uppercase text-black">ID Catégorie eBay</label>
                    <input 
                        type="text" 
                        placeholder="119168" 
                        bind:value={ebayCategoryID} 
                        class="retro-input" 
                    />
                    <span class="text-[10px] text-black/60">Par défaut : 119168 (Art & Antiquités)</span>
                </div>

                <div class="space-y-1">
                    <label class="text-xs font-bold uppercase text-black">Description eBay</label>
                    <textarea 
                        placeholder={antiquite.description} 
                        bind:value={ebayDescription} 
                        class="retro-input h-24"
                    ></textarea>
                </div>
            </div>
        </div>
    </div>

    <!-- Live Preview -->
    <div class="retro-card p-6 space-y-4">
        <div class="flex justify-between items-center border-b-2 border-black pb-2">
            <div class="flex items-center gap-2">
                <span class="retro-badge bg-[#99E7DC] text-[10px]">LIVE PREVIEW</span>
                <h2 class="text-lg font-black uppercase tracking-tight text-black">
                    Aperçu de l'annonce eBay
                </h2>
            </div>
            <span class="retro-badge bg-[#FFE600] text-[9px] animate-pulse">Temps Réel</span>
        </div>

        <!-- Simulated eBay Card -->
        <div class="border-2 border-black bg-white p-4 shadow-[3px_3px_0px_0px_#000]">
            <div class="flex flex-col md:flex-row gap-6">
                <div class="w-full md:w-48 aspect-square border-2 border-black overflow-hidden flex-shrink-0 bg-[#EDE9DF]">
                    {#if antiquite.images && antiquite.images.length > 0}
                        <img src={antiquite.images[0].url} alt="" class="w-full h-full object-cover" />
                    {:else}
                        <div class="flex items-center justify-center h-full text-xs font-bold opacity-40">SANS IMAGE</div>
                    {/if}
                </div>

                <div class="flex-1 space-y-2">
                    <h3 class="font-black text-sm uppercase text-black">{previewTitle}</h3>
                    <div class="text-lg font-black text-black">{formatPrice(previewPrice)}</div>
                    <div class="text-xs text-black/70 line-clamp-3 leading-relaxed">{previewDescription}</div>
                    <div class="pt-2 border-t border-black/20 flex flex-wrap gap-2 text-[10px]">
                        <span class="border border-black px-1.5 py-0.5 bg-[#F6F4EE]">Catégorie : {previewCategory}</span>
                        <span class="border border-black px-1.5 py-0.5 bg-[#F6F4EE]">Taille : {antiquite.size}</span>
                        <span class="border border-black px-1.5 py-0.5 bg-[#F6F4EE]">Livraison : {getEstimatedDelivery()}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Actions Footer -->
    <div class="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t-2 border-black">
        <button 
            type="button" 
            onclick={() => window.history.back()} 
            class="retro-btn text-xs py-2 px-4 bg-white hover:bg-[#FFC2D1]"
        >
            Annuler
        </button>

        <div class="flex flex-wrap gap-2">
            <button 
                type="button" 
                onclick={saveEbayConfig} 
                disabled={isSaving || isPublishing}
                class="retro-btn text-xs py-2 px-4 bg-white hover:bg-[#FFE600] flex items-center gap-1.5"
            >
                {#if isSaving}
                    <span class="loading loading-spinner loading-xs mr-1"></span>
                {:else}
                    <span class="material-symbols-outlined text-[16px]">save</span>
                {/if}
                <span>Sauvegarder localement</span>
            </button>
            <button 
                type="button" 
                onclick={publishToEbay} 
                disabled={isSaving || isPublishing}
                class="retro-btn-primary text-xs py-2 px-6 font-black shadow-[3px_3px_0px_0px_#000] flex items-center gap-1.5"
            >
                {#if isPublishing}
                    <span class="loading loading-spinner loading-xs mr-1"></span>
                {:else}
                    <span class="material-symbols-outlined text-[16px]">sync</span>
                {/if}
                <span>Enregistrer & Publier sur eBay</span>
            </button>
        </div>
    </div>
</div>
