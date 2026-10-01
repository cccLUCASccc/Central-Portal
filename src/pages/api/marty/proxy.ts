import type { APIRoute } from 'astro';

const handler: APIRoute = async ({ request, url }) => {
    const action = url.searchParams.get("action") || "health";
    const q = url.searchParams.get("q") || "";
    const type = url.searchParams.get("type") || "";
    const customScrapperUrl = url.searchParams.get("scrapperUrl");

    // Déterminer l'URL de base du scrapper (utilisée uniquement pour le ping /health)
    const envScrapperUrl = import.meta.env.SCRAPPER_URL || import.meta.env.PUBLIC_SCRAPPER_URL;

    let scrapperBaseUrl: string;
    if (customScrapperUrl && customScrapperUrl !== "http://localhost:3000") {
        scrapperBaseUrl = customScrapperUrl;
    } else if (envScrapperUrl) {
        scrapperBaseUrl = envScrapperUrl;
    } else {
        scrapperBaseUrl = customScrapperUrl || "http://localhost:3000";
    }
    scrapperBaseUrl = scrapperBaseUrl.replace(/\/$/, "");

    const defaultHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    };

    // Toutes les actions sauf 'health' passent désormais par Central-API avec la
    // clé API admin Marty, qui relaie elle-même vers le service de scraping via
    // le token interne (SCRAPER_INTERNAL_TOKEN), sans passer par un abonnement Stripe.
    const apiBaseUrl = (import.meta.env.MARTY_API_URL || import.meta.env.PUBLIC_API_URL || "").replace(/\/$/, "");
    const adminApiKey = import.meta.env.MARTY_ADMIN_API_KEY;

    const apiHeaders = () => {
        if (!adminApiKey) {
            throw new Error("MARTY_ADMIN_API_KEY manquante côté portail.");
        }
        return { Authorization: `Bearer ${adminApiKey}` };
    };

    try {
        if (action === "list") {
            const limit = url.searchParams.get("limit") || "";
            const targetUrl = `${apiBaseUrl}/v1/scraper/prospects?type=${encodeURIComponent(type)}${limit ? `&limit=${encodeURIComponent(limit)}` : ''}`;

            const res = await fetch(targetUrl, {
                method: "GET",
                headers: apiHeaders(),
                signal: AbortSignal.timeout(6000)
            });

            if (!res.ok) {
                const text = await res.text();
                console.error(`Erreur du scrapper (${res.status}): ${text}`);
                return new Response(JSON.stringify({ error: `Erreur du scrapper (${res.status}): ${text}` }), {
                    status: res.status,
                    headers: { "Content-Type": "application/json" }
                });
            }

            const data = await res.json();
            return new Response(JSON.stringify(data), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        }

        if (action === "delete") {
            const id = url.searchParams.get("id");
            if (!id) {
                return new Response(JSON.stringify({ error: "Paramètre 'id' manquant" }), {
                    status: 400,
                    headers: { "Content-Type": "application/json" }
                });
            }

            const targetUrl = `${apiBaseUrl}/v1/scraper/prospects?id=${encodeURIComponent(id)}`;
            const res = await fetch(targetUrl, {
                method: "DELETE",
                headers: apiHeaders(),
                signal: AbortSignal.timeout(6000)
            });

            if (!res.ok) {
                const text = await res.text();
                return new Response(JSON.stringify({ error: `Erreur suppression (${res.status}): ${text}` }), {
                    status: res.status,
                    headers: { "Content-Type": "application/json" }
                });
            }

            const data = await res.json();
            return new Response(JSON.stringify(data), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        }

        if (action === "scrape") {
            if (!q) {
                return new Response(JSON.stringify({ error: "Le mot-clé (paramètre 'q') est requis." }), {
                    status: 400,
                    headers: { "Content-Type": "application/json" }
                });
            }

            const targetUrl = `${apiBaseUrl}/v1/scraper/leads?q=${encodeURIComponent(q)}`;
            const res = await fetch(targetUrl, {
                method: "POST",
                headers: {
                    ...apiHeaders(),
                    "Content-Type": "application/json"
                },
                signal: AbortSignal.timeout(120000)
            });

            if (!res.ok) {
                const text = await res.text();
                return new Response(JSON.stringify({ error: `Erreur du scrapper (${res.status}): ${text}` }), {
                    status: res.status,
                    headers: { "Content-Type": "application/json" }
                });
            }

            const data = await res.json();
            return new Response(JSON.stringify(data), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        }

        if (action === "export") {
            const targetUrl = `${apiBaseUrl}/v1/scraper/prospects/export?type=${encodeURIComponent(type)}`;
            const res = await fetch(targetUrl, {
                method: "GET",
                headers: apiHeaders()
            });

            if (!res.ok) {
                const text = await res.text();
                return new Response(text || "Erreur lors de l'export", { status: res.status });
            }

            const csvData = await res.text();
            return new Response(csvData, {
                status: 200,
                headers: {
                    "Content-Type": "text/csv; charset=utf-8",
                    "Content-Disposition": `attachment; filename="export_${type || 'prospects'}.csv"`
                }
            });
        }

        if (action === "health") {
            const targetUrl = `${scrapperBaseUrl}/health`;
            let isOk = false;
            try {
                const res = await fetch(targetUrl, { 
                    headers: defaultHeaders,
                    signal: AbortSignal.timeout(3000) 
                });
                isOk = res.ok;
            } catch {
                isOk = false;
            }

            return new Response(JSON.stringify({ status: isOk ? "ok" : "offline", scrapperBaseUrl }), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        }

        return new Response(JSON.stringify({ error: "Action inconnue" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ 
            error: `Impossible de contacter Central-API pour Marty (${apiBaseUrl}).`,
            details: err?.message || String(err)
        }), {
            status: 502,
            headers: { "Content-Type": "application/json" }
        });
    }
};

export const GET: APIRoute = handler;
export const POST: APIRoute = handler;
export const DELETE: APIRoute = handler;
export const ALL: APIRoute = handler;


