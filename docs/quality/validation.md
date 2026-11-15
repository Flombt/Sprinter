# Validation et limites des preuves

[Carte documentaire](../00-INDEX.md) · [Recettes ciblées](recettes/README.md) · [Priorités](../roadmap/priorites.md)

## Contrôles exécutés le 15 novembre 2026

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
