import type { Pagination } from "../type";

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  newsletter_subscribed: boolean;
  is_customer: boolean;
  is_seller: boolean;
  active_articles: number;
  purchases: number;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function integer(value: unknown, minimum = 0): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum;
}

function summary(value: unknown): value is UserSummary {
  return record(value) && typeof value.id === "string" && value.id.length > 0 &&
    typeof value.name === "string" && typeof value.email === "string" &&
    typeof value.newsletter_subscribed === "boolean" &&
    typeof value.is_customer === "boolean" && typeof value.is_seller === "boolean" &&
    integer(value.active_articles) && integer(value.purchases);
}

function pagination(value: unknown): value is Pagination {
  return record(value) && integer(value.total_items) && integer(value.total_pages) &&
    integer(value.current_page, 1) && integer(value.page_size, 1);
}

export async function readUsersResponse(response: Response): Promise<{ data: UserSummary[]; pagination: Pagination }> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error(`Réponse utilisateurs illisible (HTTP ${response.status}). Vérifiez Central-API.`);
  }
  if (!response.ok) {
    const error = record(value) && typeof value.error === "string" ? value.error : "Vérifiez votre session et Central-API.";
    throw new Error(`Erreur HTTP ${response.status} : ${error}`);
  }
  if (!record(value) || !Array.isArray(value.data) || !value.data.every(summary) || !pagination(value.pagination)) {
    throw new Error("La réponse utilisateurs est invalide. Les statistiques ne peuvent pas être affichées.");
  }
  return { data: value.data, pagination: value.pagination };
}
