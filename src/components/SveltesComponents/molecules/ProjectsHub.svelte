<script lang="ts">
const services = [
  {
    name: "Inventaire",
    description: "Ajouter, modifier et publier les antiquités et pièces de la boutique.",
    href: "/antiquites",
    icon: "inventory_2",
    tint: "bg-[#FFF394]",
    group: "Catalogue"
  },
  {
    name: "Sous-catégories",
    description: "Organiser les catégories et sous-catégories du catalogue.",
    href: "/subcategories",
    icon: "sell",
    tint: "bg-[#FFD2A6]",
    group: "Catalogue"
  },
  {
    name: "Boutiques",
    description: "Gérer les boutiques partenaires et leurs informations.",
    href: "/shops",
    icon: "storefront",
    tint: "bg-[#86E2D5]",
    group: "Ventes"
  },
  {
    name: "Commandes",
    description: "Consulter les achats, paiements et détails de commande.",
    href: "/orders",
    icon: "receipt_long",
    tint: "bg-[#BFD7FE]",
    group: "Ventes"
  },
  {
    name: "Canaux de vente",
    description: "Piloter vos canaux de vente : eBay, Facebook, Instagram, TikTok et Pinterest.",
    href: "/canaux-vente",
    icon: "storefront",
    tint: "bg-[#FFF394]",
    group: "Canaux"
  },
  {
    name: "Livraisons",
    description: "Préparer les expéditions et suivre les livraisons en cours.",
    href: "/Livraison",
    icon: "local_shipping",
    tint: "bg-[#FFAEC1]",
    group: "Ventes"
  },
  {
    name: "Avis clients",
    description: "Modérer et publier les avis de la clientèle.",
    href: "/reviews",
    icon: "reviews",
    tint: "bg-[#FFD166]",
    group: "Relation client"
  },
  {
    name: "Idées & bugs",
    description: "Lire les retours et signalements envoyés par les utilisateurs.",
    href: "/feedback",
    icon: "rate_review",
    tint: "bg-[#FFAEC1]",
    group: "Relation client"
  },
  {
    name: "QR Code & impression",
    description: "Créer les QR codes et préparer les supports imprimables.",
    href: "/qrcode",
    icon: "qr_code_2",
    tint: "bg-[#86E2D5]",
    group: "Outils"
  },
  {
    name: "Médias S3",
    description: "Parcourir et gérer les images et fichiers du stockage cloud.",
    href: "/storage",
    icon: "cloud",
    tint: "bg-[#BFD7FE]",
    group: "Outils"
  }
];
</script>

<section class="space-y-8 font-mono" aria-labelledby="dashboard-title">
  <header class="flex flex-col gap-3 border-b-2 border-black pb-6 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <p class="mb-2 text-xs font-black uppercase tracking-[0.14em] text-black/55">Daisy Brocante · Gestion</p>
      <h1 id="dashboard-title" class="text-3xl font-black uppercase leading-tight tracking-tight text-black sm:text-4xl">Tableau de bord</h1>
      <p class="mt-2 max-w-2xl text-sm leading-relaxed text-black/65">Accédez directement aux outils de gestion de la boutique.</p>
    </div>
    <div class="inline-flex items-center gap-2 self-start border-2 border-black bg-white px-3 py-2 text-xs font-bold shadow-[3px_3px_0px_0px_#000] sm:self-auto">
      <span class="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
      Services en ligne
    </div>
  </header>

  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
    {#each services as service, index}
      <a
        href={service.href}
        class="group flex min-h-48 flex-col border-2 border-black bg-white p-5 shadow-[4px_4px_0px_0px_#000] transition-transform hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#000] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-black"
        aria-label={`Ouvrir ${service.name}`}
      >
        <div class="mb-5 flex items-start justify-between gap-3">
          <span class={`grid h-12 w-12 place-items-center border-2 border-black ${service.tint}`}>
            <span class="material-symbols-outlined text-2xl" aria-hidden="true">{service.icon}</span>
          </span>
          <span class="text-[10px] font-bold uppercase tracking-wider text-black/45">{service.group}</span>
        </div>
        <div class="mt-auto flex items-end justify-between gap-4">
          <div>
            <h2 class="text-lg font-black uppercase leading-tight text-black">{service.name}</h2>
            <p class="mt-2 max-w-sm text-xs leading-relaxed text-black/65">{service.description}</p>
          </div>
          <span class="material-symbols-outlined shrink-0 text-xl transition-transform group-hover:translate-x-1" aria-hidden="true">arrow_forward</span>
        </div>
      </a>
    {/each}
  </div>
</section>
