# Carte documentaire de Sprinter

[Présentation et démarrage du projet](../README.md).

**Parcours court :** [instructions Codex](../AGENTS.md) → fiche du domaine → fichiers sources indiqués. Lire [l’architecture](architecture/vue-ensemble.md) seulement si le périmètre est nouveau. Les archives ne servent qu’à une recherche historique.

État décrit : arbre de travail issu de `4197244`, audité le **15 novembre 2026**. Le code décrit l’implémentation ; [validation](quality/validation.md) décrit les preuves. Une fonctionnalité codée ou un flag présent ne prouve pas son activation distante.

## Choisir selon la tâche

| Information recherchée | Référence active |
|---|---|
| Produit, fonctions présentes, partielles ou prévues | [État des fonctionnalités](features/etat-fonctionnalites.md) |
| Modules et dépendances | [Architecture générale](architecture/vue-ensemble.md) |
| Cycle GPS, données, bases locales et migrations | [Données et cycle de course](architecture/donnees-et-cycle-course.md) |
| Installation, commandes, Expo Go, iOS, Android et web | [Développement](architecture/developpement.md) |
| Mises à jour automatiques des futures versions App Store / Play Store | [Mises à jour OTA](architecture/mises-a-jour-ota.md) |
| Allure, GPS, pauses, coach audio et haptiques | [Course et coach](features/course-et-coach.md) |
| Séances, défis, calendrier, plans, objectifs et chaussures | [Séances et progression](features/seances-et-progression.md) |
| Découverte locale, agenda, carte, favoris et import éditorial | [Découvrir Nice](features/decouvrir-nice.md) |
| Historique, records, comparaison, parcours, exports | [Analyse, parcours et partage](features/analyse-parcours-partage.md) |
| Connexion, session, consentements, export et suppression | [Comptes](features/comptes.md) |
| Profil privé, studio, publication, thèmes, classement | [Profils et communauté](features/profils-et-communaute.md) |
| Apple Santé, Live Activity, cadence, Spotify, météo, Strava | [Intégrations](features/integrations.md) |
| Navigation et destinations des actions | [Interface](design/interface.md) |
| Composants, palettes, typographie et accessibilité | [Système visuel](design/systeme-visuel.md) |
| Tables, migrations, RLS, Edge Functions et admin | [Architecture backend](backend/architecture.md) |
| Outbox, conflits, comptes multiples, tracés cloud | [Synchronisation](backend/synchronisation.md) |
| Variables, environnements, jobs, commandes backend | [Exploitation](backend/exploitation.md) |
| Contrats détaillés de l’administration | [RPC admin](backend/admin-rpc-contract.md) |
| Raisons des choix techniques à préserver | [Décisions durables](decisions/README.md) |
| Vérifications exécutées et limites | [Validation](quality/validation.md) |
| Campagne comptes, sync, admin, Android et profils | [Recettes par domaine](quality/recettes/README.md) |
| Terrain, course, audio, Santé, interruptions | [Recette iPhone](quality/recette-course-iphone.md) |
| Mesures CPU, mémoire et fluidité à réaliser | [Performance](quality/performance.md) |
| Mise à jour et contrôle des documents | [Maintenance documentaire](quality/documentation.md) |
| Obstacles, décisions ouvertes, travail prévu | [Priorités](roadmap/priorites.md) |
| Checklist opérationnelle de mise en service | [Lancement](roadmap/lancement.md) |
| Documents juridiques, conformité et stores | [Dossier RGPD](rgpd/README.md) |
| Audit de cette refonte et sort de chaque ancien Markdown | [Compte rendu documentaire](quality/audit-documentaire-2026-11-15.md) |
| Audits et cahier des charges historiques | [Archives](archive/README.md) |

## Documents proches des artefacts

- [Installation IPA](INSTALL_IPA.md) reste à cet emplacement : le script de packaging la copie dans l’artefact d’installation.
- [Retour HTTPS Spotify](../integrations/spotify-callback/README.md) accompagne la page à héberger ; [attribution Spotify](../assets/spotify/ATTRIBUTION.md) accompagne les ressources.
- [Page publique de suppression](../web/README.md) accompagne ses fichiers statiques.
- [Ancien point d’entrée comptes](ACCOUNTS.md) reste un routeur pour le commentaire de configuration Supabase.

## Lire les statuts

**Implémenté** : chemin de code présent et raccordé. **Partiel** : contrat, adaptateur ou intégration incomplet. **Prévu** : pas de parcours opérationnel trouvé. **Validé** exige une preuve datée et un périmètre ; un test simulé ne valide pas le téléphone. **Non testé ici** n’affirme pas l’absence de toute validation passée. Ces axes restent séparés dans la [matrice](features/etat-fonctionnalites.md).
