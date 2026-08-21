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
    
    // Phases : 'login' | 'closing' | 'terminal'
    let phase = $state<"login" | "closing" | "terminal">("login");
    let progress = $state(0);
    
    interface LogEntry {
        type: "info" | "success" | "warn" | "accent";
        tag: string;
        text: string;
        time?: string;
    }
    
    let logs = $state<LogEntry[]>([]);

    const BOOT_STEPS: LogEntry[] = [
        { type: "info", tag: "BOOT_INIT", text: "Initialisation du noyau Gestionnaire.SYS (v3.2)..." },
        { type: "success", tag: "AUTH_OK", text: "Protocole Clerk validé • Session active" },
        { type: "accent", tag: "NET_API", text: "Connexion API Centrale (Railway) : CONNECTÉ [200 OK]" },
        { type: "success", tag: "STORAGE", text: "Montage du bucket AWS S3 (daisy-brocante) : PRÊT" },
        { type: "info", tag: "EBAY_SYNC", text: "Synchronisation du module eBay Marketplace... ACTIF" },
        { type: "accent", tag: "CACHE", text: "Chargement du catalogue & des tables d'inventaire... 100%" },
        { type: "success", tag: "SYS_READY", text: "Système opérationnel. Redirection vers le portail..." },
    ];

    function startTerminalSequence() {
        logs = [];
        progress = 0;
        const totalSteps = BOOT_STEPS.length;
        let step = 0;

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
                }, 350);
            }
        }, 200);
    }

    function triggerMorphToTerminal() {
        if (phase === "terminal" || phase === "closing") return;
        
        // 1. Fermeture / repli de la fenêtre
        phase = "closing";
        
        // 2. Après 260ms, réouverture en mode Terminal
        setTimeout(() => {
            phase = "terminal";
            startTerminalSequence();
        }, 280);
    }

    function redirectToPortal() {
        window.location.replace(targetUrl);
    }

    async function handleLogin(e: SubmitEvent) {
        e.preventDefault();
        errorMessage = "";
        
        if (!identifier.trim() || !password) {
            errorMessage = "Veuillez renseigner votre identifiant et mot de passe.";
            return;
        }

        isLoading = true;

        try {
            const clerk = (window as any).Clerk;
            if (!clerk) {
                throw new Error("Service d'authentification en cours d'initialisation. Réessayez dans un instant.");
            }

            if (!clerk.loaded) {
                await clerk.load();
            }

            const signInAttempt = await clerk.client.signIn.create({
                identifier: identifier.trim(),
                password: password,
            });

            if (signInAttempt.status === "complete") {
                await clerk.setActive({ session: signInAttempt.createdSessionId });
                // Lancer la fermeture puis réouverture en terminal
                triggerMorphToTerminal();
            } else {
                console.warn("Statut Clerk non complété:", signInAttempt);
                errorMessage = `Authentification incomplète : statut ${signInAttempt.status}.`;
                isLoading = false;
            }
        } catch (err: any) {
            console.error("Erreur de connexion:", err);
            isLoading = false;
            if (err.errors && err.errors.length > 0) {
                const firstErr = err.errors[0];
                if (firstErr.code === "form_identifier_not_found") {
                    errorMessage = "Identifiant ou adresse e-mail introuvable.";
                } else if (firstErr.code === "form_password_incorrect") {
                    errorMessage = "Mot de passe incorrect. Veuillez réessayer.";
                } else {
                    errorMessage = firstErr.longMessage || firstErr.message || "Erreur de connexion.";
                }
            } else {
                errorMessage = err.message || "Impossible de se connecter au serveur.";
            }
        }
    }

    onMount(() => {
        // Détection de session active Clerk (au cas où)
        const checkInterval = setInterval(() => {
            const clerk = (window as any).Clerk;
            if (clerk && clerk.loaded) {
                clearInterval(checkInterval);
                clerk.addListener((payload: any) => {
                    if (payload.session && payload.user && phase === "login") {
                        triggerMorphToTerminal();
                    }
                });
            }
        }, 100);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (phase === "terminal" && (e.key === "Escape" || e.key === "Enter" || e.key === " ")) {
                redirectToPortal();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            clearInterval(checkInterval);
            window.removeEventListener("keydown", handleKeyDown);
        };
    });
</script>

<div class="w-full flex flex-col items-center">
    
    <!-- Application Header -->
    <div class="w-full mb-6 text-center flex flex-col items-center">
        <div class="inline-flex items-center gap-3 mb-3">
            <div class="w-12 h-12 bg-[#FFD2A6] border-2 border-black flex items-center justify-center font-mono font-black text-2xl shadow-[3px_3px_0px_0px_#000]">
                G
            </div>
            <div class="text-left flex flex-col">
                <span class="font-black text-2xl tracking-tight uppercase leading-none font-mono">
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
        </div>
    </div>

    <!-- Retro Window Frame avec animation de fermeture/réouverture (morphing) -->
    <div 
        class="w-full bg-[#EDE9DF] border-3 border-black shadow-[6px_6px_0px_0px_#000] p-1 transition-all duration-300 transform origin-center {phase === 'closing' ? 'scale-y-0 opacity-40' : 'scale-y-100 opacity-100'}"
    >
        {#if phase === "login" || phase === "closing"}
            <!-- Window Titlebar Login -->
            <div class="bg-[#2B2D42] text-white px-3 py-1.5 border-b-2 border-black flex items-center justify-between font-mono text-xs font-bold mb-3">
                <div class="flex items-center gap-2">
                    <span class="text-[#99E7DC]">▶</span>
                    <span class="tracking-wider uppercase">LOGIN_PROMPT.EXE</span>
                </div>
                <div class="flex items-center gap-1.5">
                    <span class="w-3 h-3 bg-[#FFC2D1] border border-black inline-block"></span>
                    <span class="w-3 h-3 bg-[#FFF394] border border-black inline-block"></span>
                    <span class="w-3 h-3 bg-[#99E7DC] border border-black inline-block"></span>
                </div>
            </div>

            <!-- Login Form Content -->
            <div class="p-4 sm:p-6 bg-white border-2 border-black m-1 shadow-[2px_2px_0px_0px_#000]">
                
                <div class="mb-5 text-center sm:text-left">
                    <h2 class="font-mono font-black text-lg uppercase text-black tracking-tight">
                        Connexion au portail
                    </h2>
                    <p class="font-mono text-xs text-black/60 font-semibold mt-0.5">
                        Saisissez vos accès pour déverrouiller la console.
                    </p>
                </div>

                {#if errorMessage}
                    <div class="mb-4 p-3 bg-[#FFC2D1] border-2 border-black font-mono text-xs font-bold shadow-[2px_2px_0px_0px_#000] flex items-center gap-2">
                        <span>⚠️</span>
                        <span>{errorMessage}</span>
                    </div>
                {/if}

                <form onsubmit={handleLogin} class="space-y-4 font-mono">
                    <div>
                        <label for="identifier" class="block text-xs font-black uppercase text-black mb-1 tracking-wider">
                            Identifiant / E-mail
                        </label>
                        <input
                            id="identifier"
                            type="text"
                            bind:value={identifier}
                            placeholder="admin@daisybrocante.fr"
                            required
                            disabled={isLoading}
                            class="retro-input"
                        />
                    </div>

                    <div>
                        <div class="flex items-center justify-between mb-1">
                            <label for="password" class="text-xs font-black uppercase text-black tracking-wider">
                                Mot de passe
                            </label>
                            <button
                                type="button"
                                onclick={() => showPassword = !showPassword}
                                class="text-[10px] text-black/60 hover:text-black font-bold uppercase underline cursor-pointer"
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
                            class="retro-input"
                        />
                    </div>

                    <div class="pt-2">
                        <button
                            type="submit"
                            disabled={isLoading}
                            class="w-full retro-btn retro-btn-primary py-3 text-sm font-black flex items-center justify-center gap-2 cursor-pointer {isLoading ? 'opacity-70 cursor-wait' : ''}"
                        >
                            {#if isLoading}
                                <span class="inline-block w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                                <span>VÉRIFICATION DU COMPTE...</span>
                            {:else}
                                <span>⚡ SE CONNECTER AU SYSTÈME</span>
                            {/if}
                        </button>
                    </div>
                </form>

            </div>

            <!-- Window Bottom Status Bar -->
            <div class="mt-2 px-3 py-1.5 bg-white border-t-2 border-black flex items-center justify-between font-mono text-[11px] text-black/70">
                <span>CLERK_SECURITY // v3.2</span>
                <span class="font-bold text-black flex items-center gap-1">
                    <span class="w-1.5 h-1.5 bg-green-500 rounded-full inline-block"></span>
                    PRÊT POUR AUTH
                </span>
            </div>

        {:else}
            <!-- Window Titlebar Terminal (Reopen) -->
            <div class="bg-[#161B22] text-white px-3 py-1.5 border-b-2 border-black flex items-center justify-between font-mono text-xs font-bold mb-3">
                <div class="flex items-center gap-2">
                    <span class="text-[#99E7DC] animate-ping">▶</span>
                    <span class="text-[#99E7DC] tracking-wider uppercase">GESTIONNAIRE.SYS // TERMINAL_BOOT.EXE</span>
                </div>
                <div class="flex items-center gap-2">
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

            <!-- Terminal Screen -->
            <div class="p-4 sm:p-5 bg-[#0D1117] text-white border-2 border-black m-1 shadow-[2px_2px_0px_0px_#000] font-mono text-xs space-y-4">
                
                <!-- Retro ASCII Mini Banner -->
                <div class="text-[#FFD2A6] text-[9px] sm:text-[10px] leading-tight whitespace-pre opacity-90 border-b border-white/10 pb-2 overflow-x-auto">
{`  ___   _   ___ ______   __  ___ ___  ___   ___   _  _ _____ ___ 
 |   \\ /_\\ |_ _/ __\\ \\ / / | _ ) _ \\/ _ \\ / __| /_\\| \\| |_   _| __|
 | |) / _ \\ | |\\__ \\\\ V /  | _ \\   / (_) | (__ / _ \\ .\` | | | | _| 
 |___/_/ \\_\\___|___/ |_|   |___/_|_\\\\___/ \\___/_/ \\_\\_|\\_| |_| |___|`}
                </div>

                <!-- Logs stream -->
                <div class="space-y-1.5 max-h-48 overflow-y-auto py-1">
                    {#each logs as log}
                        <div class="flex items-start gap-2 leading-relaxed animate-in fade-in slide-in-from-left-1 duration-100">
                            <span class="text-white/40 text-[10px] select-none">[{log.time}]</span>
                            {#if log.type === 'success'}
                                <span class="bg-[#99E7DC] text-black px-1 font-bold text-[10px] uppercase shadow-[1px_1px_0px_0px_#000]">
                                    {log.tag}
                                </span>
                                <span class="text-[#99E7DC] font-bold">{log.text}</span>
                            {:else if log.type === 'accent'}
                                <span class="bg-[#FFD2A6] text-black px-1 font-bold text-[10px] uppercase shadow-[1px_1px_0px_0px_#000]">
                                    {log.tag}
                                </span>
                                <span class="text-[#FFD2A6] font-semibold">{log.text}</span>
                            {:else if log.type === 'warn'}
                                <span class="bg-[#FFF394] text-black px-1 font-bold text-[10px] uppercase shadow-[1px_1px_0px_0px_#000]">
                                    {log.tag}
                                </span>
                                <span class="text-[#FFF394]">{log.text}</span>
                            {:else}
                                <span class="bg-[#D4E2FD] text-black px-1 font-bold text-[10px] uppercase shadow-[1px_1px_0px_0px_#000]">
                                    {log.tag}
                                </span>
                                <span class="text-white/90">{log.text}</span>
                            {/if}
                        </div>
                    {/each}
                    <div class="flex items-center gap-1 text-[#99E7DC] font-bold pt-1">
                        <span>&gt;</span>
                        <span class="inline-block w-2 h-3 bg-[#99E7DC] animate-pulse"></span>
                    </div>
                </div>

                <!-- Progress Bar -->
                <div class="pt-2 border-t border-white/10 space-y-1.5">
                    <div class="flex items-center justify-between text-[11px] font-bold">
                        <span class="text-white/80">CHARGEMENT DU PORTAIL :</span>
                        <span class="text-[#99E7DC]">{progress}%</span>
                    </div>
                    <div class="w-full h-3.5 bg-black border border-white/20 p-0.5 relative">
                        <div 
                            class="h-full bg-[#99E7DC] transition-all duration-150"
                            style="width: {progress}%;"
                        ></div>
                    </div>
                </div>

            </div>

            <!-- Terminal Bottom Bar -->
            <div class="mt-2 px-3 py-1.5 bg-white border-t-2 border-black flex items-center justify-between font-mono text-[11px] text-black/70">
                <span class="text-[10px] text-black/60">SESSION ACTIVE // REDIRECTION AUTOMATIQUE</span>
                <button 
                    type="button"
                    onclick={redirectToPortal}
                    class="retro-btn btn-xs bg-[#FFC2D1] hover:bg-white text-black text-[10px] font-bold px-2 py-0.5 border border-black shadow-[1px_1px_0px_0px_#000]"
                >
                    PASSER »
                </button>
            </div>
        {/if}
    </div>

    <!-- Security notice -->
    <div class="mt-6 text-center font-mono text-xs text-black/60 max-w-sm">
        <p>🔒 Accès strictement réservé aux gestionnaires autorisés de Daisy Brocante.</p>
    </div>

</div>

