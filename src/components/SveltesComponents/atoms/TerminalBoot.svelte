<script lang="ts">
    import { onMount } from "svelte";

    interface Props {
        initialActive?: boolean;
    }

    let { initialActive = false }: Props = $props();

    interface LogEntry {
        type: "info" | "success" | "warn" | "accent";
        tag: string;
        text: string;
        time?: string;
    }

    let isVisible = $state(initialActive);
    let isExiting = $state(false);
    let progress = $state(0);
    let logs = $state<LogEntry[]>([]);
    let currentStep = $state(0);

    const BOOT_STEPS: LogEntry[] = [
        { type: "info", tag: "BOOT_INIT", text: "Initialisation du noyau Gestionnaire.SYS (v3.2)..." },
        { type: "success", tag: "AUTH_OK", text: "Protocole Clerk validé • Session active" },
        { type: "accent", tag: "NET_API", text: "Connexion API Centrale (Railway) : CONNECTÉ [200 OK]" },
        { type: "success", tag: "STORAGE", text: "Montage du bucket AWS S3 (daisy-brocante) : PRÊT" },
        { type: "info", tag: "EBAY_SYNC", text: "Synchronisation du module eBay Marketplace... ACTIF" },
        { type: "accent", tag: "CACHE", text: "Chargement du catalogue & des tables d'inventaire... 100%" },
        { type: "success", tag: "SYS_READY", text: "Système opérationnel. Bienvenue sur le Portail !" },
    ];

    function finishBoot() {
        if (isExiting) return;
        isExiting = true;

        // Nettoyage de l'URL pour enlever le paramètre ?boot=1
        try {
            if (window.location.search.includes("boot")) {
                window.history.replaceState({}, "", window.location.pathname);
            }
        } catch (_) {}

        setTimeout(() => {
            isVisible = false;
            isExiting = false;
        }, 400);
    }

    function startSequence() {
        isVisible = true;
        isExiting = false;
        logs = [];
        progress = 0;
        currentStep = 0;

        const totalSteps = BOOT_STEPS.length;
        let step = 0;

        const interval = setInterval(() => {
            if (step < totalSteps) {
                const item = BOOT_STEPS[step];
                const now = new Date();
                const timeStr = now.toTimeString().split(" ")[0] + "." + Math.floor(now.getMilliseconds() / 100);
                logs = [...logs, { ...item, time: timeStr }];
                step++;
                currentStep = step;
                progress = Math.min(100, Math.round((step / totalSteps) * 100));
            } else {
                clearInterval(interval);
                progress = 100;
                setTimeout(() => {
                    finishBoot();
                }, 350);
            }
        }, 180);
    }

    onMount(() => {
        // Exposer la méthode globale pour rejouer l'animation
        (window as any).replayBoot = () => {
            startSequence();
        };

        // Lancer la séquence si initialActive est true ou si ?boot= dans l'URL
        const hasBootParam = window.location.search.includes("boot");
        if (initialActive || hasBootParam) {
            startSequence();
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (isVisible && (e.key === "Escape" || e.key === "Enter" || e.key === " ")) {
                finishBoot();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    });
</script>

{#if isVisible}
    <div 
        role="dialog"
        aria-modal="true"
        class="fixed inset-0 z-[99999] bg-[#0D1117] flex flex-col items-center justify-center p-3 sm:p-6 select-none transition-all duration-400 {isExiting ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'}"
    >
        <!-- Background CRT Scanline Effect -->
        <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.35)_50%)] bg-[length:100%_4px] opacity-60"></div>

        <!-- Terminal Window Card -->
        <div class="relative w-full max-w-2xl bg-[#161B22] border-3 border-black shadow-[8px_8px_0px_0px_#99E7DC] font-mono text-xs flex flex-col overflow-hidden">
            
            <!-- Retro Titlebar -->
            <div class="bg-[#2B2D42] border-b-2 border-black px-4 py-2 flex items-center justify-between text-white font-bold">
                <div class="flex items-center gap-2.5">
                    <span class="inline-block w-2.5 h-2.5 bg-[#99E7DC] animate-ping"></span>
                    <span class="text-[#99E7DC] tracking-wider uppercase">DAISY_BROCANTE // BOOT_LOADER.SYS</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-[10px] text-white/50 hidden sm:inline">[ESC pour passer]</span>
                    <button 
                        type="button"
                        onclick={finishBoot}
                        class="w-4 h-4 bg-[#FFC2D1] border border-black hover:bg-white text-black text-[9px] flex items-center justify-center font-black cursor-pointer shadow-[1px_1px_0px_0px_#000]"
                        title="Passer"
                    >
                        ✕
                    </button>
                </div>
            </div>

            <!-- Terminal Body -->
            <div class="p-4 sm:p-6 bg-[#0D1117] text-white min-h-[300px] flex flex-col justify-between space-y-4">
                
                <!-- Retro ASCII Art Mini Banner -->
                <div class="text-[#FFD2A6] text-[10px] sm:text-xs leading-none font-mono whitespace-pre opacity-90 overflow-x-auto pb-1 border-b border-white/10">
{`  ___   _   ___ ______   __  ___ ___  ___   ___   _  _ _____ ___ 
 |   \\ /_\\ |_ _/ __\\ \\ / / | _ ) _ \\/ _ \\ / __| /_\\| \\| |_   _| __|
 | |) / _ \\ | |\\__ \\\\ V /  | _ \\   / (_) | (__ / _ \\ .\` | | | | _| 
 |___/_/ \\_\\___|___/ |_|   |___/_|_\\\\___/ \\___/_/ \\_\\_|\\_| |_| |___|
                     GESTIONNAIRE.SYS — OS BOOT`}
                </div>

                <!-- Logs Stream -->
                <div class="space-y-1.5 flex-grow overflow-y-auto max-h-48 py-1">
                    {#each logs as log}
                        <div class="flex items-start gap-2 leading-relaxed animate-in fade-in slide-in-from-left-2 duration-150">
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
                        <span class="inline-block w-2 h-3.5 bg-[#99E7DC] animate-pulse"></span>
                    </div>
                </div>

                <!-- Progress Section -->
                <div class="pt-3 border-t border-white/10 space-y-2">
                    <div class="flex items-center justify-between text-[11px] font-bold">
                        <span class="text-white/80">CHARGEMENT DU PORTAIL :</span>
                        <span class="text-[#99E7DC] font-mono">{progress}%</span>
                    </div>
                    <!-- Neo-brutalist custom progress bar -->
                    <div class="w-full h-4 bg-black border-2 border-white/20 p-0.5 relative">
                        <div 
                            class="h-full bg-[#99E7DC] transition-all duration-150"
                            style="width: {progress}%;"
                        ></div>
                    </div>
                </div>

            </div>

            <!-- Terminal Footer Controls -->
            <div class="bg-[#161B22] border-t-2 border-black px-4 py-2.5 flex items-center justify-between">
                <div class="flex items-center gap-2 text-[10px] text-white/60">
                    <span class="w-2 h-2 rounded-full bg-[#99E7DC] inline-block animate-pulse"></span>
                    <span>FLUX SÉCURISÉ SSL // RAILWAY-API</span>
                </div>
                <button 
                    type="button"
                    onclick={finishBoot}
                    class="retro-btn btn-xs bg-[#FFC2D1] hover:bg-white text-black text-[10px] font-bold px-3 py-1 border border-black shadow-[2px_2px_0px_0px_#000]"
                    <span>ACCÉDER DIRECTEMENT</span>
                    <span class="material-symbols-outlined text-[12px]">arrow_forward</span>
                </button>
            </div>

        </div>
    </div>
{/if}
