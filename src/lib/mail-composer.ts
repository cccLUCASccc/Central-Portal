import type { Image } from "../type";
import type { PublicationArticle } from "./social-publication";
import { siteItemUrl } from "./siteLink";

export const SITE_URL = "https://daisybrocante.com";
export const LOGO_URL = `${SITE_URL}/logo.png`;
export const MAX_MAIL_ITEMS = 12;
export const MAX_SLIDES = 10;
export const MAX_RECIPIENTS = 50;

export type MailArticle = PublicationArticle;
export type ImageLayout = "single" | "gallery" | "slider" | "hero-thumbs" | "none";
export type ObjectLayout = "stacked" | "list" | "zigzag" | "cards" | "carousel";
export type TextLayout = "classic" | "centered" | "two-columns" | "boxed" | "letter";
export type TextAlign = "left" | "center" | "justify";
export type FontStyle = "sans" | "serif";
export type ContentMode = "objects" | "subscriptions";
export type PlanId = "essential" | "amateur" | "professional" | "premium";

export const SELLER_URL = `${SITE_URL}/espace-vendeur`;
export const SELLER_PRICING_URL = `${SITE_URL}/espace-vendeur/fonctionnement-paiements`;

// Reprend les formules publiées sur la page « Fonctionnement des paiements » du site.
export const subscriptionPlans: { id: PlanId; name: string; badge: string; price: string; commission: string; features: string }[] = [
  { id: "essential", name: "Essentiel", badge: "Essentiel", price: "12 € / mois", commission: "18 %", features: "Jusqu'à 50 objets en ligne, 5 photos par annonce, avatar simple, versements automatiques à J+30." },
  { id: "amateur", name: "Amateur", badge: "Populaire", price: "29 € / mois", commission: "15 %", features: "Jusqu'à 250 objets en ligne, 7 photos par annonce, avatar et bannière personnalisés, versements à J+30." },
  { id: "professional", name: "Professionnel", badge: "Pro", price: "59 € / mois", commission: "12 %", features: "Jusqu'à 1000 objets, 10 photos par annonce, vidéo de vitrine exclusive, mise en avant sur l'accueil, versements à J+30." },
  { id: "premium", name: "Premium", badge: "Premium", price: "99 € / mois", commission: "10 %", features: "Objets illimités, personnalisation complète des couleurs, badge Maison d'Art, commission minimale de 10 %." }
];

export const contentModes: { id: ContentMode; label: string; hint: string }[] = [
  { id: "objects", label: "Objets de l'inventaire", hint: "Présenter une sélection de pièces à vendre." },
  { id: "subscriptions", label: "Abonnements vendeurs", hint: "Promouvoir les formules pour ouvrir une boutique sur la plateforme." }
];

export const imageLayouts: { id: ImageLayout; label: string; hint: string }[] = [
  { id: "single", label: "Grande image", hint: "La première photo sélectionnée, en grand." },
  { id: "gallery", label: "Galerie", hint: "Toutes les photos sélectionnées en grille." },
  { id: "slider", label: "Slider", hint: "Carrousel cliquable (Apple Mail, iOS). Ailleurs : image principale + vignettes." },
  { id: "hero-thumbs", label: "Image + vignettes", hint: "Une grande photo suivie des autres en vignettes." },
  { id: "none", label: "Sans image", hint: "Texte uniquement." }
];

export const objectLayouts: { id: ObjectLayout; label: string; hint: string }[] = [
  { id: "stacked", label: "Empilé", hint: "Photos au-dessus, texte en dessous." },
  { id: "list", label: "Liste", hint: "Photos à gauche, texte à droite." },
  { id: "zigzag", label: "Zig-zag", hint: "Photos alternées gauche / droite." },
  { id: "cards", label: "Cartes", hint: "Deux objets par ligne." },
  { id: "carousel", label: "Slider d'objets", hint: "Un seul carrousel, une diapositive par objet." }
];

export const textLayouts: { id: TextLayout; label: string; hint: string }[] = [
  { id: "classic", label: "Classique", hint: "Une colonne." },
  { id: "centered", label: "Centré", hint: "Titres et textes centrés." },
  { id: "two-columns", label: "Deux colonnes", hint: "La conclusion sur deux colonnes ; l'introduction reste en pleine largeur." },
  { id: "boxed", label: "Encadré", hint: "Introduction et conclusion dans un encadré coloré." },
  { id: "letter", label: "Lettre", hint: "Style courrier, signature à droite." }
];

export interface MailItem {
  article: MailArticle;
  imageIds: number[];
  text: string;
  showPrice: boolean;
  showLink: boolean;
}

export interface MailDocument {
  subject: string;
  preheader: string;
  title: string;
  intro: string;
  outro: string;
  signature: string;
  mailingAddress: string;
  footer: string;
  ctaLabel: string;
  ctaUrl: string;
  showLogo: boolean;
  showPrices: boolean;
  showProfessionalTerms: boolean;
  professionalTerms: string;
  showAppointment: boolean;
  appointmentUrl: string;
  textLayout: TextLayout;
  textAlign: TextAlign;
  font: FontStyle;
  accentColor: string;
  objectLayout: ObjectLayout;
  imageLayout: ImageLayout;
  galleryColumns: 2 | 3;
  contentMode: ContentMode;
  plans: PlanId[];
  items: MailItem[];
}

export interface SavedMailRef {
  id: number;
  name: string;
  version: number;
  // Le brouillon local correspondait exactement à la version enregistrée.
  clean: boolean;
}

export interface MailDraft {
  version: 1;
  document: MailDocument;
  recipients: string;
  replyTo: string;
  savedAt: string;
  saved?: SavedMailRef;
}

type ModeCopy = Pick<MailDocument, "title" | "intro" | "outro" | "ctaLabel" | "ctaUrl">;
const modeCopy: Record<ContentMode, ModeCopy> = {
  objects: {
    title: "Notre sélection pour vous",
    intro: "Bonjour,\n\nNous avons sélectionné quelques pièces qui pourraient vous plaire.",
    outro: "N'hésitez pas à répondre à ce mail pour toute question ou pour réserver un objet.",
    ctaLabel: "Voir la boutique",
    ctaUrl: `${SITE_URL}/boutique`
  },
  subscriptions: {
    title: "Vendez vos pièces sur Daisy Brocante",
    intro: "Bonjour,\n\nDaisy Brocante accueille les marchands, décorateurs et professionnels qui souhaitent présenter leurs pièces à une clientèle passionnée. Voici les formules disponibles pour ouvrir votre boutique.",
    outro: "N'hésitez pas à répondre à ce mail pour toute question sur les formules ou l'ouverture de votre boutique.",
    ctaLabel: "Ouvrir ma boutique",
    ctaUrl: SELLER_URL
  }
};

/** Remplace uniquement les textes encore identiques aux valeurs par défaut de l'autre mode. */
export function switchContentMode(doc: MailDocument, mode: ContentMode): MailDocument {
  if (doc.contentMode === mode) return doc;
  const from = modeCopy[doc.contentMode];
  const to = modeCopy[mode];
  const next = { ...doc, contentMode: mode };
  for (const key of Object.keys(to) as (keyof ModeCopy)[]) {
    if (doc[key] === from[key]) next[key] = to[key];
  }
  return next;
}

export function defaultDocument(): MailDocument {
  return {
    subject: "",
    preheader: "",
    ...modeCopy.objects,
    signature: "Daisy Brocante",
    mailingAddress: "",
    footer: "Vous recevez ce message car nous pensons que notre sélection peut vous intéresser. Si vous ne souhaitez plus être contacté, répondez simplement « STOP » à ce mail.",
    showLogo: true,
    showPrices: true,
    showProfessionalTerms: false,
    professionalTerms: "Des conditions dédiées aux professionnels sont disponibles sur demande. Contactez-nous pour en savoir plus.",
    showAppointment: false,
    appointmentUrl: "",
    textLayout: "classic",
    textAlign: "left",
    font: "sans",
    accentColor: "#C2185B",
    objectLayout: "stacked",
    imageLayout: "single",
    galleryColumns: 2,
    contentMode: "objects",
    plans: subscriptionPlans.map((plan) => plan.id),
    items: []
  };
}

export function itemFromArticle(article: MailArticle): MailItem {
  const description = article.description.trim();
  return {
    article,
    imageIds: article.images.slice(0, 4).map((image) => image.id),
    text: description.length > 280 ? `${description.slice(0, 277).trimEnd()}…` : description,
    showPrice: true,
    showLink: true
  };
}

export function inventorySearchURL(apiUrl: string | undefined, page: number, query: string): string {
  if (!apiUrl) {
    throw new Error("L'adresse de Central-API est absente. Configurez API_URL ou PUBLIC_API_URL dans le portail.");
  }
  const params = new URLSearchParams({ status: "0", shop_id: "daisy", page: String(page), limit: "12" });
  if (query.trim()) params.set("q", query.trim());
  return `${apiUrl.replace(/\/+$/, "")}/api/antiquites?${params}`;
}

export function parseRecipients(raw: string): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(/[\s,;]+/)) {
    const email = part.trim().toLowerCase();
    if (!email) continue;
    if (!/^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/.test(email) || email.length > 254) {
      invalid.push(part.trim());
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    valid.push(email);
  }
  return { valid, invalid };
}

export function draftKey(userId: string): string {
  return `mail-composer:v1:${userId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? value as T : fallback;
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function readImage(value: unknown): Image | null {
  return isRecord(value) && typeof value.id === "number" && Number.isSafeInteger(value.id) && typeof value.url === "string"
    ? { id: value.id, url: value.url }
    : null;
}

function readItem(value: unknown): MailItem | null {
  if (!isRecord(value) || !isRecord(value.article)) return null;
  const article = value.article;
  if (typeof article.id !== "number" || typeof article.name !== "string" || typeof article.price !== "number") return null;
  const images = Array.isArray(article.images) ? article.images.map(readImage).filter((image): image is Image => image !== null) : [];
  return {
    article: {
      id: article.id,
      name: article.name,
      description: text(article.description, ""),
      price: article.price,
      status: 0,
      images
    },
    imageIds: Array.isArray(value.imageIds)
      ? value.imageIds.filter((id): id is number => typeof id === "number" && images.some((image) => image.id === id))
      : [],
    text: text(value.text, ""),
    showPrice: value.showPrice !== false,
    showLink: value.showLink !== false
  };
}

// Relit un brouillon en complétant les champs manquants avec les valeurs par défaut.
export function readDraft(raw: string): MailDraft {
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.document)) {
    throw new Error("Le brouillon enregistré est invalide. Il n'a pas été chargé.");
  }
  const source = value.document;
  const defaults = defaultDocument();
  const document: MailDocument = {
    subject: text(source.subject, defaults.subject),
    preheader: text(source.preheader, defaults.preheader),
    title: text(source.title, defaults.title),
    intro: text(source.intro, defaults.intro),
    outro: text(source.outro, defaults.outro),
    signature: text(source.signature, defaults.signature),
    mailingAddress: text(source.mailingAddress, defaults.mailingAddress),
    footer: text(source.footer, defaults.footer),
    ctaLabel: text(source.ctaLabel, defaults.ctaLabel),
    ctaUrl: text(source.ctaUrl, defaults.ctaUrl),
    showLogo: source.showLogo !== false,
    showPrices: source.showPrices !== false,
    showProfessionalTerms: source.showProfessionalTerms === true,
    professionalTerms: text(source.professionalTerms, defaults.professionalTerms),
    showAppointment: source.showAppointment === true,
    appointmentUrl: text(source.appointmentUrl, defaults.appointmentUrl),
    textLayout: oneOf(source.textLayout, textLayouts.map((item) => item.id), defaults.textLayout),
    textAlign: oneOf(source.textAlign, ["left", "center", "justify"] as const, defaults.textAlign),
    font: oneOf(source.font, ["sans", "serif"] as const, defaults.font),
    accentColor: safeColor(text(source.accentColor, defaults.accentColor)),
    objectLayout: oneOf(source.objectLayout, objectLayouts.map((item) => item.id), defaults.objectLayout),
    imageLayout: oneOf(source.imageLayout, imageLayouts.map((item) => item.id), defaults.imageLayout),
    galleryColumns: source.galleryColumns === 3 ? 3 : 2,
    contentMode: oneOf(source.contentMode, contentModes.map((mode) => mode.id), defaults.contentMode),
    plans: Array.isArray(source.plans)
      ? subscriptionPlans.map((plan) => plan.id).filter((id) => (source.plans as unknown[]).includes(id))
      : defaults.plans,
    items: Array.isArray(source.items)
      ? source.items.map(readItem).filter((item): item is MailItem => item !== null).slice(0, MAX_MAIL_ITEMS)
      : []
  };
  return {
    version: 1,
    document,
    recipients: text(value.recipients, ""),
    replyTo: text(value.replyTo, ""),
    savedAt: text(value.savedAt, new Date().toISOString()),
    ...(readSavedRef(value.saved) ? { saved: readSavedRef(value.saved)! } : {})
  };
}

function readSavedRef(value: unknown): SavedMailRef | null {
  return isRecord(value) && typeof value.id === "number" && Number.isSafeInteger(value.id) && value.id > 0 &&
    typeof value.name === "string" && typeof value.version === "number" && Number.isSafeInteger(value.version) && value.version > 0
    ? { id: value.id, name: value.name, version: value.version, clean: value.clean === true }
    : null;
}

export function selectedPlans(doc: Pick<MailDocument, "plans">) {
  return subscriptionPlans.filter((plan) => doc.plans.includes(plan.id));
}

// ---------- Rendu HTML compatible clients mail ----------

const CONTENT_WIDTH = 552;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function safeUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:" ? url.href : null;
  } catch {
    return null;
  }
}

export function safeColor(value: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : "#C2185B";
}

function contrastColor(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#111111" : "#FFFFFF";
}

function tint(hex: string, ratio: number): string {
  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  return `#${channels.map((channel) => Math.round(channel + (255 - channel) * ratio).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(price);
}

// Paragraphes séparés par une ligne vide, **gras**, liens http(s) automatiques.
export function formatInline(value: string, linkColor: string): string {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, `<a href="$1" style="color:${linkColor};text-decoration:underline;">$1</a>`)
    .replace(/\n/g, "<br>");
}

export function paragraphs(value: string): string[] {
  return value.replace(/\r\n/g, "\n").split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
}

interface Theme {
  showPrices: boolean;
  accent: string;
  accentText: string;
  accentSoft: string;
  fontFamily: string;
  align: TextAlign;
}

function themeFor(doc: MailDocument): Theme {
  const accent = safeColor(doc.accentColor);
  return {
    showPrices: doc.showPrices,
    accent,
    accentText: contrastColor(accent),
    accentSoft: tint(accent, 0.9),
    fontFamily: doc.font === "serif"
      ? "Georgia, 'Times New Roman', Times, serif"
      : "'Helvetica Neue', Helvetica, Arial, sans-serif",
    align: doc.textLayout === "centered" ? "center" : doc.textAlign
  };
}

function paragraphHtml(value: string, theme: Theme, align: string = theme.align, extra = ""): string {
  return paragraphs(value)
    .map((part) => `<p style="margin:0 0 14px 0;font-family:${theme.fontFamily};font-size:16px;line-height:1.6;color:#333333;text-align:${align};${extra}">${formatInline(part, theme.accent)}</p>`)
    .join("");
}

function button(label: string, url: string, theme: Theme, align = "left"): string {
  const href = safeUrl(url);
  if (!href || !label.trim()) return "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${align === "center" ? "center" : "left"}" style="margin:8px ${align === "center" ? "auto" : "0"};"><tr><td align="center" bgcolor="${theme.accent}" style="text-align:center;border-radius:4px;background:${theme.accent};"><a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;text-align:center;padding:12px 24px;font-family:${theme.fontFamily};font-size:15px;font-weight:bold;color:${theme.accentText};text-decoration:none;border-radius:4px;">${escapeHtml(label.trim())}</a></td></tr></table>`;
}

function mailImageUrl(value: string): string {
  if (!URL.canParse(value)) return value;
  const url = new URL(value);
  if (url.pathname.includes("/api/antiquites/images/") && url.pathname.toLowerCase().endsWith(".webp")) {
    url.searchParams.set("format", "jpg");
    // Versionner la conversion pour ne pas réutiliser les anciens JPEG en cache.
    url.searchParams.set("background", "white");
    url.searchParams.set("v", "2");
    return url.href;
  }
  return value;
}

function imageTag(image: Image, alt: string, width: number, href: string | null, extraStyle = ""): string {
  const img = `<img src="${escapeHtml(mailImageUrl(image.url))}" alt="${escapeHtml(alt)}" width="${width}" class="mc-img" style="display:block;width:100%;max-width:${width}px;height:auto;border:0;outline:none;text-decoration:none;background-color:#FFFFFF;${extraStyle}">`;
  return href ? `<a href="${escapeHtml(href)}" target="_blank" style="text-decoration:none;">${img}</a>` : img;
}

export function selectedImages(item: MailItem): Image[] {
  return item.article.images.filter((image) => item.imageIds.includes(image.id));
}

function galleryHtml(images: Image[], alt: string, width: number, columns: number, href: string | null): string {
  const cols = width < 360 ? 2 : columns;
  const gap = 8;
  const cell = Math.floor((width - gap * (cols - 1)) / cols);
  let rows = "";
  for (let start = 0; start < images.length; start += cols) {
    const cells = Array.from({ length: cols }, (_, offset) => {
      const image = images[start + offset];
      const padding = offset < cols - 1 ? `padding-right:${gap}px;` : "";
      return `<td width="${cell}" valign="top" style="width:${cell}px;${padding}padding-bottom:${gap}px;">${image ? imageTag(image, alt, cell, href) : "&nbsp;"}</td>`;
    }).join("");
    rows += `<tr>${cells}</tr>`;
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`;
}

function heroThumbsHtml(images: Image[], alt: string, width: number, href: string | null): string {
  const [first, ...rest] = images;
  if (!first) return "";
  const thumbs = rest.slice(0, 8);
  const thumbsHtml = thumbs.length
    ? `<div style="height:8px;line-height:8px;font-size:8px;">&nbsp;</div>${galleryHtml(thumbs, alt, width, 4, href)}`
    : "";
  return imageTag(first, alt, width, href) + thumbsHtml;
}

interface Slide {
  content: string;
  thumb?: Image;
}

let carouselCounter = 0;

function carouselHtml(slides: Slide[], fallback: string, key: string): string {
  if (slides.length < 2) return fallback;
  const id = `mc${key}-${++carouselCounter}`;
  const items = slides.slice(0, MAX_SLIDES);
  const radios = items.map((_, index) =>
    `<input type="radio" name="${id}" id="${id}-${index + 1}" class="mc-r${index + 1}"${index === 0 ? " checked" : ""} style="display:none;">`
  ).join("");
  const arrow = (target: number, symbol: string, side: "left" | "right") =>
    `<label for="${id}-${target}" class="mc-arrow" style="position:absolute;top:40%;${side}:6px;width:34px;height:34px;line-height:34px;text-align:center;border-radius:17px;background:rgba(17,17,17,0.6);color:#FFFFFF;font-family:Arial,sans-serif;font-size:20px;cursor:pointer;">${symbol}</label>`;
  const slidesHtml = items.map((slide, index) => {
    const prev = index === 0 ? items.length : index;
    const next = index === items.length - 1 ? 1 : index + 2;
    return `<div class="mc-slide mc-s${index + 1}" style="position:relative;">${slide.content}${arrow(prev, "&#8249;", "left")}${arrow(next, "&#8250;", "right")}</div>`;
  }).join("");
  const nav = items.map((slide, index) => slide.thumb
    ? `<label for="${id}-${index + 1}" class="mc-thumb mc-d${index + 1}" style="display:inline-block;width:56px;height:56px;margin:6px 3px 0 3px;cursor:pointer;border:2px solid transparent;overflow:hidden;"><img src="${escapeHtml(mailImageUrl(slide.thumb.url))}" alt="" width="56" height="56" style="display:block;width:56px;height:56px;object-fit:cover;border:0;background-color:#FFFFFF;"></label>`
    : `<label for="${id}-${index + 1}" class="mc-dot mc-d${index + 1}" style="display:inline-block;width:10px;height:10px;margin:10px 4px 0 4px;border-radius:5px;background:#CCCCCC;cursor:pointer;"></label>`
  ).join("");
  // Le carrousel ne s'affiche que si le client conserve les boutons radio et gère :checked ;
  // sinon (Gmail, Outlook…) la version de repli reste visible.
  return `<div class="mc-carousel"><!--[if !mso]><!-->${radios}<div class="mc-interactive" style="display:none;max-height:0;overflow:hidden;mso-hide:all;"><div class="mc-slides">${slidesHtml}</div><div class="mc-nav" style="text-align:center;">${nav}</div></div><!--<![endif]--><div class="mc-fallback">${fallback}</div></div>`;
}

function imagesHtml(item: MailItem, doc: MailDocument, theme: Theme, width: number): string {
  const images = selectedImages(item);
  if (images.length === 0 || doc.imageLayout === "none") return "";
  const href = item.showLink ? siteItemUrl(item.article) : null;
  const alt = item.article.name;
  switch (doc.imageLayout) {
    case "gallery":
      return galleryHtml(images, alt, width, doc.galleryColumns, href);
    case "hero-thumbs":
      return heroThumbsHtml(images, alt, width, href);
    case "slider":
      return carouselHtml(
        images.map((image) => ({ content: imageTag(image, alt, width, href), thumb: image })),
        heroThumbsHtml(images, alt, width, href),
        String(item.article.id)
      );
    default:
      return imageTag(images[0], alt, width, href);
  }
}

function itemTextHtml(item: MailItem, theme: Theme, align: string): string {
  const href = item.showLink ? siteItemUrl(item.article) : null;
  const name = `<h3 style="margin:0 0 6px 0;font-family:${theme.fontFamily};font-size:19px;line-height:1.3;color:#111111;text-align:${align};">${escapeHtml(item.article.name)}</h3>`;
  const price = theme.showPrices && item.showPrice
    ? `<p style="margin:0 0 10px 0;font-family:${theme.fontFamily};font-size:17px;font-weight:bold;color:${theme.accent};text-align:${align};">${escapeHtml(formatPrice(item.article.price))}</p>`
    : "";
  const body = item.text.trim()
    ? paragraphs(item.text).map((part) => `<p style="margin:0 0 10px 0;font-family:${theme.fontFamily};font-size:14px;line-height:1.55;color:#555555;text-align:${align};">${formatInline(part, theme.accent)}</p>`).join("")
    : "";
  const link = href ? button("Voir l'objet", href, theme, align) : "";
  return name + price + body + link;
}

function planCardHtml(plan: (typeof subscriptionPlans)[number], theme: Theme, align: string): string {
  const line = (content: string, style: string) =>
    `<p style="margin:0 0 8px 0;font-family:${theme.fontFamily};text-align:${align};${style}">${content}</p>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="background-color:#FFFFFF;border:1px solid #E5E5E5;border-top:4px solid ${theme.accent};border-radius:6px;"><tr><td style="padding:18px;">`
    + line(escapeHtml(plan.badge.toUpperCase()), `font-size:11px;font-weight:bold;letter-spacing:1px;color:${theme.accent};`)
    + `<h3 style="margin:0 0 8px 0;font-family:${theme.fontFamily};font-size:20px;line-height:1.3;color:#111111;text-align:${align};">${escapeHtml(plan.name)}</h3>`
    + line(escapeHtml(plan.price), "font-size:22px;font-weight:bold;color:#111111;")
    + line(`Commission : <strong>${escapeHtml(plan.commission)}</strong>`, "font-size:14px;color:#333333;")
    + line(escapeHtml(plan.features), "font-size:14px;line-height:1.55;color:#555555;")
    + button("Choisir cette formule", SELLER_URL, theme, align)
    + `</td></tr></table>`;
}

function plansHtml(doc: MailDocument, theme: Theme): string {
  const plans = selectedPlans(doc);
  if (plans.length === 0) return "";
  const align = theme.align === "justify" ? "left" : theme.align;
  const cardWidth = Math.floor((CONTENT_WIDTH - 16) / 2);
  let rows = "";
  for (let start = 0; start < plans.length; start += 2) {
    const pair = plans.slice(start, start + 2);
    // Une formule seule sur sa ligne garde toute la largeur.
    rows += pair.length === 1
      ? `<tr><td valign="top" style="padding-bottom:16px;">${planCardHtml(pair[0], theme, align)}</td></tr>`
      : `<tr>${pair.map((plan, offset) => `<td class="mc-col" width="${cardWidth}" valign="top" style="width:${cardWidth}px;${offset === 0 ? "padding-right:16px;" : ""}padding-bottom:16px;">${planCardHtml(plan, theme, align)}</td>`).join("")}</tr>`;
  }
  const details = `<p style="margin:4px 0 0 0;font-family:${theme.fontFamily};font-size:13px;line-height:1.5;color:#555555;text-align:${align};">Détail des commissions et des versements : <a href="${SELLER_PRICING_URL}" target="_blank" style="color:${theme.accent};text-decoration:underline;">fonctionnement des paiements</a>.</p>`;
  return `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>${details}</td></tr>${spacer(24)}`;
}

const spacer = (height: number) =>
  `<tr><td style="height:${height}px;line-height:${height}px;font-size:${height}px;">&nbsp;</td></tr>`;

function itemsHtml(doc: MailDocument, theme: Theme): string {
  const items = doc.items;
  if (items.length === 0) return "";
  const align = theme.align === "justify" ? "left" : theme.align;

  if (doc.objectLayout === "carousel") {
    const slides = items.map((item) => {
      const image = selectedImages(item)[0];
      const href = item.showLink ? siteItemUrl(item.article) : null;
      return {
        content: `${image ? imageTag(image, item.article.name, CONTENT_WIDTH, href) : ""}<div style="padding:14px 4px 0 4px;">${itemTextHtml(item, theme, "center")}</div>`,
        thumb: image
      };
    });
    const fallback = items.map((item) => {
      const image = selectedImages(item)[0];
      const href = item.showLink ? siteItemUrl(item.article) : null;
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${image ? `<tr><td>${imageTag(image, item.article.name, CONTENT_WIDTH, href)}</td></tr>` : ""}<tr><td style="padding:14px 0 0 0;">${itemTextHtml(item, theme, "center")}</td></tr>${spacer(24)}</table>`;
    }).join("");
    return `<tr><td>${carouselHtml(slides, fallback, "objects")}</td></tr>`;
  }

  if (doc.objectLayout === "cards") {
    const cardWidth = Math.floor((CONTENT_WIDTH - 16) / 2);
    let rows = "";
    for (let start = 0; start < items.length; start += 2) {
      const cells = [items[start], items[start + 1]].map((item, offset) => {
        const padding = offset === 0 ? "padding-right:16px;" : "";
        if (!item) return `<td class="mc-col" width="${cardWidth}" style="width:${cardWidth}px;">&nbsp;</td>`;
        return `<td class="mc-col" width="${cardWidth}" valign="top" style="width:${cardWidth}px;${padding}padding-bottom:24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E5E5E5;border-radius:6px;"><tr><td style="padding:0;">${imagesHtml(item, doc, theme, cardWidth)}</td></tr><tr><td style="padding:14px;">${itemTextHtml(item, theme, align)}</td></tr></table></td>`;
      }).join("");
      rows += `<tr>${cells}</tr>`;
    }
    return `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr>`;
  }

  if (doc.objectLayout === "list" || doc.objectLayout === "zigzag") {
    const imageWidth = 220;
    const textWidth = CONTENT_WIDTH - imageWidth - 24;
    return items.map((item, index) => {
      const images = imagesHtml(item, doc, theme, imageWidth);
      const textCell = `<td class="mc-col" width="${textWidth}" valign="top" style="width:${textWidth}px;">${itemTextHtml(item, theme, align)}</td>`;
      if (!images) return `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${textCell}</tr></table></td></tr>${spacer(28)}`;
      const imageFirst = doc.objectLayout === "list" || index % 2 === 0;
      const imageCell = (side: "left" | "right") =>
        `<td class="mc-col" width="${imageWidth}" valign="top" style="width:${imageWidth}px;${side === "left" ? "padding-right:24px;" : "padding-left:24px;"}">${images}</td>`;
      // dir="rtl" permet d'afficher l'image à droite tout en la gardant en premier sur mobile.
      const row = imageFirst
        ? `<tr>${imageCell("left")}${textCell}</tr>`
        : `<tr>${imageCell("right").replace('<td class="mc-col"', '<td class="mc-col" dir="ltr"')}${textCell.replace('<td class="mc-col"', '<td class="mc-col" dir="ltr"')}</tr>`;
      return `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"${imageFirst ? "" : ' dir="rtl"'}>${row}</table></td></tr>${spacer(28)}`;
    }).join("");
  }

  return items.map((item) => {
    const images = imagesHtml(item, doc, theme, CONTENT_WIDTH);
    return `${images ? `<tr><td>${images}</td></tr>${spacer(14)}` : ""}<tr><td>${itemTextHtml(item, theme, align)}</td></tr>${spacer(32)}`;
  }).join("");
}

function textBlockHtml(value: string, doc: MailDocument, theme: Theme, allowColumns = true): string {
  if (!value.trim()) return "";
  if (doc.textLayout === "boxed") {
    return `<tr><td style="padding:20px 22px 6px 22px;background:${theme.accentSoft};border-left:4px solid ${theme.accent};border-radius:4px;">${paragraphHtml(value, theme)}</td></tr>${spacer(24)}`;
  }
  if (doc.textLayout === "two-columns" && allowColumns) {
    const parts = paragraphs(value);
    if (parts.length > 1) {
      const middle = Math.ceil(parts.length / 2);
      const columnWidth = Math.floor((CONTENT_WIDTH - 24) / 2);
      const column = (list: string[], left: boolean) =>
        `<td class="mc-col" width="${columnWidth}" valign="top" style="width:${columnWidth}px;${left ? "padding-right:24px;" : ""}">${paragraphHtml(list.join("\n\n"), theme)}</td>`;
      return `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${column(parts.slice(0, middle), true)}${column(parts.slice(middle), false)}</tr></table></td></tr>${spacer(12)}`;
    }
  }
  const extra = doc.textLayout === "letter" ? "font-size:17px;" : "";
  return `<tr><td>${paragraphHtml(value, theme, theme.align, extra)}</td></tr>${spacer(12)}`;
}

const carouselCss = Array.from({ length: MAX_SLIDES }, (_, index) => {
  const n = index + 1;
  return `.mc-r${n}:checked ~ .mc-interactive .mc-s${n}{display:block !important;}.mc-r${n}:checked ~ .mc-interactive .mc-d${n}{border-color:#111111 !important;background:#111111 !important;}`;
}).join("");

function headStyles(): string {
  return `<style type="text/css">
body{margin:0;padding:0;}
table{border-collapse:collapse;}
img{-ms-interpolation-mode:bicubic;}
.mc-slide{display:none;}
.mc-carousel input:checked ~ .mc-interactive{display:block !important;max-height:none !important;overflow:visible !important;}
.mc-carousel input:checked ~ .mc-fallback{display:none !important;}
${carouselCss}
u + .mc-body .mc-interactive{display:none !important;max-height:0 !important;overflow:hidden !important;}
u + .mc-body .mc-fallback{display:block !important;}
@media only screen and (max-width:620px){
.mc-container{width:100% !important;}
.mc-pad{padding-left:16px !important;padding-right:16px !important;}
.mc-col{display:block !important;width:100% !important;padding:0 0 16px 0 !important;}
.mc-img{width:100% !important;max-width:100% !important;height:auto !important;}
}
</style>`;
}

export interface RenderedMail {
  html: string;
  text: string;
}

function contactBlockHtml(doc: MailDocument, theme: Theme): string {
  const terms = doc.showProfessionalTerms ? doc.professionalTerms.trim() : "";
  const appointmentUrl = doc.showAppointment ? safeUrl(doc.appointmentUrl) : null;
  if (!terms && !appointmentUrl) return "";
  const heading = appointmentUrl ? "Échangeons sur votre projet" : "Conditions professionnelles";
  const align = theme.align === "justify" ? "left" : theme.align;
  const appointment = appointmentUrl
    ? `<tr><td align="${align}" style="padding-top:${terms ? 8 : 0}px;">${button("Planifier un appel", appointmentUrl, theme, align)}</td></tr>`
    : "";
  return `<tr><td class="mc-contact" bgcolor="${theme.accentSoft}" style="padding:24px;background-color:${theme.accentSoft};border-radius:6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td><h2 style="margin:0 0 12px;font-family:${theme.fontFamily};font-size:19px;line-height:1.35;color:#111111;text-align:${align};">${heading}</h2>${terms ? paragraphHtml(terms, theme, theme.align, "font-size:14px;") : ""}</td></tr>${appointment}</table></td></tr>${spacer(24)}`;
}

export function renderMail(doc: MailDocument): RenderedMail {
  carouselCounter = 0;
  const theme = themeFor(doc);
  const headerAlign = doc.textLayout === "centered" || doc.textLayout === "letter" ? "center" : "left";
  const logo = doc.showLogo
    ? `<tr><td align="${headerAlign}" style="padding:0 0 20px 0;border-bottom:3px solid ${theme.accent};"><a href="${SITE_URL}" target="_blank"><img src="${LOGO_URL}" alt="Daisy Brocante" width="140" style="display:${headerAlign === "center" ? "inline-block" : "block"};width:140px;height:auto;border:0;"></a></td></tr>${spacer(24)}`
    : "";
  const title = doc.title.trim()
    ? `<tr><td><h1 style="margin:0 0 18px 0;font-family:${theme.fontFamily};font-size:${doc.textLayout === "centered" ? 30 : 26}px;line-height:1.25;color:#111111;text-align:${theme.align === "justify" ? "left" : theme.align};">${escapeHtml(doc.title.trim())}</h1></td></tr>`
    : "";
  const signatureAlign = doc.textLayout === "letter" ? "right" : theme.align === "justify" ? "left" : theme.align;
  const signature = doc.signature.trim()
    ? `<tr><td class="mc-signature" style="border-top:1px solid #E5E5E5;padding-top:20px;">${paragraphHtml(doc.signature, theme, signatureAlign, doc.textLayout === "letter" ? "font-style:italic;" : "font-weight:bold;")}</td></tr>`
    : "";
  const mailingAddress = doc.mailingAddress.trim()
    ? `<tr><td class="mc-mailing-address" style="padding:0 24px 12px;font-family:${theme.fontFamily};font-size:11px;line-height:1.5;color:#777777;text-align:${signatureAlign};">${escapeHtml(doc.mailingAddress.trim()).replace(/\r?\n/g, "<br>")}</td></tr>`
    : "";
  const ctaAlign = theme.align === "center" ? "center" : "left";
  const cta = button(doc.ctaLabel, doc.ctaUrl, theme, ctaAlign);
  const footer = doc.footer.trim()
    ? `<tr><td class="mc-pad" style="padding:20px 24px;font-family:${theme.fontFamily};font-size:12px;line-height:1.5;color:#888888;text-align:center;">${paragraphs(doc.footer).map((part) => formatInline(part, "#888888")).join("<br><br>")}</td></tr>`
    : "";
  const preheader = doc.preheader.trim()
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#ffffff;opacity:0;">${escapeHtml(doc.preheader.trim())}${"&nbsp;&zwnj;".repeat(40)}</div>`
    : "";
  const outerPadding = doc.textLayout === "letter" ? 48 : 24;

  const body = [
    logo,
    title,
    textBlockHtml(doc.intro, doc, theme, false),
    (doc.contentMode === "subscriptions" ? doc.plans.length : doc.items.length) ? spacer(8) : "",
    doc.contentMode === "subscriptions" ? plansHtml(doc, theme) : itemsHtml(doc, theme),
    cta ? `<tr><td>${cta}</td></tr>${spacer(20)}` : "",
    textBlockHtml(doc.outro, doc, theme),
    contactBlockHtml(doc, theme),
    signature,
    mailingAddress
  ].join("");

  const html = `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, address=no, email=no">
<title>${escapeHtml(doc.subject || doc.title)}</title>
${headStyles()}
</head>
<body class="mc-body" style="margin:0;padding:0;background:#F4F1EA;">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EA;"><tr><td align="center" style="padding:24px 8px;">
<table role="presentation" class="mc-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#FFFFFF;border-radius:6px;">
<tr><td class="mc-pad" style="padding:32px ${outerPadding}px 24px ${outerPadding}px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body}</table>
</td></tr>
</table>
<table role="presentation" class="mc-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">${footer}</table>
</td></tr></table>
</body>
</html>`;

  return { html, text: renderPlainText(doc) };
}

function stripMarkup(value: string): string {
  return value.replace(/\*\*(.+?)\*\*/g, "$1").trim();
}

export function renderPlainText(doc: MailDocument): string {
  const blocks: string[] = [];
  if (doc.title.trim()) blocks.push(doc.title.trim().toUpperCase());
  if (doc.intro.trim()) blocks.push(stripMarkup(doc.intro));
  if (doc.contentMode === "subscriptions") {
    for (const plan of selectedPlans(doc)) {
      blocks.push([`— Formule ${plan.name} : ${plan.price}`, `Commission : ${plan.commission}`, plan.features].join("\n"));
    }
    if (doc.plans.length) blocks.push(`Choisir une formule : ${SELLER_URL}\nDétail des commissions et des versements : ${SELLER_PRICING_URL}`);
  }
  for (const item of doc.contentMode === "objects" ? doc.items : []) {
    const lines = [`— ${item.article.name}`];
    if (doc.showPrices && item.showPrice) lines.push(formatPrice(item.article.price));
    if (item.text.trim()) lines.push(stripMarkup(item.text));
    if (item.showLink) lines.push(siteItemUrl(item.article));
    blocks.push(lines.join("\n"));
  }
  const ctaUrl = safeUrl(doc.ctaUrl);
  if (doc.ctaLabel.trim() && ctaUrl) blocks.push(`${doc.ctaLabel.trim()} : ${ctaUrl}`);
  if (doc.outro.trim()) blocks.push(stripMarkup(doc.outro));
  if (doc.showProfessionalTerms && doc.professionalTerms.trim()) blocks.push(stripMarkup(doc.professionalTerms));
  const appointmentUrl = safeUrl(doc.appointmentUrl);
  if (doc.showAppointment && appointmentUrl) blocks.push(`Planifier un appel : ${appointmentUrl}`);
  if (doc.signature.trim()) blocks.push(stripMarkup(doc.signature));
  if (doc.mailingAddress.trim()) blocks.push(doc.mailingAddress.trim());
  if (doc.footer.trim()) blocks.push(`--\n${stripMarkup(doc.footer)}`);
  return blocks.join("\n\n");
}

// Version d'aperçu forçant l'affichage de repli (Gmail, Outlook…) des sliders.
export function fallbackPreview(html: string): string {
  return html.replace("</head>", `<style>.mc-interactive{display:none !important;max-height:0 !important;}.mc-fallback{display:block !important;}</style></head>`);
}
