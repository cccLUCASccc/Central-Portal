import { test } from "node:test";
import assert from "node:assert/strict";
import { readAuthResponse } from "./channel-auth";
import { channels } from "./channels";

test("every channel has its own internal page", () => {
  assert.equal(channels.length, 5);
  assert.equal(new Set(channels.map((channel) => channel.href)).size, 5);
  for (const channel of channels) {
    assert.equal(channel.href, `/${channel.id}`);
  }
});

test("reads the authorization URL and confirmation", async () => {
  assert.deepEqual(await readAuthResponse(Response.json({ url: "https://auth.ebay.com/oauth2/authorize" })), {
    url: "https://auth.ebay.com/oauth2/authorize"
  });
  assert.deepEqual(await readAuthResponse(Response.json({ message: "Connexion réussie" })), {
    message: "Connexion réussie"
  });
});

test("preserves error explanations and resolution hints", async () => {
  await assert.rejects(
    readAuthResponse(Response.json({
      error: "Configuration OAuth manquante",
      details: "TIKTOK_CLIENT_KEY",
      hint: "Configurez l'application développeur"
    }, { status: 400 })),
    (error: Error) => {
      for (const part of ["HTTP 400", "Configuration OAuth manquante", "TIKTOK_CLIENT_KEY", "Configurez l'application développeur"]) {
        assert.ok(error.message.includes(part));
      }
      return true;
    }
  );
});

test("explains invalid and non-JSON server responses", async () => {
  await assert.rejects(readAuthResponse(new Response("<html>Bad gateway</html>", { status: 502 })), /non JSON \(HTTP 502\)/);
  await assert.rejects(readAuthResponse(Response.json(null)), /invalide/);
  await assert.rejects(readAuthResponse(Response.json([])), /invalide/);
  await assert.rejects(readAuthResponse(Response.json({}, { status: 401 })), /HTTP 401/);
});
