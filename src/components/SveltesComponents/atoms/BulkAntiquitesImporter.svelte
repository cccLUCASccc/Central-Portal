<script lang="ts">
    import Papa from 'papaparse';
    import type { Antiquite } from '../../../type';
    import { apiFetch } from '../../../lib/api';


    let bulkAntiquites = $state<Antiquite[]>([]);
    let isUploading = $state(false);
    const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;

    // 1. TÉLÉCHARGER LE MODÈLE VIDE
    function downloadTemplate() {
        const csvContent = "id,name,description,price,category,size,tags,year,status,images_urls\n";
        const fullContent = csvContent;

        const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' });
        triggerDownload(blob, "modele_import_antiquites.csv");
    }

    async function exportExistingAntiquites() {
        try {
            const response = await apiFetch(`${PUBLIC_API_URL}/api/antiquites?limit=100000`);
            if (!response.ok) throw new Error("Erreur de récupération");
            
            const rawData = await response.json();
            const antiquites = Array.isArray(rawData) ? rawData : (rawData.data || []);

            if (antiquites.length === 0) {
                alert("Aucun Objet à exporter !");
                return;
            }

            const exportData = antiquites.map((v: any) => ({
                id: v.id,
                name: v.name,
                description: v.description,
                price: v.price,
                category: v.category,
                size: v.size,
                tags: v.tags || "",
                year: v.year,
                status: v.status !== undefined ? v.status : 0,
                images_urls: v.images && v.images.length > 0 
                    ? v.images.map((img: any) => img.url).join(';') 
                    : "" 
            }));

            const csvContent = Papa.unparse(exportData);
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            
            const dateStr = new Date().toISOString().split('T')[0];
            triggerDownload(blob, `flotte_export_${dateStr}.csv`);
        } catch (error) {
            alert("Erreur lors de l'exportation : " + error);
        }
    }

    async function exportGoogleMerchantCenter() {
        try {
            const response = await apiFetch(`${PUBLIC_API_URL}/api/antiquites?limit=100000`);
            if (!response.ok) throw new Error("Erreur de récupération");
            
            const rawData = await response.json();
            const antiquites = Array.isArray(rawData) ? rawData : (rawData.data || []);

            if (antiquites.length === 0) {
                alert("Aucun Objet à exporter !");
                return;
            }

            const headers = [
                "id", "title", "description", "availability", "availability_date", "expiration_date",
                "link", "mobile_link", "image_link", "price", "sale_price", "sale_price_effective_date",
                "identifier_exists", "gtin", "mpn", "brand", "product_highlight", "product_detail",
                "additional_image_link", "condition", "adult", "color", "size", "size_type",
                "size_system", "gender", "material", "pattern", "age_group", "multipack",
                "is bundle", "unit_pricing_measure", "unit_pricing_base_measure", "energy_efficiency_class",
                "min_energy_efficiency_class", "max_energy_efficiency", "item_group_id", "video_link",
                "virtual_model_link", "cost_of_goods_sold"
            ];

            const rows = antiquites.map((v: any) => {
                const cleanTitle = (v.name || "").replace(/[\t\r\n]+/g, " ").trim().slice(0, 150);
                const cleanDesc = (v.description || "").replace(/[\t\r\n]+/g, " ").trim().slice(0, 5000);
                
                let availability = "non_disponible";
                if (v.status === 0) {
                    availability = "en_stock";
                }

                const firstImage = v.images && v.images.length > 0 ? v.images[0].url : "";
                const additionalImages = v.images && v.images.length > 1 
                    ? v.images.slice(1).map((img: any) => img.url).join(",") 
                    : "";

                const link = `https://daisybrocante.com/boutique/${encodeURIComponent(v.name || "")}`;

                return [
                    v.id.toString(),                      // id
                    cleanTitle,                           // title
                    cleanDesc,                            // description
                    availability,                         // availability
                    "",                                   // availability_date
                    "",                                   // expiration_date
                    link,                                 // link
                    "",                                   // mobile_link
                    firstImage,                           // image_link
                    v.price ? `${v.price} EUR` : "",       // price
                    "",                                   // sale_price
                    "",                                   // sale_price_effective_date
                    "no",                                 // identifier_exists
                    "",                                   // gtin
                    "",                                   // mpn
                    "Daisy Brocante",                     // brand
                    "",                                   // product_highlight
                    "",                                   // product_detail
                    additionalImages,                     // additional_image_link
                    "used",                               // condition
                    "no",                                 // adult
                    "",                                   // color
                    v.size || "",                         // size
                    "",                                   // size_type
                    "",                                   // size_system
                    "",                                   // gender
                    "",                                   // material
                    "",                                   // pattern
                    "",                                   // age_group
                    "",                                   // multipack
                    "no",                                 // is bundle
                    "",                                   // unit_pricing_measure
                    "",                                   // unit_pricing_base_measure
                    "",                                   // energy_efficiency_class
                    "",                                   // min_energy_efficiency_class
                    "",                                   // max_energy_efficiency
                    "",                                   // item_group_id
                    "",                                   // video_link
                    "",                                   // virtual_model_link
                    ""                                    // cost_of_goods_sold
                ];
            });

            const csvContent = Papa.unparse({
                fields: headers,
                data: rows
            });

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const dateStr = new Date().toISOString().split('T')[0];
            triggerDownload(blob, `google_merchant_feed_${dateStr}.csv`);
        } catch (error) {
            alert("Erreur lors de l'exportation Google Merchant Center : " + error);
        }
    }

    function triggerDownload(blob: Blob, filename: string) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function handleFileUpload(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true, 
            complete: (results) => {
                bulkAntiquites = (results.data as any[]).map(row => {
                    const normalized: any = {};
                    for (const key in row) {
                        const lowKey = key.toLowerCase().trim().replace(/ /g, '_').replace(/é/g, 'e');
                        
                        // Mapping intelligent pour les colonnes courantes
                        if (lowKey === 'images' || lowKey === 'image_urls' || lowKey === 'url_images') {
                            normalized['images_urls'] = row[key];
                        } else if (lowKey === 'nom' || lowKey === 'name') {
                            normalized['name'] = row[key];
                        } else {
                            normalized[lowKey] = row[key];
                        }
                    }
                    return normalized as Antiquite;
                });
                input.value = '';
            },
            error: (err) => alert("Erreur CSV : " + err.message)
        });
    }

    async function syncWithGo() {
        if (!confirm(`Synchroniser ces ${bulkAntiquites.length} Antiquites avec le serveur ?`)) return;
        
        isUploading = true;

        const dataToSend = bulkAntiquites.map(a => {
            let cleanAntiquite = { ...a };
            
            cleanAntiquite.id = Number(cleanAntiquite.id) || 0;
            cleanAntiquite.status = Number(cleanAntiquite.status) || 0;
            cleanAntiquite.price = Number(cleanAntiquite.price) || 0;
            cleanAntiquite.year = Number(cleanAntiquite.year) || new Date().getFullYear();
            cleanAntiquite.size = cleanAntiquite.size || "S";
            
            return cleanAntiquite;
        });

        try {
            const response = await apiFetch(`${PUBLIC_API_URL}/api/antiquites/bulk`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dataToSend) 
            });
            
            if (response.ok) {
                alert("Catalogue synchronisé avec succès ! ✨");
                bulkAntiquites = [];
                window.location.reload();
            } else {
                alert("Erreur du serveur lors de la synchronisation.");
            }
        } catch (error) {
            alert("Erreur réseau : " + error);
        } finally {
            isUploading = false;
        }
    }

    function removeRow(index: number) {
        bulkAntiquites = bulkAntiquites.filter((_, i) => i !== index);
    }
</script>

<div class="flex flex-col gap-6 w-full p-4 bg-base-100 rounded-xl shadow-sm border border-base-200">
    <div class="flex flex-col xl:flex-row items-center justify-between gap-4">
        <div>
            <h2 class="text-xl font-bold">Gestion par lots (CSV)</h2>
            <p class="text-sm opacity-70">Ajoutez ou modifiez plusieurs objets d'un coup.</p>
        </div>
        
        <div class="flex flex-wrap items-center gap-2">
            <button onclick={exportGoogleMerchantCenter} class="btn btn-outline btn-info btn-sm">
                🛍️ Google Merchant Feed
            </button>

            <button onclick={exportExistingAntiquites} class="btn btn-outline btn-accent btn-sm">
                📤 Exporter Base
            </button>

            <button onclick={downloadTemplate} class="btn btn-outline btn-secondary btn-sm">
                📥 Modèle Vide
            </button>
            
            <input 
                type="file" 
                accept=".csv" 
                onchange={handleFileUpload} 
                class="file-input file-input-bordered file-input-primary file-input-sm w-full max-w-xs" 
            />
        </div>
    </div>

    {#if bulkAntiquites.length > 0}
        <div class="divider mt-0 mb-0">Prévisualisation</div>
        
        <div class="overflow-x-auto border border-base-300 rounded-lg">
            <table class="table table-zebra table-sm w-full">
                <thead class="bg-base-200">
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Description</th>
                        <th>Prix</th>
                        <th>Catégorie</th>
                        <th>Taille</th>
                        <th>Tags</th>
                        <th>Année</th>
                        <th>Statut</th>
                        <th>Images (URLs)</th>
                        <th></th> </tr>
                </thead>
                <tbody>
                    {#each bulkAntiquites as antiquite, i}
                        <tr>
                            <td class="text-xs font-mono opacity-50">
                                {antiquite.id || 'Nouveau'}
                            </td>
                            <td>
                                <input type="text" bind:value={antiquite.name} class="input input-bordered input-xs w-full min-w-[120px]" />
                            </td>
                            <td>
                                <input type="text" bind:value={antiquite.description} class="input input-bordered input-xs w-full min-w-[150px]" />
                            </td>
                            <td>
                                <input type="number" bind:value={antiquite.price} class="input input-bordered input-xs w-20" />
                            </td>
                            <td>
                                <input type="text" bind:value={antiquite.category} class="input input-bordered input-xs w-16" />
                            </td>
                            <td>
                                <input type="text" bind:value={antiquite.size} class="input input-bordered input-xs w-12" />
                            </td>
                            <td>
                                <input type="text" bind:value={antiquite.tags} class="input input-bordered input-xs w-full min-w-[100px]" />
                            </td>
                            <td>
                                <input type="number" bind:value={antiquite.year} class="input input-bordered input-xs w-16" />
                            </td>
                            <td>
                                <input type="number" bind:value={antiquite.status} class="input input-bordered input-xs w-16" />
                            </td>
                            <td>
                                <input type="text" bind:value={antiquite.images_urls} placeholder="url1.jpg;url2.jpg" class="input input-bordered input-xs w-full min-w-[150px]" />
                            </td>
                            <td class="text-right">
                                <button onclick={() => removeRow(i)} class="btn btn-ghost btn-xs text-error">X</button>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>

        <div class="flex justify-end">
            <button onclick={syncWithGo} disabled={isUploading} class="btn btn-primary">
                {#if isUploading}
                    <span class="loading loading-spinner loading-sm"></span>
                    Envoi...
                {:else}
                    Synchroniser {bulkAntiquites.length} antiquités
                {/if}
            </button>
        </div>
    {/if}
</div>