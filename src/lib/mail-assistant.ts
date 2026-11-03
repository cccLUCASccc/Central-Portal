import type { MailDocument } from "./mail-composer";

export const assistantOptions = {
  objective: [
    { id: "contact", label: "Premier contact" },
    { id: "partnership", label: "Proposition de partenariat" },
    { id: "selection", label: "Sélection pour un projet" },
    { id: "follow-up", label: "Relance" }
  ],
  audience: [
    { id: "decorator", label: "Décorateur" },
    { id: "architect", label: "Architecte d'intérieur" },
    { id: "hotel", label: "Hôtel" },
    { id: "restaurant", label: "Restaurant" },
    { id: "shop", label: "Boutique" },
    { id: "other", label: "Autre professionnel" }
  ],
  tone: [
    { id: "warm", label: "Professionnel chaleureux" },
    { id: "elegant", label: "Élégant et sobre" },
    { id: "direct", label: "Direct et concis" },
    { id: "creative", label: "Créatif et inspirant" }
  ],
  length: [
    { id: "short", label: "Court" },
    { id: "standard", label: "Standard" },
    { id: "detailed", label: "Détaillé" }
  ]
} as const;

export type AssistantSettings = {
  [K in keyof typeof assistantOptions]: (typeof assistantOptions)[K][number]["id"];
} & { instructions: string };

export type MailCopy = Pick<MailDocument, "subject" | "preheader" | "title" | "intro" | "outro" | "ctaLabel">;
const copyLimits = { subject: 200, preheader: 150, title: 200, intro: 6000, outro: 6000, ctaLabel: 100 } as const;
export const copyFields = Object.keys(copyLimits) as (keyof MailCopy)[];

export function currentCopy(doc: MailCopy): MailCopy {
  return { subject: doc.subject, preheader: doc.preheader, title: doc.title, intro: doc.intro, outro: doc.outro, ctaLabel: doc.ctaLabel };
}

export function assistantRequest(doc: MailDocument, settings: AssistantSettings, mode: "draft" | "improve") {
  return {
    ...settings, mode, current: currentCopy(doc),
    items: doc.items.map((item) => item.article.name)
  };
}

export function readMailCopy(value: unknown): MailCopy {
  if (typeof value !== "object" || value === null) throw new Error("Proposition IA illisible.");
  for (const field of copyFields) {
    if (!(field in value)) throw new Error(`Proposition IA incomplète : ${field}.`);
    const text: unknown = Reflect.get(value, field);
    if (typeof text !== "string" || [...text].length > copyLimits[field] ||
      (!["intro", "outro"].includes(field) && /[\r\n]/.test(text))) {
      throw new Error(`Champ IA invalide : ${field}.`);
    }
  }
  // Les six champs ont été vérifiés ci-dessus.
  const copy = value as MailCopy;
  if (!copy.subject.trim() || !copy.intro.trim()) throw new Error("La proposition IA doit contenir un objet et une introduction.");
  return currentCopy(copy);
}
