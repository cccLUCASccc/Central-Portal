<script lang="ts">
  import { channels } from "../../../lib/channels";
</script>

<section class="space-y-8 font-mono" aria-labelledby="channels-title">
  <header class="flex flex-col gap-3 border-b-2 border-black pb-6">
    <div>
      <h1 id="channels-title" class="text-3xl font-black uppercase leading-tight tracking-tight text-black sm:text-4xl">Canaux de vente</h1>
      <p class="mt-2 max-w-2xl text-sm leading-relaxed text-black/65">Accédez directement à vos canaux de vente.</p>
    </div>
  </header>

  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
    {#each channels as channel (channel.href)}
      <a
        href={channel.href}
        class="group flex min-h-48 flex-col border-2 border-black bg-white p-5 shadow-[4px_4px_0px_0px_#000] transition-transform hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#000] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-black"
        aria-label={`Ouvrir ${channel.name}`}
      >
        <div class="mb-5 flex items-start justify-between gap-3">
          <span class={`grid h-12 w-12 place-items-center border-2 border-black ${channel.tint}`}>
            <span class="material-symbols-outlined text-2xl" aria-hidden="true">{channel.icon}</span>
          </span>
        </div>
        <div class="mt-auto flex items-end justify-between gap-4">
          <div>
            <h2 class="text-lg font-black uppercase leading-tight text-black">{channel.name}</h2>
            <p class="mt-2 max-w-sm text-xs leading-relaxed text-black/65">{channel.description}</p>
          </div>
          <span class="material-symbols-outlined shrink-0 text-xl transition-transform group-hover:translate-x-1" aria-hidden="true">arrow_forward</span>
        </div>
      </a>
    {/each}
  </div>
</section>