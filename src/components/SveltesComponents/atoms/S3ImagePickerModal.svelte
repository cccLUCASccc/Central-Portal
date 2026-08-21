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
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-mono">
        <div class="w-full max-w-4xl bg-[#EDE9DF] border-3 border-black shadow-[8px_8px_0px_0px_#000] flex flex-col max-h-[90vh] overflow-hidden">
            
            <!-- Retro Window Titlebar -->
            <div class="bg-[#FFE600] border-b-2 border-black px-4 py-2 flex items-center justify-between select-none">
                <div class="flex items-center gap-2">
                    <span class="w-3 h-3 bg-black"></span>
                    <span class="font-black text-xs uppercase tracking-wider text-black">
                        🗔 S3 IMAGE EXPLORER // MEDIA SELECTOR
                    </span>
                </div>
                <div class="flex items-center gap-1.5">
                    <button onclick={onclose} class="w-6 h-6 border border-black bg-white hover:bg-[#FFC2D1] flex items-center justify-center font-bold text-xs shadow-[1px_1px_0px_0px_#000]">
                        ✕
                    </button>
                </div>
            </div>

            <!-- Toolbar & Search -->
            <div class="p-4 border-b-2 border-black bg-white flex flex-col sm:flex-row justify-between items-center gap-3">
                <div class="flex flex-wrap gap-1.5 w-full sm:w-auto">
                    <button 
                        class="retro-btn py-1 px-3 text-xs {filter === 'images' ? '!bg-[#D4E2FD] shadow-[3px_3px_0px_0px_#000]' : 'bg-white'}"
                        onclick={() => { filter = 'images'; loadS3Images(1); }}
                    >
                        Toutes ({pagination?.total_items ?? '...'})
                    </button>
                    <button 
                        class="retro-btn py-1 px-3 text-xs {filter === 'orphans' ? '!bg-[#FFF394] shadow-[3px_3px_0px_0px_#000]' : 'bg-white'}"
                        onclick={() => { filter = 'orphans'; loadS3Images(1); }}
                    >
                        ⚠️ Orphelines
                    </button>
                    <button 
                        class="retro-btn py-1 px-3 text-xs {filter === 'used' ? '!bg-[#99E7DC] shadow-[3px_3px_0px_0px_#000]' : 'bg-white'}"
                        onclick={() => { filter = 'used'; loadS3Images(1); }}
                    >
                        🔗 Associées
                    </button>
                </div>

                <div class="relative w-full sm:w-64">
                    <input 
                        type="text" 
                        placeholder="Rechercher fichier..." 
                        bind:value={searchQuery}
                        onkeydown={(e) => e.key === 'Enter' && loadS3Images(1)}
                        class="retro-input text-xs py-1.5 pr-6"
                    />
                    {#if searchQuery}
                        <button 
                            onclick={() => { searchQuery = ''; loadS3Images(1); }}
                            class="absolute right-2 top-2 text-xs font-bold text-black hover:opacity-60"
                        >
                            ✕
                        </button>
                    {/if}
                </div>
            </div>

            <!-- Image Grid Content -->
            <div class="flex-1 overflow-y-auto p-4 bg-[#F6F4EE] min-h-[300px]">
                {#if isLoading}
                    <div class="flex flex-col items-center justify-center h-48 gap-3">
                        <span class="loading loading-spinner loading-lg text-black"></span>
                        <span class="text-xs font-bold uppercase text-black">Scan du bucket S3...</span>
                    </div>
                {:else if images.length === 0}
                    <div class="text-center py-16 border-2 border-dashed border-black/40 p-8 bg-white shadow-[3px_3px_0px_0px_#000]">
                        <div class="text-3xl mb-2">💾</div>
                        <p class="text-sm font-bold uppercase text-black">Aucune image trouvée</p>
                        <p class="text-xs text-black/60 mt-1">Modifiez vos critères de recherche ou filtre.</p>
                    </div>
                {:else}
                    <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                        {#each images as img (img.key)}
                            {@const isSelected = selectedKeys.includes(img.key)}
                            <div 
                                role="button"
                                tabindex="0"
                                class="group relative aspect-square border-2 border-black bg-white cursor-pointer transition-all duration-150 {isSelected ? 'ring-3 ring-black shadow-[4px_4px_0px_0px_#000] -translate-x-0.5 -translate-y-0.5 bg-[#99E7DC]' : 'shadow-[2px_2px_0px_0px_#000] hover:shadow-[4px_4px_0px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5'}"
                                onclick={() => toggleSelect(img.key)}
                                onkeydown={(e) => e.key === 'Enter' && toggleSelect(img.key)}
                            >
                                <img 
                                    src={img.url} 
                                    alt={img.key} 
                                    loading="lazy" 
                                    class="w-full h-full object-cover p-0.5" 
                                />

                                <!-- Selection indicator checkbox -->
                                <div class="absolute top-1.5 left-1.5 z-10">
                                    <div class="w-5 h-5 border-2 border-black flex items-center justify-center text-xs font-black {isSelected ? 'bg-black text-[#FFE600] shadow-[1px_1px_0px_0px_#000]' : 'bg-white text-transparent'}">
                                        ✓
                                    </div>
                                </div>

                                <!-- Status Badge -->
                                {#if !img.is_used}
                                    <div class="absolute bottom-1 right-1 z-10 pointer-events-none">
                                        <span class="retro-badge bg-[#FFF394] text-[9px] px-1 py-0 border border-black">Orpheline</span>
                                    </div>
                                {/if}

                                <!-- File tooltip overlay -->
                                <div class="absolute inset-x-0 bottom-0 bg-black/90 p-1 text-[9px] text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                    <p class="truncate font-mono">{img.key}</p>
                                    <p class="opacity-70 font-mono">{formatFileSize(img.size)}</p>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Footer Toolbar -->
            <div class="p-3 border-t-2 border-black bg-[#EDE9DF] flex flex-col sm:flex-row items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                    {#if pagination && pagination.total_pages > 1}
                        <div class="flex items-center gap-1">
                            <button 
                                class="retro-btn py-0.5 px-2 text-xs bg-white" 
                                disabled={pagination.current_page <= 1}
                                onclick={() => loadS3Images((pagination?.current_page || 1) - 1)}
                            >
                                «
                            </button>
                            <span class="border border-black bg-white px-2 py-0.5 text-[11px] font-bold">
                                {pagination.current_page} / {pagination.total_pages}
                            </span>
                            <button 
                                class="retro-btn py-0.5 px-2 text-xs bg-white" 
                                disabled={pagination.current_page >= pagination.total_pages}
                                onclick={() => loadS3Images((pagination?.current_page || 1) + 1)}
                            >
                                »
                            </button>
                        </div>
                    {/if}

                    <span class="text-xs font-bold text-black">
                        [ <span class="text-[#FFD2A6] bg-black px-1">{selectedKeys.length}</span> sélect. ]
                    </span>
                </div>

                <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button onclick={onclose} class="retro-btn py-1.5 px-4 text-xs bg-white">
                        Annuler
                    </button>
                    <button 
                        onclick={confirmSelection} 
                        class="retro-btn-primary py-1.5 px-5 text-xs font-black shadow-[3px_3px_0px_0px_#000]"
                        disabled={selectedKeys.length === 0}
                    >
                        <span>Insérer {selectedKeys.length} image(s)</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}
