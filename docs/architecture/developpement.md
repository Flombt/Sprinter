# Développement et contraintes des clients

[Carte documentaire](../00-INDEX.md) · [Exploitation backend](../backend/exploitation.md) · [Validation](../quality/validation.md)

## Installation et commandes

La référence est [package.json](../../package.json) et son [verrou](../../package-lock.json). La CI utilise Node 24. Sous Windows, exécuter depuis PowerShell ; préfixer par `rtk` dans les sessions qui le demandent.

| Commande | Usage / portée |
|---|---|
| `npm ci` | Installer le verrou sans modifier les versions déclarées |
| `npm start` | Expo Go, LAN ; QR courant du terminal |
| `npm run start:tunnel` | Relais de développement si le LAN est inaccessible |
| `npm run start:dev` | Metro pour un client de développement installé |
| `npm run ios` / `npm run web` | Lancement Expo vers iOS / navigateur ; aucun IPA |
| `npm run qr` | Régénérer le QR réseau ; ne pas supposer le port 8081 toujours libre |
| `npm run lint` / `npm run typecheck` | ESLint sur App/src / TypeScript strict |
| `npm test` / `npm run test:coverage` | Vitest ; seuil de couverture limité à certains fichiers de sync |
| `npm run check` | Lint → types → garde secrets → tests avec couverture |
| `npm run check:secrets` | Garde des sources embarquées ; distincte de Gitleaks sur l’historique |
| `npm run export:ios` | Bundle JavaScript/assets iOS ; aucune compilation Swift |
| `npx expo install --check` | Compatibilité des versions Expo ; peut demander le réseau |
| `npm run format` | Écrit sur le sous-ensemble déclaré ; inutile pour une tâche documentaire |

Si des worktrees résident dans `.verification/`, isoler les tests avec `npx vitest run --exclude '.verification/**'`. Voir [l’incident observé](../quality/validation.md).

## Capacités par client

| Capacité | Expo Go | Client natif normal | Sideload | Web |
|---|---|---|---|---|
| GPS au premier plan | Disponible dans le code | Disponible | Disponible | Adaptateurs navigateur |
| Suivi verrouillé | Non ; pause au passage en fond | Selon permissions et tâche native | Configuré, recette requise | Non |
| Code e-mail Sprinter | Backend requis | Backend requis | Backend requis | Backend requis |
| Apple / Google natifs | Non | Selon plateforme et configuration | Apple désactivé ; Google configurable | Non dans le parcours natif |
| Santé / Live Activity | Non | Modules et droits requis | Désactivés | Non |
| Cadence Core Motion | Non | iOS + permission | Bridge conservé | Non |
| OAuth Spotify | Non | Retour HTTPS requis | Retour HTTPS requis | Pas de connexion native |
| Sync / profil natifs | Selon adaptateurs disponibles, non recettés | Flags et session requis | Flags et session requis | Désactivés |

Sources des gardes : [capabilities.ts](../../src/services/capabilities.ts), [account/env.ts](../../src/account/env.ts), [apple/bridge.ts](../../src/apple/bridge.ts), [cadence.ts](../../src/tools/cadence.ts). Disponibilité du code et recette physique restent distinctes.

## Configuration générée et plateformes

[app.json](../../app.json) déclare permissions, schémas d’URL, plugins et extension Expo Widgets. [app.config.js](../../app.config.js) ajoute Google/Maps si configurés et construit la variante `SPRINTER_SIDELOAD=1`. Les plugins [Apple](../../plugins/with-sprinter-apple.js), [sideload](../../plugins/with-sprinter-sideload.js) et [Android](../../plugins/with-android-queries.js) modifient le projet natif généré ; celui-ci n’est pas la source à éditer.

Expo SDK 58, RN 0.88 et React 19.3 restent alignés. [TypeScript](../../tsconfig.json) étend Expo avec `strict` et `noUncheckedIndexedAccess` ; Deno a sa configuration séparée. Préserver les variantes web et les gardes des API iOS.

[eas.json](../../eas.json) définit development, preview et production. `npm run build:ios` demande un build EAS. Le [workflow IPA](../../.github/workflows/ios-ipa.yml) est manuel : runner `xcode-27`, Node 24, prebuild, pods, puis [packaging](../../scripts/build-unsigned-ipa.sh).

**Toute compilation IPA locale ou distante exige une demande explicite pour la tâche en cours.** Les exemples de commande et les builds passés ne constituent pas cette demande. Pour un paquet existant, voir [INSTALL_IPA](../INSTALL_IPA.md).
