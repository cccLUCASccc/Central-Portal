import { test } from "node:test";
import assert from "node:assert/strict";
import { documentDownloadName, documentSortDate, documentTitle } from "./document-names";

const legacyDocument = {
    folder: "achats",
    subfolder: "marchandise",
    title: "Scan fournisseur",
    file_name: "scan.PDF",
    created_at: "2026-11-19T23:30:00-03:00",
};

test("names merchandise documents even when the API returns the original title and no sort date", () => {
    assert.equal(documentSortDate(legacyDocument), "2026-11-19");
    assert.equal(documentTitle(legacyDocument), "FACTURE-ACHAT-MAR-2026-11-19");
    assert.equal(documentDownloadName(legacyDocument), "FACTURE-ACHAT-MAR-2026-11-19.PDF");
});

test("uses the current badge date rather than a stale API name", () => {
    const edited = { ...legacyDocument, sort_date: "2026-10-04", download_name: "FACTURE-ACHAT-MAR-2026-11-19.PDF" };
    assert.equal(documentTitle(edited), "FACTURE-ACHAT-MAR-2026-10-04");
    assert.equal(documentDownloadName(edited), "FACTURE-ACHAT-MAR-2026-10-04.PDF");
    assert.equal(documentTitle({ ...edited, sort_date: "" }), "FACTURE-ACHAT-MAR-2026-11-19");
});

test("preserves the original names outside merchandise purchases", () => {
    const material = { ...legacyDocument, subfolder: "materiel" };
    assert.equal(documentTitle(material), material.title);
    assert.equal(documentDownloadName(material), material.file_name);
});
