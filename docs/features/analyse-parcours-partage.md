# Analyse, parcours et partage

[État des fonctionnalités](etat-fonctionnalites.md) · [Confidentialité des copies](../decisions/004-confidentialite-et-publication.md)

## Historique et analyses

[History.tsx](../../src/screens/History.tsx), [Detail.tsx](../../src/screens/Detail.tsx), [RunInsights.tsx](../../src/screens/RunInsights.tsx) et [Comparison.tsx](../../src/screens/Comparison.tsx) affichent les sorties. [summary.ts](../../src/analysis/summary.ts) construit le bilan ; [track.ts](../../src/analysis/track.ts) traite qualité et ruptures ; [distanceTime.ts](../../src/analysis/distanceTime.ts) et [paceRoute.ts](../../src/analysis/paceRoute.ts) relient séries et carte.

Les séries ne relient pas les pauses ou trous GPS. Les valeurs absentes restent indisponibles ; un historique ancien ne reçoit pas de temps total ou de qualité inventés. La durée couverte accompagne le temps en cible. Les intermédiaires utilisent la distance mesurée et l’interpolation ; le dernier tronçon peut être partiel.

[analysis/records.ts](../../src/analysis/records.ts) recherche des segments continus fiables et garde leur chronométrie. Le fantôme réutilise le segment réel qui qualifie le record. Ne pas extrapoler une distance manquante ni remplacer un record par une allure instantanée.

## Exemples séparés

[exampleRuns.ts](../../src/progression/exampleRuns.ts) fournit trois activités pédagogiques à [StatsDashboard.tsx](../../src/screens/StatsDashboard.tsx) et [ExampleDetail.tsx](../../src/screens/ExampleDetail.tsx). Elles ne sont pas insérées dans le dépôt de courses, les records personnels ou la sync. L’affirmation historique « aucun parcours de démonstration » était trop large.

## Parcours et guidage

[GPX](../../src/routes/gpx.ts), [validation](../../src/routes/validation.ts), [géométrie](../../src/routes/geometry.ts) et [navigation](../../src/routes/navigation.ts) assurent import borné, favoris et détection d’écart confirmé. Le guidage suit une géométrie ; il ne calcule pas de route ou d’instructions virage par virage. Les autorisations GPS restent celles de la course.

Importer un favori GPX ne crée pas automatiquement une activité sportive. Les [tracés cloud](../backend/synchronisation.md) ont une autre responsabilité : sauvegarder et télécharger le parcours d’une course.

## Exports et partage

[analysis/export/](../../src/analysis/export/) produit GPX et CSV. [sharing/documents.ts](../../src/sharing/documents.ts) prépare copies publiques/complètes, résumé et statistiques sans positions. [privacy.ts](../../src/sharing/privacy.ts) choisit par défaut **300 m** de masquage autour des extrémités, réglable de 100 à 2 000 m.

Le masquage retire aussi les retours dans ces zones et coupe les arêtes qui les traversent. Le GPX public retire horaires et identifiants ; une copie complète exige un choix explicite. Ce traitement réduit l’exposition sans garantir l’anonymat. Le périmètre des statistiques de résumé reste distinct des seules portions géographiques visibles.

Le [partage natif](../../src/services/documentShare.ts) et sa [variante web](../../src/services/documentShare.web.ts) restent des adaptateurs ; partager un fichier n’active pas de position en direct.

Tests utiles : [recordedTrack](../../tests/recordedTrack.test.ts), [pace-route](../../tests/pace-route.test.ts), [routeRun](../../tests/routeRun.test.ts), [gpx-export](../../tests/gpx-export.test.ts), [example-runs](../../tests/example-runs.test.ts). Lire [validation](../quality/validation.md) et [recette iPhone](../quality/recette-course-iphone.md) pour les limites du partage et des fournisseurs de fichiers.
