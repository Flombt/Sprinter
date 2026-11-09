# Module 7 — intégrations Apple

Livraison du 1er novembre 2026. Code développé sous Windows, sans test ni essai sur un compte Santé ou un appareil. Les compilations TypeScript et JavaScript/Hermes ne compilent pas le nouveau code Swift. Aucune application Watch n’a été développée.

## Capacités constatées

Avant modification, Sprinter utilisait Expo SDK 58, React Native 0.88.1 et React 19.3. Le suivi Expo Location/Core Location, les sauvegardes SQLite, la récupération en pause, la carte Apple et l’export GPX existaient. Il n’y avait ni module HealthKit, ni extension ActivityKit, ni transport Watch. Les modules de course, d’analyse, de séances et de progression sont conservés.

`expo-widgets ~58.0.26` et `@expo/ui ~58.0.26` ont été ajoutés avec l’installateur Expo. Le SDK fournit une fabrique de Live Activities et des dispositions SwiftUI pour l’écran verrouillé et la Dynamic Island. Il exige un binaire de développement ou de distribution ; Expo Go n’inclut pas cette bibliothèque. Le composant marqué `widget` s’exécute dans un contexte isolé, sans accès au moteur de course. Voir la [documentation Expo Widgets](https://docs.expo.dev/versions/latest/sdk/widgets/).

HealthKit est fourni par le module Swift local `modules/sprinter-apple`, découvert dans `./modules` par Expo Autolinking. Son pod cible iOS 16.4 au minimum, comme le déploiement par défaut du SDK installé. Le module vérifie également la disponibilité réelle de Santé et des activités en direct au moment de l’utilisation. Aucune API spécifique à un hypothétique numéro de version d’iOS n’a été inventée. Le mécanisme des [modules Expo locaux](https://docs.expo.dev/modules/get-started/) exige lui aussi une reconstruction native.

| Fonction | Expo Go | Binaire iOS avec les modules |
| --- | --- | --- |
| Course et enregistrement au premier plan | Conservés | Conservés |
| GPS écran verrouillé | Indisponible dans ce client | Option séparée de suivi, limites iOS existantes |
| Envoi et lecture Santé | Boutons désactivés avec explication | Module HealthKit après consentement |
| Live Activity et Dynamic Island | Indisponibles | Extension Expo Widgets ; Dynamic Island selon l’appareil |
| Partage GPX / CSV | Feuille de partage locale | Même fonctionnement |
| Apple Watch | Aucun transport | Contrat préparatoire uniquement |

Les éléments de la dernière colonne décrivent le code fourni et ses dépendances ; ils ne constituent pas une validation physique.

## Organisation

- `src/apple/bridge.ts` : disponibilité et frontière native ; aucun chargement de la Live Activity dans Expo Go.
- `modules/sprinter-apple/ios/SprinterAppleModule.swift` : autorisations ciblées, constructeur de workouts, lecture paginée et exclusion de sauvegarde.
- `src/apple/mapping.ts` : validation, conversion fidèle et détection des doublons.
- `src/apple/persistence.ts` : préférences, intentions d’envoi et reçus SQLite séparés du checkpoint GPS.
- `src/apple/store.ts` : file d’opérations, consentements et reprise des envois ; aucune permission demandée au démarrage.
- `src/apple/connect.ts` : observation des activités effectivement sauvegardées, après le commit du moteur.
- `src/apple/live.ts`, `RunLiveActivity.tsx` : contrôleur et dispositions natives minimales.
- `src/apple/wearables.ts` : contrat de transport futur et validation d’événements.
- `src/screens/AppleIntegrations.tsx` : réglages, lecture facultative, import individuel et associations.

Le moteur GPS n’attend pas une opération Santé ou ActivityKit. Les erreurs de ces observateurs sont présentées dans les intégrations et ne remettent pas en cause une course sauvegardée localement.

## Santé : autorisations et écriture

Les commandes de lecture et d’écriture sont distinctes. Les seuls types demandés sont les entraînements et la distance marche/course. Aucune demande de fréquence cardiaque, calories, itinéraires Santé, données cliniques, livraison en arrière-plan ou notifications distantes. L’envoi automatique reste désactivé par défaut et ne déclenche jamais une nouvelle demande de permission.

iOS expose l’état de partage en écriture pour chaque type. Il ne donne pas l’autorisation effective de lecture : le code mémorise qu’une demande a été présentée, sans la transformer en état « lecture accordée ». Une liste vide ne prouve pas un refus. Les réglages Santé permettent de retirer les droits ; désactiver une option Sprinter ne révoque pas ces droits système. Voir [Apple — autorisation d’accès aux données](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data).

L’écriture crée un `HKWorkoutBuilder` de course extérieure, une distance réellement enregistrée et les événements de pause/reprise exacts. Aucun itinéraire, capteur ou dépense énergétique n’est fabriqué. Les métadonnées conservent aussi les temps actif et total. Le temps que le builder déduit des pauses est comparé au temps actif avant la finalisation ; un désaccord annule cette finalisation. Apple précise que le [temps calculé par le builder](https://developer.apple.com/documentation/healthkit/hkworkoutbuilder/elapsedtime(at:)) tient compte des pauses.

Les nouvelles courses disposent d’un journal `clockPauses`, exprimé dans le temps total monotone. Le fonctionnement des deux chronomètres reste inchangé. Les données anciennes sans pauses exactes, les courses récupérées dont le total est estimé, les chronologies incohérentes ou trop décalées de l’horloge civile ne sont pas exportées dans Santé. Les sorties locales et leurs exports restent disponibles. Les petites variations d’arrondi ne sont tolérées que pour les vérifications numériques.

## Synchronisation et doublons

L’identifiant `sprinter.run.v1.<id local>` et la version 1 sont stables pour le workout. L’échantillon de distance possède son propre identifiant dérivé. Le module recherche d’abord un workout de sa propre source portant cet identifiant et partage les écritures simultanées du même identifiant via une tâche native commune. Le mécanisme système de [métadonnées de synchronisation HealthKit](https://developer.apple.com/documentation/healthkit/hkmetadatakeysyncidentifier) complète ce contrôle.

Un reçu local associe une course à un UUID Santé. Avant un envoi automatique, son intention est sauvegardée dans la file SQLite ; après confirmation, le reçu et le retrait de cette intention sont sauvegardés ensemble. Une fermeture entre l’écriture native et le reçu conduit à reprendre avec le même identifiant. Les tentatives reprennent au lancement ou au retour au premier plan si l’option reste active ; aucun polling ni réveil artificiel n’est ajouté. Après échec, l’historique reste utilisable et un envoi manuel peut être relancé depuis le détail.

Le commit de la course et l’inscription dans le journal Apple appartiennent à deux bases séparées : une fermeture exactement entre ces opérations ne peut pas être rendue atomique sans modifier le stockage du moteur. La course reste sauvegardée et peut être envoyée manuellement ; le module ne prétend pas garantir une livraison exactement une fois à travers cette fenêtre. Les identifiants natifs évitent de changer de clé lors d’une reprise.

La lecture utilise une requête ancrée sur les seules courses, par pages de 50. La période reste fixe pendant la pagination. Le curseur est conservé uniquement pendant cette consultation ; une actualisation repart des données actuellement visibles. Désactiver la lecture invalide les réponses en vol et vide la liste en mémoire. Les UUID de suppression mettent à jour cette liste, sans effacer les copies choisies auparavant par la personne.

Avant import, le code cherche un UUID, un reçu ou un identifiant d’origine correspondant. À défaut, des horaires à moins d’une minute, une distance à moins de 20 m ou 1 %, et un temps actif à moins de 10 s ou 1 % signalent un doublon probable. Celui-ci bloque un second import et propose une association explicite, sans remplacer de mesures. Le magasin des courses refait le contrôle avant le commit et sérialise les imports. Une association ne peut pas réutiliser un UUID déjà lié à une autre course encore présente.

## Fidélité des imports et exports

L’import est individuel, facultatif et disponible entre deux courses. Il conserve l’UUID, la source, les dates, la distance et la durée active visibles dans Santé. Les éléments sans distance/durée compatibles restent consultables mais ne sont pas importables. Le temps total provient des dates réelles. Une copie conserve un identifiant déterministe `healthkit:<UUID>` et ne peut pas être réexportée vers Santé.

Le stockage des activités reste en schéma SQLite 2 et enveloppe 3, avec des champs optionnels supplémentaires validés à la lecture. Les anciennes activités n’ont pas à être réécrites. Une cible technique conserve la compatibilité de l’ancien modèle, mais `targetUnavailable` la rend indisponible pour le coach, le bilan et l’affichage. Aucun objectif d’allure n’est attribué à un import Santé. Aucun parcours, altitude, intermédiaire ou record de segment ne lui est inventé. Les agrégations de progression emploient ses vrais compteurs ; les records GPS continuent d’exiger leurs observations fiables.

GPX 1.1 conserve les points qualifiés et les interruptions déjà traités par le moteur d’analyse. CSV UTF-8 ajoute un résumé, la source et, lorsqu’elles existent, les observations qualifiées avec unités explicites et segments séparés. Les cellules textuelles sont protégées contre les formules de tableur ; une absence reste vide. Un import sans GPS peut donc être partagé en CSV. La feuille de partage est toujours déclenchée par la personne, avec avertissement sur les horaires et coordonnées exposés. Le registre d’exporteurs accepte toujours un futur encodeur FIT ; aucun faux FIT n’est proposé.

## Activité en direct

L’activation est facultative et annonce que les mesures seront visibles sans déverrouiller l’iPhone. Le démarrage demande une course active au premier plan et l’autorisation système. Le temps affiché est le temps actif ; les pauses et reprises modifient immédiatement l’état affiché. L’allure n’apparaît que lorsqu’elle est stabilisée et fiable. Le chronomètre utilise le minuteur SwiftUI jusqu’à une date limite ; il ne dépend pas d’un réveil JavaScript chaque seconde.

Les contenus sont regroupés, sérialisés et actualisés au plus une fois toutes les quinze secondes, sauf changement d’état. Le système peut limiter davantage leur rendu. Après 45 secondes sans information, la Live Activity affiche le dernier temps reçu, masque distance et allure courantes et indique une interruption. Les textes de mesures portent le modificateur de confidentialité système. Le tap ouvre la course sans démarrer de GPS ni reprendre une activité récupérée automatiquement.

La fin d’une course, la désactivation ou le démarrage d’une autre course clôturent l’instance existante. Le contrôleur retire les instances résiduelles au lancement ; une course restaurée reste en pause. Une activité fermée par la personne n’est pas recréée à chaque point GPS. Les erreurs entraînent une temporisation ; aucune notification distante n’est configurée. La Dynamic Island propose les présentations compactes, minimale et étendue ; elle dépend du téléphone.

ActivityKit ne crée aucun droit d’exécution en fond. Seules les mises à jour reçues pendant une exécution autorisée de l’application peuvent actualiser le contenu. Une fermeture forcée ne peut pas être contournée. Voir [Apple — Live Activities](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities).

## Confidentialité et publication

Le plugin local active HealthKit et fournit les deux descriptions de permission en français. Le plugin Widgets configure l’extension `app.sprinter.running.ExpoWidgetsTarget`, le groupe `group.app.sprinter.running` et le support des activités en direct. Les notifications distantes et les mises à jour fréquentes par push restent désactivées. Le manifeste du module local déclare l’absence de suivi et de collecte vers un serveur ; les manifestes des dépendances restent propres à celles-ci.

Avant tout accès Santé, le module exclut de la sauvegarde de l’application le répertoire des bases SQLite et le groupe partagé. Cela concerne également les courses et journaux locaux qui partagent ces bases ; l’écran le signale et propose les exports pour leur conservation. Les fichiers de partage sont dans le cache. Les autres dossiers Documents/Application Support ne sont pas exclus arbitrairement. L’import est bloqué si cette protection échoue. Aucun upload de données Santé vers Spotify, publicité ou service d’IA. La synchronisation propre à l’application Santé reste sous le contrôle d’Apple et des réglages du compte.

Avant publication : construire et signer les deux cibles avec une équipe Apple autorisée, enregistrer leurs identifiants et l’App Group, vérifier le rapport des manifestes de toutes les dépendances, fournir une vraie URL publique de confidentialité et les réponses App Store Connect correspondant au binaire final. Le texte de confidentialité est accessible dans l’application, sans URL fictive. Décrire les usages Santé et les modes de fond dans les notes de revue ; ne pas revendiquer une validation médicale. Les règles applicables sont celles d’[Apple App Review, confidentialité et santé](https://developer.apple.com/app-store/review/guidelines/#health-and-health-research). Cette livraison ne constitue pas une approbation App Store.

## Future Apple Watch : faisabilité et frontière préparée

Une application watchOS dédiée est techniquement envisageable avec une cible signée et ses propres autorisations. Un futur `HKWorkoutSession` avec `HKLiveWorkoutBuilder` fournirait une session sportive et les observations cardiaques autorisées sur la montre. Un transport WatchConnectivity pourrait transférer des événements horodatés et des identifiants ; sa connectivité ne doit pas être supposée permanente. Voir [HKWorkoutSession](https://developer.apple.com/documentation/healthkit/hkworkoutsession), [HKLiveWorkoutBuilder](https://developer.apple.com/documentation/healthkit/hkliveworkoutbuilder) et [WatchConnectivity](https://developer.apple.com/documentation/watchconnectivity).

Le contrat `WearableTransport` accepte à terme la fréquence cardiaque et les événements début/pause/reprise/fin. `SessionAuthority` identifie le propriétaire téléphone ou montre, la séance et l’appareil associé. `WearableInbox` filtre les identités erronées, valeurs non finies, séquences anciennes, identifiants répétés et horodatages incompatibles, avec une mémoire bornée. La plage cardiaque est une borne technique de transport, pas une interprétation médicale.

Cette préparation ne démarre aucun capteur ou transport et n’applique aucun événement au moteur. La future implémentation devra choisir une seule autorité pour les commandes et la distance, conserver les mesures avec leur source et précision, gérer les horloges et messages hors ligne, puis partager un identifiant de course et un seul propriétaire d’écriture Santé. Les messages anciens d’une reconnexion doivent passer par un chemin distinct de réconciliation, plutôt que d’être appliqués comme des consignes en direct. Une montre qui enregistre elle-même une activité ne doit pas provoquer une seconde écriture équivalente côté iPhone. Ces décisions et la collecte cardiaque appartiennent à une future livraison.

## Utilisation depuis Windows et limites de validation

`npm start` conserve Expo Go. Pour les intégrations Apple, un **nouveau binaire iOS** est indispensable : le script `npm run build:ios` peut utiliser EAS sur une machine de compilation distante, avec compte Expo, équipe Apple, certificats et appareil configurés. Cette commande n’a pas été lancée. Les dossiers natifs racine restent générés ; le module Swift local est conservé dans le projet. Sur Mac, la génération et la compilation doivent inclure le module local et l’extension. Après installation, utiliser `npm run start:dev` pour le serveur du client de développement.

Aucun test n’a été créé ou exécuté, conformément à la consigne. Aucun build Swift/Xcode, IPA, provisioning, appel HealthKit réel ou rendu physique de Live Activity n’est validé sous Windows. Restent à vérifier sur un iPhone : refus et autorisations partielles/révoquées, durée des pauses dans Santé, reprise après fermeture pendant un envoi, réimport et doublons entre sources, sauvegarde/restauration, lecture partielle et pagination, feuille de partage, verrouillage et Dynamic Island, interruptions/appels/économie d’énergie et limite système des Live Activities. L’autonomie et la continuité du GPS relèvent toujours d’une mesure réelle avec le suivi de fond activé.
