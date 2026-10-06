import type { Antiquite, Image, Pagination } from "../type";
import type { ChannelID } from "./channels";

export type SocialChannelID = Extract<ChannelID, "facebook" | "instagram" | "tiktok">;
export type PublicationArticle = Pick<Antiquite, "id" | "name" | "description" | "price" | "status" | "images">;

export interface PublicationDraft {
  version: 2;
  articleId: number;
  text: string;
  imageIds: number[];
  savedAt: string;
}

export function inventoryURL(apiUrl: string | undefined, page: number): string {
  if (!apiUrl) {
    throw new Error("L'adresse de Central-API est absente. Configurez API_URL ou PUBLIC_API_URL dans le portail.");
  }
  const params = new URLSearchParams({ status: "0", shop_id: "daisy", page: String(page), limit: "12" });
  return `${apiUrl.replace(/\/+$/, "")}/api/antiquites?${params}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown, minimum: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum;
}

function isImage(value: unknown): value is Image {
  return isRecord(value) && isInteger(value.id, 1) && typeof value.url === "string";
}

function readArticle(value: unknown): PublicationArticle {
  if (!isRecord(value) || !isInteger(value.id, 1) ||
    typeof value.name !== "string" || typeof value.description !== "string" ||
    typeof value.price !== "number" || !Number.isFinite(value.price) ||
    value.status !== 0 ||
    !(value.images === null || (Array.isArray(value.images) && value.images.every(isImage)))) {
    throw new Error("La réponse de l'inventaire contient un article invalide, vendu ou inactif.");
  }
  return {
    id: value.id,
    name: value.name,
    description: value.description,
    price: value.price,
    status: value.status,
    images: value.images === null ? [] : value.images
  };
}

function isPagination(value: unknown): value is Pagination {
  return isRecord(value) && isInteger(value.total_items, 0) &&
    isInteger(value.total_pages, 0) && isInteger(value.current_page, 1) &&
    isInteger(value.page_size, 1);
}

export async function readInventoryResponse(response: Response): Promise<{ data: PublicationArticle[]; pagination: Pagination }> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error(`Réponse de l'inventaire illisible (HTTP ${response.status}). Vérifiez Central-API.`);
  }
  if (!response.ok) {
    const explanation = isRecord(value) && typeof value.error === "string"
      ? value.error
      : "Vérifiez votre session du portail et la disponibilité de Central-API.";
    throw new Error(`Impossible de charger l'inventaire (HTTP ${response.status}) : ${explanation}`);
  }
  if (!isRecord(value) || !Array.isArray(value.data) || !isPagination(value.pagination)) {
    throw new Error("La réponse de l'inventaire est invalide : seuls les articles actifs avec une pagination valide sont attendus.");
  }
  return { data: value.data.map(readArticle), pagination: value.pagination };
}

export function initialPublicationText(article: PublicationArticle): string {
  const price = new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(article.price);
  return [article.name, article.description.trim(), `Prix : ${price}`].filter(Boolean).join("\n\n");
}

export function draftKey(userId: string, channel: SocialChannelID, articleId: number): string {
  return `social-publication:v1:${userId}:${channel}:${articleId}`;
}

export function readDraft(raw: string, articleId: number): PublicationDraft {
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value) || value.articleId !== articleId ||
    typeof value.text !== "string" ||
    typeof value.savedAt !== "string" || !Number.isFinite(Date.parse(value.savedAt))) {
    throw new Error("Le brouillon enregistré est invalide. Il n'a pas été chargé ; vous pouvez en enregistrer un nouveau.");
  }
  let imageIds: number[];
  if (value.version === 1 && (value.imageId === null || isInteger(value.imageId, 1))) {
    imageIds = value.imageId === null ? [] : [value.imageId];
  } else if (value.version === 2 && Array.isArray(value.imageIds) &&
    value.imageIds.every((id: unknown): id is number => isInteger(id, 1)) &&
    new Set(value.imageIds).size === value.imageIds.length) {
    imageIds = value.imageIds;
  } else {
    throw new Error("Les photos du brouillon enregistré sont invalides. Le brouillon n'a pas été chargé.");
  }
  return {
    version: 2,
    articleId,
    text: value.text,
    imageIds,
    savedAt: value.savedAt
  };
}
