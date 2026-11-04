import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultDocument } from "./mail-composer";
import {
  defaultSavedName, readSavedJSON, readSavedList, readSavedMail, readSavedWrite, savedMailPath, savedMailPayload
} from "./mail-saved";

const mail = { id: 3, name: "Décorateurs", subject: "Objet", version: 2, created_by: "a", updated_by: "b", updated_at: "2025-01-02T10:00:00Z" };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

test("builds payloads and paths", () => {
  const document = defaultDocument();
  assert.deepEqual(savedMailPayload("  Nom ", { document, recipients: "a@b.c", replyTo: "" }), {
    name: "Nom", content: { version: 1, document, recipients: "a@b.c", replyTo: "" }
  });
  assert.equal(savedMailPayload("Nom", { document, recipients: "", replyTo: "" }, 4).version, 4);
  assert.equal(savedMailPath(), "/api/mails/saved");
  assert.equal(savedMailPath(3), "/api/mails/saved/3");
  assert.equal(savedMailPath(3, 2), "/api/mails/saved/3?version=2");
  assert.equal(defaultSavedName({ subject: "  Un\n objet ", title: "" }), "Un objet");
  assert.equal(defaultSavedName({ subject: "", title: "" }), "Mail sans titre");
});

test("validates list, write and detail responses", async () => {
  assert.deepEqual(await readSavedList(json({ data: [mail] })), [mail]);
  await assert.rejects(readSavedList(json({ data: [{ ...mail, id: 0 }] })), /invalide/);
  await assert.rejects(readSavedList(json({})), /invalide/);
  assert.deepEqual(await readSavedWrite(json({ mail }), { name: "Décorateurs", version: 1 }), mail);
  await assert.rejects(readSavedWrite(json({ mail }), { name: "Décorateurs" }), /pas été confirmé/);
  await assert.rejects(readSavedWrite(json({ mail }), { name: "Autre", version: 1 }), /pas été confirmé/);
  const document = { ...defaultDocument(), contentMode: "subscriptions", plans: ["premium"] };
  const detail = await readSavedMail(json({ mail, content: { version: 1, document, recipients: "x@y.z", replyTo: "" } }));
  assert.equal(detail.mail.id, 3);
  assert.equal(detail.draft.document.contentMode, "subscriptions");
  assert.equal(detail.draft.recipients, "x@y.z");
  await assert.rejects(readSavedMail(json({ mail, content: { version: 2 } })), /invalide/);
});

test("reports API errors explicitly", async () => {
  await assert.rejects(readSavedJSON(json({ error: "modifié par quelqu'un d'autre" }, 409)), /HTTP 409 : modifié/);
  await assert.rejects(readSavedJSON(new Response("oops", { status: 502 })), /illisible \(HTTP 502\)/);
});
