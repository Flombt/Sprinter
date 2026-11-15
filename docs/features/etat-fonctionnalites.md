# État réel des fonctionnalités

[Carte documentaire](../00-INDEX.md) · [Validation datée](../quality/validation.md)

Relevé du **15 novembre 2026**, sources de `4197244`. « Implémenté » signifie raccordé dans le code. Les flags ont des défauts faux ; leurs valeurs déployées n’ont pas été relues. Le compte obligatoire ne dépend pas de `accounts_enabled`.

Les tests cités dans les fiches vérifient des calculs ou adaptateurs simulés. Leur exécution et leurs échecs sont consignés séparément. **Aucune recette physique n’a été exécutée pendant cette refonte.**

| Domaine | Implémentation observée | Disponibilité / limite | Référence et validation |
|---|---|---|---|
| Connexion obligatoire, accueil après connexion | Implémenté | Backend configuré ; e-mail ou fournisseur natif | [Comptes](comptes.md) ; tests account-startup/config/auth |
| GPS, pauses, récupération, allure | Implémenté | Premier plan Expo Go ; fond soumis au client et permissions | [Course](course-et-coach.md) ; tests core/location/storage, suite session bloquée localement |
| Allure précise, plages, objectifs temps/km | Implémenté | 5:00 exact au départ simple ; GPS estimatif | [Coach](course-et-coach.md) ; tests coach/engine/pace |
| Audio, voix, haptiques | Implémenté | Premier plan ; mélange musical et matériel à vérifier | [Coach](course-et-coach.md) ; tests de logique audio, recette ouverte |
| Séances, défis, favoris, créateur | Implémenté | Abandon d’objectif sans arrêt du GPS | [Séances](seances-et-progression.md) ; couverture métier partielle |
| Calendrier, objectifs, plans, journal, chaussures | Implémenté | Local ; sous-ensemble portable seulement | [Progression](seances-et-progression.md) ; recette ouverte |
| Historique, séries, records et comparaison | Implémenté | Qualité/continuité requises ; données absentes explicites | [Analyse](analyse-parcours-partage.md) ; tests pace-route/recordedTrack |
| Trois activités d’exemple | Implémenté | Affichage pédagogique séparé des données personnelles | [Analyse](analyse-parcours-partage.md) ; tests example-runs |
| GPX, favoris, guidage, partage masqué | Implémenté | Guidage de proximité ; aucun routage routier | [Parcours](analyse-parcours-partage.md) ; tests gpx-export/routeRun |
| Métronome / cadence | Implémenté | Audio natif / Core Motion iOS ; aucune cadence GPS inventée | [Intégrations](integrations.md) ; recette matérielle ouverte |
| Santé / Live Activity | Code intégré | Client normal requis ; désactivés Expo Go/sideload | [Apple](integrations.md) ; health-recovery, recette native ouverte |
| Spotify : références et liens | Implémenté | Indépendant du compte Spotify | [Spotify](integrations.md) ; tests spotify-links/store |
| Spotify : OAuth et commandes | Code intégré, exploitation à configurer | Client installé, retour HTTPS, scopes/appareil/droits | [Spotify](integrations.md) ; tests API simulés, compte réel non vérifié ici |
| Sauvegarde courses/réglages/documents | Implémenté | `accounts_enabled` + `sync_enabled`, choix explicite ; hors course | [Sync](../backend/synchronisation.md) ; tests engine/documents/migration |
| Tracés GPS cloud | Implémenté | Choix séparé + `routes_sync_enabled`, Wi-Fi pour l’envoi | [Sync](../backend/synchronisation.md) ; suite sync-routes bloquée localement |
| Profil privé, studio, partage, thèmes, cartes | Implémentés | Flags de profil et dépendances ; natif | [Profils](profils-et-communaute.md) ; tests profile-* ; activation non attestée ici |
| Classement communautaire | Implémenté | `leaderboard_enabled`, adhésion explicite et pseudo | [Communauté](profils-et-communaute.md) ; pgTAP présent, non exécuté ici |
| Admin, support, export/suppression, purges | Backend implémenté | Site admin externe ; SMTP, jobs et déploiement à vérifier | [Backend](../backend/architecture.md) ; Deno/SQL présents, outils absents ici |
| Android | Code et CI configurés | Cartes, fournisseurs, fond et permissions à recetter | [Développement](../architecture/developpement.md), [recette Android](../quality/recettes/android.md) |
| Météo | Partiel pour la distribution | Open-Meteo en développement ; aucun fournisseur de production branché | [Intégrations](integrations.md) |
| Strava | Contrat préparatoire seulement | Aucun OAuth, transport ou envoi actif | [Intégrations](integrations.md) |
| Apple Watch | Contrat préparatoire seulement | Aucune app watchOS ou session WatchConnectivity | [Intégrations](integrations.md) |
| Sentry, téléchargement de cartes hors ligne | Absents du périmètre opérationnel observé | Évolutions éventuelles | [Priorités](../roadmap/priorites.md) |

Les profils et fonctions sociales ne sont plus « à coder » : le travail restant concerne notamment configuration, activation volontaire, conformité et validation. Un ancien rapport de déploiement ne prouve pas l’état du service aujourd’hui.
