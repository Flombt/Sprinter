# Séances & Défis — Module 4

L’interface de bibliothèque et de configuration a été harmonisée le **2 novembre 2026** : sections, favoris locaux, cartes détaillées et aperçu du plan. Voir [WORKOUT_LIBRARY.md](WORKOUT_LIBRARY.md). Les sections ci-dessous décrivent la livraison fonctionnelle du Module 4, dont le moteur est conservé.

Le module conserve React Native et Expo Go, conformément au choix du projet. Les nouvelles interfaces réutilisent les composants, couleurs et commandes existants ; aucune refonte graphique n’a été entreprise.

## Analyse de l’existant et compléments

Avant modification, le projet possédait huit modèles, un éditeur de blocs et de groupes répétés, la sauvegarde locale, les commandes de sélection/modification/suppression/duplication, un interpréteur indépendant du GPS et une file de coaching. Ces éléments sont réutilisés. Le Module 4 ajoute le modèle 5 × 1 000 m, le défi contre un record personnel qualifié du Module 3 et le défi régularité. Le fantôme historique est conservé : la bibliothèque comporte donc onze modèles, dont les dix demandés.

L’éditeur permet maintenant de dupliquer aussi un bloc ou un groupe, avec de nouveaux identifiants. Un ajustement global de ± 15 s/km décale toutes les cibles, y compris dans les répétitions, sans changer leurs écarts, la progression, les volumes, les récupérations ni les chronos de défi. Les limites de 2 à 20 min/km restent imposées et chaque plage reste éditable individuellement. Les transitions existantes par distance, durée ou confirmation en cible restent automatiques et sont expliquées dans l’éditeur.

## Utilisation

1. Ouvrir **Séances**, choisir un des onze modèles, ou **Créer ma séance**.
2. Régler les blocs, les répétitions, les allures au format `5:30`, les tolérances et la règle du défi. Les distances sont en mètres, les durées en secondes. Les valeurs proposées sont des exemples à adapter.
3. **Enregistrer et choisir** ouvre la préparation. On peut aussi sélectionner une séance depuis la préparation sans perdre ses autres réglages.
4. Démarrer : le GPS et le chronomètre habituels alimentent les transitions. Les blocs libres n’émettent pas de consignes d’allure. Les pauses suspendent aussi la séance.
5. Terminer la sortie pour retrouver le bilan dans **Sorties**. Les records sont accessibles dans **Séances → Consulter mes records**.

Les séances sauvegardées peuvent être choisies à nouveau pour les relancer, modifiées, dupliquées ou supprimées depuis la bibliothèque. Les sorties déjà enregistrées conservent leur copie indépendante du plan. Pour viser le nouveau record après avoir amélioré son chrono, créer une nouvelle référence depuis **Bats ton record personnel** ; une ancienne séance reste attachée au record qu’elle défiait lors de sa création.

Une séance terminée ou un défi perdu laisse l’enregistrement de la sortie actif. **Abandonner la séance, continuer librement** clôt seulement les objectifs : le GPS continue et le résultat partiel est conservé. **Terminer** clôt et enregistre la sortie entière.

## Modèles

| Modèle | Interprétation |
| --- | --- |
| Survie 5 km | Un bloc de distance avec cible ; budget de temps hors cible consécutif ou cumulé, avertissement distinct. |
| Fractionné 10 × 400 m | Échauffement, groupe répété effort/récupération, retour au calme. Les efforts sont jugés sur leur allure moyenne réelle. |
| Fractionné 5 × 1 000 m | Échauffement de 5 min, cinq efforts de 1 000 m avec récupération de 120 s, retour au calme de 3 min. Toutes les valeurs sont modifiables. |
| Accélération progressive 5 km | Cinq blocs de 1 km avec leurs cibles ; progression minimale entre les moyennes des efforts. |
| Contre-la-montre | Un bloc de distance et un temps limite sur le temps actif. |
| Pyramide | Échauffement, 200/400/800/400/200 m et récupérations, retour au calme. |
| Endurance régulière | Bloc de durée avec minimum configurable de temps fiable en cible. |
| Bats ton fantôme | Vraie course terminée avec trajet, au moins 95 % de temps GPS couvert et aucune perte GPS de continuité inconnue sur la distance choisie. Distance configurable entre 95 et 100 % de la source, sans extrapolation ; temps actif interpolé sur son trajet. Il faut battre strictement ce temps. |
| Bats ton record personnel | Choix du meilleur segment GPS de l’historique sur 1 km, 5 km, 10 km, semi ou marathon. Distance exacte, chrono et courbe de progression conservés ; il faut battre strictement le chrono sans pause. |
| Défi régularité | Effort de 20 min, cible adaptable, minimum de temps fiable en cible et score de stabilité requis configurables ; valeurs initiales de 80 % et 80/100. |
| Sprint final | Deux blocs avec cibles distinctes, première partie puis fin plus rapide. |

Tous les blocs sont modifiables. Le fantôme conserve une référence indépendante de la course source, même si celle-ci est ensuite supprimée. Changer sa distance nécessite encore le parcours source. Les classements du fantôme comparent la même référence.

## Architecture

- `src/workouts/types.ts` : définitions versionnées, blocs récursifs, répétitions, états, événements et résultats.
- `definition.ts` : validation, expansion bornée, cibles effectives, référence fantôme, statistiques et signature de comparaison.
- `engine.ts` : interpréteur TypeScript pur. Aucune dépendance à React Native, Expo Location, l’interface, SQLite ou Spotify. Entrées : temps actif et intervalles de distance acceptés par le moteur GPS existant.
- `events.ts` : file de 16 annonces au maximum, priorités, péremption et limitation de fréquence ; les événements détaillés restent dans la séance (400 derniers au maximum).
- `coaching.ts` : arbitre unique de sortie, voix facultative, sons et vibrations. Il ne pilote pas Spotify. Les sons relâchent leur session de ducking après lecture ; la voix utilise une session gérée par iOS.
- `persistence.ts` et `store.ts` : bibliothèque locale dans une base SQLite séparée, préférences et écritures sérialisées. Le repli web utilise localStorage. Modifier une séance n’altère pas la copie attachée à une course déjà démarrée.
- `records.ts` : classement uniquement des résultats terminés et réussis, regroupés par blocs, cibles, tolérances et règles identiques. Classement par temps actif, ou par pourcentage en cible pour des blocs entièrement chronométrés.
- `stability.ts` : accumulateur d’allure pondéré par la durée, fusion des moments entre blocs et score pur, indépendant de l’interface, des alertes et du stockage.
- `src/analysis/records.ts` : critères de qualification des records réutilisés sans second moteur concurrent ; extraction d’une référence de progression depuis le segment réellement qualifié.
- Le `RunRecord.workout` contient le plan figé, les mesures de chaque segment et les événements. Il bénéficie des checkpoints et de la transaction finale existants. Une reprise après fermeture revient en pause et ne réémet pas les anciennes annonces.

## Mesures et règles

Les secondes par kilomètre augmentent quand le coureur ralentit. La marge étend les bornes de la cible. Les règles « pas trop vite » et « pas trop lent » n’appliquent que la borne correspondante.

Les passages de distance sont interpolés dans un intervalle accepté, afin de partager correctement les mètres et secondes entre deux blocs. Les transitions de durée utilisent le temps actif monotone, même si le GPS manque ; leur résultat reste non évaluable quand les mesures sont insuffisantes. Un callback GPS légèrement tardif recale les distances des transitions chronométrées. Une grâce de six secondes est accordée à la confirmation GPS finale.

Les allures moyennes des fractions utilisent leur durée active et leur distance acceptée, avec des bornes propres au segment. L’allure instantanée lissée sert au guidage et au temps passé en cible ; les huit premières secondes d’un bloc sont exclues de ce dernier calcul pour ne pas hériter de l’effort précédent. Le pourcentage en cible a pour dénominateur les seules secondes d’allure fiable des blocs ciblés. Le détail affiche aussi la couverture de suivi, les écarts, leur durée et les répétitions, avec temps d’effort et de récupération distincts.

Une perte de signal interrompt le compteur **consécutif**, sans effacer le total **cumulé**. Aucun intervalle rejeté ne consomme le budget. Une interruption de distance rend un contre-la-montre ou un fantôme non évaluable, plutôt que d’inventer une distance et une défaite. Le temps limite ne provoque une défaite en direct qu’avec une mesure récente dépassant cette limite et une couverture suffisante. Les interruptions de pause sont exclues du temps actif ; reprendre repart d’un nouveau point GPS.

### Défi contre un record

Le sélecteur utilise les records calculés dans l’historique, sans transformer une allure moyenne en faux chrono. Il attend la fin du calcul des activités avant d’autoriser le choix. Les critères du Module 3 s’appliquent à la référence : précision horizontale ≤ 15 m, observations espacées d’au plus 6 s, segment continu, chrono cohérent, aucune extrapolation. La référence peut venir d’une portion d’une sortie plus longue ; ses bornes et sa date sont affichées. Sa courbe de progression est réduite à environ mille observations pour le guidage, tandis que son chrono exact reste conservé.

Le défi utilise un unique bloc de cette distance et le temps du record. Une égalité ne suffit pas. Les intervalles de la nouvelle tentative transmettent une qualification explicite de précision ≤ 15 m et d’espacement ≤ 6 s ; sans cette qualification, le résultat n’est pas homologué par le moteur de défi. Une pause manuelle, une auto-pause, une récupération après fermeture ou une perte de continuité empêchent aussi la qualification. Le compteur GPS reste actif selon ses règles habituelles et la sortie reste enregistrable. La comparaison de progression et les objectifs chronométriques du coach sont suspendus lorsque cette qualification est perdue.

La référence est une copie sauvegardée : supprimer l’activité source n’efface pas une séance déjà créée. La distance et le temps de cette référence ne sont pas modifiables séparément ; pour une autre distance, choisir un autre record. Le fantôme historique reste distinct et conserve sa comparaison sur le temps actif.

### Score de régularité

Seuls les intervalles d’allure fiable des blocs **Effort** alimentent le score, après les huit secondes de stabilisation de chaque bloc. Les récupérations, échauffements, retours au calme, pauses et intervalles sans allure fiable ne sont pas intégrés. L’accumulateur de Welford pondéré conserve durée, moyenne, somme des écarts quadratiques et nombre d’observations ; la fréquence des callbacks ne donne donc pas plus de poids à une seconde de course.

La formule est `score = max(0, min(100, 100 × (1 − 4 × écart-type / allure moyenne)))`. L’écart-type et la moyenne utilisent les secondes par kilomètre et la pondération temporelle. Une dispersion relative nulle donne 100 ; une dispersion relative de 5 % donne 80 ; à partir de 25 %, le score vaut zéro. Il s’agit d’un indicateur calculé sur l’allure GPS filtrée.

Il faut au moins 30 secondes et cinq observations fiables pour afficher un score. La validation finale exige aussi la couverture minimale configurée sur le temps actif des efforts. Des données insuffisantes produisent **Non évaluable**, sans score inventé. Le minimum de stabilité ne remplace pas les conditions des blocs : une allure stable mais hors de la cible peut échouer. Le score provisoire, la couverture et le seuil sont visibles pendant la séance ; le bilan conserve score, écart-type et durée fiable. Les classements du défi régularité comparent des règles identiques et trient par score décroissant.

### Résumé des répétitions

Le bilan conserve les résultats de chaque segment et regroupe chaque répétition : durée totale, temps d’effort, distance et allure d’effort, temps de récupération séparé, pourcentage fiable en cible et résultat. Un groupe incomplet ou insuffisamment mesuré reste signalé. Les motifs d’échec et conditions de temps maximal restent consultables par bloc.

Un bloc peut finir après une distance, une durée, ou une durée consécutive dans la cible. La condition d’allure exige une cible et un délai maximal. Les répétitions sont bornées à 100 passages par groupe, trois niveaux et 500 segments développés. Les valeurs vides, non finies, inversées, les groupes vides et les durées contradictoires sont refusés avant enregistrement. Les données facultatives de séance sont validées lors du chargement : leur corruption n’empêche pas de récupérer le parcours de la sortie.

## Persistance et compatibilité

La bibliothèque reste dans `sprinter-workouts-v1.db` ; les définitions et résultats restent des documents JSON version 1. Les champs de score, de provenance de référence et d’interruption par pause sont des ajouts facultatifs. Les anciennes séances restent lisibles ; aucun accumulateur de stabilité n’est inventé pour les anciennes activités. Lorsqu’une ancienne activité est reprise, seules les nouvelles mesures peuvent alimenter cet accumulateur. Aucune suppression ni reconstruction des tables existantes n’est nécessaire.

Les paramètres et moments de stabilité font partie du `WorkoutSnapshot`, donc des checkpoints et de la sauvegarde finale déjà existants. Les définitions attachées à une course sont figées. Les références et seuils de score font partie de la signature de classement ; leurs valeurs par défaut sont normalisées pour conserver la comparabilité des anciens modèles équivalents.

## Audio et limites iOS

Les consignes passent toutes par la même file : débuts/fins de blocs, changements de cible, écarts durables, retour en cible, transition proche, fin de répétition, réussite, défaite et fin de séance. Les priorités et délais éliminent les annonces devenues inutiles ; tous les événements ne donnent donc pas nécessairement lieu à une annonce sonore.

Activer **Signaux audio** dans la préparation ou les réglages. Pour lire les messages, activer aussi **Annonces vocales du coach** dans Séances. Les vibrations respectent le réglage existant. La voix est limitée au premier plan ; sur iPhone, le mode silencieux peut la rendre inaudible. Voir la [documentation officielle Expo Speech](https://docs.expo.dev/versions/latest/sdk/speech/).

Dans Expo Go sur iPhone, quitter Sprinter met la sortie et la séance en pause. Le suivi écran verrouillé et les sons d’arrière-plan nécessitent la version de développement installée déjà prévue par le projet. La voix et les vibrations ne sont pas promises écran verrouillé. Aucune requête musicale n’est effectuée par le moteur de séance, et une erreur de sortie audio ne termine pas le GPS.

## Vérifications du Module 4 — 1er novembre 2026

Aucun test n’a été créé, modifié ou exécuté pour ce module, conformément à la dernière consigne explicite de l’utilisateur. Aucun parcours simulé, essai d’interface ni essai sur iPhone n’a été effectué. Les anciens tests du Module 1 n’ont pas été relancés et ne valident pas ces ajouts.

`npm run typecheck` et `npm run export:ios` ont réussi sous Windows : bundle iOS Hermes de 1 036 modules, environ 2,8 Mo. Aucun IPA signé ni build Xcode n’a été produit. La compilation ne démontre pas l’exactitude des transitions ou des scores en situation réelle.

Restent à vérifier sur un iPhone physique : enchaînements des fractions et récupérations avec GPS réel, pauses/reprises et auto-pause, condition de temps consécutif en cible, défaite sans arrêt GPS, défi contre un record mesuré, stabilité avec changements d’allure et signal dégradé, restauration du checkpoint, persistance/duplication et annonces audio. Ces vérifications restent non effectuées.
