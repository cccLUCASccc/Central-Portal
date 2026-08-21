<script lang="ts">
  import { onMount } from 'svelte';

  let theme = $state('corporate');

  onMount(() => {
    const savedTheme = localStorage.getItem('theme') || 'corporate';
    theme = savedTheme;
    applyTheme(theme);
  });

  function applyTheme(newTheme: string) {
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    theme = newTheme;
  }

  function toggleTheme() {
    const newTheme = theme === 'corporate' ? 'dracula' : 'corporate';
    applyTheme(newTheme);
  }
</script>

<button 
  class="retro-btn px-2.5 py-1.5 text-xs bg-white hover:bg-[#FFE600] flex items-center gap-1.5" 
  onclick={toggleTheme} 
  title="Basculer le thème rétro"
  aria-label="Changer de thème"
>
  {#if theme === 'corporate'}
    <span class="text-sm">☀️</span>
    <span class="hidden sm:inline font-mono font-bold text-[11px]">JOUR</span>
  {:else}
    <span class="text-sm">🌙</span>
    <span class="hidden sm:inline font-mono font-bold text-[11px]">NUIT</span>
  {/if}
</button>
