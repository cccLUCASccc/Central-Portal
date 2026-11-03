import type { Pagination } from "../type";

export const contactStatuses = [
  { id: "to_contact", label: "À contacter" },
  { id: "contacted", label: "Contacté" },
  { id: "follow_up", label: "À relancer" },
  { id: "interested", label: "Intéressé" },
  { id: "partner", label: "Partenaire" },
  { id: "declined", label: "Refus" }
] as const;
export type ContactStatus = (typeof contactStatuses)[number]["id"];

export interface ContactEdit {
  name: string;
  company: string;
  profession: string;
  status: ContactStatus;
  do_not_contact: boolean;
  version: number;
}

export interface MailContact extends ContactEdit {
  email: string;
  first_sent_at: string;
  last_sent_at: string;
  attempts: number;
  sent_count: number;
  failed_count: number;
  blocked_count: number;
}

export interface ContactHistory {
  id: number;
  recipient: string;
  subject: string;
  status: "sent" | "failed" | "blocked";
  error?: string;
  sent_by: string;
  created_at: string;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
const integer = (value: unknown, min = 0): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= min;
const date = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));

function contact(value: unknown): value is MailContact {
  return record(value) && typeof value.email === "string" && value.email.includes("@") &&
    typeof value.name === "string" && typeof value.company === "string" && typeof value.profession === "string" &&
    contactStatuses.some((status) => status.id === value.status) && typeof value.do_not_contact === "boolean" &&
    date(value.first_sent_at) && date(value.last_sent_at) && integer(value.attempts) &&
    integer(value.sent_count) && integer(value.failed_count) && integer(value.blocked_count) && integer(value.version);
}
function history(value: unknown): value is ContactHistory {
  return record(value) && integer(value.id, 1) && typeof value.recipient === "string" &&
    typeof value.subject === "string" && typeof value.sent_by === "string" && date(value.created_at) &&
    ["sent", "failed", "blocked"].includes(String(value.status)) &&
    (value.error === undefined || typeof value.error === "string");
}
function pagination(value: unknown): value is Pagination {
  return record(value) && integer(value.current_page, 1) && integer(value.total_items) &&
    integer(value.total_pages) && integer(value.page_size, 1);
}

export async function readContactsJSON(response: Response): Promise<unknown> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error(`Réponse du suivi des contacts illisible (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    const message = record(value) && typeof value.error === "string" ? value.error : "Vérifiez votre session et Central-API.";
    throw new Error(`Erreur HTTP ${response.status} : ${message}`);
  }
  return value;
}

export async function readContactPage(response: Response): Promise<{ data: MailContact[]; pagination: Pagination }> {
  const value = await readContactsJSON(response);
  if (!record(value) || !Array.isArray(value.data) || !value.data.every(contact) || !pagination(value.pagination)) {
    throw new Error("La liste des contacts est invalide. Aucun suivi ne peut être affiché.");
  }
  return { data: value.data, pagination: value.pagination };
}
export async function readContactHistory(response: Response): Promise<{ data: ContactHistory[]; pagination: Pagination }> {
  const value = await readContactsJSON(response);
  if (!record(value) || !Array.isArray(value.data) || !value.data.every(history) || !pagination(value.pagination)) {
    throw new Error("L'historique du contact est invalide.");
  }
  return { data: value.data, pagination: value.pagination };
}
export function contactEdit(contact: ContactEdit): ContactEdit {
  return {
    name: contact.name, company: contact.company, profession: contact.profession,
    status: contact.status, do_not_contact: contact.do_not_contact, version: contact.version
  };
}
export function contactPath(email: string, history = false): string {
  return `/api/mails/contacts${history ? "/history" : ""}?${new URLSearchParams({ email })}`;
}
export function statusLabel(status: ContactStatus): string {
  return contactStatuses.find((choice) => choice.id === status)!.label;
}
