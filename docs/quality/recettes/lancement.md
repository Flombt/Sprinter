# Recette · lancement

> **Recette manuelle NON EXÉCUTÉE.** Ne cocher qu’après observation sur le commit et le client consignés. Les attentes de la spécification historique ont été adaptées au compte obligatoire ; elles ne constituent pas une preuve de conformité.

[Campagne et fiche de résultat](README.md) · [État actuel](../../features/etat-fonctionnalites.md)

## 8. Phase 6 · Lancement

#### R6.01 · Checklists du §13

*Critère : « Toutes les cases du §13 cochées. »* · Type : revue

- **Préconditions** : sections 1 à 4 de [LANCEMENT](../../roadmap/lancement.md) remplies.
- **Étapes** : contrôler chaque case et sa preuve.
- **Attendu** : aucune case ouverte, aucune preuve manquante.

| | Réussi | Observé |
|---|:-:|---|
| Checklists | [ ] | |

#### R6.02 · Parcours complet sur les builds de production

*Tâche de la phase 6 : « recette complète (inscription, connexion, suppression, changement d'appareil, iOS↔Android) ».* · Type : appareil

- **Préconditions** : builds `production` (TestFlight, test interne Play) · projet `sprinter-prod` avec flags activés pendant la fenêtre de recette · comptes de recette uniquement.
- **Étapes** : inscription avec Apple sur iPhone, Google sur Android et e-mail · sauvegarde des courses et des parcours · changement d'appareil iPhone vers Android · export · suppression dans l'app et suppression à distance · suppression des comptes de recette et des tracés en fin de parcours.
- **Attendu** : parcours sans anomalie bloquante, production propre à la fin.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### R6.03 · Retour arrière sans mise à jour de l'app

*Critère du §13.5 : « `accounts_enabled` et `sync_enabled` désactivables sans mise à jour de l'app. »* · Type : appareil et navigateur

- **Préconditions** : production sans utilisateur public · comptes de recette connectés sur iPhone et Android avec des éléments en attente.
- **Étapes** : passer `sync_enabled` puis `accounts_enabled` à `false` · relever le délai de prise en compte (au lancement après expiration du cache, ou immédiatement si les contrôles serveur existent) · vérifier l'arrêt de la synchronisation, puis la désactivation des options cloud dépendantes ; la connexion et les données du compte restent accessibles selon la session · vérifier que la page web de suppression reste utilisable · réactiver.
- **Attendu** : coupure et reprise sans nouvelle version, sans perte, délai connu et consigné.

| Appareil | Réussi | Observé (délai mesuré) |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |
