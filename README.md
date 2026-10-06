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

La carte **PostHog** du tableau de bord et le menu ouvrent `/posthog`, une page
dédiée avec un lien vers le dashboard privé du projet Europe `295747` dans un
nouvel onglet. Ce bloc n'est plus dans Users. Les KPI, graphiques, parcours et relectures
intégrés ont été retirés ; le portail ne fait plus de requêtes analytiques
ni n'active de liens de partage. Une connexion PostHog avec accès au projet
reste nécessaire. Aucune clé PostHog n'est requise dans le portail.

Les partages activés auparavant ne sont pas automatiquement révoqués :
les désactiver dans PostHog s'ils ne sont plus nécessaires.
Le suivi des visiteurs et des erreurs reste configuré sur
[Daisy Brocante](../Daisy_Brocanye_V2/README.md).

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

## Logs serveur PostHog (OpenTelemetry)

Définir `POSTHOG_LOGS_TOKEN` côté serveur au runtime : le jeton de projet
`phc_…` du projet Europe `295747`, pas une clé personnelle `phx_…`.
Sans jeton ou avec un format invalide, les logs distants sont désactivés avec
un avertissement explicite ; le site reste disponible.

Les packages OpenTelemetry Node exportent vers
`https://eu.i.posthog.com/i/v1/logs` avec authentification Bearer.
Le service est nommé `central-portal` (`daisy-storefront` sur Daisy Brocante).
L'initialisation intervient à la première requête et émet un log de démarrage.
Chaque requête traitée par Astro produit un log INFO, WARN (4xx) ou ERROR (5xx),
avec méthode, modèle de route, statut et durée. Les exceptions non interceptées
sont journalisées puis relancées sans modifier la réponse ni le flux Clerk.

Aucun email, identifiant utilisateur, IP, cookie, header, corps, URL complète,
paramètre de requête ou message brut d'exception n'est envoyé.
Ce sont des logs techniques serveur, indépendants du consentement navigateur.
Les fichiers statiques servis hors Astro et les `console.log/error` arbitraires
ne sont pas capturés. Ni traces ni métriques automatiques ne sont activées.
Les services restent indépendants : chaque dépôt embarque son middleware.

Envoi par lots toutes les secondes, file bornée à 2048 logs, export limité à
5 secondes. Les erreurs d'export sont signalées dans la console serveur.
La file est vidée à l'arrêt normal/SIGTERM/SIGINT ; SIGKILL et les interruptions
brutales peuvent perdre les derniers logs. Configurer la rétention dans PostHog.
Après déploiement, ouvrir une page puis consulter **Logs** dans PostHog et filtrer
sur `service.name = central-portal`. Aucun secret n'est nécessaire côté navigateur.
Tests : `bun test src/lib/server-logs.test.ts` (collecteur OTLP local uniquement).

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
