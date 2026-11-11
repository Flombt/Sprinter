# Sprinter

Application iPhone de running en français, développée **sous Windows avec React Native et Expo**, conformément au choix Expo Go. Ce projet remplace l’amorce SwiftUI initiale. Il ne contient pas de faux parcours ni d’activités de démonstration.

## Ouvrir sur votre iPhone maintenant

1. Installer **Expo Go** depuis l’App Store.
2. Connecter le PC et l’iPhone au même Wi-Fi.
3. Dans ce dossier, lancer `npm start` si le serveur n’est plus actif.
4. Scanner le QR du terminal avec l’appareil photo de l’iPhone. Le serveur déjà lancé utilise le port **8081**.

Le QR enregistré dans `artifacts/expo-go.png` correspond à l’adresse indiquée dans `artifacts/expo-url.txt`. L’adresse peut changer après un changement de réseau : `npm run qr` le régénère. Le QR du terminal Expo est la référence si un autre port est utilisé.

Si le réseau local bloque la connexion : `npm run start:tunnel`. Cette option demande le téléchargement du composant de tunnel Expo et utilise un relais de développement externe. Les données de course restent locales à l’application.

Le projet utilise **Expo SDK 58**, React Native 0.88 et React 19.3, alignés sur le client Expo Go SDK 58 signalé dans le journal de connexion de l’iPhone. Le verrou `package-lock.json` et les overrides React/React Native préservent cette compatibilité. Le SDK du projet et celui d’Expo Go doivent correspondre ; ne pas mettre à jour les bibliothèques natives séparément.

## Interface actuelle et état du projet

Trois onglets : **Stats · Courir · Spotify**. La nouvelle identité associe carbone, craie et orange, une typographie sportive, des cartes compactes et une navigation en verre sur iOS compatible. Les thèmes clair, sombre et système sont disponibles.

- **Courir** : départ avec compte à rebours, accès à la préparation, pause/reprise et historique.
- **Stats** : données en direct, cible du bloc courant, vibrations et audio ; carte, séance, navigation et outils de rythme accessibles.
- **Spotify** : importer un lien ou choisir une playlist, consulter ses morceaux et utiliser le lecteur si le compte le permet.

Les séances, défis, objectifs avancés, chaussures et parcours se règlent depuis la préparation. L’historique donne accès aux records, à la comparaison et au calendrier. Les sauvegardes de récupération sont accessibles dans les réglages.

Le départ simple utilise une [allure précise sans marge](docs/ALLURE_PRECISE.md), par défaut 5′00″/km : 4′58″ est trop rapide et 5′02″ trop lent. Les plages restent disponibles dans les options avancées.

**Dernière vérification, 11 novembre 2026 : 164 tests réussis, TypeScript et exports iOS/web réussis.** Le client natif signé et la recette physique sur iPhone restent à réaliser. Le workflow GitHub est ajouté localement et attend sa première exécution distante.

[Audit des 64 fiches GitHub](docs/AUDIT_2026-11-11.md) · [Travail réalisé et prochaines priorités](docs/STABILISATION_2026-11-11.md) · [Identité et navigation](docs/INTERFACE.md).

Pour l’aperçu compilé : servir le dossier .expo/performance-export sur le port 8082. Pour le téléphone : lancer npm start (Expo Go, premier plan) ou npm run start:dev avec un client natif reconstruit.

## Comptes rendus antérieurs

Les sections suivantes décrivent les étapes précédentes. Le bilan du 11 novembre ci-dessus est la référence pour l’interface, les dépendances et les vérifications actuelles.

## Audit technique — Module 9

L’audit conserve l’architecture et le design. Il corrige notamment la contamination du filtre par une mesure GPS rejetée, les réponses de permission tardives, les observateurs capables d’interrompre un checkpoint, l’écrasement d’un brouillon illisible, les rétrogradations de schéma, les libérations audio concurrentes et plusieurs incohérences de capital, de stockage et de Live Activity.

Les compilations TypeScript, iOS Hermes et web réussissent sous Windows. **Aucun test créé, modifié ou exécuté**, conformément à votre consigne. Le Swift, la signature et le fonctionnement physique restent à valider ; l’export iOS n’est pas un IPA. L’inspection des dépendances relève 13 alertes modérées transitives non résolues, sans mise à jour incompatible imposée.

Le [compte rendu technique](docs/AUDIT.md) distingue implémentation, corrections, résultats de compilation et limites. La [procédure iPhone](docs/RECETTE_IPHONE.md) décrit les scénarios 5 km, 10 × 400 m, pauses, perte GPS, reprise et interruption, sans les avoir exécutés. Les résultats historiques du Module 1 ne valent pas validation de l’état actuel.

## Outils de course — Module 8

Depuis les **Réglages**, la préparation et le détail d’une sortie : favoris locaux, import GPX avec aperçu, reprise d’un itinéraire et avertissement d’écart confirmé. Le métronome configurable utilise une boucle audio native, suspendue pour les annonces du coach. La cadence Core Motion, facultative, est affichée séparément et nécessite un nouveau binaire iOS.

Le détail propose le résumé sans position, les données GPX/CSV et un CSV de statistiques sans positions. Le partage choisit initialement une **copie publique masquant 300 m autour du départ et de l’arrivée**, y compris les retours dans ces zones ; rayon modifiable et copie complète disponibles explicitement. Aucun partage de position en direct ni réseau social.

La météo Open-Meteo est consultée seulement sur demande, avec zone approximative et attribution, pour l’usage personnel en développement. Le bundle distribué exige un service autorisé pour son usage. Strava possède un contrat préparatoire ; aucun compte, OAuth ou envoi n’est actif. Voir [docs/TOOLS.md](docs/TOOLS.md) pour les sources, permissions, limites et points restant à vérifier sur iPhone. **Aucun test créé ni exécuté pour ce module.**

## Intégrations Apple — Module 7

Les réglages proposent désormais **Apple Santé, écran verrouillé et confidentialité** : permissions distinctes de lecture/écriture, envoi des courses compatibles, reprise des envois interrompus, import individuel avec contrôle des doublons et Live Activity avec présentations Dynamic Island. Un export CSV complète le GPX dans le détail des sorties. Une interface de transport prépare une future montre, sans application Apple Watch.

**Santé et les Live Activities nécessitent un nouveau binaire iOS installé.** Expo Go conserve les courses et exports, avec ces intégrations natives désactivées. Leur code Swift et leur extension ne sont pas compilés par le bundle JavaScript produit sous Windows. La version native exclut les bases d’activités et journaux des sauvegardes iCloud de l’application ; les exports permettent leur conservation explicite. Le détail technique, les permissions, la confidentialité, la préparation Watch et les limites figurent dans [docs/APPLE.md](docs/APPLE.md).

**Aucun test créé ou exécuté pour ce module.** TypeScript et bundle iOS Hermes vérifiés sous Windows ; compilation Xcode/signature et fonctionnement physique restant à vérifier. Après construction et installation d’un client de développement, utiliser `npm run start:dev`. `npm start` continue d’ouvrir Expo Go.

## Spotify

L’onglet **Musique** permet d’importer une référence de playlist, de la mémoriser et de la choisir pendant la préparation. Un mini-lecteur est intégré à la course. L’ouverture de Spotify depuis un suivi au premier plan avertit que la course sera mise en pause ; ouvrir sa musique avant de partir est le parcours conseillé dans Expo Go.

L’importation des liens fonctionne sans Client ID. La connexion OAuth PKCE et les commandes Web API sont implémentées pour une **version de développement installée**, avec un Client ID, une page de retour HTTPS à configurer et un appareil Spotify actif. La page à héberger est fournie dans `integrations/spotify-callback/`. Aucun Client ID ni domaine n’a été fourni, donc la connexion et la lecture sur un vrai compte ne sont pas validées. Aucun client secret n’est utilisé. App Remote natif n’est pas intégré à Expo Go.

La lecture est assurée par Spotify. Les commandes Web API nécessitent Premium et les droits appropriés ; les commandes non disponibles restent désactivées. La musique n’est jamais une condition au démarrage ou à la poursuite d’une course. La configuration, les restrictions 2026 et les validations restantes sont détaillées dans [docs/SPOTIFY.md](docs/SPOTIFY.md).

## Ce qui fonctionne dans le projet

- Accueil, préparation d’une course, séance en direct, historique, résumé détaillé et réglages.
- Plage d’allure précise à la seconde ; distances libre, 5 km, 10 km, semi et personnalisée. L’estimation d’arrivée apparaît seulement avec une distance.
- GPS réel avec contrôles de précision, vieillissement, ordre chronologique et déplacements incohérents.
- Distance filtrée, temps actif et temps total monotones distincts, allure courante stabilisée et moyenne, progression, pause/reprise et confirmation de fin.
- Pause automatique facultative aux arrêts avec reprise confirmée ; altitude et dénivelé estimés seulement sur les mesures verticales fiables, couverture indiquée.
- Coach autonome : confirmation initiale de 10 secondes, répétitions espacées de 30 secondes, hystérésis d’entrée de 3 s/km, retour au silence dès que la plage est retrouvée. Ces réglages sont modifiables pour les prochaines séances.
- Au premier plan : deux impacts haptiques courts pour ralentir ; une vibration système unique pour accélérer. Deux fichiers audio PCM originaux et distincts, activables séparément.
- SQLite local, journal incrémental de points, checkpoints visés toutes les cinq secondes au premier plan et après chaque lot GPS de fond, enregistrement final transactionnel, reprise d’une activité interrompue **en pause**, protection contre les sauvegardes tardives.
- Carte Apple sur iPhone avec des segments séparés pour les pauses et les pertes GPS ; graphique des seules allures fiables ; intermédiaires kilométriques interpolés et dernier tronçon partiel.
- Pourcentage de temps en cible calculé avec des durées fiables, accompagné de la durée couverte. Les bornes exactes de la cible servent aux statistiques, sans l’hystérésis des alertes.
- Modes sombre, clair et système ; polices système, libellés accessibles, commandes d’au moins 44 points et respect de Réduire les animations / Réduire la transparence. Liquid Glass natif sur la navigation quand l’API est disponible, avec repli visuel.

## Séances & Défis

L’onglet **Séances** propose onze modèles configurables et un créateur de blocs de distance, de durée ou de temps consécutif en cible, avec groupes répétés et sauvegarde locale. La sélection est accessible également depuis la préparation. Le suivi en direct affiche le bloc, la répétition, la cible et le budget de survie ; abandonner les objectifs laisse la course GPS continuer.

Le bilan conserve le plan et les segments réalisés, les temps et allures des répétitions, les écarts, la couverture des mesures et le résultat motivé du défi. Les records comparent uniquement des configurations identiques et validées. Le fantôme utilise une course réelle ; aucun parcours n’est simulé. Les annonces vocales sont facultatives et distinctes de Spotify. Voir [docs/WORKOUTS.md](docs/WORKOUTS.md).

La livraison initiale de cet ajout avait été réalisée sans tests à la demande de l’utilisateur. Le Module 1 ajoute maintenant des tests d’intégration entre séances et suivi ; cela ne constitue pas une couverture complète de chaque défi ou de l’éditeur.

## Module 1 — suivi de course fiabilisé

L’adaptateur de localisation, la session et les calculs sont séparés. Le filtre réduit la dérive GPS et traite les virages, callbacks anciens et interruptions. L’auto-pause se règle dans la préparation ou les réglages ; le temps actif et les objectifs sont alors suspendus, tandis que le GPS attend un mouvement confirmé. La pause manuelle arrête le GPS.

Le bilan distingue temps actif, temps total, pauses et dénivelés partiels. Après récupération, le temps d’interruption est ajouté uniquement au total comme estimation signalée. Les anciens historiques restent lisibles. Le journal SQLite ajoute les nouveaux points au lieu de réécrire tout le parcours à chaque checkpoint.

**Vérifications réalisées : TypeScript, 148 tests réussis, bundle iOS Hermes généré.** Les mesures de précision, d’autonomie et le suivi verrouillé restent à vérifier sur iPhone. Voir [docs/TRACKING.md](docs/TRACKING.md).

## Module 2 — coach d’allure intelligent

La préparation propose une plage fixe, un temps final avec distance, ou des plages par kilomètre. L’objectif chronométrique peut utiliser le temps actif ou le temps total, pauses incluses. Le suivi affiche l’arrivée estimée, l’avance ou le retard et le **capital de temps**. Le bilan conserve les écarts d’allure avec leur durée et leur contexte.

Le coach sépare classification, tolérance, hystérésis, confirmation et espacement. Le pourcentage en cible conserve les plages exactes. Les cibles, calculs et journaux sont indépendants des interfaces et des sorties audio. Les estimations sont suspendues lorsque le GPS ne permet pas une comparaison fiable. Voir [docs/PACING.md](docs/PACING.md).

**Aucun test créé, modifié ou exécuté pour le Module 2**, conformément à sa dernière consigne. Seules la compilation TypeScript et la génération du bundle iOS ont été effectuées avec succès. Les 148 tests mentionnés pour le Module 1 sont ceux de la livraison précédente et n’ont pas été relancés.

## Module 3 — statistiques et historique sportif

L’historique donne accès aux records personnels et à la comparaison de deux sorties. Le bilan partage un moteur d’analyse indépendant des écrans : carte Apple avec ruptures GPS, temps intermédiaires actif/total, allures fiables extrêmes et moyenne, graphiques d’allure, de vitesse et d’altitude lorsque les données existent, pourcentage en cible et durée des écarts. Les mesures absentes restent indisponibles.

Les records sur 1 km, 5 km, 10 km, semi-marathon et marathon recherchent le meilleur segment continu réellement mesuré, sans traverser les pauses ni les pertes GPS. La comparaison porte sur la distance réelle de la plus courte des deux sorties, avec un écart de distance maximal de 5 %, sans extrapolation. Le bouton GPX du bilan ouvre la feuille de partage iPhone. L’architecture accepte de futurs exporteurs binaires ; FIT n’est pas encore implémenté.

Les activités anciennes restent lisibles par migration de leur enveloppe JSON ; les nouvelles conservent des métadonnées de qualité et de continuité supplémentaires. Aucun parcours artificiel n’a été ajouté. Voir [docs/ANALYTICS.md](docs/ANALYTICS.md) pour les conventions, les critères de fiabilité et les limites.

**Aucun test créé, modifié ou exécuté pour le Module 3**, conformément à sa dernière consigne. Compilation TypeScript et bundle iOS Hermes réussis sous Windows. La carte, le partage GPX et l’exactitude sur parcours mesurés restent à vérifier sur un iPhone physique.

## Module 4 — séances et défis interactifs

Les dix entraînements demandés sont proposés, avec le fantôme historique conservé en supplément. Les ajouts comprennent le fractionné 5 × 1 000 m, un défi fondé sur un véritable record GPS du Module 3 et un défi régularité avec score pondéré par le temps. Les distances, durées, répétitions, récupérations, cibles, tolérances et conditions restent configurables. L’éditeur ajoute la duplication de blocs et un décalage global des allures.

La bibliothèque permet d’enregistrer, modifier, supprimer, dupliquer et choisir à nouveau une séance. Le moteur conserve les transitions automatiques et le GPS continue après une défaite. Le bilan détaille effort, récupération, respect des cibles et résultat de chaque répétition. Les données manquantes empêchent la qualification d’un défi ; elles ne créent pas un score fictif. Voir [docs/WORKOUTS.md](docs/WORKOUTS.md).

**Aucun test créé, modifié ou exécuté pour le Module 4**, conformément à sa dernière consigne. Compilation TypeScript et bundle iOS réussis sous Windows ; les transitions, la précision et les annonces restent à vérifier sur iPhone.

## Module 5 — coach audio et Spotify

Réglages propose les niveaux **Discret, Normal et Complet**, puis l’activation, l’intervalle et la priorité de chaque catégorie d’annonce. Le coach peut annoncer allure, retour stable en cible, kilomètres, avance/retard, répétitions, récupération proche et résultats. Une seule file gère les doublons, contradictions et messages périmés. Les haptiques restent soumis aux capacités iOS ; aucune vibration personnalisée écran verrouillé n’est annoncée comme validée.

Spotify conserve PKCE, les playlists et les commandes officielles, avec contrôle des permissions, réautorisation et attente progressive après perte réseau. La configuration ajoute une page de retour HTTPS conforme aux règles Web API, fournie avec son guide d’hébergement. Le coach utilise le mélange audio prévu par les API sans commander pause/lecture à Spotify. Voir [docs/AUDIO.md](docs/AUDIO.md).

**Aucun test créé, modifié ou exécuté pour le Module 5.** Seules les compilations TypeScript et du bundle iOS ont été effectuées. Audio réel, Bluetooth, haptiques, OAuth et compte Spotify restent à vérifier sur iPhone après configuration. Aucun hébergement n’a été déployé.

## Module 6 — progression et suivi personnel

Depuis Courir ou Sorties, **Progression et calendrier** donne accès aux kilomètres hebdomadaires/mensuels, temps actif et total, fréquence, semaines actives, jours sans course enregistrée, objectifs hebdomadaires et comparaisons de périodes. L’historique des records GPS montre chaque nouvelle marque et son gain réel. Le bilan de chaque course commente automatiquement son respect de cible et ses records, sans IA externe.

Le calendrier réunit activités passées, séances futures et repos prévus. Il permet d’associer les séances de la bibliothèque, de personnaliser leurs blocs avec l’éditeur existant, de les déplacer ou de les préparer pour la course. Les plans 5 km, 10 km et semi sont personnalisables, avec volume et plafond choisis par le coureur, allure libre et progression nulle par défaut. Aucune performance future n’est promise.

Le journal après course conserve sensations, difficulté et notes. Les chaussures peuvent être attribuées avant le départ ou dans une ancienne activité ; leur kilométrage distingue distance enregistrée et valeur initiale déclarée. Tout reste local dans SQLite, avec associations séparées des observations GPS. Voir [docs/PROGRESSION.md](docs/PROGRESSION.md).

**Aucun test créé, modifié ou exécuté pour le Module 6.** Compilations TypeScript et du bundle iOS réussies sous Windows. Les calculs et interactions restent à vérifier sur iPhone.

## Limite déterminante d’Expo Go

**Expo Go sur iOS ne permet pas la localisation en arrière-plan.** Dans ce mode, Sprinter maintient l’écran de course allumé et met la séance en pause quand l’application passe en arrière-plan. Aucun trajet ni temps absent n’est inventé. Revenir dans l’application puis toucher Reprendre.

Le mode « Courir écran verrouillé » reste désactivé dans Expo Go. Une version installée issue d’un **development build** est nécessaire pour ce mode. Le projet contient la tâche `expo-task-manager`, l’implémentation GPS d’arrière-plan et les modes iOS `location` et `audio` pour cette version ; leur comportement reste à valider sur un véritable iPhone.

Les vibrations ne constituent pas une garantie en arrière-plan, même dans cette version. Le mécanisme prévu est l’audio explicite, sans boucle sonore silencieuse ni contournement des règles iOS. Les contrôles de volume, interruptions, Bluetooth et restrictions du système doivent être testés physiquement. Voir [docs/FAISABILITE.md](docs/FAISABILITE.md).

## Commandes Windows

Prérequis : Node **24 LTS** et npm. Node 24 permet aussi d’exécuter les tests SQLite avec le module intégré `node:sqlite`.

```powershell
npm ci
npm start
```

```powershell
npm run typecheck       # Compilation TypeScript sans émission
npm run check           # TypeScript + tests unitaires et SQLite
npm run export:ios     # Bundle Hermes iOS, réalisable sous Windows
npm run web            # Aperçu navigateur, distinct d’une validation iOS
```

Le bundle `dist/` est du JavaScript compilé pour le client iOS. Ce n’est pas un fichier `.ipa` signé. Expo Go charge le bundle depuis Metro ; l’installation d’Expo Go fournit déjà l’hôte natif.

## Construire une version installée depuis Windows

EAS peut compiler iOS sur ses Mac distants. Un compte Expo et les droits de signature Apple appropriés sont nécessaires ; aucune compilation distante ni authentification n’a été effectuée ici.

```powershell
npx eas-cli@latest login
npx eas-cli@latest build:configure
npm run build:ios
```

Installer la version de développement sur l’iPhone, puis lancer `npx expo start --dev-client`. Activer « Courir écran verrouillé » entre deux séances et accepter la permission nécessaire seulement pour ce mode. Les permissions restent accordées après une course, mais le service de localisation s’arrête en pause et en fin de séance.

Les activités en direct ActivityKit / Dynamic Island sont préparées pour une version iOS reconstruite, et restent indisponibles dans Expo Go. Elles ne maintiennent aucun processus en arrière-plan. Le suivi s’arrête si iOS termine le processus ou si l’utilisateur force la fermeture. Au prochain lancement, le dernier checkpoint est proposé en pause.

## Organisation

```text
src/core/       Modèles, temps, filtrage GPS, auto-pause, altitude, coach, statistiques
src/pacing/     Objectifs chronométriques, cibles kilométriques, capital et écarts
src/analysis/   Analyse des activités, intermédiaires, records, comparaison et export GPX
src/apple/      Santé, journal de synchronisation, Live Activity et contrat Watch futur
src/routes/     Favoris locaux, import GPX, géométrie et proximité à un tracé
src/tools/      Métronome, source de cadence, météo et observation de la course
src/sharing/    Copies publiques/privées, masquage, résumé et statistiques
src/integrations/ Contrat de synchronisation Strava futur, sans transport actif
modules/        Module Swift HealthKit local, conservé lors de la génération native
src/coaching/   Niveaux du coach, règles d’annonces, progression et réglages
src/progression/ Périodes, calendrier, objectifs, plans, journal, chaussures et bilan
src/services/  Adaptateur Core Location via Expo, session, signaux, tâche de fond, partage
src/spotify/   OAuth, jetons sécurisés, Web API, références, lecteur et état musical
src/workouts/  Séances, défis, interpréteur, coaching, bibliothèque et records
src/storage/   SQLite et transactions ; localStorage pour l’aperçu web uniquement
src/screens/   Écrans de course, musique, bibliothèque et créateur de séances
src/ui/        Identité, composants accessibles, carte et graphique
tests/         Moteur, coach, SQL réel, cycle de vie, Spotify et session audio
docs/          Faisabilité et protocole de validation physique
```

## État de validation

Les tests réellement exécutés et les contrôles restant à effectuer figurent dans [docs/VALIDATION.md](docs/VALIDATION.md). La réussite des tests simulés et la génération du bundle ne prouvent pas un comportement physique sur iPhone.

Le GPS fonctionne sans Internet. Les fonds de carte dépendent des tuiles disponibles sur l’appareil ; cette application ne télécharge pas de cartes hors ligne. Le stockage n’est pas chiffré par une clé gérée par l’application : il bénéficie du bac à sable et de la protection de données iOS du client hôte. Dans Expo Go, effacer les données du projet ou désinstaller le client peut effacer l’historique. La carte demande des tuiles à son fournisseur ; les coordonnées ne sont envoyées à aucun serveur applicatif Sprinter.
