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
            <div class="flex justify-between items-center border-b pb-2">
                <h2 class="text-xl font-bold flex items-center gap-2">
                    👁️ Aperçu de l'annonce eBay
                </h2>
                <span class="text-xs uppercase font-mono px-2 py-0.5 rounded bg-info text-white font-bold animate-pulse shadow-sm">Temps Réel</span>
            </div>

            <!-- eBay Product Page Mockup -->
            <div class="bg-white text-neutral-800 shadow-xl border border-neutral-200 rounded-xl overflow-hidden font-sans text-sm">
                <!-- Faux eBay Header Bar -->
                <div class="bg-neutral-50 border-b border-neutral-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <div class="flex items-center gap-4">
                        <!-- eBay Logo -->
                        <span class="font-bold text-2xl tracking-tighter select-none">
                            <span class="text-[#e53238]">e</span><span class="text-[#0064d2]">b</span><span class="text-[#f5af02]">a</span><span class="text-[#86b817]">y</span>
                        </span>
                        <!-- Breadcrumbs -->
                        <div class="hidden sm:flex text-[10px] text-neutral-500 gap-1 items-center">
                            <span>Art, antiquités</span>
                            <span>&gt;</span>
                            <span class="font-semibold underline">{previewCategory}</span>
                        </div>
                    </div>
                    <!-- Faux Search Bar -->
                    <div class="flex flex-1 max-w-xs gap-0">
                        <input type="text" placeholder="Rechercher..." class="input input-xs bg-white border border-neutral-300 rounded-l-md rounded-r-none w-full text-neutral-800 focus:outline-none" readonly />
                        <button class="btn btn-xs btn-primary bg-[#0064d2] hover:bg-[#0053a0] border-none text-white font-bold rounded-r-md rounded-l-none px-3">Rechercher</button>
                    </div>
                </div>

                <!-- Main Layout Grid -->
                <div class="p-5 grid grid-cols-1 md:grid-cols-12 gap-6">
                    <!-- Left: Gallery (5 cols) -->
                    <div class="md:col-span-5 flex flex-col items-center">
                        <div class="w-full aspect-square bg-neutral-50 border border-neutral-200 rounded-lg flex items-center justify-center overflow-hidden p-2 relative">
                            {#if antiquite.images && antiquite.images.length > 0}
                                <img src={antiquite.images[0].url} alt={previewTitle} class="w-full h-full object-contain" />
                            {:else}
                                <span class="text-3xl opacity-20">🖼️</span>
                            {/if}
                            <span class="absolute bottom-2 right-2 bg-neutral-900/60 text-white text-[9px] font-bold px-2 py-0.5 rounded-full select-none">Image 1 sur {antiquite.images?.length || 1}</span>
                        </div>
                        
                        <!-- Gallery Thumbnails -->
                        {#if antiquite.images && antiquite.images.length > 1}
                            <div class="flex flex-wrap gap-1.5 mt-2 justify-center w-full">
                                {#each antiquite.images.slice(0, 5) as img, idx}
                                    <div class={`w-10 h-10 border rounded overflow-hidden p-0.5 bg-neutral-50 cursor-pointer transition-all hover:border-[#0064d2] ${idx === 0 ? 'border-[#0064d2] ring-1 ring-[#0064d2]' : 'border-neutral-200'}`}>
                                        <img src={img.url} alt="Aperçu" class="w-full h-full object-cover rounded" />
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    </div>

                    <!-- Right: Info & Buy Box (7 cols) -->
                    <div class="md:col-span-7 space-y-4">
                        <!-- Seller Header -->
                        <div class="text-[11px] text-neutral-500 flex justify-between items-center border-b pb-2">
                            <span>Vendeur : <span class="text-neutral-800 font-bold underline cursor-pointer">daisy_brocante</span> (100% d'évaluations positives)</span>
                            <span class="text-[#0064d2] font-semibold cursor-pointer">Suivre ce vendeur</span>
                        </div>

                        <!-- Item Title -->
                        <h1 class="text-xl font-bold text-neutral-900 leading-tight">
                            {previewTitle}
                        </h1>

                        <!-- Condition -->
                        <div class="flex items-center gap-2 py-1.5 border-y border-neutral-100 text-xs">
                            <span class="text-neutral-500">Condition :</span>
                            <span class="font-bold text-neutral-800">Occasion (Très bon état)</span>
                        </div>

                        <!-- Pricing Block -->
                        <div class="bg-neutral-50/70 p-4 rounded-lg border border-neutral-100 space-y-3">
                            <div class="flex items-baseline gap-2">
                                <span class="text-xs text-neutral-500">Achat immédiat :</span>
                                <span class="text-2xl font-bold text-neutral-900 font-mono">{formatPrice(previewPrice)}</span>
                            </div>
                            
                            <div class="text-[11px] text-neutral-500 flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                <span>Annonce consultée régulièrement</span>
                            </div>

                            <!-- eBay CTA Buttons -->
                            <div class="flex flex-col gap-2 pt-1">
                                <div class="bg-[#3665f3] hover:bg-[#2b51c5] text-white text-center font-bold py-2 px-4 rounded-full text-xs cursor-pointer select-none shadow-sm transition-colors">
                                    Achat immédiat
                                </div>
                                <div class="bg-[#e2f0fd] hover:bg-[#cbe3fa] text-[#3665f3] text-center font-bold py-2 px-4 rounded-full text-xs cursor-pointer select-none transition-colors border border-transparent">
                                    Ajouter au panier
                                </div>
                                <div class="bg-white hover:bg-neutral-50 text-neutral-700 text-center font-bold py-2 px-4 rounded-full text-xs cursor-pointer select-none transition-colors border border-neutral-300">
                                    💙 Ajouter à la liste d'affaires à suivre
                                </div>
                            </div>
                        </div>

                        <!-- Faux eBay Details Box -->
                        <div class="space-y-2.5 text-xs text-neutral-600 pt-1">
                            <!-- Shipping -->
                            <div class="grid grid-cols-12 gap-1.5">
                                <span class="col-span-3 font-semibold text-neutral-500">Livraison :</span>
                                <span class="col-span-9 font-bold text-neutral-800">
                                    {#if antiquite.size === "S"}
                                        Livraison standard (6,90 €)
                                    {:else if antiquite.size === "M"}
                                        Livraison Colissimo (12,50 €)
                                    {:else if antiquite.size === "L"}
                                        Livraison Transporteur (45,00 €)
                                    {:else}
                                        Livraison gratuite / Retrait sur place
                                    {/if}
                                </span>
                            </div>

                            <!-- Returns -->
                            <div class="grid grid-cols-12 gap-1.5">
                                <span class="col-span-3 font-semibold text-neutral-500">Retours :</span>
                                <span class="col-span-9 text-neutral-800">Retours acceptés sous 14 jours. L'acheteur prend en charge les frais de retour.</span>
                            </div>

                            <!-- Payments -->
                            <div class="grid grid-cols-12 gap-1.5 items-center">
                                <span class="col-span-3 font-semibold text-neutral-500">Paiements :</span>
                                <div class="col-span-9 flex flex-wrap gap-1">
                                    <span class="px-1.5 py-0.5 bg-neutral-100 rounded text-[9px] font-bold border border-neutral-200">Visa</span>
                                    <span class="px-1.5 py-0.5 bg-neutral-100 rounded text-[9px] font-bold border border-neutral-200">Mastercard</span>
                                    <span class="px-1.5 py-0.5 bg-neutral-100 rounded text-[9px] font-bold border border-neutral-200 text-blue-600">PayPal</span>
                                    <span class="px-1.5 py-0.5 bg-neutral-100 rounded text-[9px] font-bold border border-neutral-200">G Pay</span>
                                    <span class="px-1.5 py-0.5 bg-neutral-100 rounded text-[9px] font-bold border border-neutral-200">Apple Pay</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Bottom Description Tab Mockup -->
                <div class="border-t border-neutral-200 bg-neutral-50/50">
                    <div class="flex border-b border-neutral-200 bg-white">
                        <span class="px-4 py-2 text-xs font-bold text-neutral-800 border-b-2 border-[#0064d2] bg-neutral-50 cursor-pointer">
                            Description du vendeur
                        </span>
                    </div>
                    <div class="p-6 bg-white min-h-[160px] text-neutral-700 leading-relaxed text-xs">
                        <p class="whitespace-pre-line bg-neutral-50 p-4 border border-neutral-200 rounded-lg shadow-inner font-mono text-[11px]">
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
