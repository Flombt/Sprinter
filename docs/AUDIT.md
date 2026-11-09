# Audit technique — Module 9

Audit du 1er novembre 2026, depuis Windows. Le projet conserve son architecture React Native / Expo et ses écrans. Les corrections portent sur le moteur, la conservation des données et les intégrations existantes.

**État de livraison : code renforcé et compilations JavaScript réussies ; fonctionnement physique et binaire iOS natif non validés.** La consigne finale « NE FAIS PAS DE TEST » a été appliquée : aucun test créé, modifié ou exécuté, aucun scénario simulé exécuté, aucun essai manuel d’interface ou sur téléphone. Les scénarios demandés sont décrits dans [RECETTE_IPHONE.md](RECETTE_IPHONE.md), sans générateur, jeu de données ou nouvelle suite automatisée.

## Architecture et responsabilités

| Couche | Responsabilité constatée | Interactions et points sensibles |
| --- | --- | --- |
| `src/core/` | Modèles sportifs, horloges, filtre horizontal, auto-pause, altitude, moteur de course, classification d’allure | Calculs indépendants de React et du réseau. Les observations rejetées ne doivent modifier ni distance ni état du filtre. |
| `src/services/location.ts`, `background.ts`, `session.ts` | Adaptateur Expo Location/Core Location, tâche native, cycle Démarrer/Pause/Reprendre/Terminer, checkpoints et publication d’état | Propriétaire du suivi GPS ; identités de session et générations protègent les opérations asynchrones. Le minuteur d’interface ne sert pas à maintenir le processus en fond. |
| `src/storage/` | SQLite, migrations, historique, journal incrémental du brouillon, transaction de fin | Instantané sérialisé avant l’attente d’écriture ; écritures ordonnées et révisions ; aucune dépendance à un serveur. |
| `src/pacing/` | Plages, objectifs par kilomètre, temps final, capital, ETA et journal d’écarts | Mesures fiables et secondes/km ; pas de confusion entre un chiffre d’allure plus petit et une vitesse plus faible. |
| `src/analysis/` | Nettoyage de trace, intermédiaires, statistiques, comparaison, records et exports | Ne reconstruit pas une distance manquante ; distingue temps actif, total et meilleur segment continu. |
| `src/workouts/` | Bibliothèque, éditeur, interpréteur de blocs et répétitions, défis et bilan | Consomme les intervalles sportifs. Une défaite termine le défi, pas l’enregistrement GPS. |
| `src/coaching/`, `workouts/coaching.ts`, `services/alerts.ts`, `audioSession.ts` | Configuration, annonces centralisées, priorités, déduplication, parole/signaux, arbitrage audio | Une seule autorité d’annonces ; aucune commande Spotify utilisée pour faire baisser son volume. |
| `src/spotify/` | Références de playlists, PKCE, SecureStore, Web API, lecture distante et état du lecteur | Facultatif ; requêtes bornées, jetons et générations ; pas de fichier musical téléchargé ou copié. |
| `src/progression/` | Agrégations locales, objectifs, calendrier, plans, journal et chaussures | Données dérivées des activités. Les estimations de préparation ne garantissent aucun résultat. |
| `src/apple/`, `modules/sprinter-apple/`, `plugins/with-sprinter-apple.js` | HealthKit, journal d’envoi/reçus, Live Activity, capteur de cadence, contrats Watch | Observateurs facultatifs. Code Swift et extension nécessitant un binaire reconstruit ; aucun maintien artificiel par ActivityKit. |
| `src/routes/`, `tools/`, `sharing/`, `integrations/` | Favoris, GPX, proximité d’un tracé, météo, métronome, exports privés/publics et contrat Strava | Services externes facultatifs ; aucun suivi public de position ; aucune synchronisation Strava active. |

Le stockage natif est réparti entre des bases locales de course, séances, musique, progression, outils et intégrations Apple. Les bases ont des propriétaires d’écriture et des versions de schéma ; elles ne forment pas une transaction distribuée. Les adaptateurs `.web.ts` servent à l’aperçu web, sans remplacer les capacités iOS. Les abonnements d’écrans et connecteurs disposent de nettoyages ; les services uniques de session/audio vivent pendant le processus. Les cinq lecteurs de signaux sont mis en cache, pas recréés à chaque alerte.

## Fonctionnalités présentes et état réellement vérifiable

« Implémenté » signifie ici que le chemin de code existe et entre dans la compilation. Cela ne signifie pas qu’une course ou une permission réelle a été vérifiée pendant cet audit.

| Domaine | Implémentation conservée | Limite de validation |
| --- | --- | --- |
| GPS / distance | Coordonnées finies et bornées, précision, ancienneté, ordre, vitesse et sauts contrôlés ; filtre horizontal ; ruptures de continuité et acquisition ; altitude exclue de la distance | Par défaut : précision maximale 25 m, ancienneté 10 s, rupture au-delà de 6 s, vitesse plafond technique 12 m/s. Ce plafond n’est pas une allure conseillée. Précision terrain non mesurée. |
| Allures et chronomètres | Temps actif/total monotones distincts ; moyenne sur le temps actif ; fenêtre d’allure de 20 s, minimum 8 s et 12 m ; tolérance, confirmation et hystérésis | Le lissage réduit le bruit mais retarde la réaction ; il peut sous-estimer certains virages. Longue suspension/verrouillage à comparer à un chronomètre indépendant. |
| Pauses | Pause manuelle arrête le GPS ; auto-pause garde le GPS pour détecter la reprise ; pas de distance créditée pendant l’arrêt | Auto-pause : observations précises, 5 s d’arrêt avec vitesse native, 10 s sans, puis mouvement confirmé au moins 2 s. Les temps de confirmation ne sont pas retirés rétroactivement. Une perte GPS ne prouve pas un arrêt. |
| Persistance / récupération | Journal GPS incrémental, checkpoint visé toutes les 5 s au premier plan et après les lots de fond ; fin transactionnelle ; reprise en pause | Dernière fenêtre non écrite potentiellement perdue après arrêt brutal. Aucune garantie d’écriture toutes les 5 s lorsque le système suspend/termine l’app ou que le disque échoue. |
| Statistiques / records | Intermédiaires, allures fiables, vitesse, altitude partielle, temps en cible couvert, écarts, comparaison à distance commune, records 1/5/10 km/semi/marathon | Records limités aux segments continus qualifiés, précision ≤ 15 m, sans raccord de pause/perte GPS ; interpolation entre observations. Un import Santé sans trace ne crée aucun record GPS. |
| Séances / défis | Onze modèles, blocs distance/durée, groupes répétés, cibles adaptables, édition/duplication/persistance, transitions et résultats | Transitions, pauses et résultats non exécutés pendant cet audit. Pas de données inventées pour qualifier un défi en GPS dégradé. |
| Coach / audio | Trois niveaux, annonces d’allure/distance/capital/transitions/résultats, priorités, expiration et anti-répétition ; signaux et métronome coordonnés | Parole limitée au premier plan dans le code actuel ; signaux de fond soumis au contexte natif et aux interruptions iOS. Haptiques écran verrouillé non garantis. |
| Spotify | Import de références sans compte, connexion PKCE, commandes/état du morceau, sérialisation et gestion des erreurs | Client ID, retour HTTPS et compte réel non configurés. La lecture reste celle du client Spotify. Les commandes dépendent de Premium, des scopes, des droits de l’app et d’un appareil actif. |
| Santé | Autorisations minimales entraînement/distance, écriture avec pauses, identifiant stable, reçus/outbox, lecture facultative et import confirmé | Swift non compilé. Aucun accès à Santé réel effectué. Une lecture vide ne permet pas de conclure que l’autorisation de lecture est accordée ou refusée. |
| Live Activity | Chrono, distance, allure, état GPS/pause et Dynamic Island ; cadence d’actualisation limitée ; état périmé ; fermeture utilisateur respectée | Extension non compilée ni signée. Pas de push ou de mécanisme de maintien en fond. Son affichage dépend des autorisations et décisions d’iOS. |
| Hors ligne | Acquisition GPS, calculs, séances, historique, progression, favoris et exports locaux indépendants des services externes | Tuiles de carte, commandes Spotify et météo dépendent de leurs propres ressources réseau/cache. Aucune carte hors ligne téléchargée. |
| Outils / confidentialité | GPX borné, favoris, guidage de proximité, masquage public, CSV/résumé, métronome et cadence native facultative | Guidage de proximité sans virages détaillés. Cadence Core Motion disponible seulement dans un binaire adapté, au premier plan. Météo gratuite branchée uniquement en développement personnel. |

Expo Go ne fournit pas le suivi GPS iOS en arrière-plan ; le projet met la course en pause en quittant le premier plan dans ce mode. Une version de développement incluant les modules et les permissions est nécessaire pour le suivi verrouillé. [Documentation officielle Expo Location](https://docs.expo.dev/versions/latest/sdk/location/).

Le démarrage de lecture Spotify nécessite Premium et `user-modify-playback-state` ; l’API ne garantit pas l’ordre entre des commandes distinctes. La file locale réduit la concurrence sans transformer une commande HTTP acquittée en preuve de lecture physique. [Référence Spotify Start/Resume Playback](https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback).

## Problèmes corrigés

Les défauts ci-dessous sont établis par lecture des chemins de code. Aucune reproduction ni validation comportementale n’a été exécutée.

| Priorité | Défaut observé et risque | Correction et source |
| --- | --- | --- |
| Haute | Le filtre horizontal modifiait sa vitesse prédite avant de refuser un déplacement filtré trop rapide. Une mesure rejetée influençait donc les suivantes. | Calcul local puis engagement simultané position/vitesse après les contrôles, `core/tracking.ts`. |
| Haute | Une exception d’un observateur facultatif pouvait interrompre la publication GPS avant le checkpoint, ou faire remonter un faux échec après une opération déjà enregistrée. | Isolation individuelle des observateurs de session ; avertissement générique une seule fois par observateur, `services/session.ts`. |
| Haute | Des résultats tardifs de contrôle des permissions pouvaient agir après un changement de session ou d’état d’application. Un retour pouvait également créer un minuteur sans course. | Identité du moteur recontrôlée après attente, contrôle du premier plan et démarrage du minuteur uniquement avec un moteur actif dans l’application, `services/session.ts`. |
| Haute | Après échec de lecture du brouillon, un nouveau départ pouvait remplacer l’en-tête et purger les anciens points. | Départ bloqué tant que la récupération a échoué ; sauvegarde préservée, message et nouvelle tentative au prochain lancement. Aucun effacement automatique, `services/session.ts`. |
| Haute | Des sections de séance/coach invalides étaient supprimées du modèle assaini, puis pouvaient être perdues au checkpoint suivant. | Conservation brute dans `unreadableSections`, désactivation de leur interprétation et maintien des données sportives lisibles, `storage/repository.ts`, `core/types.ts`. |
| Haute | Course, bibliothèque et musique pouvaient réécrire une version de schéma plus récente avec leur propre numéro. | Refus avant écriture des bases plus récentes : course > 2, séances/musique > 1. Les autres propriétaires avaient déjà une garde. `storage/repository.ts`, `workouts/persistence.ts`, `spotify/device.ts`. |
| Haute | Un ancien nettoyage de signal pouvait libérer l’activation audio d’un signal plus récent via une référence globale remplacée. | Chaque activation possède sa fonction de libération capturée et idempotente ; les fins de lecture retardées après réinitialisation sont filtrées. `services/cueAudio.ts`, `services/alerts.ts`. |
| Moyenne | Le délai HTTP Spotify cessait à la réception des en-têtes ; un corps de réponse bloqué pouvait immobiliser l’authentification ou les commandes. | Délai de 10 s conservé jusqu’à lecture du corps ; HEAD garde sa réponse et son URL. `spotify/auth.ts`. La suspension iOS peut elle-même différer un minuteur JS. |
| Moyenne | Une restauration de jetons/préférences déjà engagée pouvait rétablir un état après déconnexion ou changement de connexion. | Générations recontrôlées après les lectures asynchrones, `spotify/auth.ts`, `spotify/store.ts`. |
| Moyenne | Après suppression/import Santé confirmé sur disque, une erreur de relecture de l’historique pouvait afficher un échec ou conserver un état mémoire ancien. | État mémoire publié après engagement ; erreur de rafraîchissement distincte ; cache d’analyse purgé à la suppression, `services/session.ts`, `analysis/cache.ts`. |
| Moyenne | Une pause après franchissement de l’objectif dégradait le capital déjà acquis. Un temps total estimé après récupération pouvait produire un capital présenté comme précis. | Capital figé au franchissement ; capital/ETA de l’objectif en temps total indisponibles si la chronologie totale est estimée, `pacing/metrics.ts`, `types.ts`, `components.tsx`. |
| Moyenne | Une Live Activity volontairement en pause finissait par signaler une interruption au bout de 45 s et recevait des mises à jour inutiles. | Absence de date de péremption et d’actualisations répétitives en pause inchangée ; délai conservé quand la course tourne, `apple/live.ts`. |
| Moyenne | Le backend web des outils modifiait son état mémoire avant la réussite de `localStorage.setItem`. Une erreur de quota pouvait être appliquée lors d’une écriture ultérieure. | Publication des nouvelles routes/préférences seulement après stockage réussi, `routes/persistence.web.ts`. |
| Moyenne | Un échec de libération de session audio pouvait empêcher la destruction du lecteur de métronome désactivé. | Destruction dans `finally`, `tools/metronome.ts`. |
| Moyenne | L’export Santé acceptait côté TypeScript une durée que le pont Swift refuse systématiquement. | Borne commune de 72 h avant mise en attente, `apple/mapping.ts`. Les autres contrôles de chronologie restent conservés. |
| Faible | La météo pouvait accepter une position périmée/invalide ou répondre depuis le cache à une consultation déjà annulée. | Contrôle des coordonnées, de la fraîcheur/précision, du signal annulé et du code météo entier, `tools/weather.ts`. |
| Faible | Les textes confondaient arrêt manuel et auto-pause, ou l’absence d’interruption dans le seul temps actif. | Description de permission précisant le GPS pendant l’auto-pause ; récupération précisant temps actif exclu et total estimé, `app.json`, `services/session.ts`. |

Ces changements n’ajoutent ni nouveau service, ni nouvelle interface décorative. Les formats SQLite restent compatibles : schéma course 2, enveloppe d’activité 3 ; `unreadableSections` est un champ facultatif de conservation. Les schémas musique et séances reçoivent leur garde/version 1 sans changement de tables.

## Concurrence, données et ressources : protections et risques restants

- Le GPS est traité de façon synchrone dans le moteur ; les écritures passent par une file avec instantanés, révisions et transactions. Démarrage/fin sont protégés contre les actions simultanées, et les abonnements GPS ont des générations. Une sauvegarde tardive ne doit pas ressusciter une activité terminée. Ces invariants sont présents dans le code ; leur résistance aux interruptions reste à vérifier physiquement.
- La sauvegarde finale est indépendante du réseau et de Santé. Une panne d’export n’annule pas une course enregistrée. En revanche, l’engagement de la course et l’ajout à l’outbox Santé sont dans des bases différentes : un arrêt entre les deux peut omettre l’envoi automatique. L’export manuel de l’historique reste le rattrapage ; identifiant stable et contrôle natif de doublon ne garantissent pas une transaction unique entre ces bases.
- Le brouillon entièrement illisible est conservé et bloque désormais un nouveau départ. Il n’existe pas de réparation automatique ni d’écran d’archivage de cette corruption. Un redémarrage peut résoudre une erreur transitoire ; une corruption durable demande une récupération des bases. Les activités illisibles de l’historique sont comptées et conservées sur disque, sans produire de statistiques fictives.
- La récupération reprend en pause, sans redémarrage GPS silencieux. Le total inclut une estimation de l’intervalle interrompu ; l’actif n’en reçoit pas. Une telle chronologie, ou un ancien journal de pauses insuffisant, n’est pas exportée comme durée HealthKit exacte.
- L’horloge monotone évite les changements d’heure système pendant l’exécution. Le comportement pendant un long sommeil/suspension sur iPhone doit être mesuré : l’utilisation de `performance.now()` et la compilation ne prouvent pas que toutes les secondes de verrouillage sont restituées correctement par chaque version du moteur natif.
- L’historique charge les activités complètes, y compris leurs points. Le cache d’analyse détaillée est limité à six entrées et les records utilisent un `WeakMap`, mais le volume des points conservés dans l’historique croît avec l’usage. Une activité très longue peut aussi monopoliser le thread JS pendant une analyse ; le découpage du travail entre activités n’élimine pas ce coût. Pas de mesure mémoire ni Instruments : aucune absence de fuite ou de blocage n’est certifiée. Pagination/chargement de traces à la demande restent une évolution technique à cadrer si ce profilage le justifie.
- Les abonnements permanents de services uniques et les lecteurs de signaux conservés sont intentionnels. Les ressources capteur/métronome et les abonnements de connecteurs sont arrêtés/nettoyés selon le cycle de vie ; aucune campagne répétée de montage/démontage ni mesure de rétention native n’a été faite.
- Pour la batterie : `Accuracy.Highest`, filtre 2 m (0 m avec auto-pause), lots GPS différés, minuteur d’écran arrêté en fond, Live Activity actualisée au plus toutes les 15 s hors transitions, Spotify interrogé uniquement au premier plan visible avec temporisation. Ce sont des choix de code, pas des résultats de consommation. L’auto-pause maintient volontairement la localisation et peut consommer davantage.

## Permissions, vie privée et réseau

La position exacte est requise pour la mesure sportive ; les refus, services désactivés et précision réduite produisent une erreur explicite. L’autorisation de fond n’est sollicitée que pour le mode prévu. Ni Santé, ni cadence, ni météo, ni musique ne conditionnent l’enregistrement sportif.

Le pont Santé prépare l’exclusion de sauvegarde iCloud du répertoire SQLite et de l’App Group avant les accès Santé. Cela concerne aussi les autres données placées dans ces répertoires : vérifier la conservation/export souhaitée, sans promettre une sauvegarde distante de l’historique. Aucune clé de chiffrement applicative n’est ajoutée ; les protections natives du conteneur dépendent de l’hôte iOS. Aucun contrôle sur appareil du verrouillage et de ces attributs n’a été réalisé.

Les exports publics masquent les zones initiale/finale et leurs revisites, coupent les liaisons traversantes, retirent horaires/identifiants des points et ne reconnectent pas les portions supprimées. Le choix complet reste explicite. Cette réduction de données ne garantit pas l’anonymat. Les partages restent une action utilisateur ; ni position en direct, ni backend social n’existent.

Les services météo/Spotify sont facultatifs ; erreurs réseau et limitations n’interrompent pas le GPS. Le fournisseur météo gratuit est limité au développement dans le code ; aucun fournisseur de distribution n’est configuré. Strava et Apple Watch restent des contrats préparatoires, sans synchronisation ni application montre active.

## Dépendances et configuration native inspectées

Environnement : Node **24.19.0**, npm **11.17.0**, Expo **58.0.22**, React Native **0.88.1**, React **19.3.0**, TypeScript **6.0.3**. `npm ls --depth=0` termine avec succès. Versions clés résolues : Location 58.0.20, SQLite 58.0.15, Audio 58.0.11, Widgets/@expo/ui 58.0.26, fast-xml-parser 5.11.2. Aucune installation ou modification de dépendance appliquée pendant cet audit.

L’inspection `npm audit --omit=dev --json` signale **13 dépendances avec alertes modérées, aucune haute ou critique**, issues de deux avis propagés dans l’arbre Expo. Rapport conservé dans [module9-dependencies.json](../artifacts/module9-dependencies.json). Il s’agit d’un inventaire d’avis, sans essai d’exploitation.

| Dépendance racine de l’avis | Version résolue | Sujet et correction publiée | Décision |
| --- | --- | --- | --- |
| glob | 13.0.6 | Annulation ne bornant pas toujours le travail de parcours de fichiers ; correction 14.0.2. [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4). | Mise à jour compatible à planifier dans la chaîne Expo. |
| minimatch | 10.2.6 | Amplification du travail de traitement de motifs ; correction 11.0.1. [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). | Même décision ; aucune surcharge de version majeure imposée sans validation. |

`npm ls glob minimatch --all` rattache ces versions aux outils CLI/configuration/fingerprint et plugins Expo. Cela ne démontre ni une vulnérabilité exploitable dans le moteur GPS mobile ni une absence d’exposition. Le JSON npm propose notamment des retours vers Expo 51 / Sharing 14 / Splash Screen 55, incompatibles avec la ligne SDK 58 du projet. Aucun `audit fix`, `--force` ou changement majeur forcé n’a été appliqué. La résolution de ces avis reste ouverte avant publication.

`npx expo config --type introspect --json` a résolu les plugins sans générer de projet natif. Extrait conservé dans [module9-native-config.json](../artifacts/module9-native-config.json) : bundle `app.sprinter.running`, HealthKit et App Group `group.app.sprinter.running`, messages Santé/mouvements, Live Activities et cible `ExpoWidgetsTarget`. Les modes effectivement résolus sont **location, audio, fetch**. `fetch` est ajouté par le plugin installé d’Expo Task Manager (`node_modules/expo-task-manager/plugin/build/withTaskManager.js`) ; Sprinter n’enregistre pas de tâche périodique fetch. Ce mode déclaré n’est ni une fonctionnalité de récupération périodique ni une garantie de maintien ; son utilité et les déclarations de distribution restent à revoir lors du build natif.

L’inventaire `npx expo-modules-autolinking search --platform apple --json` repère le module local `sprinter-apple` et Location/SQLite/Widgets. La détection d’un pod et la résolution d’un plugin ne vérifient pas sa compilation, sa liaison, les entitlements signés ou les disponibilités Swift réelles.

## Vérifications réalisées et résultats

| Vérification autorisée | Résultat observé |
| --- | --- |
| `npm run typecheck` | Réussite, aucune erreur TypeScript. |
| `npm run export:ios` | Réussite : bundle Hermes iOS, 1 246 modules, environ 3,4 Mo dans `dist/`. |
| `npx expo export --platform web --output-dir web-build` | Réussite : bundle web, environ 1,4 Mo dans `web-build/`. Pas d’exécution dans un navigateur. |
| `node --check plugins/with-sprinter-apple.js` et `node --check metro.config.js` | Syntaxes JavaScript acceptées. |
| Arbre npm, métadonnées d’autolinking, introspection des plugins | Lecture réussie ; ne constitue pas un build natif. |
| Audit des dépendances | Terminé avec alertes : 13 modérées non résolues ; le code de sortie d’audit signale ces avis, pas une erreur de compilation. |
| Tests unitaires / intégration / parcours simulés / recette manuelle | **Non exécutés et non modifiés, à la demande de l’utilisateur. Aucun résultat réussi/échoué de test à annoncer.** |
| Swift / Xcode / CocoaPods / signature / installation | Non réalisés : outils Apple absents de cet environnement Windows. Aucun prebuild, Doctor, build EAS ou authentification distante lancé. |

Les avertissements Metro `NO_COLOR`/`FORCE_COLOR` n’ont pas empêché les exports. Les 148 tests du Module 1 sont un résultat historique, non relancé, qui ne valide ni cet audit ni les modules ultérieurs. La présence de leurs fichiers ne constitue pas une couverture actuelle vérifiée.

## Conditions restant à lever avant une validation de livraison

1. Construire réellement le client iOS et son extension sur une chaîne Apple (Mac ou EAS), vérifier Swift, liaison, signature et permissions générées ; installer sur iPhone. Aucun résultat de ce type n’est acquis ici.
2. Effectuer les procédures documentées dans [RECETTE_IPHONE.md](RECETTE_IPHONE.md) lorsque les essais seront autorisés : distance mesurée, chrono verrouillé, pauses, rupture GPS, interruptions, données et répétitions.
3. Valider physiquement Santé/ActivityKit/audio/capteurs et la conservation locale ; configurer puis vérifier Spotify sur un compte autorisé si cette fonction est retenue pour la livraison.
4. Résoudre les alertes transitives dans une mise à jour compatible du SDK et revoir les déclarations natives/confidentialité ainsi que le fournisseur météo de distribution.
5. Mesurer mémoire, charge JS et batterie sur historique important et sortie longue avant d’affirmer une autonomie ou une stabilité de production.

La base peut être poursuivie sans refonte graphique. L’audit de code et les compilations seuls ne permettent pas de la déclarer entièrement validée pour une publication iOS.
