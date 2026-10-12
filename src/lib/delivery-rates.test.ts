import { test } from "node:test";
import assert from "node:assert/strict";
import type { Livraison } from "../type";
import { initialCountryRates, ratesForCountry, selectedCountryRates } from "./delivery-rates";

const provider: Livraison = {
    id: 1, providername: "Carrier", countries: ["BE", "FR"],
    pricesmall: 5, pricemedium: 10, pricelarge: 20, pricextralarge: 50,
    country_rates: {
        FR: { pricesmall: 8, pricemedium: 15, pricelarge: 0, pricextralarge: null }
    }
};

test("prefills destination rates and preserves legacy rates for countries without overrides", () => {
    const rates = initialCountryRates(["BE", "FR"], provider);
    assert.equal(rates.BE.pricesmall, 5);
    assert.equal(rates.FR.pricesmall, 8);
    assert.equal(rates.FR.pricelarge, 0, "unsupported destination sizes must not use legacy prices");
    assert.equal(rates.FR.pricextralarge, 0);
    rates.FR.pricesmall = 9;
    assert.equal(provider.country_rates?.FR.pricesmall, 8, "editing must not mutate loaded provider");
    assert.deepEqual(ratesForCountry(provider, "BE"), {
        pricesmall: 5, pricemedium: 10, pricelarge: 20, pricextralarge: 50
    });
});

test("serializes only selected destinations and clears blank size prices", () => {
    const rates = initialCountryRates(["BE", "FR"], provider);
    rates.FR.pricemedium = null;
    const payload = selectedCountryRates(["FR"], rates);
    assert.deepEqual(payload, { FR: { pricesmall: 8, pricemedium: 0, pricelarge: 0, pricextralarge: 0 } });
    assert.deepEqual(selectedCountryRates([], rates), {});
    assert.throws(() => selectedCountryRates(["DE"], rates), /Tarifs manquants/);
});

test("new transporters start with unsupported sizes until prices are configured", () => {
    assert.deepEqual(initialCountryRates(["BE"]), {
        BE: { pricesmall: 0, pricemedium: 0, pricelarge: 0, pricextralarge: 0 }
    });
});
