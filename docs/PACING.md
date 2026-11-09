# Module 2 — Coach d’allure intelligent

Livraison du 1er novembre 2026. Les composants et l’identité visuelle existants sont conservés. Les calculs sont indépendants de React Native, du fournisseur GPS, de Spotify et des sorties audio.

## Analyse du coach existant

Le projet disposait déjà d’une plage rapide/lente, d’une allure GPS lissée, d’une confirmation de l’écart, d’une hystérésis d’entrée, d’un délai entre alertes et d’une file de coaching centralisée. Les séances proposaient aussi leurs propres cibles et statistiques par segment.

Il manquait les objectifs chronométriques des courses libres, un plan simple par kilomètre, le capital de temps, la projection d’arrivée en direct et un journal détaillé des écarts pour toutes les courses. Ces fonctions sont ajoutées en conservant le moteur GPS et le cycle de vie du Module 1.

## Utilisation

Dans la préparation d’une course sans séance sélectionnée, **Objectif du coach** propose :

- **Plage d’allure** : conserver les commandes existantes et le sélecteur natif minutes/secondes. La distance reste facultative.
- **Temps final** : définir une distance, un temps au format `25:00` ou `1:45:00` et une zone de guidage autour de l’allure moyenne correspondante.
- **Par kilomètre** : définir une plage pour chaque kilomètre, y compris la dernière fraction de kilomètre. Un objectif chronométrique peut être ajouté à ce plan.

Le temps final peut utiliser le **temps actif**, hors pauses, ou le **temps total**, pauses incluses. En mode total, les arrêts consomment le temps disponible. Les règles chronométriques des séances existantes continuent d’utiliser leur temps actif.

Pendant la course, le panneau présente le capital, la durée projetée, l’heure d’arrivée estimée et, pour un temps final explicite, l’allure moyenne nécessaire sur la distance restante. La zone de guidage reste celle du plan choisi ; l’allure restante est une information distincte, pas une modification automatique des plages.

À la fin d’un plan par kilomètre, la sortie passe en allure libre et le GPS continue. Pour une plage fixe, le guidage existant continue après la distance cible. Dans les deux cas, le capital est figé au franchissement mesuré de cette distance, même si la sortie entière dure plus longtemps.

Le journal des écarts est visible en direct et dans le bilan. Les plages par kilomètre sont conservées dans le bilan et dans les bandes du graphique existant.

## Convention d’allure et seuils

Une allure est stockée en **secondes par kilomètre**. Une valeur plus petite correspond à une vitesse plus élevée : 4′50″/km = 290 s/km est plus rapide que 5′00″/km = 300 s/km.

`PaceCoach.classification` indique trop rapide, trop lent ou correct selon la mesure lissée et la tolérance configurée. L’état public historique `state` reste celui de l’alerte avec hystérésis. L’interface utilise la classification pour ne pas confondre un petit écart réel avec une alerte déjà armée.

Les paramètres de la prochaine course sont accessibles dans Réglages :

- **Tolérance** : étend la zone silencieuse autour de la plage.
- **Hystérésis d’entrée** : marge supplémentaire nécessaire pour commencer à confirmer une alerte. Une fois armée, l’alerte reste candidate tant que la mesure n’est pas revenue dans la zone acceptée.
- **Confirmation** : durée minimale d’un écart avant signal.
- **Espacement** : délai minimal entre deux alertes, conservé au changement de cible et après une interruption.
- **Lissage** : fenêtre du moteur GPS existant.
- **Annonce d’avance/retard** : seuil en secondes de capital ; confirmation temporelle, puis au moins une minute entre annonces chronométriques.

Un retour en cible ou une interruption interrompt la confirmation. Les mesures invalides, les pauses et l’acquisition GPS ne donnent pas de consigne de vitesse. Les règles et budgets d’un défi restent propres à sa séance ; l’avertissement du budget Survie est identifié comme une information de défi. Les alertes génériques d’allure ont une source unique, `PaceCoach`, pour éviter les doublons avec les événements internes des séances.

## Capital de temps

La convention est :

`capital = temps de passage prévu à la distance mesurée − temps écoulé choisi`

Un capital positif indique de l’avance ; un capital négatif indique du retard. Pour 5 km en 25 minutes, le passage de référence à 1 km est à 300 secondes : 285 secondes mesurées correspondent à +15 secondes, et 320 secondes à −20 secondes.

Avec une cible constante, le temps prévu est proportionnel à la distance. Avec des plages par kilomètre, le calcul respecte leurs bornes : il répartit la marge entre la somme des passages rapides et la somme des passages lents pour atteindre le temps final choisi. Le dernier kilomètre partiel utilise sa vraie longueur. Sans temps final explicite, le milieu des plages sert de **référence du plan**, clairement nommé ainsi dans l’interface.

Un objectif en temps total peut inclure une réserve d’arrêt et être plus long que le plan de déplacement. Cette réserve est répartie dans les temps de passage de référence ; les plages de guidage ne sont pas artificiellement ralenties. Une grande réserve ne rend pas l’objectif impossible : elle ne provoque pas de demande d’accélération supplémentaire.

## Projection d’arrivée

La durée projetée utilise le temps déjà écoulé selon la base choisie et l’allure moyenne active mesurée sur la distance restante. L’heure estimée ajoute la durée restante au timestamp du dernier point accepté. La projection suppose la poursuite de cette moyenne sans futur arrêt ; elle ne prédit pas les conditions du parcours ou les futurs changements de rythme.

L’allure moyenne restante nécessaire vaut :

`(temps final − temps écoulé choisi) / distance restante × 1 000`

Cette valeur n’est présentée comme une allure de guidage que dans les bornes techniques de l’application. Une allure exigée plus rapide que le guide ou le filtre GPS, ou un temps déjà dépassé, est signalé sans imposer une accélération irréaliste. Une arrivée plus précoce reste possible lorsqu’il existe une réserve importante.

Les estimations attendent 50 m et la stabilisation de l’allure. Elles utilisent les temps associés aux positions acceptées, plutôt que de comparer une nouvelle seconde de chronomètre à une position GPS ancienne. Les fractions de franchissement de la distance finale sont interpolées dans l’intervalle accepté, puis mémorisées.

## Pauses, interruptions et confiance

- En pause, la projection d’arrivée est suspendue. Le capital est figé en temps actif ; il continue d’évoluer en temps total à distance enregistrée fixe.
- Une mesure temporairement rejetée suspend les estimations pendant la stabilisation. Si les points valides encadrants conservent la continuité de distance, elles reprennent avec le GPS fiable.
- Une vraie rupture de distance rend le capital et l’arrivée indisponibles pour le reste de cette activité. La distance manquante n’est pas reconstruite. Cette précaution empêche de présenter un retard artificiel comme une mesure précise.
- Après récupération, le temps total du Module 1 peut contenir une estimation d’interruption. Le panneau l’indique ; les annonces d’avance/retard fondées sur ce total estimé sont désactivées. Un objectif en temps actif conserve sa base de calcul.
- Une sortie interrompue avant la distance cible conserve le capital du dernier point accepté ; aucune arrivée future n’est projetée dans son bilan.
- Les anciens historiques sans journal restent lisibles. Les anciens compteurs sont conservés, sans inventer un historique détaillé manquant.

## Pourcentage et historique des écarts

Le pourcentage repose sur la durée des intervalles d’allure fiables, dans les **plages exactes**. La tolérance et l’hystérésis des alertes ne changent pas ce pourcentage. Les statistiques propres aux défis restent calculées par leur moteur de séance.

Chaque écart conserve le sens, la cible, le contexte, les distances et temps actifs de début/fin, la durée, l’allure lissée extrême, son caractère durable et la raison de fin. Les changements de cible, retours en zone, changements de sens, pertes GPS et pauses ferment les portions concernées ; aucun trou de mesure n’allonge une durée d’écart.

Le journal garde le détail des 500 derniers écarts et conserve les totaux agrégés au-delà. « Durable » ne garantit pas qu’un son a été joué : marge, hystérésis, espacement et préférences de sortie restent applicables. Les annonces périmées sont supprimées de la file plutôt qu’accumulées.

## Architecture et persistance

- `src/pacing/goals.ts` : validation, cible au kilomètre courant, référence temporelle et passage prévu à une distance.
- `src/pacing/engine.ts` : journal des intervalles, franchissement de distance, événements d’avance/retard et instantané versionné.
- `src/pacing/metrics.ts` : calcul pur de l’affichage à partir d’une activité, sans accès à l’interface ni à l’audio.
- `src/core/coach.ts` : classification et machine d’alerte, avec changement de cible sans remise à zéro du délai global.
- `src/core/engine.ts` : adaptation des intervalles GPS filtrés, interpolation des limites et transmission des événements.
- `src/pacing/GoalEditor.tsx` et `components.tsx` : saisie et affichage, avec les composants existants.
- `src/workouts/coaching.ts` : sortie centralisée des événements, par voix facultative, sons ou vibrations ; aucune commande Spotify ajoutée.

La cible et ses kilomètres sont figés dans `RunRecord.target`. Le journal versionné est conservé dans `RunRecord.pacing`. Ils bénéficient des checkpoints incrémentaux et de la transaction finale existants. Un journal ou des extensions d’objectif corrompus sont écartés sans supprimer le parcours ni les statistiques principales de l’activité.

La validation refuse valeurs vides/non finies, plages inversées, distances hors bornes, kilomètres manquants, temps final sans distance et temps incompatibles avec le plan ou le filtre GPS. Pour un objectif actif, le temps final doit être compris entre les temps rapides et lents du plan. Les limites du guide sont des limites de configuration de l’application, pas des recommandations d’allure universelles.

## Compilation et absence de tests

La consigne finale explicite de ce module est **« NE FAIS PAS DE TEST »**. Aucun test n’a donc été créé, modifié ou exécuté pour cette livraison, et aucun parcours simulé, essai manuel d’interface ou essai sur iPhone n’a été lancé.

Les seules vérifications exécutées sont la compilation TypeScript sans émission (`npm run typecheck`) et l’export du bundle iOS Hermes (`npm run export:ios`). Elles ont réussi sous Windows. Elles ne valident pas le comportement physique du coach ni les transitions en conditions réelles.

Les 148 tests rapportés dans le Module 1 appartiennent à sa livraison précédente ; ils n’ont pas été relancés et ne constituent pas une validation de ces changements. Aucun IPA signé n’a été généré. Les limites d’Expo Go et du suivi écran verrouillé restent celles du Module 1.
