<script lang="ts">
    import type { Prospect } from "../../../type";

    interface Props {
        isOpen: boolean;
        prospects: Prospect[];
        onclose: () => void;
    }

    let { isOpen, prospects, onclose }: Props = $props();

    // ---- Configuration ----
    let fromEmail = $state(typeof localStorage !== 'undefined' ? (localStorage.getItem("marty_from_email") || "") : "");
    let subject = $state("Une collaboration potentielle avec Daisy Brocante ✨");
    let introTone = $state(typeof localStorage !== 'undefined' ? (localStorage.getItem("marty_intro_tone") || "professionnel et chaleureux") : "professionnel et chaleureux");
    const toneOptions = [
        "professionnel et chaleureux",
        "formel et respectueux",
        "décontracté et enthousiaste",
        "élégant et raffiné",
        "direct et efficace",
        "créatif et inspirant"
    ];

    // ---- Email parts ----
    const defaultBody = `Je dirige Daisy Brocante, une boutique en ligne spécialisée dans la vente d'antiquités et d'objets de brocante soigneusement sélectionnés. Notre catalogue regroupe des pièces de caractère allant du mobilier ancien aux objets de décoration vintage, avec une clientèle fidèle et passionnée.

Je pense que nos univers pourraient se compléter et qu'une collaboration — que ce soit pour des acquisitions communes, des recommandations mutuelles, ou un partenariat commercial — pourrait être bénéfique pour nos deux activités.`;

    const defaultSignature = `Je reste à votre disposition pour en discuter à votre convenance.

Cordialement,
Lucas
Daisy Brocante
www.daisybrocante.com`;

    let emailBody = $state(defaultBody);
    let emailSignature = $state(defaultSignature);

    // ---- Per-prospect intro map ----
    let introMap = $state<Record<string, string>>({});
    let loadingIntros = $state<Record<string, boolean>>({});
    let isGeneratingAll = $state(false);

    // ---- Preview ----
    let activeTab = $state<"compose" | "preview">("compose");
    let previewProspectIndex = $state(0);

    // ---- Send state ----
    let isSending = $state(false);
    let sendProgress = $state(0);
    let sendResults = $state<{ to: string; success: boolean; id?: string; error?: string }[]>([]);
    let sendDone = $state(false);
    let testEmail = $state("");

    // ---- Notification ----
    let notification = $state<{ text: string; type: "success" | "error" | "info" } | null>(null);

    function notify(text: string, type: "success" | "error" | "info" = "success") {
        notification = { text, type };
        setTimeout(() => { if (notification?.text === text) notification = null; }, 5000);
    }

    function saveFromEmail() {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem("marty_from_email", fromEmail);
            localStorage.setItem("marty_intro_tone", introTone);
        }
    }

    function getIntro(prospect: Prospect): string {
        return introMap[prospect.email] || "";
    }

    function buildHtml(prospect: Prospect): string {
        const intro = getIntro(prospect);
        const introHtml = intro.replace(/\n/g, '<br>');
        const bodyHtml = emailBody.replace(/\n/g, '<br>');
        const sigHtml = emailSignature.replace(/\n/g, '<br>');

        return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family: Georgia, serif; color: #222; max-width: 600px; margin: 0 auto; padding: 24px;">
  <p style="margin-bottom:16px;">${introHtml}</p>
  <p style="margin-bottom:16px;">${bodyHtml}</p>
  <hr style="border:none;border-top:1px solid #ccc;margin:24px 0;">
  <p style="color:#555;font-size:14px;">${sigHtml}</p>
</body>
</html>`;
    }

    function buildText(prospect: Prospect): string {
        const intro = getIntro(prospect);
        return [intro, emailBody, "--", emailSignature].filter(Boolean).join("\n\n");
    }

    async function generateIntro(prospect: Prospect) {
        loadingIntros[prospect.email] = true;
        try {
            const res = await fetch("/api/marty/generate-intro", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ worktype: prospect.worktype || prospect.email, tone: introTone })
            });
            const data = await res.json();
            if (data.intro) {
                introMap = { ...introMap, [prospect.email]: data.intro };
            }
        } catch {
            notify("Impossible de générer l'introduction.", "error");
        } finally {
            loadingIntros[prospect.email] = false;
        }
    }

    async function generateAllIntros() {
        isGeneratingAll = true;
        for (const p of prospects) {
            await generateIntro(p);
        }
        isGeneratingAll = false;
        notify("Toutes les introductions ont été générées !", "success");
    }

    async function sendCampaign(isTest = false) {
        if (!fromEmail.trim()) {
            notify("Veuillez renseigner l'adresse expéditeur.", "error");
            return;
        }
        saveFromEmail();

        const targets = isTest
            ? [{ email: testEmail.trim() || fromEmail.trim(), worktype: "test" }]
            : prospects;

        if (isTest && !testEmail.trim() && !fromEmail.trim()) {
            notify("Veuillez renseigner un email de test ou l'email expéditeur.", "error");
            return;
        }

        isSending = true;
        sendProgress = 0;
        sendResults = [];
        sendDone = false;

        const emails = targets.map(p => ({
            to: isTest ? (testEmail.trim() || fromEmail.trim()) : p.email,
            from: fromEmail.trim(),
            subject: subject.trim(),
            html: buildHtml(p as Prospect),
            text: buildText(p as Prospect)
        }));

        try {
            const res = await fetch("/api/marty/send-campaign", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ emails, testMode: isTest }),
                signal: AbortSignal.timeout(300000)
            });

            const data = await res.json();
            sendResults = data.results || [];
            sendProgress = 100;
            sendDone = true;

            const successCount = sendResults.filter(r => r.success).length;
            if (isTest) {
                notify(`Email de test envoyé avec succès !`, "success");
            } else {
                notify(`Campagne terminée : ${successCount}/${targets.length} emails envoyés avec succès.`, successCount > 0 ? "success" : "error");
            }
        } catch (err: any) {
            notify(`Erreur d'envoi : ${err?.message || "Connexion échouée"}`, "error");
        } finally {
            isSending = false;
        }
    }

    function reset() {
        sendDone = false;
        sendResults = [];
        sendProgress = 0;
        activeTab = "compose";
    }

    function handleClose() {
        if (!isSending) onclose();
    }

    $effect(() => {
        if (isOpen && prospects.length > 0 && Object.keys(introMap).length === 0) {
            generateAllIntros();
        }
    });

    const previewProspect = $derived(prospects[previewProspectIndex] ?? null);
</script>

{#if isOpen}
    <!-- Notification -->
    {#if notification}
        <div class="fixed bottom-6 right-6 z-[10001] animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div class="border-2 border-black p-3.5 text-xs font-bold uppercase shadow-[4px_4px_0px_0px_#000] {notification.type === 'error' ? 'bg-[#FFC2D1] text-black' : notification.type === 'info' ? 'bg-[#D4E2FD] text-black' : 'bg-[#99E7DC] text-black'}">
                {notification.text}
            </div>
        </div>
    {/if}

    <div class="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs font-mono">
        <div class="w-full max-w-5xl bg-[#EDE9DF] border-3 border-black shadow-[8px_8px_0px_0px_#000] flex flex-col max-h-[92vh] overflow-hidden">

            <!-- Titlebar -->
            <div class="bg-[#FFE600] border-b-2 border-black px-4 py-2 flex items-center justify-between select-none flex-shrink-0">
                <div class="flex items-center gap-2.5">
                    <span class="w-3 h-3 bg-black"></span>
                    <span class="font-black text-xs uppercase tracking-wider text-black">
                        CAMPAGNE EMAIL // {prospects.length} DESTINATAIRE(S)
                    </span>
                    <span class="retro-badge bg-black text-white text-[10px] font-black px-1.5 py-0.5">RESEND</span>
                </div>
                <button onclick={handleClose} disabled={isSending} class="w-6 h-6 border border-black bg-white hover:bg-[#FFC2D1] flex items-center justify-center font-bold text-xs shadow-[1px_1px_0px_0px_#000] disabled:opacity-50">
                    ✕
                </button>
            </div>

            <!-- Tabs -->
            <div class="border-b-2 border-black bg-white flex-shrink-0">
                <div class="flex">
                    <button
                        onclick={() => activeTab = "compose"}
                        class="px-5 py-2.5 text-xs font-black uppercase border-r-2 border-black {activeTab === 'compose' ? 'bg-[#FFE600]' : 'bg-white hover:bg-[#F6F4EE]'}"
                    >
                        <span class="material-symbols-outlined text-[14px] align-middle mr-1">edit</span>
                        Rédaction
                    </button>
                    <button
                        onclick={() => activeTab = "preview"}
                        class="px-5 py-2.5 text-xs font-black uppercase border-r-2 border-black {activeTab === 'preview' ? 'bg-[#D4E2FD]' : 'bg-white hover:bg-[#F6F4EE]'}"
                    >
                        <span class="material-symbols-outlined text-[14px] align-middle mr-1">preview</span>
                        Prévisualisation
                    </button>
                    {#if sendDone}
                        <button
                            onclick={() => activeTab = "results"}
                            class="px-5 py-2.5 text-xs font-black uppercase {activeTab === 'results' ? 'bg-[#99E7DC]' : 'bg-white hover:bg-[#F6F4EE]'}"
                        >
                            <span class="material-symbols-outlined text-[14px] align-middle mr-1">bar_chart</span>
                            Rapport
                        </button>
                    {/if}
                </div>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto">

                {#if activeTab === "compose"}
                    <div class="p-5 space-y-5">

                        <!-- Sender Config -->
                        <div class="bg-white border-2 border-black p-4 shadow-[3px_3px_0px_0px_#000] space-y-3">
                            <div class="text-[10px] font-black uppercase text-black/60 tracking-wider flex items-center gap-2">
                                <span class="material-symbols-outlined text-[14px]">settings</span>
                                Configuration Expéditeur
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div class="space-y-1">
                                    <label class="text-[10px] font-black uppercase text-black/70">Expéditeur (From)</label>
                                    <input
                                        type="text"
                                        bind:value={fromEmail}
                                        onblur={saveFromEmail}
                                        placeholder="Lucas <contact@votre-domaine.com>"
                                        class="retro-input text-xs py-1.5 w-full"
                                    />
                                </div>
                                <div class="space-y-1">
                                    <label class="text-[10px] font-black uppercase text-black/70">Sujet du mail</label>
                                    <input
                                        type="text"
                                        bind:value={subject}
                                        placeholder="Sujet de votre email..."
                                        class="retro-input text-xs py-1.5 w-full"
                                    />
                                </div>
                            </div>
                        </div>

                        <!-- Tone selector -->
                        <div class="bg-[#D4E2FD] border-2 border-black p-4 shadow-[3px_3px_0px_0px_#000] space-y-3">
                            <div class="text-[10px] font-black uppercase text-black/60 tracking-wider flex items-center gap-2">
                                <span class="material-symbols-outlined text-[14px]">psychology</span>
                                Ton de l'introduction (IA Gemini)
                            </div>
                            <div class="flex flex-wrap gap-2">
                                {#each toneOptions as t}
                                    <button
                                        onclick={() => { introTone = t; saveFromEmail(); }}
                                        class="retro-badge text-[10px] cursor-pointer border border-black transition-colors {introTone === t ? 'bg-black text-white shadow-[2px_2px_0px_0px_#555]' : 'bg-white hover:bg-[#FFE600] text-black'}"
                                    >
                                        {t}
                                    </button>
                                {/each}
                            </div>
                            <button
                                onclick={generateAllIntros}
                                disabled={isGeneratingAll}
                                class="retro-btn text-xs py-1.5 px-4 bg-[#FFE600] hover:bg-[#fff066] font-black flex items-center gap-2 shadow-[2px_2px_0px_0px_#000] disabled:opacity-60"
                            >
                                {#if isGeneratingAll}
                                    <span class="loading loading-spinner loading-xs"></span>
                                    <span>Génération en cours...</span>
                                {:else}
                                    <span class="material-symbols-outlined text-[14px]">auto_awesome</span>
                                    <span>Régénérer toutes les introductions ({prospects.length})</span>
                                {/if}
                            </button>
                        </div>

                        <!-- Per-prospect intro list -->
                        <div class="space-y-2">
                            <div class="text-[10px] font-black uppercase text-black/60 tracking-wider flex items-center gap-2">
                                <span class="material-symbols-outlined text-[14px]">person</span>
                                Introductions personnalisées par prospect
                            </div>
                            <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
                                {#each prospects as p}
                                    <div class="bg-white border-2 border-black p-3 flex items-start gap-3 shadow-[2px_2px_0px_0px_#000]">
                                        <div class="flex-1 min-w-0">
                                            <div class="text-[10px] font-black uppercase text-black/50">{p.worktype || "—"}</div>
                                            <div class="text-xs font-bold text-black truncate">{p.email}</div>
                                            {#if loadingIntros[p.email]}
                                                <div class="flex items-center gap-1.5 mt-1">
                                                    <span class="loading loading-dots loading-xs"></span>
                                                    <span class="text-[10px] text-black/50">Génération...</span>
                                                </div>
                                            {:else if getIntro(p)}
                                                <div class="text-[10px] text-black/70 mt-1 line-clamp-2">{getIntro(p)}</div>
                                            {:else}
                                                <div class="text-[10px] text-black/40 mt-1 italic">Aucune introduction générée</div>
                                            {/if}
                                        </div>
                                        <button
                                            onclick={() => generateIntro(p)}
                                            disabled={loadingIntros[p.email]}
                                            class="retro-btn py-1 px-2 text-[10px] bg-[#D4E2FD] hover:bg-[#FFE600] flex-shrink-0 disabled:opacity-50"
                                            title="Régénérer"
                                        >
                                            <span class="material-symbols-outlined text-[12px]">refresh</span>
                                        </button>
                                    </div>
                                {/each}
                            </div>
                        </div>

                        <!-- Corps du message -->
                        <div class="space-y-1">
                            <label class="text-[10px] font-black uppercase text-black/70 flex items-center gap-2">
                                <span class="material-symbols-outlined text-[14px]">article</span>
                                Corps du message (commun à tous)
                            </label>
                            <textarea
                                bind:value={emailBody}
                                rows="7"
                                class="retro-input w-full text-xs py-2 resize-y leading-relaxed"
                                placeholder="Rédigez le corps de votre email..."
                            ></textarea>
                        </div>

                        <!-- Signature -->
                        <div class="space-y-1">
                            <label class="text-[10px] font-black uppercase text-black/70 flex items-center gap-2">
                                <span class="material-symbols-outlined text-[14px]">signature</span>
                                Fin du message & Signature
                            </label>
                            <textarea
                                bind:value={emailSignature}
                                rows="4"
                                class="retro-input w-full text-xs py-2 resize-y leading-relaxed"
                                placeholder="Votre signature..."
                            ></textarea>
                        </div>
                    </div>

                {:else if activeTab === "preview"}
                    <div class="p-5 space-y-4">
                        <!-- Prospect selector -->
                        <div class="flex items-center gap-3">
                            <span class="text-[10px] font-black uppercase text-black/70">Aperçu pour :</span>
                            <select bind:value={previewProspectIndex} class="retro-select text-xs py-1 w-auto">
                                {#each prospects as p, i}
                                    <option value={i}>{p.email} ({p.worktype || "—"})</option>
                                {/each}
                            </select>
                        </div>

                        {#if previewProspect}
                            <!-- Email preview -->
                            <div class="bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] overflow-hidden">
                                <div class="bg-[#EDE9DF] border-b-2 border-black px-4 py-3 text-xs space-y-1">
                                    <div><span class="font-black">De :</span> {fromEmail || "(non renseigné)"}</div>
                                    <div><span class="font-black">À :</span> {previewProspect.email}</div>
                                    <div><span class="font-black">Objet :</span> {subject}</div>
                                </div>
                                <div class="p-6 font-serif text-sm leading-relaxed whitespace-pre-wrap text-black/90">
                                    {#if getIntro(previewProspect)}
                                        <p class="mb-4">{getIntro(previewProspect)}</p>
                                    {/if}
                                    <p class="mb-4">{emailBody}</p>
                                    <hr class="my-4 border-black/20">
                                    <p class="text-black/60 text-xs">{emailSignature}</p>
                                </div>
                            </div>
                        {/if}
                    </div>

                {:else if activeTab === "results" && sendDone}
                    <div class="p-5 space-y-3">
                        <!-- Summary -->
                        <div class="grid grid-cols-3 gap-3">
                            <div class="bg-[#99E7DC] border-2 border-black p-3 text-center shadow-[2px_2px_0px_0px_#000]">
                                <div class="text-2xl font-black">{sendResults.filter(r => r.success).length}</div>
                                <div class="text-[10px] font-black uppercase text-black/70">Envoyés</div>
                            </div>
                            <div class="bg-[#FFC2D1] border-2 border-black p-3 text-center shadow-[2px_2px_0px_0px_#000]">
                                <div class="text-2xl font-black">{sendResults.filter(r => !r.success).length}</div>
                                <div class="text-[10px] font-black uppercase text-black/70">Échecs</div>
                            </div>
                            <div class="bg-white border-2 border-black p-3 text-center shadow-[2px_2px_0px_0px_#000]">
                                <div class="text-2xl font-black">{sendResults.length}</div>
                                <div class="text-[10px] font-black uppercase text-black/70">Total</div>
                            </div>
                        </div>

                        <!-- Per-email results -->
                        <div class="space-y-1.5 max-h-72 overflow-y-auto">
                            {#each sendResults as r}
                                <div class="flex items-center justify-between text-xs p-2.5 border border-black {r.success ? 'bg-[#99E7DC]/30' : 'bg-[#FFC2D1]/30'}">
                                    <div class="flex items-center gap-2">
                                        <span class="material-symbols-outlined text-[14px] {r.success ? 'text-green-700' : 'text-red-700'}">{r.success ? 'check_circle' : 'error'}</span>
                                        <span class="font-mono font-bold truncate max-w-[280px]">{r.to}</span>
                                    </div>
                                    {#if r.success && r.id}
                                        <span class="text-[10px] text-black/50 font-mono truncate">ID: {r.id}</span>
                                    {:else if !r.success}
                                        <span class="text-[10px] text-red-700 font-bold">{r.error}</span>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>

            <!-- Footer Actions -->
            <div class="border-t-2 border-black p-4 bg-white flex-shrink-0">
                {#if isSending}
                    <div class="space-y-2">
                        <div class="text-xs font-black uppercase text-black flex items-center gap-2">
                            <span class="loading loading-dots loading-xs"></span>
                            Envoi en cours... {sendResults.length}/{prospects.length} emails traités
                        </div>
                        <div class="w-full bg-[#EDE9DF] border border-black h-3 overflow-hidden">
                            <div class="bg-black h-full transition-all duration-300" style="width: {Math.round((sendResults.length / prospects.length) * 100)}%;"></div>
                        </div>
                    </div>
                {:else if sendDone}
                    <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
                        <span class="text-xs font-bold text-black">
                            Campagne terminée — {sendResults.filter(r => r.success).length}/{sendResults.length} emails envoyés avec succès
                        </span>
                        <div class="flex gap-2">
                            <button onclick={reset} class="retro-btn text-xs py-2 px-4 bg-[#D4E2FD] hover:bg-[#FFE600] font-bold">
                                Nouvelle campagne
                            </button>
                            <button onclick={handleClose} class="retro-btn text-xs py-2 px-4 bg-white font-bold">
                                Fermer
                            </button>
                        </div>
                    </div>
                {:else}
                    <div class="flex flex-col sm:flex-row items-center gap-3 justify-between">
                        <!-- Test send -->
                        <div class="flex items-center gap-2 w-full sm:w-auto">
                            <input
                                type="email"
                                bind:value={testEmail}
                                placeholder="Email de test (facultatif)"
                                class="retro-input text-xs py-1.5 w-44"
                            />
                            <button
                                onclick={() => sendCampaign(true)}
                                class="retro-btn text-xs py-2 px-3 bg-white hover:bg-[#D4E2FD] font-bold flex items-center gap-1.5 whitespace-nowrap"
                            >
                                <span class="material-symbols-outlined text-[14px]">science</span>
                                Test
                            </button>
                        </div>

                        <div class="flex items-center gap-2">
                            <button onclick={handleClose} class="retro-btn text-xs py-2 px-4 bg-white font-bold">
                                Annuler
                            </button>
                            <button
                                onclick={() => sendCampaign(false)}
                                disabled={!fromEmail.trim() || !subject.trim()}
                                class="retro-btn-primary text-xs py-2.5 px-6 font-black flex items-center gap-2 shadow-[3px_3px_0px_0px_#000] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span class="material-symbols-outlined text-[16px]">send</span>
                                <span>Envoyer à {prospects.length} prospect(s)</span>
                            </button>
                        </div>
                    </div>
                {/if}
            </div>

        </div>
    </div>
{/if}
