# Comptes, synchronisation et administration · guide technique

Référence fonctionnelle : [docs/specs/COMPTES_SYNC_ADMIN_v2_1.md](specs/COMPTES_SYNC_ADMIN_v2_1.md). Reconnaissance : [ACCOUNTS_RECON.md](ACCOUNTS_RECON.md). Ce guide décrit ce qui est livré, les commandes et les procédures d’exploitation. Il est mis à jour à chaque phase.

## 1. Architecture

```mermaid
flowchart LR
  subgraph Mobile["App Sprinter (Expo)"]
    UI[Écrans] --> Local[("SQLite local<br/>source de vérité")]
    Local --> Outbox[sync_outbox]
  end
  Outbox -- "HTTPS + JWT" --> API
  UI -- "lecture app_config (anon)" --> API
  subgraph SB["Supabase (UE)"]
    API["PostgREST / RPC"] --> DB[("Postgres + RLS")]
    EF["Edge Functions"] --> DB
    CRON[pg_cron] --> DB
  end
  Admin["Sprinter Admin (Next.js)"] -- "JWT admin AAL2 → RPC admin_*" --> API
```

- **Local-first** : l’app lit toujours SQLite ; le réseau n’est jamais sur le chemin critique d’une course.
- **Schémas** : `public` (seul exposé, RLS partout) · `private` (jamais exposé : annuaire, audit, agrégats, rôles admin) · `authz` (fonctions de contrôle appelées par les policies, sans table).
- **Contrôle d’accès aux données privées** : chaque policy compare `user_id` à `(select authz.active_uid())`, qui vaut l’utilisateur du JWT seulement si son compte est `active` dans `private.user_directory` **et** si la session du JWT existe encore dans `auth.sessions`. Un ancien JWT non expiré d’un compte désactivé, en cours de suppression ou dont la session a été révoquée ne lit donc rien.
- **Écritures** : par RPC `SECURITY DEFINER` (`search_path = ''`, `EXECUTE` accordé explicitement, jamais à `anon`), idempotentes.

## 2. Dépôt

```
supabase/
  config.toml           pile locale (seul public exposé, OTP 6 chiffres / 10 min, TOTP, liaison manuelle)
  migrations/           SQL versionné — jamais modifié après fusion
  tests/database/       pgTAP (000_helpers puis un fichier par domaine)
  seed.sql              données SYNTHÉTIQUES (2 000 comptes, ~21 000 courses)
src/account/            env, configuration distante, stockage local du module compte
scripts/check-no-secrets.cjs   garde anti-secrets (CI)
scripts/db-local/       banc d’essai SQL sans Docker (PostgreSQL éphémère + émulation Supabase)
```

`supabase/` est exclu de `tsconfig.json` et d’ESLint (Edge Functions en Deno).

## 3. Commandes

| Besoin | Commande |
|---|---|
| Vérification de l’app | `npm run check` (lint, types, garde anti-secrets, Vitest) puis `npx expo install --check` et `npx expo export --platform ios --platform web` |
| Base locale complète (Docker) | `supabase start` · `supabase db reset` · `supabase test db` · `supabase db lint --level warning` |
| Base sans Docker | `npm run test:db` (`--seed` pour charger la graine, `--seed-users 10000` pour le volume) — voir §5 |
| Garde anti-secrets seule | `npm run check:secrets` |
| Graine volumineuse (staging) | `psql "$DB_URL" -c "set sprinter.seed_users = 10000" -f supabase/seed.sql` |

## 4. Configuration distante et flags

`public.app_config` est la seule table lisible sans compte (valeurs `is_public`). L’app la lit **après** le démarrage (`startAppConfig` dans `App.tsx`), garde la dernière valeur connue dans `sprinter-account-v1.db`, relit en arrière-plan au-delà d’une heure (lancement, retour au premier plan) et **échoue en mode ouvert** : hors ligne, erreur ou réponse invalide, l’app fonctionne avec la valeur connue ou les défauts (tout éteint).

| Clé | Défaut | Phase |
|---|---|---|
| `accounts_enabled` | `false` | 1 — affiche Réglages › Compte et le bandeau « Sauvegardez vos courses » |
| `sync_enabled` | `false` | 2 |

Une fonction dépendante n’est jamais active sans son socle (ex. `sync_enabled` ignoré si `accounts_enabled` est faux). Jusqu’à la page Config de l’admin (phase 4d), un flag se change dans l’éditeur SQL du projet, en tant que propriétaire :

```sql
update public.app_config set value = 'true'::jsonb where key = 'accounts_enabled';
```

**Retour arrière** : remettre le flag à `false` suffit ; aucune mise à jour de l’app n’est nécessaire.

## 5. Comptes (phase 1)

### 5.1 Côté app

| Élément | Fichier |
|---|---|
| Client Supabase unique, chargé à la demande | `src/account/supabaseClient.ts` |
| Session chiffrée (clé AES-256 dans le trousseau, session chiffrée dans `sprinter-account-v1.db`) | `src/account/secureSession.ts` |
| État du compte, connexion, liaison, export, suppression | `src/account/accountStore.ts` (logique testée) · `src/account/account.ts` (branchement) |
| Apple (nonce brut → Supabase, SHA-256 → Apple) et Google natifs | `src/account/providers.ts` |
| Garde-fous du code e-mail (renvoi 60 s, 5 essais puis 15 min) | `src/account/otpGuard.ts` |
| Écrans | `src/account/ui/` (feuille Compte ouverte depuis Réglages) |

Points d’accroche dans l’existant : une section « Compte » dans `Settings.tsx` (visible seulement si le backend est configuré **et** `accounts_enabled` est vrai), la feuille `account` dans `AppSheets.tsx`, deux `useEffect` dans `App.tsx`, le bandeau dans `RunSummary.tsx`, et `purgeLocalRuns` (effacement local explicite) dans le dépôt de courses.

**Démarrage** : la bibliothèque Supabase et les modules natifs de connexion ne sont jamais importés statiquement (test `tests/account-startup.test.ts`). Le bundle iOS passe de 4 054 832 à 4 871 309 octets de bytecode Hermes (+816 Ko, +20 %) ; ces modules ne sont pas évalués au démarrage. Mesure du temps de démarrage sur iPhone à faire en recette (avant/après, compte absent).

### 5.2 Côté serveur

| Edge Function | Rôle | JWT |
|---|---|---|
| `delete-account` | POST : suppression avec authentification réelle < 5 min (claim `amr`) · GET `?operation=` : statut | vérifié dans la fonction (CORS de la page web) |
| `process-deletions` | reprise planifiée des suppressions interrompues | en-tête `x-cron-secret` |
| `apple-link` | échange du code d’autorisation Apple, jeton de rafraîchissement chiffré (AES-GCM) | oui |
| `export-my-data` | archive ZIP lue avec le JWT de l’utilisateur (RLS) | oui |

RPC ajoutées (`0006_accounts.sql`) : `record_consent` (idempotent par `client_event_id`, rejet des décisions obsolètes), `my_consents`, `register_device` (session liée à l’appareil), `disconnect_device` (révoque la session de l’appareil), `touch_activity` (jour local borné à [hier, demain]), `my_data_summary`, et les fonctions `service_*` réservées aux Edge Functions.

**Secrets des Edge Functions** (Supabase › Edge Functions › Secrets, jamais dans le dépôt) : `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_BUNDLE_ID` (= `app.sprinter.running`), `APPLE_PRIVATE_KEY` (contenu de la clé `.p8`), `APPLE_TOKEN_KEY` (32 octets aléatoires en base64 : `openssl rand -base64 32`), `CRON_SECRET`, `PUBLIC_WEB_ORIGINS` (ex. `https://<domaine>`).

**Tâche planifiée** : Supabase › Integrations › Cron, toutes les 15 minutes, requête HTTP POST vers `/functions/v1/process-deletions` avec l’en-tête `x-cron-secret` (valeur stockée dans Vault).

### 5.3 Fournisseurs (staging puis production)

1. **E-mail** : SMTP personnalisé (Authentication › SMTP), longueur du code 6, expiration 600 s, renvoi 60 s ; recopier les modèles `supabase/templates/magic_link.html` et `confirmation.html` (ils affichent `{{ .Token }}`).
2. **Apple** : activer « Sign in with Apple » sur `app.sprinter.running` ; dans Supabase › Auth › Apple, ajouter `app.sprinter.running` aux Authorized Client IDs.
3. **Google** : clients OAuth Web (renseigné dans Supabase), iOS et Android ; ajouter les identifiants iOS/Android aux Authorized Client IDs ; activer « Skip nonce checks » (la bibliothèque native gratuite ne transmet pas de nonce, §6.2).
4. **App** (variables EAS) : `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` (active le plugin Google au build), `EXPO_PUBLIC_SITE_URL` (liens CGU, confidentialité, suppression).
5. **Page web** : `web/supprimer-mon-compte/` (voir `web/README.md`).

Limite connue : le blocage après 5 codes faux est appliqué par l’app ; côté serveur, seule la limite par IP de Supabase (`token_verifications`) s’applique.

## 6. Banc d’essai SQL sans Docker

`scripts/db-local/run.mjs` initialise un PostgreSQL 17 éphémère, applique `scripts/db-local/supabase-shim.sql` (rôles `anon`/`authenticated`/`service_role`, `auth.users`/`identities`/`sessions`, `auth.uid()`/`jwt()`, `storage.buckets`/`objects`), toutes les migrations, pgTAP, puis exécute `supabase/tests/database/*.sql` (une connexion par fichier, comme `pg_prove`).

Prérequis : `cd scripts/db-local && npm install`, puis `PG_BIN` (dossier contenant `initdb` et `postgres`) et `PGTAP_SRC` (sources pgTAP décompressées). Par défaut : `~/.local/opt/pg17/…/native/bin` et `~/.local/opt/pgtap-src`.

Limites : les migrations y tournent en superutilisateur et `pg_cron` est absent (les migrations qui l’utilisent le détectent). **La référence reste la CI** (`supabase test db`).

## 7. Environnements et procédures

| Env | Supabase | Données |
|---|---|---|
| local | `supabase start` | `seed.sql` |
| staging | projet `sprinter-staging` (UE) | graine synthétique uniquement |
| prod | projet `sprinter-prod` (UE, plan Pro) | réelles — jamais copiées ailleurs |

**Appliquer les migrations sur staging** (Flo) : `supabase link --project-ref <ref-staging>` puis `supabase db push`. Vérifier ensuite le Security Advisor du projet. La production suit la même procédure après recette.

**Secrets** : saisis directement dans les gestionnaires (Supabase › Edge Functions › Secrets, Vercel, EAS). Jamais dans un fichier du dépôt ni dans une conversation.

## 8. Variables d’environnement (Annexe A)

| Variable | Où | Public |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | App (EAS env / `.env.local` non versionné) | oui |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME`, `EXPO_PUBLIC_SITE_URL` | App | oui |
| `APPLE_*`, `APPLE_TOKEN_KEY`, `CRON_SECRET`, `PUBLIC_WEB_ORIGINS` | Secrets des Edge Functions | **non** |

Sans ces deux variables, aucune fonction en ligne n’existe dans l’app. L’URL doit être en HTTPS (HTTP accepté uniquement pour `localhost`/`127.0.0.1`).
