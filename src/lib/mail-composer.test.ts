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
  renderPlainText,
  safeColor,
  safeUrl,
  switchContentMode,
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

test("appointment booking is opt-in and uses a separate safe button in HTML and text", () => {
  const url = "https://calendar.google.com/calendar/appointments/test?a=1&b=2";
  const doc = documentWith({ appointmentUrl: url });
  assert.ok(!renderMail(doc).html.includes("Planifier un appel"));
  doc.showAppointment = true;
  const rendered = renderMail(doc);
  assert.ok(rendered.html.includes('href="https://calendar.google.com/calendar/appointments/test?a=1&amp;b=2"'));
  assert.match(rendered.html, /<a[^>]*style="[^"]*text-align:center;[^"]*">Planifier un appel<\/a>/);
  assert.ok(rendered.html.includes("Voir la boutique"));
  assert.ok(rendered.text.includes(`Planifier un appel : ${url}`));
  const restored = readDraft(JSON.stringify({ version: 1, document: doc })).document;
  assert.equal(restored.showAppointment, true);
  assert.equal(restored.appointmentUrl, url);
  for (const appointmentUrl of ["", "javascript:alert(1)"]) {
    const invalid = renderMail({ ...doc, appointmentUrl });
    assert.ok(!invalid.html.includes("Planifier un appel"));
    assert.ok(!invalid.text.includes("Planifier un appel"));
  }
});

test("global price visibility covers every layout without changing individual preferences", () => {
  for (const objectLayout of objectLayouts.map((option) => option.id)) {
    const doc = documentWith({ objectLayout, showPrices: false });
    const hidden = renderMail(doc);
    assert.ok(!hidden.html.includes("245,00"));
    assert.ok(!hidden.text.includes("245,00"));
    assert.equal(doc.items[0].showPrice, true);
    doc.items.push(itemFromArticle({ ...article, id: 99, price: 789 }));
    assert.ok(!renderMail(doc).html.includes("789,00"));
    doc.showPrices = true;
    assert.ok(renderMail(doc).html.includes("245,00"));
    assert.ok(renderMail(doc).text.includes("245,00"));
    doc.items.forEach((item) => item.showPrice = false);
    assert.ok(!renderMail(doc).html.includes("245,00"));
  }
});

test("professional terms are opt-in, escaped, full width and included in plain text", () => {
  const doc = documentWith({ textLayout: "two-columns", outro: "", professionalTerms: "Conditions <pro>.\n\nContactez-nous." });
  assert.ok(!renderMail(doc).text.includes("Conditions <pro>"));
  doc.showProfessionalTerms = true;
  const { html, text } = renderMail(doc);
  assert.ok(html.includes("Conditions &lt;pro&gt;."));
  assert.ok(text.includes("Conditions <pro>."));
  assert.ok(!html.includes('class="mc-col" width="264"'));
  assert.ok(text.indexOf("Conditions <pro>.") < text.indexOf(doc.signature));
  doc.professionalTerms = "";
  assert.ok(!renderMail(doc).html.includes("Conditions &lt;pro&gt;"));
});

test("mail ending groups enabled contact options before a separated signature", () => {
  for (const textLayout of textLayouts.map((option) => option.id)) {
    const doc = documentWith({
      textLayout, outro: "Conclusion unique.", showProfessionalTerms: true,
      professionalTerms: "Mention professionnelle unique.", showAppointment: true,
      appointmentUrl: "https://calendar.google.com/calendar/appointments/test",
      signature: "Signature unique."
    });
    const { html, text } = renderMail(doc);
    const start = html.indexOf('class="mc-contact"');
    const signature = html.indexOf('class="mc-signature"');
    assert.ok(start > html.indexOf("Conclusion unique."));
    assert.ok(start < html.indexOf("Mention professionnelle unique."));
    assert.ok(signature > html.indexOf("Planifier un appel"));
    const contact = html.slice(start, signature);
    assert.ok(contact.includes("Échangeons sur votre projet"));
    assert.ok(contact.includes("bgcolor="));
    assert.ok(!contact.includes('class="mc-col"'));
    assert.ok(text.indexOf(doc.outro) < text.indexOf(doc.professionalTerms));
    assert.ok(text.indexOf("Planifier un appel") < text.indexOf(doc.signature));
    doc.showAppointment = false;
    assert.ok(renderMail(doc).html.includes(">Conditions professionnelles</h2>"));
    doc.professionalTerms = "";
    assert.ok(!renderMail(doc).html.includes('class="mc-contact"'));
    doc.signature = "";
    assert.ok(!renderMail(doc).html.includes('class="mc-signature"'));
  }
});

test("mailing address is saved and rendered in small type below the signature", () => {
  const doc = documentWith({
    signature: "Daisy Brocante",
    mailingAddress: "12 rue des Brocanteurs\n75000 Paris"
  });
  const { html, text } = renderMail(doc);
  const signature = html.indexOf('class="mc-signature"');
  const address = html.indexOf('class="mc-mailing-address"');
  assert.ok(address > signature);
  assert.match(html.slice(address, address + 250), /font-size:11px/);
  assert.match(html, /12 rue des Brocanteurs<br>75000 Paris/);
  assert.ok(text.indexOf(doc.mailingAddress) > text.indexOf(doc.signature));
  assert.equal(readDraft(JSON.stringify({ version: 1, document: doc })).document.mailingAddress, doc.mailingAddress);

  const old = { ...doc };
  Reflect.deleteProperty(old, "mailingAddress");
  assert.equal(readDraft(JSON.stringify({ version: 1, document: old })).document.mailingAddress, "");
  const escaped = renderMail(documentWith({ mailingAddress: "<script>" })).html;
  assert.match(escaped, /&lt;script&gt;/);
  assert.doesNotMatch(escaped, /<script>/);
});

test("drafts preserve professional terms and global prices and migrate older drafts", () => {
  const doc = documentWith({ showPrices: false, showProfessionalTerms: true, professionalTerms: "Conditions sur demande." });
  const restored = readDraft(JSON.stringify({ version: 1, document: doc })).document;
  assert.equal(restored.showPrices, false);
  assert.equal(restored.showProfessionalTerms, true);
  assert.equal(restored.professionalTerms, doc.professionalTerms);
  const old = { ...doc };
  Reflect.deleteProperty(old, "showPrices");
  Reflect.deleteProperty(old, "showProfessionalTerms");
  Reflect.deleteProperty(old, "professionalTerms");
  const migrated = readDraft(JSON.stringify({ version: 1, document: old })).document;
  assert.equal(migrated.showPrices, true);
  assert.equal(migrated.showProfessionalTerms, false);
  assert.equal(migrated.professionalTerms, defaultDocument().professionalTerms);
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

test("subscription mails show the selected plans instead of objects in HTML and text", () => {
  const doc = documentWith({ contentMode: "subscriptions", plans: ["essential", "premium"] });
  const { html } = renderMail(doc);
  const text = renderPlainText(doc);
  for (const output of [html, text]) {
    assert.match(output, /Essentiel/);
    assert.match(output, /Premium/);
    assert.match(output, /12 € \/ mois/);
    assert.match(output, /https:\/\/daisybrocante\.com\/espace-vendeur/);
    assert.doesNotMatch(output, /Amateur|Professionnel/);
    assert.doesNotMatch(output, /Miroir|Vase/);
  }
  assert.match(html, /Choisir cette formule/);
  const objects = renderMail(documentWith({ contentMode: "objects" })).html;
  assert.match(objects, /Miroir/);
  assert.doesNotMatch(objects, /Choisir cette formule/);
});

test("drafts migrate content mode and plans and keep a valid saved reference", () => {
  const old = documentWith({});
  Reflect.deleteProperty(old, "contentMode");
  Reflect.deleteProperty(old, "plans");
  const migrated = readDraft(JSON.stringify({ version: 1, document: old }));
  assert.equal(migrated.document.contentMode, "objects");
  assert.deepEqual(migrated.document.plans, ["essential", "amateur", "professional", "premium"]);
  assert.equal(migrated.saved, undefined);
  const restored = readDraft(JSON.stringify({
    version: 1, document: { ...old, contentMode: "subscriptions", plans: ["premium", "bogus", "amateur"] },
    saved: { id: 4, name: "Décorateurs", version: 3, clean: true }
  }));
  assert.equal(restored.document.contentMode, "subscriptions");
  assert.deepEqual(restored.document.plans, ["amateur", "premium"]);
  assert.deepEqual(restored.saved, { id: 4, name: "Décorateurs", version: 3, clean: true });
  const invalid = readDraft(JSON.stringify({ version: 1, document: { ...old, contentMode: "x" }, saved: { id: 0, name: "x", version: 1 } }));
  assert.equal(invalid.document.contentMode, "objects");
  assert.equal(invalid.saved, undefined);
});

test("switching content mode only replaces copy that was not customised", () => {
  const doc = { ...defaultDocument(), title: "Mon titre" };
  const subscriptions = switchContentMode(doc, "subscriptions");
  assert.equal(subscriptions.contentMode, "subscriptions");
  assert.equal(subscriptions.title, "Mon titre");
  assert.equal(subscriptions.ctaUrl, "https://daisybrocante.com/espace-vendeur");
  assert.match(subscriptions.intro, /formules/);
  const back = switchContentMode(subscriptions, "objects");
  assert.deepEqual(back, doc);
});
