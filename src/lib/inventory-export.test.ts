import { test } from "node:test";
import assert from "node:assert/strict";
import { expandInventoryUnits } from "./inventory-export";

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
