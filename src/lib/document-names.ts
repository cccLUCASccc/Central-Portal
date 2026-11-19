interface DocumentNameFields {
    folder: string;
    subfolder: string;
    title: string;
    file_name: string;
    sort_date?: string;
    created_at: string;
}

export const documentSortDate = (d: Pick<DocumentNameFields, "sort_date" | "created_at">) =>
    d.sort_date || d.created_at.slice(0, 10);

export const hasAutomaticTitle = (d: Pick<DocumentNameFields, "folder" | "subfolder">) =>
    d.folder === "achats" && d.subfolder === "marchandise";

export const documentTitle = (d: DocumentNameFields) =>
    hasAutomaticTitle(d) ? `FACTURE-ACHAT-MAR-${documentSortDate(d)}` : d.title;

export function documentDownloadName(d: DocumentNameFields & { download_name?: string }) {
    if (!hasAutomaticTitle(d)) return d.download_name ?? d.file_name;
    const extensionStart = d.file_name.lastIndexOf(".");
    return documentTitle(d) + (extensionStart === -1 ? "" : d.file_name.slice(extensionStart));
}
