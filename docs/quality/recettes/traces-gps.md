# Recette · traces gps

> **Recette manuelle NON EXÉCUTÉE.** Ne cocher qu’après observation sur le commit et le client consignés. Les attentes de la spécification historique ont été adaptées au compte obligatoire ; elles ne constituent pas une preuve de conformité.

[Campagne et fiche de résultat](README.md) · [État actuel](../../features/etat-fonctionnalites.md)

## 5. Phase 3 · Tracés GPS

#### R3.01 · Choix GPS sans présélection, journalisé une fois

*Critère : « Aucun choix présélectionné. Le choix est journalisé une seule fois et s'applique au second appareil. Un envoi direct ou retardé est refusé si l'une des deux sauvegardes est désactivée. »* · Type : appareil et preuve

- **Préconditions** : `routes_sync_enabled = true` en staging · compte neuf · deux appareils.
- **Étapes**
  1. Après l'activation de la sauvegarde des courses, l'écran du choix GPS apparaît une seule fois, sans bouton présélectionné.
  2. Choisir « Sauvegarder les parcours ». Historique des choix : une entrée `cloud_sync_routes`. Fermer l'app pendant la confirmation, relancer : toujours une seule entrée.
  3. Appareil 2 : aucune nouvelle question, réglage affiché comme activé.
  4. Avec un tracé en attente, désactiver la sauvegarde des courses, puis réessayer : envoi refusé. Joindre la preuve du test d'envoi retardé refusé.
- **Attendu** : choix libre, journalisé une fois, appliqué partout, aucun envoi sans les deux sauvegardes.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### R3.02 · Cloisonnement de Storage

*Critère : « Un utilisateur ne peut ni lire ni écrire le dossier Storage d'un autre (test automatisé). »* · Type : preuve et script staging

- **Préconditions** : comptes A et B avec un tracé chacun en staging · jetons de test.
- **Étapes** : joindre l'exécution du test automatisé. En complément, avec le jeton de A, tenter de lire, d'écrire puis de supprimer un objet sous le dossier de B.
- **Attendu** : trois refus.

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Preuve CI | [ ] | |
| Script staging | [ ] | |

#### R3.03 · Course de 10 km : envoi après la course, fichier de 8 Mo au plus

*Critère : « Course de 10 km : téléversée après la course, jamais pendant ; fichier ≤ 8 Mo. »* · Type : appareil (course réelle de Flo)

- **Préconditions** : sauvegardes des courses et des parcours actives · proxy HTTPS sur l'appareil · départ et arrivée éloignés du domicile.
- **Étapes** : courir 10 km avec le proxy actif · vérifier l'absence d'envoi pendant la course, puis l'envoi au repos · relever la taille du fichier (taille en ligne dans Mes données, ou métadonnées en staging, sans ouvrir le fichier).
- **Attendu** : aucun envoi pendant la course, fichier de 8 Mo au plus.

| Appareil | Réussi | Observé (taille) |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### R3.04 · Nouvel appareil : tracé téléchargé à l'ouverture

*Critère : « Nouvel appareil : tracé téléchargé à l'ouverture du détail ; carte identique à l'original. »* · Type : appareil

- **Préconditions** : course de R3.03 sauvegardée avec son tracé · second appareil vide connecté au même compte.
- **Étapes** : sur un appareil vide connecté au compte, ouvrir le détail de la course de R3.03 · observer la barre de progression · comparer les deux cartes.
- **Attendu** : téléchargement à la demande, carte identique. Captures conservées en privé puis supprimées.

| Combinaison | Réussi | Observé |
|---|:-:|---|
| iPhone → Android | [ ] | |
| Android → iPhone | [ ] | |

#### R3.05 · Règles de validité

*Critère : « Un test par règle de validité du §9.1 ; un client ne peut pas imposer `validity`. »* · Type : preuve et appareil

- **Préconditions** : fichiers GPX synthétiques préparés (80 m, 20 m/s, deux courses qui se chevauchent) · script d'appel en staging.
- **Étapes**
  1. Joindre la preuve des tests automatisés (une règle, un test).
  2. Sur l'appareil, importer des GPX synthétiques : course de 80 m (trop courte), course à 20 m/s (vitesse de véhicule), deux courses qui se chevauchent. Lire l'information de validité affichée.
  3. Script staging : envoyer une course avec `validity = 'valid'` forcé, alors qu'elle est trop courte.
- **Attendu** : validité affichée à titre d'information, valeur imposée par le client ignorée.

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Preuve CI | [ ] | |
| iPhone | [ ] | |
| Android | [ ] | |

#### R3.06 · Arrêt de la sauvegarde des parcours et suppression en ligne

*Critère : « Passage à `off` + « supprimer mes parcours » → fichiers et lignes `run_routes` supprimés. »* · Type : appareil et vérification staging

- **Préconditions** : compte avec au moins trois tracés en ligne.
- **Étapes** : Compte › Synchronisation › désactiver les parcours, choisir « Supprimer aussi mes parcours en ligne » · en staging, compter les objets du dossier du compte et les lignes `run_routes` · vérifier que les tracés restent sur l'appareil.
- **Attendu** : zéro objet, zéro ligne, tracés locaux intacts, nouveaux envois arrêtés.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |
