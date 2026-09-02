<script lang="ts">
    import { onMount } from 'svelte';
    import { apiFetch } from '../../../lib/api';
    import { compressImageFile } from '../../../lib/imageCompressor';

    interface S3FileItem {
        key: string;
        size: number;
        last_modified: string;
        content_type: string;
        url: string;
        is_used: boolean;
        reference_type?: string;
        reference_id?: number;
        reference_title?: string;
    }

    interface StorageStats {
        total_files: number;
        total_size_bytes: number;
        total_size_formatted: string;
        used_files: number;
        orphan_files: number;
    }

    interface Pagination {
        total_items: number;
        total_pages: number;
        current_page: number;
        page_size: number;
    }

    let files = $state<S3FileItem[]>([]);
    let stats = $state<StorageStats | null>(null);
    let pagination = $state<Pagination | null>(null);
    let isLoading = $state(false);
    let isUploading = $state(false);

    let searchQuery = $state("");
    let selectedFilter = $state("all"); // all, orphans, used, antiquite, images
    let selectedSort = $state("date_desc");
    let viewMode = $state<"grid" | "table">("grid");
    let selectedKeys = $state<string[]>([]);
    let previewFile = $state<S3FileItem | null>(null);
    let notification = $state<{ text: string; type: "success" | "error" | "info" } | null>(null);
    let isDragging = $state(false);
    let autoCompress = $state(true);

    const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;

    function notify(text: string, type: "success" | "error" | "info" = "success") {
        notification = { text, type };
        setTimeout(() => {
            if (notification?.text === text) {
                notification = null;
            }
        }, 4000);
    }

    function formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'Ko', 'Mo', 'Go'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function formatDate(dateStr: string): string {
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateStr;
        }
    }

    async function loadStats() {
        try {
            const res = await apiFetch(`${PUBLIC_API_URL}/api/storage/stats`);
            if (res.ok) {
                stats = await res.json();
            }
        } catch (err) {
            console.error("Erreur lors de la récupération des stats S3 :", err);
        }
    }

    async function loadFiles(page = 1) {
        isLoading = true;
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: "24",
                sort: selectedSort,
                filter: selectedFilter,
                q: searchQuery
            });

            const res = await apiFetch(`${PUBLIC_API_URL}/api/storage/files?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                files = data.data || [];
                pagination = data.pagination || null;
            } else {
                notify("Erreur lors du chargement des fichiers", "error");
            }
        } catch (err) {
            console.error("Erreur API storage/files :", err);
            notify("Impossible de joindre le serveur", "error");
        } finally {
            isLoading = false;
        }
    }

    onMount(() => {
        loadStats();
        loadFiles(1);
    });

    function handleFilterChange(filter: string) {
        selectedFilter = filter;
        selectedKeys = [];
        loadFiles(1);
    }

    function handleSortChange(e: Event) {
        const select = e.target as HTMLSelectElement;
        selectedSort = select.value;
        loadFiles(1);
    }

    function handleSearch() {
        loadFiles(1);
    }

    function toggleSelectKey(key: string) {
        if (selectedKeys.includes(key)) {
            selectedKeys = selectedKeys.filter(k => k !== key);
        } else {
            selectedKeys = [...selectedKeys, key];
        }
    }

    function toggleSelectAll() {
        if (selectedKeys.length === files.length) {
            selectedKeys = [];
        } else {
            selectedKeys = files.map(f => f.key);
        }
    }

    async function handleFileUpload(fileList: FileList) {
        if (!fileList || fileList.length === 0) return;
        const uploadFiles = Array.from(fileList);
        isUploading = true;

        try {
            let processedFiles = uploadFiles;
            if (autoCompress) {
                notify(`Optimisation de ${uploadFiles.length} fichier(s)...`, "info");
                processedFiles = await Promise.all(
                    uploadFiles.map(async (f) => {
                        if (f.type.startsWith('image/')) {
                            return await compressImageFile(f, {
                                maxWidth: 1920,
                                maxHeight: 1920,
                                quality: 0.82,
                                mimeType: 'image/webp'
                            });
                        }
                        return f;
                    })
                );
            }

            const formData = new FormData();
            processedFiles.forEach((file) => {
                formData.append('files', file);
            });

            notify(`Téléversement de ${processedFiles.length} fichier(s) vers S3...`, "info");
            const res = await apiFetch(`${PUBLIC_API_URL}/api/storage/upload`, {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                const result = await res.json();
                notify(`${result.uploaded?.length || processedFiles.length} fichier(s) téléversé(s) avec succès !`, "success");
                await loadStats();
                await loadFiles(1);
            } else {
                const err = await res.json();
                notify(`Erreur d'upload : ${err.error || 'Échec'}`, "error");
            }
        } catch (err) {
            console.error("Erreur upload :", err);
            notify("Erreur lors de l'envoi des fichiers", "error");
        } finally {
            isUploading = false;
        }
    }

    async function deleteSingleFile(file: S3FileItem) {
        const confirmMsg = file.is_used
            ? `ATTENTION : Le fichier "${file.key}" est actuellement utilisé par "${file.reference_title}". Le supprimer cassera l'affichage sur la boutique. Confirmer ?`
            : `Confirmer la suppression définitive du fichier "${file.key}" sur S3 ?`;

        if (!confirm(confirmMsg)) return;

        try {
            const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
            const res = await apiFetch(`${PUBLIC_API_URL}/api/storage/delete?key=${encodeURIComponent(file.key)}`, {
                method: "DELETE"
            });

            if (res.ok) {
                if (previewFile?.key === file.key) previewFile = null;
                selectedKeys = selectedKeys.filter(k => k !== file.key);
                await loadFiles(pagination?.current_page || 1);
                await loadStats();
            } else {
                alert("Erreur lors de la suppression du fichier.");
            }
        } catch (e) {
            console.error(e);
            alert("Erreur réseau");
        }
    }

    async function deleteSelectedBulk() {
        if (selectedKeys.length === 0) return;

        const hasUsed = files.some(f => selectedKeys.includes(f.key) && f.is_used);
        const confirmMsg = hasUsed
            ? `ATTENTION : Certains des ${selectedKeys.length} fichiers sélectionnés sont liés à des articles en ligne. Confirmer la suppression ?`
            : `Confirmer la suppression définitive des ${selectedKeys.length} fichiers sélectionnés sur S3 ?`;

        if (!confirm(confirmMsg)) return;

        try {
            const res = await apiFetch(`${PUBLIC_API_URL}/api/storage/bulk-delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keys: selectedKeys })
            });

            if (res.ok) {
                notify(`${selectedKeys.length} fichier(s) supprimé(s) de S3.`, "success");
                selectedKeys = [];
                await loadStats();
                await loadFiles(pagination?.current_page || 1);
            } else {
                const err = await res.json();
                notify(`Erreur suppression groupée : ${err.error}`, "error");
            }
        } catch (err) {
            console.error("Erreur bulk delete :", err);
            notify("Erreur lors de la suppression groupée", "error");
        }
    }

    function handleDrop(e: DragEvent) {
        e.preventDefault();
        isDragging = false;
        if (e.dataTransfer?.files) {
            handleFileUpload(e.dataTransfer.files);
        }
    }

    function copyURL(url: string) {
        navigator.clipboard.writeText(url);
        notify("Lien copié dans le presse-papier !", "info");
    }
</script>

<div class="flex flex-col gap-6 w-full font-mono">
    <!-- Notification Toast Rétro -->
    {#if notification}
        <div class="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div class="border-2 border-black p-3 text-xs font-bold uppercase shadow-[4px_4px_0px_0px_#000] {notification.type === 'error' ? 'bg-[#FFC2D1] text-black' : notification.type === 'info' ? 'bg-[#D4E2FD] text-black' : 'bg-[#99E7DC] text-black'}">
                <span>{notification.text}</span>
            </div>
        </div>
    {/if}

    <!-- Header Panel Rétro -->
    <div class="retro-card-peach p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <div class="flex items-center gap-2">
                <span class="retro-badge bg-black text-white text-[10px]">S3 STORAGE</span>
                <span class="text-xs font-bold tracking-widest text-black/70">AWS CLOUD REPOSITORY</span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-black uppercase tracking-tight text-black mt-1">
                Gestionnaire de Fichiers S3
            </h1>
            <p class="text-xs text-black/80 mt-1 max-w-2xl">
                Explorez, organisez, inspectez et purgez les médias hébergés sur votre bucket S3.
            </p>
        </div>

        <div class="flex items-center gap-2">
            <button 
                onclick={() => { loadStats(); loadFiles(pagination?.current_page || 1); }} 
                class="retro-btn bg-white hover:bg-[#FFE600] text-xs py-2 px-3 flex items-center gap-1.5"
                disabled={isLoading}
            >
                <span class="material-symbols-outlined text-[16px] {isLoading ? 'animate-spin' : ''}">refresh</span>
                <span>Actualiser</span>
            </button>
        </div>
    </div>

    <!-- 4 Stats Cards (Inspirées des captures MotherDuck) -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Card 1: Espace Total S3 (Peach) -->
        <div class="retro-card-peach p-5 flex flex-col justify-between relative group">
            <div class="flex items-start justify-between">
                <div>
                    <span class="text-[10px] font-bold uppercase tracking-wider text-black/70 block">Stockage S3</span>
                    <h3 class="text-lg font-black uppercase tracking-tight text-black mt-0.5">Espace Total</h3>
                </div>
                <div class="retro-icon-box bg-white flex items-center justify-center">
                    <span class="material-symbols-outlined text-2xl text-black">database</span>
                </div>
            </div>
            <div class="mt-4 pt-3 border-t-2 border-black bg-white p-3 shadow-[2px_2px_0px_0px_#000]">
                <div class="text-2xl font-black font-mono text-black">{stats?.total_size_formatted || "..."}</div>
                <p class="text-[10px] text-black/60 mt-0.5 uppercase">Volume consommé</p>
            </div>
        </div>

        <!-- Card 2: Total Fichiers (Lavender/Blue) -->
        <div class="retro-card-blue p-5 flex flex-col justify-between relative group">
            <div class="flex items-start justify-between">
                <div>
                    <span class="text-[10px] font-bold uppercase tracking-wider text-black/70 block">Indexation</span>
                    <h3 class="text-lg font-black uppercase tracking-tight text-black mt-0.5">Total Fichiers</h3>
                </div>
                <div class="retro-icon-box bg-white flex items-center justify-center">
                    <span class="material-symbols-outlined text-2xl text-black">folder</span>
                </div>
            </div>
            <div class="mt-4 pt-3 border-t-2 border-black bg-white p-3 shadow-[2px_2px_0px_0px_#000]">
                <div class="text-2xl font-black font-mono text-black">{stats?.total_files ?? "..."}</div>
                <p class="text-[10px] text-black/60 mt-0.5 uppercase">Objets stockés</p>
            </div>
        </div>

        <!-- Card 3: Fichiers En Ligne (Mint) -->
        <div class="retro-card-mint p-5 flex flex-col justify-between relative group">
            <div class="flex items-start justify-between">
                <div>
                    <span class="text-[10px] font-bold uppercase tracking-wider text-black/70 block">Boutique</span>
                    <h3 class="text-lg font-black uppercase tracking-tight text-black mt-0.5">En Boutique</h3>
                </div>
                <div class="retro-icon-box bg-white flex items-center justify-center">
                    <span class="material-symbols-outlined text-2xl text-black">link</span>
                </div>
            </div>
            <div class="mt-4 pt-3 border-t-2 border-black bg-white p-3 shadow-[2px_2px_0px_0px_#000]">
                <div class="text-2xl font-black font-mono text-black">{stats?.used_files ?? "..."}</div>
                <p class="text-[10px] text-black/60 mt-0.5 uppercase">Actifs sur le site</p>
            </div>
        </div>

        <!-- Card 4: Fichiers Orphelins (Rose/Coral) -->
        <div class="retro-card-rose p-5 flex flex-col justify-between relative group">
            <div class="flex items-start justify-between">
                <div>
                    <span class="text-[10px] font-bold uppercase tracking-wider text-black/70 block">Maintenance</span>
                    <h3 class="text-lg font-black uppercase tracking-tight text-black mt-0.5">Orphelins</h3>
                </div>
                <div class="retro-icon-box bg-white flex items-center justify-center">
                    <span class="material-symbols-outlined text-2xl text-black">warning</span>
                </div>
            </div>
            <div class="mt-4 pt-3 border-t-2 border-black bg-white p-3 shadow-[2px_2px_0px_0px_#000] flex items-center justify-between">
                <div>
                    <div class="text-2xl font-black font-mono text-black">{stats?.orphan_files ?? "..."}</div>
                    <p class="text-[10px] text-black/60 mt-0.5 uppercase">Non référencés</p>
                </div>
                {#if stats && stats.orphan_files > 0}
                    <button 
                        onclick={() => handleFilterChange("orphans")}
                        class="retro-btn py-1 px-2 text-[10px] bg-[#FFE600] hover:bg-[#fff066]"
                    >
                        Filtrer
                    </button>
                {/if}
            </div>
        </div>
    </div>

    <!-- Zone Téléversement Rétro (Drag & Drop) -->
    <div 
        role="region"
        aria-label="Zone d'upload S3"
        class="border-2 border-dashed border-black p-6 text-center transition-all bg-white shadow-[3px_3px_0px_0px_#000] {isDragging ? '!bg-[#D4E2FD] scale-[1.005]' : 'hover:bg-[#F6F4EE]'}"
        ondragover={(e) => { e.preventDefault(); isDragging = true; }}
        ondragleave={() => isDragging = false}
        ondrop={handleDrop}
    >
        <input 
            type="file" 
            id="storage-upload-input" 
            multiple 
            class="hidden" 
            onchange={(e) => {
                const target = e.target as HTMLInputElement;
                if (target.files) handleFileUpload(target.files);
                target.value = '';
            }}
        />

        <div class="flex flex-col items-center justify-center gap-3">
            <div class="w-12 h-12 border-2 border-black bg-[#FFE600] flex items-center justify-center text-xl shadow-[2px_2px_0px_0px_#000]">
                {#if isUploading}
                    <span class="loading loading-spinner loading-md text-black"></span>
                {:else}
                    <span class="material-symbols-outlined text-2xl text-black">upload_file</span>
                {/if}
            </div>

            <div>
                <p class="font-black text-sm uppercase text-black">
                    {isUploading ? "Traitement et téléversement S3 en cours..." : "Glissez-déposez des fichiers ici ou parcourez votre disque"}
                </p>
                <p class="text-xs text-black/60 mt-0.5">Images (PNG, JPG, WebP), documents (PDF) supportés</p>
            </div>

            <div class="flex flex-wrap items-center justify-center gap-3 mt-1">
                <label for="storage-upload-input" class="retro-btn-primary text-xs py-1.5 px-4 cursor-pointer {isUploading ? 'opacity-50 pointer-events-none' : ''}">
                    Choisir des fichiers
                </label>

                <label class="cursor-pointer flex items-center gap-2 text-xs font-bold text-black border border-black px-2 py-1 bg-[#EDE9DF]">
                    <input type="checkbox" bind:checked={autoCompress} class="checkbox checkbox-xs border-2 border-black rounded-none bg-white checked:bg-[#99E7DC]" />
                    <span>Auto-compression WebP</span>
                </label>
            </div>
        </div>
    </div>

    <!-- Barre de Filtres & Recherche -->
    <div class="retro-card p-4 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        <!-- Onglets Filtres -->
        <div class="flex flex-wrap gap-1.5">
            <button 
                class="retro-btn py-1 px-3 text-xs {selectedFilter === 'all' ? '!bg-[#D4E2FD] shadow-[3px_3px_0px_0px_#000]' : 'bg-white'}"
                onclick={() => handleFilterChange('all')}
            >
                Tous
            </button>
            <button 
                class="retro-btn py-1 px-3 text-xs {selectedFilter === 'images' ? '!bg-[#99E7DC] shadow-[3px_3px_0px_0px_#000]' : 'bg-white'} flex items-center gap-1"
                onclick={() => handleFilterChange('images')}
            >
                <span class="material-symbols-outlined text-[14px]">photo_library</span>
                <span>Images</span>
            </button>
            <button 
                class="retro-btn py-1 px-3 text-xs {selectedFilter === 'antiquite' ? '!bg-[#FFD2A6] shadow-[3px_3px_0px_0px_#000]' : 'bg-white'} flex items-center gap-1"
                onclick={() => handleFilterChange('antiquite')}
            >
                <span class="material-symbols-outlined text-[14px]">storefront</span>
                <span>Boutique</span>
            </button>
            <button 
                class="retro-btn py-1 px-3 text-xs {selectedFilter === 'orphans' ? '!bg-[#FFC2D1] shadow-[3px_3px_0px_0px_#000]' : 'bg-white'} flex items-center gap-1"
                onclick={() => handleFilterChange('orphans')}
            >
                <span class="material-symbols-outlined text-[14px]">warning</span>
                <span>Orphelins ({stats?.orphan_files ?? 0})</span>
            </button>
        </div>

        <!-- Recherche & Tri & Vue -->
        <div class="flex flex-wrap items-center gap-2">
            <!-- Champ recherche -->
            <div class="relative flex-1 md:w-56">
                <input 
                    type="text" 
                    placeholder="Filtrer par nom..." 
                    bind:value={searchQuery}
                    onkeydown={(e) => e.key === 'Enter' && handleSearch()}
                    class="retro-input text-xs py-1.5 pr-6"
                />
                {#if searchQuery}
                    <button 
                        onclick={() => { searchQuery = ""; handleSearch(); }}
                        class="absolute right-2 top-2 text-xs font-bold opacity-60 hover:opacity-100"
                    >
                        ✕
                    </button>
                {/if}
            </div>

            <!-- Sélecteur de tri -->
            <select 
                class="retro-select text-xs py-1.5 w-auto" 
                value={selectedSort} 
                onchange={handleSortChange}
            >
                <option value="date_desc">Plus récent</option>
                <option value="date_asc">Plus ancien</option>
                <option value="size_desc">Plus lourd</option>
                <option value="size_asc">Plus léger</option>
                <option value="name_asc">Nom A-Z</option>
            </select>

            <!-- Bascule Vue Grille / Tableau -->
            <div class="flex items-center border-2 border-black bg-white shadow-[2px_2px_0px_0px_#000]">
                <button 
                    class="p-1.5 text-xs font-bold {viewMode === 'grid' ? 'bg-[#FFE600]' : 'hover:bg-[#EDE9DF]'} flex items-center gap-1" 
                    onclick={() => viewMode = 'grid'}
                    title="Vue Grille"
                >
                    <span class="material-symbols-outlined text-[14px]">grid_view</span>
                    <span>Grille</span>
                </button>
                <div class="w-0.5 h-6 bg-black"></div>
                <button 
                    class="p-1.5 text-xs font-bold {viewMode === 'table' ? 'bg-[#FFE600]' : 'hover:bg-[#EDE9DF]'} flex items-center gap-1" 
                    onclick={() => viewMode = 'table'}
                    title="Vue Tableau"
                >
                    <span class="material-symbols-outlined text-[14px]">table_rows</span>
                    <span>Table</span>
                </button>
            </div>
        </div>
    </div>

    <!-- Barre d'Actions Groupées -->
    {#if selectedKeys.length > 0}
        <div class="bg-[#FFE600] border-2 border-black px-4 py-3 shadow-[4px_4px_0px_0px_#000] flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-2 text-xs font-black uppercase text-black">
                <span class="bg-black text-white px-2 py-0.5">{selectedKeys.length}</span>
                <span>Fichier(s) sélectionné(s)</span>
            </div>

            <div class="flex items-center gap-2">
                <button onclick={() => selectedKeys = []} class="retro-btn py-1 px-3 text-xs bg-white">
                    Désélectionner tout
                </button>
                <button onclick={deleteSelectedBulk} class="retro-btn-error py-1 px-3 text-xs font-black flex items-center gap-1">
                    <span class="material-symbols-outlined text-[14px]">delete</span>
                    <span>Supprimer ({selectedKeys.length})</span>
                </button>
            </div>
        </div>
    {/if}

    <!-- Zone de Contenu (Grille / Tableau) -->
    {#if isLoading}
        <div class="flex flex-col items-center justify-center py-20 gap-3 border-2 border-black bg-white shadow-[4px_4px_0px_0px_#000]">
            <span class="loading loading-spinner loading-lg text-black"></span>
            <p class="text-xs font-bold uppercase text-black">Lecture des objets S3...</p>
        </div>
    {:else if files.length === 0}
        <div class="retro-card p-12 text-center">
            <div class="flex justify-center mb-2">
                <span class="material-symbols-outlined text-4xl text-black/40">cloud_off</span>
            </div>
            <h3 class="text-base font-black uppercase text-black">Aucun fichier trouvé</h3>
            <p class="text-xs text-black/60 mt-1">Aucun fichier ne correspond à vos filtres actuels.</p>
            {#if selectedFilter !== 'all' || searchQuery}
                <div class="mt-4">
                    <button onclick={() => { searchQuery = ""; handleFilterChange("all"); }} class="retro-btn text-xs bg-white hover:bg-[#FFE600]">
                        Réinitialiser les filtres
                    </button>
                </div>
            {/if}
        </div>
    {:else if viewMode === 'grid'}
        <!-- Grille Rétro -->
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {#each files as file (file.key)}
                {@const isSelected = selectedKeys.includes(file.key)}
                <div class="retro-card overflow-hidden flex flex-col relative group {isSelected ? '!bg-[#D4E2FD] ring-2 ring-black' : ''}">
                    
                    <!-- Checkbox coin haut gauche -->
                    <div class="absolute top-1.5 left-1.5 z-20">
                        <input 
                            type="checkbox" 
                            checked={isSelected}
                            onchange={() => toggleSelectKey(file.key)}
                            class="checkbox checkbox-xs border-2 border-black rounded-none bg-white checked:bg-black checked:text-white"
                        />
                    </div>

                    <!-- Badge statut coin haut droit -->
                    <div class="absolute top-1.5 right-1.5 z-20">
                        {#if file.is_used}
                            <span class="retro-badge bg-[#99E7DC] text-[9px] px-1 py-0" title={`Lié à l'objet : ${file.reference_title}`}>
                                #{file.reference_id}
                            </span>
                        {:else}
                            <span class="retro-badge bg-[#FFC2D1] text-[9px] px-1 py-0" title="Non lié en base de données">
                                Orphelin
                            </span>
                        {/if}
                    </div>

                    <!-- Thumbnail cliquable -->
                    <div 
                        role="button"
                        tabindex="0"
                        class="aspect-square bg-[#EDE9DF] border-b-2 border-black relative overflow-hidden flex items-center justify-center cursor-pointer"
                        onclick={() => previewFile = file}
                        onkeydown={(e) => e.key === 'Enter' && (previewFile = file)}
                    >
                        {#if file.content_type?.startsWith('image/')}
                            <img 
                                src={file.url} 
                                alt={file.key} 
                                loading="lazy" 
                                class="w-full h-full object-cover" 
                            />
                        {:else}
                            <div class="flex items-center justify-center">
                                <span class="material-symbols-outlined text-3xl text-black/40">description</span>
                            </div>
                        {/if}
                    </div>

                    <!-- Cartouche bas d'info -->
                    <div class="p-2 bg-white flex flex-col justify-between flex-1 text-[10px]">
                        <div class="truncate font-bold text-black" title={file.key}>{file.key}</div>
                        <div class="flex items-center justify-between text-black/60 mt-1 pt-1 border-t border-black/20">
                            <span>{formatFileSize(file.size)}</span>
                            <button 
                                onclick={() => previewFile = file}
                                class="font-bold uppercase text-black hover:underline flex items-center gap-0.5"
                            >
                                <span>Voir</span>
                                <span class="material-symbols-outlined text-[12px]">open_in_new</span>
                            </button>
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    {:else}
        <!-- Tableau Rétro -->
        <div class="retro-card overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse font-mono">
                <thead>
                    <tr class="bg-[#D4E2FD] border-b-2 border-black text-black">
                        <th class="p-2.5 border-r border-black w-10 text-center">
                            <input 
                                type="checkbox" 
                                checked={selectedKeys.length === files.length && files.length > 0}
                                onchange={toggleSelectAll}
                                class="checkbox checkbox-xs border-2 border-black rounded-none bg-white checked:bg-black checked:text-white"
                            />
                        </th>
                        <th class="p-2.5 border-r border-black w-12 text-center">Aperçu</th>
                        <th class="p-2.5 border-r border-black font-black uppercase">Clé S3 / Nom</th>
                        <th class="p-2.5 border-r border-black font-black uppercase">Taille</th>
                        <th class="p-2.5 border-r border-black font-black uppercase">Statut</th>
                        <th class="p-2.5 border-r border-black font-black uppercase">Date</th>
                        <th class="p-2.5 font-black uppercase text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {#each files as file, index (file.key)}
                        {@const isSelected = selectedKeys.includes(file.key)}
                        <tr class="border-b border-black {index % 2 === 0 ? 'bg-white' : 'bg-[#F6F4EE]'} {isSelected ? '!bg-[#FFE600]/30' : ''} hover:bg-[#FFE600]/20">
                            <td class="p-2.5 border-r border-black text-center">
                                <input 
                                    type="checkbox" 
                                    checked={isSelected}
                                    onchange={() => toggleSelectKey(file.key)}
                                    class="checkbox checkbox-xs border-2 border-black rounded-none bg-white checked:bg-black checked:text-white"
                                />
                            </td>
                            <td class="p-2.5 border-r border-black text-center">
                                {#if file.content_type?.startsWith('image/')}
                                    <img src={file.url} alt="" class="w-8 h-8 object-cover border border-black mx-auto" />
                                {:else}
                                    <span class="material-symbols-outlined text-[16px] text-black/50">description</span>
                                {/if}
                            </td>
                            <td class="p-2.5 border-r border-black font-bold truncate max-w-xs text-black">
                                {file.key}
                            </td>
                            <td class="p-2.5 border-r border-black font-mono">{formatFileSize(file.size)}</td>
                            <td class="p-2.5 border-r border-black">
                                {#if file.is_used}
                                    <span class="retro-badge bg-[#99E7DC] text-[10px]">#{file.reference_id} {file.reference_title || 'En ligne'}</span>
                                {:else}
                                    <span class="retro-badge bg-[#FFC2D1] text-[10px]">Orphelin</span>
                                {/if}
                            </td>
                            <td class="p-2.5 border-r border-black text-black/70 font-mono text-[11px]">{formatDate(file.last_modified)}</td>
                            <td class="p-2.5 text-right space-x-1">
                                <button onclick={() => previewFile = file} class="retro-btn py-0.5 px-2 text-[10px] bg-white hover:bg-[#99E7DC]">
                                    Inspecter
                                </button>
                                <button onclick={() => deleteSingleFile(file)} class="retro-btn py-0.5 px-2 text-[10px] bg-[#FFC2D1] hover:bg-[#fa96ab]">
                                    ✕
                                </button>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}

    <!-- Pagination Rétro -->
    {#if pagination && pagination.total_pages > 1}
        <div class="flex justify-center mt-4 font-mono">
            <div class="flex items-center gap-1 border-2 border-black bg-[#EDE9DF] p-1.5 shadow-[3px_3px_0px_0px_#000]">
                <button 
                    class="retro-btn py-1 px-3 text-xs bg-white flex items-center gap-1"
                    disabled={pagination.current_page <= 1}
                    onclick={() => loadFiles((pagination?.current_page || 1) - 1)}
                >
                    <span class="material-symbols-outlined text-[14px]">chevron_left</span>
                    <span>Précédent</span>
                </button>
                <div class="border border-black bg-white px-3 py-1 text-xs font-bold">
                    Page {pagination.current_page} / {pagination.total_pages} ({pagination.total_items} fichiers)
                </div>
                <button 
                    class="retro-btn py-1 px-3 text-xs bg-white flex items-center gap-1"
                    disabled={pagination.current_page >= pagination.total_pages}
                    onclick={() => loadFiles((pagination?.current_page || 1) + 1)}
                >
                    <span>Suivant</span>
                    <span class="material-symbols-outlined text-[14px]">chevron_right</span>
                </button>
            </div>
        </div>
    {/if}

    <!-- Preview / Inspector Modal Rétro -->
    {#if previewFile}
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 font-mono">
            <div class="w-full max-w-2xl bg-[#EDE9DF] border-3 border-black shadow-[8px_8px_0px_0px_#000] flex flex-col overflow-hidden">
                
                <!-- Window Titlebar -->
                <div class="bg-[#FFE600] border-b-2 border-black px-4 py-2 flex items-center justify-between">
                    <span class="font-black text-xs uppercase text-black">
                        S3 FILE INSPECTOR // {previewFile.key}
                    </span>
                    <button onclick={() => previewFile = null} class="w-6 h-6 border border-black bg-white hover:bg-[#FFC2D1] flex items-center justify-center font-bold text-xs">
                        ✕
                    </button>
                </div>

                <!-- Window Body -->
                <div class="p-6 space-y-4 bg-white">
                    <div class="max-h-80 border-2 border-black bg-[#F6F4EE] flex items-center justify-center p-2 shadow-[2px_2px_0px_0px_#000]">
                        {#if previewFile.content_type?.startsWith('image/')}
                            <img src={previewFile.url} alt={previewFile.key} class="max-h-72 object-contain" />
                        {:else}
                            <div class="p-10 text-center flex flex-col items-center">
                                <span class="material-symbols-outlined text-5xl text-black/30 mb-2">description</span>
                                <p class="text-xs font-bold font-mono">{previewFile.content_type}</p>
                            </div>
                        {/if}
                    </div>

                    <!-- Metadata Grid -->
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#EDE9DF] border-2 border-black p-3 text-xs">
                        <div>
                            <span class="text-[10px] text-black/60 block uppercase font-bold">Poids</span>
                            <span class="font-black">{formatFileSize(previewFile.size)}</span>
                        </div>
                        <div>
                            <span class="text-[10px] text-black/60 block uppercase font-bold">Type MIME</span>
                            <span class="font-black truncate block">{previewFile.content_type}</span>
                        </div>
                        <div>
                            <span class="text-[10px] text-black/60 block uppercase font-bold">Modifié</span>
                            <span class="font-black truncate block">{formatDate(previewFile.last_modified)}</span>
                        </div>
                        <div>
                            <span class="text-[10px] text-black/60 block uppercase font-bold">Statut</span>
                            {#if previewFile.is_used}
                                <span class="retro-badge bg-[#99E7DC] text-[9px]">En ligne</span>
                            {:else}
                                <span class="retro-badge bg-[#FFC2D1] text-[9px]">Orphelin</span>
                            {/if}
                        </div>
                    </div>

                    {#if previewFile.reference_title}
                        <div class="border-2 border-black bg-[#D4E2FD] p-2.5 text-xs text-black shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-[14px]">link</span>
                            <span>Rattaché à : <strong>{previewFile.reference_title}</strong> (ID #{previewFile.reference_id})</span>
                        </div>
                    {/if}

                    <div class="flex flex-wrap justify-between items-center gap-3 pt-2">
                        <div class="flex gap-2">
                            <button onclick={() => copyURL(previewFile?.url || '')} class="retro-btn text-xs bg-white hover:bg-[#FFE600] flex items-center gap-1">
                                <span class="material-symbols-outlined text-[14px]">content_copy</span>
                                <span>Copier URL</span>
                            </button>
                            <a href={previewFile.url} target="_blank" rel="noreferrer" class="retro-btn text-xs bg-white hover:bg-[#D4E2FD] flex items-center gap-1">
                                <span>Ouvrir</span>
                                <span class="material-symbols-outlined text-[14px]">open_in_new</span>
                            </a>
                        </div>

                        <button onclick={() => previewFile && deleteSingleFile(previewFile)} class="retro-btn-error text-xs font-black flex items-center gap-1">
                            <span class="material-symbols-outlined text-[14px]">delete</span>
                            <span>Supprimer de S3</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    {/if}
</div>
