# 005 · Outbox locale et autorité serveur

Statut : **en vigueur**. [Décisions](README.md).

## Choix et raison

La sync est différée, reprenable et suspendue pendant une course, même en pause. Une outbox durable et des curseurs persistants réduisent le risque de perte lors d’une interruption ; les contrôles d’identité empêchent le mélange de comptes. Les tombstones rendent les suppressions prioritaires.

Le serveur force l’identité, valide les payloads et calcule l’éligibilité. Les policies contrôlent compte actif et session autorisée ; la clé publique n’est pas une protection suffisante. Les fonctions privilégiées ont des droits explicites, sans clé serveur dans l’app ou le site admin.

## Conséquences

- Toute nouvelle écriture synchronisée doit conserver atomicité locale, reprise et garde de titulaire ; ne pas ajouter un appel HTTP dans le moteur GPS.
- Les réglages portables sont en liste blanche ; une permission système reste locale.
- Le profil a sa sync propre ; les tracés exigent un choix distinct de celui des résumés.
- L’administration utilise rôle, capacité, AAL2, motif et audit selon l’opération ; `admin_whoami` est l’exception AAL1 d’orientation.
- `verify_jwt=false` ne dispense pas les Edge Functions de vérifier Auth/RPC ou le secret de tâche.

Sources : [sync.ts](../../src/sync/sync.ts), [engine.ts](../../src/sync/engine.ts), [0004](../../supabase/migrations/0004_privileges.sql), [0007](../../supabase/migrations/0007_sync.sql), [0009](../../supabase/migrations/0009_admin_core.sql). Détails : [sync](../backend/synchronisation.md), [backend](../backend/architecture.md).
