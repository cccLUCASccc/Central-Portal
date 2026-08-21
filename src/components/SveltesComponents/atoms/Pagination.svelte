<script lang="ts">
    import type { Pagination } from "../../../type";

    interface Props {
        pagination: Pagination;
        onPageChange: (page: number) => void;
    }

    let { pagination, onPageChange }: Props = $props();

    function goToPage(page: number) {
        if (page >= 1 && page <= pagination.total_pages) {
            onPageChange(page);
        }
    }
</script>

<div class="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#EDE9DF] border-2 border-black p-3 shadow-[3px_3px_0px_0px_#000] mt-6 font-mono">
    <div class="text-xs font-bold uppercase text-black/70">
        Articles : <span class="text-black bg-white px-1.5 py-0.5 border border-black">{pagination.page_size}</span> sur <span class="text-black bg-white px-1.5 py-0.5 border border-black">{pagination.total_items}</span>
    </div>
    
    <div class="flex items-center gap-1">
        <button 
            class="retro-btn py-1 px-3 text-xs bg-white hover:bg-[#FFE600]" 
            disabled={pagination.current_page <= 1}
            onclick={() => goToPage(pagination.current_page - 1)}
        >
            « Précédent
        </button>
        
        <div class="border-2 border-black bg-[#D4E2FD] px-3 py-1 text-xs font-bold text-black shadow-[2px_2px_0px_0px_#000]">
            PAGE {pagination.current_page} / {pagination.total_pages}
        </div>
        
        <button 
            class="retro-btn py-1 px-3 text-xs bg-white hover:bg-[#FFE600]" 
            disabled={pagination.current_page >= pagination.total_pages}
            onclick={() => goToPage(pagination.current_page + 1)}
        >
            Suivant »
        </button>
    </div>
</div>