<script lang="ts">
    import { onMount } from "svelte";
    import type { Antiquite } from "../../../type";
    import { apiFetch } from "../../../lib/api";

    interface Props {
        antiquite: Antiquite;
    }

    let { antiquite }: Props = $props();

    // Local reactive states for eBay specific fields
    let ebayTitle = $state(antiquite.ebay_title ?? "");
    let ebayDescription = $state(antiquite.ebay_description ?? "");
    let ebayPrice = $state(antiquite.ebay_price ?? 0);
    let ebayCategoryID = $state(antiquite.ebay_category_id ?? "");

    // Dynamic status states
    let dynamicStatus = $state("LOADING"); // LOADING, PUBLISHED, NOT_LISTED, NOT_CONFIGURED, ERROR, NOT_AVAILABLE
    let dynamicListingId = $state(antiquite.ebay_listing_id ?? "");
    let isCheckingStatus = $state(false);
    let isSaving = $state(false);
    let isPublishing = $state(false);
    let feedbackMessage = $state("");
    let feedbackType = $state<"success" | "error" | "info" | "">("");

    // Live derived preview values
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
        
        // We use PATCH on the standard antiquite endpoint to save the modified fields
        const formData = new FormData();
        formData.append("ebay_title", ebayTitle);
        formData.append("ebay_description", ebayDescription);
        formData.append("ebay_price", ebayPrice !== null ? ebayPrice.toString() : "0");
        formData.append("ebay_category_id", ebayCategoryID);
        
        // Retain existing image references
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
                feedbackMessage = "Configuration eBay enregistrée localement avec succès ! 💾";
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
            // First save config locally
            const saved = await saveEbayConfig();
            if (!saved) return;

            // Trigger the publish endpoint
            feedbackMessage = "Publication/Mise à jour en cours sur eBay... 🚀";
            feedbackType = "info";

            const response = await apiFetch(`${PUBLIC_API_URL}/api/antiquites/${antiquite.id}/publish-ebay`, {
                method: "POST"
            });

            const res = await response.json();
            if (response.ok) {
                feedbackMessage = `✅ ${res.message || "Objet synchronisé sur eBay avec succès !"} \nID d'annonce : ${res.listingId}`;
                feedbackType = "success";
                dynamicStatus = "PUBLISHED";
                dynamicListingId = res.listingId;
            } else {
                feedbackMessage = `❌ Erreur eBay : ${res.error || 'Erreur inconnue'}`;
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

<div class="space-y-8">
    <!-- eBay Live Status Banner -->
    <div class="bg-base-200/50 p-6 rounded-2xl border border-base-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div class="flex items-center gap-3">
            <span class="text-sm font-semibold text-base-content/70">Statut de l'annonce :</span>
            {#if dynamicStatus === "LOADING"}
                <span class="badge badge-info badge-outline gap-1 px-3 py-2 font-bold uppercase text-[10px]">
                    <span class="loading loading-spinner loading-xs"></span>
                    Vérification...
                </span>
            {:else if dynamicStatus === "PUBLISHED" || dynamicStatus === "ACTIVE"}
                <span class="badge badge-success gap-1.5 font-bold uppercase text-[10px] px-3 py-2">
                    <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                    En ligne
                </span>
            {:else if dynamicStatus === "NOT_LISTED"}
                <span class="badge badge-ghost font-bold uppercase text-[10px] opacity-60 px-3 py-2">
                    Non publié
                </span>
            {:else if dynamicStatus === "NOT_CONFIGURED"}
                <span class="badge badge-warning font-bold uppercase text-[10px] px-3 py-2">
                    eBay non configuré
                </span>
            {:else if dynamicStatus === "NOT_AVAILABLE"}
                <span class="badge badge-warning badge-outline font-bold uppercase text-[9px] px-3 py-2" title="L'API locale ne supporte pas l'endpoint GetEbayStatus">
                    Aperçu limité (Serveur distant)
                </span>
            {:else}
                <span class="badge badge-error font-bold uppercase text-[10px] px-3 py-2">
                    Indisponible
                </span>
            {/if}

            {#if dynamicListingId}
                <span class="text-xs font-mono bg-base-300/50 px-2 py-1 rounded">ID: {dynamicListingId}</span>
            {/if}
        </div>

        <div class="flex gap-2">
            {#if dynamicListingId}
                <a 
                    href={`https://www.ebay.be/itm/${dynamicListingId}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    class="btn btn-sm btn-success text-white gap-2"
                >
                    Voir l'annonce
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                </a>
            {/if}
            <button 
                type="button" 
                onclick={checkLiveStatus} 
                disabled={isCheckingStatus || dynamicStatus === "NOT_AVAILABLE"}
                class="btn btn-sm btn-outline gap-1.5"
            >
                {#if isCheckingStatus}
                    <span class="loading loading-spinner loading-xs"></span>
                {/if}
                Actualiser le statut
            </button>
        </div>
    </div>

    <!-- Feedback Alerts -->
    {#if feedbackMessage}
        <div class={`alert ${feedbackType === 'success' ? 'alert-success' : feedbackType === 'error' ? 'alert-error' : 'alert-info'} shadow-md animate-in fade-in duration-300`}>
            <span>{feedbackMessage}</span>
        </div>
    {/if}

    <!-- Forms Comparison Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Configuration Form (Left) -->
        <div class="space-y-6">
            <h2 class="text-xl font-bold border-b pb-2 flex items-center gap-2">
                ✏️ Personnaliser l'annonce
            </h2>

            <div class="space-y-5">
                <!-- Title -->
                <fieldset class="fieldset">
                    <legend class="fieldset-legend font-semibold text-base-content/80">Titre personnalisé eBay</legend>
                    <input 
                        type="text" 
                        placeholder={antiquite.name} 
                        bind:value={ebayTitle} 
                        class="input input-bordered w-full rounded-xl py-6" 
                    />
                    <span class="fieldset-label text-xs opacity-60">
                        Par défaut, le nom de l'objet ({antiquite.name}) sera utilisé.
                    </span>
                </fieldset>

                <!-- Price -->
                <fieldset class="fieldset">
                    <legend class="fieldset-legend font-semibold text-base-content/80">Prix spécifique eBay (EUR)</legend>
                    <input 
                        type="number" 
                        step="0.01" 
                        placeholder={antiquite.price.toString()} 
                        bind:value={ebayPrice} 
                        class="input input-bordered w-full rounded-xl py-6 font-mono" 
                    />
                    <span class="fieldset-label text-xs opacity-60">
                        Si vide ou égal à 0, le prix par défaut ({formatPrice(antiquite.price)}) sera envoyé.
                    </span>
                </fieldset>

                <!-- Category -->
                <fieldset class="fieldset">
                    <legend class="fieldset-legend font-semibold text-base-content/80">ID de catégorie eBay</legend>
                    <input 
                        type="text" 
                        placeholder="119168" 
                        bind:value={ebayCategoryID} 
                        class="input input-bordered w-full rounded-xl py-6 font-mono" 
                    />
                    <span class="fieldset-label text-xs opacity-60">
                        Par défaut: 119168 (Art, antiquités &gt; Architecture, matériaux &gt; Autres).
                    </span>
                </fieldset>

                <!-- Description -->
                <fieldset class="fieldset">
                    <legend class="fieldset-legend font-semibold text-base-content/80">Description personnalisée eBay</legend>
                    <textarea 
                        placeholder={antiquite.description} 
                        bind:value={ebayDescription} 
                        class="textarea textarea-bordered h-44 w-full rounded-xl py-4"
                    ></textarea>
                    <span class="fieldset-label text-xs opacity-60">
                        Si vide, la description par défaut sera envoyée.
                    </span>
                </fieldset>
            </div>
        </div>

        <!-- Live Preview (Right) -->
        <div class="bg-base-200/30 p-6 rounded-2xl border border-base-200 space-y-6">
            <h2 class="text-xl font-bold border-b pb-2 flex items-center gap-2">
                👁️ Aperçu de l'annonce eBay
            </h2>

            <div class="card bg-base-100 shadow-lg border border-base-200 overflow-hidden">
                <!-- Preview Image Carousel / Cover -->
                <div class="relative bg-base-200 h-64 flex items-center justify-center overflow-hidden">
                    {#if antiquite.images && antiquite.images.length > 0}
                        <img src={antiquite.images[0].url} alt={previewTitle} class="w-full h-full object-contain" />
                    {:else}
                        <span class="text-3xl opacity-20">🖼️</span>
                    {/if}
                    <div class="absolute top-3 left-3">
                        <span class="badge badge-info font-bold text-[9px] uppercase tracking-wider shadow-sm">Aperçu eBay</span>
                    </div>
                </div>

                <div class="p-6 space-y-4">
                    <!-- Title -->
                    <div>
                        <span class="text-xs opacity-50 uppercase tracking-widest font-mono">Titre de l'annonce</span>
                        <h3 class="text-xl font-bold text-base-content leading-snug mt-0.5">{previewTitle}</h3>
                    </div>

                    <!-- Price & Category -->
                    <div class="grid grid-cols-2 gap-4 bg-base-200/50 p-3 rounded-xl">
                        <div>
                            <span class="text-[10px] opacity-50 uppercase tracking-widest font-mono">Prix</span>
                            <div class="text-lg font-bold text-primary font-mono mt-0.5">{formatPrice(previewPrice)}</div>
                        </div>
                        <div>
                            <span class="text-[10px] opacity-50 uppercase tracking-widest font-mono">ID Catégorie</span>
                            <div class="text-sm font-bold font-mono mt-1">{previewCategory}</div>
                        </div>
                    </div>

                    <!-- Description -->
                    <div>
                        <span class="text-xs opacity-50 uppercase tracking-widest font-mono">Description de l'objet</span>
                        <p class="text-sm text-base-content/80 whitespace-pre-line leading-relaxed mt-1 line-clamp-6">
                            {previewDescription}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Actions Footer -->
    <div class="flex flex-col sm:flex-row justify-between items-center gap-4 mt-12 pt-6 border-t border-base-200">
        <button 
            type="button" 
            onclick={() => window.history.back()} 
            class="btn btn-ghost"
        >
            Annuler
        </button>

        <div class="flex flex-wrap gap-3">
            <button 
                type="button" 
                onclick={saveEbayConfig} 
                disabled={isSaving || isPublishing}
                class="btn btn-outline"
            >
                {#if isSaving}
                    <span class="loading loading-spinner loading-xs"></span>
                {/if}
                Sauvegarder localement
            </button>
            <button 
                type="button" 
                onclick={publishToEbay} 
                disabled={isSaving || isPublishing}
                class="btn btn-info text-white px-8 shadow-md"
            >
                {#if isPublishing}
                    <span class="loading loading-spinner loading-xs"></span>
                {:else}
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                {/if}
                Enregistrer & Publier sur eBay
            </button>
        </div>
    </div>
</div>
