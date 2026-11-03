import { test } from "node:test";
import assert from "node:assert/strict";
import { contactEdit, contactPath, contactStatuses, readContactHistory, readContactPage, readContactsJSON, statusLabel, type MailContact } from "./mail-contacts";

const contact: MailContact = {
  email: "alice+studio@example.com", name: "Alice", company: "Studio", profession: "Décoratrice",
  status: "partner", do_not_contact: true, first_sent_at: "2026-11-01T10:00:00Z",
  last_sent_at: "2026-11-03T10:00:00Z", attempts: 4, sent_count: 2, failed_count: 1, blocked_count: 1, version: 1
};
const pagination = { current_page: 1, total_pages: 1, total_items: 1, page_size: 25 };
const response = (value: unknown, status = 200) => Response.json(value, { status });

test("reads contact identities, manual status, suppression and aggregate counts", async () => {
  const result = await readContactPage(response({ data: [contact], pagination }));
  assert.deepEqual(result.data[0], contact);
  assert.equal(result.pagination.page_size, 25);
  assert.equal(statusLabel("partner"), "Partenaire");
  assert.equal(contactStatuses.length, 6);
});

test("rejects malformed or unavailable contacts rather than displaying zero activity", async () => {
  for (const value of [
    {}, { data: [], pagination: {} },
    ...[{ status: "wrong" }, { do_not_contact: "false" }, { sent_count: -1 }, { first_sent_at: "bad" }, { attempts: null }]
      .map((fields) => ({ data: [{ ...contact, ...fields }], pagination }))
  ]) {
    await assert.rejects(readContactPage(response(value)), /invalide/);
  }
  await assert.rejects(readContactPage(response({ error: "Accès refusé" }, 403)), /403.*Accès refusé/);
  await assert.rejects(readContactPage(new Response("<html>", { status: 502 })), /illisible/);
});

test("only mutable profile fields are submitted and email path is encoded", () => {
  assert.deepEqual(contactEdit(contact), {
    name: "Alice", company: "Studio", profession: "Décoratrice", status: "partner", do_not_contact: true, version: 1
  });
  assert.equal(contactPath(contact.email), "/api/mails/contacts?email=alice%2Bstudio%40example.com");
  assert.equal(new URL(contactPath("a/b@example.com"), "https://api.test").searchParams.get("email"), "a/b@example.com");
  assert.equal(contactPath(contact.email, true), "/api/mails/contacts/history?email=alice%2Bstudio%40example.com");
});

test("reads sent, failed and blocked history and surfaces errors", async () => {
  const data = ["sent", "failed", "blocked"].map((status, index) => ({
    id: index + 1, recipient: contact.email, subject: "Partenariat", status,
    sent_by: "admin", created_at: contact.last_sent_at, error: status === "sent" ? undefined : "Erreur"
  }));
  assert.equal((await readContactHistory(response({ data, pagination }))).data.length, 3);
  await assert.rejects(readContactHistory(response({ data: [{ ...data[0], status: "read" }], pagination })), /invalide/);
  await assert.rejects(readContactsJSON(response({ error: "Enregistrement impossible" }, 500)), /Enregistrement impossible/);
});
