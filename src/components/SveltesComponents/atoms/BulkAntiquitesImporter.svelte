<script lang="ts">
    import Papa from 'papaparse';
    import type { Antiquite } from '../../../type';
    import { apiFetch } from '../../../lib/api';

    let bulkAntiquites = $state<Antiquite[]>([]);
    let isUploading = $state(false);
    const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;

    function downloadTemplate() {
        const csvContent = "id,name,description,price,category,size,tags,year,status,images_urls\n";
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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

                const link = `https://www.daisybrocante.com/achat-rapide?produit=${v.id}`;

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
                    `${Number(v.price || 0).toFixed(2)} EUR`, // price
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
                    "",                                   // is bundle
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
            }, {
                quotes: true,
                delimiter: "\t"
            });

            const blob = new Blob([csvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
            const dateStr = new Date().toISOString().split('T')[0];
            triggerDownload(blob, `google_merchant_feed_${dateStr}.tsv`);

        } catch (error) {
            alert("Erreur lors de l'exportation Google Merchant : " + error);
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
        if (!input.files || input.files.length === 0) return;

        const file = input.files[0];
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                bulkAntiquites = results.data.map((row: any) => ({
                    id: row.id ? parseInt(row.id) : 0,
                    name: row.name || "",
                    description: row.description || "",
                    price: parseFloat(row.price) || 0,
                    category: row.category || "",
                    size: row.size || "S",
                    tags: row.tags || "",
                    year: parseInt(row.year) || new Date().getFullYear(),
                    status: row.status !== undefined && row.status !== "" ? parseInt(row.status) : 0,
                    images_urls: row.images_urls || "",
                    images: []
                }));
            }
        });
    }

    function removeRow(index: number) {
        bulkAntiquites = bulkAntiquites.filter((_, i) => i !== index);
    }

    async function syncWithGo() {
        if (bulkAntiquites.length === 0) return;
        isUploading = true;

        try {
            const response = await apiFetch(`${PUBLIC_API_URL}/api/antiquites/bulk`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(bulkAntiquites)
            });

            if (response.ok) {
                alert("Importation réussie !");
                bulkAntiquites = [];
                window.location.reload();
            } else {
                const err = await response.json();
                alert(`Erreur : ${err.error}`);
            }
        } catch (error) {
            console.error("Erreur bulk :", error);
            alert("Erreur de connexion avec l'API");
        } finally {
            isUploading = false;
        }
    }
</script>

<div class="retro-card p-5 flex flex-col gap-4 font-mono">
    <div class="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div>
            <div class="flex items-center gap-2">
                <span class="retro-badge bg-[#FFE600] text-[10px]">IMPORT / EXPORT</span>
                <span class="text-xs font-bold text-black/70">GESTION EN LOTS (CSV)</span>
            </div>
            <h2 class="text-lg font-black uppercase tracking-tight text-black mt-1">
                Synchronisation par Fichier CSV
            </h2>
            <p class="text-xs text-black/60">Ajoutez, mettez à jour ou exportez massivement votre catalogue.</p>
        </div>
        
        <div class="flex flex-wrap items-center gap-2">
            <button onclick={exportGoogleMerchantCenter} class="retro-btn py-1.5 px-3 text-xs bg-white hover:bg-[#D4E2FD]">
                🛍️ Google Merchant Feed
            </button>

            <button onclick={exportExistingAntiquites} class="retro-btn py-1.5 px-3 text-xs bg-white hover:bg-[#FFD2A6]">
                📤 Exporter Base
            </button>

            <button onclick={downloadTemplate} class="retro-btn py-1.5 px-3 text-xs bg-white hover:bg-[#99E7DC]">
                📥 Modèle CSV
            </button>
            
            <label class="retro-btn py-1.5 px-3 text-xs bg-[#FFE600] hover:bg-[#ffea40] cursor-pointer">
                <span>📁 Importer CSV</span>
                <input 
                    type="file" 
                    accept=".csv" 
                    onchange={handleFileUpload} 
                    class="hidden" 
                />
            </label>
        </div>
    </div>

    {#if bulkAntiquites.length > 0}
        <div class="border-t-2 border-black pt-4">
            <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-black uppercase text-black">
                    Prévisualisation des données ({bulkAntiquites.length} lignes)
                </span>
            </div>
            
            <div class="overflow-x-auto border-2 border-black bg-white shadow-[3px_3px_0px_0px_#000]">
                <table class="w-full text-left text-xs border-collapse font-mono">
                    <thead class="bg-[#D4E2FD] border-b-2 border-black text-black">
                        <tr>
                            <th class="p-2 border-r border-black font-black uppercase">ID</th>
                            <th class="p-2 border-r border-black font-black uppercase">Nom</th>
                            <th class="p-2 border-r border-black font-black uppercase">Description</th>
                            <th class="p-2 border-r border-black font-black uppercase">Prix (€)</th>
                            <th class="p-2 border-r border-black font-black uppercase">Catégorie</th>
                            <th class="p-2 border-r border-black font-black uppercase">Taille</th>
                            <th class="p-2 border-r border-black font-black uppercase">Tags</th>
                            <th class="p-2 border-r border-black font-black uppercase">Année</th>
                            <th class="p-2 border-r border-black font-black uppercase">Statut</th>
                            <th class="p-2 border-r border-black font-black uppercase">Images (URLs)</th>
                            <th class="p-2 font-black uppercase text-center">✕</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each bulkAntiquites as antiquite, i}
                            <tr class="border-b border-black {i % 2 === 0 ? 'bg-white' : 'bg-[#F6F4EE]'}">
                                <td class="p-2 border-r border-black text-[10px] text-black/50">
                                    {antiquite.id || 'Nouveau'}
                                </td>
                                <td class="p-1 border-r border-black">
                                    <input type="text" bind:value={antiquite.name} class="retro-input text-xs py-1" />
                                </td>
                                <td class="p-1 border-r border-black">
                                    <input type="text" bind:value={antiquite.description} class="retro-input text-xs py-1" />
                                </td>
                                <td class="p-1 border-r border-black">
                                    <input type="number" bind:value={antiquite.price} class="retro-input text-xs py-1 w-20" />
                                </td>
                                <td class="p-1 border-r border-black">
                                    <input type="text" bind:value={antiquite.category} class="retro-input text-xs py-1 w-24" />
                                </td>
                                <td class="p-1 border-r border-black">
                                    <input type="text" bind:value={antiquite.size} class="retro-input text-xs py-1 w-14" />
                                </td>
                                <td class="p-1 border-r border-black">
                                    <input type="text" bind:value={antiquite.tags} class="retro-input text-xs py-1" />
                                </td>
                                <td class="p-1 border-r border-black">
                                    <input type="number" bind:value={antiquite.year} class="retro-input text-xs py-1 w-16" />
                                </td>
                                <td class="p-1 border-r border-black">
                                    <input type="number" bind:value={antiquite.status} class="retro-input text-xs py-1 w-14" />
                                </td>
                                <td class="p-1 border-r border-black">
                                    <input type="text" bind:value={antiquite.images_urls} placeholder="url1;url2" class="retro-input text-xs py-1" />
                                </td>
                                <td class="p-1 text-center">
                                    <button onclick={() => removeRow(i)} class="retro-btn-error py-0.5 px-1.5 text-[10px]">✕</button>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>

            <div class="flex justify-end mt-4">
                <button onclick={syncWithGo} disabled={isUploading} class="retro-btn-primary text-xs py-2 px-6 font-black shadow-[3px_3px_0px_0px_#000]">
                    {#if isUploading}
                        <span class="loading loading-spinner loading-xs mr-1"></span>
                        Synchronisation...
                    {:else}
                        🚀 Synchroniser {bulkAntiquites.length} objet(s)
                    {/if}
                </button>
            </div>
        </div>
    {/if}
</div>