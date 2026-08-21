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
    let selectedFilter = $state("all"); // all, orphans, used, antiquite, blog, images
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
                notify("Impossible de récupérer la liste des fichiers.", "error");
            }
        } catch (err) {
            console.error("Erreur chargement fichiers S3 :", err);
            notify("Erreur de connexion au serveur.", "error");
        } finally {
            isLoading = false;
        }
    }

    function handleFilterChange(filter: string) {
        selectedFilter = filter;
        selectedKeys = [];
        loadFiles(1);
    }

    function handleSortChange(e: Event) {
        selectedSort = (e.target as HTMLSelectElement).value;
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

    async function copyURL(url: string) {
        try {
            await navigator.clipboard.writeText(url);
            notify("Lien copié dans le presse-papiers ! ✨", "success");
        } catch {
            notify("Impossible de copier le lien.", "error");
        }
    }

    async function deleteSingleFile(file: S3FileItem) {
        let confirmMsg = `Êtes-vous sûr de vouloir supprimer définitivement "${file.key}" de S3 ?`;
        if (file.is_used) {
            confirmMsg = `⚠️ ATTENTION : Ce fichier est lié à ${file.reference_type === 'antiquite' ? 'l\'objet' : 'l\'article'} "${file.reference_title}".\n\nSupprimer ce fichier supprimera également l'image sur le site. Continuer ?`;
        }

        if (!confirm(confirmMsg)) return;

        try {
            const res = await apiFetch(`${PUBLIC_API_URL}/api/storage/files?key=${encodeURIComponent(file.key)}`, {
                method: "DELETE"
            });

            if (res.ok) {
                notify(`"${file.key}" supprimé avec succès.`, "success");
                if (previewFile?.key === file.key) {
                    previewFile = null;
                }
                selectedKeys = selectedKeys.filter(k => k !== file.key);
                loadFiles(pagination?.current_page || 1);
                loadStats();
            } else {
                notify("Erreur lors de la suppression du fichier.", "error");
            }
        } catch (err) {
            console.error("Erreur suppression :", err);
            notify("Erreur de communication lors de la suppression.", "error");
        }
    }

    async function deleteSelectedBulk() {
        if (selectedKeys.length === 0) return;

        const count = selectedKeys.length;
        if (!confirm(`Êtes-vous sûr de vouloir supprimer définitivement ces ${count} fichier(s) de S3 ?`)) return;

        try {
            const res = await apiFetch(`${PUBLIC_API_URL}/api/storage/bulk-delete`, {
                method: "POST",
                body: JSON.stringify({ keys: selectedKeys })
            });

            if (res.ok) {
                notify(`${count} fichier(s) supprimé(s) avec succès.`, "success");
                selectedKeys = [];
                loadFiles(pagination?.current_page || 1);
                loadStats();
            } else {
                notify("Erreur lors de la suppression groupée.", "error");
            }
        } catch (err) {
            console.error("Erreur suppression groupée :", err);
            notify("Erreur de connexion lors de la suppression.", "error");
        }
    }

    async function handleFileUpload(filesToUpload: FileList | File[]) {
        if (!filesToUpload || filesToUpload.length === 0) return;

        isUploading = true;
        const formData = new FormData();
        const filesArray = Array.from(filesToUpload);

        notify(`Préparation et upload de ${filesArray.length} fichier(s)...`, "info");

        try {
            for (const file of filesArray) {
                if (autoCompress && file.type.startsWith('image/')) {
                    const compressed = await compressImageFile(file, {
                        maxWidth: 1600,
                        maxHeight: 1600,
                        quality: 0.8,
                        mimeType: 'image/webp'
                    });
                    formData.append("files", compressed);
                } else {
                    formData.append("files", file);
                }
            }

            const res = await apiFetch(`${PUBLIC_API_URL}/api/storage/upload`, {
                method: "POST",
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                notify(data.message || "Fichiers téléversés avec succès ! ✨", "success");
                loadFiles(1);
                loadStats();
            } else {
                notify("Erreur lors de l'upload des fichiers.", "error");
            }
        } catch (err) {
            console.error("Erreur upload :", err);
            notify("Erreur réseau lors de l'upload.", "error");
        } finally {
            isUploading = false;
        }
    }

    function handleDrop(e: DragEvent) {
        e.preventDefault();
        isDragging = false;
        if (e.dataTransfer?.files) {
            handleFileUpload(e.dataTransfer.files);
        }
    }

    onMount(() => {
        loadStats();
        loadFiles(1);
    });
</script>

<div class="space-y-6">
    <!-- Notification Toast -->
    {#if notification}
        <div class="toast toast-top toast-end z-50">
            <div class="alert {notification.type === 'error' ? 'alert-error' : notification.type === 'info' ? 'alert-info' : 'alert-success'} shadow-lg text-sm font-medium">
                <span>{notification.text}</span>
            </div>
        </div>
    {/if}

    <!-- Header & Stats -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 class="text-3xl font-bold tracking-tight flex items-center gap-2">
                <span>📁</span> Gestionnaire de Fichiers S3
            </h1>
            <p class="text-sm opacity-60 mt-1">Explorez, organisez et nettoyez les fichiers et images hébergés sur votre stockage AWS S3.</p>
        </div>

        <div class="flex items-center gap-3">
            <button 
                onclick={() => { loadStats(); loadFiles(pagination?.current_page || 1); }} 
                class="btn btn-outline btn-sm gap-2"
                disabled={isLoading}
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 {isLoading ? 'animate-spin' : ''}"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                Actualiser
            </button>
        </div>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="card bg-base-200/50 border border-base-300 p-4 rounded-2xl shadow-sm">
            <div class="text-xs font-semibold uppercase tracking-wider opacity-60">Espace Total S3</div>
            <div class="text-2xl font-bold mt-1 text-primary">{stats?.total_size_formatted || "..."}</div>
            <div class="text-xs opacity-50 mt-1">Consommation bucket</div>
        </div>

        <div class="card bg-base-200/50 border border-base-300 p-4 rounded-2xl shadow-sm">
            <div class="text-xs font-semibold uppercase tracking-wider opacity-60">Total Fichiers</div>
            <div class="text-2xl font-bold mt-1">{stats?.total_files ?? "..."}</div>
            <div class="text-xs opacity-50 mt-1">Tous types confondus</div>
        </div>

        <div class="card bg-base-200/50 border border-base-300 p-4 rounded-2xl shadow-sm">
            <div class="text-xs font-semibold uppercase tracking-wider opacity-60">Fichiers En Ligne</div>
            <div class="text-2xl font-bold mt-1 text-success">{stats?.used_files ?? "..."}</div>
            <div class="text-xs opacity-50 mt-1">Liés à un objet ou blog</div>
        </div>

        <div class="card bg-base-200/50 border border-base-300 p-4 rounded-2xl shadow-sm">
            <div class="flex justify-between items-start">
                <div class="text-xs font-semibold uppercase tracking-wider opacity-60">Fichiers Orphelins</div>
                {#if stats && stats.orphan_files > 0}
                    <button 
                        onclick={() => handleFilterChange("orphans")}
                        class="badge badge-warning badge-xs hover:scale-105 transition-transform cursor-pointer"
                    >
                        Filtrer
                    </button>
                {/if}
            </div>
            <div class="text-2xl font-bold mt-1 text-warning">{stats?.orphan_files ?? "..."}</div>
            <div class="text-xs opacity-50 mt-1">Non référencés en base</div>
        </div>
    </div>

    <!-- Zone Upload (Drag & Drop) -->
    <div 
        role="region"
        aria-label="Zone d'upload de fichiers"
        class="border-2 border-dashed rounded-2xl p-6 transition-all text-center relative {isDragging ? 'border-primary bg-primary/10 scale-[1.01]' : 'border-base-300 bg-base-200/30 hover:border-primary/50'}"
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
            <div class="p-3 rounded-full bg-primary/10 text-primary">
                {#if isUploading}
                    <span class="loading loading-spinner loading-md"></span>
                {:else}
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" /></svg>
                {/if}
            </div>

            <div class="space-y-1">
                <p class="font-bold text-sm">
                    {isUploading ? "Téléversement et optimisation en cours..." : "Glissez-déposez des fichiers ici ou cliquez pour parcourir"}
                </p>
                <p class="text-xs opacity-50">Images (PNG, JPG, WebP), documents (PDF) supportés</p>
            </div>

            <div class="flex items-center gap-4 mt-2">
                <label for="storage-upload-input" class="btn btn-sm btn-primary gap-2 cursor-pointer" class:btn-disabled={isUploading}>
                    Choisir des fichiers
                </label>

                <label class="label cursor-pointer gap-2 text-xs opacity-75">
                    <input type="checkbox" bind:checked={autoCompress} class="checkbox checkbox-xs checkbox-primary" />
                    <span>Auto-compression WebP</span>
                </label>
            </div>
        </div>
    </div>

    <!-- Filters & Action Bar -->
    <div class="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-base-200/40 p-4 rounded-2xl border border-base-300">
        <!-- Filter Tabs -->
        <div class="flex flex-wrap gap-1">
            <button 
                class="btn btn-xs sm:btn-sm {selectedFilter === 'all' ? 'btn-neutral' : 'btn-ghost'}"
                onclick={() => handleFilterChange('all')}
            >
                Tous
            </button>
            <button 
                class="btn btn-xs sm:btn-sm {selectedFilter === 'images' ? 'btn-neutral' : 'btn-ghost'}"
                onclick={() => handleFilterChange('images')}
            >
                🖼️ Images
            </button>
            <button 
                class="btn btn-xs sm:btn-sm {selectedFilter === 'antiquite' ? 'btn-neutral' : 'btn-ghost'}"
                onclick={() => handleFilterChange('antiquite')}
            >
                🏷️ Boutique
            </button>
            <button 
                class="btn btn-xs sm:btn-sm {selectedFilter === 'blog' ? 'btn-neutral' : 'btn-ghost'}"
                onclick={() => handleFilterChange('blog')}
            >
                📰 Blog
            </button>
            <button 
                class="btn btn-xs sm:btn-sm {selectedFilter === 'orphans' ? 'btn-warning' : 'btn-ghost text-warning'}"
                onclick={() => handleFilterChange('orphans')}
            >
                ⚠️ Orphelins ({stats?.orphan_files ?? 0})
            </button>
        </div>

        <!-- Search & Sort & View toggle -->
        <div class="flex flex-wrap items-center gap-2">
            <!-- Search -->
            <div class="relative flex-1 md:w-64">
                <input 
                    type="text" 
                    placeholder="Rechercher par nom..." 
                    bind:value={searchQuery}
                    onkeydown={(e) => e.key === 'Enter' && handleSearch()}
                    class="input input-sm input-bordered w-full pr-8"
                />
                {#if searchQuery}
                    <button 
                        onclick={() => { searchQuery = ""; handleSearch(); }}
                        class="absolute right-2 top-1.5 opacity-50 hover:opacity-100 text-xs"
                    >
                        ✕
                    </button>
                {/if}
            </div>

            <!-- Sort -->
            <select 
                class="select select-sm select-bordered" 
                value={selectedSort} 
                onchange={handleSortChange}
            >
                <option value="date_desc">📅 Plus récent</option>
                <option value="date_asc">📅 Plus ancien</option>
                <option value="size_desc">⚖️ Plus lourd</option>
                <option value="size_asc">⚖️ Plus léger</option>
                <option value="name_asc">🔤 Nom A-Z</option>
            </select>

            <!-- View Toggle -->
            <div class="join border border-base-300 rounded-lg">
                <button 
                    class="join-item btn btn-sm btn-ghost {viewMode === 'grid' ? 'bg-base-300' : ''}" 
                    onclick={() => viewMode = 'grid'}
                    title="Vue Grille"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" /></svg>
                </button>
                <button 
                    class="join-item btn btn-sm btn-ghost {viewMode === 'table' ? 'bg-base-300' : ''}" 
                    onclick={() => viewMode = 'table'}
                    title="Vue Tableau"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M3.75 4.5h16.5k" /></svg>
                </button>
            </div>
        </div>
    </div>

    <!-- Bulk Action Bar (When files are selected) -->
    {#if selectedKeys.length > 0}
        <div class="flex items-center justify-between bg-primary/10 border border-primary/20 px-4 py-3 rounded-xl animate-in fade-in duration-200">
            <div class="flex items-center gap-2 text-sm font-semibold">
                <span class="badge badge-primary badge-sm">{selectedKeys.length}</span>
                <span>fichier(s) sélectionné(s)</span>
            </div>

            <div class="flex items-center gap-2">
                <button onclick={() => selectedKeys = []} class="btn btn-ghost btn-xs">
                    Désélectionner tout
                </button>
                <button onclick={deleteSelectedBulk} class="btn btn-error btn-xs gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                    Supprimer ({selectedKeys.length})
                </button>
            </div>
        </div>
    {/if}

    <!-- Content Area (Grid / Table) -->
    {#if isLoading}
        <div class="flex flex-col items-center justify-center py-20 gap-3">
            <span class="loading loading-spinner loading-lg text-primary"></span>
            <p class="text-sm opacity-50">Chargement des fichiers S3...</p>
        </div>
    {:else if files.length === 0}
        <div class="card bg-base-200/50 border border-base-300 p-12 text-center rounded-2xl">
            <div class="text-4xl mb-2">🔍</div>
            <h3 class="text-lg font-bold">Aucun fichier trouvé</h3>
            <p class="text-sm opacity-50 mt-1">Aucun fichier ne correspond à vos filtres ou recherche.</p>
            {#if selectedFilter !== 'all' || searchQuery}
                <div class="mt-4">
                    <button onclick={() => { searchQuery = ""; handleFilterChange("all"); }} class="btn btn-sm btn-outline">
                        Réinitialiser les filtres
                    </button>
                </div>
            {/if}
        </div>
    {:else if viewMode === 'grid'}
        <!-- Grid View -->
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {#each files as file (file.key)}
                <div class="group card bg-base-100 border border-base-200 hover:border-primary/40 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all relative flex flex-col">
                    <!-- Checkbox overlay -->
                    <div class="absolute top-2 left-2 z-20">
                        <input 
                            type="checkbox" 
                            checked={selectedKeys.includes(file.key)}
                            onchange={() => toggleSelectKey(file.key)}
                            class="checkbox checkbox-sm checkbox-primary bg-base-100/80 backdrop-blur-sm"
                        />
                    </div>

                    <!-- Status badge -->
                    <div class="absolute top-2 right-2 z-20">
                        {#if file.is_used}
                            {#if file.reference_type === 'antiquite'}
                                <span class="badge badge-success badge-xs gap-1 shadow-sm" title={`Lié à l'objet : ${file.reference_title}`}>
                                    🔗 #{file.reference_id}
                                </span>
                            {:else if file.reference_type === 'blog'}
                                <span class="badge badge-info badge-xs gap-1 shadow-sm" title={`Blog : ${file.reference_title}`}>
                                    📰 Blog
                                </span>
                            {/if}
                        {:else}
                            <span class="badge badge-warning badge-xs shadow-sm" title="Non lié en base de données">
                                Inutilisé
                            </span>
                        {/if}
                    </div>

                    <!-- Image / Preview Thumbnail -->
                    <div 
                        role="button"
                        tabindex="0"
                        class="aspect-square bg-base-200 relative overflow-hidden flex items-center justify-center cursor-pointer"
                        onclick={() => previewFile = file}
                        onkeydown={(e) => e.key === 'Enter' && (previewFile = file)}
                    >
                        {#if file.content_type.startsWith('image/')}
                            <img 
                                src={file.url} 
                                alt={file.key}
                                loading="lazy"
                                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                        {:else}
                            <div class="flex flex-col items-center gap-1 opacity-50">
                                <span class="text-3xl">📄</span>
                                <span class="text-[10px] uppercase font-bold">{file.key.split('.').pop()}</span>
                            </div>
                        {/if}

                        <div class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <span class="btn btn-circle btn-xs btn-neutral">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                            </span>
                        </div>
                    </div>

                    <!-- Meta & Actions -->
                    <div class="p-3 flex-1 flex flex-col justify-between text-left gap-1">
                        <div class="text-xs font-semibold truncate" title={file.key}>{file.key}</div>
                        
                        {#if file.reference_title}
                            <div class="text-[11px] opacity-75 truncate text-primary font-medium" title={file.reference_title}>
                                {file.reference_title}
                            </div>
                        {/if}

                        <div class="flex items-center justify-between text-[10px] opacity-50 pt-1 border-t border-base-200 mt-1">
                            <span>{formatFileSize(file.size)}</span>
                            <span>{file.key.split('.').pop()?.toUpperCase()}</span>
                        </div>

                        <!-- Mini action buttons -->
                        <div class="flex items-center justify-end gap-1 mt-2">
                            <button 
                                onclick={() => copyURL(file.url)}
                                class="btn btn-ghost btn-xs btn-square"
                                title="Copier le lien"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" /></svg>
                            </button>
                            <a 
                                href={file.url} 
                                target="_blank" 
                                rel="noreferrer"
                                class="btn btn-ghost btn-xs btn-square"
                                title="Ouvrir"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                            </a>
                            <button 
                                onclick={() => deleteSingleFile(file)}
                                class="btn btn-ghost btn-xs btn-square text-error"
                                title="Supprimer"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                            </button>
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    {:else}
        <!-- Table View -->
        <div class="overflow-x-auto bg-base-100 border border-base-200 rounded-2xl shadow-sm">
            <table class="table table-sm">
                <thead>
                    <tr>
                        <th class="w-8">
                            <input 
                                type="checkbox" 
                                class="checkbox checkbox-xs checkbox-primary"
                                checked={selectedKeys.length === files.length && files.length > 0}
                                onchange={toggleSelectAll}
                            />
                        </th>
                        <th class="w-14">Aperçu</th>
                        <th>Nom du fichier</th>
                        <th>Statut DB</th>
                        <th>Taille</th>
                        <th>Modifié le</th>
                        <th class="text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {#each files as file (file.key)}
                        <tr class="hover:bg-base-200/50 transition-colors">
                            <td>
                                <input 
                                    type="checkbox" 
                                    class="checkbox checkbox-xs checkbox-primary"
                                    checked={selectedKeys.includes(file.key)}
                                    onchange={() => toggleSelectKey(file.key)}
                                />
                            </td>
                            <td>
                                <div 
                                    role="button"
                                    tabindex="0"
                                    class="w-10 h-10 rounded-lg overflow-hidden bg-base-200 flex items-center justify-center cursor-pointer"
                                    onclick={() => previewFile = file}
                                    onkeydown={(e) => e.key === 'Enter' && (previewFile = file)}
                                >
                                    {#if file.content_type.startsWith('image/')}
                                        <img src={file.url} alt={file.key} class="w-full h-full object-cover" loading="lazy" />
                                    {:else}
                                        <span class="text-lg">📄</span>
                                    {/if}
                                </div>
                            </td>
                            <td>
                                <div class="font-medium text-xs max-w-xs truncate" title={file.key}>{file.key}</div>
                                <div class="text-[10px] opacity-40">{file.content_type}</div>
                            </td>
                            <td>
                                {#if file.is_used}
                                    {#if file.reference_type === 'antiquite'}
                                        <a href={`/antiquites/${file.reference_id}`} class="badge badge-success badge-sm gap-1 hover:underline">
                                            🔗 Objet #{file.reference_id} : {file.reference_title || 'Sans titre'}
                                        </a>
                                    {:else if file.reference_type === 'blog'}
                                        <span class="badge badge-info badge-sm gap-1">
                                            📰 Blog : {file.reference_title || 'Article'}
                                        </span>
                                    {/if}
                                {:else}
                                    <span class="badge badge-warning badge-sm">⚠️ Inutilisé (Orphelin)</span>
                                {/if}
                            </td>
                            <td class="text-xs font-mono">{formatFileSize(file.size)}</td>
                            <td class="text-xs opacity-60">{formatDate(file.last_modified)}</td>
                            <td class="text-right">
                                <div class="flex items-center justify-end gap-1">
                                    <button 
                                        onclick={() => copyURL(file.url)}
                                        class="btn btn-ghost btn-xs btn-square"
                                        title="Copier l'URL"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" /></svg>
                                    </button>
                                    <a 
                                        href={file.url} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        class="btn btn-ghost btn-xs btn-square"
                                        title="Ouvrir le fichier"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                                    </a>
                                    <button 
                                        onclick={() => deleteSingleFile(file)}
                                        class="btn btn-ghost btn-xs btn-square text-error"
                                        title="Supprimer"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}

    <!-- Pagination -->
    {#if pagination && pagination.total_pages > 1}
        <div class="flex justify-center mt-6">
            <div class="join border border-base-300">
                <button 
                    class="join-item btn btn-sm"
                    disabled={pagination.current_page <= 1}
                    onclick={() => loadFiles((pagination?.current_page || 1) - 1)}
                >
                    «
                </button>
                <button class="join-item btn btn-sm pointer-events-none">
                    Page {pagination.current_page} sur {pagination.total_pages} ({pagination.total_items} fichiers)
                </button>
                <button 
                    class="join-item btn btn-sm"
                    disabled={pagination.current_page >= pagination.total_pages}
                    onclick={() => loadFiles((pagination?.current_page || 1) + 1)}
                >
                    »
                </button>
            </div>
        </div>
    {/if}

    <!-- Preview Modal -->
    {#if previewFile}
        <div class="modal modal-open">
            <div class="modal-box max-w-3xl p-6 relative">
                <button 
                    onclick={() => previewFile = null}
                    class="btn btn-sm btn-circle btn-ghost absolute right-3 top-3"
                >
                    ✕
                </button>

                <h3 class="font-bold text-lg mb-4 truncate">{previewFile.key}</h3>

                <div class="space-y-4">
                    <div class="aspect-video sm:aspect-auto sm:max-h-96 rounded-xl overflow-hidden bg-base-300 flex items-center justify-center">
                        {#if previewFile.content_type.startsWith('image/')}
                            <img src={previewFile.url} alt={previewFile.key} class="max-h-96 object-contain" />
                        {:else}
                            <div class="p-12 text-center">
                                <div class="text-6xl mb-2">📄</div>
                                <p class="text-sm font-semibold">{previewFile.content_type}</p>
                            </div>
                        {/if}
                    </div>

                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-base-200/50 p-4 rounded-xl text-xs">
                        <div>
                            <span class="opacity-50 block">Taille</span>
                            <span class="font-bold">{formatFileSize(previewFile.size)}</span>
                        </div>
                        <div>
                            <span class="opacity-50 block">Type MIME</span>
                            <span class="font-bold">{previewFile.content_type}</span>
                        </div>
                        <div>
                            <span class="opacity-50 block">Date de modification</span>
                            <span class="font-bold">{formatDate(previewFile.last_modified)}</span>
                        </div>
                        <div>
                            <span class="opacity-50 block">Statut DB</span>
                            {#if previewFile.is_used}
                                <span class="badge badge-success badge-xs mt-0.5">En ligne</span>
                            {:else}
                                <span class="badge badge-warning badge-xs mt-0.5">Orphelin</span>
                            {/if}
                        </div>
                    </div>

                    {#if previewFile.reference_title}
                        <div class="alert alert-info text-xs py-2">
                            <span>Lié à : <strong>{previewFile.reference_title}</strong> ({previewFile.reference_type === 'antiquite' ? 'Objet' : 'Blog'} #{previewFile.reference_id})</span>
                        </div>
                    {/if}

                    <div class="flex flex-wrap justify-between items-center gap-3 pt-2">
                        <div class="flex gap-2">
                            <button onclick={() => copyURL(previewFile?.url || '')} class="btn btn-sm btn-outline gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" /></svg>
                                Copier le lien
                            </button>
                            <a href={previewFile.url} target="_blank" rel="noreferrer" class="btn btn-sm btn-outline gap-2">
                                Ouvrir dans un onglet ↗
                            </a>
                        </div>

                        <button onclick={() => previewFile && deleteSingleFile(previewFile)} class="btn btn-sm btn-error gap-2">
                            Supprimer de S3
                        </button>
                    </div>
                </div>
            </div>
            <div 
                role="button"
                tabindex="0"
                class="modal-backdrop" 
                onclick={() => previewFile = null}
                onkeydown={(e) => e.key === 'Escape' && (previewFile = null)}
            ></div>
        </div>
    {/if}
</div>

