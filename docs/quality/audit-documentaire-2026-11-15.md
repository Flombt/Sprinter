# Audit et compte rendu documentaire · 15 novembre 2026

[Carte documentaire](../00-INDEX.md) · [Validation et preuves](validation.md) · [Archives](../archive/README.md)

## Périmètre et méthode

Référence locale : `main`, commit `4197244` au début de la tâche. Le dépôt Git contient **481 fichiers suivis**, dont **51 Markdown initiaux** et **379 fichiers de code/configuration exécutable** (TS/TSX/JS/CJS/MJS/Swift/SQL). L’inventaire structurel couvre leurs 38 830 lignes, imports, déclarations, marqueurs préparatoires et surfaces réseau ; la revue croisée porte sur les points d’entrée et contrats de chaque domaine, les configurations, migrations, tests et workflows. Les assets et pages statiques ont été recensés avec leurs usages documentaires. Ce travail est un audit documentaire, pas une certification de sécurité ou une recette exhaustive du code.

Le code courant sert de référence pour l’implémentation. Les anciens rapports servent de provenance, jamais de preuve actuelle. Le dépôt distant référencé n’a pas été exploitable via la lecture web ; aucun projet Supabase, compte Spotify, tableau GitHub ou dépôt admin externe n’a été réaudité en ligne. Les affirmations distantes historiques restent explicitement datées/non reconsultées.

Le répertoire contient aussi **69 Markdown de travail ou d’installation hors du corpus versionné** : copies de worktrees, téléchargements d’IPA, notes locales et trois notices sous `artifacts/`. Ils ont été recensés, exclus du cerveau actif et laissés intacts. `node_modules`, `.expo` et les dépendances générées sont exclus du corpus produit.

## Résultat et structure

Le corpus comprend désormais **73 Markdown**, dont **57 nouveaux chemins** et **35 anciens chemins retirés** après déplacement/fusion. Le nombre total augmente avec les fiches ciblées et la séparation des archives ; la lecture permanente diminue. `AGENTS.md` route vers un index et une fiche de domaine, sans charger tout `docs/`.

- Trois fiches d’architecture, sept fiches fonctionnelles, deux fiches de design, quatre références backend et six décisions durables avec leur index.
- Vingt anciennes descriptions fusionnées/réécrites ; huit audits/guides historiques et le cahier des charges archivés avec avertissement et successeur.
- La recette monolithique devient douze fiches ciblées et un point d’entrée commun ; identifiants de scénarios conservés, bilan/signature regroupés dans un gabarit.
- Neuf documents RGPD conservés ; deux dossiers stores déplacés sous `rgpd/stores/`. Les corrections concernent les descriptions techniques et les liens, sans publication ou validation juridique.
- Deux exceptions de chemin justifiées : `docs/INSTALL_IPA.md` est copié par le script de packaging ; `docs/ACCOUNTS.md` reste un routeur pour la référence du commentaire Supabase.

L’ancienne documentation technique hors RGPD/stores pesait environ **596 Kio**, avec historiques et recettes mélangés. Le noyau actuel (instructions, index, architecture, features, design, backend, décisions) pèse environ **102 Kio**. Ces périmètres diffèrent volontairement : les détails de recette, réglementaires et historiques restent disponibles à la demande. Ce n’est pas une mesure de consommation de tokens.

## Contradictions résolues

| Affirmation ancienne ou ambiguë | Conclusion fondée sur le code / traitement documentaire |
|---|---|
| Compte facultatif, application pleinement utilisable en invité | Connexion obligatoire ; session restaurable et calcul local distincts du choix de sauvegarde. CGU, politique, registre, stores et recettes corrigés ; décision 002 explicite la supersession |
| `accounts_enabled=false` retire tout écran de compte | La garde de connexion ne dépend pas de ce flag ; il ferme les options cloud dépendantes. Lancement et recette réécrits |
| Aucun backend, aucune transmission applicative | 20 migrations, 10 fonctions et sync optionnelle présents. Séparation données locales, compte et sauvegardes explicitée |
| Profils, studio, partage et communauté seulement prévus | Parcours app, RPC, migrations et tests présents ; activation distante et recette restent des axes séparés |
| Aucun parcours de démonstration | Trois exemples pédagogiques affichés, isolés de l’historique et des records ; aucune création de donnée personnelle par cette refonte |
| Cinq onglets, ou Stats à gauche | Trois panneaux dans l’ordre Spotify · Courir · Stats ; pile/feuilles et destinations documentées depuis les routeurs |
| Base de course en version 2 ou 3 | Schéma SQLite 4 ; enveloppe d’activité version 3, notions distinguées |
| Tous les appels admin nécessitent AAL2 | `admin_whoami` accepte AAL1 pour orienter ; données/actions protégées gardent AAL2/capacités et réauth selon le contrat |
| Tous les contrastes passent | Exception `muted` sur `raised` clair à environ 4,41:1 ; test partiel et recette accessible non équivalents |
| Voix pendant le verrouillage promise dans les notes App Review | Voix limitée au premier plan ; notes françaises/anglaises corrigées |
| Météo prête en distribution, Strava/Watch assimilés à des intégrations | Météo limitée au développement ; Strava et Watch restent des contrats sans transport opérationnel |
| Purges séparées, reprise `resume-deletions`, limite de 1 000 lignes déjà livrées | Jobs réels et `process-deletions` identifiés ; `retention` regroupe plusieurs suppressions sans cette limite. Propositions non implémentées explicitement séparées |
| Tests historiques, 95,4 % ou « aucun test » comme état courant | Résultats datés archivés, anciennes consignes de mission désactivées comme instructions permanentes ; résultats locaux et suites bloquées consignés |
| Total Vitest mélangeant plusieurs versions du projet | Les worktrees ignorés doublonnaient la découverte ; référence isolée : 34 fichiers, 31 réussis, 271 tests passés, trois suites bloquées au chargement |
| Export Expo ou build sideload prouvant les capacités Apple normales | Bundle, build, signature et recette physique distingués ; Santé/Live Activity absents du sideload |
| Déploiement décrit le 14 novembre assimilé à l’exploitation actuelle | Rapport conservé, non reconsulté ; aucune activation ni disponibilité actuelle affirmée |

## Registre des 51 fichiers Markdown initiaux

Les chemins initiaux ci-dessous sont des identifiants historiques, pas des liens vers des fichiers supprimés. Chaque destination est la référence actuelle ou l’archive justifiée.

| Chemin initial | Action | Destination |
|---|---|---|
| `AGENTS.md` | Réécrit en routeur essentiel | [AGENTS.md](../../AGENTS.md) |
| `CLAUDE_ANALYSE.md` | Archivé | [docs/archive/audits/analyse-design-initiale.md](../archive/audits/analyse-design-initiale.md) |
| `README.md` | Réécrit en présentation et démarrage court | [README.md](../../README.md) |
| `assets/spotify/ATTRIBUTION.md` | Conservé inchangé auprès des ressources | [assets/spotify/ATTRIBUTION.md](../../assets/spotify/ATTRIBUTION.md) |
| `docs/ACCOUNTS.md` | Archivé | [docs/archive/audits/2026-11-14-guide-comptes.md](../archive/audits/2026-11-14-guide-comptes.md) · [docs/ACCOUNTS.md](../ACCOUNTS.md) |
| `docs/ACCOUNTS_RECON.md` | Archivé | [docs/archive/audits/2026-11-14-reconnaissance-comptes.md](../archive/audits/2026-11-14-reconnaissance-comptes.md) |
| `docs/ALLURE_PRECISE.md` | Fusionné et réécrit | [docs/features/course-et-coach.md](../features/course-et-coach.md) |
| `docs/ANALYTICS.md` | Fusionné et réécrit | [docs/features/analyse-parcours-partage.md](../features/analyse-parcours-partage.md) |
| `docs/APPLE.md` | Fusionné et réécrit | [docs/features/integrations.md](../features/integrations.md) |
| `docs/AUDIO.md` | Fusionné et réécrit | [docs/features/course-et-coach.md](../features/course-et-coach.md) |
| `docs/AUDIT.md` | Archivé | [docs/archive/audits/2026-11-01-module-9.md](../archive/audits/2026-11-01-module-9.md) |
| `docs/AUDIT_2026-11-11.md` | Archivé | [docs/archive/audits/2026-11-11-audit.md](../archive/audits/2026-11-11-audit.md) |
| `docs/DESIGN_SYSTEM.md` | Fusionné et réécrit | [docs/design/systeme-visuel.md](../design/systeme-visuel.md) |
| `docs/FAISABILITE.md` | Fusionné et réécrit | [docs/architecture/developpement.md](../architecture/developpement.md) |
| `docs/HISTORY.md` | Fusionné et réécrit | [docs/features/analyse-parcours-partage.md](../features/analyse-parcours-partage.md) |
| `docs/HOME.md` | Fusionné et réécrit | [docs/design/interface.md](../design/interface.md) |
| `docs/INSTALL_IPA.md` | Conservé au chemin consommé par le packaging ; compte/sideload précisés | [docs/INSTALL_IPA.md](../INSTALL_IPA.md) |
| `docs/INTERFACE.md` | Fusionné et réécrit | [docs/design/interface.md](../design/interface.md) |
| `docs/LANCEMENT.md` | Déplacé et actualisé | [docs/roadmap/lancement.md](../roadmap/lancement.md) |
| `docs/MUSIC_UI.md` | Fusionné et réécrit | [docs/design/interface.md](../design/interface.md) |
| `docs/PACING.md` | Fusionné et réécrit | [docs/features/course-et-coach.md](../features/course-et-coach.md) |
| `docs/PALETTE.md` | Fusionné et réécrit | [docs/design/systeme-visuel.md](../design/systeme-visuel.md) |
| `docs/PERF.md` | Déplacé et actualisé | [docs/quality/performance.md](performance.md) |
| `docs/POLISH.md` | Fusionné et réécrit | [docs/design/systeme-visuel.md](../design/systeme-visuel.md) |
| `docs/PROGRESSION.md` | Fusionné et réécrit | [docs/features/seances-et-progression.md](../features/seances-et-progression.md) |
| `docs/RECETTE_COMPTES.md` | Découpé par domaine et corrigé | [docs/quality/recettes/preparation.md](recettes/preparation.md) · [docs/quality/recettes/comptes.md](recettes/comptes.md) · [docs/quality/recettes/synchronisation.md](recettes/synchronisation.md) · [docs/quality/recettes/traces-gps.md](recettes/traces-gps.md) · [docs/quality/recettes/administration.md](recettes/administration.md) · [docs/quality/recettes/android.md](recettes/android.md) · [docs/quality/recettes/lancement.md](recettes/lancement.md) · [docs/quality/recettes/communaute.md](recettes/communaute.md) · [docs/quality/recettes/profil-8a.md](recettes/profil-8a.md) · [docs/quality/recettes/profil-8b.md](recettes/profil-8b.md) · [docs/quality/recettes/profil-8c.md](recettes/profil-8c.md) · [docs/quality/recettes/profil-8d.md](recettes/profil-8d.md) · [docs/quality/recettes/README.md](recettes/README.md) |
| `docs/RECETTE_IPHONE.md` | Déplacé et actualisé | [docs/quality/recette-course-iphone.md](recette-course-iphone.md) |
| `docs/REFONTE_UI.md` | Archivé | [docs/archive/audits/refonte-ui.md](../archive/audits/refonte-ui.md) |
| `docs/SETTINGS_UI.md` | Fusionné et réécrit | [docs/design/interface.md](../design/interface.md) |
| `docs/SPOTIFY.md` | Fusionné et réécrit | [docs/features/integrations.md](../features/integrations.md) |
| `docs/STABILISATION_2026-11-11.md` | Archivé | [docs/archive/audits/2026-11-11-stabilisation.md](../archive/audits/2026-11-11-stabilisation.md) |
| `docs/TOOLS.md` | Fusionné et réécrit | [docs/features/analyse-parcours-partage.md](../features/analyse-parcours-partage.md) |
| `docs/TRACKING.md` | Fusionné et réécrit | [docs/features/course-et-coach.md](../features/course-et-coach.md) |
| `docs/VALIDATION.md` | Archivé | [docs/archive/audits/validations-historiques.md](../archive/audits/validations-historiques.md) |
| `docs/WORKOUTS.md` | Fusionné et réécrit | [docs/features/seances-et-progression.md](../features/seances-et-progression.md) |
| `docs/WORKOUT_LIBRARY.md` | Fusionné et réécrit | [docs/features/seances-et-progression.md](../features/seances-et-progression.md) |
| `docs/rgpd/analyse-aipd.md` | Conservé ; descriptions techniques et/ou liens révisés, clauses et réserves préservées | [docs/rgpd/analyse-aipd.md](../rgpd/analyse-aipd.md) |
| `docs/rgpd/cgu.md` | Conservé ; descriptions techniques et/ou liens révisés, clauses et réserves préservées | [docs/rgpd/cgu.md](../rgpd/cgu.md) |
| `docs/rgpd/durees-conservation.md` | Conservé ; descriptions techniques et/ou liens révisés, clauses et réserves préservées | [docs/rgpd/durees-conservation.md](../rgpd/durees-conservation.md) |
| `docs/rgpd/mentions-legales.md` | Conservé ; descriptions techniques et/ou liens révisés, clauses et réserves préservées | [docs/rgpd/mentions-legales.md](../rgpd/mentions-legales.md) |
| `docs/rgpd/politique-confidentialite.md` | Conservé ; descriptions techniques et/ou liens révisés, clauses et réserves préservées | [docs/rgpd/politique-confidentialite.md](../rgpd/politique-confidentialite.md) |
| `docs/rgpd/procedure-droits.md` | Conservé ; descriptions techniques et/ou liens révisés, clauses et réserves préservées | [docs/rgpd/procedure-droits.md](../rgpd/procedure-droits.md) |
| `docs/rgpd/procedure-violation.md` | Conservé ; descriptions techniques et/ou liens révisés, clauses et réserves préservées | [docs/rgpd/procedure-violation.md](../rgpd/procedure-violation.md) |
| `docs/rgpd/registre-traitements.md` | Conservé ; descriptions techniques et/ou liens révisés, clauses et réserves préservées | [docs/rgpd/registre-traitements.md](../rgpd/registre-traitements.md) |
| `docs/rgpd/sous-traitants.md` | Conservé ; descriptions techniques et/ou liens révisés, clauses et réserves préservées | [docs/rgpd/sous-traitants.md](../rgpd/sous-traitants.md) |
| `docs/specs/ADMIN_RPC_CONTRACT.md` | Déplacé et actualisé | [docs/backend/admin-rpc-contract.md](../backend/admin-rpc-contract.md) |
| `docs/specs/COMPTES_SYNC_ADMIN_v2_1.md` | Archivé | [docs/archive/specifications/comptes-sync-admin-v2.1.md](../archive/specifications/comptes-sync-admin-v2.1.md) |
| `docs/stores/app-store-confidentialite.md` | Déplacé et actualisé | [docs/rgpd/stores/app-store-confidentialite.md](../rgpd/stores/app-store-confidentialite.md) |
| `docs/stores/google-play-data-safety.md` | Déplacé et actualisé | [docs/rgpd/stores/google-play-data-safety.md](../rgpd/stores/google-play-data-safety.md) |
| `integrations/spotify-callback/README.md` | Conservé auprès de la page ; liens et portée des validations actualisés | [integrations/spotify-callback/README.md](../../integrations/spotify-callback/README.md) |
| `web/README.md` | Conservé auprès de la page statique ; contenu vérifié | [web/README.md](../../web/README.md) |

## Tous les nouveaux chemins

Les déplacements, archives et découpages sont inclus ; leur provenance figure dans le registre précédent. Les autres fichiers sont de nouvelles synthèses.

| Dossier | Fichiers |
|---|---|
| `docs/` | [00-INDEX.md](../00-INDEX.md) |
| `docs/architecture/` | [developpement.md](../architecture/developpement.md) · [donnees-et-cycle-course.md](../architecture/donnees-et-cycle-course.md) · [vue-ensemble.md](../architecture/vue-ensemble.md) |
| `docs/archive/` | [README.md](../archive/README.md) |
| `docs/archive/audits/` | [2026-11-01-module-9.md](../archive/audits/2026-11-01-module-9.md) · [2026-11-11-audit.md](../archive/audits/2026-11-11-audit.md) · [2026-11-11-stabilisation.md](../archive/audits/2026-11-11-stabilisation.md) · [2026-11-14-guide-comptes.md](../archive/audits/2026-11-14-guide-comptes.md) · [2026-11-14-reconnaissance-comptes.md](../archive/audits/2026-11-14-reconnaissance-comptes.md) · [analyse-design-initiale.md](../archive/audits/analyse-design-initiale.md) · [refonte-ui.md](../archive/audits/refonte-ui.md) · [validations-historiques.md](../archive/audits/validations-historiques.md) |
| `docs/archive/specifications/` | [comptes-sync-admin-v2.1.md](../archive/specifications/comptes-sync-admin-v2.1.md) |
| `docs/backend/` | [admin-rpc-contract.md](../backend/admin-rpc-contract.md) · [architecture.md](../backend/architecture.md) · [exploitation.md](../backend/exploitation.md) · [synchronisation.md](../backend/synchronisation.md) |
| `docs/decisions/` | [001-calcul-local-et-persistance.md](../decisions/001-calcul-local-et-persistance.md) · [002-compte-obligatoire-et-cloud-facultatif.md](../decisions/002-compte-obligatoire-et-cloud-facultatif.md) · [003-expo-et-variantes-ios.md](../decisions/003-expo-et-variantes-ios.md) · [004-confidentialite-et-publication.md](../decisions/004-confidentialite-et-publication.md) · [005-synchronisation-et-autorite-serveur.md](../decisions/005-synchronisation-et-autorite-serveur.md) · [006-interface-et-etat.md](../decisions/006-interface-et-etat.md) · [README.md](../decisions/README.md) |
| `docs/design/` | [interface.md](../design/interface.md) · [systeme-visuel.md](../design/systeme-visuel.md) |
| `docs/features/` | [analyse-parcours-partage.md](../features/analyse-parcours-partage.md) · [comptes.md](../features/comptes.md) · [course-et-coach.md](../features/course-et-coach.md) · [etat-fonctionnalites.md](../features/etat-fonctionnalites.md) · [integrations.md](../features/integrations.md) · [profils-et-communaute.md](../features/profils-et-communaute.md) · [seances-et-progression.md](../features/seances-et-progression.md) |
| `docs/quality/` | [audit-documentaire-2026-11-15.md](audit-documentaire-2026-11-15.md) · [documentation.md](documentation.md) · [performance.md](performance.md) · [recette-course-iphone.md](recette-course-iphone.md) · [validation.md](validation.md) |
| `docs/quality/recettes/` | [README.md](recettes/README.md) · [administration.md](recettes/administration.md) · [android.md](recettes/android.md) · [communaute.md](recettes/communaute.md) · [comptes.md](recettes/comptes.md) · [lancement.md](recettes/lancement.md) · [preparation.md](recettes/preparation.md) · [profil-8a.md](recettes/profil-8a.md) · [profil-8b.md](recettes/profil-8b.md) · [profil-8c.md](recettes/profil-8c.md) · [profil-8d.md](recettes/profil-8d.md) · [synchronisation.md](recettes/synchronisation.md) · [traces-gps.md](recettes/traces-gps.md) |
| `docs/rgpd/` | [README.md](../rgpd/README.md) |
| `docs/rgpd/stores/` | [app-store-confidentialite.md](../rgpd/stores/app-store-confidentialite.md) · [google-play-data-safety.md](../rgpd/stores/google-play-data-safety.md) |
| `docs/roadmap/` | [lancement.md](../roadmap/lancement.md) · [priorites.md](../roadmap/priorites.md) |

## Vérification finale

Contrôle automatisé du corpus final : **73 Markdown, 914 liens locaux et fragments vérifiés, zéro lien cassé, zéro document inaccessible depuis l’index, zéro doublon intégral**. Les chemins sources liés et les références littérales actives ont été contrôlés ; 18 noms de RPC appelables du contrat admin ont été retrouvés dans les migrations. Une revue des responsabilités a confirmé que les reprises entre matrice, fiches, décisions et recettes ont des rôles distincts. Les doublons historiques sont signalés comme archives. git diff --check réussit. Les URL externes et les affirmations historiques distantes ne font pas partie de cette validation.

Les résultats applicatifs complets figurent dans [validation](validation.md) : garde de secrets réussie ; lint/types bloqués par l’installation incomplète ; 271 tests locaux réussis et trois suites non chargées. Aucun résultat SQL/Deno, export Expo, compilation native ou recette physique n’est ajouté à ces preuves.

Seule la documentation versionnée est modifiée : aucun fichier de logique métier, dépendance, test, migration, plugin ou workflow n’a été changé. Aucune compilation IPA, migration distante, publication ou communication externe n’a été lancée. Les artefacts préexistants restent intacts.

## Incertitudes et actions restantes

L’[état des fonctionnalités](../features/etat-fonctionnalites.md) sépare présence, disponibilité et validation ; les [priorités](../roadmap/priorites.md) routent les suites à donner. Principales limites : dépendances locales à réinstaller avant nouveau verdict de qualité ; recette iPhone/Android, audio et intégrations réelles ouverte ; état distant des migrations/fonctions/flags/jobs non confirmé ; site admin hors dépôt ; identité, domaine, prestataires, durées et validation juridique encore ouverts. La météo distribuée, Strava et Watch ne sont pas promis comme livrés. La purge des appareils, de l’audit Auth, de la modération et certains suivis restent des propositions à confronter aux objectifs réglementaires.

## Copies locales recensées, exclues du cerveau actif

Ces fichiers ne sont pas liés pour éviter de créer des références non portables. Ils ne constituent pas des doublons actifs de la documentation du projet courant.

| Répertoire local | Markdown recensés |
|---|---:|
| `.verification/IPA_RELEASE_NOTES.md` | 1 |
| `.verification/ipa-download` | 1 |
| `.verification/ipa-download-267ace6` | 1 |
| `.verification/ipa-download-2b73bbb2` | 1 |
| `.verification/ipa-download-cd55997` | 1 |
| `.verification/ipa-worktree` | 29 |
| `.verification/refonte-ui` | 32 |
| `artifacts/compte-obligatoire-accueil-618a85e` | 1 |
| `artifacts/finalisation-8b0b61b-connectee` | 1 |
| `artifacts/finalisation-b238bc5` | 1 |

<details>
<summary>Liste exhaustive des copies locales (instantané, fichiers inchangés)</summary>

```text
.verification/IPA_RELEASE_NOTES.md
.verification/ipa-download-267ace6/INSTALLATION.md
.verification/ipa-download-2b73bbb2/INSTALLATION.md
.verification/ipa-download-cd55997/INSTALLATION.md
.verification/ipa-download/INSTALLATION.md
.verification/ipa-worktree/CLAUDE_ANALYSE.md
.verification/ipa-worktree/README.md
.verification/ipa-worktree/assets/spotify/ATTRIBUTION.md
.verification/ipa-worktree/docs/ALLURE_PRECISE.md
.verification/ipa-worktree/docs/ANALYTICS.md
.verification/ipa-worktree/docs/APPLE.md
.verification/ipa-worktree/docs/AUDIO.md
.verification/ipa-worktree/docs/AUDIT.md
.verification/ipa-worktree/docs/AUDIT_2026-11-11.md
.verification/ipa-worktree/docs/DESIGN_SYSTEM.md
.verification/ipa-worktree/docs/FAISABILITE.md
.verification/ipa-worktree/docs/HISTORY.md
.verification/ipa-worktree/docs/HOME.md
.verification/ipa-worktree/docs/INSTALL_IPA.md
.verification/ipa-worktree/docs/INTERFACE.md
.verification/ipa-worktree/docs/MUSIC_UI.md
.verification/ipa-worktree/docs/PACING.md
.verification/ipa-worktree/docs/POLISH.md
.verification/ipa-worktree/docs/PROGRESSION.md
.verification/ipa-worktree/docs/RECETTE_IPHONE.md
.verification/ipa-worktree/docs/SETTINGS_UI.md
.verification/ipa-worktree/docs/SPOTIFY.md
.verification/ipa-worktree/docs/STABILISATION_2026-11-11.md
.verification/ipa-worktree/docs/TOOLS.md
.verification/ipa-worktree/docs/TRACKING.md
.verification/ipa-worktree/docs/VALIDATION.md
.verification/ipa-worktree/docs/WORKOUTS.md
.verification/ipa-worktree/docs/WORKOUT_LIBRARY.md
.verification/ipa-worktree/integrations/spotify-callback/README.md
.verification/refonte-ui/CLAUDE_ANALYSE.md
.verification/refonte-ui/README.md
.verification/refonte-ui/assets/spotify/ATTRIBUTION.md
.verification/refonte-ui/docs/ALLURE_PRECISE.md
.verification/refonte-ui/docs/ANALYTICS.md
.verification/refonte-ui/docs/APPLE.md
.verification/refonte-ui/docs/AUDIO.md
.verification/refonte-ui/docs/AUDIT.md
.verification/refonte-ui/docs/AUDIT_2026-11-11.md
.verification/refonte-ui/docs/DESIGN_SYSTEM.md
.verification/refonte-ui/docs/FAISABILITE.md
.verification/refonte-ui/docs/HISTORY.md
.verification/refonte-ui/docs/HOME.md
.verification/refonte-ui/docs/INSTALL_IPA.md
.verification/refonte-ui/docs/INTERFACE.md
.verification/refonte-ui/docs/MUSIC_UI.md
.verification/refonte-ui/docs/PACING.md
.verification/refonte-ui/docs/PALETTE.md
.verification/refonte-ui/docs/PERF.md
.verification/refonte-ui/docs/POLISH.md
.verification/refonte-ui/docs/PROGRESSION.md
.verification/refonte-ui/docs/RECETTE_IPHONE.md
.verification/refonte-ui/docs/REFONTE_UI.md
.verification/refonte-ui/docs/SETTINGS_UI.md
.verification/refonte-ui/docs/SPOTIFY.md
.verification/refonte-ui/docs/STABILISATION_2026-11-11.md
.verification/refonte-ui/docs/TOOLS.md
.verification/refonte-ui/docs/TRACKING.md
.verification/refonte-ui/docs/VALIDATION.md
.verification/refonte-ui/docs/WORKOUTS.md
.verification/refonte-ui/docs/WORKOUT_LIBRARY.md
.verification/refonte-ui/integrations/spotify-callback/README.md
artifacts/compte-obligatoire-accueil-618a85e/INSTALLATION.md
artifacts/finalisation-8b0b61b-connectee/INSTALLATION.md
artifacts/finalisation-b238bc5/INSTALLATION.md
```

</details>
