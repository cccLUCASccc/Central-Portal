import { test } from "node:test";
import assert from "node:assert/strict";
import { readUsersResponse } from "./users";

const user = {
  id: "user_1", name: "Marie", email: "marie@example.com",
  newsletter_subscribed: true, is_customer: true, is_seller: true,
  active_articles: 3, purchases: 2
};
const pagination = { total_items: 26, total_pages: 2, current_page: 1, page_size: 25 };

test("reads users and keeps all required fields and pagination", async () => {
  assert.deepEqual(await readUsersResponse(Response.json({ data: [user], pagination })), { data: [user], pagination });
});

test("handles empty user lists without inventing data", async () => {
  const result = await readUsersResponse(Response.json({ data: [], pagination: { ...pagination, total_items: 0, total_pages: 0 } }));
  assert.deepEqual(result.data, []);
});

test("surfaces access, Clerk and database errors", async () => {
  for (const status of [401, 403, 500, 502, 503]) {
    await assert.rejects(readUsersResponse(Response.json({ error: "Explication du serveur" }, { status })), new RegExp(`HTTP ${status}.*Explication du serveur`));
  }
});

test("rejects malformed counts, consent and pagination", async () => {
  for (const invalid of [{ ...user, purchases: -1 }, { ...user, active_articles: "3" }, { ...user, newsletter_subscribed: "true" }]) {
    await assert.rejects(readUsersResponse(Response.json({ data: [invalid], pagination })), /invalide/);
  }
  await assert.rejects(readUsersResponse(new Response("Bad gateway", { status: 502 })), /HTTP 502/);
  await assert.rejects(readUsersResponse(Response.json({ data: [user], pagination: null })), /invalide/);
});
