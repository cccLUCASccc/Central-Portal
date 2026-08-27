<script lang="ts">
    import { onMount } from "svelte";

    interface Props {
        userName?: string;
    }

    let { userName = "Gestionnaire" }: Props = $props();

    let isModalOpen = $state(false);
    let selectedSlot = $state<string | null>(null);

    function openSlotModal(slotName: string) {
        selectedSlot = slotName;
        isModalOpen = true;
    }

    function closeModal() {
        isModalOpen = false;
        selectedSlot = null;
    }
</script>

<div class="space-y-8 font-mono">
    
    <!-- Hero / OS Hub Header -->
    <div class="retro-card-yellow p-6 sm:p-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border-3 border-black shadow-[6px_6px_0px_0px_#000]">
        <div class="space-y-2">
            <div class="flex items-center gap-2.5 flex-wrap">
                <span class="retro-badge bg-black text-white text-xs px-2.5 py-0.5">HUB CENTRAL // MULTI-PROJETS</span>
                <span class="retro-badge bg-[#86E2D5] text-black text-xs font-black">● 2 PROJETS ACTIFS</span>
                <span class="retro-badge bg-white text-black text-xs">V3.2-STABLE</span>
            </div>
            <h1 class="text-3xl sm:text-4xl font-black uppercase tracking-tight text-black">
                Console de Gestion des Projets
            </h1>
            <p class="text-xs sm:text-sm text-black/80 font-medium max-w-2xl leading-relaxed">
                Sélectionnez la station de travail à administrer. Chaque projet dispose de son inventaire, de ses connecteurs API et de son espace de stockage indépendant.
            </p>
        </div>

        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <div class="bg-white border-2 border-black p-3 shadow-[3px_3px_0px_0px_#000] text-xs space-y-1">
                <div class="text-[10px] text-black/60 font-bold uppercase">Passerelle Serveur</div>
                <div class="font-black text-black flex items-center gap-1.5">
                    <span class="w-2 h-2 bg-green-500 rounded-full inline-block animate-pulse"></span>
                    RAILWAY CENTRAL-API
                </div>
            </div>
            <div class="bg-[#FFD2A6] border-2 border-black p-3 shadow-[3px_3px_0px_0px_#000] text-xs space-y-1">
                <div class="text-[10px] text-black/60 font-bold uppercase">Stockage Cloud</div>
                <div class="font-black text-black flex items-center gap-1.5">
                    <span>📁</span> AWS S3 READY
                </div>
            </div>
        </div>
    </div>

    <!-- Section Title -->
    <div class="flex items-center justify-between border-b-2 border-black pb-2">
        <div class="flex items-center gap-2">
            <span class="w-3 h-3 bg-[#FFAEC1] border border-black inline-block"></span>
            <h2 class="text-lg font-black uppercase tracking-wider text-black">
                Projets Disponibles & Stations
            </h2>
        </div>
        <span class="text-xs font-bold text-black/60">2 sur 3 emplacements configurés</span>
    </div>

    <!-- Grid of Projects -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        <!-- PROJET #01 : DAISY BROCANTE (ACTIVE) -->
        <div class="bg-white border-3 border-black shadow-[6px_6px_0px_0px_#000] hover:shadow-[10px_10px_0px_0px_#000] transition-all flex flex-col justify-between group overflow-hidden">
            
            <!-- Window Titlebar -->
            <div class="bg-[#2B2D42] text-white px-4 py-2 border-b-2 border-black flex items-center justify-between font-mono text-xs font-bold">
                <div class="flex items-center gap-2">
                    <span class="text-[#86E2D5] font-black">▶</span>
                    <span class="tracking-wider uppercase">PROJET_01.SYS</span>
                </div>
                <span class="retro-badge bg-[#86E2D5] text-black text-[10px] py-0 font-black">
                    ● EN LIGNE
                </span>
            </div>

            <!-- Card Body -->
            <div class="p-6 space-y-5 flex-grow">
                
                <!-- Project Icon & Title -->
                <div class="flex items-start gap-4">
                    <div class="w-14 h-14 bg-[#FFD2A6] border-2 border-black flex items-center justify-center text-2xl shadow-[3px_3px_0px_0px_#000] flex-shrink-0 group-hover:bg-[#FFD166] transition-colors">
                        🌼
                    </div>
                    <div class="space-y-1">
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] font-black bg-black text-white px-1.5 py-0.5">E-COMMERCE</span>
                            <span class="text-xs font-bold text-black/60">DAISYBROCANTE.FR</span>
                        </div>
                        <h3 class="text-xl font-black uppercase text-black tracking-tight group-hover:text-[#D1495B] transition-colors">
                            Daisy Brocante
                        </h3>
                    </div>
                </div>

                <!-- Description -->
                <p class="text-xs text-black/75 leading-relaxed">
                    Gestion de l'inventaire des antiquités et mobilier vintage, synchronisation automatique du catalogue avec eBay, module d'expéditions et galerie cloud S3.
                </p>

                <!-- Modules Badges -->
                <div class="space-y-2 pt-2 border-t border-black/10">
                    <div class="text-[10px] font-black uppercase text-black/60 tracking-wider">Modules Intégrés :</div>
                    <div class="flex flex-wrap gap-1.5 text-[11px]">
                        <a href="/antiquites" class="retro-badge bg-[#BFD7FE] hover:bg-white text-black transition-colors cursor-pointer" title="Voir l'inventaire">
                            📋 Inventaire
                        </a>
                        <a href="/subcategories" class="retro-badge bg-[#FFD166] hover:bg-white text-black transition-colors cursor-pointer" title="Gérer les catégories">
                            🏷️ Sous-catégories
                        </a>
                        <a href="/shops" class="retro-badge bg-[#86E2D5] hover:bg-white text-black transition-colors cursor-pointer" title="Gérer les vendeurs">
                            🏬 Boutiques
                        </a>
                        <a href="/ebay" class="retro-badge bg-[#86E2D5] hover:bg-white text-black transition-colors cursor-pointer" title="Synchronisation eBay">
                            📦 eBay Sync
                        </a>
                        <a href="/shops" class="retro-badge bg-[#FFD2A6] hover:bg-white text-black transition-colors cursor-pointer" title="Modération des boutiques">
                            🏪 Boutiques
                        </a>
                        <a href="/Livraison" class="retro-badge bg-[#FFAEC1] hover:bg-white text-black transition-colors cursor-pointer" title="Gestion des livraisons">
                            🚚 Livraisons
                        </a>
                        <a href="/storage" class="retro-badge bg-[#EDE9DF] hover:bg-white text-black transition-colors cursor-pointer" title="Stockage S3">
                            📁 Médias S3
                        </a>
                    </div>
                </div>

            </div>

            <!-- Card Action Footer -->
            <div class="p-4 bg-[#F6F4EE] border-t-2 border-black flex items-center justify-between gap-3">
                <span class="text-[11px] font-bold text-black/60">STATION #01</span>
                <a 
                    href="/antiquites" 
                    class="retro-btn retro-btn-primary py-2.5 px-4 text-xs font-black flex items-center gap-2 shadow-[3px_3px_0px_0px_#000] hover:shadow-[5px_5px_0px_0px_#000]"
                >
                    <span>OUVRIR LA STATION</span>
                    <span>»</span>
                </a>
            </div>

        </div>

        <!-- PROJET #02 : MARTY (ACTIVE) -->
        <div class="bg-white border-3 border-black shadow-[6px_6px_0px_0px_#000] hover:shadow-[10px_10px_0px_0px_#000] transition-all flex flex-col justify-between group overflow-hidden">
            
            <!-- Window Titlebar -->
            <div class="bg-[#2B2D42] text-white px-4 py-2 border-b-2 border-black flex items-center justify-between font-mono text-xs font-bold">
                <div class="flex items-center gap-2">
                    <span class="text-[#FFD166] font-black">▶</span>
                    <span class="tracking-wider uppercase">PROJET_02.SYS</span>
                </div>
                <span class="retro-badge bg-[#FFD166] text-black text-[10px] py-0 font-black">
                    ● PROSPECTION
                </span>
            </div>

            <!-- Card Body -->
            <div class="p-6 space-y-5 flex-grow">
                
                <!-- Project Icon & Title -->
                <div class="flex items-start gap-4">
                    <div class="w-14 h-14 bg-[#86E2D5] border-2 border-black flex items-center justify-center text-2xl shadow-[3px_3px_0px_0px_#000] flex-shrink-0 group-hover:bg-[#FFD166] transition-colors">
                        🕵️
                    </div>
                    <div class="space-y-1">
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] font-black bg-black text-white px-1.5 py-0.5">LEAD GEN</span>
                            <span class="text-xs font-bold text-black/60">MARTY.SYS</span>
                        </div>
                        <h3 class="text-xl font-black uppercase text-black tracking-tight group-hover:text-[#D1495B] transition-colors">
                            Marty
                        </h3>
                    </div>
                </div>

                <!-- Description -->
                <p class="text-xs text-black/75 leading-relaxed">
                    Scrapper automatisé d'adresses emails de prospects et clients qualifiés via SearXNG, DuckDuckGo et Playwright Chromium avec export CSV.
                </p>

                <!-- Modules Badges -->
                <div class="space-y-2 pt-2 border-t border-black/10">
                    <div class="text-[10px] font-black uppercase text-black/60 tracking-wider">Modules Intégrés :</div>
                    <div class="flex flex-wrap gap-1.5 text-[11px]">
                        <a href="/marty" class="retro-badge bg-[#FFD166] hover:bg-white text-black transition-colors cursor-pointer" title="Lancer le scraping">
                            ⚡ Scrapper de Leads
                        </a>
                        <a href="/marty" class="retro-badge bg-[#BFD7FE] hover:bg-white text-black transition-colors cursor-pointer" title="Voir les prospects">
                            📋 Table des Emails
                        </a>
                        <a href="/marty" class="retro-badge bg-[#86E2D5] hover:bg-white text-black transition-colors cursor-pointer" title="Télécharger CSV">
                            📥 Export CSV
                        </a>
                    </div>
                </div>

            </div>

            <!-- Card Action Footer -->
            <div class="p-4 bg-[#F6F4EE] border-t-2 border-black flex items-center justify-between gap-3">
                <span class="text-[11px] font-bold text-black/60">STATION #02</span>
                <a 
                    href="/marty" 
                    class="retro-btn retro-btn-primary py-2.5 px-4 text-xs font-black flex items-center gap-2 shadow-[3px_3px_0px_0px_#000] hover:shadow-[5px_5px_0px_0px_#000]"
                >
                    <span>OUVRIR LA STATION</span>
                    <span>»</span>
                </a>
            </div>

        </div>


        <!-- PROJET #03 : SLOT DISPONIBLE -->
        <div class="border-3 border-dashed border-black/40 bg-[#EDE9DF]/60 p-1 flex flex-col justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] hover:border-black transition-all">
            
            <div class="bg-[#2B2D42]/70 text-white px-4 py-2 border-b-2 border-black/30 flex items-center justify-between font-mono text-xs font-bold">
                <span class="tracking-wider uppercase text-white/70">PROJET_03.SYS</span>
                <span class="retro-badge bg-[#BFD7FE] text-black text-[10px] py-0 font-black">
                    LIBRE
                </span>
            </div>

            <div class="p-6 space-y-4 flex-grow flex flex-col justify-center items-center text-center">
                <div class="w-14 h-14 bg-white/80 border-2 border-dashed border-black/40 flex items-center justify-center text-2xl">
                    ⚙️
                </div>
                <div class="space-y-1">
                    <h3 class="text-lg font-black uppercase text-black/80">
                        Connecteur API & Service
                    </h3>
                    <p class="text-xs text-black/60 max-w-xs">
                        Architecture prête pour intégrer un micro-service, une API externe ou un tableau de bord analytique.
                    </p>
                </div>
                <div class="flex items-center gap-2 text-[10px] text-black/50 font-bold">
                    <span class="border border-black/30 px-2 py-0.5 bg-white">MICRO-SERVICE</span>
                </div>
            </div>

            <div class="p-4 bg-white/40 border-t-2 border-dashed border-black/30 flex items-center justify-center">
                <button 
                    type="button" 
                    onclick={() => openSlotModal("Projet #03")}
                    class="retro-btn text-xs py-2 px-4 bg-white hover:bg-[#86E2D5] font-black border border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                    + CONNECTER UN SERVICE
                </button>
            </div>

        </div>

    </div>

    <!-- Retro System Info Box -->
    <div class="p-4 bg-[#EDE9DF] border-2 border-black shadow-[3px_3px_0px_0px_#000] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
        <div class="flex items-center gap-3">
            <span class="retro-badge bg-black text-white text-[10px]">INFRA</span>
            <span class="text-black/80 font-bold">Gestionnaire.SYS centralise tous vos projets e-commerce en un point d'accès unique.</span>
        </div>
        <div class="flex items-center gap-2 text-[11px] text-black/60">
            <span>DAISY BROCANTE HUB</span>
            <span>•</span>
            <span>2026 EDITION</span>
        </div>
    </div>

</div>

<!-- Modal Slot Configuration -->
{#if isModalOpen}
    <div 
        role="dialog"
        aria-modal="true"
        class="fixed inset-0 z-[99999] bg-black/70 flex items-center justify-center p-4 font-mono select-none animate-in fade-in duration-150"
    >
        <div class="w-full max-w-md bg-[#EDE9DF] border-3 border-black shadow-[8px_8px_0px_0px_#000] p-1">
            <div class="bg-[#2B2D42] text-white px-3 py-1.5 border-b-2 border-black flex items-center justify-between text-xs font-bold mb-3">
                <span>CONFIGURATION // {selectedSlot}</span>
                <button 
                    type="button"
                    onclick={closeModal}
                    class="w-4 h-4 bg-[#FFAEC1] border border-black hover:bg-white text-black text-[9px] flex items-center justify-center font-black cursor-pointer shadow-[1px_1px_0px_0px_#000]"
                >
                    ✕
                </button>
            </div>
            <div class="p-4 bg-white border-2 border-black m-1 space-y-4">
                <div class="flex items-center gap-3">
                    <span class="text-2xl">📦</span>
                    <div>
                        <h4 class="font-black text-sm uppercase text-black">Ajout d'un nouveau projet</h4>
                        <p class="text-xs text-black/60">Emplacement {selectedSlot}</p>
                    </div>
                </div>
                <p class="text-xs text-black/80 leading-relaxed">
                    L'architecture multi-projets est prête. Pour lier un nouveau catalogue ou créer une base dédiée, ajoutez le sous-domaine ou la clé API correspondante dans la configuration backend.
                </p>
                <div class="pt-2 flex justify-end gap-2">
                    <button 
                        type="button"
                        onclick={closeModal}
                        class="retro-btn text-xs py-1.5 px-4 bg-[#FFAEC1] font-black"
                    >
                        COMPRIS »
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}

