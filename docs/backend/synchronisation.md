# Synchronisation et sauvegardes

[Architecture backend](architecture.md) · [Comptes](../features/comptes.md) · [Décision locale](../decisions/001-calcul-local-et-persistance.md)

## Garde et déclenchement

[sync.ts](../../src/sync/sync.ts) active le moteur sur natif avec backend, session connectée et `sync_enabled` (dépendant de `accounts_enabled`). Le choix de sauvegarde reste distinct du flag. Aucune sync des courses ou du profil ne s’exécute pendant une course, même en pause ; la garde est relue entre les étapes.

Déclencheurs : retour au premier plan, retour réseau, état compte/flags et historique modifié après un délai de trois secondes. [engine.ts](../../src/sync/engine.ts) sérialise les passages ; [localStore.ts](../../src/sync/localStore.ts) conserve état, outbox, métadonnées et curseurs dans la base de course. Une fin/suppression de course et son événement d’outbox sont atomiques dans [repository.ts](../../src/storage/repository.ts).

## Courses, réglages et conflits

Les envois se font par lots bornés, avec reprises et attente progressive. Le curseur de réception est ordonné par horodatage serveur puis identifiant ; une fenêtre de recouvrement évite de perdre des changements proches. Une longue absence demande une réconciliation complète ; les valeurs de budget restent dans le moteur.

Le serveur force le titulaire et dérive les colonnes du payload dans [0007_sync.sql](../../supabase/migrations/0007_sync.sql). Dernière écriture acceptée et tombstones définissent les conflits ; une suppression prioritaire ne doit pas ressusciter. Les [doublons probables](../../src/sync/duplicates.ts) sont signalés sans suppression automatique.

[settings.ts](../../src/sync/settings.ts) définit la liste portable : `config`, audio, haptiques, apparence, auto-pause et coaching. Le suivi de fond, lié à une permission, reste local comme Santé et Spotify. Les clés inconnues ne doivent pas acquérir silencieusement une portée cloud.

Le lien local à un compte empêche d’importer les données A dans B. [resetDeviceForCurrentAccount](../../src/sync/sync.ts) effectue un nettoyage contrôlé des stores avant de lier B ; une interruption doit garder le blocage et permettre de réessayer. Ne pas remplacer ce mécanisme par un changement direct d’identifiant.

## Documents secondaires

[documents.ts](../../src/sync/documents.ts), [documentAdapters.ts](../../src/sync/documentAdapters.ts) et [0008](../../supabase/migrations/0008_secondary_documents.sql) portent séances, chaussures, plans et itinéraires. Les plans transportent leur plan et leurs entrées à la création ; une chaussure supprimée ailleurs est archivée localement. Les itinéraires contenant des coordonnées exigent aussi le choix GPS. Calendrier entier, journal, favoris musicaux et préférences natives ne sont pas tous synchronisés.

## Tracés GPS cloud

[routes.ts](../../src/sync/routes.ts) compresse les points hors course et utilise le bucket privé `run-tracks` défini par [0010](../../supabase/migrations/0010_routes.sql). Conditions : sauvegarde courses active, choix GPS distinct et `routes_sync_enabled`. L’envoi est prévu sur Wi-Fi, par petits lots, avec plafond de 8 Mio compressés. Le nom d’objet encode l’identifiant de course sous le titulaire.

Le résumé de course et le tracé sont distincts. Le tracé est téléchargé à la demande depuis le détail avec contrôle d’identité et de disponibilité. L’aperçu limité masque les extrémités ; ce n’est pas la suppression des points du fichier privé. Les révocations et suppressions en ligne passent par les RPC et la file de purge.

## Validation

Tests : [sync-engine](../../tests/sync-engine.test.ts), [migration](../../tests/sync-migration.test.ts), [documents](../../tests/sync-documents.test.ts), [routes](../../tests/sync-routes.test.ts), [SQL](../../supabase/tests/database/). Les [résultats actuels](../quality/validation.md) ne valident pas deux téléphones réels ; utiliser les [scénarios de sync](../quality/recettes/synchronisation.md) et [tracés](../quality/recettes/traces-gps.md).
