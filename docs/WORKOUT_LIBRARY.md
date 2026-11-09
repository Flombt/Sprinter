# Séances & Défis — bibliothèque et configuration

Livraison du **2 novembre 2026**. La bibliothèque existante est réorganisée autour de la création, des dernières séances, des modèles, des défis et des favoris. Le moteur d’entraînement et les onze modèles d’origine sont conservés.

## Organisation et choix

| Rubrique | Contenu et actions |
| --- | --- |
| Prochaine sortie | Séance déjà choisie, résumé et accès à la préparation. Une course active conserve ses propres blocs ; le choix concerne la prochaine course. Le retour à la course libre reste accessible. |
| Créer ma séance | Création existante avec distances, allures, répétitions, récupérations et conditions. |
| Dernières séances | Trois définitions distinctes issues de courses enregistrées dans lesquelles des blocs ont réellement commencé. Date, résultat et métriques de la course sont présentés ; la séance prévue reste identifiée comme telle. Relance du plan sauvegardé et accès au bilan réel. |
| Modèles essentiels | Sélection éditoriale de départ, puis accès aux six modèles d’entraînement. Le nom « essentiels » ne suppose pas une popularité mesurée ou un classement inventé. |
| Défis | Cinq modèles de défi, dont le fantôme et le record personnel qui conservent leurs sélecteurs de références GPS. Les défis personnalisés enregistrés figurent aussi dans cette rubrique. |
| Mes séances | Configurations réellement enregistrées, distinctes des modèles. Choisir, modifier, dupliquer et supprimer restent disponibles ; les actions de gestion sont regroupées sous le menu « … ». |
| Favoris | Modèles et séances enregistrées étoilés par l’utilisateur, conservés localement. Aucun favori de démonstration. |

Les filtres **Tout / Modèles / Mes séances / Défis / Favoris** permettent de parcourir une bibliothèque plus importante. La vue d’ensemble présente des sélections courtes, et les collections personnelles disposent de lots d’affichage de vingt éléments. Le filtre et le nombre d’éléments affichés restent conservés lors du retour depuis l’éditeur ou un sélecteur dans ce même onglet.

Les records de séances et le réglage vocal restent accessibles. Les mêmes callbacks contrôlent la préparation, l’éditeur, le détail d’activité et les sélecteurs de références ; aucune navigation fictive n’est ajoutée.

## Informations des cartes

Chaque carte distingue son origine (**Modèle**, **Défi**, **Ma séance**, **Dernière séance**) et son type : fractionné, progressif, endurance, pyramide, chrono, survie, régularité, fantôme ou record personnel. Les cartes reprennent les données des définitions existantes :

- Volume **prévu**, durée des blocs chronométrés et distance des blocs mesurés.
- Répétitions ou organisation des efforts, par exemple 10 × 400 m.
- Objectif réel : plage d’allure, progression, temps limite, budget hors cible, stabilité visée ou référence à battre.
- Complexité **simple / structurée / avancée**, d’après les blocs, répétitions, conditions et références nécessaires.

Le niveau décrit la structure de configuration, **pas une difficulté physique personnalisée**. Aucune aptitude du coureur n’est déduite des allures du modèle. Les distances, allures et récupérations restent adaptables dans l’éditeur.

Les informations ne mélangent pas les unités : un 10 × 400 m comprend **4 km d’effort**, auxquels s’ajoutent les blocs chronométrés d’échauffement, récupération et retour au calme. Leur distance réelle n’est pas inventée. Les blocs se terminant selon le temps en cible indiquent une durée variable. Les défis fantôme/record affichent qu’une référence est nécessaire avant d’en connaître le volume.

## Configuration et conservation des fonctions

L’éditeur commence par un aperçu du volume, de l’organisation, de l’objectif et des premières étapes du plan. Les règles du défi sont repliables ; elles sont ouvertes d’emblée pour une configuration comportant un défi. Tous les champs, validations, tolérances, modifications de blocs, répétitions imbriquées, ajustements d’allure et actions de sauvegarde restent disponibles. L’utilisation de l’éditeur depuis le calendrier conserve son callback d’application des blocs.

Les aperçus de modèles ne sont pas enregistrés. Ouvrir un modèle produit toujours une nouvelle définition éditable ; ses identifiants d’aperçu ne peuvent donc pas remplacer silencieusement une séance personnalisée déjà sauvegardée.

La relance récente utilise le plan archivé de la course choisie. Cela ne remplace pas la définition d’une séance enregistrée qui aurait été modifiée depuis. Le bilan historique reste attaché à son activité d’origine.

## Favoris et compatibilité locale

`WorkoutPreferences.favoriteKeys` est un champ facultatif des préférences existantes. Les références sont stables (`template:<type>` et `saved:<id>`) et limitées à 200 favoris. La lecture native SQLite et celle de l’aperçu web acceptent les anciennes préférences sans ce champ ; les références mal formées sont ignorées sans rendre les séances illisibles.

Les écritures passent par la file existante du store et sont publiées après sauvegarde. Une suppression de séance nettoie son favori ; un échec du nettoyage facultatif ne transforme pas une suppression déjà enregistrée en échec de suppression. Les références à des séances illisibles ne provoquent pas leur effacement.

Pas de nouvelle base, table ou permission, ni de changement de schéma SQLite. Les formats des définitions, des snapshots sportifs et des activités ne changent pas. La sélection, les réglages vocaux et les favoris restent des préférences séparées des données de course. Aucun service externe ou backend.

## Sources et vérifications

- `src/workouts/LibraryView.tsx` : rubriques, filtres et raccordement aux actions existantes.
- `src/workouts/LibraryCards.tsx` : cartes et aperçu de configuration réutilisables.
- `src/workouts/presentation.ts` : libellés et volumes tirés du plan, sans modifier le moteur.
- `src/workouts/favorites.ts` : références et assainissement des préférences de favoris.
- `src/screens/Workouts.tsx` : branchement de la bibliothèque et aperçu de l’éditeur ; vues de référence et records conservées.
- Store, types et adaptateurs de préférences : ajout limité aux favoris.

Compilations finales réussies sous Windows via RTK : TypeScript du projet, TypeScript avec `--noUnusedLocals --noUnusedParameters`, bundle iOS Hermes (1 255 modules, environ 3,5 Mo) et bundle web (environ 1,5 Mo). Aucun changement de dépendances ni compilation Swift/IPA signé.

Les empreintes du moteur de séances, de la définition/validation, des modèles, des records, de la session, des écrans Courir/Sorties/course en direct et d’`App.tsx` sont inchangées.

**Aucun test créé, modifié ou exécuté**, conformément à la consigne. Aucun scénario de course, historique artificiel ou donnée sportive de démonstration. Le navigateur local reste désactivé dans l’environnement ; aucun rendu ni validation physique n’est revendiqué.

Restent à examiner sur iPhone : lecture des cartes, grands caractères et VoiceOver, filtres et retour d’éditeur, étoiles après relancement, ajout/retrait/suppression/duplication d’un favori, relecture d’anciennes préférences, configuration complète des onze modèles, réutilisation d’un plan historique et préparation pendant une course active. Les compilations ne certifient pas à elles seules ces comportements.
