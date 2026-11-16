# Validation et limites des preuves

[Carte documentaire](../00-INDEX.md) · [Recettes ciblées](recettes/README.md) · [Priorités](../roadmap/priorites.md)

## Intégration Editorial Coast — 16 novembre 2026

[Interface intégrée](../design/interface.md) · [Système visuel](../design/systeme-visuel.md) · [Maquettes de référence](../design/prototype/captures/apres/)

| Contrôle | Résultat et périmètre |
|---|---|
| `npm run check` | **38 fichiers, 376 tests réussis**. Types et garde secrets valides, lint sans erreur avec cinq avertissements préexistants. Couverture de 95,4 % des fonctions sur les cinq fichiers de synchronisation configurés. |
| Distances et contrastes | Les tests vérifient les totaux, les barres et la dernière sortie selon la période, dont un changement d’année et la comparaison à date comparable. Les couples sémantiques contrôlés passent en clair, en sombre et sur la console. |
| `expo export --platform all` | Exports JavaScript et ressources réussis pour web, iOS et Android. |
| Course et GPX | Dans Edge, connexion e-mail avec rejet d’un code erroné, préparation, départ, pause, navigation locale pendant la pause, reprise, fin avec enregistrement et bilan. Progrès → Historique → Détail → Carte → GPX : fichier téléchargé contenant les points de la sortie de test. Récupération en pause après rechargement. |
| Découvrir | Recherche conservée après Fiche → Préparer → Retour ; lien officiel et export ICS contrôlés. Favori local retrouvé hors ligne ; échec du catalogue signalé avec accès à la fiche enregistrée. Pendant une pause, l’ouverture de Découvrir ne déclenche pas de lecture du flux distant. |
| Musique et profil | Import d’un lien Spotify, ouverture de sa fiche, retour à Courir avec mini-lecteur. Modification du nom sportif local, affichée après rechargement. |
| Petit écran et accessibilité | Aperçu sombre à 320 × 640 px : départ à portée, y compris avec le texte agrandi de 35 % dans le navigateur. Permission GPS refusée : le message est visible, aucune course n’est lancée. |

La recette Edge a utilisé un backend local pour l’authentification et le flux du catalogue, des positions de test injectées par le navigateur et la préférence de mouvement réduit. Les captures à 390 × 844 px et le [comparatif de référence](../design/refonte-editorial-performance.md) ont été rapprochés écran par écran. Le comparatif local est dans `.expo/editorial-native-validation/comparatif.html`. Les écarts observés proviennent notamment des marges système absentes du navigateur, des données de sortie réellement enregistrées pendant la recette et de l’absence de pochette Spotify quand les métadonnées ne sont pas disponibles. Les choix avancés et les sources restent consultables sur les écrans concernés.

La [recette sur iPhone](recette-course-iphone.md) reste ouverte pour VoiceOver, Dynamic Type, Réduire la transparence, la carte native, l’acquisition GPS physique, les alertes et le suivi écran verrouillé. Vérifier aussi les retours de Spotify connecté et les bannières, avatars et thèmes du profil natif activés par les flags. Aucun binaire IPA ni déploiement n’a été réalisé dans cette recette.

## Découvrir Nice — 15 novembre 2026

[Fiche du domaine](../features/decouvrir-nice.md). Validation sur Windows avec PostgreSQL 17.11, Deno 2.9 et Edge en mode headless.

| Contrôle | Résultat observé | Portée |
|---|---|---|
| `npm run check` | 37 fichiers, 354 tests réussis. Types et garde secrets valides. Lint sans erreur, six avertissements préexistants. | 12 nouveaux tests Découvrir. Couverture de 95,4 % des fonctions sur les cinq fichiers de synchronisation configurés. |
| Lint, typecheck et tests Deno | 24 tests réussis, dont cinq pour Apidae | Licence, dates en heure de Paris, récurrence, validation, rejeu et erreurs. Le sondage HTTPS a aussi lu le fichier public réel. |
| PostgreSQL et pgTAP | 21 migrations appliquées, 19 fichiers, 416 assertions réussies, dont 24 pour Découvrir | Base éphémère avec émulation des schémas Auth et Storage, selon le banc `scripts/db-local`. Les tests vérifient les rôles, le bail, la revue et le retrait du catalogue. |
| Export Expo et dépendances | `expo install --check` et exports iOS, Android et web réussis | Bundles JavaScript et ressources locales. |
| Recette web à 360 et 320 px | Parcours réussis avec session et RPC locales simulées | Navigation Courir puis Découvrir, recherche, fiche, lien officiel, favori après relancement, téléchargement ICS, plan 10 km, carte, dock, cache hors ligne et erreur réseau. Démarrage web avec position de test, pause et contrôle de l’absence de lecture de Découvrir pendant la pause. Captures claire et sombre dans `.expo/discovery-validation`. |

La recette sur iPhone et Android reste à effectuer pour VoiceOver, Dynamic Type, le GPS physique, le rendu du fournisseur cartographique et l’ouverture du fichier calendrier. La migration, la fonction et le déclenchement planifié restent à activer sur le projet Supabase cible.

## Intégration OTA store — 15 novembre 2026

Après la refonte documentaire ci-dessous, intégration locale des [mises à jour OTA](../architecture/mises-a-jour-ota.md), sur Windows, à partir de `cc98fc6`. L’installation `expo install expo-updates` a ajouté la version SDK 58 et complété les modules locaux manquants sans réécrire les versions natives existantes du verrou.

| Contrôle | Résultat observé | Portée |
|---|---|---|
| `npm run check` | **Réussi** : lint sans erreur (6 avertissements préexistants), types et garde secrets valides ; **36 fichiers, 342 tests réussis** | Tests du dépôt courant, dont 28 cas OTA ; scénarios natifs simulés |
| Couverture | **95,4 % des fonctions** (83/87), seuil 90 % satisfait | Seulement les cinq fichiers de synchronisation de `vitest.config.mjs`, pas toute l’application |
| `npx expo install --check` | **Réussi** | Dépendances compatibles SDK 58, dont `expo-updates ~58.0.22` |
| `node scripts/check-sideload-config.cjs` | **Réussi** | Variante IPA : OTA désactivées, URL retirée ; configuration et plugins store conservés |
| Configuration Expo résolue | **Vérifiée localement** | URL du projet EAS existant, politique fingerprint, bundle embarqué et plugins store présents |
| Fingerprints natifs | **Distincts** : store `e55c9fa65f79739ed5042fb0442acf1fbd857494`, sideload `13d6d2e2751a14e37bbbf4bb0d8ec97a0bd5b313` | Calcul local avec `@expo/fingerprint`, plateformes iOS et Android ; pas une attestation d’un binaire construit |
| Export Expo iOS / Android / web | **Réussi** vers `.expo/ota-validation` | Bundles JavaScript/assets uniquement, aucune compilation IPA ni publication |
| Publication EAS / build IPA / recette iPhone et Android | **Non exécutés** | Préparation pour les futurs stores ; aucune preuve de livraison OTA réelle |

Les tests et TypeScript excluent désormais `.verification/` dans leur configuration ; aucun worktree ni artefact personnel n’a été déplacé ou supprimé. Les recherches concurrentes, pause/course/récupération, indisponibilité réseau, délais, échecs de téléchargement et directive de rollback embarqué sont simulés. Le choix du bundle avant JavaScript et la récupération d’un brouillon après un démarrage avec OTA restent des scénarios physiques ouverts. Voir la recette détaillée dans la fiche OTA.

## Relevé documentaire initial — 15 novembre 2026

Sources : arbre issu de `4197244`, Windows, installation locale existante. Aucun changement de dépendance, de test ou de code applicatif n’a été effectué pour cette refonte.

| Contrôle | Résultat observé | Portée |
|---|---|---|
| `npm run check` | **Échec au lint : 7 erreurs, 6 avertissements** | Modules absents de l’installation ; les étapes suivantes de cette chaîne n’ont pas tourné |
| `npm run typecheck` séparé | **Échec** | Modules non résolus et erreurs de typage associées ; pas de compilation TypeScript verte à annoncer |
| `npm run check:secrets` séparé | **Réussi** | Sources embarquées et configurations ciblées, pas tout l’historique Git |
| `npx vitest run --exclude '.verification/**'` | **31 fichiers réussis, 271 tests réussis, 3 suites en échec au chargement** | 34 fichiers de tests du dépôt courant ; pas un succès global |
| Couverture actuelle | **Non obtenue** | La chaîne `check` s’arrête au lint ; aucun pourcentage actuel validé |
| Tests SQL / Deno | **Non exécutés ici** | Supabase CLI, Docker, psql et Deno absents de cet environnement |
| Export Expo / build natif / recette appareil | **Non exécutés pour cette tâche** | Aucune compilation IPA demandée ni lancée |

Les suites bloquées sont [account-auth](../../tests/account-auth.test.ts) (`aes-js` absent), [session](../../tests/session.test.ts) et [sync-routes](../../tests/sync-routes.test.ts) (`fflate` absent). Lint/types relèvent aussi notamment Supabase, Google Sign-In, NetInfo et certains modules Expo absents. Ces dépendances sont déclarées dans [package.json](../../package.json) : une installation propre est nécessaire avant de conclure sur leurs erreurs résiduelles.

Le premier `npm test` a découvert aussi les tests de worktrees ignorés dans `.verification/` : 667 tests réussis dans 64 fichiers et trois suites bloquées. Ce total mélange plusieurs arbres et **n’est pas le résultat du dépôt courant**. Le passage isolé ci-dessus est la référence locale. La configuration n’a pas été modifiée pour masquer ce problème.

## Ce que la CI prévoit

[verify.yml](../../.github/workflows/verify.yml) définit quatre jobs : app, base SQL, Edge Functions et secrets. Il prévoit `npm ci`, `npm run check`, compatibilité Expo, exports iOS/Android/web, reset/lint/pgTAP, budget admin synthétique, Deno et Gitleaks. [vitest.config.mjs](../../vitest.config.mjs) impose **90 % de couverture des fonctions** sur cinq fichiers de sync ; ce n’est pas un seuil global de couverture de l’application.

Le [workflow IPA](../../.github/workflows/ios-ipa.yml) est séparé et manuel. La présence de ces workflows ne prouve pas leur dernier succès. Les anciens chiffres de 148, 164, 230 ou 310 tests, 95,4 % de couverture et les constats de déploiement sont des [preuves historiques](../archive/README.md), non réexécutées ni reconsultées à distance ici.

## Niveau de preuve

- Un test unitaire ou d’adaptateur simulé valide son scénario, pas le GPS physique ni le service réel.
- SQLite sous Node ne valide pas le module Expo sur iPhone ; un banc SQL émulé ne valide pas toute la pile Supabase.
- Un export JavaScript ne valide ni Swift, ni extension, ni signature. Un build sideload ne valide pas les capacités Apple retirées de cette variante.
- Les recettes [iPhone](recette-course-iphone.md), [comptes/sync/profils](recettes/README.md) et [performance](performance.md) restent ouvertes jusqu’à preuve datée et contexte matériel.

La vérification documentaire est consignée dans le [compte rendu de refonte](audit-documentaire-2026-11-15.md). Elle ne transforme aucun statut produit en « recetté ».
