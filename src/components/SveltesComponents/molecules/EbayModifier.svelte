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

    <!-- Configuration Form (Full Width card) -->
    <div class="bg-base-100 p-6 rounded-2xl border border-base-200 space-y-6">
        <h2 class="text-xl font-bold border-b pb-2 flex items-center gap-2">
            ✏️ Personnaliser l'annonce
        </h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Left Inputs Column -->
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
            </div>

            <!-- Right Inputs Column -->
            <div class="space-y-5">
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
    </div>

    <!-- Live Preview (Below Form, Full Width) -->
    <div class="bg-base-200/30 p-6 rounded-2xl border border-base-200 space-y-6 w-full animate-in fade-in duration-500">
            <div class="flex justify-between items-center border-b pb-2">
                <h2 class="text-xl font-bold flex items-center gap-2">
                    👁️ Aperçu de l'annonce eBay
                </h2>
                <span class="text-xs uppercase font-mono px-2 py-0.5 rounded bg-info text-white font-bold animate-pulse shadow-sm">Temps Réel</span>
            </div>

            <!-- eBay Product Page High Fidelity Mockup -->
            <div class="bg-white text-neutral-800 shadow-xl border border-neutral-200 rounded-xl overflow-hidden font-sans text-xs">
                <!-- 1. Top tiny utility bar -->
                <div class="bg-white border-b border-neutral-200 px-4 py-1.5 flex justify-between items-center text-[10px] text-neutral-500">
                    <div class="flex gap-3">
                        <span>Bonjour <strong class="text-neutral-800 font-bold">Lucas</strong> !</span>
                        <span class="hover:underline cursor-pointer">Deals eBay</span>
                        <span class="hover:underline cursor-pointer">Vendre</span>
                        <span class="hover:underline cursor-pointer">Aide & Assistance</span>
                    </div>
                    <div class="flex gap-3 items-center">
                        <span class="hover:underline cursor-pointer">Favoris 🤍</span>
                        <span class="hover:underline cursor-pointer">Mon eBay ▾</span>
                        <span class="hover:underline cursor-pointer text-sm">🔔</span>
                        <span class="hover:underline cursor-pointer text-sm">🛒</span>
                    </div>
                </div>

                <!-- 2. Main Faux Search Bar -->
                <div class="bg-white px-4 py-3 flex items-center gap-4 border-b border-neutral-200">
                    <!-- eBay Logo -->
                    <span class="font-extrabold text-2xl tracking-tighter select-none font-sans leading-none">
                        <span class="text-[#e53238]">e</span><span class="text-[#0064d2]">b</span><span class="text-[#f5af02]">a</span><span class="text-[#86b817]">y</span>
                    </span>

                    <!-- Search Fields Group -->
                    <div class="flex flex-1 items-center gap-0 border border-neutral-400 rounded focus-within:ring-2 focus-within:ring-blue-500 overflow-hidden">
                        <div class="flex items-center flex-1 px-3 bg-white">
                            <span class="text-neutral-400 text-sm">🔍</span>
                            <input type="text" placeholder="Rechercher un objet..." value={previewTitle} class="w-full bg-white border-none text-neutral-800 text-xs px-2 py-1.5 focus:outline-none focus:ring-0" readonly />
                        </div>
                        <div class="hidden sm:block border-l border-neutral-300 px-3 py-1 bg-white text-neutral-500 text-[10px]">
                            Toutes les catégories ▾
                        </div>
                        <button class="bg-[#3665f3] hover:bg-[#2b51c5] text-white font-bold text-xs px-6 py-2 transition-colors border-l border-neutral-400">
                            Rechercher
                        </button>
                    </div>
                </div>

                <!-- 3. Sub-header links -->
                <div class="hidden sm:flex bg-neutral-50 px-4 py-2 border-b border-neutral-200 text-[10px] text-neutral-600 gap-4">
                    <span class="font-bold text-neutral-900 cursor-pointer">Explorer par catégorie ▾</span>
                    <span class="hover:underline cursor-pointer">Favoris</span>
                    <span class="hover:underline cursor-pointer">Sous-bois & Matériaux</span>
                    <span class="hover:underline cursor-pointer">Art antique</span>
                    <span class="hover:underline cursor-pointer">Meubles anciens</span>
                    <span class="hover:underline cursor-pointer">Brocante</span>
                </div>

                <!-- 4. Breadcrumbs & Share -->
                <div class="px-5 py-2.5 flex justify-between items-center text-[10px] text-neutral-500">
                    <div class="flex gap-1.5 items-center">
                        <span class="hover:underline cursor-pointer">Retourner à la page d'accueil</span>
                        <span>|</span>
                        <span>Catégorie : Art, antiquités &gt; Architecture, matériaux &gt; <span class="underline font-semibold text-neutral-700">{previewCategory}</span></span>
                    </div>
                    <div class="flex gap-2">
                        <span class="hover:underline cursor-pointer">🤍 Suivre cet objet</span>
                        <span>|</span>
                        <span class="hover:underline cursor-pointer">Partager</span>
                    </div>
                </div>

                <!-- 5. 3-Column Listing Grid -->
                <div class="px-5 pb-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    <!-- LEFT COLUMN: Gallery (lg:col-span-4) -->
                    <div class="lg:col-span-4 flex flex-col items-center">
                        <div class="w-full aspect-square bg-[#f7f7f7] border border-neutral-200 rounded flex items-center justify-center overflow-hidden p-2 relative">
                            {#if antiquite.images && antiquite.images.length > 0}
                                <img src={antiquite.images[0].url} alt={previewTitle} class="w-full h-full object-contain" />
                            {:else}
                                <span class="text-3xl opacity-20">🖼️</span>
                            {/if}
                            <div class="absolute top-2 left-2 bg-neutral-900/60 text-white text-[8px] font-bold px-1.5 py-0.5 rounded">
                                Neuf / Occasion
                            </div>
                        </div>

                        <!-- Gallery Thumbnails -->
                        {#if antiquite.images && antiquite.images.length > 1}
                            <div class="flex flex-wrap gap-1 mt-2 justify-center w-full">
                                {#each antiquite.images.slice(0, 4) as img, idx}
                                    <div class={`w-9 h-9 border rounded overflow-hidden p-0.5 bg-neutral-50 cursor-pointer ${idx === 0 ? 'border-blue-600 ring-1 ring-blue-600' : 'border-neutral-200'}`}>
                                        <img src={img.url} alt="Miniature" class="w-full h-full object-cover rounded-sm" />
                                    </div>
                                    
                                {/each}
                            </div>
                        {/if}
                    </div>

                    <!-- MIDDLE COLUMN: Title, Buy Box, Details (lg:col-span-5) -->
                    <div class="lg:col-span-5 space-y-4">
                        <!-- Product Title -->
                        <h1 class="text-base font-bold text-neutral-900 leading-tight">
                            {previewTitle}
                        </h1>

                        <div class="h-px bg-neutral-200"></div>

                        <!-- Faux Condition info -->
                        <div class="grid grid-cols-12 gap-1 text-xs">
                            <span class="col-span-3 text-neutral-500">Condition :</span>
                            <div class="col-span-9">
                                <span class="font-bold text-neutral-800 text-sm">Occasion</span>
                                <p class="text-neutral-500 text-[10px] mt-0.5 leading-snug">“Objet de brocante unique en très bon état de conservation. Vendu selon photos.”</p>
                            </div>
                        </div>

                        <!-- Faux Buy box layout -->
                        <div class="bg-neutral-50 p-4 border border-neutral-200 rounded space-y-3">
                            <div class="grid grid-cols-12 gap-1 items-baseline">
                                <span class="col-span-3 text-neutral-500 text-[11px]">Prix :</span>
                                <div class="col-span-9 flex flex-col">
                                    <div class="flex items-baseline gap-2">
                                        <span class="text-2xl font-bold text-neutral-900 font-sans">{formatPrice(previewPrice)}</span>
                                    </div>
                                    <span class="text-[9px] text-neutral-500 mt-0.5">Achat immédiat</span>
                                </div>
                            </div>

                            <!-- Faux Stock Status -->
                            <div class="grid grid-cols-12 gap-1 text-[11px]">
                                <span class="col-span-3 text-neutral-500">Quantité :</span>
                                <div class="col-span-9 flex items-center gap-3">
                                    <span class="font-semibold text-neutral-800">1 disponible (Objet unique)</span>
                                    <span class="text-red-600 font-bold animate-pulse text-[9px] bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">Dépêchez-vous !</span>
                                </div>
                            </div>

                            <!-- CTA Buttons -->
                            <div class="pt-2 flex flex-col gap-2">
                                <div class="bg-[#3665f3] hover:bg-[#274ebd] text-white font-bold text-xs text-center py-2.5 rounded-full cursor-pointer transition-colors shadow-sm">
                                    Achat immédiat
                                </div>
                                <div class="bg-[#e2f0fd] hover:bg-[#cbdffa] text-[#3665f3] font-bold text-xs text-center py-2.5 rounded-full cursor-pointer transition-colors">
                                    Ajouter au panier
                                </div>
                                <div class="bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-300 font-bold text-xs text-center py-2.5 rounded-full cursor-pointer transition-colors">
                                    💙 Ajouter à la liste d'affaires à suivre
                                </div>
                            </div>
                        </div>

                        <!-- Shipping & Delivery Details -->
                        <div class="space-y-2 text-[11px] text-neutral-600">
                            <!-- Shipping -->
                            <div class="grid grid-cols-12 gap-1">
                                <span class="col-span-3 text-neutral-500">Livraison :</span>
                                <div class="col-span-9">
                                    <span class="font-bold text-neutral-800">
                                        {#if antiquite.size === "S"}
                                            6,90 EUR - Livraison Standard en Point Relais
                                        {:else if antiquite.size === "M"}
                                            12,50 EUR - Livraison Colissimo à Domicile
                                        {:else if antiquite.size === "L"}
                                            45,00 EUR - Livraison Transporteur spécialisé
                                        {:else}
                                            Gratuit - Retrait sur place ou livraison par transporteur
                                        {/if}
                                    </span>
                                    <p class="text-neutral-500 text-[10px] mt-0.5">Livraison {getEstimatedDelivery()}</p>
                                </div>
                            </div>

                            <!-- Returns -->
                            <div class="grid grid-cols-12 gap-1">
                                <span class="col-span-3 text-neutral-500">Retours :</span>
                                <span class="col-span-9 text-neutral-800 font-medium">Retours acceptés sous 14 jours. Frais de retour à la charge de l'acheteur.</span>
                            </div>

                            <!-- Payments -->
                            <div class="grid grid-cols-12 gap-1 items-center">
                                <span class="col-span-3 text-neutral-500">Paiements :</span>
                                <div class="col-span-9 flex flex-wrap gap-1">
                                    <span class="px-1.5 py-0.5 bg-neutral-100 border border-neutral-200 text-[8px] font-bold rounded">Visa</span>
                                    <span class="px-1.5 py-0.5 bg-neutral-100 border border-neutral-200 text-[8px] font-bold rounded">Mastercard</span>
                                    <span class="px-1.5 py-0.5 bg-neutral-100 border border-neutral-200 text-[8px] font-bold rounded text-blue-600">PayPal</span>
                                    <span class="px-1.5 py-0.5 bg-neutral-100 border border-neutral-200 text-[8px] font-bold rounded">Apple Pay</span>
                                    <span class="px-1.5 py-0.5 bg-neutral-100 border border-neutral-200 text-[8px] font-bold rounded">Google Pay</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- RIGHT COLUMN: Seller Info Box & Customer Guarantee (lg:col-span-3) -->
                    <div class="lg:col-span-3 space-y-4">
                        <!-- Seller Card -->
                        <div class="border border-neutral-200 rounded-lg p-3 bg-neutral-50/50 space-y-3">
                            <h3 class="font-bold text-neutral-800 border-b pb-1.5 text-[11px] uppercase tracking-wider">Informations vendeur</h3>
                            <div>
                                <span class="text-blue-600 font-bold underline text-xs cursor-pointer">daisy_brocante</span>
                                <div class="flex items-center gap-1 mt-0.5 text-[10px] text-neutral-500">
                                    <span>Score de confiance : 142</span>
                                    <span class="text-amber-500">★</span>
                                </div>
                                <span class="text-[9px] bg-green-100 text-green-700 px-1 rounded font-semibold inline-block mt-1">100% d'évaluations positives</span>
                            </div>
                            <div class="h-px bg-neutral-200"></div>
                            <div class="flex flex-col gap-1.5 text-[10px] text-blue-600 underline">
                                <span class="cursor-pointer">Visiter la boutique du vendeur</span>
                                <span class="cursor-pointer">Afficher les autres objets</span>
                                <span class="cursor-pointer text-neutral-600 no-underline hover:underline">Contacter le vendeur</span>
                            </div>
                        </div>

                        <!-- eBay Guarantee Card -->
                        <div class="border border-neutral-200 rounded-lg p-3 space-y-2">
                            <div class="flex items-center gap-1.5">
                                <span class="text-amber-500 text-lg">🛡️</span>
                                <span class="font-extrabold text-neutral-800 text-[11px]">Garantie client eBay</span>
                            </div>
                            <p class="text-[10px] text-neutral-500 leading-snug">
                                Bénéficiez d'un remboursement intégral si l'objet ne correspond pas à la description ou s'il n'est pas livré.
                            </p>
                        </div>
                    </div>
                </div>

                <!-- 6. eBay Caractéristiques de l'objet (Item Specifics) -->
                <div class="border-t border-neutral-200 p-5 bg-white space-y-3">
                    <h3 class="text-sm font-bold text-neutral-900 border-b pb-1.5">Caractéristiques de l'objet</h3>
                    
                    <div class="grid grid-cols-1 md:grid-cols-4 border border-neutral-200 rounded overflow-hidden text-[10px]">
                        <!-- Row 1 -->
                        <div class="bg-neutral-100 p-2 font-bold text-neutral-600 border-r border-b border-neutral-200">État :</div>
                        <div class="p-2 border-r border-b border-neutral-200 md:col-span-3 text-neutral-700 font-medium">
                            Occasion: Objet ayant été utilisé. Consulter la description pour plus de détails.
                        </div>

                        <!-- Row 2 -->
                        <div class="bg-neutral-100 p-2 font-bold text-neutral-600 border-r border-b border-neutral-200">Marque :</div>
                        <div class="p-2 border-r border-b border-neutral-200 text-neutral-700">Sans marque</div>
                        <div class="bg-neutral-100 p-2 font-bold text-neutral-600 border-r border-b border-neutral-200">Type :</div>
                        <div class="p-2 border-b border-neutral-200 text-neutral-700">Antiquité unique</div>

                        <!-- Row 3 -->
                        <div class="bg-neutral-100 p-2 font-bold text-neutral-600 border-r border-neutral-200">Catégorie eBay :</div>
                        <div class="p-2 border-r border-neutral-200 text-neutral-700 font-mono">{previewCategory}</div>
                        <div class="bg-neutral-100 p-2 font-bold text-neutral-600 border-r border-neutral-200">Taille :</div>
                        <div class="p-2 text-neutral-700 font-mono">Format {antiquite.size}</div>
                    </div>
                </div>

                <!-- 7. Bottom Faux description panel -->
                <div class="border-t border-neutral-200 bg-neutral-50/50">
                    <div class="flex border-b border-neutral-200 bg-white">
                        <span class="px-4 py-2 text-xs font-bold text-neutral-800 border-b-2 border-blue-600 bg-neutral-50">
                            Description du vendeur
                        </span>
                        <span class="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-neutral-600 cursor-pointer">
                            Livraison et paiements
                        </span>
                    </div>
                    
                    <div class="p-5 bg-white">
                        <!-- Simulated eBay Description Frame -->
                        <div class="border border-neutral-200 p-6 rounded bg-neutral-50/20 font-serif leading-relaxed text-neutral-700 text-xs shadow-inner">
                            <div class="text-center font-sans text-xs font-bold uppercase tracking-wider text-neutral-400 border-b border-dashed border-neutral-300 pb-2 mb-4">
                                Début de la description de l'objet
                            </div>
                            <p class="whitespace-pre-line font-mono text-[11px] leading-relaxed">
                                {previewDescription}
                            </p>
                            <div class="text-center font-sans text-xs font-bold uppercase tracking-wider text-neutral-400 border-t border-dashed border-neutral-300 pt-2 mt-4">
                                Fin de la description
                            </div>
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
