import type { APIRoute } from 'astro';

const handler: APIRoute = async ({ request }) => {
    let body: { worktype?: string; tone?: string } = {};
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: "JSON invalide" }), {
            status: 400, headers: { "Content-Type": "application/json" }
        });
    }

    const worktype = (body.worktype || "professionnel du secteur").trim();
    const tone = (body.tone || "professionnel et chaleureux").trim();

    const geminiKey = import.meta.env.GEMINI_API_KEY;

    if (geminiKey) {
        try {
            const prompt = `Tu es un expert en relations commerciales BtoB. Génère UNE SEULE introduction courte (2-3 phrases maximum) pour un email de prospection commerciale.

Contexte :
- L'expéditeur est "Daisy Brocante", une boutique en ligne spécialisée dans les antiquités et objets de brocante.
- Le destinataire est un(e) "${worktype}".
- Ton souhaité : ${tone}

Règles strictes :
- Commence directement par "Bonjour," suivi d'un saut de ligne.
- Mentionne subtilement le lien entre le secteur d'activité du destinataire et les antiquités/brocante.
- Ne mentionne pas de noms propres de personnes.
- Reste courtois, professionnel et accrocheur.
- Réponds UNIQUEMENT par le texte de l'introduction, sans guillemets ni commentaires.`;

            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.8, maxOutputTokens: 200 }
                    }),
                    signal: AbortSignal.timeout(10000)
                }
            );

            if (res.ok) {
                const data = await res.json();
                const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
                if (text) {
                    return new Response(JSON.stringify({ intro: text, source: "gemini" }), {
                        status: 200, headers: { "Content-Type": "application/json" }
                    });
                }
            }
        } catch (err: any) {
            console.warn("Gemini intro generation failed:", err?.message);
        }
    }

    // Fallback contextuel dynamique basé sur le worktype
    const intro = generateContextualIntro(worktype, tone);
    return new Response(JSON.stringify({ intro, source: "contextual" }), {
        status: 200, headers: { "Content-Type": "application/json" }
    });
};

function generateContextualIntro(worktype: string, tone: string): string {
    const wt = worktype.toLowerCase();

    // Détection de la localisation (dernière partie après l'espace)
    const parts = wt.split(/\s+/);
    const location = parts.length > 1 ? parts[parts.length - 1] : null;
    const sector = parts.slice(0, parts.length > 1 ? -1 : undefined).join(' ');

    const locationStr = location
        ? ` dans la région de ${location.charAt(0).toUpperCase() + location.slice(1)}`
        : '';

    // Formulations selon le secteur détecté
    const templates: Record<string, string[]> = {
        antiquaire: [
            `Bonjour,\n\nEn découvrant votre activité d'antiquaire${locationStr}, j'ai immédiatement pensé que notre sélection d'objets de brocante pourrait représenter une opportunité intéressante pour enrichir votre offre ou pour un partenariat commercial.`,
            `Bonjour,\n\nPartageant votre passion pour les objets d'époque et les pièces d'exception${locationStr}, je me permets de vous contacter au sujet d'une collaboration potentielle qui pourrait bénéficier à nos deux enseignes.`,
        ],
        brocanteur: [
            `Bonjour,\n\nEn tant que professionnel de la brocante${locationStr}, vous savez mieux que quiconque la valeur de dénicher des pièces rares et authentiques. C'est précisément dans cet esprit que je souhaite vous présenter Daisy Brocante.`,
            `Bonjour,\n\nVotre activité de brocanteur${locationStr} et notre sélection d'objets vintage et anciens semblent faire bon ménage — c'est pourquoi je me permets de vous contacter pour explorer une éventuelle collaboration.`,
        ],
        galerie: [
            `Bonjour,\n\nEn parcourant les acteurs du marché de l'art${locationStr}, votre galerie a retenu toute mon attention. Je me permets de vous contacter au sujet d'un partenariat qui pourrait enrichir votre programme d'expositions ou votre offre de pièces à la vente.`,
        ],
        mobilier: [
            `Bonjour,\n\nVotre spécialisation dans le mobilier vintage et ancien${locationStr} correspond parfaitement à l'univers de Daisy Brocante. Je me permets de vous écrire pour discuter d'une possible collaboration autour de pièces d'exception.`,
        ],
        horlogerie: [
            `Bonjour,\n\nL'art de l'horlogerie ancienne${locationStr} partage avec les objets de brocante une même passion pour le beau et le durable. C'est dans cet esprit que je souhaite vous présenter notre sélection et explorer ensemble d'éventuelles synergies.`,
        ],
        bijouterie: [
            `Bonjour,\n\nVotre expertise en bijoux anciens et vintage${locationStr} fait écho à l'univers d'Daisy Brocante. Je vous contacte pour vous présenter notre sélection de pièces et discuter d'un éventuel partenariat commercial.`,
        ],
    };

    // Sélection du template selon le secteur
    for (const [key, options] of Object.entries(templates)) {
        if (sector.includes(key)) {
            return options[Math.floor(Math.random() * options.length)];
        }
    }

    // Template générique si aucun secteur détecté
    const genericTemplates = [
        `Bonjour,\n\nVotre activité dans le domaine du "${worktype}"${locationStr} a attiré mon attention. Je me permets de vous contacter au sujet d'une opportunité de collaboration avec Daisy Brocante, spécialiste des antiquités et objets de brocante en ligne.`,
        `Bonjour,\n\nEn tant que professionnel(le) du "${worktype}"${locationStr}, vous pourriez être intéressé(e) par notre sélection d'objets anciens et vintage. Je souhaite vous présenter Daisy Brocante et explorer d'éventuelles synergies entre nos activités.`,
    ];
    return genericTemplates[Math.floor(Math.random() * genericTemplates.length)];
}

export const POST: APIRoute = handler;
