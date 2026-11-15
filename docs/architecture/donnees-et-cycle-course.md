# Données et cycle de course

[Architecture](vue-ensemble.md) · [Course et coach](../features/course-et-coach.md) · [Synchronisation](../backend/synchronisation.md)

## Contrats et unités

[RunRecord, TrackPoint, Settings](../../src/core/types.ts) sont les contrats sportifs. Distances en mètres, durées en secondes, allures en secondes/km ; dates civiles de début/fin en millisecondes. Le temps d’exécution utilise `performance.now()`, distinct de l’heure civile. Ne pas convertir une absence de mesure en zéro fiable.

L’enveloppe d’activité est en `dataVersion: 3` ; [migrateActivity](../../src/storage/migrations.ts) accepte les versions 1 à 3 sans inventer les qualités de capteur manquantes. La version SQLite est indépendante : la base de course est au schéma **4**.

## Parcours d’une course

1. [useRunStart](../../src/navigation/useRunStart.ts) et [runPreparation](../../src/services/runPreparation.ts) résolvent les choix ; [runSetup](../../src/services/runSetup.ts) partage le contrat entre départ rapide et préparation.
2. [RunningStore.start](../../src/services/session.ts) prépare les autorisations, instancie [RunEngine](../../src/core/engine.ts), démarre le GPS et écrit le premier checkpoint.
3. [location.ts](../../src/services/location.ts) transforme les mesures Expo en `GPSFix`. Le moteur filtre, calcule distance/horloges/allure et alimente séances, pacing et annonces.
4. La session publie les instantanés UI et vise un checkpoint toutes les cinq secondes au premier plan. Chaque lot de fond livré est sauvegardé avant de rendre la main à iOS.
5. Une pause manuelle arrête le GPS. Une auto-pause conserve la détection de mouvement et suspend temps actif/objectifs.
6. La fin fige le résultat au moment de l’action. [RunRepository.finish](../../src/storage/repository.ts) engage historique, outbox et retrait du brouillon dans une transaction ; un échec laisse une course récupérable en pause.

La récupération charge le dernier checkpoint **en pause**. L’interruption peut augmenter le temps total avec une estimation signalée ; elle n’ajoute ni distance ni temps actif. Une sauvegarde tardive ne doit pas recréer un brouillon terminé. Une base plus récente ou un brouillon illisible doit rester conservé.

## Stockages natifs

| Base | Source propriétaire | Contenu et portée |
|---|---|---|
| `sprinter-v1.db` | [open.ts](../../src/storage/open.ts), [repository.ts](../../src/storage/repository.ts) | `runs`, `draft`, `draft_points`, `draft_archives`, `settings`, `sync_outbox`, `sync_state`, `sync_meta` ; version 4 |
| `sprinter-workouts-v1.db` | [workouts/persistence.ts](../../src/workouts/persistence.ts) | Séances et préférences |
| `sprinter-progression-v1.db` | [progression/persistence.ts](../../src/progression/persistence.ts) | Calendrier, journal, objectifs, chaussures, plans ; sous-ensemble portable défini par les adaptateurs |
| `sprinter-tools-v1.db` | [routes/persistence.ts](../../src/routes/persistence.ts) | Itinéraires et préférences d’outils |
| `sprinter-apple-v1.db` | [apple/persistence.ts](../../src/apple/persistence.ts) | État Santé/Live Activity, propre à l’appareil |
| `sprinter-music-v1.db` | [spotify/device.ts](../../src/spotify/device.ts) | Références et préférences ; jetons dans SecureStore |
| `sprinter-account-v1.db` | [account/kv.ts](../../src/account/kv.ts) | Configuration, identifiant d’appareil et session chiffrée ; clé dans SecureStore |
| `sprinter-profile-v1.db` | [profile/database.ts](../../src/profile/database.ts), [localStore.ts](../../src/profile/localStore.ts) | Documents, brouillons, outbox et médias par titulaire ; ouverture au premier usage |

Le dépôt de course possède une file d’écriture sérialisée. `draft_points` ajoute les points au journal au lieu de réécrire le tracé complet. Les autres bases gardent leurs transactions et gardes de version. Les [adaptateurs de documents](../../src/sync/documentAdapters.ts) définissent le sous-ensemble synchronisé.

## Frontières de conservation

Le web utilise notamment [localStorage](../../src/storage/open.web.ts), sans accès à la sync ni au profil natifs. Les bases sportives ne bénéficient pas d’un chiffrement applicatif général ; le stockage sécurisé de session ne leur confère pas cette propriété.

Le module Apple normal exclut ses emplacements ciblés de la sauvegarde iCloud ; cette initialisation n’est pas disponible dans Expo Go et le sideload désactive le bridge Santé. Une base locale n’est pas une promesse de sauvegarde distante. Voir [intégrations](../features/integrations.md) et [rétention](../rgpd/durees-conservation.md).
