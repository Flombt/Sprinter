# Recette · communaute

> **Recette manuelle NON EXÉCUTÉE.** Ne cocher qu’après observation sur le commit et le client consignés. Les attentes de la spécification historique ont été adaptées au compte obligatoire ; elles ne constituent pas une preuve de conformité.

[Campagne et fiche de résultat](README.md) · [État actuel](../../features/etat-fonctionnalites.md)

## 9. Phase 7 · Classement communautaire

Le §14 ne liste pas de cases pour la phase 7. Les scénarios ci-dessous découlent de ses exigences : inscription explicite, pseudo, éligibilité du §9.2, absence de parcours et de lieu, signalement, retrait immédiat, `public_leaderboard` limité aux inscrits, flag `leaderboard_enabled`.

#### R7.01 · Inscription volontaire et journalisée

- **Préconditions** : `leaderboard_enabled = true` en staging · compte A connecté.
- **Étapes** : ouvrir le classement · s'inscrire explicitement · fermer l'app pendant la confirmation, relancer · consulter l'historique des choix.
- **Attendu** : aucune participation par défaut · une seule entrée `community_leaderboard`.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### R7.02 · Pseudo unique, jamais le nom réel

- **Préconditions** : comptes A et B inscrits, avec des noms affichés différents de leurs pseudos.
- **Étapes** : choisir pour B le pseudo de A · consulter le classement depuis un troisième compte.
- **Attendu** : pseudo en double refusé · seuls les pseudos apparaissent, jamais les noms affichés.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### R7.03 · Classement hebdomadaire sur courses éligibles

- **Préconditions** : compte inscrit avec, dans la semaine, une course éligible, une course suspecte, une course de 800 m, un import GPX et, sur iPhone, un import Santé.
- **Étapes** : consulter le classement hebdomadaire et la valeur du compte.
- **Attendu** : seule la course éligible est comptée (§9.2).

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### R7.04 · Aucun parcours, lieu ni nom réel

- **Préconditions** : script d'appel en staging avec le jeton d'un membre connecté.
- **Étapes** : appeler `public_leaderboard(scope, period)` · inspecter l'écran du classement.
- **Attendu** : rang, pseudo et valeur uniquement, sans lieu, parcours, nom, e-mail ni identifiant interne.

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Appareil et script | [ ] | |

#### R7.05 · Signalement et masquage de pseudos

- **Préconditions** : pseudo inapproprié fictif sur le compte B.
- **Étapes** : signaler le pseudo depuis A · le traiter dans l'admin avec un motif · consulter le classement depuis A et depuis un autre compte.
- **Attendu** : pseudo masqué partout, décision journalisée.

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Appareil et navigateur | [ ] | |

#### R7.06 · Retrait immédiat

- **Préconditions** : A inscrit et visible depuis l'appareil de B.
- **Étapes** : A se retire · B rafraîchit aussitôt le classement.
- **Attendu** : A disparaît immédiatement, sans attendre le rafraîchissement quotidien `refresh-rankings`.

| Combinaison | Réussi | Observé |
|---|:-:|---|
| iPhone → Android | [ ] | |

#### R7.07 · Inscrits seulement, flag et séparation du profil

- **Préconditions** : compte C non inscrit · fonctions de profil désactivées.
- **Étapes** : appeler `public_leaderboard` et chercher C · passer `leaderboard_enabled` à `false`, vider le cache, relancer · vérifier qu'aucun profil partageable n'a été créé pour les inscrits.
- **Attendu** : C absent · fonction masquée quand le flag est éteint · aucune création de profil (§17.7).

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Appareil et script | [ ] | |
