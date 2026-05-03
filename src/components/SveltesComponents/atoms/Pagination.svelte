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

<div class="flex items-center justify-between bg-base-100 p-4 rounded-2xl shadow-sm border border-base-200 mt-4">
    <div class="text-sm text-base-content/60">
        Affichage de <b>{pagination.page_size}</b> sur <b>{pagination.total_items}</b> articles
    </div>
    
    <div class="join">
        <button 
            class="join-item btn btn-sm" 
            disabled={pagination.current_page <= 1}
            onclick={() => goToPage(pagination.current_page - 1)}
        >
            Précédent
        </button>
        
        <button class="join-item btn btn-sm no-animation pointer-events-none">
            Page {pagination.current_page} sur {pagination.total_pages}
        </button>
        
        <button 
            class="join-item btn btn-sm" 
            disabled={pagination.current_page >= pagination.total_pages}
            onclick={() => goToPage(pagination.current_page + 1)}
        >
            Suivant
        </button>
    </div>
</div>