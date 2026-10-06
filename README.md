# Astro Starter Kit: Minimal

```sh
npm create astro@latest -- --template minimal
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
# Central-Portal

## Users

Sous le tableau, la section **Navigation · PostHog** présente huit KPI sur
7 ou 30 jours. Le bouton **Sessions** d'une ligne ouvre les vingt dernières
sessions publiques rattachées à ce compte et un lien vers leur replay.
Les vingt dernières sessions du site, anonymes comprises, sont aussi visibles
sans sélection de compte. **Voir la session** affiche son parcours horodaté
dans Users (200 premières actions), sans nécessiter une connexion PostHog.
La lecture interactive s'intègre par iframe après confirmation explicite du
partage : le lien PostHog est alors accessible à toute personne le possédant.
Il reste actif après fermeture ; le bouton **Arrêter et désactiver le partage**
ou **Désactiver un partage existant** le révoque. Ne pas diffuser ces liens.
Configurer `sharing_configuration:write` sur la clé API et autoriser les
partages dans PostHog. Les erreurs de permission et les replays indisponibles
ne bloquent pas le parcours. Le lien privé PostHog reste disponible.
Les sessions anonymes ne sont pas systématiquement reliées aux comptes.
Les indicateurs couvrent exclusivement le trafic consenti depuis l'installation,
pas l'historique ni l'intégralité des actions privées.
Les paiements initiés ne représentent pas des ventes payées.

Trois graphiques quotidiens sous les cartes affichent visiteurs/sessions,
vues d'articles/ajouts au panier/paiements initiés et favoris/newsletter.
Les courbes SVG sont responsives, sans dépendance supplémentaire, avec légende,
valeurs exactes par date et tableau accessible. Le sélecteur 7/30 jours et
l'actualisation pilotent les trois graphiques. Une erreur quotidienne est
affichée séparément pour préserver les KPI et le tableau Users.
Les dates sont en UTC ; la fenêtre glissante couvre 8/31 dates, avec premier
et dernier jour partiels. Les uniques quotidiens ne doivent pas être additionnés
pour retrouver les uniques de toute la période. Déployer aussi Central-API
pour activer la nouvelle route `/api/users/analytics/daily`.

Aucune clé PostHog n'est nécessaire dans le portail : définir les deux secrets
documentés dans [Central-API](../Central-API/README.md) et le jeton public sur
Daisy Brocante. Les erreurs de configuration et les indisponibilités sont
affichées dans un bloc, sans masquer le tableau des utilisateurs.
Tests : `bun test src/lib/analytics.test.ts src/lib/users.test.ts`.

La carte « Users » du tableau de bord et le menu ouvrent `/users`. Le tableau
affiche les comptes du site, leur email, leur inscription newsletter, les
indicateurs client/vendeur, les articles actifs approuvés et le nombre de
commandes payées ou terminées. Une recherche nom/email et une pagination
permettent d'accéder à tous les comptes sans charger tout Clerk en mémoire.
Les échecs Clerk, les problèmes d'accès et les erreurs serveur sont affichés
avec un bouton de nouvelle tentative, sans inventer de compte ou de statistique.

Déployer aussi Central-API et DaisyBrocante pour le suivi newsletter.
La colonne « Non enregistré » ne prétend pas retrouver les anciennes
inscriptions : l'ancien formulaire ne les persistait pas.
Voir [la configuration API](../Central-API/README.md) pour les clés Clerk et
les règles d'accès administrateur.

Tests : `bun test src/lib/users.test.ts`.

## Connexions des canaux de vente

La page `/canaux-vente` ouvre les pages internes `/ebay`, `/facebook`,
`/instagram`, `/tiktok` et `/pinterest`. Chaque page propose une connexion
OAuth et affiche les échecs dans un bloc d'erreur détaillé.

Configurer `API_URL` (ou `PUBLIC_API_URL`) avec l'adresse de Central-API.
Les identifiants développeur, secrets et URL de retour doivent être configurés
sur Central-API : voir [la configuration OAuth](../Central-API/README.md).
Les pages restent protégées par Clerk. Le retour OAuth doit se faire dans
le même onglet, avec la même session du portail. Après un déploiement de cette
version, relancer les autorisations commencées avec l'ancien flux eBay.

Tests ciblés du traitement des réponses : `bun test src/lib/channel-auth.test.ts`.
Compilation : `npm run build` (ou `bun run --bun build`).

### Préparation des publications

Les pages Facebook, Instagram et TikTok permettent de choisir un article actif
(`status=0`) dans le stock officiel Daisy Brocante (`shop_id=daisy`), de
parcourir toutes les pages de l'inventaire, de choisir plusieurs photos, de rédiger
le texte et de voir un aperçu indicatif. Aucun article vendu ou inactif n'est
proposé. La préparation ne nécessite pas une connexion OAuth au réseau.

Les photos se sélectionnent avec des cases à cocher. Les boutons « Tout
sélectionner » et « Tout désélectionner » permettent de modifier la sélection.
L'aperçu affiche toutes les photos choisies dans l'ordre de l'inventaire.

Le bouton « Enregistrer le brouillon » conserve le texte et les photos dans
le stockage local du navigateur, séparément pour l'utilisateur Clerk,
le réseau et l'article. Choisir à nouveau l'article restaure son brouillon.
Les anciens brouillons à une seule photo restent compatibles. Les photos
supprimées de l'inventaire sont retirées du brouillon avec un avertissement.
Le stockage n'est pas synchronisé entre appareils ; effacer les données du
navigateur supprime ces brouillons. Un avertissement protège les modifications
non enregistrées lors d'un changement d'article ou de la fermeture de la page.

Cette étape ne publie rien sur les réseaux. Le texte peut être copié pour une
publication manuelle. Sur TikTok, il s'agit d'un brouillon de légende avec une
sélection de photos, pas d'une création ou d'un envoi de vidéo.

Tests ciblés : `bun test src/lib/social-publication.test.ts src/lib/channel-auth.test.ts`.
