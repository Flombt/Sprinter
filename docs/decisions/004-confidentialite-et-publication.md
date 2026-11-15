# 004 · Partager seulement après un choix explicite

Statut : **en vigueur**. [Décisions](README.md).

## Choix et raison

La copie de parcours proposée au partage masque par défaut les zones de départ et d’arrivée ; la copie complète est un choix explicite. Le masquage inclut les retours dans ces zones et les arêtes qui les traversent pour éviter une fuite par reconnexion du tracé. Il réduit l’exposition sans garantir l’anonymat.

Pour les profils, brouillon, version privée enregistrée et publication sont distincts. Un lien est révocable ; la publication demande une confirmation et une époque valide. Cela évite qu’une ancienne synchronisation republie un contenu retiré. Les retraits hors ligne sont annoncés en attente jusqu’à confirmation serveur.

## Conséquences

- Ne pas transformer un export public en envoi privé complet sans nouveau choix.
- Garder les buckets privés, revérifier chaque lecture visiteur/média et préserver blocages et modération.
- Une bibliothèque de thèmes partage du style, sans photos, textes personnels ou statistiques ; les cartes sont générées localement après aperçu.
- Ne pas appeler « tout chiffré » le stockage sportif local ; distinguer session sécurisée et données de course.

Sources : [privacy.ts](../../src/sharing/privacy.ts), [documents.ts](../../src/sharing/documents.ts), [sharingModel.ts](../../src/profile/sharingModel.ts), [0017](../../supabase/migrations/0017_profile_sharing.sql), [0018](../../supabase/migrations/0018_theme_library.sql). Détails : [partage](../features/analyse-parcours-partage.md), [profils](../features/profils-et-communaute.md).
