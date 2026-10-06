<script lang="ts">
  interface Channel {
    id: string;
    name: string;
    subtitle: string;
    description: string;
    group: string;
    status: string;
    statusType: "active" | "live" | "growth";
    href: string;
    isExternal: boolean;
    buttonLabel: string;
    icon: string;
    tint: string;
    tagline: string;
    stats: { label: string; value: string }[];
    details: {
      account: string;
      audience: string;
      contentType: string;
      tip: string;
      hubUrl?: string;
      hubLabel?: string;
    };
  }

  const channels: Channel[] = [
    {
      id: "ebay",
      name: "eBay",
      subtitle: "Marketplace mondiale & enchères",
      description: "Synchronisez automatiquement vos pièces d'antiquité avec le catalogue international eBay. Gérez les annonces, les stocks et les ventes depuis le portail.",
      group: "Marketplace",
      status: "Connecté · Synchro API",
      statusType: "active",
      href: "/ebay",
      isExternal: false,
      buttonLabel: "Accéder au module eBay",
      icon: "package_2",
      tint: "bg-[#FFF394]",
      tagline: "Vente internationale · Enchères & Achat immédiat",
      stats: [
        { label: "Intégration", value: "Module interne" },
        { label: "Portée", value: "Internationale" },
        { label: "Type", value: "Catalogue direct" }
      ],
      details: {
        account: "Boutique eBay DaisyBrocante",
        audience: "Collectionneurs d'antiquités et acheteurs internationaux",
        contentType: "Fiches produits complètes, photos HD, dimensions et état certifié",
        tip: "Les objets rares et signés bénéficient d'une visibilité maximale via les enchères et les formats d'achat immédiat sur eBay.",
        hubUrl: "https://www.ebay.fr/sh/ovw",
        hubLabel: "Hub Vendeur eBay"
      }
    },
    {
      id: "facebook",
      name: "Facebook",
      subtitle: "Page officielle & Marketplace",
      description: "Partagez vos nouveautés avec une large communauté d'amateurs de brocante et touchez des acheteurs locaux et régionaux en Belgique et France.",
      group: "Social Commerce",
      status: "En ligne · Page active",
      statusType: "live",
      href: "https://www.facebook.com/dbrocante",
      isExternal: true,
      buttonLabel: "Ouvrir la page Facebook",
      icon: "storefront",
      tint: "bg-[#BFD7FE]",
      tagline: "Page : @dbrocante · Ventes locales & annonces",
      stats: [
        { label: "Page", value: "@dbrocante" },
        { label: "Portée", value: "Belgique & France" },
        { label: "Canal", value: "Marketplace & Posts" }
      ],
      details: {
        account: "facebook.com/dbrocante",
        audience: "Chineurs locaux, particuliers en quête de mobilier vintage et déco rétro",
        contentType: "Albums photos de nouveaux arrivages, vidéos en direct et marketplace locale",
        tip: "La marketplace Facebook génère d'excellents contacts directs pour le mobilier volumineux nécessitant un retrait ou une livraison locale.",
        hubUrl: "https://business.facebook.com/commerce_manager/",
        hubLabel: "Meta Commerce Manager"
      }
    },
    {
      id: "instagram",
      name: "Instagram",
      subtitle: "Shopping visuel & Vitrine mode/déco",
      description: "Sublimez la sélection mode vintage, miroirs, luminaires et objets d'époque. Permet de taguer les produits shoppables et de fidéliser une communauté passionnée.",
      group: "Social Commerce",
      status: "En ligne · @daisybrocante",
      statusType: "live",
      href: "https://www.instagram.com/daisybrocante/",
      isExternal: true,
      buttonLabel: "Ouvrir le profil Instagram",
      icon: "photo_camera",
      tint: "bg-[#FFAEC1]",
      tagline: "Compte : @daisybrocante · Stories & Shopping",
      stats: [
        { label: "Profil", value: "@daisybrocante" },
        { label: "Focus", value: "Mode, Déco & Design" },
        { label: "Format", value: "Reels & Carrousels" }
      ],
      details: {
        account: "instagram.com/daisybrocante",
        audience: "Amateurs de design du XXe siècle, mode vintage, stylistes et décorateurs d'intérieur",
        contentType: "Photos d'ambiance soignées, mises en scène, reels avant/après restauration",
        tip: "Ajoutez le lien du produit en story ou utilisez les étiquettes shopping Meta pour rediriger directement vers daisybrocante.com.",
        hubUrl: "https://business.facebook.com/commerce_manager/",
        hubLabel: "Instagram Shopping Hub"
      }
    },
    {
      id: "tiktok",
      name: "TikTok",
      subtitle: "Vidéos courtes & Chine vintage",
      description: "Captez une audience jeune et engagée grâce à des vidéos immersives de vos trouvailles de brocante, unboxings de chines et présentations de pièces insolites.",
      group: "Vidéo & Live",
      status: "En essor · Vidéo Shop",
      statusType: "growth",
      href: "https://www.tiktok.com/@daisybrocante",
      isExternal: true,
      buttonLabel: "Ouvrir le compte TikTok",
      icon: "videocam",
      tint: "bg-[#86E2D5]",
      tagline: "Compte : @daisybrocante · Coulisses & Chine",
      stats: [
        { label: "Profil", value: "@daisybrocante" },
        { label: "Format", value: "Vidéos 15-60s" },
        { label: "Dynamique", value: "Virale & Découverte" }
      ],
      details: {
        account: "tiktok.com/@daisybrocante",
        audience: "Génération passionnée d'upcycling, mode vintage Y2K / 70s et objets rétro originaux",
        contentType: "Visites de brocantes, restauration d'objets en direct, 'Combien vaut cet objet chiné ?'",
        tip: "La spontanéité et les anecdotes historiques sur l'origine des pièces fonctionnent très fort sur l'algorithme TikTok.",
        hubUrl: "https://seller-fr.tiktok.com/",
        hubLabel: "TikTok Shop Seller"
      }
    },
    {
      id: "pinterest",
      name: "Pinterest",
      subtitle: "Inspiration déco & Épingles produits",
      description: "Moteur de recherche visuel incontournable pour la décoration intérieure. Vos pièces de mobilier et tableaux restent découvrables pendant des mois par des acheteurs qualifiés.",
      group: "Inspiration & Déco",
      status: "Actif · Tableaux Déco",
      statusType: "active",
      href: "https://www.pinterest.com/daisybrocante/",
      isExternal: true,
      buttonLabel: "Ouvrir les tableaux Pinterest",
      icon: "push_pin",
      tint: "bg-[#FFD2A6]",
      tagline: "Compte : @daisybrocante · Rich Pins Déco",
      stats: [
        { label: "Profil", value: "@daisybrocante" },
        { label: "Cible", value: "Projets d'intérieur" },
        { label: "Durabilité", value: "Trafic long terme" }
      ],
      details: {
        account: "pinterest.com/daisybrocante",
        audience: "Architectes d'intérieur, propriétaires en rénovation et passionnés de décoration vintage",
        contentType: "Épingles produits haute résolution avec prix et lien retour direct vers le site web",
        tip: "Créez des tableaux thématiques (ex : 'Vaisselle vintage', 'Mobilier années 50', 'Miroirs dorés') pour capter les recherches Google et Pinterest.",
        hubUrl: "https://www.pinterest.com/business/hub/",
        hubLabel: "Pinterest Business Hub"
      }
    }
  ];

  let selectedChannel = $state<Channel | null>(null);

  function openChannelModal(channel: Channel) {
    selectedChannel = channel;
  }

  function closeChannelModal() {
    selectedChannel = null;
  }
</script>

<section class="space-y-8 font-mono" aria-labelledby="channels-title">
  <!-- Bouton Retour au Tableau de bord -->
  <div>
    <a
      href="/"
      class="retro-btn bg-white hover:bg-[#BFD7FE] text-xs font-black py-2 px-3.5 inline-flex items-center gap-2 shadow-[2px_2px_0px_0px_#000] transition-transform hover:-translate-x-0.5 active:translate-x-0"
    >
      <span class="material-symbols-outlined text-[16px]">arrow_back</span>
      <span>Tableau de bord</span>
    </a>
  </div>

  <!-- Header standardisé identique au tableau de bord -->
  <header class="flex flex-col gap-3 border-b-2 border-black pb-6 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <p class="mb-2 text-xs font-black uppercase tracking-[0.14em] text-black/55">Daisy Brocante · Distribution multi-plateformes</p>
      <h1 id="channels-title" class="text-3xl font-black uppercase leading-tight tracking-tight text-black sm:text-4xl">Canaux de vente</h1>
      <p class="mt-2 max-w-2xl text-sm leading-relaxed text-black/65">
        Centralisez et pilotez vos différents canaux de distribution en ligne pour maximiser la visibilité et les ventes de vos antiquités, pièces de mode et mobilier.
      </p>
    </div>
    <div class="inline-flex items-center gap-2 self-start border-2 border-black bg-white px-3 py-2 text-xs font-bold shadow-[3px_3px_0px_0px_#000] sm:self-auto">
      <span class="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
      <span>5 canaux configurés</span>
    </div>
  </header>

  <!-- Bandeau Synthèse Statut -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
    <div class="border-2 border-black bg-white p-3 shadow-[3px_3px_0px_0px_#000]">
      <span class="text-[10px] font-black uppercase tracking-wider text-black/50">Marketplace Directe</span>
      <div class="mt-1 flex items-center justify-between">
        <span class="text-lg font-black">1 canal (eBay)</span>
        <span class="material-symbols-outlined text-xl text-black/70">package_2</span>
      </div>
    </div>
    <div class="border-2 border-black bg-white p-3 shadow-[3px_3px_0px_0px_#000]">
      <span class="text-[10px] font-black uppercase tracking-wider text-black/50">Social Commerce</span>
      <div class="mt-1 flex items-center justify-between">
        <span class="text-lg font-black">Meta (FB & IG)</span>
        <span class="material-symbols-outlined text-xl text-black/70">storefront</span>
      </div>
    </div>
    <div class="border-2 border-black bg-white p-3 shadow-[3px_3px_0px_0px_#000]">
      <span class="text-[10px] font-black uppercase tracking-wider text-black/50">Vidéo & Live</span>
      <div class="mt-1 flex items-center justify-between">
        <span class="text-lg font-black">TikTok</span>
        <span class="material-symbols-outlined text-xl text-black/70">videocam</span>
      </div>
    </div>
    <div class="border-2 border-black bg-white p-3 shadow-[3px_3px_0px_0px_#000]">
      <span class="text-[10px] font-black uppercase tracking-wider text-black/50">Inspiration Déco</span>
      <div class="mt-1 flex items-center justify-between">
        <span class="text-lg font-black">Pinterest</span>
        <span class="material-symbols-outlined text-xl text-black/70">push_pin</span>
      </div>
    </div>
  </div>

  <!-- Grille des 5 Canaux de Vente -->
  <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
    {#each channels as channel}
      <div
        class="group flex min-h-[360px] flex-col justify-between border-2 border-black bg-white p-5 shadow-[4px_4px_0px_0px_#000] transition-transform hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#000] relative"
      >
        <!-- En-tête de la Card : Icône + Groupe & Statut -->
        <div>
          <div class="mb-4 flex items-start justify-between gap-3">
            <div class="flex items-center gap-3">
              <span class={`grid h-12 w-12 place-items-center border-2 border-black ${channel.tint} shadow-[2px_2px_0px_0px_#000]`}>
                {#if channel.id === 'ebay'}
                  <span class="material-symbols-outlined text-2xl" aria-hidden="true">package_2</span>
                {:else if channel.id === 'facebook'}
                  <svg class="h-6 w-6 fill-black" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                {:else if channel.id === 'instagram'}
                  <svg class="h-6 w-6 fill-black" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                {:else if channel.id === 'tiktok'}
                  <svg class="h-6 w-6 fill-black" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.97-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.24 1.17 2.25 2.41 2.49 1.12.24 2.3-.08 3.12-.87.65-.63.99-1.52.99-2.42V.02z"/>
                  </svg>
                {:else if channel.id === 'pinterest'}
                  <svg class="h-6 w-6 fill-black" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 0c-6.627 0-12 5.372-12 12 0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345-.09.375-.291 1.199-.334 1.379-.057.241-.19.291-.44.175-1.64-.764-2.665-3.159-2.665-5.087 0-4.14 3.008-7.944 8.677-7.944 4.556 0 8.1 3.247 8.1 7.585 0 4.526-2.854 8.17-6.814 8.17-1.331 0-2.582-.692-3.011-1.509l-.82 3.128c-.298 1.144-1.104 2.578-1.644 3.448 1.191.368 2.456.568 3.768.568 6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z"/>
                  </svg>
                {/if}
              </span>
              <div>
                <h2 class="text-xl font-black uppercase leading-tight text-black">{channel.name}</h2>
                <p class="text-[10px] font-bold uppercase tracking-wider text-black/55">{channel.subtitle}</p>
              </div>
            </div>
            <span class="border border-black bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-[1.5px_1.5px_0px_0px_#000]">
              {channel.group}
            </span>
          </div>

          <!-- Statut du canal -->
          <div class="mb-3 inline-flex items-center gap-1.5 border border-black/30 bg-[#FAF9F5] px-2 py-1 text-[10px] font-bold">
            <span class={`h-2 w-2 rounded-full ${channel.statusType === 'active' ? 'bg-emerald-500' : channel.statusType === 'live' ? 'bg-blue-500' : 'bg-amber-500'}`}></span>
            <span class="text-black/80">{channel.status}</span>
          </div>

          <!-- Description -->
          <p class="text-xs leading-relaxed text-black/75">
            {channel.description}
          </p>

          <!-- Métriques / Spécificités -->
          <div class="mt-4 grid grid-cols-3 gap-1.5 border-t border-b border-black/15 py-2.5 text-[10px]">
            {#each channel.stats as stat}
              <div class="space-y-0.5">
                <span class="block font-medium text-black/50 text-[9px] uppercase">{stat.label}</span>
                <span class="block font-black text-black leading-tight">{stat.value}</span>
              </div>
            {/each}
          </div>
        </div>

        <!-- Pied de la Card : Actions -->
        <div class="mt-5 space-y-2 pt-2">
          <!-- Bouton Principal -->
          <a
            href={channel.href}
            target={channel.isExternal ? "_blank" : undefined}
            rel={channel.isExternal ? "noreferrer" : undefined}
            class={`retro-btn ${channel.tint} text-xs font-black py-2.5 px-4 w-full flex items-center justify-between shadow-[3px_3px_0px_0px_#000] transition-transform hover:-translate-y-0.5 active:translate-x-0`}
          >
            <span>{channel.buttonLabel}</span>
            <span class="material-symbols-outlined text-[18px]">
              {channel.isExternal ? "open_in_new" : "arrow_forward"}
            </span>
          </a>

          <!-- Bouton Secondaire : Guide & Paramètres -->
          <button
            type="button"
            onclick={() => openChannelModal(channel)}
            class="retro-btn bg-white hover:bg-[#EDE9DF] text-[11px] font-bold py-1.5 px-3 w-full flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_0px_#000] cursor-pointer"
          >
            <span class="material-symbols-outlined text-[15px]">info</span>
            <span>Conseils & Configuration</span>
          </button>
        </div>
      </div>
    {/each}
  </div>

  <!-- Encart Astuce Stratégique Multi-Canal -->
  <div class="border-2 border-black bg-[#FFF394] p-5 shadow-[4px_4px_0px_0px_#000] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
    <div class="space-y-1">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-xl">lightbulb</span>
        <h3 class="font-black text-sm uppercase">Stratégie Multi-Canaux Daisy Brocante</h3>
      </div>
      <p class="text-xs text-black/80 max-w-3xl leading-relaxed">
        <strong>eBay</strong> assure les ventes internationales de pièces rares. <strong>Instagram & Pinterest</strong> génèrent les coups de cœur sur la mode et la déco intérieure. <strong>Facebook</strong> sécurise la clientèle de proximité, et <strong>TikTok</strong> attire les nouveaux collectionneurs via des vidéos des coulisses de chine.
      </p>
    </div>
    <a
      href="/antiquites"
      class="retro-btn bg-white hover:bg-[#86E2D5] text-xs font-black py-2 px-4 shadow-[2px_2px_0px_0px_#000] whitespace-nowrap"
    >
      Voir le catalogue
    </a>
  </div>
</section>

<!-- Modale Détails & Configuration d'un Canal -->
{#if selectedChannel}
  <div
    role="dialog"
    aria-modal="true"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 font-mono backdrop-blur-xs animate-in fade-in duration-150"
  >
    <div class="w-full max-w-lg border-3 border-black bg-white p-6 shadow-[8px_8px_0px_0px_#000] space-y-5">
      <!-- En-tête de la modale -->
      <div class="flex items-start justify-between border-b-2 border-black pb-3">
        <div class="flex items-center gap-3">
          <span class={`grid h-10 w-10 place-items-center border-2 border-black ${selectedChannel.tint} shadow-[2px_2px_0px_0px_#000]`}>
            <span class="material-symbols-outlined text-xl">{selectedChannel.icon}</span>
          </span>
          <div>
            <h3 class="text-lg font-black uppercase text-black">{selectedChannel.name}</h3>
            <span class="text-[10px] font-bold text-black/60 uppercase">{selectedChannel.subtitle}</span>
          </div>
        </div>
        <button
          type="button"
          onclick={closeChannelModal}
          class="retro-btn bg-white hover:bg-[#FFAEC1] p-1 h-7 w-7 text-xs font-black flex items-center justify-center cursor-pointer shadow-[2px_2px_0px_0px_#000]"
          aria-label="Fermer la boîte de dialogue"
        >
          ✕
        </button>
      </div>

      <!-- Corps de la modale -->
      <div class="space-y-4 text-xs">
        <div class="border-2 border-black bg-[#FAF9F5] p-3 shadow-[2px_2px_0px_0px_#000] space-y-1">
          <span class="text-[10px] font-black uppercase text-black/50">Compte / Emplacement</span>
          <div class="font-black text-sm text-black flex items-center justify-between">
            <span>{selectedChannel.details.account}</span>
            <span class="retro-badge bg-white text-[9px]">{selectedChannel.group}</span>
          </div>
        </div>

        <div class="space-y-2">
          <div>
            <span class="font-black uppercase text-[10px] text-black/60">Audience cible :</span>
            <p class="text-black/80 mt-0.5">{selectedChannel.details.audience}</p>
          </div>
          <div>
            <span class="font-black uppercase text-[10px] text-black/60">Format optimal de contenu :</span>
            <p class="text-black/80 mt-0.5">{selectedChannel.details.contentType}</p>
          </div>
          <div class="border-l-4 border-black pl-3 py-1 bg-[#F6F4EE]">
            <span class="font-black uppercase text-[10px] text-black">Conseil pratique :</span>
            <p class="text-black/80 text-[11px] mt-0.5">{selectedChannel.details.tip}</p>
          </div>
        </div>
      </div>

      <!-- Actions de la modale -->
      <div class="flex flex-col sm:flex-row gap-2 pt-3 border-t-2 border-black">
        <a
          href={selectedChannel.href}
          target={selectedChannel.isExternal ? "_blank" : undefined}
          rel={selectedChannel.isExternal ? "noreferrer" : undefined}
          class={`retro-btn ${selectedChannel.tint} text-xs font-black py-2.5 px-4 flex-1 flex items-center justify-center gap-2 shadow-[2px_2px_0px_0px_#000]`}
        >
          <span>{selectedChannel.buttonLabel}</span>
          <span class="material-symbols-outlined text-[16px]">
            {selectedChannel.isExternal ? "open_in_new" : "arrow_forward"}
          </span>
        </a>

        {#if selectedChannel.details.hubUrl}
          <a
            href={selectedChannel.details.hubUrl}
            target="_blank"
            rel="noreferrer"
            class="retro-btn bg-white hover:bg-[#86E2D5] text-xs font-black py-2.5 px-3 flex items-center justify-center gap-1 shadow-[2px_2px_0px_0px_#000]"
          >
            <span>{selectedChannel.details.hubLabel || "Console Pro"}</span>
            <span class="material-symbols-outlined text-[15px]">launch</span>
          </a>
        {/if}

        <button
          type="button"
          onclick={closeChannelModal}
          class="retro-btn bg-[#EDE9DF] hover:bg-black hover:text-white text-xs font-black py-2.5 px-4 cursor-pointer shadow-[2px_2px_0px_0px_#000]"
        >
          Fermer
        </button>
      </div>
    </div>
  </div>
{/if}
