import { test } from "node:test";
import assert from "node:assert/strict";
import { siteItemUrl } from "./siteLink";

test("preserves the exact object name in storefront links", () => {
    for (const name of [
        "Colonne en majolique décor au héron.",
        "Miroir...",
        "Objet / décor ? # & 50%",
        "Nom sans ponctuation",
        " Objet. "
    ]) {
        const url = new URL(siteItemUrl({ name }));
        assert.equal(decodeURIComponent(url.pathname.slice("/boutique/".length)), name);
    }
    assert.equal(
        siteItemUrl({ name: "Colonne en majolique décor au héron." }),
        "https://daisybrocante.com/boutique/Colonne%20en%20majolique%20d%C3%A9cor%20au%20h%C3%A9ron."
    );
});
