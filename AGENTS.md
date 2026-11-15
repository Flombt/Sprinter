# Sprinter · instructions essentielles

Application de running en français, React Native / Expo, développée notamment sous Windows. Compte obligatoire ; calcul sportif et stockage locaux, sauvegardes cloud facultatives. Lire uniquement les documents utiles à la tâche depuis [docs/00-INDEX.md](docs/00-INDEX.md).

## Avant toute modification

- Examiner `git status`, les sources et les tests du domaine. Le code actuel prime sur une ancienne documentation ; distinguer implémentation, test automatisé et recette réelle.
- Préserver les changements de l’utilisateur et les données personnelles. Ne pas toucher aux artefacts locaux ni aux worktrees de `.verification/` pour nettoyer une recherche.
- **Lancer ou relancer une compilation IPA uniquement sur demande explicite de l’utilisateur pour la tâche en cours. Une demande antérieure ne s’étend pas aux tâches suivantes.** Cela couvre le build local, EAS et le workflow GitHub **Build unsigned iPhone IPA**.
- Ne pas déclencher de déploiement, migration distante ou publication dans le cadre d’une simple validation locale.

## Architecture et conventions

- `src/core/`, `src/pacing/`, `src/workouts/engine.ts` : calculs sportifs ; `src/services/session.ts` orchestre le cycle de course ; `src/services/location.ts` possède le GPS. Conserver cette séparation.
- SQLite natif fait autorité pendant la course. Écritures sérialisées, fin transactionnelle et récupération **en pause**. Ne pas inventer de points, durées fiables ou records absents.
- Pas de synchronisation des courses ou du profil pendant une course, même en pause. Outbox et contrôles d’identité restent obligatoires.
- Expo SDK 58, React Native 0.88, React 19.3 : préserver l’alignement du graphe natif et le verrou npm ; pas de mise à jour native isolée ni d’`audit fix --force` automatique.
- TypeScript : `strict`, `noUncheckedIndexedAccess`. Utiliser les composants et couleurs sémantiques de `src/ui/`, respecter les variantes `.web.ts(x)` et les gardes de plateforme.
- Expo Go reste limité au premier plan ; Santé et Live Activities exigent un binaire compatible et sont désactivées en sideload. Un export Expo est un bundle JavaScript.
- Supabase : migrations ordonnées, RLS et RPC pour les écritures protégées. Seuls URL, clé publique et autres paramètres publics vont dans `EXPO_PUBLIC_*` ; aucune clé serveur dans l’app.

## Commandes

Préfixer les commandes shell par `rtk` lorsque disponible (ex. `rtk npm run typecheck`, `rtk proxy npx vitest run --exclude '.verification/**'`).

| Besoin | Commande npm ou outil |
|---|---|
| Installation reproductible | `npm ci` |
| Expo Go / tunnel / client installé | `npm start` / `npm run start:tunnel` / `npm run start:dev` |
| Validation app | `npm run check` (lint, types, secrets, couverture) |
| Vérification ciblée | `npm run typecheck`, `npm test`, `npm run check:secrets` |
| Backend | Commandes et prérequis dans [exploitation](docs/backend/exploitation.md) |

L’état de l’environnement et les limites des contrôles sont dans [validation](docs/quality/validation.md). Les worktrees ignorés peuvent fausser la découverte des tests ; ne pas présenter leur total comme celui du dépôt courant.

## Routage documentaire

| Tâche | Lire d’abord |
|---|---|
| Comprendre le projet / trouver un module | [Architecture](docs/architecture/vue-ensemble.md) |
| GPS, pauses, coach, récupération | [Course et coach](docs/features/course-et-coach.md), puis [données](docs/architecture/donnees-et-cycle-course.md) |
| Séances, calendrier, chaussures | [Séances et progression](docs/features/seances-et-progression.md) |
| Statistiques, GPX, partage | [Analyse et parcours](docs/features/analyse-parcours-partage.md) |
| Compte / sync / serveur | [Comptes](docs/features/comptes.md), [synchronisation](docs/backend/synchronisation.md), [backend](docs/backend/architecture.md) |
| Profils / communauté | [Profils et communauté](docs/features/profils-et-communaute.md) |
| Apple / Spotify / météo / natif | [Intégrations](docs/features/integrations.md), [développement](docs/architecture/developpement.md) |
| UI / accessibilité | [Interface](docs/design/interface.md), [système visuel](docs/design/systeme-visuel.md) |
| Choix durable / confidentialité / livraison | [Décisions](docs/decisions/README.md), [RGPD](docs/rgpd/README.md), [priorités](docs/roadmap/priorites.md) |

## Maintenance

Une évolution met à jour seulement la fiche du domaine et, si nécessaire, son statut ou la décision concernée. Conserver une seule référence active par sujet, des liens relatifs GitHub/Obsidian et des chemins sources exacts. Dater les preuves et expliciter ce qui n’est pas testé. Ne pas charger les archives ou toute la documentation par défaut. Voir [maintenance documentaire](docs/quality/documentation.md).
