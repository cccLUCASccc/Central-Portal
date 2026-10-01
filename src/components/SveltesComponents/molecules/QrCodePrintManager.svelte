<script lang="ts">
    import { onMount } from "svelte";
    import QRCode from "qrcode";

    interface Props {
        initialSvg?: string;
    }

    let { initialSvg = "" }: Props = $props();

    // Configuration réactive
    let targetUrl = $state("https://daisybrocante.com");
    let templateMode = $state<"a4_poster" | "a5_stand" | "cards_grid" | "stickers_grid">("a4_poster");
    let styleTheme = $state<"neo_brutalist" | "minimal_chic">("neo_brutalist");
    let siteTitle = $state("DaisyBrocante");
    let siteSubtitle = $state("Antiquités . Mode . Déco");
    let tagline = $state("Plateforme de vente en ligne");
    let callToAction = $state("Scannez avec votre smartphone pour explorer notre boutique en ligne");
    let showDeliveryNote = $state(true);
    let showCenterLogo = $state(true);
    let errorLevel = $state<"L" | "M" | "Q" | "H">("H");

    // État interne QR Code
    let qrSvg = $state(initialSvg);
    let isGenerating = $state(false);
    let copyNotification = $state(false);

    // Génération dynamique du QR Code
    async function generateQrCode() {
        if (!targetUrl.trim()) return;
        isGenerating = true;
        try {
            const svg = await QRCode.toString(targetUrl.trim(), {
                type: "svg",
                margin: 1,
                errorCorrectionLevel: errorLevel,
                color: {
                    dark: "#000000",
                    light: "#ffffff",
                },
            });
            qrSvg = svg;
        } catch (err) {
            console.error("Erreur de génération QR Code :", err);
        } finally {
            isGenerating = false;
        }
    }

    // Régénérer dès qu'un paramètre clé change
    $effect(() => {
        // Dépendances réactives
        const _url = targetUrl;
        const _lvl = errorLevel;
        generateQrCode();
    });

    onMount(() => {
        if (!qrSvg) {
            generateQrCode();
        }
    });

    // Action d'impression
    function triggerPrint() {
        window.print();
    }

    // Téléchargement SVG
    async function downloadSvg() {
        try {
            const svgContent = await QRCode.toString(targetUrl.trim(), {
                type: "svg",
                margin: 2,
                errorCorrectionLevel: errorLevel,
            });
            const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.download = `daisybrocante-qrcode.svg`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error("Erreur téléchargement SVG :", e);
        }
    }

    // Téléchargement PNG Haute Résolution (2000px)
    async function downloadPng() {
        try {
            const dataUrl = await QRCode.toDataURL(targetUrl.trim(), {
                width: 2048,
                margin: 2,
                errorCorrectionLevel: errorLevel,
            });
            const link = document.createElement("a");
            link.download = `daisybrocante-qrcode-hd.png`;
            link.href = dataUrl;
            link.click();
        } catch (e) {
            console.error("Erreur téléchargement PNG :", e);
        }
    }

    // Copier le SVG dans le presse-papier
    async function copySvgToClipboard() {
        try {
            const svgContent = await QRCode.toString(targetUrl.trim(), {
                type: "svg",
                margin: 1,
                errorCorrectionLevel: errorLevel,
            });
            await navigator.clipboard.writeText(svgContent);
            copyNotification = true;
            setTimeout(() => {
                copyNotification = false;
            }, 3000);
        } catch (e) {
            console.error("Erreur copie SVG :", e);
        }
    }
</script>

<div class="space-y-6 font-mono">
    <!-- Toast de copie -->
    {#if copyNotification}
        <div class="fixed top-6 right-6 z-50 animate-bounce no-print">
            <div class="px-4 py-3 border-2 border-black font-bold text-xs bg-[#86E2D5] text-black shadow-[4px_4px_0px_0px_#000] flex items-center gap-2">
                <span class="material-symbols-outlined text-[18px]">check_circle</span>
                <span>Code SVG copié dans le presse-papier !</span>
            </div>
        </div>
    {/if}

    <!-- En-tête Rétro (Masqué à l'impression) -->
    <div class="no-print retro-card-yellow p-6 border-3 border-black shadow-[6px_6px_0px_0px_#000]">
        <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div class="space-y-1">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="retro-badge bg-black text-white text-[11px] px-2 py-0.5">MARKETING // SUPPORTS PHYSIQUES</span>
                    <span class="retro-badge bg-[#86E2D5] text-black text-[11px] font-black">DAISY BROCANTE</span>
                    <span class="retro-badge bg-white text-black text-[11px]">FORMATS A4 / A5 / CARTES</span>
                </div>
                <h1 class="text-2xl sm:text-3xl font-black uppercase tracking-tight text-black flex items-center gap-2.5">
                    <span class="material-symbols-outlined text-3xl">qr_code_2</span>
                    QR Code & Gabarits Imprimables
                </h1>
                <p class="text-xs text-black/80 font-medium max-w-2xl leading-relaxed">
                    Générez, prévisualisez et imprimez des supports officiels DaisyBrocante haute définition : affichette vitrine A4, chevalet de comptoir A5, planches de cartes colis à découper ou stickers.
                </p>
            </div>

            <!-- Actions Rapides -->
            <div class="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                <a
                    href={targetUrl}
                    target="_blank"
                    rel="noreferrer"
                    class="retro-btn bg-white hover:bg-[#BFD7FE] text-xs font-black py-2.5 px-3 shadow-[3px_3px_0px_0px_#000] flex items-center gap-1.5"
                    title="Tester le lien dans un nouvel onglet"
                >
                    <span class="material-symbols-outlined text-[16px]">open_in_new</span>
                    <span>Tester le lien</span>
                </a>

                <button
                    onclick={triggerPrint}
                    class="retro-btn bg-[#86E2D5] hover:bg-[#65C4B5] text-xs font-black py-2.5 px-5 shadow-[4px_4px_0px_0px_#000] flex items-center gap-2 cursor-pointer transition-transform active:scale-95"
                    title="Imprimer directement ou exporter en PDF via le navigateur"
                >
                    <span class="material-symbols-outlined text-[18px]">print</span>
                    <span>IMPRIMER MAINTENANT</span>
                </button>
            </div>
        </div>
    </div>

    <!-- Layout 2 Colonnes : Paramètres & Aperçu Réel -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        <!-- ============================================================== -->
        <!-- COLONNE GAUCHE : CONTRÔLES & OPTIONS (MASQUÉE À L'IMPRESSION)   -->
        <!-- ============================================================== -->
        <div class="no-print lg:col-span-4 space-y-5">
            
            <!-- Choix du Gabarit -->
            <div class="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_#000] space-y-3">
                <div class="flex items-center justify-between border-b-2 border-black/10 pb-2">
                    <span class="font-black text-xs uppercase flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-[16px]">aspect_ratio</span>
                        1. Choix du Support Papier
                    </span>
                    <span class="text-[10px] bg-black text-white px-1.5 py-0.5 font-mono">GABARIT</span>
                </div>

                <div class="grid grid-cols-1 gap-2">
                    <button
                        type="button"
                        onclick={() => (templateMode = "a4_poster")}
                        class="p-2.5 border-2 text-left transition-all cursor-pointer flex items-center justify-between {templateMode === 'a4_poster' ? 'bg-[#FFD2A6] border-black shadow-[2px_2px_0px_0px_#000] font-black' : 'bg-[#FAF9F5] border-black/20 hover:border-black text-black/80'}"
                    >
                        <div class="flex items-center gap-2.5">
                            <span class="material-symbols-outlined text-[20px]">newspaper</span>
                            <div>
                                <div class="text-xs font-black uppercase">Affichette A4 / Vitrine</div>
                                <div class="text-[10px] text-black/60 font-sans">Grand format portrait avec QR géant</div>
                            </div>
                        </div>
                        {#if templateMode === "a4_poster"}
                            <span class="material-symbols-outlined text-[18px] text-black">check_circle</span>
                        {/if}
                    </button>

                    <button
                        type="button"
                        onclick={() => (templateMode = "a5_stand")}
                        class="p-2.5 border-2 text-left transition-all cursor-pointer flex items-center justify-between {templateMode === 'a5_stand' ? 'bg-[#86E2D5] border-black shadow-[2px_2px_0px_0px_#000] font-black' : 'bg-[#FAF9F5] border-black/20 hover:border-black text-black/80'}"
                    >
                        <div class="flex items-center gap-2.5">
                            <span class="material-symbols-outlined text-[20px]">storefront</span>
                            <div>
                                <div class="text-xs font-black uppercase">Chevalet de Comptoir A5</div>
                                <div class="text-[10px] text-black/60 font-sans">Format posoir caisse ou table salon</div>
                            </div>
                        </div>
                        {#if templateMode === "a5_stand"}
                            <span class="material-symbols-outlined text-[18px] text-black">check_circle</span>
                        {/if}
                    </button>

                    <button
                        type="button"
                        onclick={() => (templateMode = "cards_grid")}
                        class="p-2.5 border-2 text-left transition-all cursor-pointer flex items-center justify-between {templateMode === 'cards_grid' ? 'bg-[#BFD7FE] border-black shadow-[2px_2px_0px_0px_#000] font-black' : 'bg-[#FAF9F5] border-black/20 hover:border-black text-black/80'}"
                    >
                        <div class="flex items-center gap-2.5">
                            <span class="material-symbols-outlined text-[20px]">grid_view</span>
                            <div>
                                <div class="text-xs font-black uppercase">Planche 8 Cartes Colis</div>
                                <div class="text-[10px] text-black/60 font-sans">Flyers découpables à glisser dans les envois</div>
                            </div>
                        </div>
                        {#if templateMode === "cards_grid"}
                            <span class="material-symbols-outlined text-[18px] text-black">check_circle</span>
                        {/if}
                    </button>

                    <button
                        type="button"
                        onclick={() => (templateMode = "stickers_grid")}
                        class="p-2.5 border-2 text-left transition-all cursor-pointer flex items-center justify-between {templateMode === 'stickers_grid' ? 'bg-[#FFAEC1] border-black shadow-[2px_2px_0px_0px_#000] font-black' : 'bg-[#FAF9F5] border-black/20 hover:border-black text-black/80'}"
                    >
                        <div class="flex items-center gap-2.5">
                            <span class="material-symbols-outlined text-[20px]">loyalty</span>
                            <div>
                                <div class="text-xs font-black uppercase">Planche 15 Mini-Stickers</div>
                                <div class="text-[10px] text-black/60 font-sans">Étiquettes carrées pour meubles & objets</div>
                            </div>
                        </div>
                        {#if templateMode === "stickers_grid"}
                            <span class="material-symbols-outlined text-[18px] text-black">check_circle</span>
                        {/if}
                    </button>
                </div>
            </div>

            <!-- Personnalisation des Textes & URL -->
            <div class="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_#000] space-y-3">
                <div class="flex items-center justify-between border-b-2 border-black/10 pb-2">
                    <span class="font-black text-xs uppercase flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-[16px]">edit_note</span>
                        2. Textes & Destination
                    </span>
                    <span class="text-[10px] bg-[#EDE9DF] border border-black px-1.5 font-bold">INFO</span>
                </div>

                <!-- URL Cible -->
                <div class="space-y-1">
                    <label class="text-[10px] font-black uppercase text-black/70 flex items-center justify-between">
                        <span>URL de Redirection</span>
                        <span class="text-green-700 font-bold">● VÉRIFIÉ</span>
                    </label>
                    <input
                        type="text"
                        bind:value={targetUrl}
                        class="retro-input text-xs"
                        placeholder="https://daisybrocante.com"
                    />
                    <div class="text-[9px] text-black/50">Lien web officiel encodé dans le QR Code.</div>
                </div>

                <!-- Titre -->
                <div class="space-y-1">
                    <label class="text-[10px] font-black uppercase text-black/70">Nom de la Plateforme</label>
                    <input
                        type="text"
                        bind:value={siteTitle}
                        class="retro-input text-xs font-black"
                    />
                </div>

                <!-- Sous-titre -->
                <div class="space-y-1">
                    <label class="text-[10px] font-black uppercase text-black/70">Catégories Principales</label>
                    <input
                        type="text"
                        bind:value={siteSubtitle}
                        class="retro-input text-xs"
                    />
                </div>

                <!-- Accroche / CTA -->
                <div class="space-y-1">
                    <label class="text-[10px] font-black uppercase text-black/70">Phrase d'Invitation</label>
                    <textarea
                        bind:value={callToAction}
                        rows="2"
                        class="retro-input text-xs font-sans leading-tight resize-none"
                    ></textarea>
                </div>

                <!-- Options Bascule -->
                <div class="space-y-2 pt-2 border-t border-black/10">
                    <label class="flex items-center justify-between text-xs cursor-pointer p-1.5 hover:bg-[#F6F4EE]">
                        <span class="font-bold flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-[16px]">local_shipping</span>
                            Mention Pays de Livraison
                        </span>
                        <input type="checkbox" bind:checked={showDeliveryNote} class="checkbox checkbox-sm rounded-none border-2 border-black checked:bg-black" />
                    </label>

                    <label class="flex items-center justify-between text-xs cursor-pointer p-1.5 hover:bg-[#F6F4EE]">
                        <span class="font-bold flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-[16px]">palette</span>
                            Style Néo-Brutaliste Rétro
                        </span>
                        <input
                            type="checkbox"
                            checked={styleTheme === "neo_brutalist"}
                            onchange={(e) => (styleTheme = e.currentTarget.checked ? "neo_brutalist" : "minimal_chic")}
                            class="checkbox checkbox-sm rounded-none border-2 border-black checked:bg-black"
                        />
                    </label>

                    <label class="flex items-center justify-between text-xs cursor-pointer p-1.5 hover:bg-[#F6F4EE]">
                        <span class="font-bold flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-[16px]">spa</span>
                            Pastille Centrale sur le QR
                        </span>
                        <input type="checkbox" bind:checked={showCenterLogo} class="checkbox checkbox-sm rounded-none border-2 border-black checked:bg-black" />
                    </label>
                </div>
            </div>

            <!-- Exports Numériques & Fichiers -->
            <div class="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_#000] space-y-3">
                <div class="flex items-center justify-between border-b-2 border-black/10 pb-2">
                    <span class="font-black text-xs uppercase flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-[16px]">download</span>
                        3. Téléchargements Directs
                    </span>
                    <span class="text-[10px] bg-[#86E2D5] border border-black px-1.5 font-bold">HD</span>
                </div>

                <div class="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onclick={downloadSvg}
                        class="retro-btn bg-[#FAF9F5] hover:bg-[#FFD2A6] text-[11px] py-2 px-2 flex items-center gap-1 font-bold"
                        title="Fichier vectoriel parfait pour imprimeur ou flocage"
                    >
                        <span class="material-symbols-outlined text-[15px]">vector_polygon</span>
                        <span>Fichier SVG</span>
                    </button>

                    <button
                        type="button"
                        onclick={downloadPng}
                        class="retro-btn bg-[#FAF9F5] hover:bg-[#86E2D5] text-[11px] py-2 px-2 flex items-center gap-1 font-bold"
                        title="Image bitmap HD 2000px pour insertion dans Word/Canva"
                    >
                        <span class="material-symbols-outlined text-[15px]">image</span>
                        <span>Image PNG HD</span>
                    </button>
                </div>

                <button
                    type="button"
                    onclick={copySvgToClipboard}
                    class="retro-btn bg-white hover:bg-[#FFF394] text-xs w-full py-2 flex items-center justify-center gap-1.5"
                >
                    <span class="material-symbols-outlined text-[16px]">content_copy</span>
                    <span>Copier le SVG du QR Code</span>
                </button>
            </div>

            <!-- Astuce d'impression -->
            <div class="p-3 bg-[#EDE9DF] border-2 border-black shadow-[3px_3px_0px_0px_#000] text-[11px] space-y-1 leading-relaxed">
                <div class="font-black text-black flex items-center gap-1">
                    <span class="material-symbols-outlined text-[16px] text-amber-700">lightbulb</span>
                    <span>Conseil pour l'impression papier :</span>
                </div>
                <p class="text-black/75">
                    Dans le volet d'impression de votre navigateur, cochez <strong>« Graphiques d'arrière-plan »</strong> et décochez <strong>« En-têtes et pieds de page »</strong> pour une feuille immaculée.
                </p>
            </div>

        </div>

        <!-- ============================================================== -->
        <!-- COLONNE DROITE : APERÇU PAPIER & ZONE D'IMPRESSION             -->
        <!-- ============================================================== -->
        <div class="lg:col-span-8 flex flex-col items-center">
            
            <!-- Barre d'état d'aperçu (Masquée à l'impression) -->
            <div class="no-print w-full flex items-center justify-between pb-3 text-xs font-mono text-black/70">
                <div class="flex items-center gap-2">
                    <span class="w-2 h-2 bg-green-500 rounded-full inline-block animate-ping"></span>
                    <span class="font-bold">Aperçu direct du document imprimable :</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="retro-badge bg-white text-[10px]">ECHELLE : 100%</span>
                    <button
                        onclick={triggerPrint}
                        class="retro-btn bg-[#86E2D5] text-[11px] py-1 px-3 flex items-center gap-1 font-black cursor-pointer shadow-[2px_2px_0px_0px_#000]"
                    >
                        <span class="material-symbols-outlined text-[15px]">print</span>
                        <span>Lancer l'impression</span>
                    </button>
                </div>
            </div>

            <!-- Conteneur d'affichage de la feuille (Fond gris clair d'écran) -->
            <div class="w-full bg-[#3D405B] p-4 sm:p-8 flex justify-center border-3 border-black shadow-[8px_8px_0px_0px_#000] overflow-x-auto print:bg-white print:p-0 print:border-none print:shadow-none">
                
                <!-- ========================================================== -->
                <!-- ZONE IMPRIMABLE OFFICIELLE (.printable-document)          -->
                <!-- ========================================================== -->
                <div class="printable-document bg-white text-black w-full max-w-[210mm] min-h-[285mm] mx-auto p-6 sm:p-10 flex flex-col justify-between select-text shadow-2xl print:shadow-none print:m-0 print:p-4 print:min-h-0 print:border-none">
                    
                    <!-- ====================================================== -->
                    <!-- GABARIT 1 : AFFICHETTE VITRINE / CHEVALET A4           -->
                    <!-- ====================================================== -->
                    {#if templateMode === "a4_poster"}
                        <div class="w-full h-full flex flex-col justify-between border-4 border-black p-6 sm:p-8 relative {styleTheme === 'neo_brutalist' ? 'bg-[#FAF9F5]' : 'bg-white'}">
                            
                            <!-- Coins Néo-Brutalistes Rétro -->
                            {#if styleTheme === "neo_brutalist"}
                                <div class="absolute -top-2.5 -left-2.5 w-5 h-5 bg-black border border-white"></div>
                                <div class="absolute -top-2.5 -right-2.5 w-5 h-5 bg-black border border-white"></div>
                                <div class="absolute -bottom-2.5 -left-2.5 w-5 h-5 bg-black border border-white"></div>
                                <div class="absolute -bottom-2.5 -right-2.5 w-5 h-5 bg-black border border-white"></div>
                            {/if}

                            <!-- Header de l'affichette -->
                            <div class="text-center space-y-4">
                                <!-- Badge Officiel -->
                                <div class="inline-flex items-center gap-2 px-3 py-1 bg-[#FFAEC1] border-2 border-black font-mono font-black text-xs uppercase tracking-widest shadow-[2px_2px_0px_0px_#000]">
                                    <span class="material-symbols-outlined text-[16px]">spa</span>
                                    <span>PLATEFORME DE VENTE EN LIGNE</span>
                                </div>

                                <!-- Logo Image & Titre Principal -->
                                <div class="space-y-1 pt-1">
                                    <img
                                        src="/daisy-logo.png"
                                        alt="DaisyBrocante"
                                        class="h-20 sm:h-24 w-auto mx-auto object-contain"
                                        onerror={(e) => ((e.currentTarget as HTMLElement).style.display = 'none')}
                                    />
                                    <h1 class="text-4xl sm:text-5xl font-black uppercase tracking-tight text-black font-mono">
                                        {siteTitle}
                                    </h1>
                                    <p class="text-base sm:text-lg font-black tracking-wide uppercase text-black/80 font-mono">
                                        {siteSubtitle}
                                    </p>
                                </div>

                                <div class="w-32 h-1 bg-black mx-auto"></div>
                            </div>

                            <!-- Bloc Central : QR Code Géant & Call to Action -->
                            <div class="my-6 flex flex-col items-center justify-center text-center space-y-5">
                                
                                <!-- Cartouche CTA -->
                                <div class="px-5 py-2 bg-[#86E2D5] border-2 border-black shadow-[3px_3px_0px_0px_#000] font-mono font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2">
                                    <span class="material-symbols-outlined text-[18px]">photo_camera</span>
                                    <span>{callToAction}</span>
                                </div>

                                <!-- Boîtier du QR Code avec Pastille Centrale optionnelle -->
                                <div class="p-4 bg-white border-4 border-black shadow-[8px_8px_0px_0px_#000] relative inline-block">
                                    <div class="w-56 h-56 sm:w-72 sm:h-72 flex items-center justify-center relative">
                                        {#if qrSvg}
                                            <div class="w-full h-full [&>svg]:w-full [&>svg]:h-full">
                                                {@html qrSvg}
                                            </div>
                                        {:else}
                                            <div class="text-xs text-black/50 animate-pulse font-mono">Génération du code...</div>
                                        {/if}

                                        <!-- Pastille Centrale (Daisy) -->
                                        {#if showCenterLogo && qrSvg}
                                            <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <div class="w-12 h-12 bg-white border-2 border-black rounded-none shadow-[2px_2px_0px_0px_#000] flex items-center justify-center">
                                                    <span class="material-symbols-outlined text-2xl text-black">spa</span>
                                                </div>
                                            </div>
                                        {/if}
                                    </div>
                                </div>

                                <!-- URL en clair -->
                                <div class="space-y-1">
                                    <div class="text-xl sm:text-2xl font-black font-mono uppercase tracking-widest text-black underline decoration-2 decoration-[#FFAEC1] underline-offset-4">
                                        daisybrocante.com
                                    </div>
                                    <p class="text-xs text-black/60 font-sans">
                                        Accès direct depuis votre navigateur ou votre appareil photo
                                    </p>
                                </div>

                            </div>

                            <!-- Footer de l'affichette : Réassurance Livraison & Engagement -->
                            <div class="border-t-2 border-black pt-4 space-y-3 text-center">
                                {#if showDeliveryNote}
                                    <div class="bg-[#FFF394] border-2 border-black p-2.5 shadow-[2px_2px_0px_0px_#000] inline-block max-w-lg mx-auto">
                                        <div class="text-[11px] font-black uppercase font-mono text-black flex items-center justify-center gap-1.5">
                                            <span class="material-symbols-outlined text-[15px]">local_shipping</span>
                                            <span>Expédition sécurisée et suivie :</span>
                                        </div>
                                        <div class="text-[10px] font-bold text-black/80 font-mono mt-0.5">
                                            Belgique • France • Luxembourg • Pays-Bas • Allemagne
                                        </div>
                                    </div>
                                {/if}

                                <div class="flex items-center justify-between text-[10px] font-mono text-black/60 px-2 pt-1 border-t border-black/10">
                                    <span>DAISYBROCANTE // VENTE EN LIGNE</span>
                                    <span>AUTHENTICITÉ & PIÈCES UNIQUES</span>
                                </div>
                            </div>

                        </div>
                    {/if}

                    <!-- ====================================================== -->
                    <!-- GABARIT 2 : CHEVALET DE COMPTOIR A5                    -->
                    <!-- ====================================================== -->
                    {#if templateMode === "a5_stand"}
                        <div class="w-full flex-grow flex flex-col justify-between border-3 border-black p-6 bg-[#FAF9F5] text-center space-y-5">
                            <div class="space-y-2">
                                <div class="inline-flex items-center gap-1.5 px-3 py-0.5 bg-[#86E2D5] border-2 border-black font-mono font-black text-[11px] uppercase shadow-[2px_2px_0px_0px_#000]">
                                    <span class="material-symbols-outlined text-[14px]">spa</span>
                                    <span>BOUTIQUE EN LIGNE</span>
                                </div>
                                <h2 class="text-3xl font-black uppercase font-mono tracking-tight text-black">
                                    {siteTitle}
                                </h2>
                                <p class="text-xs font-black uppercase font-mono text-black/70">
                                    {siteSubtitle}
                                </p>
                            </div>

                            <div class="flex flex-col items-center justify-center space-y-3">
                                <div class="p-3 bg-white border-3 border-black shadow-[5px_5px_0px_0px_#000] relative inline-block">
                                    <div class="w-48 h-48 flex items-center justify-center relative">
                                        {#if qrSvg}
                                            <div class="w-full h-full [&>svg]:w-full [&>svg]:h-full">
                                                {@html qrSvg}
                                            </div>
                                        {/if}
                                        {#if showCenterLogo && qrSvg}
                                            <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <div class="w-9 h-9 bg-white border-2 border-black flex items-center justify-center">
                                                    <span class="material-symbols-outlined text-lg text-black">spa</span>
                                                </div>
                                            </div>
                                        {/if}
                                    </div>
                                </div>

                                <div class="bg-black text-white px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider">
                                    Scannez avec votre appareil photo
                                </div>
                                <div class="text-base font-black font-mono text-black">
                                    daisybrocante.com
                                </div>
                            </div>

                            <div class="border-t-2 border-black pt-3 text-[10px] font-mono text-black/70">
                                Livraison sécurisée : Belgique • France • Luxembourg • Pays-Bas • Allemagne
                            </div>
                        </div>
                    {/if}

                    <!-- ====================================================== -->
                    <!-- GABARIT 3 : PLANCHE DE 8 CARTES COLIS (A4 DÉCOUPE)     -->
                    <!-- ====================================================== -->
                    {#if templateMode === "cards_grid"}
                        <div class="w-full flex-grow flex flex-col justify-between">
                            <div class="no-print pb-2 text-[10px] font-mono text-black/50 text-center uppercase">
                                ✂ Lignes en pointillés pour le massicotage / découpe de 8 cartes de visite & colis
                            </div>

                            <div class="grid grid-cols-2 gap-3 flex-grow">
                                {#each Array(8) as _, i}
                                    <div class="border-2 border-dashed border-black/60 p-4 bg-white flex flex-col justify-between relative hover:border-black transition-colors">
                                        
                                        <!-- Repère de découpe -->
                                        <div class="absolute top-1 right-1 text-[8px] text-black/40 font-mono">#{i + 1}</div>

                                        <div class="flex items-center gap-2 border-b border-black/10 pb-1.5">
                                            <div class="w-6 h-6 bg-[#FFD2A6] border border-black flex items-center justify-center">
                                                <span class="material-symbols-outlined text-sm">spa</span>
                                            </div>
                                            <div>
                                                <div class="font-black font-mono text-xs uppercase leading-none">{siteTitle}</div>
                                                <div class="text-[8px] font-bold text-black/60 uppercase font-mono">{siteSubtitle}</div>
                                            </div>
                                        </div>

                                        <div class="flex items-center gap-3 my-2">
                                            <div class="w-20 h-20 border-2 border-black flex-shrink-0 bg-white p-0.5">
                                                {#if qrSvg}
                                                    <div class="w-full h-full [&>svg]:w-full [&>svg]:h-full">
                                                        {@html qrSvg}
                                                    </div>
                                                {/if}
                                            </div>
                                            <div class="space-y-1 text-left">
                                                <div class="text-[9px] font-black uppercase text-black font-mono leading-tight">
                                                    Merci pour votre commande !
                                                </div>
                                                <div class="text-[8px] text-black/70 font-sans leading-tight">
                                                    Découvrez nos nouveautés chaque semaine.
                                                </div>
                                                <div class="text-[9px] font-black text-black font-mono underline">
                                                    daisybrocante.com
                                                </div>
                                            </div>
                                        </div>

                                        <div class="text-[7.5px] font-mono text-black/50 border-t border-black/10 pt-1 flex items-center justify-between">
                                            <span>Antiquités • Mode • Déco</span>
                                            <span>BE • FR • LU • NL • DE</span>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}

                    <!-- ====================================================== -->
                    <!-- GABARIT 4 : PLANCHE DE 15 MINI-STICKERS (A4 DÉCOUPE)   -->
                    <!-- ====================================================== -->
                    {#if templateMode === "stickers_grid"}
                        <div class="w-full flex-grow flex flex-col justify-between">
                            <div class="no-print pb-2 text-[10px] font-mono text-black/50 text-center uppercase">
                                🏷 Planche de 15 stickers carrés avec repères de coupe (étiquettes prix ou emballages)
                            </div>

                            <div class="grid grid-cols-3 gap-3 flex-grow">
                                {#each Array(15) as _, i}
                                    <div class="border-2 border-dashed border-black/50 p-2.5 bg-white flex flex-col items-center justify-between text-center">
                                        <div class="text-[9px] font-black uppercase font-mono text-black">
                                            {siteTitle}
                                        </div>
                                        <div class="w-20 h-20 border border-black p-0.5 my-1 bg-white">
                                            {#if qrSvg}
                                                <div class="w-full h-full [&>svg]:w-full [&>svg]:h-full">
                                                    {@html qrSvg}
                                                </div>
                                            {/if}
                                        </div>
                                        <div class="text-[8px] font-bold font-mono text-black underline">
                                            daisybrocante.com
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}

                </div>
            </div>

        </div>

    </div>
</div>
