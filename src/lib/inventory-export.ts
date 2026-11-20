export function expandInventoryUnits<T extends { quantite: number | null }>(items: T[]): T[] {
    return items.flatMap((item) =>
        Array.from({ length: item.quantite ?? 1 }, () => ({ ...item, quantite: 1 })),
    );
}
