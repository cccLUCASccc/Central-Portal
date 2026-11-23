export function expandInventoryUnits<T extends { quantite: number | null; nom?: string; noms_exemplaires?: string[] | null }>(items: T[]): T[] {
    return items.flatMap((item) =>
        Array.from({ length: item.quantite ?? 1 }, (_, index) => ({
            ...item,
            quantite: 1,
            ...(item.noms_exemplaires?.[index] ? { nom: item.noms_exemplaires[index] } : {}),
        })),
    );
}
