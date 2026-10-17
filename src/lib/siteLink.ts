const SITE_URL = "https://daisybrocante.com";

type Publishable = { name: string; status: number; approval_status?: string };

// Un objet est publié s'il est actif et approuvé sur le site.
export const isPublished = (item: Publishable) =>
    item.status === 0 && (!item.approval_status || item.approval_status === "approved");

export const siteItemUrl = (item: Pick<Publishable, "name">) =>
    `${SITE_URL}/boutique/${encodeURIComponent(item.name.replace(/\.+$/, "").trim())}`;
