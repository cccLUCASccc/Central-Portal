import { inventoryUnits, matchesSaleFilter, type InventoryUnits, type SaleFilter } from "./inventory-units";

export function expandInventoryUnits<T extends InventoryUnits & { nom?: string; noms_exemplaires?: string[] | null }>(
    items: T[],
    filter: SaleFilter = "all",
): T[] {
    return items.flatMap((item) =>
        inventoryUnits(item).filter((unit) => matchesSaleFilter(unit.vendu, filter)).map((unit) => ({
            ...item,
            quantite: 1,
            ...(item.noms_exemplaires?.[unit.index] ? { nom: item.noms_exemplaires[unit.index] } : {}),
            ...("vendu" in item ? { vendu: unit.vendu } : {}),
            ...("prix_vente" in item ? { prix_vente: unit.prix_vente } : {}),
        })),
    );
}
