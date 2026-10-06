<script lang="ts">
  import { onMount } from "svelte";
  import { apiFetch } from "../../../lib/api";
  import { eventLabels, readSessionEvents, readSessionReplay, type AnalyticsSession, type SessionEvent } from "../../../lib/analytics";

  let { session, days }: { session: AnalyticsSession; days: number } = $props();
  let events = $state<SessionEvent[]>([]);
  let truncated = $state(false);
  let loading = $state(true);
  let error = $state("");
  let replayLoading = $state(false);
  let replayError = $state("");
  let embed = $state("");
  let sharingStatus = $state("");
  let confirmation = $state(false);
  let request: AbortController | undefined;
  let replayRequest: AbortController | undefined;

  async function load() {
    request?.abort();
    const current = new AbortController();
    request = current;
    loading = true;
    error = "";
    try {
      const result = await readSessionEvents(await apiFetch(`/api/users/analytics/sessions/${session.id}/events?days=${days}`, {
        signal: AbortSignal.any([current.signal, AbortSignal.timeout(35000)])
      }));
      if (result.session_id !== session.id) throw new Error("Le parcours reçu ne correspond pas à la session.");
      if (!current.signal.aborted) { events = result.events; truncated = result.truncated; }
    } catch (cause) {
      if (!current.signal.aborted) {
        console.error("Parcours PostHog :", cause);
        error = cause instanceof Error ? cause.message : String(cause);
      }
    } finally { if (!current.signal.aborted) loading = false; }
  }

  async function share(enabled: boolean) {
    replayRequest?.abort();
    const current = new AbortController();
    replayRequest = current;
    replayLoading = true;
    replayError = "";
    sharingStatus = "";
    try {
      const result = await readSessionReplay(await apiFetch(`/api/users/analytics/sessions/${session.id}/replay?days=${days}`, {
        method: enabled ? "POST" : "DELETE",
        ...(enabled ? { body: JSON.stringify({ confirm_public_sharing: true }) } : {}),
        signal: AbortSignal.any([current.signal, AbortSignal.timeout(35000)])
      }));
      if (result.session_id !== session.id || result.enabled !== enabled) throw new Error("Confirmation de partage incohérente.");
      if (!current.signal.aborted) {
        embed = result.embed_url;
        confirmation = false;
        sharingStatus = enabled ? "" : "Partage désactivé : le lien de cette session ne permet plus la lecture.";
      }
    } catch (cause) {
      if (!current.signal.aborted) {
        console.error("Replay PostHog :", cause);
        replayError = cause instanceof Error ? cause.message : String(cause);
      }
    } finally { if (!current.signal.aborted) replayLoading = false; }
  }
  onMount(() => {
    void load();
    return () => { request?.abort(); replayRequest?.abort(); };
  });
</script>

<section class="mt-5 space-y-5 border-2 border-black bg-white p-4" aria-label="Détail de la session">
  <h4 class="font-black">Session du {new Date(session.started_at).toLocaleString("fr-BE")}</h4>
  <div class="space-y-3">
    <h5 class="font-bold">Relecture interactive</h5>
    <p class="text-xs text-black/65">La lecture intégrée active un lien PostHog accessible à toute personne qui le possède. Il reste actif après fermeture de cette page, jusqu’à sa désactivation ici ou dans PostHog. Ne partagez pas ce lien.</p>
    {#if embed}
      <iframe src={embed} title="Relecture PostHog de la session" class="h-[500px] w-full border-2 border-black" allowfullscreen referrerpolicy="no-referrer"></iframe>
      <button type="button" disabled={replayLoading} onclick={() => share(false)} class="retro-btn bg-white px-3 py-2 text-xs">Arrêter et désactiver le partage</button>
      <p class="text-xs">Si le lecteur indique que la session est indisponible, vérifiez Session Replay, les quotas et la rétention du projet. Une session statistique ne garantit pas une relecture enregistrée.</p>
    {:else}
      <label class="flex items-start gap-2 text-xs"><input type="checkbox" bind:checked={confirmation} disabled={replayLoading} />J’autorise le lien de partage pour cette session.</label>
      <button type="button" disabled={!confirmation || replayLoading} onclick={() => share(true)} class="retro-btn bg-[#BFD7FE] px-3 py-2 text-xs">Lire dans cette page</button>
      <button type="button" disabled={replayLoading} onclick={() => share(false)} class="retro-btn ml-2 bg-white px-3 py-2 text-xs">Désactiver un partage existant</button>
    {/if}
    {#if replayLoading}<p role="status" class="text-xs">Mise à jour du partage PostHog…</p>{/if}
    {#if sharingStatus}<p role="status" class="text-xs">{sharingStatus}</p>{/if}
    {#if replayError}<p role="alert" class="border-2 border-black bg-[#FFE2E2] p-3 text-sm whitespace-pre-wrap">{replayError}</p>{/if}
  </div>
  <div class="space-y-3" aria-busy={loading}>
    <h5 class="font-bold">Parcours et actions</h5>
    {#if error}
      <div role="alert" class="bg-[#FFE2E2] p-3 text-sm">{error}<button type="button" onclick={load} class="retro-btn mt-2 block bg-white px-3 py-2 text-xs">Réessayer</button></div>
    {:else if loading}
      <p role="status" class="text-sm">Chargement du parcours…</p>
    {:else if events.length === 0}
      <p class="text-sm">Aucune action publique disponible sur cette période.</p>
    {:else}
      {#if truncated}<p class="text-xs">Les 200 premières actions sont affichées. Consultez PostHog pour la suite.</p>{/if}
      <ol class="space-y-2 text-xs">
        {#each events as event}
          <li class="border-l-2 border-black pl-3">
            <time datetime={event.at} class="text-black/65">{new Date(event.at).toLocaleString("fr-BE")}</time>
            <strong class="ml-2">{eventLabels[event.event]}</strong>
            {#if event.page}<span class="ml-2 break-all">{event.page}</span>{/if}
            {#if event.article_id}<span class="ml-2">Article #{event.article_id}</span>{/if}
            {#if event.count}<span class="ml-2">{event.count} article(s)</span>{/if}
            {#if event.event === "page_scrolled"}<span class="ml-2">{event.percent} %</span>{/if}
            {#if event.destination}<span class="ml-2 break-all">→ {event.destination}</span>{/if}
          </li>
        {/each}
      </ol>
    {/if}
  </div>
</section>
