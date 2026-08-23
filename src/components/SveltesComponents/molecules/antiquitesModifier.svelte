<script lang="ts">
    import DataModifier from "../atoms/DataModifier.svelte";
    import ImagesContainer from "./ImagesContainer.svelte";
    import RetroSelect from "../atoms/RetroSelect.svelte";
    import type { Antiquite, Subcategory } from "../../../type";
    import { apiFetch } from "../../../lib/api";
    import QRCode from 'qrcode';
    import { untrack, onMount } from "svelte";

    interface Props {
        antiquite: Antiquite
    }

    let { antiquite }: Props = $props();
    
    let name = $state(antiquite.name);
    let description = $state(antiquite.description);

    let year = $state(antiquite.year ? String(antiquite.year) : "vintage");
    let price = $state(antiquite.price);
    let quantity = $state<number>(antiquite.quantity ?? 1);
    let category = $state(antiquite.category);
    let subcategory_id = $state<number | null>(antiquite.subcategory_id ?? null);
    let subcategories = $state<Subcategory[]>([]);
    let size = $state(antiquite.size);
    let images = $state(antiquite.images);
    let status = $state(antiquite.status);
    let nouveaute = $state(antiquite.nouveaute ?? false);

    // Charge les sous-catégories à chaque fois que la catégorie change
    $effect(() => {
        const currentCategory = category;
        if (currentCategory) {
            const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
            fetch(`${PUBLIC_API_URL}/front/subcategories?category=${encodeURIComponent(currentCategory)}`)
                .then(res => {
                    if (res.ok) return res.json();
                    return [];
                })
                .then(data => {
                    subcategories = data;
                    untrack(() => {
                        if (subcategory_id !== null && !subcategories.find(s => Number(s.id) === Number(subcategory_id))) {
                            subcategory_id = null;
                        }
                    });
                })
                .catch(err => console.error("Error fetching subcategories:", err));
        } else {
            subcategories = [];
            subcategory_id = null;
        }
    });

    let subcatOptions = $derived([
        { value: null, label: "Aucune sous-catégorie" },
        ...subcategories.map(s => ({ value: s.id, label: s.name }))
    ]);
    
    let ebayTitle = $state(antiquite.ebay_title ?? "");
    let ebayDescription = $state(antiquite.ebay_description ?? "");
    let ebayPrice = $state(antiquite.ebay_price ?? 0);
    let ebayCategoryID = $state(antiquite.ebay_category_id ?? "");
    let isPublishingEbay = $state(false);
    let isPublishingFB = $state(false);
    let isSaving = $state(false);
    let isEnhancing = $state(false);

    let newFiles = $state<File[]>([]); 
    let s3Keys = $state<string[]>([]); 
    let qrCodeDataUrl = $state("");

    $effect(() => {
        if (antiquite.id) {
            const currentUrl = window.location.origin;
            const url = `${currentUrl}/inventoryt5hr4hr85g48412r/${antiquite.id}`;
            QRCode.toDataURL(url, { margin: 1, width: 200 })
                .then(url => {
                    qrCodeDataUrl = url;
                })
                .catch(err => {
                    console.error("Erreur de génération QR Code", err);
                });
        }
    });

    function printQRCode() {
        if (!qrCodeDataUrl) return;
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Imprimer QR Code #${antiquite.id}</title>
                        <style>
                            body { display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: monospace; }
                            img { max-width: 180px; height: auto; margin-bottom: 0.5rem; border: 2px solid #000; padding: 5px; }
                            h3 { font-size: 14px; margin: 0; text-transform: uppercase; }
                            p { font-size: 12px; margin: 2px 0 0 0; }
                            @media print {
                                @page { margin: 0; }
                                body { margin: 1cm; }
                            }
                        </style>
                    </head>
                    <body>
                        <img src="${qrCodeDataUrl}" />
                        <h3>${name}</h3>
                        <p>ID: #${antiquite.id} - ${price} €</p>
                        <scr` + `ipt>
                            window.onload = function() { window.print(); window.close(); }
                        </scr` + `ipt>
                    </body>
                </html>
            `);
            printWindow.document.close();
        }
    }

    async function enhanceDescription() {
        if (!name || !category) {
            alert("Veuillez renseigner le nom et la catégorie pour aider l'IA.");
            return;
        }

        isEnhancing = true;
        const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
        
        try {
            const response = await apiFetch(`${PUBLIC_API_URL}/api/ai/enhance`, {
                method: "POST",
                body: JSON.stringify({
                    name,
                    category,
                    description
                })
            });

            if (response.ok) {
                const result = await response.json();
                description = result.enhanced_description;
            } else {
                alert("Erreur lors de l'amélioration de la description.");
            }
        } catch (error) {
            console.error("Error enhancing description:", error);
            alert("Une erreur est survenue avec l'IA.");
        } finally {
            isEnhancing = false;
        }
    }

    async function saveAntiquity(id: number): Promise<boolean> {
        const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
        const formData = new FormData();
        
        formData.append("name", name);
        formData.append("description", description);
        formData.append("category", category);
        formData.append("subcategory_id", subcategory_id !== null ? subcategory_id.toString() : "");
        formData.append("size", size);
        formData.append("price", price.toString());
        formData.append("quantity", (quantity !== null && quantity !== undefined ? quantity : 1).toString());
        formData.append("year", year.toString());
        formData.append("status", status.toString());
        formData.append("nouveaute", nouveaute.toString());
        formData.append("ebay_title", ebayTitle);
        formData.append("ebay_description", ebayDescription);
        formData.append("ebay_price", ebayPrice !== null ? ebayPrice.toString() : "0");
        formData.append("ebay_category_id", ebayCategoryID);

        const existingIds = images
            .filter(img => !img.url.startsWith('blob:') && !img.s3_key)
            .map(img => img.id)
            .join(',');
        
        formData.append("existing_ids", existingIds);

        if (s3Keys.length > 0) {
            formData.append("new_s3_keys", s3Keys.join(','));
        }

        newFiles.forEach(file => {
            formData.append("new_images", file);  
        });

        try {
            const response = await apiFetch(`${PUBLIC_API_URL}/api/antiquites/${id}`, {
                method: "PATCH",
                body: formData 
            });
            return response.ok;
        } catch (error) {
            console.error("Error saving antiquity:", error);
            return false;
        }
    }

    async function saveAndNavigate(targetId: number, path: string = 'antiquites') {
        if (isSaving) return;
        isSaving = true;
        const ok = await saveAntiquity(antiquite.id);
        isSaving = false;
        if (ok) {
            window.location.href = `/${path}/${targetId}`;
        } else {
            alert("❌ Erreur lors de l'enregistrement de l'objet. Navigation annulée.");
        }
    }

    onMount(() => {
        (window as any).saveAndNavigateTo = (targetId: number, path: string = 'antiquites') => {
            saveAndNavigate(targetId, path);
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            const activeElement = document.activeElement;
            if (activeElement) {
                const tagName = activeElement.tagName.toLowerCase();
                const isContentEditable = activeElement.getAttribute('contenteditable') === 'true';
                if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || isContentEditable) {
                    return;
                }
            }

            if (e.key === 'ArrowLeft' && antiquite.prev_id) {
                saveAndNavigate(antiquite.prev_id, 'antiquites');
            } else if (e.key === 'ArrowRight' && antiquite.next_id) {
                saveAndNavigate(antiquite.next_id, 'antiquites');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            delete (window as any).saveAndNavigateTo;
        };
    });

    async function modifyAntiquity(id: number) {
        isSaving = true;
        const ok = await saveAntiquity(id);
        isSaving = false;
        if (ok) {
            alert("Objet mis à jour avec succès ! ✨");
            window.history.back();
        } else {
            alert("Une erreur est survenue lors de la mise à jour de l'objet.");
        }
    }

    async function publishToFacebook(id: number) {
        if (!confirm("Voulez-vous enregistrer les modifications et publier cet objet sur la Page Facebook et l'ajouter au Catalogue ?")) return;
        
        isPublishingFB = true;
        const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
        try {
            const saved = await saveAntiquity(id);
            if (!saved) {
                alert("❌ Impossible d'enregistrer les modifications de l'objet. Publication annulée.");
                return;
            }

            const response = await apiFetch(`${PUBLIC_API_URL}/api/antiquites/${id}/publish-facebook`, {
                method: "POST",
            });

            if (response.ok) {
                alert("✅ Objet publié avec succès sur Facebook et ajouté au catalogue !");
            } else {
                const res = await response.json();
                alert(`❌ Erreur lors de la publication : ${res.error || 'Erreur inconnue'}`);
            }
        } catch (error) {
            console.error("Error publishing to FB:", error);
            alert("Une erreur de connexion est survenue.");
        } finally {
            isPublishingFB = false;
        }
    }
</script>

<div class="space-y-6 max-w-4xl mx-auto font-mono">
    <!-- Header Rétro -->
    <div class="retro-card-peach p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <div class="flex items-center gap-2">
                <span class="retro-badge bg-black text-white text-[10px]">FICHE OBJET #{antiquite.id}</span>
                <span class="text-xs font-bold text-black/70">{category}</span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-black uppercase tracking-tight text-black mt-1">
                {name || "Modification Antiquité"}
            </h1>
            <p class="text-xs text-black/80 mt-0.5">Modifiez les caractéristiques, visuels et options de vente.</p>
        </div>

        <div class="flex items-center gap-2">
            {#if antiquite.id}
                <button 
                    onclick={() => publishToFacebook(antiquite.id)} 
                    disabled={isPublishingFB}
                    class="retro-btn py-1.5 px-3 text-xs bg-[#D4E2FD] hover:bg-[#b8d2fe]"
                    title="Publier sur Facebook"
                >
                    {#if isPublishingFB}
                        <span class="loading loading-spinner loading-xs"></span>
                    {:else}
                        📘 Facebook
                    {/if}
                </button>
            {/if}
            <div class="retro-icon-box bg-white">
                🏷️
            </div>
        </div>
    </div>

    <!-- Formulaire Principal -->
    <div class="retro-card p-6 space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Colonne 1 : Nom & Description -->
            <div class="space-y-4">
                <DataModifier bind:data_string={name} type={1} type_name='Nom de la pièce'/>
                
                <div class="relative flex flex-col gap-1">
                    <div class="flex items-center justify-between">
                        <label class="text-xs font-bold uppercase tracking-wider text-black">Description</label>
                        <button 
                            onclick={enhanceDescription} 
                            disabled={isEnhancing}
                            class="retro-btn text-[11px] py-1 px-2.5 bg-[#FFE600] hover:bg-[#fff066]"
                        >
                            {#if isEnhancing}
                                <span class="loading loading-spinner loading-xs"></span>
                            {:else}
                                🪄 Améliorer IA
                            {/if}
                        </button>
                    </div>
                    <textarea 
                        class="retro-input h-48 resize-y" 
                        placeholder="Description de l'antiquité..." 
                        bind:value={description}
                    ></textarea>
                </div>
            </div>

            <!-- Colonne 2 : Données Techniques -->
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-3">
                    <DataModifier bind:data_string={year} type={9} type_name='Époque'/>
                    <DataModifier bind:data_number={status} type={4} type_name="Statut boutique"/>
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <DataModifier bind:data_number={price} type={3} type_name='Prix de vente (€)'/>
                    <DataModifier bind:data_number={quantity} type={3} type_name='Quantité en stock'/>
                </div>
                
                <DataModifier bind:data_string={category} type={5} type_name='Catégorie Principale'/>
                
                <RetroSelect
                    label="Sous-catégorie"
                    options={subcatOptions}
                    bind:value={subcategory_id}
                />

                <DataModifier bind:data_string={size} type={8} type_name='Gabarit / Taille Livraison'/>
                
                <DataModifier bind:data_bool={nouveaute} type={6} type_name="Mettre en Nouveauté"/>
            </div>
        </div>

        <!-- Section Médias -->
        <div class="border-t-2 border-black pt-6">
            <div class="flex items-center gap-2 mb-4">
                <span class="retro-badge bg-[#FFD2A6] text-xs">PHOTOS</span>
                <h3 class="text-sm font-black uppercase tracking-wider text-black">Galerie & Visuels</h3>
            </div>
            
            <div class="p-4 bg-[#EDE9DF] border-2 border-black shadow-[3px_3px_0px_0px_#000]">
                <ImagesContainer 
                    antiquite={antiquite} 
                    bind:images={images} 
                    bind:new_Files={newFiles} 
                    bind:s3_Keys={s3Keys}
                    mode={"antiquites"}
                />
            </div>
        </div>

        <!-- Section QR Code Inventaire -->
        <div class="border-t-2 border-black pt-6">
            <div class="retro-card-yellow p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div class="flex items-center gap-4">
                    {#if qrCodeDataUrl}
                        <img src={qrCodeDataUrl} alt="QR Code" class="w-20 h-20 border-2 border-black bg-white p-1 shadow-[2px_2px_0px_0px_#000]" />
                    {/if}
                    <div>
                        <span class="retro-badge bg-black text-white text-[9px]">TAGGING</span>
                        <h4 class="text-sm font-black uppercase text-black mt-1">QR Code d'Inventaire</h4>
                        <p class="text-xs text-black/70">Scannable sur smartphone pour ouvrir directement la fiche en atelier.</p>
                    </div>
                </div>

                <button onclick={printQRCode} type="button" class="retro-btn text-xs py-2 px-4 bg-white hover:bg-[#FFE600] font-black">
                    🖨️ Imprimer l'Étiquette
                </button>
            </div>
        </div>

        <!-- Navigation Précédent / Suivant et Actions de Sauvegarde -->
        <div class="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 border-t-2 border-black">
            <!-- Touches Rapides Précédent / Suivant -->
            <div class="flex items-center gap-2">
                {#if antiquite.prev_id}
                    <button 
                        type="button"
                        onclick={() => saveAndNavigate(antiquite.prev_id!)}
                        disabled={isSaving}
                        class="retro-btn text-xs py-1.5 px-3 bg-white hover:bg-[#D4E2FD]"
                        title="Enregistrer et aller au précédent (Flèche Gauche ←)"
                    >
                        <span>« #{antiquite.prev_id}</span>
                    </button>
                {/if}

                {#if antiquite.next_id}
                    <button 
                        type="button"
                        onclick={() => saveAndNavigate(antiquite.next_id!)}
                        disabled={isSaving}
                        class="retro-btn text-xs py-1.5 px-3 bg-white hover:bg-[#D4E2FD]"
                        title="Enregistrer et aller au suivant (Flèche Droite →)"
                    >
                        <span>#{antiquite.next_id} »</span>
                    </button>
                {/if}
            </div>

            <!-- Validation -->
            <div class="flex items-center gap-2">
                <button onclick={() => window.history.back()} class="retro-btn text-xs py-2 px-4 bg-white hover:bg-[#FFC2D1]">
                    Annuler
                </button>
                <button onclick={() => modifyAntiquity(antiquite.id)} disabled={isSaving} class="retro-btn-primary text-xs py-2 px-6 font-black shadow-[4px_4px_0px_0px_#000]">
                    {#if isSaving}
                        <span class="loading loading-spinner loading-xs mr-1"></span>
                        Enregistrement...
                    {:else}
                        💾 Enregistrer les modifications
                    {/if}
                </button>
            </div>
        </div>
    </div>
</div>