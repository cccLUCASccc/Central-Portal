<script lang="ts">
    import { onMount } from "svelte";

    interface Props {
        targetUrl?: string;
    }

    let { targetUrl = "/" }: Props = $props();

    // États du formulaire et du terminal
    let identifier = $state("");
    let password = $state("");
    let showPassword = $state(false);
    let isLoading = $state(false);
    let errorMessage = $state("");
    let successMessage = $state("");
    
    // États 2FA / Code de validation
    let needsSecondFactor = $state(false);
    let isFirstFactorCode = $state(false);
    let secondFactorCode = $state("");
    let secondFactorStrategy = $state("email_code");
    let availableFactors = $state<any[]>([]);
    let pendingSignInAttempt = $state<any>(null);
    let pendingSecondFactor = $state<any>(null);
    let isResending = $state(false);
    let safeIdentifier = $state("");
    let resendCountdown = $state(0);
    
    // Phases : 'login' | 'closing' | 'terminal'
    let phase = $state<"login" | "closing" | "terminal">("login");
    let progress = $state(0);
    
    interface LogEntry {
        type: "info" | "success" | "warn" | "accent" | "cmd";
        tag: string;
        text: string;
        time?: string;
    }
    
    let logs = $state<LogEntry[]>([]);

    const BOOT_STEPS: LogEntry[] = [
        { type: "cmd", tag: "EXEC", text: "guest@gestionnaire-sys:~$ ./start_system.sh --env=production" },
        { type: "info", tag: "BIOS", text: "DAISY-BIOS v4.02 — RAM Check: 1024KB OK • BUS: 32-BIT VME" },
        { type: "info", tag: "BOOT_INIT", text: "Chargement du micro-noyau Gestionnaire.SYS (v3.2)..." },
        { type: "success", tag: "AUTH_OK", text: "Protocole Clerk validé • Clé de session injectée" },
        { type: "accent", tag: "NET_API", text: "Connexion API Centrale (Railway) : https://central-api... [200 OK]" },
        { type: "success", tag: "STORAGE", text: "Montage du bucket AWS S3 (daisy-brocante) : ACTIF & PRÊT" },
        { type: "info", tag: "EBAY_SYNC", text: "Synchronisation du service eBay Marketplace... ÉTABLIE" },
        { type: "accent", tag: "CACHE", text: "Indexation du catalogue d'antiquités & tables d'inventaire... 100%" },
        { type: "success", tag: "SYS_READY", text: "STATION OPÉRATIONNELLE. Redirection vers le tableau de bord..." },
    ];

    function startTerminalSequence() {
        logs = [];
        progress = 0;
        const totalSteps = BOOT_STEPS.length;
        let step = 0;

        // Intervalle plus lent (~360ms par ligne pour laisser le temps de lire)
        const interval = setInterval(() => {
            if (step < totalSteps) {
                const item = BOOT_STEPS[step];
                const now = new Date();
                const timeStr = now.toTimeString().split(" ")[0] + "." + Math.floor(now.getMilliseconds() / 100);
                logs = [...logs, { ...item, time: timeStr }];
                step++;
                progress = Math.min(100, Math.round((step / totalSteps) * 100));
            } else {
                clearInterval(interval);
                progress = 100;
                setTimeout(() => {
                    redirectToPortal();
                }, 500);
            }
        }, 360);
    }

    function triggerMorphToTerminal() {
        if (phase === "terminal" || phase === "closing") return;
        
        // 1. Fermeture / repli de la fenêtre
        phase = "closing";
        
        // 2. Après 280ms, réouverture en mode Terminal
        setTimeout(() => {
            phase = "terminal";
            startTerminalSequence();
        }, 300);
    }

    function sanitizeRedirectUrl(urlStr: string | null | undefined): string {
        if (!urlStr) return "/";
        try {
            if (urlStr.startsWith("/") && !urlStr.startsWith("//")) {
                return urlStr;
            }
            const parsed = new URL(urlStr, typeof window !== "undefined" ? window.location.origin : "http://localhost");
            const result = parsed.pathname + parsed.search + parsed.hash;
            return (result && !result.startsWith("//")) ? result : "/";
        } catch (_) {
            return "/";
        }
    }

    function getResolvedTargetUrl(): string {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const redirectParam = params.get("redirect_url");
            if (redirectParam) {
                const cleaned = sanitizeRedirectUrl(redirectParam);
                if (cleaned && cleaned !== "/") return cleaned;
            }
        }
        return sanitizeRedirectUrl(targetUrl);
    }

    function redirectToPortal() {
        const dest = getResolvedTargetUrl();
        window.location.replace(dest);
    }

    async function getClerkInstance(timeoutMs = 8000): Promise<any> {
        if (typeof window === "undefined") return null;
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const clerk = (window as any).Clerk;
            if (clerk) {
                if (!clerk.loaded && typeof clerk.load === "function") {
                    try {
                        await clerk.load();
                    } catch (e) {
                        console.warn("Clerk.load() error:", e);
                    }
                }
                if (clerk.loaded) {
                    return clerk;
                }
            }
            await new Promise((resolve) => setTimeout(resolve, 80));
        }
        return (window as any).Clerk || null;
    }

    async function switchSecondFactorStrategy(factor: any, attemptObj?: any) {
        const attempt = attemptObj || pendingSignInAttempt;
        if (!attempt) return;

        pendingSecondFactor = factor;
        secondFactorStrategy = factor.strategy;
        safeIdentifier = factor.safeIdentifier || "";
        secondFactorCode = "";
        errorMessage = "";
        successMessage = "";

        // Si la stratégie requiert un envoi de code (email_code ou phone_code)
        if (factor.strategy === "email_code" || factor.strategy === "phone_code") {
            isLoading = true;
            try {
                const prepPayload: any = { strategy: factor.strategy };
                if (factor.emailAddressId) prepPayload.emailAddressId = factor.emailAddressId;
                if (factor.phoneNumberId) prepPayload.phoneNumberId = factor.phoneNumberId;

                console.log("Envoi du code 2FA avec prepareSecondFactor:", prepPayload);
                await attempt.prepareSecondFactor(prepPayload);
                startResendTimer();
                successMessage = factor.strategy === "email_code"
                    ? `Code envoyé par e-mail à ${safeIdentifier || "votre adresse"}.`
                    : `Code envoyé par SMS à ${safeIdentifier || "votre numéro"}.`;
            } catch (err: any) {
                console.error("Erreur prepareSecondFactor:", err);
                errorMessage = err.errors?.[0]?.longMessage || err.message || "Erreur lors de l'envoi du code.";
            } finally {
                isLoading = false;
            }
        }
    }

    async function setupSecondFactor(attempt: any) {
        pendingSignInAttempt = attempt;
        availableFactors = attempt.supportedSecondFactors || [];
        isFirstFactorCode = false;

        // Stratégie préférée : email_code, puis totp, puis phone_code
        const emailFactor = availableFactors.find((f: any) => f.strategy === "email_code");
        const totpFactor = availableFactors.find((f: any) => f.strategy === "totp");
        const phoneFactor = availableFactors.find((f: any) => f.strategy === "phone_code");

        const selected = emailFactor || totpFactor || phoneFactor || availableFactors[0];

        if (!selected) {
            throw new Error("Aucune méthode de validation supplémentaire trouvée.");
        }

        needsSecondFactor = true;
        await switchSecondFactorStrategy(selected, attempt);
    }

    function startResendTimer() {
        resendCountdown = 30;
        const timer = setInterval(() => {
            resendCountdown--;
            if (resendCountdown <= 0) {
                clearInterval(timer);
            }
        }, 1000);
    }

    async function resendCode() {
        if (!pendingSignInAttempt || !pendingSecondFactor || resendCountdown > 0) return;
        if (pendingSecondFactor.strategy !== "email_code" && pendingSecondFactor.strategy !== "phone_code") return;

        isResending = true;
        errorMessage = "";
        successMessage = "";

        try {
            const prepPayload: any = { strategy: pendingSecondFactor.strategy };
            if (pendingSecondFactor.emailAddressId) prepPayload.emailAddressId = pendingSecondFactor.emailAddressId;
            if (pendingSecondFactor.phoneNumberId) prepPayload.phoneNumberId = pendingSecondFactor.phoneNumberId;

            if (isFirstFactorCode) {
                await pendingSignInAttempt.prepareFirstFactor(prepPayload);
            } else {
                await pendingSignInAttempt.prepareSecondFactor(prepPayload);
            }

            startResendTimer();
            successMessage = "Nouveau code envoyé avec succès !";
        } catch (err: any) {
            console.error("Erreur renvoi code:", err);
            errorMessage = err.errors?.[0]?.longMessage || err.message || "Impossible de renvoyer le code.";
        } finally {
            isResending = false;
        }
    }

    async function handleLogin(e: SubmitEvent) {
        e.preventDefault();
        errorMessage = "";
        successMessage = "";
        needsSecondFactor = false;
        isFirstFactorCode = false;
        secondFactorCode = "";
        pendingSignInAttempt = null;
        pendingSecondFactor = null;
        availableFactors = [];
        
        if (!identifier.trim() || !password) {
            errorMessage = "Veuillez renseigner votre identifiant et mot de passe.";
            return;
        }

        isLoading = true;

        try {
            const clerk = await getClerkInstance();
            if (!clerk) {
                throw new Error("Service d'authentification indisponible. Veuillez rafraîchir la page.");
            }

            if (!clerk.loaded && typeof clerk.load === "function") {
                await clerk.load();
            }

            // Tentative initiale de connexion avec identifiant
            let signInAttempt = await clerk.client.signIn.create({
                identifier: identifier.trim(),
                password: password,
            });

            // 1. Connexion réussie immédiatement
            if (signInAttempt.status === "complete") {
                await clerk.setActive({ session: signInAttempt.createdSessionId });
                triggerMorphToTerminal();
                return;
            }

            // 2. Si Clerk requiert une tentative de premier facteur (password ou email_code)
            if (signInAttempt.status === "needs_first_factor") {
                const factors = signInAttempt.supportedFirstFactors || [];
                const passwordFactor = factors.find((f: any) => f.strategy === "password");
                const emailCodeFactor = factors.find((f: any) => f.strategy === "email_code");

                if (password && passwordFactor) {
                    const factorAttempt = await signInAttempt.attemptFirstFactor({
                        strategy: "password",
                        password: password,
                    });

                    if (factorAttempt.status === "complete") {
                        await clerk.setActive({ session: factorAttempt.createdSessionId });
                        triggerMorphToTerminal();
                        return;
                    } else if (factorAttempt.status === "needs_second_factor" || factorAttempt.status === "needs_client_trust") {
                        await setupSecondFactor(factorAttempt);
                        return;
                    } else {
                        errorMessage = `Statut après mot de passe : ${factorAttempt.status}.`;
                        isLoading = false;
                        return;
                    }
                } else if (emailCodeFactor) {
                    // Stratégie premier facteur par email_code
                    isFirstFactorCode = true;
                    pendingSignInAttempt = signInAttempt;
                    pendingSecondFactor = emailCodeFactor;
                    secondFactorStrategy = "email_code";
                    safeIdentifier = emailCodeFactor.safeIdentifier || identifier.trim();

                    const prepPayload: any = { strategy: "email_code" };
                    if (emailCodeFactor.emailAddressId) prepPayload.emailAddressId = emailCodeFactor.emailAddressId;

                    await signInAttempt.prepareFirstFactor(prepPayload);
                    startResendTimer();
                    needsSecondFactor = true;
                    successMessage = `Code envoyé par e-mail à ${safeIdentifier}.`;
                    isLoading = false;
                    return;
                } else {
                    throw new Error("L'authentification par mot de passe n'est pas disponible pour ce compte.");
                }
            }

            // 3. Si validation en 2 étapes requise (2FA / TOTP / Device Trust)
            if (signInAttempt.status === "needs_second_factor" || signInAttempt.status === "needs_client_trust") {
                await setupSecondFactor(signInAttempt);
                return;
            }

            console.warn("Statut Clerk non complété:", signInAttempt);
            errorMessage = `Authentification incomplète : statut ${signInAttempt.status}.`;
            isLoading = false;
        } catch (err: any) {
            console.error("Erreur de connexion:", err);
            isLoading = false;
            if (err.errors && err.errors.length > 0) {
                const firstErr = err.errors[0];
                if (firstErr.code === "form_identifier_not_found") {
                    errorMessage = "Identifiant ou adresse e-mail introuvable.";
                } else if (firstErr.code === "form_password_incorrect") {
                    errorMessage = "Mot de passe incorrect. Veuillez réessayer.";
                } else if (firstErr.code === "session_exists") {
                    try {
                        const clerk = (window as any).Clerk;
                        if (clerk?.session) {
                            triggerMorphToTerminal();
                            return;
                        }
                    } catch (_) {}
                    errorMessage = "Une session est déjà active. Redirection...";
                    setTimeout(() => redirectToPortal(), 600);
                } else {
                    errorMessage = firstErr.longMessage || firstErr.message || "Erreur de connexion.";
                }
            } else {
                errorMessage = err.message || "Impossible de se connecter au serveur.";
            }
        }
    }

    async function handleSecondFactor(e: SubmitEvent) {
        e.preventDefault();
        errorMessage = "";
        successMessage = "";

        if (!pendingSignInAttempt) {
            errorMessage = "Session d'authentification invalide. Relancez la connexion.";
            return;
        }

        if (!secondFactorCode.trim()) {
            errorMessage = "Veuillez saisir le code de validation reçu.";
            return;
        }

        isLoading = true;

        try {
            const clerk = await getClerkInstance();
            if (!clerk || !clerk.loaded) {
                throw new Error("Service d'authentification indisponible.");
            }

            const payload = {
                strategy: secondFactorStrategy,
                code: secondFactorCode.trim(),
            };

            let resultAttempt;
            if (isFirstFactorCode) {
                resultAttempt = await pendingSignInAttempt.attemptFirstFactor(payload);
            } else {
                resultAttempt = await pendingSignInAttempt.attemptSecondFactor(payload);
            }

            if (resultAttempt.status === "complete") {
                await clerk.setActive({ session: resultAttempt.createdSessionId });
                triggerMorphToTerminal();
                return;
            } else if (resultAttempt.status === "needs_second_factor" || resultAttempt.status === "needs_client_trust") {
                isFirstFactorCode = false;
                await setupSecondFactor(resultAttempt);
                return;
            }

            errorMessage = `Validation incomplète : statut ${resultAttempt.status}.`;
            isLoading = false;
        } catch (err: any) {
            console.error("Erreur validation code:", err);
            isLoading = false;

            if (err.errors && err.errors.length > 0) {
                const firstErr = err.errors[0];
                if (firstErr.code === "form_code_incorrect") {
                    errorMessage = "Code de validation incorrect. Veuillez vérifier.";
                } else {
                    errorMessage = firstErr.longMessage || firstErr.message || "Code de validation invalide.";
                }
            } else {
                errorMessage = err.message || "Erreur lors de la validation du code.";
            }
        }
    }

    function resetSecondFactor() {
        needsSecondFactor = false;
        isFirstFactorCode = false;
        secondFactorCode = "";
        pendingSignInAttempt = null;
        pendingSecondFactor = null;
        availableFactors = [];
        errorMessage = "";
        successMessage = "";
        resendCountdown = 0;
    }

    onMount(() => {
        let isMounted = true;

        // Détection de session active Clerk
        (async () => {
            try {
                const clerk = await getClerkInstance(5000);
                if (!isMounted || !clerk) return;

                if (clerk.session && clerk.user && phase === "login") {
                    triggerMorphToTerminal();
                    return;
                }

                clerk.addListener((payload: any) => {
                    if (!isMounted) return;
                    if (payload.session && payload.user && phase === "login") {
                        triggerMorphToTerminal();
                    }
                });
            } catch (e) {
                console.debug("Initial Clerk check:", e);
            }
        })();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (phase === "terminal" && (e.key === "Escape" || e.key === "Enter" || e.key === " ")) {
                redirectToPortal();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            isMounted = false;
            window.removeEventListener("keydown", handleKeyDown);
        };
    });
</script>

<div class="w-full flex flex-col items-center max-w-xl md:max-w-2xl mx-auto transition-all duration-300">
    
    <!-- Application Header -->
    <div class="w-full mb-6 text-center flex flex-col items-center">
        <div class="inline-flex items-center gap-3 mb-3">
            <div class="w-12 h-12 bg-[#FFD2A6] border-2 border-black flex items-center justify-center font-mono font-black text-2xl shadow-[3px_3px_0px_0px_#000]">
                G
            </div>
            <div class="text-left flex flex-col">
                <span class="font-black text-2xl md:text-3xl tracking-tight uppercase leading-none font-mono">
                    GESTIONNAIRE<span class="text-[#FFC2D1]">.SYS</span>
                </span>
                <span class="text-[11px] font-mono font-bold tracking-widest text-black/60 uppercase">
                    Daisy Brocante • Portail Gestion
                </span>
            </div>
        </div>
        
        <div class="flex items-center gap-2 font-mono text-xs mt-1">
            <span class="retro-badge bg-[#99E7DC]">AUTHENTIFICATION</span>
            <span class="retro-badge bg-[#FFF394]">ZONE SÉCURISÉE</span>
            <span class="retro-badge bg-[#D4E2FD] hidden sm:inline-flex">VT100 READY</span>
        </div>
    </div>

    <!-- Retro Window Frame avec animation de morphing et dimensions confortables -->
    <div 
        class="w-full bg-[#EDE9DF] border-3 border-black shadow-[8px_8px_0px_0px_#000] p-1.5 transition-all duration-300 transform origin-center {phase === 'closing' ? 'scale-y-0 opacity-20' : 'scale-y-100 opacity-100'}"
    >
        {#if phase === "login" || phase === "closing"}
            <!-- Window Titlebar Login -->
            <div class="bg-[#2B2D42] text-white px-3.5 py-2 border-b-2 border-black flex items-center justify-between font-mono text-xs font-bold mb-3">
                <div class="flex items-center gap-2.5">
                    <span class="text-[#99E7DC] font-black">▶</span>
                    <span class="tracking-wider uppercase">
                        {needsSecondFactor ? "SECURITY_CHECK.EXE — 2FA / OTP" : "LOGIN_PROMPT.EXE — SESSION CONSOLE"}
                    </span>
                </div>
                <div class="flex items-center gap-1.5">
                    <span class="w-3.5 h-3.5 bg-[#FFC2D1] border border-black inline-block shadow-[1px_1px_0px_0px_#000]"></span>
                    <span class="w-3.5 h-3.5 bg-[#FFF394] border border-black inline-block shadow-[1px_1px_0px_0px_#000]"></span>
                    <span class="w-3.5 h-3.5 bg-[#99E7DC] border border-black inline-block shadow-[1px_1px_0px_0px_#000]"></span>
                </div>
            </div>

            <!-- Login Form Content -->
            <div class="p-5 sm:p-8 bg-white border-2 border-black m-1 shadow-[3px_3px_0px_0px_#000]">
                
                <div class="mb-6 text-center sm:text-left">
                    <div class="inline-block bg-[#FFD2A6] px-2 py-0.5 border border-black text-[10px] font-mono font-bold uppercase mb-1 shadow-[1px_1px_0px_0px_#000]">
                        {needsSecondFactor ? "VALIDATION DE SÉCURITÉ" : "ACCÈS ADMINISTRATEUR"}
                    </div>
                    <h2 class="font-mono font-black text-xl uppercase text-black tracking-tight">
                        {needsSecondFactor ? "Code de vérification" : "Connexion au portail"}
                    </h2>
                    <p class="font-mono text-xs text-black/60 font-semibold mt-1">
                        {#if !needsSecondFactor}
                            Saisissez vos identifiants pour démarrer le terminal Gestionnaire.SYS.
                        {:else if secondFactorStrategy === 'email_code'}
                            Un code à 6 chiffres a été envoyé à {safeIdentifier ? safeIdentifier : "votre adresse email"}.
                        {:else if secondFactorStrategy === 'phone_code'}
                            Un code à 6 chiffres a été envoyé par SMS au {safeIdentifier ? safeIdentifier : "votre numéro"}.
                        {:else}
                            Saisissez le code généré par votre application d'authentification (Google Authenticator, etc.).
                        {/if}
                    </p>
                </div>

                {#if errorMessage}
                    <div class="mb-5 p-3.5 bg-[#FFC2D1] border-2 border-black font-mono text-xs font-bold shadow-[2px_2px_0px_0px_#000] flex items-center gap-2.5">
                        <span class="material-symbols-outlined text-base text-black">warning</span>
                        <span>{errorMessage}</span>
                    </div>
                {/if}

                {#if successMessage}
                    <div class="mb-5 p-3.5 bg-[#99E7DC] border-2 border-black font-mono text-xs font-bold shadow-[2px_2px_0px_0px_#000] flex items-center gap-2.5">
                        <span class="material-symbols-outlined text-base text-black">bolt</span>
                        <span>{successMessage}</span>
                    </div>
                {/if}

                {#if !needsSecondFactor}
                    <form onsubmit={handleLogin} class="space-y-4 font-mono">
                        <div>
                            <label for="identifier" class="block text-xs font-black uppercase text-black mb-1.5 tracking-wider">
                                Identifiant / Adresse E-mail
                            </label>
                            <input
                                id="identifier"
                                type="text"
                                bind:value={identifier}
                                placeholder="admin@daisybrocante.fr"
                                required
                                disabled={isLoading}
                                class="retro-input text-sm py-2.5"
                            />
                        </div>

                        <div>
                            <div class="flex items-center justify-between mb-1.5">
                                <label for="password" class="text-xs font-black uppercase text-black tracking-wider">
                                    Mot de passe
                                </label>
                                <button
                                    type="button"
                                    onclick={() => showPassword = !showPassword}
                                    class="text-[11px] text-black/70 hover:text-black font-bold uppercase underline cursor-pointer"
                                >
                                    {showPassword ? "Masquer" : "Afficher"}
                                </button>
                            </div>
                            <input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                bind:value={password}
                                placeholder="••••••••••••"
                                required
                                disabled={isLoading}
                                class="retro-input text-sm py-2.5"
                            />
                        </div>

                        <div class="pt-3">
                            <button
                                type="submit"
                                disabled={isLoading}
                                class="w-full retro-btn retro-btn-primary py-3.5 text-sm font-black flex items-center justify-center gap-2 cursor-pointer shadow-[3px_3px_0px_0px_#000] hover:shadow-[5px_5px_0px_0px_#000] {isLoading ? 'opacity-70 cursor-wait' : ''}"
                            >
                                {#if isLoading}
                                    <span class="inline-block w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                                    <span>VÉRIFICATION DES DROITS...</span>
                                {:else}
                                    <span class="material-symbols-outlined text-[16px]">bolt</span>
                                    <span>SE CONNECTER AU SYSTÈME</span>
                                {/if}
                            </button>
                        </div>
                    </form>
                {:else}
                    <form onsubmit={handleSecondFactor} class="space-y-4 font-mono">
                        
                        <!-- Sélecteur de méthode si plusieurs sont disponibles -->
                        {#if availableFactors.length > 1}
                            <div class="p-2.5 bg-[#EDE9DF] border-2 border-black space-y-1.5 shadow-[2px_2px_0px_0px_#000]">
                                <span class="text-[10px] font-black uppercase tracking-wider text-black/70 block">Méthode de réception :</span>
                                <div class="flex flex-wrap gap-1.5">
                                    {#each availableFactors as factor}
                                        <button
                                            type="button"
                                            disabled={isLoading}
                                            onclick={() => switchSecondFactorStrategy(factor)}
                                            class="retro-btn btn-xs text-[10px] {secondFactorStrategy === factor.strategy ? '!bg-[#99E7DC] font-black shadow-[2px_2px_0px_0px_#000]' : 'bg-white'} flex items-center gap-1"
                                        >
                                            {#if factor.strategy === 'email_code'}
                                                <span class="material-symbols-outlined text-[12px]">mail</span>
                                                <span>Email ({factor.safeIdentifier || 'par défaut'})</span>
                                            {:else if factor.strategy === 'totp'}
                                                <span class="material-symbols-outlined text-[12px]">smartphone</span>
                                                <span>Authenticator App</span>
                                            {:else if factor.strategy === 'phone_code'}
                                                <span class="material-symbols-outlined text-[12px]">sms</span>
                                                <span>SMS ({factor.safeIdentifier || 'par défaut'})</span>
                                            {:else}
                                                <span class="material-symbols-outlined text-[12px]">key</span>
                                                <span>{factor.strategy}</span>
                                            {/if}
                                        </button>
                                    {/each}
                                </div>
                            </div>
                        {/if}

                        <div>
                            <div class="flex items-center justify-between mb-1.5">
                                <label for="otp" class="text-xs font-black uppercase text-black tracking-wider">
                                    Code de vérification {secondFactorStrategy === 'email_code' ? '(reçu par email)' : secondFactorStrategy === 'phone_code' ? '(reçu par SMS)' : '(Authenticator)'}
                                </label>
                                {#if secondFactorStrategy === 'email_code' || secondFactorStrategy === 'phone_code'}
                                    <button
                                        type="button"
                                        onclick={resendCode}
                                        disabled={isLoading || isResending || resendCountdown > 0}
                                        class="text-[11px] font-bold text-black/80 hover:text-black underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                    >
                                        {#if isResending}
                                            <span>Envoi en cours...</span>
                                        {:else if resendCountdown > 0}
                                            <span>Renvoyer ({resendCountdown}s)</span>
                                        {:else}
                                            <span class="material-symbols-outlined text-[12px]">refresh</span>
                                            <span>Renvoyer le code</span>
                                        {/if}
                                    </button>
                                {/if}
                            </div>
                            <input
                                id="otp"
                                type="text"
                                inputmode="numeric"
                                autocomplete="one-time-code"
                                bind:value={secondFactorCode}
                                placeholder="123456"
                                required
                                disabled={isLoading}
                                class="retro-input text-base tracking-[0.25em] font-bold text-center py-3"
                            />
                        </div>

                        <div class="pt-3 flex gap-2.5">
                            <button
                                type="submit"
                                disabled={isLoading}
                                class="flex-1 retro-btn retro-btn-primary py-3.5 text-sm font-black flex items-center justify-center gap-2 cursor-pointer shadow-[3px_3px_0px_0px_#000] hover:shadow-[5px_5px_0px_0px_#000] {isLoading ? 'opacity-70 cursor-wait' : ''}"
                            >
                                {#if isLoading}
                                    <span class="inline-block w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                                    <span>VALIDATION...</span>
                                {:else}
                                    <span class="material-symbols-outlined text-[16px]">check</span>
                                    <span>VALIDER LE CODE</span>
                                {/if}
                            </button>

                            <button
                                type="button"
                                onclick={resetSecondFactor}
                                disabled={isLoading}
                                class="retro-btn py-3.5 px-4 text-xs bg-white hover:bg-[#FFC2D1] shadow-[2px_2px_0px_0px_#000]"
                            >
                                « Retour
                            </button>
                        </div>
                    </form>
                {/if}

            </div>

            <!-- Window Bottom Status Bar -->
            <div class="mt-2 px-4 py-2 bg-white border-t-2 border-black flex items-center justify-between font-mono text-xs text-black/70">
                <span class="font-bold">CLERK_SECURITY // v3.2</span>
                <span class="font-bold text-black flex items-center gap-1.5">
                    <span class="w-2 h-2 bg-green-500 rounded-full inline-block animate-pulse"></span>
                    PRÊT POUR AUTHENTIFICATION
                </span>
            </div>

        {:else}
            <!-- Window Titlebar Terminal (Reopen) -->
            <div class="bg-[#111827] text-white px-3.5 py-2 border-b-2 border-black flex items-center justify-between font-mono text-xs font-bold mb-2">
                <div class="flex items-center gap-2.5">
                    <span class="w-2.5 h-2.5 rounded-none bg-[#99E7DC] inline-block animate-ping"></span>
                    <span class="text-[#99E7DC] tracking-wider uppercase font-black">
                        GESTIONNAIRE.SYS // TERMINAL_BOOT.EXE [PID: 4092]
                    </span>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-[10px] text-white/50 hidden sm:inline">[ESC pour passer]</span>
                    <button 
                        type="button"
                        onclick={redirectToPortal}
                        class="w-4 h-4 bg-[#FFC2D1] border border-black hover:bg-white text-black text-[9px] flex items-center justify-center font-black cursor-pointer shadow-[1px_1px_0px_0px_#000]"
                        title="Passer"
                    >
                        ✕
                    </button>
                </div>
            </div>

            <!-- Enhanced CRT Retro Terminal Screen -->
            <div class="relative p-5 sm:p-6 bg-[#090D13] text-white border-2 border-black m-1 shadow-[4px_4px_0px_0px_#000] font-mono text-xs space-y-4 overflow-hidden rounded-none">
                
                <!-- CRT Scanline Background Overlay -->
                <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.4)_50%)] bg-[length:100%_4px] opacity-70 z-10"></div>
                
                <!-- CRT Screen Radial Vignette / Glow -->
                <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] z-10"></div>

                <!-- Terminal Header Status Bar -->
                <div class="relative z-20 flex items-center justify-between border-b border-white/15 pb-2 text-[10px] text-white/60">
                    <div class="flex items-center gap-3">
                        <span class="text-[#99E7DC] font-bold">● ONLINE</span>
                        <span>TTY1 : /dev/console</span>
                        <span class="hidden sm:inline">BAUD: 115200</span>
                    </div>
                    <div class="flex items-center gap-2 text-[#FFF394] font-bold">
                        <span>CPU: 4.8%</span>
                        <span>MEM: 1024KB</span>
                    </div>
                </div>

                <!-- Retro ASCII Mini Banner avec Phosphor Glow -->
                <div class="relative z-20 text-[#FFD2A6] text-[9px] sm:text-[11px] leading-tight whitespace-pre opacity-95 border-b border-white/10 pb-3 overflow-x-auto drop-shadow-[0_0_6px_rgba(255,210,166,0.5)]">
{`  ██████╗  █████╗ ██╗███████╗██╗   ██╗    ██████╗ ██████╗  ██████╗  ██████╗ 
  ██╔══██╗██╔══██╗██║██╔════╝╚██╗ ██╔╝    ██╔══██╗██╔══██╗██╔═══██╗██╔════╝ 
  ██║  ██║███████║██║███████╗ ╚████╔╝     ██████╔╝██████╔╝██║   ██║██║      
  ██║  ██║██╔══██║██║╚════██║  ╚██╔╝      ██╔══██╗██╔══██╗██║   ██║██║      
  ██████╔╝██║  ██║██║███████║   ██║       ██████╔╝██║  ██║╚██████╔╝╚██████╗ 
  ╚═════╝ ╚═╝  ╚═╝╚═╝╚══════╝   ╚═╝       ╚═════╝ ╚═╝  ╚═╝ ╚═════╝  ╚═════╝ `}
                </div>

                <!-- Logs stream avec styles rétro et Phosphor Glow -->
                <div class="relative z-20 space-y-2 min-h-[190px] max-h-64 overflow-y-auto py-1">
                    {#each logs as log}
                        <div class="flex items-start gap-2.5 leading-relaxed animate-in fade-in slide-in-from-left-2 duration-150 font-mono text-[11px] sm:text-xs">
                            <span class="text-white/35 text-[10px] select-none">[{log.time}]</span>
                            
                            {#if log.type === 'cmd'}
                                <span class="text-[#FFF394] font-bold tracking-wide drop-shadow-[0_0_4px_rgba(255,243,148,0.6)]">
                                    {log.text}
                                </span>
                            {:else if log.type === 'success'}
                                <span class="bg-[#99E7DC] text-black px-1.5 py-0.2 font-black text-[10px] uppercase shadow-[1px_1px_0px_0px_#000]">
                                    {log.tag}
                                </span>
                                <span class="text-[#99E7DC] font-bold drop-shadow-[0_0_5px_rgba(153,231,220,0.6)]">
                                    {log.text}
                                </span>
                            {:else if log.type === 'accent'}
                                <span class="bg-[#FFD2A6] text-black px-1.5 py-0.2 font-black text-[10px] uppercase shadow-[1px_1px_0px_0px_#000]">
                                    {log.tag}
                                </span>
                                <span class="text-[#FFD2A6] font-semibold drop-shadow-[0_0_5px_rgba(255,210,166,0.5)]">
                                    {log.text}
                                </span>
                            {:else if log.type === 'warn'}
                                <span class="bg-[#FFF394] text-black px-1.5 py-0.2 font-black text-[10px] uppercase shadow-[1px_1px_0px_0px_#000]">
                                    {log.tag}
                                </span>
                                <span class="text-[#FFF394] drop-shadow-[0_0_5px_rgba(255,243,148,0.5)]">{log.text}</span>
                            {:else}
                                <span class="bg-[#D4E2FD] text-black px-1.5 py-0.2 font-black text-[10px] uppercase shadow-[1px_1px_0px_0px_#000]">
                                    {log.tag}
                                </span>
                                <span class="text-white/90">{log.text}</span>
                            {/if}
                        </div>
                    {/each}
                    
                    <div class="flex items-center gap-1 text-[#99E7DC] font-bold pt-1">
                        <span class="text-[#99E7DC]">&gt;</span>
                        <span class="inline-block w-2.5 h-4 bg-[#99E7DC] animate-pulse drop-shadow-[0_0_6px_#99E7DC]"></span>
                    </div>
                </div>

                <!-- Progress Bar Rétro Néo-Brutaliste -->
                <div class="relative z-20 pt-3 border-t border-white/15 space-y-2">
                    <div class="flex items-center justify-between text-xs font-black">
                        <span class="text-white/80 uppercase tracking-wider">CHARGEMENT DU PORTAIL EN COURS :</span>
                        <span class="text-[#99E7DC] font-mono text-sm drop-shadow-[0_0_6px_#99E7DC]">{progress}%</span>
                    </div>
                    
                    <div class="w-full h-5 bg-black border-2 border-white/30 p-0.5 relative shadow-[2px_2px_0px_0px_rgba(255,255,255,0.1)]">
                        <div 
                            class="h-full bg-gradient-to-r from-[#99E7DC] to-[#FFD2A6] transition-all duration-250 relative overflow-hidden"
                            style="width: {progress}%;"
                        >
                            <!-- Animated Stripes inside progress bar -->
                            <div class="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(0,0,0,0.25)_6px,rgba(0,0,0,0.25)_12px)]"></div>
                        </div>
                    </div>
                </div>

            </div>

            <!-- Terminal Bottom Controls -->
            <div class="mt-2 px-4 py-2 bg-white border-t-2 border-black flex items-center justify-between font-mono text-xs text-black">
                <div class="flex items-center gap-2 text-black/70">
                    <span class="w-2 h-2 bg-green-500 rounded-full inline-block animate-ping"></span>
                    <span class="font-bold text-[11px]">FLUX SÉCURISÉ SSL // RAILWAY-API</span>
                </div>
                <button 
                    type="button"
                    onclick={redirectToPortal}
                    class="retro-btn btn-xs bg-[#FFC2D1] hover:bg-white text-black font-black px-3 py-1 border-2 border-black shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer flex items-center gap-1"
                >
                    <span>PASSER L'ANIMATION</span>
                    <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
            </div>
        {/if}
    </div>

    <!-- Security notice -->
    <div class="mt-6 text-center font-mono text-xs text-black/60 max-w-md">
        <p class="flex items-center justify-center gap-1.5">
            <span class="material-symbols-outlined text-[14px]">lock</span>
            <span>Accès strictement réservé aux gestionnaires autorisés de Daisy Brocante.</span>
        </p>
    </div>

</div>
