# Séances, défis et progression personnelle

[État des fonctionnalités](etat-fonctionnalites.md) · [Course et coach](course-et-coach.md) · [Synchronisation](../backend/synchronisation.md)

## Séances et défis

[LibraryView.tsx](../../src/workouts/LibraryView.tsx) et [LibraryCards.tsx](../../src/workouts/LibraryCards.tsx) proposent modèles, création, favoris et retour à la course libre. [templates.ts](../../src/workouts/templates.ts) possède les modèles ; leurs paramètres n’ont pas de seconde liste documentaire.

[definition.ts](../../src/workouts/definition.ts) valide et développe les blocs de distance, durée ou temps consécutif en cible et leurs répétitions. [engine.ts](../../src/workouts/engine.ts) suit segments, pauses, conditions, budgets et résultats des défis. [records.ts](../../src/workouts/records.ts) compare des configurations compatibles ; [stability.ts](../../src/workouts/stability.ts) mesure la stabilité.

La définition choisie est copiée dans la course au départ. Modifier la prochaine séance ne réécrit pas la course active. Abandonner les objectifs laisse le GPS continuer. Une perte de qualité interrompt les conditions ; elle ne doit pas fabriquer une réussite. Le bilan garde le plan et le résultat motivé.

Départ rapide et [préparation](../../src/screens/Preparation.tsx) partagent [runPreparation.ts](../../src/services/runPreparation.ts) et [runSetup.ts](../../src/services/runSetup.ts), notamment les identifiants de calendrier, chaussure et parcours. Une sélection invalide doit être revue avant le départ.

## Progression

| Besoin | Source propriétaire |
|---|---|
| Agrégats et périodes | [aggregates.ts](../../src/progression/aggregates.ts), [dates.ts](../../src/progression/dates.ts) |
| Calendrier et associations | [Calendar.tsx](../../src/progression/Calendar.tsx), [entries.ts](../../src/progression/entries.ts) |
| Plans générés et édition | [plans.ts](../../src/progression/plans.ts), [PlanBuilder.tsx](../../src/progression/PlanBuilder.tsx) |
| Objectifs hebdomadaires | [Goals.tsx](../../src/progression/Goals.tsx) |
| Notes, ressenti, difficulté | [ActivityReview.tsx](../../src/progression/ActivityReview.tsx) |
| Chaussures et kilométrage | [Shoes.tsx](../../src/progression/Shoes.tsx) |
| Chronologie des records | [records.ts](../../src/progression/records.ts) |
| Validation et réconciliation | [validation.ts](../../src/progression/validation.ts), [store.ts](../../src/progression/store.ts) |

Les jours locaux du calendrier sont distincts des timestamps de course. Les plans sont des aides paramétrées ; les activités réelles alimentent agrégats et kilométrage, tandis que les exemples restent isolés.

Les bases progression et séances sont distinctes du journal GPS. Les [adaptateurs de documents](../../src/sync/documentAdapters.ts) définissent le sous-ensemble portable : ne pas annoncer que tout le calendrier, les notes et les préférences vocales sont synchronisés.

## Validation et limites

[run-setup.test.ts](../../tests/run-setup.test.ts) couvre le contrat de préparation ; [session.test.ts](../../tests/session.test.ts) couvre une partie du raccordement au moteur. La présence de ces suites ne constitue pas une recette exhaustive de l’éditeur, des plans et de chaque défi. Voir [validation](../quality/validation.md) et [recette iPhone](../quality/recette-course-iphone.md).
