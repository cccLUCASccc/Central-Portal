import { test } from "node:test";
import assert from "node:assert/strict";
import { expandInventoryUnits } from "./inventory-export";
import { categoryGroup, inventoryUnits, matchesSaleFilter, summarizeUnits } from "./inventory-units";

test("exporte une ligne par unité en conservant les autres données", () => {
    const items = [
        { code: "D0001", quantite: 3, emplacement: "sallon", prix_achat: 10 },
        { code: "D0002", quantite: 0, emplacement: null, prix_achat: 20 },
        { code: "D0003", quantite: null, emplacement: "garage", prix_achat: null },
    ];
    assert.deepEqual(expandInventoryUnits(items), [
        { code: "D0001", quantite: 1, emplacement: "sallon", prix_achat: 10 },
        { code: "D0001", quantite: 1, emplacement: "sallon", prix_achat: 10 },
        { code: "D0001", quantite: 1, emplacement: "sallon", prix_achat: 10 },
        { code: "D0003", quantite: 1, emplacement: "garage", prix_achat: null },
    ]);
    assert.equal(items[0].quantite, 3);
});

test("utilise le nom facultatif de chaque exemplaire, sinon celui du lot", () => {
    const items = [{ nom: "Vase", quantite: 3, noms_exemplaires: ["Vase bleu", "", "Vase vert", "Masqué"] }];
    assert.deepEqual(expandInventoryUnits(items).map((item) => item.nom), ["Vase bleu", "Vase", "Vase vert"]);
    assert.equal(items[0].nom, "Vase");
});

test("filtre et exporte les ventes individuelles avec leurs prix propres", () => {
    const items = [{
        nom: "Vase", quantite: 3, vendu: false, prix_vente: 20,
        noms_exemplaires: ["Bleu", "", ""],
        ventes_exemplaires: [
            { vendu: true, prix_vente: 15, prix_personnalise: true },
            { vendu: false, prix_vente: null, prix_personnalise: false },
            { vendu: true, prix_vente: null, prix_personnalise: true },
        ],
    }];
    const sold = expandInventoryUnits(items, "yes");
    assert.deepEqual(sold.map((item) => [item.nom, item.vendu, item.prix_vente]), [["Bleu", true, 15], ["Vase", true, null]]);
    const unsold = expandInventoryUnits(items, "no");
    assert.deepEqual(unsold.map((item) => [item.vendu, item.prix_vente]), [[false, 20]]);
    assert.deepEqual(summarizeUnits(items[0], "yes"), { count: 2, sales: 15, missing: 1 });
    assert.deepEqual(summarizeUnits(items[0], "no"), { count: 1, sales: 20, missing: 0 });
    assert.deepEqual(summarizeUnits({ quantite: 3, vendu: true, prix_vente: 8 }, "yes"), { count: 3, sales: 24, missing: 0 });
    assert.equal(inventoryUnits({ quantite: 2, vendu: true, prix_vente: 8 }).filter((u) => matchesSaleFilter(u.vendu, "yes")).length, 2);
});

test("conserve les catégories d'origine inconnues à classer", () => {
    assert.equal(categoryGroup({ categorie: "Déco" }), "DECO");
    assert.equal(categoryGroup({ categorie: "Céramique" }), "A_CLASSER");
    assert.equal(categoryGroup({ categorie: "Céramique", classement: "AUTRE" }), "AUTRE");
});
