# Intégrations et capacités externes

[État des fonctionnalités](etat-fonctionnalites.md) · [Clients et plateformes](../architecture/developpement.md)

## Apple Santé et Live Activity

[bridge.ts](../../src/apple/bridge.ts) charge le module optionnel sur iOS hors Expo Go et sideload. [SprinterAppleModule.swift](../../modules/sprinter-apple/ios/SprinterAppleModule.swift) porte HealthKit et la protection d’emplacements locaux ciblés. [store.ts](../../src/apple/store.ts), [mapping.ts](../../src/apple/mapping.ts), [recovery.ts](../../src/apple/recovery.ts) gèrent permissions distinctes, mapping, envois reprenables, import individuel et doublons.

[live.ts](../../src/apple/live.ts), [RunLiveActivity.tsx](../../src/apple/RunLiveActivity.tsx), [connect.ts](../../src/apple/connect.ts) pilotent Expo Widgets/ActivityKit. Une Live Activity affiche l’état ; elle ne remplace pas la permission GPS de fond. Le sideload désactive Santé, App Group, connexion Apple et extension dans [app.config.js](../../app.config.js).

Le Swift et l’extension exigent compilation et droits Apple compatibles. Un bundle JS, un build sideload ou [health-recovery.test.ts](../../tests/health-recovery.test.ts) ne valide pas HealthKit dans le client normal.

## Spotify

[links.ts](../../src/spotify/links.ts) valide les références officielles ; [store.ts](../../src/spotify/store.ts) conserve choix et préférences. L’import d’un lien ne demande pas de compte Spotify ; le compte Sprinter reste obligatoire.

[auth.ts](../../src/spotify/auth.ts) et [device.ts](../../src/spotify/device.ts) implémentent Code + PKCE sans secret client embarqué, dans un client natif installé. La [page HTTPS](../../integrations/spotify-callback/README.md) relaie vers `app.sprinter.running://spotify-callback` ; Client ID public et URI HTTPS exacte se règlent dans l’interface. Domaine effectif et compte réel non vérifiés ici.

[api.ts](../../src/spotify/api.ts) gère bibliothèque, morceaux paginés, état et commandes. Refus de droits, scopes absents, absence d’appareil et quotas restent des états normaux. Le code vérifie commandes et informations d’abonnement ; une connexion réussie ne garantit pas la lecture. Spotify joue l’audio, sans téléchargement musical Sprinter. [Attribution](../../assets/spotify/ATTRIBUTION.md).

Tests simulés : [links](../../tests/spotify-links.test.ts), [store](../../tests/spotify-store.test.ts), [auth/API](../../tests/spotify-auth-api.test.ts). Revérifier les conditions du fournisseur avant une évolution de l’intégration.

## Métronome, cadence et météo

- [metronome.ts](../../src/tools/metronome.ts) joue une boucle native et partage [audioSession.ts](../../src/services/audioSession.ts) avec le coach. Tempo, casque, appels et volume nécessitent une recette matérielle.
- [cadence.ts](../../src/tools/cadence.ts) et [SprinterCadenceModule.swift](../../modules/sprinter-apple/ios/SprinterCadenceModule.swift) lisent Core Motion au premier plan avec permission dédiée. Aucune cadence n’est inventée depuis le GPS.
- [weather.ts](../../src/tools/weather.ts) demande une position sur action, l’arrondit pour Open-Meteo et conserve l’attribution. L’adaptateur est borné à `__DEV__` ; `configuredWeatherProvider` est null en distribution. Aucun fournisseur de production n’est branché.

## Contrats préparatoires

[strava.ts](../../src/integrations/strava.ts) prépare un document et un contrat d’adaptateur avec choix explicite récent et copie complète horodatée. Aucun OAuth, upload ou transport Strava n’est implémenté.

[wearables.ts](../../src/apple/wearables.ts) valide identité et ordre d’événements hypothétiques. Aucune app watchOS, session WatchConnectivity ou mesure Watch active n’existe. Ces contrats ne sont pas des intégrations livrées.

Voir [recette iPhone](../quality/recette-course-iphone.md) et [priorités](../roadmap/priorites.md) pour les validations manquantes.
