import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultDocument,
  draftKey,
  escapeHtml,
  fallbackPreview,
  formatInline,
  imageLayouts,
  inventorySearchURL,
  itemFromArticle,
  objectLayouts,
  parseRecipients,
  readDraft,
  renderMail,
  safeColor,
  safeUrl,
  textLayouts,
  type MailArticle,
  type MailDocument
} from "./mail-composer";

const article: MailArticle = {
  id: 7,
  name: "Miroir <doré>",
  description: "Cadre en bois doré, XIXe siècle.",
  price: 245,
  status: 0,
  images: [
    { id: 1, url: "https://api.example.com/api/antiquites/images/a.webp" },
    { id: 2, url: "https://api.example.com/api/antiquites/images/b.webp" },
    { id: 3, url: "https://api.example.com/api/antiquites/images/c.webp" }
  ]
};
const second: MailArticle = { ...article, id: 8, name: "Vase", images: [{ id: 9, url: "https://api.example.com/v.webp" }] };

function documentWith(overrides: Partial<MailDocument>): MailDocument {
  return { ...defaultDocument(), items: [itemFromArticle(article), itemFromArticle(second)], ...overrides };
}

test("escapes user content and only links safe URLs", () => {
  assert.equal(escapeHtml(`<a href="x">'&`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;");
  assert.equal(safeUrl("javascript:alert(1)"), null);
  assert.equal(safeUrl("https://daisybrocante.com/boutique"), "https://daisybrocante.com/boutique");
  assert.equal(safeColor("red"), "#C2185B");
  assert.equal(safeColor("#00aa11"), "#00AA11");
  const inline = formatInline("**Promo** <script> https://daisybrocante.com/a?b=1&c=2.", "#000000");
  assert.match(inline, /<strong>Promo<\/strong> &lt;script&gt;/);
  assert.match(inline, /href="https:\/\/daisybrocante.com\/a\?b=1&amp;c=2"/);
  assert.ok(!inline.includes("<script>"));
});

test("renders every image, object and text layout", () => {
  for (const imageLayout of imageLayouts.map((item) => item.id)) {
    for (const objectLayout of objectLayouts.map((item) => item.id)) {
      for (const textLayout of textLayouts.map((item) => item.id)) {
        const { html, text } = renderMail(documentWith({ imageLayout, objectLayout, textLayout, intro: "Un.\n\nDeux.\n\nTrois." }));
        assert.match(html, /^<!DOCTYPE html>/);
        assert.ok(html.includes("Miroir &lt;doré&gt;"), `${imageLayout}/${objectLayout}/${textLayout}`);
        assert.ok(!html.includes("Miroir <doré>"));
        assert.ok(text.includes("Miroir <doré>"));
        assert.ok(text.includes("https://daisybrocante.com/boutique/Miroir%20%3Cdor%C3%A9%3E"));
      }
    }
  }
});

test("image layouts include the selected photos", () => {
  const gallery = renderMail(documentWith({ imageLayout: "gallery", objectLayout: "stacked" })).html;
  assert.ok(gallery.includes("a.webp") && gallery.includes("b.webp") && gallery.includes("c.webp"));
  const single = renderMail(documentWith({ imageLayout: "single" })).html;
  assert.ok(single.includes("a.webp") && !single.includes("b.webp"));
  const none = renderMail(documentWith({ imageLayout: "none" })).html;
  assert.ok(!none.includes("a.webp"));
});

test("slider renders an interactive carousel with a fallback", () => {
  const { html } = renderMail(documentWith({ imageLayout: "slider", objectLayout: "stacked" }));
  assert.match(html, /<input type="radio" name="mc7-1" id="mc7-1-1" class="mc-r1" checked/);
  assert.ok(html.includes('for="mc7-1-3"'));
  assert.ok(html.includes('class="mc-fallback"'));
  assert.ok(html.includes(".mc-carousel input:checked ~ .mc-interactive"));
  // Un seul visuel : pas de carrousel pour le vase.
  assert.ok(!html.includes('name="mc8-'));
  assert.ok(fallbackPreview(html).includes(".mc-fallback{display:block !important;}</style></head>"));

  const objects = renderMail(documentWith({ objectLayout: "carousel" })).html;
  assert.ok(objects.includes('name="mcobjects-1"'));
  assert.ok(objects.includes('class="mc-s2"') || objects.includes("mc-slide mc-s2"));
});

test("text layouts change the arrangement", () => {
  const intro = renderMail(documentWith({ textLayout: "two-columns", intro: "Un.\n\nDeux.", outro: "" })).html;
  assert.equal((intro.match(/class="mc-col" width="264"/g) ?? []).length, 0);
  assert.match(intro, /<tr><td><p[^>]*>Un\.<\/p><p[^>]*>Deux\.<\/p><\/td><\/tr>/);
  const columns = renderMail(documentWith({ textLayout: "two-columns", intro: "Un.\n\nDeux.", outro: "Suite.\n\nFin." })).html;
  assert.equal((columns.match(/class="mc-col" width="264"/g) ?? []).length, 2);
  const boxed = renderMail(documentWith({ textLayout: "boxed" })).html;
  assert.ok(boxed.includes("border-left:4px solid #C2185B"));
  const centered = renderMail(documentWith({ textLayout: "centered" })).html;
  assert.ok(centered.includes("text-align:center;\">Notre sélection pour vous</h1>"));
  const letter = renderMail(documentWith({ textLayout: "letter" })).html;
  assert.ok(letter.includes("text-align:right;font-style:italic;"));
});

test("all object photos use white-background JPEGs, including slider thumbnails and fallbacks", () => {
  for (const imageLayout of imageLayouts.map((item) => item.id)) {
    for (const objectLayout of objectLayouts.map((item) => item.id)) {
      const html = renderMail(documentWith({ imageLayout, objectLayout })).html;
      const images = [...html.matchAll(/<img\b[^>]*src="([^"]+)"[^>]*>/g)];
      if (imageLayout !== "none") {
        assert.ok(images.some(([, source]) => source.includes("/api/antiquites/images/")), `${imageLayout}/${objectLayout}`);
      }
      for (const [tag, source] of images) {
        if (!source.includes("/api/antiquites/images/")) continue;
        const url = new URL(source.replace(/&amp;/g, "&"));
        assert.equal(url.searchParams.get("format"), "jpg", `${imageLayout}/${objectLayout}`);
        assert.equal(url.searchParams.get("background"), "white");
        assert.equal(url.searchParams.get("v"), "2");
        assert.ok(tag.includes("background-color:#FFFFFF;"));
      }
      const fallback = fallbackPreview(html);
      assert.ok(!fallback.includes('src="https://api.example.com/api/antiquites/images/a.webp"'));
    }
  }
  const customArticle = {
    ...article,
    images: [{ id: 1, url: "https://api.example.com/api/antiquites/images/a.webp?existing=1&format=jpg" }]
  };
  const html = renderMail(documentWith({ items: [itemFromArticle(customArticle)] })).html;
  assert.ok(html.includes("existing=1&amp;format=jpg&amp;background=white&amp;v=2"));
  assert.ok(renderMail(documentWith({ imageLayout: "single" })).html.includes('src="https://api.example.com/v.webp"'));
});

test("omits unsafe call to action links", () => {
  const { html, text } = renderMail(documentWith({ ctaLabel: "Cliquez", ctaUrl: "javascript:alert(1)" }));
  assert.ok(!html.includes("javascript:"));
  assert.ok(!text.includes("Cliquez"));
});

test("preserves trailing punctuation in photo, button and plain-text object links", () => {
  const name = "Colonne en majolique décor au héron.";
  const expected = `https://daisybrocante.com/boutique/${encodeURIComponent(name)}`;
  for (const objectLayout of objectLayouts.map((item) => item.id)) {
    for (const imageLayout of imageLayouts.map((item) => item.id)) {
      const { html, text } = renderMail(documentWith({
        objectLayout, imageLayout,
        items: [itemFromArticle({ ...article, name }), itemFromArticle(second)]
      }));
      const links = [...html.matchAll(/href="([^"]+)"/g)]
        .map(([, href]) => href)
        .filter((href) => href.includes("Colonne"));
      assert.ok(links.length > 0);
      assert.ok(links.every((href) => href === expected), `${objectLayout}/${imageLayout}`);
      assert.ok(text.split("\n").includes(expected));
    }
  }
});

test("parses recipient lists", () => {
  const { valid, invalid } = parseRecipients("A@example.com, b@example.com;\nfoo\na@example.com  c@example.org");
  assert.deepEqual(valid, ["a@example.com", "b@example.com", "c@example.org"]);
  assert.deepEqual(invalid, ["foo"]);
});

test("builds inventory URLs with an optional search", () => {
  const url = new URL(inventorySearchURL("https://api.example.com/", 2, " miroir "));
  assert.equal(url.pathname, "/api/antiquites");
  assert.equal(url.searchParams.get("q"), "miroir");
  assert.equal(url.searchParams.get("status"), "0");
  assert.equal(url.searchParams.get("page"), "2");
  assert.equal(new URL(inventorySearchURL("https://api.example.com", 1, "")).searchParams.has("q"), false);
  assert.throws(() => inventorySearchURL(undefined, 1, ""), /API_URL/);
});

test("restores drafts and repairs invalid values", () => {
  assert.equal(draftKey("user_1"), "mail-composer:v1:user_1");
  const document = documentWith({ imageLayout: "gallery" });
  const raw = JSON.stringify({
    version: 1,
    document: { ...document, textLayout: "bogus", accentColor: "red", items: [{ ...document.items[0], imageIds: [1, 99] }, { nope: true }] },
    recipients: "a@example.com",
    replyTo: "",
    savedAt: "2026-11-03T08:00:00.000Z"
  });
  const draft = readDraft(raw);
  assert.equal(draft.document.imageLayout, "gallery");
  assert.equal(draft.document.textLayout, "classic");
  assert.equal(draft.document.accentColor, "#C2185B");
  assert.equal(draft.document.items.length, 1);
  assert.deepEqual(draft.document.items[0].imageIds, [1]);
  assert.equal(draft.recipients, "a@example.com");
  assert.throws(() => readDraft(JSON.stringify({ version: 2 })), /invalide/);
});
