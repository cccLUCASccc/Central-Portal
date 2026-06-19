<script lang="ts">
    import { onMount } from "svelte";
    import { apiFetch } from "../../../lib/api";

    interface Props {
        apiUrl: string;
    }

    let { apiUrl }: Props = $props();

    let posts = $state<any[]>([]);
    let pagination = $state<any>(null);
    let currentPage = $state(1);

    let isLoading = $state(true);
    let isGenerating = $state(false);
    let errorMsg = $state("");
    let successMsg = $state("");

    async function loadPosts(page = 1) {
        isLoading = true;
        errorMsg = "";
        try {
            const response = await apiFetch(`${apiUrl}/api/blog?page=${page}&limit=10`);
            if (response.ok) {
                const result = await response.json();
                posts = result.data || [];
                pagination = result.pagination;
                currentPage = page;
            } else {
                errorMsg = "Erreur lors du chargement des articles.";
            }
        } catch (e: any) {
            errorMsg = "Erreur : " + e.message;
        } finally {
            isLoading = false;
        }
    }

    async function toggleStatus(post: any) {
        const newStatus = post.status === "published" ? "draft" : "published";
        try {
            const response = await apiFetch(`${apiUrl}/api/blog/${post.id}`, {
                method: "PATCH",
                body: JSON.stringify({ status: newStatus })
            });
            if (response.ok) {
                post.status = newStatus;
                successMsg = `Statut mis à jour : l'article est maintenant en ${newStatus === 'published' ? 'publié' : 'brouillon'}.`;
                setTimeout(() => successMsg = "", 3000);
            } else {
                alert("Erreur lors de la mise à jour du statut.");
            }
        } catch (e: any) {
            alert("Erreur : " + e.message);
        }
    }

    async function deletePost(id: number) {
        if (!confirm("Voulez-vous vraiment supprimer définitivement cet article ?")) return;
        try {
            const response = await apiFetch(`${apiUrl}/api/blog/${id}`, {
                method: "DELETE"
            });
            if (response.ok) {
                posts = posts.filter(p => p.id !== id);
                successMsg = "Article supprimé avec succès !";
                setTimeout(() => successMsg = "", 3000);
            } else {
                alert("Erreur lors de la suppression.");
            }
        } catch (e: any) {
            alert("Erreur : " + e.message);
        }
    }

    async function generatePost() {
        isGenerating = true;
        errorMsg = "";
        successMsg = "";
        try {
            const response = await apiFetch(`${apiUrl}/api/blog/generate`, {
                method: "POST"
            });
            if (response.ok) {
                const newPost = await response.json();
                successMsg = `✨ Nouvel article généré avec succès par l'IA : "${newPost.title}" !`;
                loadPosts(1);
            } else {
                const data = await response.json();
                errorMsg = "Échec de la génération : " + (data.error || "erreur inconnue");
            }
        } catch (e: any) {
            errorMsg = "Erreur : " + e.message;
        } finally {
            isGenerating = false;
        }
    }

    function formatDate(dateStr: string) {
        if (!dateStr) return "";
        const date = new Date(dateStr);
        return date.toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    onMount(() => {
        loadPosts();
    });
</script>

<div class="flex flex-col gap-6 w-full max-w-7xl mx-auto">
    <!-- Header -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-base-100 p-6 rounded-2xl shadow-sm border border-base-200">
        <div>
            <h1 class="text-3xl font-extrabold tracking-tight">Gestion du Blog IA</h1>
            <p class="text-base-content/60 mt-1">Consultez, modifiez et déclenchez la génération d'articles assistée par Gemini & Imagen.</p>
        </div>
        
        <div class="flex gap-3">
            <button 
                onclick={generatePost} 
                disabled={isGenerating}
                class="btn btn-primary rounded-xl shadow-md hover:shadow-primary/30 transition-all px-6"
            >
                {#if isGenerating}
                    <span class="loading loading-spinner loading-xs mr-2"></span>
                    Génération en cours...
                {:else}
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>
                    Générer un article par l'IA
                {/if}
            </button>
        </div>
    </div>

    <!-- Feedback messages -->
    {#if errorMsg}
        <div class="alert alert-error shadow-sm rounded-xl">
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>{errorMsg}</span>
        </div>
    {/if}

    {#if successMsg}
        <div class="alert alert-success shadow-sm rounded-xl">
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>{successMsg}</span>
        </div>
    {/if}

    <!-- Table Card -->
    <div class="card bg-base-100 shadow-xl border border-base-200 overflow-hidden">
        {#if isLoading}
            <div class="flex flex-col items-center justify-center p-20">
                <span class="loading loading-spinner loading-lg text-primary"></span>
                <p class="text-sm opacity-55 mt-4">Chargement des articles de blog...</p>
            </div>
        {:else if posts.length === 0}
            <div class="text-center py-20 bg-base-200/20">
                <div class="flex flex-col items-center gap-3">
                    <span class="text-5xl opacity-20">📝</span>
                    <p class="text-base-content/50 font-medium">Aucun article de blog disponible.</p>
                    <button onclick={generatePost} disabled={isGenerating} class="btn btn-primary btn-sm mt-2">
                        Générer le premier article
                    </button>
                </div>
            </div>
        {:else}
            <div class="overflow-x-auto">
                <table class="table table-zebra w-full">
                    <thead class="bg-base-200/50">
                        <tr>
                            <th>Article</th>
                            <th>Thème</th>
                            <th>Date de création</th>
                            <th class="text-center">Statut</th>
                            <th class="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each posts as post (post.id)}
                            <tr class="hover:bg-base-200/50 transition-colors group">
                                <td>
                                    <div class="flex items-center gap-4">
                                        <div class="avatar">
                                            <div class="mask mask-squircle w-16 h-16 bg-base-200 shadow-inner group-hover:scale-105 transition-transform overflow-hidden">
                                                {#if post.cover_image}
                                                    <img src={post.cover_image} alt={post.title} class="object-cover w-full h-full" />
                                                {:else}
                                                    <div class="flex items-center justify-center h-full text-[10px] opacity-40 font-bold uppercase">N/A</div>
                                                {/if}
                                            </div>
                                        </div>
                                        <div>
                                            <div class="font-bold text-base line-clamp-1">{post.title}</div>
                                            <div class="text-xs opacity-50 line-clamp-1 max-w-md">{post.summary}</div>
                                        </div>
                                    </div>
                                </td>
                                
                                <td>
                                    <span class="badge badge-info font-bold uppercase text-[9px] py-1.5 px-3">
                                        {post.theme || "Inconnu"}
                                    </span>
                                </td>

                                <td class="text-sm font-mono opacity-80">
                                    {formatDate(post.created_at)}
                                </td>

                                <td class="text-center">
                                    <button 
                                        onclick={() => toggleStatus(post)}
                                        class="btn btn-xs rounded-lg {post.status === 'published' ? 'btn-success' : 'btn-neutral'}"
                                    >
                                        {post.status === "published" ? "Publié" : "Brouillon"}
                                    </button>
                                </td>

                                <td class="text-right">
                                    <div class="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onclick={() => deletePost(post.id)}
                                            class="btn btn-error btn-outline btn-xs btn-square"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {/if}
    </div>

    <!-- Pagination -->
    {#if pagination && pagination.total_pages > 1}
        <div class="flex justify-center mt-4">
            <div class="join">
                <button 
                    disabled={currentPage === 1} 
                    onclick={() => loadPosts(currentPage - 1)} 
                    class="join-item btn btn-outline btn-sm"
                >
                    «
                </button>
                <button class="join-item btn btn-sm btn-active">Page {currentPage} / {pagination.total_pages}</button>
                <button 
                    disabled={currentPage === pagination.total_pages} 
                    onclick={() => loadPosts(currentPage + 1)} 
                    class="join-item btn btn-outline btn-sm"
                >
                    »
                </button>
            </div>
        </div>
    {/if}
</div>
