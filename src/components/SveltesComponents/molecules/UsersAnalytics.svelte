<script lang="ts">
  import { onMount } from "svelte";
  import { apiFetch } from "../../../lib/api";
  import { chartGroups, metricLabels, readAnalyticsDaily, readAnalyticsSummary, readAnalyticsSessions, type DailyPoint, type Metrics, type AnalyticsSession } from "../../../lib/analytics";
  import type { UserSummary } from "../../../lib/users";
  import AnalyticsChart from "./AnalyticsChart.svelte";
  import SessionViewer from "./SessionViewer.svelte";

  let { selectedUser = null }: { selectedUser?: UserSummary | null } = $props();
  let sessionUser = $state<UserSummary | null>(null);
  let days = $state(30);
  let metrics = $state<Metrics | null>(null);
  let daily = $state<DailyPoint[]>([]);
  let dailyLoading = $state(false);
  let dailyError = $state("");
  let sessions = $state<AnalyticsSession[]>([]);
  let selectedSession = $state<AnalyticsSession | null>(null);
  let loading = $state(false);
  let sessionsLoading = $state(false);
  let error = $state("");
  let sessionsError = $state("");
  let summaryController: AbortController | undefined;
  let dailyController: AbortController | undefined;
  let sessionsController: AbortController | undefined;
  let mounted = $state(false);

  async function loadSummary(period: number) {
    summaryController?.abort();
    const current = new AbortController();
    summaryController = current;
    loading = true;
    error = "";
    metrics = null;
    try {
      const result = await readAnalyticsSummary(await apiFetch(`/api/users/analytics?days=${period}`, {
        signal: AbortSignal.any([current.signal, AbortSignal.timeout(35000)])
      }));
      if (result.days !== period) throw new Error("Période des indicateurs incohérente.");
      if (!current.signal.aborted) metrics = result.metrics;
    } catch (cause) {
      if (!current.signal.aborted) {
        console.error("PostHog :", cause);
        error = cause instanceof Error ? cause.message : String(cause);
      }
    } finally { if (!current.signal.aborted) loading = false; }
  }

  async function loadSessions(user: UserSummary | null, period: number) {
    sessionsController?.abort();
    sessions = [];
    selectedSession = null;
    sessionsError = "";
    sessionsLoading = false;
    const current = new AbortController();
    sessionsController = current;
    sessionsLoading = true;
    try {
      const endpoint = user ? `/api/users/${encodeURIComponent(user.id)}/sessions` : "/api/users/analytics/sessions";
      const result = await readAnalyticsSessions(await apiFetch(`${endpoint}?days=${period}`, {
        signal: AbortSignal.any([current.signal, AbortSignal.timeout(35000)])
      }));
      if (result.user_id !== (user?.id ?? "") || result.days !== period) throw new Error("Les sessions reçues ne correspondent pas à la sélection.");
      if (!current.signal.aborted) sessions = result.sessions;
    } catch (cause) {
      if (!current.signal.aborted) {
        console.error("Sessions PostHog :", cause);
        sessionsError = cause instanceof Error ? cause.message : String(cause);
      }
    } finally { if (!current.signal.aborted) sessionsLoading = false; }
  }

  async function loadDaily(period: number) {
    dailyController?.abort();
    const current = new AbortController();
    dailyController = current;
    dailyLoading = true;
    dailyError = "";
    daily = [];
    try {
      const result = await readAnalyticsDaily(await apiFetch(`/api/users/analytics/daily?days=${period}`, {
        signal: AbortSignal.any([current.signal, AbortSignal.timeout(35000)])
      }));
      if (result.days !== period) throw new Error("Période des graphiques incohérente.");
      if (!current.signal.aborted) daily = result.series;
    } catch (cause) {
      if (!current.signal.aborted) {
        console.error("Graphiques PostHog :", cause);
        dailyError = cause instanceof Error ? cause.message : String(cause);
      }
    } finally { if (!current.signal.aborted) dailyLoading = false; }
  }

  onMount(() => {
    mounted = true;
    return () => { summaryController?.abort(); dailyController?.abort(); sessionsController?.abort(); };
  });
  $effect(() => { if (mounted) void loadSummary(days); });
  $effect(() => { if (mounted) void loadDaily(days); });
  $effect(() => { sessionUser = selectedUser; });
  $effect(() => { if (mounted) void loadSessions(sessionUser, days); });
</script>

<section id="users-analytics" class="mt-10 space-y-5 border-t-2 border-black pt-8 font-mono" aria-labelledby="analytics-title">
  <header class="flex flex-wrap items-center justify-between gap-4">
    <h2 id="analytics-title" class="text-2xl font-black uppercase">Navigation · PostHog</h2>
    <div class="flex flex-wrap items-center gap-3">
      <label for="analytics-period" class="text-xs font-bold">Période</label>
      <select id="analytics-period" bind:value={days} class="border-2 border-black bg-white px-3 py-2 text-xs">
        <option value={7}>7 derniers jours</option><option value={30}>30 derniers jours</option>
      </select>
      <button type="button" class="retro-btn bg-white px-3 py-2 text-xs" disabled={loading || dailyLoading || sessionsLoading}
        onclick={() => { void loadSummary(days); void loadDaily(days); void loadSessions(sessionUser, days); }}>Actualiser les statistiques</button>
    </div>
  </header>
  <p class="text-xs text-black/65">Trafic ayant accepté les cookies analytiques uniquement. Les visiteurs sont dédupliqués par personne PostHog ; les visiteurs anonymes ne sont pas tous reliés à un compte. Les pages privées sont exclues.</p>
  <div aria-busy={loading}>
    {#if error}
      <div role="alert" class="border-2 border-black bg-[#FFE2E2] p-4 text-sm whitespace-pre-wrap break-words">{error}</div>
    {:else if loading}
      <p role="status" class="text-sm">Chargement des indicateurs…</p>
    {:else if metrics}
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {#each Object.entries(metricLabels) as [key, label]}
          <div class="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_#000]">
            <p class="text-xs font-bold">{label}</p>
            <p class="mt-2 text-2xl font-black">{metrics[key as keyof Metrics].toLocaleString("fr-BE")}</p>
          </div>
        {/each}
      </div>
    {/if}
  </div>
  <p class="text-xs text-black/65">Les paiements initiés comptent les ouvertures réussies du paiement depuis le panier, pas les ventes payées. Les vues d’articles, ajouts au panier, favoris et inscriptions newsletter sont des événements, pas des personnes uniques.</p>

  <div class="space-y-4" aria-busy={dailyLoading}>
    <h3 class="text-lg font-black">Évolution quotidienne</h3>
    <p class="text-xs text-black/65">Jours en UTC sur les {days} dernières journées glissantes. Le premier et le dernier jour sont partiels. Les visiteurs et sessions sont dédupliqués par jour : leur somme peut dépasser le total unique de la période.</p>
    {#if dailyError}
      <div role="alert" class="border-2 border-black bg-[#FFE2E2] p-4 text-sm whitespace-pre-wrap break-words">
        {dailyError}
        <button type="button" class="retro-btn mt-3 block bg-white px-3 py-2 text-xs" onclick={() => { void loadDaily(days); }}>Réessayer les graphiques</button>
      </div>
    {:else if dailyLoading}
      <p role="status" class="text-sm">Chargement des graphiques…</p>
    {:else if daily.length}
      <div class="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {#each chartGroups as group}
          <AnalyticsChart title={group.title} points={daily} series={group.series} />
        {/each}
      </div>
    {/if}
  </div>

  <h3 class="text-lg font-black">Sessions {sessionUser ? `de ${sessionUser.name}` : "récentes du site (y compris anonymes)"}</h3>
  {#if sessionUser}<button type="button" class="retro-btn bg-white px-3 py-2 text-xs" onclick={() => { sessionUser = null; }}>Voir toutes les sessions du site</button>{/if}
  <div aria-busy={sessionsLoading}>
    {#if sessionsError}
      <div role="alert" class="border-2 border-black bg-[#FFE2E2] p-4 text-sm whitespace-pre-wrap break-words">{sessionsError}</div>
    {:else if sessionsLoading}
      <p role="status" class="text-sm">Chargement des sessions…</p>
    {:else if sessions.length === 0}
      <p class="border-2 border-black bg-white p-4 text-sm">Aucune session publique {sessionUser ? "liée à ce compte" : "du site"} sur cette période. Les sessions sont enregistrées après consentement.</p>
    {:else}
      <div class="overflow-x-auto border-2 border-black bg-white" tabindex="0" role="region" aria-label="Sessions PostHog">
        <table class="w-full text-left text-xs">
          <caption class="sr-only">Les vingt dernières sessions publiques du compte sélectionné</caption>
          <thead class="border-b-2 border-black bg-[#BFD7FE]"><tr>
            <th class="p-3" scope="col">Début</th><th class="p-3" scope="col">Durée observée</th>
            <th class="p-3" scope="col">Pages</th><th class="p-3" scope="col">Événements</th><th class="p-3" scope="col">Enregistrement</th>
          </tr></thead>
          <tbody>{#each sessions as session (session.id)}
            <tr class="border-b border-black/20">
              <td class="p-3">{new Date(session.started_at).toLocaleString("fr-BE")}</td>
              <td class="p-3">{Math.round((Date.parse(session.ended_at) - Date.parse(session.started_at)) / 1000)} s</td>
              <td class="p-3">{session.pageviews}</td><td class="p-3">{session.events}</td>
              <td class="p-3">
                <button type="button" class="retro-btn bg-[#BFD7FE] px-3 py-2 text-xs" onclick={() => { selectedSession = session; }}>Voir la session</button>
                <a href={session.replay_url} target="_blank" rel="noopener noreferrer" class="ml-2 underline font-bold">PostHog</a>
              </td>
            </tr>
          {/each}</tbody>
        </table>
      </div>
      {#if selectedSession}
        {#key `${selectedSession.id}:${days}`}<SessionViewer session={selectedSession} {days} />{/key}
      {/if}
    {/if}
  </div>
  <p class="text-xs text-black/65">Les 20 dernières sessions sont affichées. Le parcours reste dans Users ; la relecture intégrée nécessite d’autoriser un lien de partage PostHog. Sa disponibilité dépend de la rétention, du quota et des règles d’enregistrement. Textes, images et champs sont masqués.</p>
</section>
