# Architecture du backend

[Carte documentaire](../00-INDEX.md) · [Exploitation](exploitation.md) · [Synchronisation](synchronisation.md)

Le dépôt contient **20 migrations SQL**, **10 Edge Functions**, des tests pgTAP et Deno. Leur présence prouve une implémentation versionnée, pas l’état d’un projet distant. Les anciens constats de déploiement sont conservés dans les [archives](../archive/README.md).

## Frontières de sécurité

PostgREST expose seulement `public` selon [config.toml](../../supabase/config.toml). `private` conserve annuaire, audit, suppressions et données d’administration ; `authz` porte les aides de policies. Les tables publiques sont protégées par RLS ; les écritures sensibles passent par des RPC avec droits explicites. Les contrôles vérifient aussi compte actif et session autorisée, pas seulement un ancien `auth.uid()`.

Les clés serveurs restent dans Deno. [supabase.ts](../../supabase/functions/_shared/supabase.ts) sépare clients service et utilisateur ; ce dernier transmet le JWT et reste soumis à RLS. `verify_jwt=false` désactive la passerelle historique pour les fonctions configurées : **chaque entrée conserve son contrôle Auth/RPC ou son secret de tâche**. Ne jamais supprimer ces contrôles en se fiant à la passerelle.

## Carte des migrations

| Sources | Responsabilité |
|---|---|
| [0001](../../supabase/migrations/0001_foundations.sql), [0002](../../supabase/migrations/0002_user_schema.sql), [0003](../../supabase/migrations/0003_private_schema.sql) | Schémas, utilitaires, données utilisateur et administration |
| [0004](../../supabase/migrations/0004_privileges.sql), [0005](../../supabase/migrations/0005_triggers_config.sql) | Privilèges, RLS, contrôles de session, triggers et défauts de configuration |
| [0006](../../supabase/migrations/0006_accounts.sql) | Consentements, appareils, activité minimale, export/suppression et jetons Apple chiffrés |
| [0007](../../supabase/migrations/0007_sync.sql), [0008](../../supabase/migrations/0008_secondary_documents.sql) | Courses, préférences, validité, tombstones et documents secondaires |
| [0009](../../supabase/migrations/0009_admin_core.sql) | Rôles/capacités, AAL2, audit, indicateurs et métriques quotidiennes |
| [0010](../../supabase/migrations/0010_routes.sql) | Tracés GPS, bucket privé et autorisations de sauvegarde |
| [0011](../../supabase/migrations/0011_admin_users.sql), [0012](../../supabase/migrations/0012_admin_rankings.sql), [0013](../../supabase/migrations/0013_admin_ops.sql) | Recherche, classements, agrégats, support, configuration, export, rétention |
| [0014](../../supabase/migrations/0014_community.sql) | Classement communautaire volontaire et signalements |
| [0015](../../supabase/migrations/0015_profiles.sql), [0016](../../supabase/migrations/0016_profile_studio.sql) | Profil privé, médias, studio et badges |
| [0017](../../supabase/migrations/0017_profile_sharing.sql), [0018](../../supabase/migrations/0018_theme_library.sql) | Publication, recherche, blocage, modération et thèmes |
| [0019](../../supabase/migrations/0019_validity_job.sql), [0020](../../supabase/migrations/0020_moderation_media.sql) | Recalcul périodique de validité et lecture contrôlée d’un média signalé |

Les signatures et contraintes restent dans SQL ; ne pas recopier tous les schémas dans la documentation. Les tests correspondants sont dans [supabase/tests/database/](../../supabase/tests/database/).

## Edge Functions

| Entrée | Contrôle / rôle |
|---|---|
| [delete-account](../../supabase/functions/delete-account/index.ts) | Utilisateur vérifié et réauthentification récente ; suppression reprenable |
| [process-deletions](../../supabase/functions/process-deletions/index.ts) | `x-cron-secret` ; reprise des demandes |
| [purge-storage](../../supabase/functions/purge-storage/index.ts) | `x-cron-secret` ; API Storage et acquittement de file |
| [inactive-accounts](../../supabase/functions/inactive-accounts/index.ts) | `x-cron-secret` ; notification puis traitement d’inactivité |
| [apple-link](../../supabase/functions/apple-link/index.ts) | Identité utilisateur ; échange et conservation chiffrée du jeton révocable |
| [export-my-data](../../supabase/functions/export-my-data/index.ts) | Utilisateur actif ; archive lue sous ses droits |
| [admin-user-action](../../supabase/functions/admin-user-action/index.ts) | JWT admin, capacité, AAL2/réauth via RPC ; action privilégiée |
| [profile-media-commit](../../supabase/functions/profile-media-commit/index.ts) | Titulaire vérifié, réservation autorisée et vérification du fichier |
| [profile-media](../../supabase/functions/profile-media/index.ts) | Visiteur authentifié et autorisation relue avant chaque média |
| [admin-report-media](../../supabase/functions/admin-report-media/index.ts) | Média signalé autorisé par RPC admin, motif et audit |

La logique partagée vit dans [_shared/](../../supabase/functions/_shared/) ; les tests dans [functions/tests/](../../supabase/functions/tests/). La suppression inclut les fichiers et la révocation Apple ; l’export distingue les données en ligne des seules données locales.

## Administration

Le contrat pour `Flombt/sprinter-admin` est [admin-rpc-contract.md](admin-rpc-contract.md). L’identité admin vient de `private.admin_users`, pas de métadonnées utilisateur. Les opérations utilisent capacités, motif et audit ; les actions sensibles exigent une réauthentification réelle récente. **Exception : `admin_whoami` accepte AAL1** pour orienter l’enrôlement/défi TOTP ; les données protégées exigent AAL2.

Ne pas annoncer une interface Next.js livrée dans ce dépôt. Ses fichiers, son hébergement, ses en-têtes et Cloudflare Access demandent une vérification distincte.
