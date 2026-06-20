<script lang="ts">
    import { apiFetch } from "../../../lib/api";
    import PaginationComponent from "../atoms/Pagination.svelte";
    import type { Pagination } from "../../../type";

    // Structure locale pour typage
    interface BlogPost {
        id: number;
        title: string;
        theme: string;
        summary: string;
        content: string;
        cover_image: string;
        status: string;
        created_at: string;
    }

    interface Props {
        apiUrl: string;
        posts: BlogPost[];
        pagination?: Pagination;
    }

    let { apiUrl, posts: initialPosts, pagination: initialPagination }: Props = $props();

    // États locaux réactifs
    let currentPosts = $state(initialPosts);
    let currentPagination = $state(initialPagination);
    let isLoading = $state(false);
    let isGenerating = $state(false);
    let activePreviewPost = $state<BlogPost | null>(null);
    let message = $state({ text: "", type: "" }); // Pour afficher des retours (succès/erreur)

    function showMessage(text: string, type: "success" | "error" = "success") {
        message = { text, type };
        setTimeout(() => {
            message = { text: "", type: "" };
        }, 5000);
    }

    // Charger les articles d'une page spécifique
    async function fetchPosts(page = 1) {
        if (typeof window === 'undefined') return;
        isLoading = true;
        try {
            const response = await apiFetch(`${apiUrl}/api/blog?page=${page}&limit=10`);
            if (response.ok) {
                const result = await response.json();
                currentPosts = result.data || [];
                currentPagination = result.pagination;
            } else {
                showMessage("Impossible de charger les articles", "error");
            }
        } catch (e) {
            console.error("❌ Erreur chargement articles :", e);
            showMessage("Erreur de connexion", "error");
        } finally {
            isLoading = false;
        }
    }

    // Déclencher la génération d'un article avec Gemini
    async function generateArticle() {
        if (isGenerating) return;
        isGenerating = true;
        showMessage("L'IA Gemini rédige l'article et Imagen génère l'illustration... Cela peut prendre jusqu'à 30 secondes.", "success");
        
        try {
            const response = await apiFetch(`${apiUrl}/api/blog/generate`, {
                method: 'POST'
            });
            
            if (response.ok) {
                const newPost = await response.json();
                showMessage(`Nouvel article créé avec succès : "${newPost.title}"`, "success");
                await fetchPosts(1); // Revenir à la page 1 pour afficher l'article en premier
            } else {
                const errResult = await response.json();
                showMessage(errResult.error || "Une erreur est survenue lors de la génération", "error");
            }
        } catch (e) {
            console.error("❌ Erreur génération :", e);
            showMessage("Erreur de connexion avec le serveur", "error");
        } finally {
            isGenerating = false;
        }
    }

    // Supprimer un article
    async function deleteArticle(id: number) {
        if (!confirm("Êtes-vous sûr de vouloir supprimer cet article de blog définitivement ?")) return;
        
        isLoading = true;
        try {
            const response = await apiFetch(`${apiUrl}/api/blog/${id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                showMessage("Article supprimé avec succès", "success");
                await fetchPosts(currentPagination?.current_page || 1);
            } else {
                showMessage("Impossible de supprimer l'article", "error");
            }
        } catch (e) {
            console.error("❌ Erreur suppression :", e);
            showMessage("Erreur de connexion", "error");
        } finally {
            isLoading = false;
        }
    }

    // Publier un article
    async function publishArticle(id: number) {
        isLoading = true;
        try {
            const response = await apiFetch(`${apiUrl}/api/blog/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: "published" })
            });
            
            if (response.ok) {
                showMessage("Article publié avec succès sur le site !", "success");
                await fetchPosts(currentPagination?.current_page || 1);
            } else {
                showMessage("Impossible de publier l'article", "error");
            }
        } catch (e) {
            console.error("❌ Erreur publication :", e);
            showMessage("Erreur de connexion", "error");
        } finally {
            isLoading = false;
        }
    }

    function handlePageChange(page: number) {
        fetchPosts(page);
    }
</script>

<div class="flex flex-col gap-6 w-full max-w-7xl mx-auto">
    <!-- Notifications/Alertes -->
    {#if message.text}
        <div class="toast toast-top toast-end z-50">
            <div class={`alert ${message.type === 'error' ? 'alert-error' : 'alert-success'} shadow-lg rounded-xl text-sm font-semibold`}>
                <div>
                    {#if message.type === 'error'}
                        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {:else}
                        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {/if}
                    <span>{message.text}</span>
                </div>
            </div>
        </div>
    {/if}

    <!-- Header Section -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-base-100 p-6 rounded-2xl shadow-sm border border-base-200">
        <div>
            <h1 class="text-3xl font-extrabold tracking-tight">Gestion du Blog</h1>
            <p class="text-base-content/60 mt-1">Générez et gérez les articles du blog créés automatiquement par Gemini.</p>
        </div>
        
        <div>
            <button 
                onclick={generateArticle}
                disabled={isGenerating || isLoading}
                class="btn btn-primary rounded-xl shadow-md hover:shadow-primary/30 transition-all px-6 gap-2"
            >
                {#if isGenerating}
                    <span class="loading loading-spinner loading-xs"></span>
                    Génération en cours...
                {:else}
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 21l3.097-4.13c1.554-.267 2.879-1.25 3.593-2.613L16.2 13h1.8a.75.75 0 00.592-1.21l-3.6-4.8A.75.75 0 0013.2 7h-1.8l-1.07 1.606A6.978 6.978 0 009.813 15.904z" /><path stroke-linecap="round" stroke-linejoin="round" d="M19 10.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" /></svg>
                    Rédiger un article (Gemini)
                {/if}
            </button>
        </div>
    </div>

    <!-- Main List Container -->
    <div class="relative bg-base-100 rounded-2xl shadow-sm border border-base-200 overflow-hidden">
        {#if isLoading || isGenerating}
            <div class="absolute inset-0 bg-base-100/50 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center gap-4 py-20 min-h-[300px]">
                <span class="loading loading-spinner loading-lg text-primary"></span>
                {#if isGenerating}
                    <p class="text-sm font-medium text-base-content/75 animate-pulse">Gemini est en train de rédiger votre article...</p>
                {/if}
            </div>
        {/if}

        <div class="overflow-x-auto min-h-[250px]">
            <table class="table w-full">
                <thead>
                    <tr class="text-base-content/70">
                        <th>Couverture</th>
                        <th>Titre de l'article</th>
                        <th>Thématique</th>
                        <th>Date de création</th>
                        <th>Statut</th>
                        <th class="text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {#if currentPosts.length === 0}
                        <tr>
                            <td colspan="6" class="text-center py-16 text-base-content/50 italic">
                                Aucun article de blog disponible. Cliquez sur le bouton pour en générer un premier !
                            </td>
                        </tr>
                    {:else}
                        {#each currentPosts as post (post.id)}
                            <tr class="hover:bg-base-200/40 transition-colors">
                                <td class="w-24">
                                    <div class="avatar">
                                        <div class="mask mask-squircle w-16 h-10 bg-base-300">
                                            {#if post.cover_image}
                                                <img src={post.cover_image} alt={post.title} class="object-cover" />
                                            {:else}
                                                <div class="flex items-center justify-center h-full w-full bg-base-300 text-base-content/40 font-bold text-[10px]">NO IMG</div>
                                            {/if}
                                        </div>
                                    </div>
                                </td>
                                <td class="font-bold max-w-xs truncate">
                                    <div class="flex flex-col">
                                        <span>{post.title}</span>
                                        <span class="text-xs font-normal text-base-content/50 max-w-[300px] truncate">{post.summary}</span>
                                    </div>
                                </td>
                                <td>
                                    <span class="badge badge-ghost font-medium text-xs py-2 px-3 rounded-lg border border-base-300">{post.theme}</span>
                                </td>
                                <td class="text-sm text-base-content/70">
                                    {new Date(post.created_at).toLocaleDateString('fr-FR', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric'
                                    })}
                                </td>
                                <td>
                                    {#if post.status === 'published'}
                                        <span class="badge badge-success badge-sm gap-1.5 font-bold uppercase tracking-wider text-[9px] py-2 px-2.5">
                                            <span class="h-1.5 w-1.5 rounded-full bg-current"></span>
                                            Publié
                                        </span>
                                    {:else}
                                        <span class="badge badge-warning badge-sm gap-1.5 font-bold uppercase tracking-wider text-[9px] py-2 px-2.5">
                                            <span class="h-1.5 w-1.5 rounded-full bg-current"></span>
                                            Brouillon
                                        </span>
                                    {/if}
                                </td>
                                <td class="text-right">
                                    <div class="flex justify-end gap-2">
                                        <!-- Lire/Aperçu -->
                                        <button 
                                            onclick={() => activePreviewPost = post}
                                            disabled={isLoading || isGenerating}
                                            class="btn btn-ghost btn-square btn-sm text-info rounded-lg hover:bg-info/10"
                                            title="Lire l'article"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        </button>

                                        <!-- Publier (si draft) -->
                                        {#if post.status === 'draft'}
                                            <button 
                                                onclick={() => publishArticle(post.id)}
                                                disabled={isLoading || isGenerating}
                                                class="btn btn-ghost btn-square btn-sm text-success rounded-lg hover:bg-success/10"
                                                title="Publier sur le site"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            </button>
                                        {/if}

                                        <!-- Supprimer -->
                                        <button 
                                            onclick={() => deleteArticle(post.id)}
                                            disabled={isLoading || isGenerating}
                                            class="btn btn-ghost btn-square btn-sm text-error rounded-lg hover:bg-error/10"
                                            title="Supprimer définitivement"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        {/each}
                    {/if}
                </tbody>
            </table>
        </div>
    </div>

    <!-- Pagination -->
    {#if currentPagination && currentPagination.total_pages > 1}
        <PaginationComponent pagination={currentPagination} onPageChange={handlePageChange} />
    {/if}
</div>

<!-- Modal de Prévisualisation de l'article -->
{#if activePreviewPost}
    <div class="modal modal-open z-50">
        <div class="modal-box max-w-4xl rounded-2xl bg-base-100 border border-base-300 shadow-2xl p-6 relative">
            <button 
                onclick={() => activePreviewPost = null}
                class="btn btn-sm btn-circle btn-ghost absolute right-4 top-4"
            >✕</button>

            {#if activePreviewPost.cover_image}
                <div class="w-full h-56 rounded-xl overflow-hidden mb-6 bg-base-200 border border-base-200">
                    <img src={activePreviewPost.cover_image} alt={activePreviewPost.title} class="w-full h-full object-cover" />
                </div>
            {/if}

            <div class="flex items-center gap-3 mb-3">
                <span class="badge badge-outline border-base-300 text-xs font-semibold px-3 py-2 rounded-lg">{activePreviewPost.theme}</span>
                <span class="text-xs text-base-content/50">{new Date(activePreviewPost.created_at).toLocaleDateString('fr-FR')}</span>
                {#if activePreviewPost.status === 'published'}
                    <span class="badge badge-success badge-sm font-bold text-[9px]">PUBLIÉ</span>
                {:else}
                    <span class="badge badge-warning badge-sm font-bold text-[9px]">BROUILLON</span>
                {/if}
            </div>

            <h2 class="text-3xl font-serif font-black tracking-tight mb-4 text-base-content leading-tight">{activePreviewPost.title}</h2>
            <p class="text-base-content/75 italic border-l-4 border-primary/40 pl-4 mb-6 text-sm">{activePreviewPost.summary}</p>

            <div class="divider"></div>

            <!-- Contenu HTML généré -->
            <div class="prose prose-sm max-w-none text-base-content/90 leading-relaxed font-sans mt-4">
                {@html activePreviewPost.content}
            </div>

            <div class="modal-action mt-8 pt-4 border-t border-base-200 flex gap-2">
                {#if activePreviewPost.status === 'draft'}
                    <button 
                        onclick={async () => {
                            const id = activePreviewPost.id;
                            activePreviewPost = null;
                            await publishArticle(id);
                        }}
                        class="btn btn-success rounded-xl px-6"
                    >
                        Publier cet article
                    </button>
                {/if}
                <button onclick={() => activePreviewPost = null} class="btn btn-outline rounded-xl">Fermer</button>
            </div>
        </div>
        <div class="modal-backdrop bg-black/60 backdrop-blur-xs" onclick={() => activePreviewPost = null}></div>
    </div>
{/if}
