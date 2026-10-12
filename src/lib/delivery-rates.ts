import type { DeliveryRates, Livraison } from "../type";

export function ratesForCountry(provider: Livraison, country: string): DeliveryRates {
    const rates = provider.country_rates?.[country] ?? provider;
    return {
        pricesmall: rates.pricesmall ?? 0,
        pricemedium: rates.pricemedium ?? 0,
        pricelarge: rates.pricelarge ?? 0,
        pricextralarge: rates.pricextralarge ?? 0
    };
}

export function initialCountryRates(countries: string[], provider?: Livraison): Record<string, DeliveryRates> {
    return Object.fromEntries(countries.map(country => [
        country,
        provider ? ratesForCountry(provider, country) : {
            pricesmall: 0, pricemedium: 0, pricelarge: 0, pricextralarge: 0
        }
    ]));
}

export function selectedCountryRates(countries: string[], rates: Record<string, DeliveryRates>): Record<string, DeliveryRates> {
    return Object.fromEntries(countries.map(country => {
        const value = rates[country];
        if (!value) throw new Error(`Tarifs manquants pour ${country}`);
        return [country, {
            pricesmall: value.pricesmall ?? 0,
            pricemedium: value.pricemedium ?? 0,
            pricelarge: value.pricelarge ?? 0,
            pricextralarge: value.pricextralarge ?? 0
        }];
    }));
}
