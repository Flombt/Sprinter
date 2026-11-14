# Reconnaissance · comptes, synchronisation, administration

Phase 0 du cahier des charges v2.1 ([docs/specs/COMPTES_SYNC_ADMIN_v2_1.md](specs/COMPTES_SYNC_ADMIN_v2_1.md)). Relevé du 14/11/2026 sur `main` à **`6e34f57`** (fusion de la PR n° 74, « Restaurer la navigation, les palettes et la bibliothèque Spotify »). À relire par Flo.

## 1. Écarts avec le §3

| Sujet | §3 (v2) | Observé | Conséquence |
|---|---|---|---|
| Commit de référence | `83dbb86` | `6e34f57` (deux commits de plus : restauration de la navigation, des palettes et de Spotify) | Les branches `feat/*` partent de `6e34f57` |
| `codex/refonte-ui` | en avance sur `main` | **entièrement fusionnée** : 0 commit d’avance, 12 de retard (`286026a`) | Aucun risque de conflit immédiat ; la règle « ne pas toucher » reste appliquée |
| Tests | 15 fichiers, 164 tests | **23 fichiers, 230 tests** verts (Vitest 5.0.5) | La règle « tests existants verts » porte sur 230 tests |
| Lint | — | 0 erreur, 6 avertissements préexistants | Base de comparaison des PR |
| Stack | Expo SDK 58, RN 0.88, React 19.3 | `expo ~58.0.25`, `react-native 0.88.1`, `react 19.3.0`, TypeScript `~6.0.3`, ESLint 9, Node 24 en CI | Conforme |
| Natif iOS | `modules/sprinter-apple`, `expo-widgets`, `expo-glass-effect`, `expo-symbols`, `@expo/ui` | `expo-symbols` **n’est pas utilisé** ; `@expo/ui/swift-ui` seulement dans `src/apple/RunLiveActivity.tsx` | Périmètre de la phase 5 réduit d’autant |

Les autres observations du §3 sont confirmées : aucun backend, données locales, Spotify/Strava préparatoires, `expo-crypto` et `expo-secure-store` déjà présents, bundle `app.sprinter.running` sur iOS et Android, pas de `FOREGROUND_SERVICE_LOCATION`.

## 2. Identifiants de course

- Nouvelle course : `src/core/engine.ts:42` → `` `${startedAt}-${Math.random().toString(36).slice(2, 12)}` `` (horodatage en ms + 10 caractères base 36, ≈ 51 bits aléatoires).
- Import Santé : `healthkit:<uuid en minuscules>` (`src/services/session.ts`, `importHealthActivity`).
- Archives de récupération : identifiants locaux, jamais synchronisés.

**Décision** : le générateur est suffisamment résistant aux collisions pour un même utilisateur, et la clé serveur `(user_id, id)` exclut toute collision entre comptes. On le garde tel quel (aucune réécriture d’identifiants existants, aucun changement de comportement).

## 3. Points d’accroche de l’outbox (base `sprinter-v1.db`, `src/storage/repository.ts`)

| Écriture | Où | Transaction actuelle | Accroche phase 2 |
|---|---|---|---|
| Fin de course / import Santé | `RunRepository.finish` (appelé par `session.finish` et `session.importHealthActivity`) | `BEGIN IMMEDIATE` … `COMMIT` | Insérer `sync_outbox (run, upsert)` et `runs.updated_at` dans la même transaction |
| Suppression | `RunRepository.deleteRun` | requête isolée | L’envelopper dans une transaction avec `sync_outbox (run, delete)` |
| Réglages | `RunRepository.saveSettings` | requête isolée | Idem avec `sync_outbox (settings, upsert)` ; seuls les réglages portables partent |

Toutes les écritures passent par la file sérialisée `RunRepository.write`. `PRAGMA user_version` vaut 3 avec une garde contre les rétrogradations (`> 3` refusé) ; la phase 2 passe à 4. Les tests de stockage utilisent `node:sqlite` : l’outbox se teste avec du vrai SQL.

Unités du `RunRecord` : `startedAt`/`endedAt` en ms, `activeSeconds`/`totalSeconds`/`reliableSeconds` en s, `distanceMeters` en m, **`bestPace` en s/km** (`engine.ts:249`), `ascentMeters` en m. Type de séance : `payload.workout.definition.kind`, sinon `free`.

## 4. Points d’insertion dans l’interface

- **Réglages** : feuille modale `src/navigation/AppSheets.tsx` → `src/screens/Settings.tsx`, avec des pages internes (`page`). L’entrée **Compte** s’ajoute comme une section en tête de la page principale (une `ListRow`), et les écrans du compte comme pages de cette feuille ou écrans de `RootStack` (`src/navigation/RootStack.tsx`, `routes.ts`). La page « Vos données » existante reste la référence pour le stockage local.
- **Démarrage** : `App.tsx` (`AppContent`) initialise la session, la progression, la musique et les séances. Le module compte s’y branche par un `useEffect` non bloquant (`startAppConfig`).
- **Fin de course** : `App.tsx` → `session.finish()` → `RunRepository.finish` ; le déclenchement de la synchro (anti-rebond 3 s) se branchera sur l’émission de la nouvelle histoire.
- **Détail de course** : `src/screens/Detail.tsx` gère déjà l’absence de points pour les imports Santé (`healthKit`), point d’accroche du téléchargement à la demande des tracés (phase 3).

## 5. Autres bases locales

| Base | Contenu | Version | Synchronisée ? |
|---|---|---|---|
| `sprinter-v1.db` | `runs`, `draft`, `draft_points`, `draft_archives`, `settings` | 3 | courses + réglages portables (phase 2) |
| `sprinter-workouts-v1.db` | séances, préférences (dont la voix du coach) | 1 | séances en phase 2b |
| `sprinter-tools-v1.db` | itinéraires GPX, préférences d’outils | 1 | itinéraires en phase 2b |
| `sprinter-progression-v1.db` | plan, objectifs, chaussures | 1 | chaussures et plan en phase 2b |
| `sprinter-apple-v1.db` | état Apple Santé / Live Activity | 1 | jamais (propre à l’appareil) |
| `sprinter-music-v1.db` | état Spotify et appareil musical | 1 | jamais (jetons et permissions) |
| `sprinter-account-v1.db` (nouvelle) | cache `app_config`, puis session chiffrée et identifiant d’appareil | 1 | — |

Chaque base applique la même garde de version. Sur le web, les données vivent dans `localStorage`.

## 6. Réglages portables et propres à l’appareil (§7.5)

`Settings` (`src/core/types.ts`) : `config`, `audioEnabled`, `hapticsEnabled`, `appearance`, `autoPauseEnabled`, `coaching` sont **portables** ; `backgroundEnabled` reste **propre à l’appareil** (dépend de la permission système). Les préférences de voix (base des séances), Apple Santé et Spotify restent locales en phase 2.

## 7. Code iOS uniquement (phase 5)

- `modules/sprinter-apple` (HealthKit, Live Activity) : déjà chargé via `requireOptionalNativeModule` et gardé par `Platform.OS === 'ios'` dans `src/apple/bridge.ts`.
- `expo-widgets` et `@expo/ui/swift-ui` : `src/apple/live.ts`, `src/apple/RunLiveActivity.tsx` (importés sans garde au niveau du module) → variante `.android.ts` ou import paresseux à prévoir.
- `expo-glass-effect` : `src/ui/GlassSurface.tsx` (vérifie déjà `isGlassEffectAPIAvailable`).
- Plugins de build : `plugins/with-sprinter-apple.js`, `expo-widgets` dans `app.json`.

## 8. Comportement en phase 0

Sans `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, l’app ne fait **aucun appel réseau supplémentaire**. Avec ces variables, elle lit `app_config` en arrière-plan après le démarrage (cache local, échec ouvert). Les flags sont éteints : aucun écran ne change.
