# Contrat des RPC `admin_*` · Sprinter Admin

Version 1 · 14/11/2026 · Source de vérité côté base : `Flombt/Sprinter`, dossier `supabase/migrations/`.
Ce document fixe ce que le site `Flombt/sprinter-admin` peut appeler et ce qu’il reçoit. Toute évolution passe par une nouvelle version de ce contrat et une nouvelle migration.

## 1. Règles communes

- Appel : `supabase.rpc('<nom>', { ...params })` avec la session **de l’administrateur** (cookie `@supabase/ssr`, JWT AAL2). Jamais de clé `service_role` dans le site.
- Chaque fonction est `SECURITY DEFINER`, appelle `private.assert_admin('<capacité>')`, puis écrit sa ligne d’audit **dans la même transaction**.
- Dates de période : `date` au format `AAAA-MM-JJ`, jours calendaires `Europe/Paris`, bornes **incluses**. Durée maximale d’une période : 366 jours (sinon `invalid_parameter:period`).
- Toutes les réponses sont un unique `jsonb`. Les nombres non mesurés valent `null` et le champ `unavailable: true` est présent : **ne jamais afficher 0 à la place**.
- Les identifiants courts (`short_id`) sont les 8 premiers caractères hexadécimaux de l’UUID.
- Les e-mails sont **masqués** (`f***@gmail.com`) partout sauf dans `admin_get_user`.

### 1.1 Erreurs

Les erreurs remontent comme erreurs PostgREST (`error.code` = SQLSTATE, `error.message` = code stable ci-dessous). Le site affiche un message générique et l’identifiant de corrélation, jamais le détail SQL.

| SQLSTATE | `message` | Sens | Réaction attendue du site |
|---|---|---|---|
| `28000` | `unauthenticated` | Pas de JWT | Retour à `/login` |
| `42501` | `forbidden` | Pas administrateur, compte inactif, capacité absente | « Accès refusé » générique + déconnexion si `admin_whoami` |
| `42501` | `aal2_required` | Session AAL1 | Redirection vers le défi TOTP |
| `42501` | `reauth_required` | Action sensible sans authentification de moins de 5 min | Nouveau défi TOTP puis nouvel essai |
| `22023` | `invalid_parameter:<nom>` | Paramètre hors liste blanche ou invalide | Message de formulaire |
| `22023` | `reason_required` | Motif d’accès absent ou invalide | Ouvrir la boîte « Motif d’accès » |
| `22023` | `confirmation_mismatch` | Confirmation typée incorrecte | Message dans `ConfirmDialog` |
| `P0002` | `not_found` | Cible inexistante | État « introuvable » |

### 1.2 Capacités

| Capacité | owner | support | analyst |
|---|:-:|:-:|:-:|
| `overview.read`, `quality.read` | ✔ | ✔ | ✔ |
| `analytics.read`, `leaderboard.aggregate`, `export.aggregates` | ✔ | | ✔ |
| `leaderboard.nominative` | ✔ | | |
| `users.search`, `users.read_profile` | ✔ | ✔ (tranche d’âge masquée) | |
| `runs.read_summary` | ✔ | ✔ | |
| `users.manage` | ✔ | | |
| `support.manage` | ✔ | ✔ | |
| `config.write`, `audit.read`, `admins.manage` | ✔ | | |
| `moderation.read`, `moderation.decide` (phase 8c) | ✔ | ✔ si habilitation `moderation` | |

### 1.3 Motif d’accès

`p_reason` ∈ `support` · `data_request` · `technical` · `other`. `p_reason_note` facultatif, ≤ 200 caractères, sans donnée personnelle superflue. Le site mémorise le dernier motif pour la session (sessionStorage), mais l’envoie à **chaque** appel concerné.

### 1.4 Ré-authentification récente

Les actions marquées « réauth » exigent dans le JWT une entrée `amr` datée de moins de 300 s (`otp` ou `totp`). Le site déclenche `supabase.auth.mfa.challengeAndVerify` (TOTP) puis `supabase.auth.refreshSession()` avant de relancer l’appel.

## 2. Fonctions

### `admin_whoami()` — aucune capacité, AAL1 accepté

```json
{ "user_id": "uuid", "short_id": "1a2b3c4d", "role": "owner", "aal": "aal1",
  "capabilities": ["overview.read", "..."], "moderation": false,
  "reauth_valid_until": "2026-11-14T10:05:00Z" }
```
`capabilities` est vide tant que `aal` ≠ `aal2`. Non-administrateur → erreur `forbidden`.

### `admin_overview(p_from date, p_to date, p_compare boolean default true)` — `overview.read`

```json
{
  "period": { "from": "2026-11-01", "to": "2026-11-14", "days": 14, "timezone": "Europe/Paris" },
  "compare_period": { "from": "2026-10-18", "to": "2026-10-31" },
  "updated_at": "2026-11-14T01:15:03Z",
  "kpis": {
    "signups":        { "value": 42, "previous": 30, "series": [{ "day": "2026-11-01", "value": 3 }] },
    "dau":            { "value": 120, "previous": 100, "series": [] },
    "wau":            { "value": 300, "previous": 280, "series": [] },
    "mau":            { "value": 800, "previous": 750, "series": [] },
    "stickiness":     { "value": 0.15, "previous": 0.13, "series": [] },
    "activation":     { "value": 0.41, "previous": 0.38, "series": [] },
    "runs":           { "value": 950, "previous": 900, "series": [] },
    "distance_km":    { "value": 7123.4, "previous": 6900.1, "series": [] },
    "avg_pace_s_per_km": { "value": 342.5, "median": 351.0, "previous": 345.0, "series": [] },
    "runs_per_active":   { "value": 1.2, "previous": 1.1, "series": [] },
    "sync_success":   { "value": 0.97, "previous": 0.95, "series": [] },
    "guest_conversion": { "value": null, "previous": null, "series": [], "unavailable": true }
  },
  "providers": [ { "provider": "apple", "accounts": 120 }, { "provider": "google", "accounts": 80 }, { "provider": "email", "accounts": 60 } ],
  "providers_note": "Un compte relié à plusieurs fournisseurs compte dans chacun.",
  "versions": [ { "platform": "ios", "app_version": "1.0.0", "devices": 90 } ]
}
```
- `value` porte sur la période, `previous` sur la période précédente de même durée (`null` si `p_compare = false`).
- `dau` = moyenne des actifs quotidiens de la période ; `wau`/`mau` = valeur au dernier jour de la période (fenêtres glissantes 7/30 j). `series` contient un point par jour (≤ 366, sous-échantillonné à ≤ 500 points).
- La variation se calcule côté site : `previous` nul ou égal à 0 → « n/d ».
- « Aujourd’hui » est calculé en direct ; les jours passés viennent de `private.daily_metrics`.

### `admin_list_audit(p_cursor jsonb default null, p_filters jsonb default '{}', p_limit int default 50)` — `audit.read`

Filtres : `action[]`, `admin_id`, `target_user_id`, `from`, `to`. Curseur keyset `{ "at": "…", "id": 123 }` (ordre décroissant).
```json
{ "items": [ { "id": 123, "at": "…", "admin_id": "uuid|null", "admin_short": "1a2b3c4d|système",
               "action": "user.view", "target_user_id": "uuid|null", "target_short": "…",
               "reason": "support", "metadata": { } } ],
  "next_cursor": { "at": "…", "id": 122 } }
```
La consultation du journal n’est pas elle-même journalisée (lecture seule, capacité réservée à `owner`).

### `admin_search_users(p_q text default null, p_filters jsonb default '{}', p_sort text default '-signed_up_at', p_cursor jsonb default null, p_limit int default 50)` — `users.search`

- `p_q` : ≥ 2 caractères (≥ 3 s’il contient `@`). UUID/hexadécimal ≥ 8 → préfixe d’id ; contient `@` → e-mail (préfixe puis trigramme) ; sinon `display_name` (trigramme, sans accents ni casse).
- Filtres acceptés (toute autre clé → `invalid_parameter:filters.<clé>`) : `signup_from`, `signup_to`, `last_active_from`, `last_active_to` (dates), `status[]` (`active|disabled|deleting`), `provider[]` (`apple|google|email`), `platform[]` (`ios|android`), `app_version[]`, `country[]` (ISO 3166-1 alpha-2), `city[]` (≤ 80 car.), `runs_min`, `runs_max`, `km_min`, `km_max` (nombres ≥ 0).
- Tri (liste blanche, préfixe `-` = décroissant) : `signed_up_at`, `last_active_day`, `display_name`, `runs_count`, `distance_km`.
- `p_limit` ≤ 100. Curseur keyset opaque renvoyé par la fonction.
```json
{ "items": [ { "user_id": "uuid", "short_id": "1a2b3c4d", "display_name": "Camille", "email_masked": "c***@example.com",
               "providers": ["apple"], "status": "active", "signed_up_at": "…", "last_active_day": "2026-11-12",
               "platforms": ["ios"], "runs_count": 12, "distance_km": 84.2 } ],
  "total": 1234, "total_capped": false, "next_cursor": "opaque|null" }
```
`total` est exact jusqu’à 10 000 ; au-delà `total = 10000` et `total_capped = true` (« 10 000+ »). Audit `user.search` avec **types de filtres seulement** (`{"filters":["platform","runs_min"],"q_kind":"email"}`), jamais le texte saisi.

### `admin_get_user(p_user_id uuid, p_reason text, p_reason_note text default null)` — `users.read_profile`

```json
{ "user_id": "uuid", "short_id": "1a2b3c4d", "display_name": "Camille", "status": "active",
  "providers": ["apple", "email"], "signed_up_at": "…", "last_active_day": "…",
  "email": "camille@example.com", "country_code": "FR", "city": "Lyon",
  "age_band": "25-34", "age_band_hidden": false,
  "devices": [ { "platform": "ios", "os_version": "27.0", "app_version": "1.0.0", "last_seen_at": "…",
                 "last_sync_at": "…", "last_sync_status": "ok", "last_sync_error_code": null } ],
  "activity": { "runs_count": 12, "distance_km": 84.2, "active_days_30": 5, "last_run_at": "…" },
  "consents": [ { "purpose": "cloud_sync_runs", "granted": true, "version": "1", "at": "…" } ],
  "support": [ { "id": "uuid", "category": "sync", "status": "open", "created_at": "…" } ],
  "deletion": { "status": "pending", "requested_at": "…" } }
```
Pour le rôle `support` : `age_band = null` et `age_band_hidden = true`. **Aucun détail de course, aucun tracé.** Audit `user.view` avec le motif.

### Actions sur un compte — Edge Function `admin-user-action` — `users.manage` + réauth

`POST {SUPABASE_URL}/functions/v1/admin-user-action` · en-têtes `Authorization: Bearer <jeton admin>`, `apikey: <clé publique>` · corps :
```json
{ "user_id": "uuid", "action": "disable|enable|revoke_sessions|process_deletion",
  "reason": "support|data_request|technical|other", "reason_note": "…",
  "confirmation": "SUPPRIMER 1a2b3c4d" }
```
`confirmation` obligatoire pour `process_deletion` (= `SUPPRIMER <short_id>`). Réponse `200 { "ok": true, "action": "disable", "status": "disabled" }`, ou `4xx { "error": "<code du §1.1>" }`. La fonction appelle d’abord `admin_authorize_user_action` avec le jeton de l’administrateur (contrôle + audit en base), puis applique les effets côté Auth avec sa clé serveur.

### `admin_leaderboard(p_metric text, p_period text, p_filters jsonb default '{}', p_mode text default 'aggregate', p_reason text default null, p_reason_note text default null)`

- Métriques : `runs_count`, `distance_total`, `longest_run`, `active_days`, `active_weeks`, `best_effort_1k`, `best_effort_5k`, `best_effort_10k`, `best_effort_21k`. Périodes : `week`, `month`, `year`, `all` (période courante, fuseau `Europe/Paris`).
- Filtres : `platform[]`, `country[]`.
- Éligibilité (§9.2) : `source = 'sprinter'`, `validity = 'valid'`, `distance_m ≥ 1000`, `active_s ≥ 300`, non supprimée.
- `aggregate` (`leaderboard.aggregate`) :
```json
{ "mode": "aggregate", "metric": "distance_total", "period": "month", "unit": "km",
  "eligible_users": 420, "lower_is_better": false,
  "percentiles": { "p10": 4.2, "p25": 10.5, "p50": 22.0, "p75": 41.3, "p90": 70.8 },
  "histogram": [ { "from": 0, "to": 10, "users": 120 } ],
  "suppressed_buckets": 1,
  "method": "Somme de distance_m des courses éligibles (§9.2) …" }
```
Les classes d’histogramme de moins de 10 comptes sont fusionnées avec leur voisine ; s’il en reste, elles sont comptées dans `suppressed_buckets` et absentes de `histogram`.
- `nominative` (`leaderboard.nominative` + motif + réauth, audit `leaderboard.view_nominative`) : `{ "mode": "nominative", "metric", "period", "unit", "items": [ { "rank": 1, "user_id": "uuid", "short_id": "…", "display_name": "…", "value": 123.4, "achieved_at": "…" } ] }` — top ≤ 50, égalités départagées par la date la plus ancienne, ni e-mail ni tracé.

### `admin_analytics(p_view text, p_from date, p_to date, p_filters jsonb default '{}')` — `analytics.read`

Vues (`p_view`) et forme de réponse (`{ "view", "from", "to", "method", … }`) :

| Vue | Champs |
|---|---|
| `signups` | `series: [{day, value}]` |
| `activity` | `series: [{day, dau, wau, mau}]` |
| `distance_histogram`, `duration_histogram`, `frequency_histogram` | `histogram: [{from, to, value}]`, `unit` |
| `retention` | `cohorts: [{cohort_week, size, d1, d7, d30, w: [s1…s8]}]` (taux 0–1, `null` si non observable encore) |
| `platform_compare` | `rows: [{platform, accounts, active, runs, distance_km}]` |
| `breakdown_country`, `breakdown_city`, `breakdown_age_band` | `rows: [{key, accounts, runs, distance_km}]`, `other: {accounts, runs, distance_km} | null`, `suppressed: boolean` |

Filtres : `platform[]`, `provider[]`. Ventilations : comptes distincts ; cellules < 10 comptes regroupées dans `other` ; si `other` < 10 il est masqué (`other = null`, `suppressed = true`) et les totaux ne sont pas renvoyés afin qu’aucune cellule masquée ne soit déductible.

### `admin_runs_stats(p_from date, p_to date, p_filters jsonb default '{}')` — `analytics.read`

```json
{ "runs": 950, "distance_km": 7123.4, "active_hours": 712.3,
  "avg_pace_s_per_km": 342.5, "median_pace_s_per_km": 351.0,
  "validity": { "valid": 900, "suspect": 40, "invalid": 10 },
  "sources": { "sprinter": 880, "healthkit": 60, "gpx": 10 },
  "incomplete": 3,
  "series": [ { "day": "2026-11-01", "runs": 70, "distance_km": 520.3 } ],
  "method": "Volume : courses non supprimées et non invalides (§9.2). Allure moyenne = Σ temps actif ÷ Σ distance." }
```

### `admin_quality(p_from date, p_to date)` — `quality.read`

```json
{ "devices_seen": 400, "sync_success_rate": 0.97, "never_synced_devices": 12,
  "errors_by_code": [ { "code": "network", "devices": 5 } ],
  "errors_by_version": [ { "platform": "ios", "app_version": "1.0.0", "devices": 90, "errors": 3 } ],
  "version_adoption": [ { "platform": "android", "app_version": "1.0.0", "devices": 30, "share": 0.3 } ],
  "crash_reporting": { "available": false } }
```

### Support — `support.manage`

- `admin_list_support(p_status text[] default null, p_cursor jsonb default null, p_limit int default 50)` → `{ "items": [ { "id", "user_id", "short_id", "category", "message", "status", "internal_note", "platform", "app_version", "created_at", "updated_at", "closed_at" } ], "next_cursor" }`.
- `admin_update_support(p_id uuid, p_status text default null, p_internal_note text default null)` → ligne mise à jour. Audit `support.update` (métadonnées : statut, présence d’une note — jamais son texte).

### Configuration de l’app — lecture `overview.read`, écriture `config.write` + réauth

- `admin_get_config()` → `{ "items": [ { "key": "sync_enabled", "value": false, "updated_at": "…", "schema": { "type": "boolean" } } ] }`.
- `admin_set_config(p_key text, p_value jsonb, p_reason text)` → `{ "key", "value", "updated_at" }`. Clés et schémas :

| Clé | Valeur |
|---|---|
| `accounts_enabled`, `sync_enabled`, `routes_sync_enabled`, `support_enabled`, `leaderboard_enabled`, `profiles_enabled`, `profile_studio_enabled`, `profile_sharing_enabled`, `theme_library_enabled`, `profile_cards_enabled` | booléen |
| `min_version` | `{ "ios": "1.0.0", "android": "1.0.0" }` (semver `x.y.z`) |
| `maintenance` | `{ "enabled": false, "message": "texte ≤ 280 car." | null }` |

Audit `config.write` avec l’ancienne et la nouvelle valeur.

### `admin_export_aggregates(p_kind text, p_from date, p_to date, p_format text default 'standard')` — `export.aggregates`

`p_kind` ∈ `daily_kpis`, `runs_by_day`, `versions`, `breakdown_country`. `p_format` ∈ `standard` (`,`, UTF-8) ou `excel_fr` (`;`, BOM UTF-8, décimales à virgule). Période ≤ 366 jours.
```json
{ "filename": "sprinter-daily_kpis-2026-11-01_2026-11-14.csv", "content_type": "text/csv; charset=utf-8", "csv": "…" }
```
Aucune donnée personnelle. Audit `export.aggregates`.

### Modération (phase 8c) — `moderation.read` / `moderation.decide`

- `admin_list_reports(p_status text[] default array['open'], p_cursor jsonb default null, p_limit int default 50)` → `{ "items": [ { "id", "created_at", "status", "reason", "target_short", "element_kind", "excerpt", "reports_count" } ], "next_cursor": { "created_at", "id" } | null }`. Statuts : `open`, `actioned`, `dismissed` ; tri par `created_at` décroissant ; `reports_count` = signalements de même statut sur le même contenu ; `excerpt` = copie limitée de l’élément partagé signalé (texte ≤ 280 car. ou `média <id>`), rien d’autre ; `element_kind` ∈ `identity`, `avatar`, `banner`, `about`, `status`, `widget`, `profile`, `handle`.
- `admin_get_report(p_report_id uuid, p_reason text)` → `{ "report": <élément de liste>, "element": { "kind", "text" (≤ 2 000), "media_ref" ("profile-media:<id>" ou null), "media_url" (null en v1), "visibility" (état de modération de la version publiée), "published_at" }, "history": [ { "at", "decision", "reason", "admin_short", "note" } ] }`. Audit `moderation.view` avec le motif. Jamais de brouillon, de média privé, de tracé ni de statistique non publiée.
- `admin_moderate(p_report_id uuid, p_decision text, p_reason text, p_note text default null)` — `p_decision` ∈ `hide`, `remove`, `restore`, `dismiss` → `{ "report_id", "decision", "status" }` (`actioned`, ou `dismissed` pour `dismiss`). Tous les signalements ouverts du même contenu prennent la décision. `hide` masque l’élément publié (examen en cours), `remove` le retire (une republication sans modification du contenu le laisse retiré), `restore` le rétablit ; le titulaire reçoit une notification (`profile_notices`) qu’il peut contester auprès du support. Pour un pseudo de classement (`handle`), `hide`/`remove` le masquent du classement. Audit `moderation.decide` (décision, motif, référence du signalement).

## 3. Ce que le site ne fait jamais

Lire une table directement · utiliser `service_role` · afficher un tracé, une carte ou une position · exporter des données personnelles · journaliser un e-mail, un texte de recherche ou un jeton · mettre en cache partagé une réponse admin.
