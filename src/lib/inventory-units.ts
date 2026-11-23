export interface UnitSale {
    vendu: boolean;
    prix_vente: number | null;
    prix_personnalise: boolean;
}

export interface InventoryUnits {
    quantite: number | null;
    vendu?: boolean | null;
    prix_vente?: number | null;
    ventes_exemplaires?: UnitSale[] | null;
}

export type SaleFilter = "all" | "yes" | "no";
export type Classification = "DECO" | "MOBILIER" | "BIJOUX" | "AUTRE" | "A_CLASSER";
export type CategoryGroup = Classification;

export const CATEGORY_GROUPS: CategoryGroup[] = ["DECO", "MOBILIER", "BIJOUX", "AUTRE", "A_CLASSER"];

export function categoryGroup(item: { classement?: string | null; categorie: string }): CategoryGroup {
    const category = (item.classement || item.categorie).trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    return CATEGORY_GROUPS.find((group) => group !== "A_CLASSER" && group === category) ?? "A_CLASSER";
}

export function inventoryUnits(item: InventoryUnits) {
    return Array.from({ length: item.quantite ?? 1 }, (_, index) => {
        const sale = item.ventes_exemplaires?.[index];
        return {
            index,
            vendu: sale?.vendu ?? (item.vendu === true),
            prix_vente: sale?.prix_personnalise ? sale.prix_vente : (item.prix_vente ?? null),
        };
    });
}

export function matchesSaleFilter(vendu: boolean, filter: SaleFilter) {
    return filter === "all" || (filter === "yes") === vendu;
}

export function summarizeUnits(item: InventoryUnits, filter: SaleFilter = "all") {
    const quantity = item.quantite ?? 1;
    const sales = item.ventes_exemplaires ?? [];
    const summary = { count: 0, sales: 0, missing: 0 };
    const add = (count: number, vendu: boolean, price: number | null) => {
        if (!matchesSaleFilter(vendu, filter)) return;
        summary.count += count;
        if (price == null) summary.missing += count;
        else summary.sales += count * price;
    };
    const recorded = Math.min(quantity, sales.length);
    for (let index = 0; index < recorded; index++) {
        const sale = sales[index];
        add(1, sale.vendu, sale.prix_personnalise ? sale.prix_vente : (item.prix_vente ?? null));
    }
    add(quantity - recorded, item.vendu === true, item.prix_vente ?? null);
    return summary;
}
