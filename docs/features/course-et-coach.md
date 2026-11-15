# Course GPS et coach d’allure

[État des fonctionnalités](etat-fonctionnalites.md) · [Cycle et stockage](../architecture/donnees-et-cycle-course.md)

## Sources propriétaires

| Sujet | Source à ouvrir |
|---|---|
| Contrats, unités, défauts | [core/types.ts](../../src/core/types.ts) |
| Mesures, horloges, segments et splits | [core/engine.ts](../../src/core/engine.ts), [clock.ts](../../src/core/clock.ts) |
| Filtre, altitude, pause automatique | [tracking.ts](../../src/core/tracking.ts), [elevation.ts](../../src/core/elevation.ts), [autoPause.ts](../../src/core/autoPause.ts) |
| Permissions, GPS et fond | [location.ts](../../src/services/location.ts), [background.ts](../../src/services/background.ts), [session.ts](../../src/services/session.ts) |
| Classification et confirmation d’écart | [coach.ts](../../src/core/coach.ts) |
| Objectifs temps/km et journal d’écarts | [goals.ts](../../src/pacing/goals.ts), [engine.ts](../../src/pacing/engine.ts), [metrics.ts](../../src/pacing/metrics.ts) |
| Préférences et file d’annonces | [config.ts](../../src/coaching/config.ts), [progress.ts](../../src/coaching/progress.ts), [events.ts](../../src/workouts/events.ts) |
| Audio et vibrations | [alerts.ts](../../src/services/alerts.ts), [cueAudio.ts](../../src/services/cueAudio.ts), [audioSession.ts](../../src/services/audioSession.ts) |

## Comportements à préserver

Les positions invalides, anciennes, imprécises ou incohérentes n’ajoutent pas de distance. Les pauses et interruptions coupent la continuité. Le filtre horizontal atténue la dérive ; le bruit vertical ne doit pas allonger la distance. La mesure reste une estimation à calibrer sur le terrain.

Temps actif et temps total sont distincts. L’auto-pause, désactivée par défaut, exige un arrêt confirmé et conserve le GPS pour détecter la reprise ; la pause manuelle arrête l’abonnement. Les réglages de fond et d’auto-pause se changent entre deux courses. Les permissions sont relues au retour au premier plan.

Le départ simple utilise `DEFAULT_EXACT_TARGET` : **300 s/km**, sans marge. Une cible exacte suit la seconde arrondie affichée : 300,2 s/km reste 5:00. Tolérances et hystérésis des plages ne s’y appliquent pas. Filtrage, fiabilité, confirmation et espacement des alertes restent actifs : aucune vibration instantanée ou précision physique de deux secondes/km n’est promise.

Objectifs chronométriques, plages et allures au kilomètre restent accessibles en préparation. Le journal de pacing distingue les périodes fiables des périodes inconnues. Le temps en cible utilise des durées couvertes et les bornes statistiques, sans recopier l’hystérésis des alertes.

## Annonces et musique

La file unique de course/séance borne, dédouble et expire les annonces ; pause et interruption annulent les sorties périmées. Voix, signaux et métronome partagent un arbitre audio. Le coach ne commande pas Spotify. La voix est une préférence distincte, dépendante des signaux audio.

Haptiques et annonces sont limités au premier plan dans cette implémentation. Deux impacts rapprochés demandent de ralentir ; une vibration système demande d’accélérer. Mode silencieux, casque et réglages système influencent la perception. Aucune forme d’onde personnalisée verrouillée n’est promise.

## Vérifier une évolution

Tests utiles : [coach](../../tests/coach.test.ts), [engine](../../tests/engine.test.ts), [tracking](../../tests/tracking.test.ts), [location](../../tests/location.test.ts), [cue-audio](../../tests/cue-audio.test.ts), [pace-route](../../tests/pace-route.test.ts), [session](../../tests/session.test.ts). Leur [exécution](../quality/validation.md) est séparée des [scénarios iPhone](../quality/recette-course-iphone.md). Une évolution de seuil doit expliciter ses effets sur distance, alerte, couverture et reprise.
