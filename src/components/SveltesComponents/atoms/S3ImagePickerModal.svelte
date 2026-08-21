<script lang="ts">
    import { apiFetch } from '../../../lib/api';

    interface S3ImageItem {
        key: string;
        size: number;
        last_modified: string;
        content_type: string;
        url: string;
        is_used: boolean;
        reference_title?: string;
    }

    interface Pagination {
        total_items: number;
        total_pages: number;
        current_page: number;
        page_size: number;
    }

    interface Props {
        isOpen: boolean;
        onclose: () => void;
        onselect: (selected: Array<{ key: string; url: string }>) => void;
    }

    let { isOpen, onclose, onselect }: Props = $props();

    let images = $state<S3ImageItem[]>([]);
    let pagination = $state<Pagination | null>(null);
    let isLoading = $state(false);
    let searchQuery = $state("");
    let filter = $state("images"); // images, orphans, used
    let selectedKeys = $state<string[]>([]);

    const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;

    function formatFileSize(bytes: number): string {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'Ko', 'Mo', 'Go'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    async function loadS3Images(page = 1) {
        isLoading = true;
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: "36",
                filter: filter,
                q: searchQuery,
                sort: "date_desc"
            });

            const res = await apiFetch(`${PUBLIC_API_URL}/api/storage/files?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                images = (data.data || []).filter((f: S3ImageItem) => f.content_type?.startsWith('image/'));
                pagination = data.pagination || null;
            }
        } catch (err) {
            console.error("Erreur chargement images S3 :", err);
        } finally {
            isLoading = false;
        }
    }

    $effect(() => {
        if (isOpen) {
            selectedKeys = [];
            loadS3Images(1);
        }
    });

    function toggleSelect(key: string) {
        if (selectedKeys.includes(key)) {
            selectedKeys = selectedKeys.filter(k => k !== key);
        } else {
            selectedKeys = [...selectedKeys, key];
        }
    }

    function confirmSelection() {
        const chosen = images
            .filter(img => selectedKeys.includes(img.key))
            .map(img => ({ key: img.key, url: img.url }));

        onselect(chosen);
        onclose();
    }
</script>

{#if isOpen}
    <div class="modal modal-open z-50">
        <div class="modal-box max-w-4xl p-6 relative max-h-[90vh] flex flex-col">
            <!-- Header -->
            <div class="flex items-center justify-between pb-4 border-b border-base-200">
                <div>
                    <h3 class="font-bold text-xl flex items-center gap-2">
                        <span>🖼️</span> Choisir des images depuis S3
                    </h3>
                    <p class="text-xs opacity-50 mt-0.5">Sélectionnez des photos déjà hébergées sur votre stockage cloud.</p>
                </div>
                <button onclick={onclose} class="btn btn-sm btn-circle btn-ghost">✕</button>
            </div>

            <!-- Toolbar & Search -->
            <div class="flex flex-col sm:flex-row justify-between items-center gap-3 py-3 border-b border-base-200">
                <div class="flex gap-1 w-full sm:w-auto">
                    <button 
                        class="btn btn-xs {filter === 'images' ? 'btn-neutral' : 'btn-ghost'}"
                        onclick={() => { filter = 'images'; loadS3Images(1); }}
                    >
                        Toutes ({pagination?.total_items ?? '...'})
                    </button>
                    <button 
                        class="btn btn-xs {filter === 'orphans' ? 'btn-warning' : 'btn-ghost text-warning'}"
                        onclick={() => { filter = 'orphans'; loadS3Images(1); }}
                    >
                        ⚠️ Orphelines (non liées)
                    </button>
                    <button 
                        class="btn btn-xs {filter === 'used' ? 'btn-neutral' : 'btn-ghost'}"
                        onclick={() => { filter = 'used'; loadS3Images(1); }}
                    >
                        🔗 Déjà associées
                    </button>
                </div>

                <div class="relative w-full sm:w-64">
                    <input 
                        type="text" 
                        placeholder="Rechercher par nom..." 
                        bind:value={searchQuery}
                        onkeydown={(e) => e.key === 'Enter' && loadS3Images(1)}
                        class="input input-xs input-bordered w-full pr-7"
                    />
                    {#if searchQuery}
                        <button 
                            onclick={() => { searchQuery = ''; loadS3Images(1); }}
                            class="absolute right-2 top-1 text-xs opacity-50 hover:opacity-100"
                        >
                            ✕
                        </button>
                    {/if}
                </div>
            </div>

            <!-- Image Grid -->
            <div class="flex-1 overflow-y-auto py-4 min-h-[250px]">
                {#if isLoading}
                    <div class="flex flex-col items-center justify-center h-48 gap-2">
                        <span class="loading loading-spinner loading-md text-primary"></span>
                        <span class="text-xs opacity-50">Chargement des images S3...</span>
                    </div>
                {:else if images.length === 0}
                    <div class="text-center py-12 opacity-50">
                        <div class="text-3xl mb-2">🔍</div>
                        <p class="text-sm font-semibold">Aucune image trouvée</p>
                    </div>
                {:else}
                    <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                        {#each images as img (img.key)}
                            {@const isSelected = selectedKeys.includes(img.key)}
                            <div 
                                role="button"
                                tabindex="0"
                                class="group relative aspect-square rounded-xl overflow-hidden border-2 cursor-pointer transition-all {isSelected ? 'border-primary shadow-md ring-2 ring-primary/30 scale-95' : 'border-base-200 hover:border-primary/50'}"
                                onclick={() => toggleSelect(img.key)}
                                onkeydown={(e) => e.key === 'Enter' && toggleSelect(img.key)}
                            >
                                <img 
                                    src={img.url} 
                                    alt={img.key} 
                                    loading="lazy" 
                                    class="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                                />

                                <!-- Selection indicator -->
                                <div class="absolute top-1.5 left-1.5 z-10">
                                    <div class="w-5 h-5 rounded-md flex items-center justify-center text-xs transition-colors {isSelected ? 'bg-primary text-primary-content font-bold shadow' : 'bg-black/40 text-transparent hover:bg-black/60'}">
                                        ✓
                                    </div>
                                </div>

                                <!-- Status badge -->
                                {#if !img.is_used}
                                    <div class="absolute bottom-1 right-1 z-10">
                                        <span class="badge badge-warning text-[9px] px-1 py-0 shadow-xs">Orpheline</span>
                                    </div>
                                {/if}

                                <!-- File info overlay -->
                                <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1.5 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                    <p class="truncate font-medium">{img.key}</p>
                                    <p class="opacity-75">{formatFileSize(img.size)}</p>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Footer Pagination & Actions -->
            <div class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-base-200 mt-auto">
                <div class="flex items-center gap-2">
                    {#if pagination && pagination.total_pages > 1}
                        <div class="join border border-base-300">
                            <button 
                                class="join-item btn btn-xs" 
                                disabled={pagination.current_page <= 1}
                                onclick={() => loadS3Images((pagination?.current_page || 1) - 1)}
                            >
                                «
                            </button>
                            <button class="join-item btn btn-xs pointer-events-none text-[11px]">
                                {pagination.current_page} / {pagination.total_pages}
                            </button>
                            <button 
                                class="join-item btn btn-xs" 
                                disabled={pagination.current_page >= pagination.total_pages}
                                onclick={() => loadS3Images((pagination?.current_page || 1) + 1)}
                            >
                                »
                            </button>
                        </div>
                    {/if}

                    <span class="text-xs opacity-60">
                        {selectedKeys.length} sélectionnée(s)
                    </span>
                </div>

                <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button onclick={onclose} class="btn btn-sm btn-ghost">Annuler</button>
                    <button 
                        onclick={confirmSelection} 
                        class="btn btn-sm btn-primary gap-1.5"
                        disabled={selectedKeys.length === 0}
                    >
                        <span>Ajouter la sélection</span>
                        {#if selectedKeys.length > 0}
                            <span class="badge badge-sm badge-neutral">{selectedKeys.length}</span>
                        {/if}
                    </button>
                </div>
            </div>
        </div>
        <div 
            role="button"
            tabindex="0"
            class="modal-backdrop" 
            onclick={onclose}
            onkeydown={(e) => e.key === 'Escape' && onclose()}
        ></div>
    </div>
{/if}

