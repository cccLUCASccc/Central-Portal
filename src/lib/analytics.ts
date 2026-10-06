export const metricLabels = {
  visitors: "Visiteurs uniques",
  sessions: "Sessions",
  pageviews: "Pages vues",
  article_views: "Vues d’articles",
  cart_adds: "Ajouts au panier",
  checkout_starts: "Paiements initiés",
  newsletter_signups: "Inscriptions newsletter",
  favorites: "Ajouts aux favoris"
} as const;
export type Metrics = Record<keyof typeof metricLabels, number>;
export interface AnalyticsSummary { days: number; metrics: Metrics }
export interface DailyPoint { date: string; metrics: Metrics }
export interface AnalyticsDaily { days: number; timezone: "UTC"; series: DailyPoint[] }
export interface ChartSeries { key: keyof Metrics; color: string; dash?: string }
export const chartGroups: { title: string; series: ChartSeries[] }[] = [
  { title: "Visiteurs et sessions", series: [
    { key: "visitors", color: "#1D4ED8" }, { key: "sessions", color: "#9D174D", dash: "8 4" }
  ] },
  { title: "Articles, panier et paiements", series: [
    { key: "article_views", color: "#1D4ED8" }, { key: "cart_adds", color: "#047857", dash: "8 4" },
    { key: "checkout_starts", color: "#B45309", dash: "2 4" }
  ] },
  { title: "Favoris et newsletter", series: [
    { key: "favorites", color: "#9D174D" }, { key: "newsletter_signups", color: "#047857", dash: "8 4" }
  ] }
];

export function chartScale(points: DailyPoint[], series: ChartSeries[]): number {
  const maximum = Math.max(0, ...points.flatMap(point => series.map(line => point.metrics[line.key])));
  if (maximum <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(maximum / 4));
  const step = [1, 2, 5, 10].find(value => value * magnitude >= maximum / 4) ?? 10;
  return 4 * step * magnitude;
}
export function chartCoordinates(points: DailyPoint[], key: keyof Metrics, maximum: number) {
  return points.map((point, index) => ({
    x: 52 + (index / Math.max(1, points.length - 1)) * 620,
    y: 220 - (point.metrics[key] / maximum) * 200
  }));
}
export function chartDate(date: string): string {
  return new Intl.DateTimeFormat("fr-BE", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}
export interface AnalyticsSession {
  id: string;
  started_at: string;
  ended_at: string;
  pageviews: number;
  events: number;
  replay_url: string;
}
export interface AnalyticsSessions { days: number; user_id: string; sessions: AnalyticsSession[] }
export const eventLabels = {
  "$pageview": "Page visitée", article_viewed: "Article consulté", cart_item_added: "Ajout au panier",
  cart_item_removed: "Retrait du panier", favorite_added: "Ajout aux favoris",
  favorite_removed: "Retrait des favoris", checkout_started: "Paiement initié",
  newsletter_subscribed: "Inscription newsletter", public_click: "Clic", page_scrolled: "Défilement"
} as const;
export interface SessionEvent {
  at: string; event: keyof typeof eventLabels; page: string; article_id: number;
  count: number; percent: number; element: string; destination: string;
}
export interface SessionEvents { session_id: string; events: SessionEvent[]; truncated: boolean }
export interface SessionReplay { session_id: string; enabled: boolean; embed_url: string }

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function period(value: unknown): value is number { return value === 7 || value === 30; }
function metrics(value: unknown): value is Metrics {
  return record(value) && Object.keys(metricLabels).every(key => count(value[key]));
}
function session(value: unknown): value is AnalyticsSession {
  if (!record(value) || typeof value.id !== "string" || !/^[a-f0-9-]{36}$/i.test(value.id) ||
    typeof value.started_at !== "string" || !Number.isFinite(Date.parse(value.started_at)) ||
    typeof value.ended_at !== "string" || !Number.isFinite(Date.parse(value.ended_at)) ||
    Date.parse(value.ended_at) < Date.parse(value.started_at) ||
    !count(value.pageviews) || !count(value.events) || typeof value.replay_url !== "string") return false;
  return new RegExp(`^https://eu\\.posthog\\.com/project/[1-9][0-9]*/replay/${value.id}$`).test(value.replay_url);
}
async function read(response: Response): Promise<unknown> {
  let value: unknown;
  try { value = await response.json(); }
  catch { throw new Error(`Réponse analytique illisible (HTTP ${response.status}).`); }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} : ${record(value) && typeof value.error === "string" ? value.error : "Impossible de consulter PostHog."}`);
  }
  return value;
}
export async function readAnalyticsSummary(response: Response): Promise<AnalyticsSummary> {
  const value = await read(response);
  if (!record(value) || !period(value.days) || !metrics(value.metrics)) {
    throw new Error("Indicateurs PostHog invalides.");
  }
  return { days: value.days, metrics: value.metrics };
}
function dailyPoint(value: unknown): value is DailyPoint {
  if (!record(value) || typeof value.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.date) || !metrics(value.metrics)) return false;
  const date = new Date(`${value.date}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value.date;
}
export async function readAnalyticsDaily(response: Response): Promise<AnalyticsDaily> {
  const value = await read(response);
  if (!record(value) || !period(value.days) || value.timezone !== "UTC" || !Array.isArray(value.series) ||
    value.series.length !== value.days + 1 || !value.series.every(dailyPoint)) {
    throw new Error("Données quotidiennes PostHog invalides.");
  }
  const series = value.series;
  for (let index = 1; index < series.length; index++) {
    if (Date.parse(series[index].date) - Date.parse(series[index - 1].date) !== 86400000) {
      throw new Error("Les dates des graphiques PostHog sont incohérentes.");
    }
  }
  return { days: value.days, timezone: "UTC", series };
}
export async function readAnalyticsSessions(response: Response): Promise<AnalyticsSessions> {
  const value = await read(response);
  if (!record(value) || !period(value.days) || typeof value.user_id !== "string" ||
    !Array.isArray(value.sessions) || value.sessions.length > 20 || !value.sessions.every(session)) {
    throw new Error("Sessions PostHog invalides.");
  }
  return { days: value.days, user_id: value.user_id, sessions: value.sessions };
}

function sessionEvent(value: unknown): value is SessionEvent {
  return record(value) && typeof value.at === "string" && Number.isFinite(Date.parse(value.at)) &&
    typeof value.event === "string" && Object.hasOwn(eventLabels, value.event) &&
    typeof value.page === "string" && typeof value.destination === "string" &&
    typeof value.element === "string" && ["", "a", "button"].includes(value.element) &&
    count(value.article_id) && count(value.count) && count(value.percent) && value.percent <= 100;
}
export async function readSessionEvents(response: Response): Promise<SessionEvents> {
  const value = await read(response);
  if (!record(value) || typeof value.session_id !== "string" || typeof value.truncated !== "boolean" ||
    !Array.isArray(value.events) || value.events.length > 200 || !value.events.every(sessionEvent)) {
    throw new Error("Parcours de session PostHog invalide.");
  }
  return { session_id: value.session_id, events: value.events, truncated: value.truncated };
}
export async function readSessionReplay(response: Response): Promise<SessionReplay> {
  const value = await read(response);
  if (!record(value) || typeof value.session_id !== "string" || typeof value.enabled !== "boolean" ||
    typeof value.embed_url !== "string" ||
    (value.enabled ? !/^https:\/\/eu\.posthog\.com\/embedded\/[A-Za-z0-9_-]{16,200}$/.test(value.embed_url) : value.embed_url !== "")) {
    throw new Error("Lien de relecture PostHog invalide.");
  }
  return { session_id: value.session_id, enabled: value.enabled, embed_url: value.embed_url };
}
