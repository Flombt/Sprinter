# Sprinter — Analyse de Design de l'Application

> Document généré par analyse automatique du codebase (React Native / Expo SDK 58)

---

## 1. Vue d'Ensemble Architecturale

### Stack Technique
- **Framework** : React Native 0.88 + Expo SDK 58 (managed workflow)
- **Langage** : TypeScript strict (tsconfig.json `noEmit: true`)
- **Runtime cible** : iOS via Expo Go (développement) + Development Build / EAS Build (production)
- **Navigation** : Custom bottom-tabs + modal sheets + stack-like page routing (pas de `react-navigation`)
- **État global** : `useSyncExternalStore` sur stores singleton (session, progression, workouts, music, tools)
- **Persistance** : **expo-sqlite** (SQLite natif) + **expo-secure-store** (tokens OAuth) + localStorage (web uniquement)
- **Tests** : Vitest (unitaires + intégration SQLite) — 148 tests pour Module 1 uniquement

### Contraintes Plateforme Majeures
| Contrainte | Impact |
|---|---|
| **Expo Go iOS** | Pas de background location → écran allumé obligatoire, pause auto en background |
| **Windows → iOS** | Pas de compilation native locale → EAS Build requis pour HealthKit, Live Activity, Background Tasks |
| **Expo SDK 58 lock** | React 19.3 / RN 0.88 verrouillés par `overrides` + `package-lock.json` |

---

## 2. Architecture des Modules (src/)

```
src/
├── core/           # Fondations : types, temps, filtrage GPS, auto-pause, altitude, coach-core, stats
├── pacing/         # Objectifs chrono, cibles par km, capital temps, écarts
├── analysis/       # Moteur d'analyse activités : records, comparaison, export GPX, intermédiaires
├── apple/          # HealthKit, sync log, Live Activity, contrat Watch (Swift natif dans modules/)
├── routes/         # Favoris, import GPX, géométrie, proximité tracé
├── tools/          # Métronome, cadence CoreMotion, météo Open-Meteo, observation course
├── sharing/        # Copies publiques/privées, masquage 300m, résumé, stats CSV
├── integrations/   # Contrat Strava (préparatoire, sans transport actif)
├── coaching/       # Niveaux coach (Discret/Normal/Complet), règles annonces, progression
├── progression/    # Périodes, calendrier, objectifs, plans, journal, chaussures, bilan
├── services/       # Adaptateur CoreLocation (Expo), session, signaux, background task, partage
├── spotify/        # OAuth PKCE, tokens sécurisés, Web API, refs playlists, mini-player
├── workouts/       # Séances, défis, interpréteur, coaching, bibliothèque, records, fantôme
├── storage/        # SQLite + transactions ; localStorage (web only)
├── screens/        # 13 écrans principaux (Home, Live, Prep, History, Detail, Settings, Music, Workouts, Records, Comparison, Progression, AppleIntegrations, RunningTools)
└── ui/             # Design system : thème, tokens, composants, navigation, carte, graphiques
```

### Principes de Séparation
- **Domain-driven** : chaque feature = dossier cohérent (types, logique, persistance, UI)
- **Core pur** : `core/`, `pacing/`, `analysis/` sans dépendances React/Expo → testables isolément
- **Services** : adaptateurs plateforme (location, audio, secure-store, task-manager) centralisés
- **UI** : composants présentants seulement, reçoivent props + callbacks

---

## 3. Gestion d'État & Data Flow

### Stores Singletons (pattern `useSyncExternalStore`)
| Store | Responsabilité | Persistance |
|---|---|---|
| `session` | Run actif, historique, GPS, auto-pause, coach, settings | SQLite (`runs`, `run_points`, `checkpoints`) |
| `progression` | Semaines, objectifs, calendrier, journal, chaussures, records | SQLite (`progression_*`) |
| `workouts` | Bibliothèque séances, défis, modèles, records défis | SQLite (`workouts`, `workout_blocks`) |
| `music` | État Spotify (auth, playlist, player, device) | SecureStore (tokens) + SQLite (refs) |
| `tools` | Favoris routes, GPX importés, métronome, météo | SQLite (`routes`, `gpx_files`) |

### Cycle de Vie Session (`src/services/session.ts`)
```
IDLE → INITIALIZING → READY
                    ├─► RUNNING (GPS actif, coach, checkpoints 5s)
                    │     ├─► AUTO_PAUSED (arrêt détecté)
                    │     └─► PAUSED (manuel)
                    └─► FINISHED → persistence transactionnelle → IDLE
```
- **Checkpoints** : toutes les 5s (foreground) + chaque batch GPS (background)
- **Reprise** : seul état `PAUSED` récupérable ; `AUTO_PAUSED` → confirmation utilisateur

### Flux GPS → Affichage
```
expo-location (CoreLocation) 
    → LocationAdapter (filtrage: précision, âge, ordre, dérive, virages)
    → Session (distance filtrée, allure stabilisée, active/total time)
    → Live Screen (carte segments, graphique allure, coach audio)
    → SQLite (points + checkpoints)
```

---

## 4. Design System & UI (`src/ui/`)

### Thématisation
- **3 modes** : `light` | `dark` | `system` (persisté dans settings)
- **Tokens centralisés** : `spacing`, `radii`, `typography`, `colors` (palette lime/vert signature)
- **Accessibilité** : labels, rôles, tailles cibles ≥44pt, `reduceMotion`, `reduceTransparency`
- **Liquid Glass** : `expo-glass-effect` sur navigation quand dispo, fallback visuel

### Composants de Base (`src/ui/components/`)
| Composant | Variantes | Usage |
|---|---|---|
| `Button` | `primary` `secondary` `quiet` `danger` | Actions principales/secondaires |
| `Card` | `hero` `metric` `list` `setting` | Conteneurs sémantiques |
| `Input` `Select` `Slider` `Switch` | — | Formulaires |
| `IconButton` | `quiet` | Toolbar, actions discrètes |
| `Label` `Copy` | `title` `body` `caption` `numeric` | Typographie cohérente |

### Navigation
- **BottomTabs** (5 onglets fixes) : Courir, Sorties, Séances, Musique, Réglages
- **Modal Sheets** (pageSheet) : Musique, Séances, Outils course
- **Page Stack** géré par `page` state dans `App.tsx` (tabs, prepare, live, detail, records, compare, progression, apple)
- **Deep Link** : `sprinter://run` → ouverture directe Live si course active

---

## 5. Fonctionnalités Clés par Domaine

### 5.1 Suivi de Course (Modules 1, 2, 9)
- **Filtrage GPS** : précision ≤ 50m, âge ≤ 30s, détection virages, rejet outliers
- **Auto-pause** : seuil vitesse configurable, reprise confirmée mouvement
- **Coach d'allure** : plage fixe / temps final / cibles par km ; capital temps ; hystérésis 3s/km ; espacement 30s
- **Audio** : 2 fichiers PCM distincts (ralentir/accélérer) + haptiques (2 courts / 1 long)
- **Métriques temps réel** : distance filtrée, allure courante (moyenne glissante), allure moyenne, % temps en cible, ETA

### 5.2 Séances & Défis (Module 4, 8)
- **11 modèles** + éditeur blocs (distance/durée/cible) + groupes répétés
- **Moteur d'exécution** : transitions auto, budget survie, GPS continue si échec
- **Fantôme** : course réelle historique (pas de simulation)
- **Bilan** : effort/récup, respect cibles, score pondéré temps (régularité)

### 5.3 Progression & Personnel (Module 6)
- **KPIs** : km/sem/mois, temps actif/total, fréquence, semaines actives, jours sans course
- **Calendrier** : activités passées + séances futures + repos ; liaison bibliothèque
- **Plans** : 5k/10k/semi personnalisables (volume, plafond, allure libre, progression nulle défaut)
- **Journal** : sensations, difficulté, notes post-course
- **Chaussures** : kilométrage (enregistré + déclaré initial)

### 5.4 Outils Course (Module 8)
- **Routes** : favoris locaux + import GPX (aperçu, reprise, alerte écart)
- **Métronome** : boucle audio native, pause pour annonces coach
- **Cadence** : CoreMotion (optionnel, nécessite dev build)
- **Météo** : Open-Meteo à la demande (zone approx, attribution)
- **Partage** : copie publique (masque 300m départ/arrivée) + rayon modifiable + copie complète

### 5.5 Intégrations Apple (Module 7)
- **HealthKit** : permissions lecture/écriture distinctes, sync courses, reprise interrompue, dédup import
- **Live Activity** : Dynamic Island + Lock Screen (nécessite dev build + extension Swift)
- **Watch** : contrat préparé (`modules/`), pas d'app Watch
- **Export** : GPX + CSV (détail sortie)
- **Sauvegardes** : exclues iCloud (activités + logs)

### 5.6 Spotify (Module 5)
- **Import refs** : liens playlist sans Client ID
- **OAuth PKCE** : pour dev build (Client ID + callback HTTPS requis)
- **Web API** : commandes lecture (Premium requis), fallback désactivé
- **Mini-player** : intégré Live + Préparation
- **Audio mixing** : coach via Web API mixing, pas de commande pause/play Spotify

---

## 6. Persistance & Schéma SQLite

### Tables Principales
```sql
-- Courses
runs (id, started_at, ended_at, distance, active_time, total_time, 
      elevation_gain, elevation_loss, pace_avg, pace_current, 
      target_config_json, status, interrupted_at, recovery_estimate)
run_points (run_id, seq, lat, lon, alt, accuracy, speed, course, timestamp, is_checkpoint)
checkpoints (run_id, seq, distance, active_time, total_time, pace_avg, pace_current, elevation)

-- Progression
progression_weeks (week_start, km, active_time, total_time, frequency, active_days, goal_km, goal_time)
progression_goals (period, type, target, achieved)
calendar_events (date, type, workout_id, custom_blocks_json, is_rest)
shoes (id, name, declared_km, recorded_km, active)
journal_entries (run_id, feeling, difficulty, notes)

-- Séances
workouts (id, name, blocks_json, created_at, updated_at)
workout_blocks (workout_id, seq, type, distance, duration, target_pace, tolerance, repeat_group, repeat_count)
workout_records (workout_id, run_id, score, completed_at, blocks_results_json)

-- Routes / GPX
routes (id, name, gpx_path, distance, elevation, bounds_json, is_favorite)
gpx_files (id, route_id, original_name, parsed_at, points_json)

-- Spotify
spotify_tokens (access_token, refresh_token, expires_at, scope)
spotify_playlists (id, name, uri, tracks_count, added_at)
```

### Stratégie Transactions
- **Checkpoints** : `INSERT` points + `UPSERT` checkpoint (toutes les 5s)
- **Fin de course** : transaction unique (run + points finaux + checkpoint final + progression reconcile)
- **Reprise interrompue** : lecture dernier checkpoint → continuation si `status = 'paused'`

---

## 7. Points d'Attention & Dette Technique

| Zone | Risque / Limite | Statut |
|---|---|---|
| **Background GPS** | Inopérant dans Expo Go → dev build requis | 🟡 Documenté, code prêt (`expo-task-manager`) |
| **Live Activity** | Extension Swift non compilée par Metro | 🟡 Code dans `modules/` + `src/apple/liveActivity.ts` |
| **HealthKit** | Module Swift local (`modules/healthkit`) non testé Windows | 🟡 Contrat TypeScript seul vérifié |
| **Tests** | Seuls 148 tests Module 1 ; Modules 2-9 sans tests | 🔴 Couverture incomplète |
| **Spotify OAuth** | Callback HTTPS non hébergé, Client ID non fourni | 🟡 Config prête (`integrations/spotify-callback/`) |
| **Strava** | Contrat uniquement, pas de transport | 🔵 Préparatoire |
| **FIT Export** | Non implémenté (architecture prête) | 🔵 Futur |
| **i18n** | Français uniquement (strings en dur) | 🔵 Non requis actuel |
| **Chiffrement** | Pas de chiffrement applicatif (dépend sandbox iOS) | 🟡 Accepté |

---

## 8. Validation & Qualité

### Ce qui est Validé (Windows)
- ✅ TypeScript strict (`npm run typecheck`)
- ✅ Bundle Hermes iOS (`npm run export:ios`)
- ✅ Build web (`npm run web`)
- ✅ 148 tests Module 1 (`npm test`)
- ✅ Lint / format (pré-commit supposé)

### Ce qui Reste à Valider (iPhone Physique)
- 📱 GPS précision / autonomie / fond d'écran verrouillé
- 📱 Audio coach + haptiques + Bluetooth + interruptions
- 📱 HealthKit permissions / sync / Live Activity Dynamic Island
- 📱 Spotify OAuth réel + lecture + Web API
- 📱 Background location + auto-pause + reprise
- 📱 Accessibilité VoiceOver / Dynamic Type / Réduire animations
- 📱 Partage iOS natif (GPX/CSV) + masquage 300m
- 📱 Signature Xcode + TestFlight / App Store

---

## 9. Commandes Développement (Windows)

```powershell
# Installation
npm ci

# Développement Expo Go (QR code port 8081)
npm start

# Tunnel si Wi-Fi bloqué
npm run start:tunnel

# Validation
npm run typecheck        # TS only
npm run check            # TS + tests

# Export / Build
npm run export:ios       # Bundle Hermes iOS (Windows OK)
npm run build:ios        # EAS Build → dev client iOS

# QR code artifact
npm run qr               # Régénère artifacts/expo-go.png + expo-url.txt
```

### Après Dev Build Installé
```powershell
npx expo start --dev-client --lan
# Active "Courir écran verrouillé" dans Réglages → permission iOS requise
```

---

## 10. Résumé Décisions Architecturales Majeures

| Décision | Raison | Alternative Écartée |
|---|---|---|
| **Expo Managed + EAS** | Dev Windows → iOS sans Mac local | Bare workflow / SwiftUI natif |
| **SQLite (expo-sqlite)** | Persistance robuste, transactions, requêtes complexes | AsyncStorage / MMKV / Realm |
| **Stores externes + useSyncExternalStore** | État partagé multi-écrans, pas de re-renders inutiles | Context + useReducer / Redux / Zustand |
| **Navigation custom (pas react-navigation)** | Contrôle fin modals + tabs + deep links, bundle léger | react-navigation (poids + complexité) |
| **Core pur TypeScript (pas de React)** | Testabilité, portabilité, séparation domaines | Hooks React dans la logique métier |
| **Filtrage GPS côté JS** | Contrôle total algorithmes, pas de boîte noire native | Filtrage natif CoreLocation opaque |
| **Coach audio via fichiers PCM + haptiques** | Latence zéro, fiable hors ligne, pas de TTS système | `expo-speech` / TTS natif |
| **Masquage 300m départ/arrivée par défaut** | Privacy by design, utilisateur choisit rayon | Partage complet par défaut |

---

## 11. Prochaines Étapes Recommandées

1. **Tests d'intégration** : étendre couverture Modules 2-9 (objectif ≥ 80% core logic)
2. **Dev Build iOS** : valider Background GPS, HealthKit, Live Activity, Spotify OAuth
3. **CI/CD** : GitHub Actions → `typecheck` + `test` + `export:ios` + EAS Build preview
4. **Monitoring** : Sentry / Bugsnag pour erreurs production (hors Expo Go)
5. **Documentation API** : générer depuis JSDoc/TSDoc pour modules publics (`core`, `pacing`, `analysis`)

---

*Analyse basée sur lecture exhaustive du codebase (App.tsx, package.json, README.md, structure src/, docs/). Aucune exécution runtime n'a été effectuée.*