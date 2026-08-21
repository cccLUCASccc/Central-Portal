<script lang="ts">
    import { onMount } from "svelte";
    import type { Prospect } from "../../../type";

    interface ScrapeResultItem {
        url: string;
        email: string;
    }

    interface ScrapeResponse {
        requete: string;
        prospectsInseres: Prospect[];
        totalScrappes: number;
        error?: string;
    }

    let keyword = $state("");
    let isScraping = $state(false);
    let scrapingStep = $state("");
    let elapsedTime = $state(0);
    let timerInterval: any = null;

    let prospects = $state<Prospect[]>([]);
    let selectedIds = $state<number[]>([]);
    let searchQuery = $state("");
    let filterWorktype = $state("all");
    let sortBy = $state<"date_desc" | "date_asc" | "email_asc">("date_desc");

    let lastScrapeStats = $state<{
        keyword: string;
        foundCount: number;
        scannedCount: number;
        date: string;
    } | null>(null);

    let scrapperUrl = $state("http://localhost:3000");
    let useAstroProxy = $state(true);
    let showAdvancedConfig = $state(false);
    let isServiceOnline = $state<boolean | null>(null);
    let isLoadingProspects = $state(false);

    let notification = $state<{ text: string; type: "success" | "error" | "info" } | null>(null);

    const keywordSuggestions = [
        "antiquaire liege",
        "brocanteur paris",
        "galerie art bruxelles",
        "mobilier vintage bordeaux",
        "horlogerie ancienne lyon",
        "curiosites lille"
    ];

    function notify(text: string, type: "success" | "error" | "info" = "success") {
        notification = { text, type };
        setTimeout(() => {
            if (notification?.text === text) {
                notification = null;
            }
        }, 4000);
    }

    // Charger les prospects directement depuis la base de données de Marty
    async function loadProspects(silent = false) {
        if (!silent) isLoadingProspects = true;
        try {
            let res: Response;
            if (useAstroProxy) {
                const proxyUrl = `/api/marty/proxy?action=list&scrapperUrl=${encodeURIComponent(scrapperUrl)}`;
                res = await fetch(proxyUrl);
            } else {
                const directUrl = `${scrapperUrl.replace(/\/$/, "")}/prospects`;
                res = await fetch(directUrl);
            }

            if (res.ok) {
                const data: Prospect[] = await res.json();
                if (Array.isArray(data)) {
                    prospects = data;
                    isServiceOnline = true;
                    saveProspectsToLocal();
                }
            } else {
                if (!silent) notify("Impossible de charger les prospects de la base.", "error");
            }
        } catch (err) {
            console.warn("Erreur de connexion à l'API Marty:", err);
            // Fallback sur le cache local en cas d'indisponibilité
            const saved = localStorage.getItem("marty_prospects");
            if (saved && prospects.length === 0) {
                prospects = JSON.parse(saved);
            }
        } finally {
            if (!silent) isLoadingProspects = false;
        }
    }

    onMount(() => {
        try {
            const savedStats = localStorage.getItem("marty_last_stats");
            if (savedStats) {
                lastScrapeStats = JSON.parse(savedStats);
            }
            const savedUrl = localStorage.getItem("marty_scrapper_url");
            if (savedUrl) {
                scrapperUrl = savedUrl;
            }
            const saved = localStorage.getItem("marty_prospects");
            if (saved) {
                prospects = JSON.parse(saved);
            }
        } catch (e) {
            console.error("Erreur de lecture du localStorage:", e);
        }

        checkServiceHealth();
        loadProspects();
    });

    function saveProspectsToLocal() {
        try {
            localStorage.setItem("marty_prospects", JSON.stringify(prospects));
            if (lastScrapeStats) {
                localStorage.setItem("marty_last_stats", JSON.stringify(lastScrapeStats));
            }
        } catch (e) {
            console.error("Erreur d'écriture localStorage:", e);
        }
    }

    async function checkServiceHealth() {
        try {
            const target = useAstroProxy 
                ? `/api/marty/proxy?action=health&scrapperUrl=${encodeURIComponent(scrapperUrl)}`
                : `${scrapperUrl.replace(/\/$/, "")}/health`;

            const res = await fetch(target, { signal: AbortSignal.timeout(3000) });
            isServiceOnline = res.ok;
        } catch {
            isServiceOnline = false;
        }
    }

    function applySuggestion(sug: string) {
        keyword = sug;
    }

    async function startScraping() {
        const query = keyword.trim();
        if (!query) {
            notify("Veuillez saisir un mot-clé ou un secteur à cibler.", "error");
            return;
        }

        isScraping = true;
        elapsedTime = 0;
        scrapingStep = "🔍 Étape 1/3 : Recherche d'adresses web cibles...";

        timerInterval = setInterval(() => {
            elapsedTime += 1;
            if (elapsedTime === 4) {
                scrapingStep = "🤖 Étape 2/3 : Analyse Playwright et extraction des emails...";
            } else if (elapsedTime === 15) {
                scrapingStep = "💾 Étape 3/3 : Déduplication et enregistrement en base...";
            }
        }, 1000);

        try {
            let res: Response;

            if (useAstroProxy) {
                const proxyUrl = `/api/marty/proxy?action=scrape&q=${encodeURIComponent(query)}&scrapperUrl=${encodeURIComponent(scrapperUrl)}`;
                res = await fetch(proxyUrl, {
                    method: "POST"
                });
            } else {
                const directUrl = `${scrapperUrl.replace(/\/$/, "")}/generer-leads?q=${encodeURIComponent(query)}`;
                res = await fetch(directUrl, {
                    method: "POST"
                });
            }

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Erreur serveur HTTP ${res.status}`);
            }

            const data: ScrapeResponse = await res.json();
            const newInserted = data.prospectsInseres || [];

            // Fusionner avec les prospects locaux sans doublons d'email
            const existingEmails = new Set(prospects.map(p => p.email.toLowerCase()));
            const addedItems: Prospect[] = [];

            for (const item of newInserted) {
                if (item.email && !existingEmails.has(item.email.toLowerCase())) {
                    existingEmails.add(item.email.toLowerCase());
                    addedItems.push({
                        id: item.id || Date.now() + Math.floor(Math.random() * 1000),
                        email: item.email,
                        worktype: item.worktype || query,
                        creaton: item.creaton || new Date().toISOString()
                    });
                }
            }

            if (addedItems.length > 0) {
                prospects = [...addedItems, ...prospects];
            }

            lastScrapeStats = {
                keyword: query,
                foundCount: addedItems.length,
                scannedCount: data.totalScrappes || 0,
                date: new Date().toISOString()
            };

            saveProspectsToLocal();
            isServiceOnline = true;

            if (addedItems.length > 0) {
                notify(`🎯 Scraping terminé ! ${addedItems.length} nouvel(s) email(s) extrait(s) sur ${data.totalScrappes} cibles.`, "success");
            } else {
                notify(`ℹ️ Scraping terminé : ${data.totalScrappes} sites analysés, aucun nouvel email unique trouvé.`, "info");
            }

            // Recharger la liste officielle depuis la base PostgreSQL
            await loadProspects(true);

        } catch (err: any) {
            console.error("Erreur de scraping :", err);
            notify(`Échec du scraping : ${err.message || "Service inaccessible"}`, "error");
            isServiceOnline = false;
        } finally {
            isScraping = false;
            scrapingStep = "";
            if (timerInterval) clearInterval(timerInterval);
        }
    }

    // Gestion du tableau
    let uniqueWorktypes = $derived.by(() => {
        const types = new Set<string>();
        for (const p of prospects) {
            if (p.worktype) types.add(p.worktype);
        }
        return Array.from(types);
    });

    let filteredProspects = $derived.by(() => {
        let list = [...prospects];

        if (filterWorktype !== "all") {
            list = list.filter(p => p.worktype === filterWorktype);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(p => 
                p.email.toLowerCase().includes(q) || 
                (p.worktype && p.worktype.toLowerCase().includes(q))
            );
        }

        if (sortBy === "date_desc") {
            list.sort((a, b) => new Date(b.creaton || 0).getTime() - new Date(a.creaton || 0).getTime());
        } else if (sortBy === "date_asc") {
            list.sort((a, b) => new Date(a.creaton || 0).getTime() - new Date(b.creaton || 0).getTime());
        } else if (sortBy === "email_asc") {
            list.sort((a, b) => a.email.localeCompare(b.email));
        }

        return list;
    });

    function toggleSelect(id: number) {
        if (selectedIds.includes(id)) {
            selectedIds = selectedIds.filter(i => i !== id);
        } else {
            selectedIds = [...selectedIds, id];
        }
    }

    function toggleSelectAll() {
        if (selectedIds.length === filteredProspects.length && filteredProspects.length > 0) {
            selectedIds = [];
        } else {
            selectedIds = filteredProspects.map(p => p.id as number);
        }
    }

    function copyToClipboard(text: string, message = "Copié dans le presse-papier !") {
        navigator.clipboard.writeText(text);
        notify(message, "info");
    }

    function copySelectedEmails() {
        const selectedEmails = prospects
            .filter(p => selectedIds.includes(p.id as number))
            .map(p => p.email);

        if (selectedEmails.length === 0) return;

        const text = selectedEmails.join("; ");
        copyToClipboard(text, `${selectedEmails.length} email(s) copiés (séparateur ';') !`);
    }

    async function deleteSelectedProspects() {
        if (!confirm(`Supprimer définitivement ces ${selectedIds.length} lead(s) de la base de données ?`)) return;

        const idsToDelete = [...selectedIds];
        try {
            await Promise.all(idsToDelete.map(id => {
                const url = useAstroProxy 
                    ? `/api/marty/proxy?action=delete&id=${id}&scrapperUrl=${encodeURIComponent(scrapperUrl)}`
                    : `${scrapperUrl.replace(/\/$/, "")}/prospects?id=${id}`;
                return fetch(url, { method: "DELETE" });
            }));
            prospects = prospects.filter(p => !idsToDelete.includes(p.id as number));
            selectedIds = [];
            saveProspectsToLocal();
            notify(`${idsToDelete.length} lead(s) supprimé(s) de la base de données.`, "info");
        } catch (err) {
            console.error("Erreur suppression groupée :", err);
            notify("Erreur lors de la suppression.", "error");
        }
    }

    async function deleteSingleProspect(id: number) {
        if (!confirm("Supprimer ce prospect de la base de données ?")) return;
        try {
            const url = useAstroProxy 
                ? `/api/marty/proxy?action=delete&id=${id}&scrapperUrl=${encodeURIComponent(scrapperUrl)}`
                : `${scrapperUrl.replace(/\/$/, "")}/prospects?id=${id}`;
            await fetch(url, { method: "DELETE" });
            prospects = prospects.filter(p => p.id !== id);
            selectedIds = selectedIds.filter(i => i !== id);
            saveProspectsToLocal();
            notify("Prospect supprimé de la base.", "info");
        } catch (err) {
            console.error("Erreur suppression prospect :", err);
            notify("Erreur lors de la suppression.", "error");
        }
    }

    function exportToCSV(typeFilter?: string) {
        const targetList = typeFilter && typeFilter !== "all"
            ? prospects.filter(p => p.worktype === typeFilter)
            : (selectedIds.length > 0 ? prospects.filter(p => selectedIds.includes(p.id as number)) : filteredProspects);

        if (targetList.length === 0) {
            notify("Aucun email à exporter.", "error");
            return;
        }

        let csv = "ID,Email,Requete/Cible,Date Ajout\n";
        for (const p of targetList) {
            const dateStr = p.creaton ? new Date(p.creaton).toLocaleDateString('fr-FR') : "";
            csv += `"${p.id || ''}","${p.email.replace(/"/g, '""')}","${(p.worktype || '').replace(/"/g, '""')}","${dateStr}"\n`;
        }

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `marty_leads_${typeFilter || 'export'}_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        notify(`📥 Fichier CSV téléchargé (${targetList.length} leads) !`, "success");
    }

    function formatDate(dateStr?: string): string {
        if (!dateStr) return "-";
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });
        } catch {
            return dateStr;
        }
    }
</script>

<div class="space-y-8 font-mono">
    <!-- Notification Toast Rétro -->
    {#if notification}
        <div class="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div class="border-2 border-black p-3.5 text-xs font-bold uppercase shadow-[4px_4px_0px_0px_#000] {notification.type === 'error' ? 'bg-[#FFC2D1] text-black' : notification.type === 'info' ? 'bg-[#D4E2FD] text-black' : 'bg-[#99E7DC] text-black'}">
                <span>{notification.text}</span>
            </div>
        </div>
    {/if}

    <!-- Hero / Station Header -->
    <div class="retro-card-yellow p-6 sm:p-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border-3 border-black shadow-[6px_6px_0px_0px_#000]">
        <div class="space-y-2">
            <div class="flex items-center gap-2.5 flex-wrap">
                <span class="retro-badge bg-black text-white text-xs px-2.5 py-0.5">PROJET_02.SYS // MARTY</span>
                <span class="retro-badge bg-[#99E7DC] text-black text-xs font-black">● SCRAPPER DE CLIENTS</span>
                <span class="retro-badge bg-white text-black text-xs">V1.0-STABLE</span>
            </div>
            <h1 class="text-3xl sm:text-4xl font-black uppercase tracking-tight text-black">
                Station Marty // Scrapper d'Emails
            </h1>
            <p class="text-xs sm:text-sm text-black/80 font-medium max-w-2xl leading-relaxed">
                Module automatisé de détection et d'extraction de coordonnées prospects qualifiés. Lancez une recherche par secteur d'activité, explorez les sites cibles et exportez les adresses emails en CSV.
            </p>
        </div>

        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <button 
                onclick={() => loadProspects()} 
                class="retro-btn bg-white hover:bg-[#FFE600] text-xs py-2 px-3 flex items-center justify-center gap-2 shadow-[2px_2px_0px_0px_#000]"
                disabled={isLoadingProspects}
                title="Recharger la base de données"
            >
                <span class="{isLoadingProspects ? 'animate-spin' : ''}">🔄</span>
                <span>{isLoadingProspects ? 'Chargement...' : 'Actualiser Base'}</span>
            </button>
            <div class="bg-[#FFD2A6] border-2 border-black p-3 shadow-[3px_3px_0px_0px_#000] text-xs space-y-1">
                <div class="text-[10px] text-black/60 font-bold uppercase">Moteur Web Scraper</div>
                <div class="font-black text-black flex items-center gap-1.5">
                    <span>⚡</span> PLAYWRIGHT CHROMIUM
                </div>
            </div>
        </div>
    </div>


    <!-- 4 Stats Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Card 1: Total Leads Enregistrés (Peach) -->
        <div class="retro-card-peach p-5 flex flex-col justify-between relative group">
            <div class="flex items-start justify-between">
                <div>
                    <span class="text-[10px] font-bold uppercase tracking-wider text-black/70 block">Base de Données</span>
                    <h3 class="text-lg font-black uppercase tracking-tight text-black mt-0.5">Total Leads</h3>
                </div>
                <div class="retro-icon-box bg-white">
                    📧
                </div>
            </div>
            <div class="mt-4 pt-3 border-t-2 border-black bg-white p-3 shadow-[2px_2px_0px_0px_#000]">
                <div class="text-2xl font-black font-mono text-black">{prospects.length}</div>
                <p class="text-[10px] text-black/60 mt-0.5 uppercase">Emails prêts à l'export</p>
            </div>
        </div>

        <!-- Card 2: Dernier Scraping (Mint) -->
        <div class="retro-card-mint p-5 flex flex-col justify-between relative group">
            <div class="flex items-start justify-between">
                <div>
                    <span class="text-[10px] font-bold uppercase tracking-wider text-black/70 block">Dernière Session</span>
                    <h3 class="text-lg font-black uppercase tracking-tight text-black mt-0.5">Emails Extraits</h3>
                </div>
                <div class="retro-icon-box bg-white">
                    🎯
                </div>
            </div>
            <div class="mt-4 pt-3 border-t-2 border-black bg-white p-3 shadow-[2px_2px_0px_0px_#000]">
                <div class="text-2xl font-black font-mono text-black">{lastScrapeStats ? `+${lastScrapeStats.foundCount}` : "0"}</div>
                <p class="text-[10px] text-black/60 mt-0.5 uppercase">{lastScrapeStats ? `sur ${lastScrapeStats.scannedCount} sites analysés` : "Aucun scan récent"}</p>
            </div>
        </div>

        <!-- Card 3: Cible Active (Lavender) -->
        <div class="retro-card-blue p-5 flex flex-col justify-between relative group">
            <div class="flex items-start justify-between">
                <div>
                    <span class="text-[10px] font-bold uppercase tracking-wider text-black/70 block">Requête Récente</span>
                    <h3 class="text-lg font-black uppercase tracking-tight text-black mt-0.5">Dernière Cible</h3>
                </div>
                <div class="retro-icon-box bg-white">
                    🔍
                </div>
            </div>
            <div class="mt-4 pt-3 border-t-2 border-black bg-white p-3 shadow-[2px_2px_0px_0px_#000]">
                <div class="text-sm font-black font-mono text-black truncate" title={lastScrapeStats?.keyword || "-"}>
                    {lastScrapeStats?.keyword || "Aucune"}
                </div>
                <p class="text-[10px] text-black/60 mt-0.5 uppercase">{lastScrapeStats?.date ? formatDate(lastScrapeStats.date) : "En attente"}</p>
            </div>
        </div>

        <!-- Card 4: Statut Scrapper (Rose) -->
        <div class="retro-card-rose p-5 flex flex-col justify-between relative group">
            <div class="flex items-start justify-between">
                <div>
                    <span class="text-[10px] font-bold uppercase tracking-wider text-black/70 block">Service Node/Bun</span>
                    <h3 class="text-lg font-black uppercase tracking-tight text-black mt-0.5">État Scrapper</h3>
                </div>
                <div class="retro-icon-box bg-white">
                    ⚡
                </div>
            </div>
            <div class="mt-4 pt-3 border-t-2 border-black bg-white p-3 shadow-[2px_2px_0px_0px_#000] flex items-center justify-between">
                <div>
                    <div class="text-sm font-black font-mono flex items-center gap-1.5">
                        {#if isServiceOnline === true}
                            <span class="w-2.5 h-2.5 bg-green-500 rounded-full inline-block"></span>
                            <span class="text-green-700">EN LIGNE</span>
                        {:else if isServiceOnline === false}
                            <span class="w-2.5 h-2.5 bg-red-500 rounded-full inline-block"></span>
                            <span class="text-red-700">HORS LIGNE</span>
                        {:else}
                            <span class="w-2.5 h-2.5 bg-yellow-500 rounded-full inline-block animate-pulse"></span>
                            <span>TEST EN COURS</span>
                        {/if}
                    </div>
                    <p class="text-[10px] text-black/60 mt-0.5 uppercase">{scrapperUrl.replace(/^https?:\/\//, '')}</p>
                </div>
                <button 
                    onclick={checkServiceHealth} 
                    class="retro-btn py-1 px-2 text-[10px] bg-[#FFE600] hover:bg-[#fff066]"
                    title="Vérifier la connectivité"
                >
                    Tester
                </button>
            </div>
        </div>
    </div>

    <!-- Zone de Saisie des Mots-Clés et Lancement -->
    <div class="retro-card p-6 sm:p-8 space-y-6">
        <div class="flex items-center justify-between border-b-2 border-black pb-3">
            <div class="flex items-center gap-2.5">
                <span class="retro-badge bg-[#FFE600] text-black text-xs font-black">COMMANDE // 01</span>
                <h2 class="text-xl font-black uppercase tracking-tight text-black">
                    Configuration & Lancement du Scraping
                </h2>
            </div>
            <button 
                type="button" 
                onclick={() => showAdvancedConfig = !showAdvancedConfig}
                class="retro-btn text-xs py-1 px-2.5 bg-[#EDE9DF] hover:bg-white flex items-center gap-1.5"
            >
                <span>⚙️ Options</span>
                <span>{showAdvancedConfig ? '▲' : '▼'}</span>
            </button>
        </div>

        {#if showAdvancedConfig}
            <div class="p-4 bg-[#EDE9DF] border-2 border-black space-y-3 animate-in fade-in duration-150 text-xs">
                <div class="font-black uppercase text-black">Paramètres de Connexion Scrapper :</div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="space-y-1">
                        <label class="font-bold uppercase text-black/80">URL du Service Scrapper (Bun)</label>
                        <input 
                            type="text" 
                            bind:value={scrapperUrl}
                            placeholder="http://localhost:3000"
                            class="retro-input text-xs"
                            onchange={() => localStorage.setItem("marty_scrapper_url", scrapperUrl)}
                        />
                    </div>
                    <div class="space-y-1 flex flex-col justify-end">
                        <label class="cursor-pointer flex items-center gap-2 font-bold text-black border border-black p-2 bg-white">
                            <input 
                                type="checkbox" 
                                bind:checked={useAstroProxy} 
                                class="checkbox checkbox-xs border-2 border-black rounded-none bg-white checked:bg-[#99E7DC]"
                            />
                            <span>Passer par le Proxy Interne Astro (Recommandé anti-CORS)</span>
                        </label>
                    </div>
                </div>
            </div>
        {/if}

        <form onsubmit={(e) => { e.preventDefault(); startScraping(); }} class="space-y-4">
            <div class="space-y-2">
                <label for="marty-keyword-input" class="text-xs font-black uppercase tracking-wider text-black flex items-center gap-2">
                    <span>Mots-clés de Prospection / Cible géographique</span>
                    <span class="text-black/50 font-normal">(ex: "antiquaire liege", "brocanteur paris", "boutique deco bordeaux")</span>
                </label>
                <div class="flex flex-col sm:flex-row gap-3">
                    <input 
                        id="marty-keyword-input"
                        type="text" 
                        bind:value={keyword}
                        placeholder="Entrez vos mots-clés de recherche..."
                        class="retro-input text-base sm:text-lg flex-grow font-bold"
                        disabled={isScraping}
                        required
                    />
                    <button 
                        type="submit" 
                        disabled={isScraping || !keyword.trim()}
                        class="retro-btn-primary py-3.5 px-6 sm:px-8 text-sm sm:text-base font-black shadow-[4px_4px_0px_0px_#000] hover:shadow-[6px_6px_0px_0px_#000] flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                        {#if isScraping}
                            <span class="loading loading-spinner loading-sm"></span>
                            <span>EXTRACTION EN COURS ({elapsedTime}s)...</span>
                        {:else}
                            <span>⚡ LANCER LE SCRAPPER</span>
                            <span>»</span>
                        {/if}
                    </button>
                </div>
            </div>

            <!-- Suggestions de Mots-clés Rapides -->
            <div class="pt-2 flex flex-wrap items-center gap-2">
                <span class="text-xs font-bold text-black/60 uppercase">Suggestions :</span>
                {#each keywordSuggestions as sug}
                    <button 
                        type="button"
                        onclick={() => applySuggestion(sug)}
                        disabled={isScraping}
                        class="retro-badge bg-white hover:bg-[#FFE600] text-black text-xs cursor-pointer border border-black transition-colors"
                    >
                        + {sug}
                    </button>
                {/each}
            </div>

            {#if isScraping}
                <div class="p-4 bg-[#FFE600]/30 border-2 border-black shadow-[3px_3px_0px_0px_#000] space-y-2 animate-in fade-in duration-200">
                    <div class="flex items-center justify-between text-xs font-black uppercase">
                        <span class="flex items-center gap-2">
                            <span class="loading loading-dots loading-xs"></span>
                            <span>{scrapingStep}</span>
                        </span>
                        <span class="bg-black text-white px-2 py-0.5">{elapsedTime}s</span>
                    </div>
                    <div class="w-full bg-white h-2.5 border border-black overflow-hidden">
                        <div class="bg-black h-full animate-pulse" style="width: 100%;"></div>
                    </div>
                    <p class="text-[11px] text-black/70">
                        Playwright explore les sites web trouvés et extrait les adresses emails en tâche de fond. Veuillez patienter quelques secondes.
                    </p>
                </div>
            {/if}
        </form>
    </div>

    <!-- Barre d'actions groupées flottante -->
    {#if selectedIds.length > 0}
        <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div class="bg-[#FFE600] text-black px-5 py-3 border-3 border-black shadow-[6px_6px_0px_0px_#000] flex flex-wrap items-center gap-4">
                <div class="flex items-center gap-2">
                    <span class="bg-black text-white px-2 py-0.5 text-xs font-black">{selectedIds.length}</span>
                    <span class="text-xs font-black uppercase">Lead(s) sélectionné(s)</span>
                </div>
                
                <div class="h-6 w-0.5 bg-black hidden sm:block"></div>
                
                <div class="flex flex-wrap items-center gap-2">
                    <button onclick={copySelectedEmails} class="retro-btn text-xs py-1.5 px-3 bg-white font-bold flex items-center gap-1.5">
                        📋 Copier Emails (;)
                    </button>

                    <button onclick={() => exportToCSV()} class="retro-btn text-xs py-1.5 px-3 bg-[#99E7DC] font-bold flex items-center gap-1.5">
                        📥 Exporter Sélection CSV
                    </button>

                    <button onclick={deleteSelectedProspects} class="retro-btn-error text-xs py-1.5 px-3 font-black">
                        🗑️ Supprimer
                    </button>
                    
                    <button onclick={() => selectedIds = []} class="retro-btn text-xs py-1.5 px-2 bg-white" title="Annuler sélection">
                        ✕
                    </button>
                </div>
            </div>
        </div>
    {/if}

    <!-- Section Tableau des Emails -->
    <div class="space-y-4">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-2 border-black pb-2">
            <div class="flex items-center gap-2">
                <span class="w-3 h-3 bg-[#99E7DC] border border-black inline-block"></span>
                <h2 class="text-lg font-black uppercase tracking-wider text-black">
                    Table des Emails & Prospects ({filteredProspects.length})
                </h2>
            </div>
            
            <div class="flex flex-wrap items-center gap-2">
                <button 
                    onclick={() => exportToCSV(filterWorktype === "all" ? undefined : filterWorktype)}
                    disabled={filteredProspects.length === 0}
                    class="retro-btn text-xs py-1.5 px-3 bg-[#99E7DC] hover:bg-[#7fe2d5] font-black border-2 border-black shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <span>📥 EXPORTER CSV</span>
                    {#if filterWorktype !== "all"}
                        <span class="bg-black text-white px-1 text-[10px]">({filterWorktype})</span>
                    {/if}
                </button>
            </div>
        </div>

        <!-- Filtres et Recherche de la Table -->
        <div class="retro-card p-4 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
            <!-- Recherche rapide -->
            <div class="relative flex-1 md:max-w-xs">
                <input 
                    type="text" 
                    placeholder="Filtrer par email ou mot-clé..." 
                    bind:value={searchQuery}
                    class="retro-input text-xs py-1.5 pr-6"
                />
                {#if searchQuery}
                    <button 
                        onclick={() => searchQuery = ""}
                        class="absolute right-2 top-2 text-xs font-bold opacity-60 hover:opacity-100"
                    >
                        ✕
                    </button>
                {/if}
            </div>

            <!-- Filtres par Cible & Tri -->
            <div class="flex flex-wrap items-center gap-2">
                <div class="flex items-center gap-1.5 text-xs">
                    <span class="font-bold uppercase text-black/70">Cible :</span>
                    <select bind:value={filterWorktype} class="retro-select text-xs py-1.5 w-auto">
                        <option value="all">Toutes les requêtes ({prospects.length})</option>
                        {#each uniqueWorktypes as type}
                            {@const count = prospects.filter(p => p.worktype === type).length}
                            <option value={type}>{type} ({count})</option>
                        {/each}
                    </select>
                </div>

                <div class="flex items-center gap-1.5 text-xs">
                    <span class="font-bold uppercase text-black/70">Tri :</span>
                    <select bind:value={sortBy} class="retro-select text-xs py-1.5 w-auto">
                        <option value="date_desc">📅 Plus récent</option>
                        <option value="date_asc">📅 Plus ancien</option>
                        <option value="email_asc">🔤 Email A-Z</option>
                    </select>
                </div>
            </div>
        </div>

        <!-- Tableau Neo-Brutalist -->
        <div class="retro-card overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full text-left text-xs border-collapse">
                    <thead>
                        <tr class="bg-[#D4E2FD] border-b-2 border-black text-black font-black uppercase">
                            <th class="p-3 border-r border-black w-10 text-center">
                                <input 
                                    type="checkbox" 
                                    class="checkbox checkbox-xs border-2 border-black rounded-none bg-white checked:bg-black checked:text-white" 
                                    checked={selectedIds.length === filteredProspects.length && filteredProspects.length > 0}
                                    onchange={toggleSelectAll}
                                />
                            </th>
                            <th class="p-3 border-r border-black w-16 text-center">ID</th>
                            <th class="p-3 border-r border-black">Adresse Email</th>
                            <th class="p-3 border-r border-black">Cible / Mots-clés</th>
                            <th class="p-3 border-r border-black">Date d'Extraction</th>
                            <th class="p-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    
                    <tbody>
                        {#each filteredProspects as prospect, index (prospect.id || index)}
                            {@const isSelected = selectedIds.includes(prospect.id as number)}
                            <tr 
                                class="border-b border-black {index % 2 === 0 ? 'bg-white' : 'bg-[#F6F4EE]'} {isSelected ? '!bg-[#FFE600]/30' : ''} hover:bg-[#FFE600]/20 transition-colors"
                            >
                                <td class="p-3 border-r border-black text-center">
                                    <input 
                                        type="checkbox" 
                                        class="checkbox checkbox-xs border-2 border-black rounded-none bg-white checked:bg-black checked:text-white" 
                                        checked={isSelected}
                                        onchange={() => toggleSelect(prospect.id as number)}
                                    />
                                </td>

                                <td class="p-3 border-r border-black text-center font-mono font-bold text-black/60 text-[11px]">
                                    #{prospect.id || (index + 1)}
                                </td>

                                <td class="p-3 border-r border-black font-bold">
                                    <div class="flex items-center justify-between gap-3">
                                        <div class="flex items-center gap-2">
                                            <span class="text-base">📧</span>
                                            <span class="text-sm text-black selection:bg-black selection:text-white font-mono">{prospect.email}</span>
                                        </div>
                                        <div class="flex items-center gap-1">
                                            <button 
                                                type="button" 
                                                onclick={() => copyToClipboard(prospect.email)}
                                                class="retro-btn py-0.5 px-1.5 text-[10px] bg-white hover:bg-[#FFE600]"
                                                title="Copier l'email"
                                            >
                                                📋
                                            </button>
                                            <a 
                                                href={`mailto:${prospect.email}`}
                                                class="retro-btn py-0.5 px-1.5 text-[10px] bg-[#99E7DC] hover:bg-[#7ce0d3]"
                                                title="Écrire à ce prospect"
                                            >
                                                ✉️
                                            </a>
                                        </div>
                                    </div>
                                </td>

                                <td class="p-3 border-r border-black">
                                    <span class="retro-badge bg-[#EDE9DF] border border-black text-black font-bold text-[11px]">
                                        {prospect.worktype || "Général"}
                                    </span>
                                </td>

                                <td class="p-3 border-r border-black font-mono text-[11px] text-black/70">
                                    {formatDate(prospect.creaton)}
                                </td>

                                <td class="p-3 text-right">
                                    <button 
                                        type="button" 
                                        onclick={() => deleteSingleProspect(prospect.id as number)}
                                        class="retro-btn py-1 px-2 text-[10px] bg-[#FFC2D1] hover:bg-[#fa96ab] font-bold" 
                                        title="Supprimer ce lead"
                                    >
                                        🗑️ Supprimer
                                    </button>
                                </td>
                            </tr>
                        {:else}
                            <tr>
                                <td colspan="6" class="text-center py-16 bg-[#F6F4EE]">
                                    <div class="flex flex-col items-center gap-2">
                                        <span class="text-4xl">🕵️</span>
                                        <p class="text-sm font-bold uppercase text-black">Aucun email de prospect dans la table</p>
                                        <p class="text-xs text-black/60 max-w-sm">
                                            Saisissez un mot-clé ci-dessus (ex: "antiquaire liege") et cliquez sur <strong>Lancer le scrapper</strong> pour collecter vos premiers leads.
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

