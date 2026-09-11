<script lang="ts">
    import { onMount } from "svelte";
    import { apiFetch } from "../../../lib/api";

    interface Review {
        id: number;
        user_id: string;
        author_name: string;
        city: string;
        rating: number;
        title: string;
        comment: string;
        is_verified: boolean;
        is_approved: boolean;
        created_at: string;
    }

    let reviews = $state<Review[]>([]);
    let isLoading = $state(true);
    let isActionLoading = $state<number | null>(null);
    let searchQuery = $state("");
    let statusFilter = $state<"all" | "approved" | "hidden">("all");
    let ratingFilter = $state<number>(0);
    let notification = $state<{ type: "success" | "error"; message: string } | null>(null);

    function showNotification(message: string, type: "success" | "error" = "success") {
        notification = { type, message };
        setTimeout(() => {
            if (notification?.message === message) {
                notification = null;
            }
        }, 4000);
    }

    async function fetchReviews() {
        isLoading = true;
        try {
            const res = await apiFetch("/api/reviews");
            if (res.ok) {
                const data = await res.json();
                reviews = data.reviews || [];
            } else {
                console.error("Erreur chargement avis:", res.status);
                showNotification("Impossible de charger les avis (" + res.status + ")", "error");
            }
        } catch (e: any) {
            console.error("Erreur fetchReviews:", e);
            showNotification("Erreur réseau : " + (e?.message || "Impossible de contacter l'API"), "error");
        } finally {
            isLoading = false;
        }
    }

    async function toggleApprove(review: Review) {
        isActionLoading = review.id;
        try {
            const res = await apiFetch(`/api/reviews/${review.id}/approve`, {
                method: "PATCH",
            });
            if (res.ok) {
                const updated = await res.json();
                review.is_approved = updated.is_approved;
                showNotification(
                    review.is_approved ? "Avis publié sur le site" : "Avis masqué du site",
                    "success"
                );
            } else {
                showNotification("Échec du changement de statut", "error");
            }
        } catch (e: any) {
            console.error("Erreur toggleApprove:", e);
            showNotification("Erreur de connexion", "error");
        } finally {
            isActionLoading = null;
        }
    }

    async function deleteReview(id: number) {
        if (!confirm("Voulez-vous vraiment supprimer cet avis définitivement ?")) return;
        isActionLoading = id;
        try {
            const res = await apiFetch(`/api/reviews/${id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                reviews = reviews.filter((r) => r.id !== id);
                showNotification("Avis supprimé avec succès", "success");
            } else {
                showNotification("Échec de la suppression de l'avis", "error");
            }
        } catch (e: any) {
            console.error("Erreur deleteReview:", e);
            showNotification("Erreur de connexion", "error");
        } finally {
            isActionLoading = null;
        }
    }

    onMount(() => {
        fetchReviews();
    });

    // Filtres
    let filteredReviews = $derived(
        reviews.filter((r) => {
            if (statusFilter === "approved" && !r.is_approved) return false;
            if (statusFilter === "hidden" && r.is_approved) return false;
            if (ratingFilter > 0 && r.rating !== ratingFilter) return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchName = r.author_name?.toLowerCase().includes(q);
                const matchCity = r.city?.toLowerCase().includes(q);
                const matchTitle = r.title?.toLowerCase().includes(q);
                const matchComment = r.comment?.toLowerCase().includes(q);
                if (!matchName && !matchCity && !matchTitle && !matchComment) return false;
            }

            return true;
        })
    );

    // Statistiques globales
    let totalCount = $derived(reviews.length);
    let approvedCount = $derived(reviews.filter((r) => r.is_approved).length);
    let hiddenCount = $derived(reviews.filter((r) => !r.is_approved).length);
    let averageRating = $derived(
        reviews.length > 0
            ? (reviews.reduce((acc, curr) => acc + curr.rating, 0) / reviews.length).toFixed(1)
            : "0.0"
    );

    function formatDate(dateStr: string): string {
        if (!dateStr) return "-";
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch {
            return dateStr;
        }
    }
</script>

<div class="space-y-6 font-mono">
    <!-- Notification Toast -->
    {#if notification}
        <div class="fixed top-6 right-6 z-50 animate-bounce">
            <div
                class="px-4 py-3 border-2 border-black font-bold text-xs shadow-[4px_4px_0px_0px_#000] flex items-center gap-2 {notification.type === 'success' ? 'bg-[#86E2D5] text-black' : 'bg-[#FFAEC1] text-black'}"
            >
                <span class="material-symbols-outlined text-[18px]">
                    {notification.type === 'success' ? 'check_circle' : 'error'}
                </span>
                <span>{notification.message}</span>
            </div>
        </div>
    {/if}

    <!-- Header Section -->
    <div class="retro-card-yellow p-6 border-3 border-black shadow-[6px_6px_0px_0px_#000]">
        <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div class="space-y-1">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="retro-badge bg-black text-white text-[11px] px-2 py-0.5">MODÉRATION // CLIENTS</span>
                    <span class="retro-badge bg-[#86E2D5] text-black text-[11px] font-black">DAISY BROCANTE</span>
                </div>
                <h1 class="text-2xl sm:text-3xl font-black uppercase tracking-tight text-black flex items-center gap-2.5">
                    <span class="material-symbols-outlined text-3xl">reviews</span>
                    Avis & Témoignages Clients
                </h1>
                <p class="text-xs text-black/80 font-medium max-w-xl">
                    Supervision, publication et modération des avis laissés sur le site web Daisy Brocante. Les avis approuvés sont visibles en page d'accueil et sur la page dédiée.
                </p>
            </div>

            <div class="flex items-center gap-2 w-full lg:w-auto">
                <button
                    onclick={fetchReviews}
                    disabled={isLoading}
                    class="retro-btn bg-white hover:bg-[#86E2D5] text-xs font-black py-2.5 px-4 shadow-[3px_3px_0px_0px_#000] flex items-center gap-2"
                >
                    <span class="material-symbols-outlined text-[16px] {isLoading ? 'animate-spin' : ''}">refresh</span>
                    <span>Actualiser</span>
                </button>
            </div>
        </div>
    </div>

    <!-- Stats Bar -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-white border-2 border-black p-4 shadow-[3px_3px_0px_0px_#000]">
            <div class="text-[10px] uppercase font-bold text-black/60 flex items-center justify-between">
                <span>Total Avis</span>
                <span class="material-symbols-outlined text-sm">forum</span>
            </div>
            <div class="text-2xl sm:text-3xl font-black text-black mt-1">{totalCount}</div>
            <div class="text-[10px] text-black/50 mt-1">Collectés depuis le site</div>
        </div>

        <div class="bg-[#FFF394] border-2 border-black p-4 shadow-[3px_3px_0px_0px_#000]">
            <div class="text-[10px] uppercase font-bold text-black/60 flex items-center justify-between">
                <span>Note Moyenne</span>
                <span class="material-symbols-outlined text-sm">star</span>
            </div>
            <div class="text-2xl sm:text-3xl font-black text-black mt-1 flex items-baseline gap-1.5">
                <span>{averageRating}</span>
                <span class="text-xs font-bold text-black/60">/ 5</span>
            </div>
            <div class="text-[10px] text-black/60 mt-1">Calculée sur l'ensemble des avis</div>
        </div>

        <div class="bg-[#86E2D5] border-2 border-black p-4 shadow-[3px_3px_0px_0px_#000]">
            <div class="text-[10px] uppercase font-bold text-black/60 flex items-center justify-between">
                <span>En Ligne (Approuvés)</span>
                <span class="material-symbols-outlined text-sm">visibility</span>
            </div>
            <div class="text-2xl sm:text-3xl font-black text-black mt-1">{approvedCount}</div>
            <div class="text-[10px] text-black/60 mt-1">Visibles par les acheteurs</div>
        </div>

        <div class="bg-[#FFAEC1] border-2 border-black p-4 shadow-[3px_3px_0px_0px_#000]">
            <div class="text-[10px] uppercase font-bold text-black/60 flex items-center justify-between">
                <span>Masqués / En attente</span>
                <span class="material-symbols-outlined text-sm">visibility_off</span>
            </div>
            <div class="text-2xl sm:text-3xl font-black text-black mt-1">{hiddenCount}</div>
            <div class="text-[10px] text-black/60 mt-1">Non affichés sur le site</div>
        </div>
    </div>

    <!-- Filters & Search Bar -->
    <div class="bg-white border-2 border-black p-4 shadow-[3px_3px_0px_0px_#000] flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div class="relative flex-1">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-black/40 text-base">search</span>
            <input
                type="text"
                bind:value={searchQuery}
                placeholder="Rechercher par client, ville, mot-clé dans l'avis..."
                class="w-full pl-9 pr-3 py-2 text-xs border-2 border-black bg-[#F6F4EE] focus:bg-white focus:outline-none focus:shadow-[2px_2px_0px_0px_#000] font-sans"
            />
        </div>

        <!-- Filter Status -->
        <div class="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
            <button
                onclick={() => (statusFilter = "all")}
                class="retro-btn py-1.5 px-3 text-[11px] whitespace-nowrap {statusFilter === 'all' ? '!bg-black text-white' : 'bg-white'}"
            >
                Tous ({totalCount})
            </button>
            <button
                onclick={() => (statusFilter = "approved")}
                class="retro-btn py-1.5 px-3 text-[11px] whitespace-nowrap {statusFilter === 'approved' ? '!bg-[#86E2D5] text-black' : 'bg-white'}"
            >
                Publiés ({approvedCount})
            </button>
            <button
                onclick={() => (statusFilter = "hidden")}
                class="retro-btn py-1.5 px-3 text-[11px] whitespace-nowrap {statusFilter === 'hidden' ? '!bg-[#FFAEC1] text-black' : 'bg-white'}"
            >
                Masqués ({hiddenCount})
            </button>
        </div>

        <!-- Filter Rating -->
        <select
            bind:value={ratingFilter}
            class="text-xs border-2 border-black py-2 px-3 bg-[#F6F4EE] focus:outline-none font-bold uppercase"
        >
            <option value={0}>Toutes les notes</option>
            <option value={5}>5 étoiles ★★★★★</option>
            <option value={4}>4 étoiles ★★★★☆</option>
            <option value={3}>3 étoiles ★★★☆☆</option>
            <option value={2}>2 étoiles ★★☆☆☆</option>
            <option value={1}>1 étoile ★☆☆☆☆</option>
        </select>
    </div>

    <!-- Reviews Content List -->
    {#if isLoading}
        <div class="p-12 text-center bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000]">
            <div class="inline-block animate-spin text-3xl mb-2">
                <span class="material-symbols-outlined text-4xl">progress_activity</span>
            </div>
            <p class="font-bold text-sm uppercase">Chargement des avis...</p>
        </div>
    {:else if filteredReviews.length === 0}
        <div class="p-12 text-center bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] space-y-3">
            <span class="material-symbols-outlined text-5xl text-black/30">reviews</span>
            <h3 class="text-base font-black uppercase">Aucun avis trouvé</h3>
            <p class="text-xs text-black/60 max-w-sm mx-auto">
                {searchQuery || statusFilter !== 'all' || ratingFilter !== 0
                    ? "Aucun avis ne correspond à vos filtres actuels."
                    : "Aucun avis n'a encore été déposé par les clients."}
            </p>
            {#if searchQuery || statusFilter !== 'all' || ratingFilter !== 0}
                <button
                    onclick={() => {
                        searchQuery = "";
                        statusFilter = "all";
                        ratingFilter = 0;
                    }}
                    class="retro-btn bg-[#BFD7FE] text-xs py-1.5 px-3"
                >
                    Réinitialiser les filtres
                </button>
            {/if}
        </div>
    {:else}
        <div class="space-y-4">
            {#each filteredReviews as review (review.id)}
                <div
                    class="border-2 border-black bg-white shadow-[4px_4px_0px_0px_#000] transition-all duration-150 {review.is_approved ? 'border-l-8 border-l-[#86E2D5]' : 'border-l-8 border-l-[#FFAEC1]'}"
                >
                    <!-- Review Topbar -->
                    <div class="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-black/10 bg-[#FAF9F5]">
                        <div class="flex items-center gap-3 flex-wrap">
                            <!-- Star Rating -->
                            <div class="flex items-center gap-0.5 bg-black px-2.5 py-1 text-[#FFD166]">
                                {#each Array(5) as _, i}
                                    <span class="material-symbols-outlined text-[15px] {i < review.rating ? 'fill-current' : 'text-zinc-600'}">
                                        star
                                    </span>
                                {/each}
                                <span class="text-white font-mono font-bold text-xs ml-1.5">{review.rating}/5</span>
                            </div>

                            <!-- Author Name & Location -->
                            <div class="flex items-center gap-2">
                                <span class="font-black text-sm uppercase text-black">{review.author_name}</span>
                                {#if review.city}
                                    <span class="text-xs text-black/60 font-medium">({review.city})</span>
                                {/if}
                            </div>

                            <!-- Verified Badge -->
                            {#if review.is_verified}
                                <span class="retro-badge bg-[#86E2D5] text-black text-[10px] py-0.5 flex items-center gap-1 font-black">
                                    <span class="material-symbols-outlined text-[13px]">verified</span>
                                    Client Vérifié
                                </span>
                            {/if}

                            <!-- Status Badge -->
                            {#if review.is_approved}
                                <span class="retro-badge bg-[#86E2D5] text-black text-[10px] py-0.5 font-black">
                                    ● En ligne
                                </span>
                            {:else}
                                <span class="retro-badge bg-[#FFAEC1] text-black text-[10px] py-0.5 font-black">
                                    ○ Masqué
                                </span>
                            {/if}
                        </div>

                        <!-- Date -->
                        <div class="text-[11px] text-black/60 flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-[14px]">schedule</span>
                            <span>{formatDate(review.created_at)}</span>
                        </div>
                    </div>

                    <!-- Review Body -->
                    <div class="p-4 sm:p-5 space-y-2">
                        {#if review.title}
                            <h4 class="font-black text-sm uppercase text-black">« {review.title} »</h4>
                        {/if}
                        <p class="text-xs sm:text-sm text-black/90 font-sans leading-relaxed whitespace-pre-line">
                            {review.comment}
                        </p>
                        {#if review.user_id}
                            <div class="pt-2 text-[10px] text-black/40 font-mono">
                                ID Clerk: <span class="underline">{review.user_id}</span>
                            </div>
                        {/if}
                    </div>

                    <!-- Action Footer -->
                    <div class="px-4 py-3 bg-[#F6F4EE] border-t-2 border-black flex items-center justify-between gap-3">
                        <div class="text-[11px] text-black/60 font-mono">
                            Réf avis : <span class="font-bold">#{review.id}</span>
                        </div>

                        <div class="flex items-center gap-2">
                            <!-- Toggle Approve/Hide Button -->
                            <button
                                onclick={() => toggleApprove(review)}
                                disabled={isActionLoading === review.id}
                                class="retro-btn py-1.5 px-3 text-xs font-black shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 {review.is_approved ? 'bg-[#FFAEC1] hover:bg-white' : 'bg-[#86E2D5] hover:bg-white'}"
                            >
                                <span class="material-symbols-outlined text-[15px]">
                                    {review.is_approved ? 'visibility_off' : 'visibility'}
                                </span>
                                <span>{review.is_approved ? 'Masquer' : 'Publier'}</span>
                            </button>

                            <!-- Delete Button -->
                            <button
                                onclick={() => deleteReview(review.id)}
                                disabled={isActionLoading === review.id}
                                class="retro-btn bg-white hover:bg-[#FFAEC1] text-xs font-black py-1.5 px-3 shadow-[2px_2px_0px_0px_#000] text-red-600 hover:text-black flex items-center gap-1"
                                title="Supprimer définitivement"
                            >
                                <span class="material-symbols-outlined text-[15px]">delete</span>
                                <span class="hidden sm:inline">Supprimer</span>
                            </button>
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>
