import { test } from "node:test";
import assert from "node:assert/strict";
import {
  draftKey,
  initialPublicationText,
  inventoryURL,
  readDraft,
  readInventoryResponse,
  type PublicationArticle
} from "./social-publication";

const article: PublicationArticle = {
  id: 12,
  name: "Miroir ancien",
  description: "Cadre doré.",
  price: 125,
  status: 0,
  images: [{ id: 4, url: "https://example.com/mirror.jpg" }]
};
const pagination = { total_items: 25, total_pages: 3, current_page: 2, page_size: 12 };

test("requests active Daisy inventory on the requested page", () => {
  const url = new URL(inventoryURL("https://api.example.com/", 2));
  assert.equal(url.pathname, "/api/antiquites");
  assert.equal(url.searchParams.get("status"), "0");
  assert.equal(url.searchParams.get("shop_id"), "daisy");
  assert.equal(url.searchParams.get("page"), "2");
  assert.equal(url.searchParams.get("limit"), "12");
  assert.throws(() => inventoryURL(undefined, 1), /API_URL/);
});

test("reads active inventory and pagination, including articles without images", async () => {
  assert.deepEqual(await readInventoryResponse(Response.json({ data: [article], pagination })), { data: [article], pagination });
  const result = await readInventoryResponse(Response.json({ data: [{ ...article, images: null }], pagination }));
  assert.deepEqual(result.data[0].images, []);
  const emptyPagination = { total_items: 0, total_pages: 0, current_page: 1, page_size: 12 };
  assert.deepEqual(await readInventoryResponse(Response.json({ data: [], pagination: emptyPagination })), { data: [], pagination: emptyPagination });
});

test("never accepts sold or inactive inventory articles", async () => {
  for (const status of [1, 2]) {
    await assert.rejects(readInventoryResponse(Response.json({ data: [{ ...article, status }], pagination })), /vendu ou inactif/);
  }
});

test("reports HTTP, malformed inventory, and malformed pagination errors", async () => {
  await assert.rejects(readInventoryResponse(Response.json({ error: "Session expirée" }, { status: 401 })), /HTTP 401.*Session expirée/);
  await assert.rejects(readInventoryResponse(new Response("Bad gateway", { status: 502 })), /HTTP 502/);
  await assert.rejects(readInventoryResponse(Response.json({ data: [article], pagination: null })), /pagination valide/);
  await assert.rejects(readInventoryResponse(Response.json({ data: [{ ...article, price: "125" }], pagination })), /article invalide/);
});

test("prefills a plain-text publication without invented content", () => {
  const text = initialPublicationText(article);
  assert.ok(text.includes(article.name));
  assert.ok(text.includes(article.description));
  assert.ok(text.includes("125"));
  assert.ok(text.includes("€"));
  assert.ok(!text.includes("http"));
});

test("isolates drafts by user, network and article", () => {
  const keys = [
    draftKey("alice", "facebook", 12),
    draftKey("bob", "facebook", 12),
    draftKey("alice", "instagram", 12),
    draftKey("alice", "tiktok", 12),
    draftKey("alice", "facebook", 13)
  ];
  assert.equal(new Set(keys).size, keys.length);
});

test("migrates single-photo drafts and rejects damaged or unrelated drafts", () => {
  const draft = { version: 1, articleId: 12, text: "Mon texte\n#brocante", imageId: 4, savedAt: "2026-10-06T09:00:00.000Z" };
  assert.deepEqual(readDraft(JSON.stringify(draft), 12), {
    version: 2, articleId: 12, text: draft.text, imageIds: [4], savedAt: draft.savedAt
  });
  assert.deepEqual(readDraft(JSON.stringify({ ...draft, imageId: null }), 12).imageIds, []);
  assert.throws(() => readDraft(JSON.stringify(draft), 13), /invalide/);
  assert.throws(() => readDraft(JSON.stringify({ ...draft, imageId: "4" }), 12), /invalide/);
  assert.throws(() => readDraft(JSON.stringify({ ...draft, savedAt: "invalid" }), 12), /invalide/);
  assert.throws(() => readDraft("{invalid", 12));
});

test("restores multiple photos and rejects invalid selections", () => {
  const draft = { version: 2, articleId: 12, text: "Publication avec plusieurs photos", imageIds: [4, 7, 9], savedAt: "2026-10-06T09:00:00.000Z" };
  assert.deepEqual(readDraft(JSON.stringify(draft), 12), draft);
  assert.deepEqual(readDraft(JSON.stringify({ ...draft, imageIds: [] }), 12).imageIds, []);
  for (const imageIds of [[4, 4], ["4"], [0], [-1], null]) {
    assert.throws(() => readDraft(JSON.stringify({ ...draft, imageIds }), 12), /invalides/);
  }
  assert.throws(() => readDraft(JSON.stringify({ ...draft, version: 3 }), 12), /invalides/);
});
