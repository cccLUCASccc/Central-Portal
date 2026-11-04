import { readDraft, type MailDocument, type MailDraft } from "./mail-composer";

export interface SavedMailSummary {
  id: number;
  name: string;
  subject: string;
  version: number;
  created_by: string;
  updated_by: string;
  updated_at: string;
}

export interface SavedMailContent {
  document: MailDocument;
  recipients: string;
  replyTo: string;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

function summary(value: unknown): value is SavedMailSummary {
  return record(value) && positive(value.id) && positive(value.version) &&
    typeof value.name === "string" && value.name.trim() !== "" && typeof value.subject === "string" &&
    typeof value.updated_by === "string" && typeof value.created_by === "string" &&
    typeof value.updated_at === "string" && Number.isFinite(Date.parse(value.updated_at));
}

export async function readSavedJSON(response: Response): Promise<unknown> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error(`Réponse des mails sauvegardés illisible (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    const message = record(value) && typeof value.error === "string" ? value.error : "Vérifiez votre session et Central-API.";
    throw new Error(`Erreur HTTP ${response.status} : ${message}`);
  }
  return value;
}

export async function readSavedList(response: Response): Promise<SavedMailSummary[]> {
  const value = await readSavedJSON(response);
  if (!record(value) || !Array.isArray(value.data) || !value.data.every(summary)) {
    throw new Error("La liste des mails sauvegardés est invalide.");
  }
  return value.data;
}

export async function readSavedWrite(response: Response, expected: { name: string; version?: number }): Promise<SavedMailSummary> {
  const value = await readSavedJSON(response);
  if (!record(value) || !summary(value.mail) || value.mail.name !== expected.name ||
    value.mail.version !== (expected.version ?? 0) + 1) {
    throw new Error("L'enregistrement n'a pas été confirmé par Central-API.");
  }
  return value.mail;
}

export async function readSavedMail(response: Response): Promise<{ mail: SavedMailSummary; draft: MailDraft }> {
  const value = await readSavedJSON(response);
  if (!record(value) || !summary(value.mail)) throw new Error("Le mail sauvegardé est invalide.");
  // readDraft revalide le document et complète les champs ajoutés depuis l'enregistrement.
  return { mail: value.mail, draft: readDraft(JSON.stringify(value.content)) };
}

export function savedMailPayload(name: string, content: SavedMailContent, version?: number) {
  return {
    name: name.trim(),
    content: { version: 1, document: content.document, recipients: content.recipients, replyTo: content.replyTo },
    ...(version === undefined ? {} : { version })
  };
}

export function savedMailPath(id?: number, version?: number): string {
  const path = `/api/mails/saved${id === undefined ? "" : `/${id}`}`;
  return version === undefined ? path : `${path}?${new URLSearchParams({ version: String(version) })}`;
}

export function defaultSavedName(doc: Pick<MailDocument, "subject" | "title">): string {
  return (doc.subject.trim() || doc.title.trim() || "Mail sans titre").replace(/\s+/g, " ").slice(0, 120);
}
