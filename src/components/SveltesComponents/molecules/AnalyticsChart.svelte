<script lang="ts">
  import { chartCoordinates, chartDate, chartScale, metricLabels, type ChartSeries, type DailyPoint } from "../../../lib/analytics";

  let { title, points, series }: { title: string; points: DailyPoint[]; series: ChartSeries[] } = $props();
  const id = $props.id();
  let selectedDate = $state("");
  let maximum = $derived(chartScale(points, series));
  let selected = $derived(points.find(point => point.date === selectedDate) ?? points.at(-1));
  let lines = $derived(series.map(line => ({ ...line, coordinates: chartCoordinates(points, line.key, maximum) })));
  let ticks = $derived(Array.from({ length: 5 }, (_, index) => Math.round(maximum * index / 4)));
  let dateTicks = $derived([...new Set([0, Math.floor((points.length - 1) / 3), Math.floor(2 * (points.length - 1) / 3), points.length - 1])]);
  let empty = $derived(points.every(point => series.every(line => point.metrics[line.key] === 0)));
</script>

<section class="min-w-0 space-y-4 border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_#000]" aria-labelledby={`${id}-title`}>
  <h4 id={`${id}-title`} class="text-sm font-black">{title}</h4>
  <ul class="flex flex-wrap gap-x-4 gap-y-2 text-xs" aria-label="Légende">
    {#each series as line}
      <li class="flex items-center gap-2">
        <svg width="24" height="8" aria-hidden="true"><line x1="0" y1="4" x2="24" y2="4" stroke={line.color} stroke-width="3" stroke-dasharray={line.dash} /></svg>
        {metricLabels[line.key]}
      </li>
    {/each}
  </ul>
  {#if empty}<p class="text-xs text-black/65">Aucun événement pour ces indicateurs sur la période.</p>{/if}
  <svg viewBox="0 0 700 264" class="w-full" role="img" aria-labelledby={`${id}-svg-title ${id}-svg-desc`}>
    <title id={`${id}-svg-title`}>{title} : évolution quotidienne</title>
    <desc id={`${id}-svg-desc`}>Comptages par jour UTC. Les valeurs exactes sont disponibles dans le sélecteur et le tableau ci-dessous.</desc>
    {#each ticks as tick}
      {@const y = 220 - tick / maximum * 200}
      <line x1="52" y1={y} x2="672" y2={y} stroke="#D1D5DB" />
      <text x="42" {y} text-anchor="end" dominant-baseline="middle" font-size="12" fill="#374151">{tick.toLocaleString("fr-BE")}</text>
    {/each}
    {#each dateTicks as index}
      {@const x = 52 + index / Math.max(1, points.length - 1) * 620}
      <text {x} y="247" text-anchor="middle" font-size="12" fill="#374151">{chartDate(points[index].date)}</text>
    {/each}
    {#each lines as line}
      <polyline points={line.coordinates.map(point => `${point.x},${point.y}`).join(" ")} fill="none" stroke={line.color} stroke-width="2.5" stroke-dasharray={line.dash} />
      {#each line.coordinates as coordinate, index}
        <circle cx={coordinate.x} cy={coordinate.y} r="3" fill={line.color}>
          <title>{chartDate(points[index].date)} · {metricLabels[line.key]} : {points[index].metrics[line.key]}</title>
        </circle>
      {/each}
    {/each}
  </svg>
  <div class="space-y-2 text-xs">
    <label for={`${id}-date`} class="font-bold">Valeurs du jour (UTC)</label>
    <select id={`${id}-date`} value={selected?.date} onchange={(event) => { selectedDate = event.currentTarget.value; }} class="ml-2 border-2 border-black bg-white px-2 py-1">
      {#each points as point}
        <option value={point.date}>{chartDate(point.date)} · {point.date.slice(0, 4)}</option>
      {/each}
    </select>
    {#if selected}
      <ul class="flex flex-wrap gap-x-4 gap-y-1">
        {#each series as line}<li>{metricLabels[line.key]} : <strong>{selected.metrics[line.key].toLocaleString("fr-BE")}</strong></li>{/each}
      </ul>
    {/if}
  </div>
  <details class="text-xs">
    <summary class="cursor-pointer font-bold underline">Voir les données du graphique</summary>
    <div class="mt-3 overflow-x-auto">
      <table class="w-full text-left">
        <caption class="sr-only">{title} : valeurs quotidiennes UTC</caption>
        <thead><tr><th scope="col" class="p-2">Date UTC</th>{#each series as line}<th scope="col" class="p-2">{metricLabels[line.key]}</th>{/each}</tr></thead>
        <tbody>{#each points as point}
          <tr class="border-t border-black/20"><th scope="row" class="p-2 font-normal">{point.date}</th>{#each series as line}<td class="p-2">{point.metrics[line.key].toLocaleString("fr-BE")}</td>{/each}</tr>
        {/each}</tbody>
      </table>
    </div>
  </details>
</section>
