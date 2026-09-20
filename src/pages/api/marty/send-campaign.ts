import type { APIRoute } from 'astro';

interface EmailPayload {
    to: string;
    subject: string;
    html: string;
    text: string;
    from: string;
}

interface SendResult {
    to: string;
    success: boolean;
    id?: string;
    error?: string;
}

const handler: APIRoute = async ({ request }) => {
    const resendApiKey = import.meta.env.RESEND_API_KEY;
    if (!resendApiKey) {
        return new Response(JSON.stringify({ error: "RESEND_API_KEY non configurée sur le serveur." }), {
            status: 500, headers: { "Content-Type": "application/json" }
        });
    }

    let body: { emails?: EmailPayload[]; testMode?: boolean } = {};
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: "JSON invalide dans le corps de la requête." }), {
            status: 400, headers: { "Content-Type": "application/json" }
        });
    }

    const { emails = [], testMode = false } = body;
    if (!Array.isArray(emails) || emails.length === 0) {
        return new Response(JSON.stringify({ error: "Aucun email à envoyer." }), {
            status: 400, headers: { "Content-Type": "application/json" }
        });
    }

    const results: SendResult[] = [];

    for (const email of emails) {
        if (!email.to || !email.subject || !email.html || !email.from) {
            results.push({ to: email.to || "?", success: false, error: "Champs obligatoires manquants (to, from, subject, html)" });
            continue;
        }

        try {
            const res = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${resendApiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    from: email.from,
                    to: [email.to],
                    subject: email.subject,
                    html: email.html,
                    text: email.text || email.html.replace(/<[^>]+>/g, ''),
                }),
                signal: AbortSignal.timeout(15000)
            });

            const data = await res.json().catch(() => ({})) as any;

            if (res.ok) {
                results.push({ to: email.to, success: true, id: data?.id });
            } else {
                results.push({ to: email.to, success: false, error: data?.message || data?.name || `HTTP ${res.status}` });
            }
        } catch (err: any) {
            results.push({ to: email.to, success: false, error: err?.message || "Erreur de connexion à Resend" });
        }

        // Respecter le rate-limit Resend (2 emails/sec en plan gratuit)
        if (!testMode && emails.length > 1) {
            await new Promise(r => setTimeout(r, 600));
        }
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    return new Response(JSON.stringify({
        results,
        summary: { total: emails.length, success: successCount, errors: errorCount }
    }), {
        status: 200, headers: { "Content-Type": "application/json" }
    });
};

export const POST: APIRoute = handler;
