import type { APIRoute } from 'astro';

const handler: APIRoute = async ({ request, url }) => {
    const action = url.searchParams.get("action") || "health";
    const q = url.searchParams.get("q") || "";
    const type = url.searchParams.get("type") || "";
    const customScrapperUrl = url.searchParams.get("scrapperUrl");

    // Déterminer l'URL de base du scrapper
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

    try {
        if (action === "list") {
            const limit = url.searchParams.get("limit") || "";
            const targetUrl = `${scrapperBaseUrl}/prospects?type=${encodeURIComponent(type)}${limit ? `&limit=${encodeURIComponent(limit)}` : ''}`;

            const res = await fetch(targetUrl, { 
                method: "GET",
                headers: defaultHeaders,
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

            const targetUrl = `${scrapperBaseUrl}/prospects?id=${encodeURIComponent(id)}`;
            const res = await fetch(targetUrl, { 
                method: "DELETE",
                headers: defaultHeaders,
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

            const targetUrl = `${scrapperBaseUrl}/generer-leads?q=${encodeURIComponent(q)}`;
            const res = await fetch(targetUrl, {
                method: "POST",
                headers: {
                    ...defaultHeaders,
                    "Content-Type": "application/json"
                }
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
            const targetUrl = `${scrapperBaseUrl}/export-prospects?type=${encodeURIComponent(type)}`;
            const res = await fetch(targetUrl, {
                method: "GET",
                headers: defaultHeaders
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
            error: `Impossible de contacter le service de scraping Marty (${scrapperBaseUrl}).`,
            details: err?.message || String(err),
            scrapperBaseUrl
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


