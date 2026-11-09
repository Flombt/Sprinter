# Module 1 — Fiabilisation du suivi de course

Livraison du 1er novembre 2026. Le projet reste une application iPhone React Native / Expo SDK 58 développée sous Windows. La couche iOS d’Expo Location utilise Core Location ; aucun second service GPS ni nouvelle application SwiftUI n’a été ajouté. Les composants visuels existants sont conservés.

## Analyse du projet existant

L’inspection a couvert les moteurs sportifs et de séances, les services de localisation et d’alertes, les stockages natif/web, les écrans, l’intégration Spotify, les configurations Expo/EAS et les suites existantes.

| Élément | Déjà présent | Intervention |
| --- | --- | --- |
| GPS et distance | Positions réelles, contrôles d’âge/précision/vitesse, distance géodésique | Filtre horizontal dédié, acquisition confirmée, traitement du bruit, des virages et des callbacks tardifs. |
| Temps et allures | Temps actif monotone, allure lissée, moyenne, intermédiaires | Temps total distinct, traitement d’un changement d’heure, arrêt du bilan au toucher Terminer. |
| Cycle de vie | Démarrer, pause/reprise, terminer | Annulation d’un démarrage en cours, permissions préparées avant le départ, nettoyage réessayable, conservation des données en cas d’erreur. |
| Arrêts | Pas d’auto-pause | Auto-pause facultative et reprise confirmée, distinctes de la pause manuelle. |
| Altitude | Mesures natives non transmises au moteur | Transmission de la précision verticale, altitude filtrée et dénivelés partiels conditionnés par cette précision. |
| Arrière-plan | Tâche Expo définie avant React et capacités iOS configurées | Lot GPS traité sans minuteur d’interface et sauvegardé avant de rendre la main à iOS. |
| Stockage et récupération | SQLite, sauvegardes JSON complètes, transaction de fin, reprise en pause | Journal incrémental de points, reprise des anciens formats, contrôle de cohérence et limitation des écritures en attente. |
| Séances et Spotify | Modules autonomes opérationnels dans le code | API conservées, intégration des pauses au moteur de séance, avertissement Spotify conservé pendant l’auto-pause. |
| Interface | Écrans et composants existants | Ajout des mesures et commandes dans ces composants ; carte de prévisualisation simplifiée, parcours stocké intégralement. |

La première exécution de la suite a révélé une suite de session qui chargeait Expo Speech dans Node (`__DEV__` absent). Les sorties vocales et la bibliothèque native sont maintenant simulées à la frontière de cette suite ; le moteur sportif réel continue d’y être exécuté.

## Séparation des responsabilités

- `src/services/location.ts` possède les abonnements natifs, les demandes et contrôles de permissions, les options de suivi et l’invalidation des callbacks annulés. Il transforme les mesures Expo en `GPSFix`, y compris `altitudeAccuracy`. La source native installée a été inspectée pour vérifier cette correspondance Core Location.
- `src/services/session.ts` coordonne les actions utilisateur, les transitions d’application, les checkpoints, le moteur et les sorties de coaching. Il ne calcule plus les déplacements et ne gère plus directement un abonnement Expo.
- `src/core/engine.ts` coordonne les calculs purs et conserve son API pour les séances et l’interface.
- `clock.ts`, `tracking.ts`, `geo.ts`, `autoPause.ts` et `elevation.ts` sont des calculateurs TypeScript sans dépendance à React Native, au réseau ou au stockage.

## Distance et allure

Les positions doivent être finies, dans les bornes géographiques, suffisamment récentes et précises. Les doublons et retours chronologiques sont ignorés sans invalider une allure saine. Une vitesse physiquement incompatible ou un saut incohérent n’ajoute pas de distance. Les longues interruptions repartent d’une nouvelle origine, sans relier les deux extrémités.

L’acquisition du mouvement demande deux déplacements cohérents et un déplacement dépassant un seuil lié à la précision. La dérive stationnaire n’est pas additionnée. Pendant le mouvement, un filtre horizontal position/vitesse alpha-bêta atténue le bruit, avec réinitialisation périodique de l’origine locale. Les virages ne sont pas assimilés à des téléportations. Cette méthode reste une estimation GPS : ses seuils nécessitent une calibration physique.

L’allure courante utilise les distances filtrées dans la fenêtre temporelle existante. Le déplacement confirmé à l’acquisition est réparti sur sa vraie durée pour le lissage, afin d’éviter une pointe quand une ancienne mesure quitte la fenêtre. La vitesse native sert notamment à détecter l’arrêt et les incohérences ; aucune précision Doppler absente du contrat Expo n’est inventée. L’allure moyenne reste le temps actif divisé par la distance, et non la moyenne des allures instantanées.

Le parcours sauvegardé contient les positions horizontales filtrées, avec les mesures de précision et les timestamps natifs. La distance reste horizontale : le bruit d’altitude n’allonge pas le parcours. La carte ne réduit que son affichage à environ 1 500 points plus les extrémités des segments ; la sauvegarde conserve tous les points. La prévisualisation se recadre par groupes de dix points, sans déplacer une carte que l’utilisateur explore en mode interactif.

## Chronomètres, pauses et récupération

Le temps actif avance lorsque la course est démarrée et non pausée. Le temps total avance aussi pendant les pauses. Les deux reposent sur le temps monotone pendant l’exécution ; changer l’heure système ne crée ni durée active ni déplacement fictif. Le temps actif démarre après la préparation des permissions, y compris l’autorisation Toujours quand elle est demandée.

L’auto-pause est désactivée par défaut et se règle dans la préparation ou les réglages, entre deux courses. Elle demande des positions précises et un arrêt observé pendant cinq secondes, ou dix secondes si la vitesse native manque. La reprise nécessite au moins deux secondes de mouvement confirmé. La précision insuffisante ou l’absence de callbacks ne constitue jamais une preuve d’arrêt. La confirmation compte dans le temps actif avant la décision : le moteur ne réécrit pas rétroactivement les mesures et transitions déjà validées.

Pendant une auto-pause, le chronomètre actif et les objectifs de séance sont suspendus ; le GPS reste actif pour détecter la reprise. Aucun déplacement ni dénivelé n’est crédité pendant cette pause. « Reprendre maintenant » permet une reprise manuelle sans créer un deuxième abonnement. « Pause manuelle » arrête aussi la détection GPS, et nécessite ensuite une reprise explicite.

Une récupération restaure le dernier checkpoint en pause et arrête les services résiduels. Elle ne reprend jamais le GPS silencieusement. L’intervalle depuis la sauvegarde est ajouté uniquement au temps total, comme estimation fondée sur l’horloge civile ; il n’ajoute ni temps actif ni distance. L’interface indique cette estimation. Les anciens historiques sans temps total restent affichables ; leur temps total historique absent n’est pas inventé.

Terminer prend une copie du bilan au moment de l’action. Une lenteur de l’arrêt natif ou du disque n’allonge donc pas le résultat. Si la transaction finale échoue, la course reste en pause et récupérable. Si la transaction réussit puis la lecture de l’historique échoue, l’activité est annoncée enregistrée et reste visible en mémoire.

## Altitude et dénivelé

Une altitude ne contribue aux mesures que si elle est finie, dans les bornes retenues et accompagnée d’une précision verticale de 0 à 8 m. Les sauts verticaux dépassant 3 m/s sont rejetés. Une médiane de cinq échantillons, un lissage temporel et un seuil de variation d’au moins 3 m réduisent les cumuls de bruit.

Les variations stationnaires ne produisent pas de dénivelé. Les interruptions, mesures rejetées et pauses réinitialisent la continuité verticale. Le résultat présente D+ / D− avec la durée et le pourcentage de mesures d’altitude fiables : il s’agit d’une estimation partielle lorsque des données manquent, sans extrapolation. Aucune mesure barométrique ni correction de terrain en ligne n’est utilisée.

## Persistance et fonctionnement hors ligne

La base de course passe au schéma 2 en créant `draft_points`. Le checkpoint conserve son en-tête et ajoute uniquement les nouveaux points, dans une transaction SQLite. Les insertions sont regroupées par lots de 200 points. L’ancienne sauvegarde reste intacte si l’une des écritures échoue. Le format des activités terminées reste compatible avec l’historique existant ; un ancien checkpoint contenant ses points en ligne est chargé puis migré lors de la sauvegarde suivante.

La session vise un checkpoint toutes les cinq secondes au premier plan, et force une sauvegarde aux transitions et après chaque lot d’arrière-plan. Une écriture lente ne crée pas une file illimitée de copies du trajet. Une pause attend la sauvegarde en cours puis enregistre l’état le plus récent, même si l’arrêt du GPS échoue. Les erreurs de disque sont signalées et ne sont pas présentées comme des sauvegardes réussies.

Le calcul et le stockage sportifs n’utilisent ni HTTP ni géocodage. Le GPS et les données locales peuvent fonctionner hors ligne ; le premier positionnement peut prendre plus de temps selon le téléphone et les conditions. Les fonds de carte et Spotify ont leurs propres besoins réseau et ne conditionnent pas l’enregistrement.

## Batterie et limites du client

Le suivi utilise `Accuracy.Highest`, plutôt que `BestForNavigation`, et un filtre de distance de 2 m par défaut. L’auto-pause demande les observations stationnaires nécessaires avec un filtre de distance nul. La tâche de fond demande des lots différés de trois secondes et garde l’indicateur système visible. Le minuteur de l’interface s’arrête en arrière-plan. L’écran n’est maintenu éveillé que pendant un suivi qui nécessite le premier plan, pas pendant une pause manuelle ni en mode de suivi de fond.

Ces choix réduisent certaines sources de travail, mais **aucune mesure de consommation ou de chauffe sur iPhone n’a été effectuée**. iOS décide de la cadence effective et peut interrompre l’exécution. Les intervalles demandés ne garantissent pas une fréquence de livraison.

Dans Expo Go sur iPhone, quitter l’application ou verrouiller l’écran met la course en pause manuelle, y compris si elle était automatiquement pausée. Le suivi écran verrouillé demande une version de développement installée et les permissions appropriées. Cette limite est explicitée dans la [documentation officielle Expo Location](https://docs.expo.dev/versions/latest/sdk/location/). Les modes natifs `location` et `audio`, les messages de permissions et la tâche enregistrée avant React étaient déjà présents et sont conservés. La fermeture forcée n’est pas contournée.

## Vérifications effectuées

- `npm run check` : compilation TypeScript stricte et **148 tests réussis dans 10 fichiers**, dont 55 nouveaux tests.
- `npm run export:ios` : export **iOS Hermes réussi**, 992 modules, bundle d’environ 2,6 Mo dans `dist/`.
- Les tests sportifs comprennent les trajets droits exacts et bruités, les virages, la dérive sans vitesse disponible, les sauts et pertes GPS, les pauses manuelles et automatiques, les changements d’heure et la récupération.
- Les tests d’altitude couvrent terrain plat bruité, montée/descente, sauts verticaux, précision manquante ou invalide, interruption et dérive à l’arrêt.
- Les tests de service simulent refus de permission, position approximative, annulation de démarrage, callbacks tardifs, erreurs natives, lots en arrière-plan et gel du bilan à Terminer.
- Les tests SQLite exécutent les requêtes et transactions dans SQLite réel sous Node, avec migration, écritures incrémentales, journal incomplet, rollback et révisions obsolètes.
- Les suites existantes Spotify, coaching et audio passent. Deux nouveaux scénarios vérifient l’intégration du moteur de séances, dont les fractions courtes et l’auto-pause ; cela ne constitue pas une couverture exhaustive de tous les défis et de l’éditeur.

Le GPS des tests et les services iOS sont simulés. SQLite sous Node ne valide pas le module natif sur iPhone. Le bundle Hermes est du JavaScript compilé pour l’hôte iOS ; aucune compilation Xcode ni génération de `.ipa` signé n’a été effectuée sous Windows. Aucun essai physique ou contrôle manuel d’interface n’est présenté comme réalisé.

## Vérifications restant à faire sur iPhone

| Vérification | Procédure et mesures à relever |
| --- | --- |
| Démarrage et autorisations | Autoriser, refuser, choisir Une fois, désactiver Position exacte, révoquer les droits pendant une sortie ; vérifier les messages et les sauvegardes. |
| Distance réelle | Parcours mesuré de 1 à 5 km, ligne droite, virages, demi-tours, rue dense et sous-bois ; comparer distance, temps et erreurs relatives sur plusieurs iPhone. |
| Arrêt et dérive | Téléphone immobile 10 min, avec et sans auto-pause ; vérifier l’absence de distance qui s’accumule et mesurer les délais de pause/reprise. |
| Marche lente et faux arrêts | Marche, feux rouges, téléphone en poche ou à la main ; calibrer les seuils et vérifier que la perte GPS ne pause pas automatiquement. |
| Altitude | Terrain plat, côte et escaliers ; comparer à une référence, relever la couverture verticale et vérifier l’absence de cumul de bruit. |
| Pause manuelle | Se déplacer loin pendant la pause ; vérifier qu’aucun déplacement ni dénivelé de cette portion n’est ajouté à la reprise. |
| Expo Go | Quitter l’application et verrouiller pendant une course ou une auto-pause ; vérifier la pause explicite et la reprise manuelle. |
| Version installée | Suivi écran verrouillé pendant au moins 20 min, transitions répétées, mode économie d’énergie et arrêt/reprise ; vérifier les points reçus et le journal. |
| Interruptions | Appel, centre de contrôle, changement d’heure, Spotify, Bluetooth et casque débranché ; vérifier continuité, absence de crash et absence d’anciennes annonces. |
| Récupération | Fermer de force puis relancer, redémarrer l’iPhone ; vérifier le dernier checkpoint, les deux temps, l’estimation d’interruption et la reprise en pause. |
| Persistance | Course longue, espace disque faible, interruption pendant un checkpoint et pendant Terminer ; vérifier le résultat et l’absence de sauvegarde tardive ressuscitée. |
| Batterie et stabilité | Sessions de 60 à 120 min sur plusieurs modèles, premier plan et verrouillé, auto-pause activée/désactivée ; relever %/h, chauffe, nombre de points et éventuelles suspensions. |

Ces mesures physiques restent nécessaires avant de qualifier la précision et l’autonomie du suivi.
