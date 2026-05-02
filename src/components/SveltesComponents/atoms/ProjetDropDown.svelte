<script lang="ts">
    import type { Project } from "../../../type";
    import { projectStore } from "../../../store.svelte";

    interface Props {
        projets ?: Project[]
    }

    let { projets }:Props = $props()

    // Initialisation du store si vide
    if (!projectStore.selectedProject && projets && projets.length > 0) {
        projectStore.setSelectedProject(projets[0]);
    }
</script>

<ul tabindex="0" class="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-64 p-2 shadow-xl border border-base-200">
{#each projets as project (project.id)}
    <li>
    <button onclick={() => projectStore.setSelectedProject(project)} class="flex items-center gap-3 p-2 w-full text-left {projectStore.selectedProject?.id === project.id ? 'bg-primary/10 text-primary font-bold' : ''}">
    {#if project.images && project.images.length > 0}
            <div class="avatar">
            <div class="w-8 h-8 rounded-lg">
                <img src={project.images[0].url} alt={project.name} />
            </div>
            </div>
    {:else}
            <div class="w-8 h-8 rounded-lg bg-base-300 flex items-center justify-center text-xs font-bold uppercase">
            {project.name.charAt(0)}
            </div>
        
    {/if}
        <span class="font-medium">{project.name}</span>
        </button>
    </li>
{/each}
<div class="divider my-1 opacity-50"></div>
<li>
    <a href="/projets/add" class="flex items-center gap-3 p-2 text-primary font-medium hover:bg-primary/5">
        <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
        </div>
        <span>Ajouter un projet</span>
    </a>
</li>
{#if projets && projets.length === 0}
    <li><span class="text-gray-400 italic p-4 text-center">Aucun projet trouvé</span></li>
{/if}
</ul>