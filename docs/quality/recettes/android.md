# Recette · android

> **Recette manuelle NON EXÉCUTÉE.** Ne cocher qu’après observation sur le commit et le client consignés. Les attentes de la spécification historique ont été adaptées au compte obligatoire ; elles ne constituent pas une preuve de conformité.

[Campagne et fiche de résultat](README.md) · [État actuel](../../features/etat-fonctionnalites.md)

## 7. Phase 5 · Android

#### R5.01 · Course de 30 minutes écran verrouillé

*Critère : « Course de 30 min écran verrouillé sur Android 14 et 15 : trace continue, notification persistante, aucune coupure. »* · Type : appareil (course réelle)

- **Préconditions** : build `preview` Android · autorisations de localisation et de notification accordées · économie d'énergie du constructeur réglée comme indiqué par l'écran d'aide (§11).
- **Étapes** : démarrer une course, verrouiller l'écran pendant 30 minutes · vérifier la notification persistante · déverrouiller, terminer, ouvrir la carte.
- **Attendu** : trace continue, aucune coupure, notification présente pendant toute la course.

| Appareil | Réussi | Observé |
|---|:-:|---|
| Android 14 | [ ] | |
| Android 15 | [ ] | |

#### R5.02 · Scénarios croisés iOS et Android

*Critère : « Scénarios croisés : courses iOS visibles sur Android et inversement · réglages portables identiques · suppression propagée · import Santé visible sans tracé. »* · Type : appareil

- **Préconditions** : un même compte avec des courses créées sur iPhone (dont un import Santé) et sur Android.
- **Étapes** : sur Android, vérifier les courses iOS, dont l'import Santé · sur iPhone, vérifier les courses Android · modifier les réglages portables d'un côté, contrôler l'autre · supprimer une course de chaque côté.
- **Attendu** : courses visibles des deux côtés, réglages identiques, suppressions propagées, import Santé affiché sans carte. Voir aussi R2.03, R2.07 et S-H.

| Combinaison | Réussi | Observé |
|---|:-:|---|
| iPhone ↔ Android | [ ] | |

#### R5.03 · Modules iOS absents sans plantage

*Critère : « Aucun plantage lié aux modules iOS-only ; fonctions Apple masquées proprement. »* · Type : appareil

- **Préconditions** : build `preview` Android.
- **Étapes** : parcourir l'accueil, une course, l'historique, le détail, les réglages, le compte et les outils.
- **Attendu** : aucun plantage, aucune option Apple Santé, Live Activity ou widget iOS.

| Appareil | Réussi | Observé |
|---|:-:|---|
| Android 14 | [ ] | |
| Android 15 | [ ] | |

#### R5.04 · Connexions sur Android

*Critère : « Connexion Google et e-mail OK ; message clair pour un compte créé avec Apple. »* · Type : appareil

- **Préconditions** : un compte Google, un compte e-mail et un compte créé uniquement avec Apple sur iPhone.
- **Étapes** : se connecter avec Google, puis avec un code e-mail · chercher à accéder au compte créé avec Apple.
- **Attendu** : connexions réussies · explication claire pour le compte Apple (ajouter Google ou l'e-mail depuis iOS avant de changer de plateforme).

| Appareil | Réussi | Observé |
|---|:-:|---|
| Android | [ ] | |

#### R5.05 · Tests et export Android en CI

*Critère : « Tests existants + nouveaux verts ; `expo export --platform android` ajouté à la CI. »* · Type : preuve

- **Préconditions** : commit de la version Android.
- **Étapes** : joindre l'exécution de la CI.
- **Attendu** : tests existants et nouveaux verts, export Android vert.

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Preuve CI | [ ] | |

#### R5.06 · Autorisations Android

*Critère : « Permissions Android conformes (localisation, service au premier plan, notifications). »* · Type : appareil et preuve

- **Préconditions** : installation neuve · option A ou B retenue pour la localisation écran verrouillé ([Google Play](../../rgpd/stores/google-play-data-safety.md)) · manifeste fusionné du build.
- **Étapes** : démarrer une première course : communiqué visible avant la demande système si l'option A est retenue · n'accorder que la position approximative · vérifier la demande `POST_NOTIFICATIONS` sur Android 13 et plus · lire le manifeste fusionné.
- **Attendu** : demandes au bon moment et expliquées, message clair en position approximative, aucune autorisation inattendue (`AD_ID`, accès aux médias), types de service de premier plan déclarés.

| Appareil | Réussi | Observé |
|---|:-:|---|
| Android 14 | [ ] | |
| Android 15 | [ ] | |
