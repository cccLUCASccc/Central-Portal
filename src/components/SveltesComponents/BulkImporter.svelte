<script lang="ts">
    import Papa from 'papaparse';
    import type { Vehicule } from '../../type';


    let bulkVehicules = $state<Vehicule[]>([]);
    let isUploading = $state(false);
    const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;

    function downloadTemplate() {
        const csvContent = "id,model,description,price,year,status\n";
        const exemple = ",Ford Mustang,V8 Classique,35000,1969,0\n";
        const fullContent = csvContent + exemple;

        const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' });
        triggerDownload(blob, "modele_import_vehicules.csv");
    }

    async function exportExistingVehicules() {
        try {
            const response = await fetch(`${PUBLIC_API_URL}/api/vehicules/`);
            if (!response.ok) throw new Error("Erreur de récupération");
            
            const rawData = await response.json();
            const vehicules = Array.isArray(rawData) ? rawData : [];

            if (vehicules.length === 0) {
                alert("Aucun véhicule à exporter pour le moment !");
                return;
            }

            const exportData = vehicules.map((v: any) => ({
                id: v.id,
                model: v.model,
                description: v.description,
                price: v.price,
                year: v.year,
                status: v.status !== undefined ? v.status : 0 
            }));

            const csvContent = Papa.unparse(exportData);
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            
            const dateStr = new Date().toISOString().split('T')[0];
            triggerDownload(blob, `flotte_export_${dateStr}.csv`);
        } catch (error) {
            alert("Erreur lors de l'exportation : " + error);
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
                bulkVehicules = results.data as Vehicule[];
                input.value = '';
            },
            error: (err) => alert("Erreur CSV : " + err.message)
        });
    }

    async function syncWithGo() {
        if (!confirm(`Synchroniser ces ${bulkVehicules.length} véhicules avec le serveur ?`)) return;
        
        isUploading = true;

        try {
            const response = await fetch(`${PUBLIC_API_URL}/api/vehicules/bulk`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(bulkVehicules)
            });
            console.log('api', `${PUBLIC_API_URL}/api/vehicules/bulk` )
            if (response.ok) {
                alert("Flotte synchronisée avec succès ! ✨");
                bulkVehicules = [];
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
        bulkVehicules = bulkVehicules.filter((_, i) => i !== index);
    }
</script>

<div class="flex flex-col gap-6 w-full p-4 bg-base-100 rounded-xl shadow-sm border border-base-200">
    <div class="flex flex-col xl:flex-row items-center justify-between gap-4">
        <div>
            <h2 class="text-xl font-bold">Gestion par lots (CSV)</h2>
            <p class="text-sm opacity-70">Ajoutez ou modifiez plusieurs véhicules d'un coup.</p>
        </div>
        
        <div class="flex flex-wrap items-center gap-2">
            <button onclick={exportExistingVehicules} class="btn btn-outline btn-accent btn-sm">
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

    {#if bulkVehicules.length > 0}
        <div class="divider mt-0 mb-0">Prévisualisation</div>
        
        <div class="overflow-x-auto border border-base-300 rounded-lg">
            <table class="table table-zebra table-sm w-full">
                <thead class="bg-base-200">
                    <tr>
                        <th>ID</th>
                        <th>Modèle</th>
                        <th>Description</th>
                        <th>Prix</th>
                        <th>Année</th>
                        <th>Statut</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {#each bulkVehicules as vehicule, i}
                        <tr>
                            <td class="text-xs font-mono opacity-50">
                                {vehicule.id || 'Nouveau'}
                            </td>
                            <td>
                                <input type="text" bind:value={vehicule.model} class="input input-bordered input-xs w-full min-w-[120px]" />
                            </td>
                            <td>
                                <input type="text" bind:value={vehicule.description} class="input input-bordered input-xs w-full min-w-[150px]" />
                            </td>
                            <td>
                                <input type="number" bind:value={vehicule.price} class="input input-bordered input-xs w-20" />
                            </td>
                            <td>
                                <input type="number" bind:value={vehicule.year} class="input input-bordered input-xs w-16" />
                            </td>
                            <td>
                                <input type="number" bind:value={vehicule.status} class="input input-bordered input-xs w-16" />
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
                    Synchroniser {bulkVehicules.length} véhicules
                {/if}
            </button>
        </div>
    {/if}
</div>