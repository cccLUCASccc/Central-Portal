import { test } from "node:test";
import assert from "node:assert/strict";
import { assistantOptions, assistantRequest, currentCopy, readMailCopy, type AssistantSettings } from "./mail-assistant";
import { defaultDocument } from "./mail-composer";

test("assistant sends only the six copy fields, settings and object names", () => {
  const doc = defaultDocument();
  doc.signature = "PRIVATE SIGNATURE";
  doc.footer = "PRIVATE FOOTER";
  doc.ctaUrl = "https://example.com/private";
  const settings: AssistantSettings = {
    objective: "partnership", audience: "decorator", tone: "warm", length: "short", instructions: "Proposer un échange."
  };
  const request = assistantRequest(doc, settings, "draft");
  assert.deepEqual(Object.keys(request).sort(), ["audience", "content_mode", "current", "instructions", "items", "length", "mode", "objective", "tone"]);
  assert.deepEqual(request.current, currentCopy(doc));
  assert.deepEqual(request.items, []);
  assert.equal(request.content_mode, "objects");
  assert.ok(!JSON.stringify(request).includes("PRIVATE"));
  assert.ok(!JSON.stringify(request).includes("https://example.com/private"));
  assert.equal(assistantOptions.tone.length, 4);
});

test("subscription mails describe only the selected plans to the assistant", () => {
  const doc = { ...defaultDocument(), contentMode: "subscriptions" as const, plans: ["amateur" as const, "premium" as const] };
  const request = assistantRequest(doc, {
    objective: "partnership", audience: "shop", tone: "warm", length: "short", instructions: "Inviter à ouvrir une boutique."
  }, "draft");
  assert.equal(request.content_mode, "subscriptions");
  assert.equal(request.items.length, 2);
  assert.match(request.items[0], /Amateur : 29 € \/ mois, commission 15 %/);
  assert.match(request.items[1], /Premium : 99 € \/ mois/);
  assert.ok(request.items.every((item) => item.length <= 500));
});

test("validates the complete AI response before application", () => {
  const copy = { ...currentCopy(defaultDocument()), subject: "Une collaboration" };
  assert.deepEqual(readMailCopy({ ...copy, unexpected: "ignored" }), copy);
  for (const invalid of [
    null, [], {}, { ...copy, intro: "" }, { ...copy, subject: "" },
    { ...copy, subject: "a\nb" }, { ...copy, preheader: "x".repeat(151) },
    { ...copy, intro: 42 }, { ...copy, ctaLabel: "x".repeat(101) }
  ]) {
    assert.throws(() => readMailCopy(invalid));
  }
});

test("applying copy cannot replace objects, layout, signature, footer or CTA destination", () => {
  const doc = defaultDocument();
  const suggestion = readMailCopy({ ...currentCopy(doc), subject: "Une collaboration", intro: "Nouvelle proposition.", signature: "overwrite", ctaUrl: "https://wrong.test" });
  const updated = { ...doc, ...suggestion };
  assert.equal(updated.intro, "Nouvelle proposition.");
  assert.equal(updated.signature, doc.signature);
  assert.equal(updated.footer, doc.footer);
  assert.equal(updated.ctaUrl, doc.ctaUrl);
  assert.equal(updated.items, doc.items);
  assert.equal(updated.objectLayout, doc.objectLayout);
});
