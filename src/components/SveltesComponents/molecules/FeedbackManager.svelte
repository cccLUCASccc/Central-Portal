<script lang="ts">
    import { onMount } from "svelte";
    import { apiFetch } from "../../../lib/api";

    interface Feedback {
        id: number;
        type: "bug" | "suggestion";
        category: string;
        title: string;
        description: string;
        author_name: string;
        author_email: string;
        user_id: string;
        status: "new" | "in_progress" | "planned" | "resolved";
        created_at: string;
    }

    let items = $state<Feedback[]>([]);
    let isLoading = $state(true);
    let isActionLoading = $state<number | null>(null);
    let searchQuery = $state("");
    let typeFilter = $state<"all" | "bug" | "suggestion">("all");
    let statusFilter = $state<"all" | "new" | "in_progress" | "planned" | "resolved">("all");
    let notification = $state<{ type: "success" | "error"; message: string } | null>(null);

    function showNotification(message: string, type: "success" | "error" = "success") {
        notification = { type, message };
        setTimeout(() => {
            if (notification?.message === message) {
                notification = null;
            }
        }, 4000);
    }

    async function fetchFeedbacks() {
        isLoading = true;
        try {
            const res = await apiFetch("/api/feedback");
            if (res.ok) {
                items = await res.json();
            } else {
                console.error("Erreur chargement feedback:", res.status);
                showNotification("Impossible de charger les retours (" + res.status + ")", "error");
            }
        } catch (e: any) {
            console.error("Erreur fetchFeedbacks:", e);
            showNotification("Erreur réseau : " + (e?.message || "Impossible de contacter l'API"), "error");
        } finally {
            isLoading = false;
        }
    }

    async function updateStatus(item: Feedback, newStatus: "new" | "in_progress" | "planned" | "resolved") {
        if (item.status === newStatus) return;
        isActionLoading = item.id;
        try {
            const res = await apiFetch(`/api/feedback/${item.id}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
                item.status = newStatus;
                showNotification(`Statut du ticket #${item.id} mis à jour : ${getStatusLabel(newStatus)}`, "success");
            } else {
                showNotification("Échec du changement de statut", "error");
            }
        } catch (e: any) {
            console.error("Erreur updateStatus:", e);
            showNotification("Erreur de connexion", "error");
        } finally {
            isActionLoading = null;
        }
    }

    async function deleteFeedback(id: number) {
        if (!confirm("Supprimer ce ticket de retour définitivement ?")) return;
        isActionLoading = id;
        try {
            const res = await apiFetch(`/api/feedback/${id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                items = items.filter((i) => i.id !== id);
                showNotification("Ticket supprimé avec succès", "success");
            } else {
                showNotification("Échec de la suppression", "error");
            }
        } catch (e: any) {
            console.error("Erreur deleteFeedback:", e);
            showNotification("Erreur de connexion", "error");
        } finally {
            isActionLoading = null;
        }
    }

    onMount(() => {
        fetchFeedbacks();
    });

    // Filtres
    let filteredItems = $derived(
        items.filter((item) => {
            if (typeFilter !== "all" && item.type !== typeFilter) return false;
            if (statusFilter !== "all" && item.status !== statusFilter) return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchTitle = item.title?.toLowerCase().includes(q);
                const matchDesc = item.description?.toLowerCase().includes(q);
                const matchName = item.author_name?.toLowerCase().includes(q);
                const matchEmail = item.author_email?.toLowerCase().includes(q);
                const matchCat = item.category?.toLowerCase().includes(q);
                if (!matchTitle && !matchDesc && !matchName && !matchEmail && !matchCat) return false;
            }

            return true;
        })
    );

    // Statistiques
    let totalCount = $derived(items.length);
    let bugCount = $derived(items.filter((i) => i.type === "bug").length);
    let suggestionCount = $derived(items.filter((i) => i.type === "suggestion").length);
    let newCount = $derived(items.filter((i) => i.status === "new").length);
    let resolvedCount = $derived(items.filter((i) => i.status === "resolved").length);

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

    function getStatusLabel(status: string): string {
        switch (status) {
            case "new":
                return "Nouveau";
            case "in_progress":
                return "En cours";
            case "planned":
                return "Planifié";
            case "resolved":
                return "Résolu";
            default:
                return status;
        }
    }

    function getStatusBg(status: string): string {
        switch (status) {
            case "new":
                return "bg-[#BFD7FE] text-black";
            case "in_progress":
                return "bg-[#FFF394] text-black";
            case "planned":
                return "bg-[#FFD2A6] text-black";
            case "resolved":
                return "bg-[#86E2D5] text-black";
            default:
                return "bg-white text-black";
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
    <div class="retro-card-rose p-6 border-3 border-black shadow-[6px_6px_0px_0px_#000]">
        <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div class="space-y-1">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="retro-badge bg-black text-white text-[11px] px-2 py-0.5">TICKETING // QUALITÉ</span>
                    <span class="retro-badge bg-[#86E2D5] text-black text-[11px] font-black">DAISY BROCANTE</span>
                </div>
                <h1 class="text-2xl sm:text-3xl font-black uppercase tracking-tight text-black flex items-center gap-2.5">
                    <span class="material-symbols-outlined text-3xl">rate_review</span>
                    Boîte à Idées & Signalement de Bugs
                </h1>
                <p class="text-xs text-black/80 font-medium max-w-xl">
                    Centralisation des tickets soumis par les utilisateurs : signalement d'anomalies techniques (bugs) et propositions d'améliorations / nouvelles fonctionnalités.
                </p>
            </div>

            <div class="flex items-center gap-2 w-full lg:w-auto">
                <button
                    onclick={fetchFeedbacks}
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
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div class="bg-white border-2 border-black p-4 shadow-[3px_3px_0px_0px_#000]">
            <div class="text-[10px] uppercase font-bold text-black/60 flex items-center justify-between">
                <span>Total Tickets</span>
                <span class="material-symbols-outlined text-sm">assignment</span>
            </div>
            <div class="text-2xl sm:text-3xl font-black text-black mt-1">{totalCount}</div>
            <div class="text-[10px] text-black/50 mt-1">Tous types confondus</div>
        </div>

        <div class="bg-[#FFAEC1] border-2 border-black p-4 shadow-[3px_3px_0px_0px_#000]">
            <div class="text-[10px] uppercase font-bold text-black/60 flex items-center justify-between">
                <span>Bugs Signalés</span>
                <span class="material-symbols-outlined text-sm">bug_report</span>
            </div>
            <div class="text-2xl sm:text-3xl font-black text-black mt-1">{bugCount}</div>
            <div class="text-[10px] text-black/60 mt-1">Anomalies rapportées</div>
        </div>

        <div class="bg-[#FFD166] border-2 border-black p-4 shadow-[3px_3px_0px_0px_#000]">
            <div class="text-[10px] uppercase font-bold text-black/60 flex items-center justify-between">
                <span>Boîte à Idées</span>
                <span class="material-symbols-outlined text-sm">lightbulb</span>
            </div>
            <div class="text-2xl sm:text-3xl font-black text-black mt-1">{suggestionCount}</div>
            <div class="text-[10px] text-black/60 mt-1">Pistes d'amélioration</div>
        </div>

        <div class="bg-[#BFD7FE] border-2 border-black p-4 shadow-[3px_3px_0px_0px_#000]">
            <div class="text-[10px] uppercase font-bold text-black/60 flex items-center justify-between">
                <span>À Traiter (Nouveaux)</span>
                <span class="material-symbols-outlined text-sm">mark_email_unread</span>
            </div>
            <div class="text-2xl sm:text-3xl font-black text-black mt-1">{newCount}</div>
            <div class="text-[10px] text-black/60 mt-1">En attente de tri</div>
        </div>

        <div class="bg-[#86E2D5] border-2 border-black p-4 shadow-[3px_3px_0px_0px_#000]">
            <div class="text-[10px] uppercase font-bold text-black/60 flex items-center justify-between">
                <span>Résolus</span>
                <span class="material-symbols-outlined text-sm">task_alt</span>
            </div>
            <div class="text-2xl sm:text-3xl font-black text-black mt-1">{resolvedCount}</div>
            <div class="text-[10px] text-black/60 mt-1">Bugs fixés ou idées livrées</div>
        </div>
    </div>

    <!-- Filters & Search Bar -->
    <div class="bg-white border-2 border-black p-4 shadow-[3px_3px_0px_0px_#000] flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div class="relative flex-1">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-black/40 text-base">search</span>
            <input
                type="text"
                bind:value={searchQuery}
                placeholder="Rechercher par titre, description, auteur, email ou catégorie..."
                class="w-full pl-9 pr-3 py-2 text-xs border-2 border-black bg-[#F6F4EE] focus:bg-white focus:outline-none focus:shadow-[2px_2px_0px_0px_#000] font-sans"
            />
        </div>

        <!-- Filter Type -->
        <div class="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
            <button
                onclick={() => (typeFilter = "all")}
                class="retro-btn py-1.5 px-3 text-[11px] whitespace-nowrap {typeFilter === 'all' ? '!bg-black text-white' : 'bg-white'}"
            >
                Tous ({totalCount})
            </button>
            <button
                onclick={() => (typeFilter = "bug")}
                class="retro-btn py-1.5 px-3 text-[11px] whitespace-nowrap {typeFilter === 'bug' ? '!bg-[#FFAEC1] text-black' : 'bg-white'}"
            >
                Bugs ({bugCount})
            </button>
            <button
                onclick={() => (typeFilter = "suggestion")}
                class="retro-btn py-1.5 px-3 text-[11px] whitespace-nowrap {typeFilter === 'suggestion' ? '!bg-[#FFD166] text-black' : 'bg-white'}"
            >
                Idées ({suggestionCount})
            </button>
        </div>

        <!-- Filter Status -->
        <select
            bind:value={statusFilter}
            class="text-xs border-2 border-black py-2 px-3 bg-[#F6F4EE] focus:outline-none font-bold uppercase"
        >
            <option value="all">Tous les statuts</option>
            <option value="new">Nouveau ({newCount})</option>
            <option value="in_progress">En cours</option>
            <option value="planned">Planifié</option>
            <option value="resolved">Résolu ({resolvedCount})</option>
        </select>
    </div>

    <!-- Feedback Content List -->
    {#if isLoading}
        <div class="p-12 text-center bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000]">
            <div class="inline-block animate-spin text-3xl mb-2">
                <span class="material-symbols-outlined text-4xl">progress_activity</span>
            </div>
            <p class="font-bold text-sm uppercase">Chargement des retours...</p>
        </div>
    {:else if filteredItems.length === 0}
        <div class="p-12 text-center bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] space-y-3">
            <span class="material-symbols-outlined text-5xl text-black/30">rate_review</span>
            <h3 class="text-base font-black uppercase">Aucun retour trouvé</h3>
            <p class="text-xs text-black/60 max-w-sm mx-auto">
                {searchQuery || typeFilter !== 'all' || statusFilter !== 'all'
                    ? "Aucun ticket ne correspond à vos filtres actuels."
                    : "Aucun bug ni idée n'a encore été soumis."}
            </p>
            {#if searchQuery || typeFilter !== 'all' || statusFilter !== 'all'}
                <button
                    onclick={() => {
                        searchQuery = "";
                        typeFilter = "all";
                        statusFilter = "all";
                    }}
                    class="retro-btn bg-[#BFD7FE] text-xs py-1.5 px-3"
                >
                    Réinitialiser les filtres
                </button>
            {/if}
        </div>
    {:else}
        <div class="space-y-4">
            {#each filteredItems as item (item.id)}
                <div
                    class="border-2 border-black bg-white shadow-[4px_4px_0px_0px_#000] {item.type === 'bug' ? 'border-l-8 border-l-[#FFAEC1]' : 'border-l-8 border-l-[#FFD166]'}"
                >
                    <!-- Header Bar -->
                    <div class="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-black/10 bg-[#FAF9F5]">
                        <div class="flex items-center gap-2.5 flex-wrap">
                            <!-- Type Badge -->
                            {#if item.type === 'bug'}
                                <span class="retro-badge bg-[#FFAEC1] text-black text-xs py-0.5 font-black flex items-center gap-1">
                                    <span class="material-symbols-outlined text-[15px]">bug_report</span>
                                    Bug
                                </span>
                            {:else}
                                <span class="retro-badge bg-[#FFD166] text-black text-xs py-0.5 font-black flex items-center gap-1">
                                    <span class="material-symbols-outlined text-[15px]">lightbulb</span>
                                    Idée / Suggestion
                                </span>
                            {/if}

                            <!-- Category Badge -->
                            {#if item.category}
                                <span class="retro-badge bg-white border border-black text-[11px] py-0.5 text-black font-bold uppercase">
                                    {item.category}
                                </span>
                            {/if}

                            <!-- Current Status Badge -->
                            <span class="retro-badge {getStatusBg(item.status)} text-[11px] py-0.5 font-black uppercase">
                                ● {getStatusLabel(item.status)}
                            </span>
                        </div>

                        <!-- Date & Ticket ID -->
                        <div class="flex items-center gap-3 text-[11px] text-black/60 font-mono">
                            <span>Ticket <strong class="text-black">#{item.id}</strong></span>
                            <span>•</span>
                            <div class="flex items-center gap-1">
                                <span class="material-symbols-outlined text-[14px]">schedule</span>
                                <span>{formatDate(item.created_at)}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Content -->
                    <div class="p-4 sm:p-5 space-y-3">
                        <h3 class="text-base sm:text-lg font-black uppercase text-black">
                            {item.title}
                        </h3>

                        <div class="p-3.5 bg-[#F6F4EE] border border-black text-xs sm:text-sm text-black font-sans leading-relaxed whitespace-pre-line">
                            {item.description}
                        </div>

                        <!-- Author & Contact details -->
                        <div class="flex flex-wrap items-center gap-4 text-xs text-black/70 pt-1 font-mono">
                            <div class="flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-[16px] text-black">person</span>
                                <span class="font-bold text-black">{item.author_name || "Anonyme"}</span>
                            </div>

                            {#if item.author_email}
                                <div class="flex items-center gap-1.5">
                                    <span class="material-symbols-outlined text-[16px] text-black">mail</span>
                                    <a
                                        href={`mailto:${item.author_email}?subject=Suite%20%C3%A0%20votre%20retour%20Daisy%20Brocante%20(%23${item.id})`}
                                        class="text-blue-600 hover:underline font-medium"
                                    >
                                        {item.author_email}
                                    </a>
                                </div>
                            {/if}

                            {#if item.user_id}
                                <div class="text-[10px] text-black/40">
                                    Clerk: {item.user_id}
                                </div>
                            {/if}
                        </div>
                    </div>

                    <!-- Footer Controls -->
                    <div class="px-4 py-3 bg-[#EDE9DF] border-t-2 border-black flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <!-- Quick Status Switcher -->
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-[11px] font-black uppercase text-black/60">Passer au statut :</span>
                            <div class="flex items-center gap-1 flex-wrap">
                                {#each ["new", "in_progress", "planned", "resolved"] as st}
                                    <button
                                        onclick={() => updateStatus(item, st as any)}
                                        disabled={isActionLoading === item.id || item.status === st}
                                        class="retro-btn py-1 px-2 text-[10px] font-black {item.status === st ? '!bg-black text-white cursor-default' : 'bg-white hover:bg-[#86E2D5]'}"
                                    >
                                        {getStatusLabel(st)}
                                    </button>
                                {/each}
                            </div>
                        </div>

                        <!-- Delete Button -->
                        <button
                            onclick={() => deleteFeedback(item.id)}
                            disabled={isActionLoading === item.id}
                            class="retro-btn bg-white hover:bg-[#FFAEC1] text-xs font-black py-1.5 px-3 shadow-[2px_2px_0px_0px_#000] text-red-600 hover:text-black flex items-center gap-1 self-end sm:self-auto"
                            title="Supprimer ce ticket"
                        >
                            <span class="material-symbols-outlined text-[15px]">delete</span>
                            <span>Supprimer</span>
                        </button>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>
