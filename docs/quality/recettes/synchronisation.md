# Recette · synchronisation

> **Recette manuelle NON EXÉCUTÉE.** Ne cocher qu’après observation sur le commit et le client consignés. Les attentes de la spécification historique ont été adaptées au compte obligatoire ; elles ne constituent pas une preuve de conformité.

[Campagne et fiche de résultat](README.md) · [État actuel](../../features/etat-fonctionnalites.md)

## 3. Phase 2 · Synchronisation

#### R2.01 · Trois courses, activation, mode avion et rejeu

*Critère : « Avant activation de la sauvegarde, trois courses restent sur l'appareil. Une fois la sauvegarde activée, la reconnexion après un passage en mode avion crée exactement trois lignes serveur, y compris après rejeu du lot trois fois. »* · Type : appareil et preuve

- **Préconditions** : compte neuf · `sync_enabled = true` · appareil sans course.
- **Étapes**
  1. Au choix de sauvegarde, répondre « Les garder sur cet appareil ». Enregistrer trois courses valides (au moins 100 m et 30 s).
  2. Mes données et fiche admin : aucune course en ligne.
  3. Passer en mode avion, puis activer « Sauvegarder mes courses ».
  4. Quitter le mode avion : trois courses en ligne, dans l'app et dans l'admin.
  5. Appuyer trois fois sur « Réessayer » : toujours trois. Joindre la preuve du test automatique de rejeu (même lot trois fois).
- **Attendu** : rien n'est envoyé avant le choix, exactement trois lignes ensuite, aucun doublon.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### R2.02 · Import initial de 500 courses

*Critère : « Import initial de 500 courses : arrière-plan, reprenable après arrêt de l'app, 0 doublon, UI jamais gelée (aucune image perdue > 100 ms mesurée sur appareil). »* · Type : appareil

- **Préconditions** : 500 courses synthétiques injectées par l'outil de recette · compte neuf · outil de mesure des images actif.
- **Étapes**
  1. Activer la sauvegarde. Vérifier qu'une sauvegarde locale est créée avant l'import.
  2. Pendant l'import, naviguer dans l'historique, le détail d'une course et les réglages. Relever les images de plus de 100 ms.
  3. Vers 40 %, forcer l'arrêt de l'app, puis la relancer : l'import reprend sans repartir de zéro.
  4. À la fin : 500 courses en ligne. En staging, nombre d'identifiants distincts égal au nombre de lignes.
- **Attendu** : import en arrière-plan, reprise après arrêt, aucun doublon, aucune image de plus de 100 ms.

| Appareil | Réussi | Observé (durée, images > 100 ms) |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### R2.03 · Suppression propagée et prioritaire

*Critère : « Deux appareils : suppression sur l'un → disparaît sur l'autre au pull suivant ; la suppression l'emporte sur une modification tardive. »* · Type : appareil

- **Préconditions** : deux appareils connectés au compte A et synchronisés, avec la course X.
- **Étapes**
  1. Appareil 2 hors ligne : modifier la course X (par exemple la chaussure ou la séance associée).
  2. Appareil 1 : supprimer X, synchroniser.
  3. Appareil 2 : revenir en ligne, synchroniser.
- **Attendu** : X disparaît de l'appareil 2, la modification tardive est ignorée, X ne réapparaît nulle part.

| Combinaison | Réussi | Observé |
|---|:-:|---|
| iPhone → Android | [ ] | |
| Android → iPhone | [ ] | |

#### R2.04 · Données du compte A jamais importées dans le compte B

*Critère : « Scénario D : impossible d'importer les données du compte A dans le compte B. »* · Type : appareil et script

- **Préconditions** : appareil lié au compte A avec des courses locales, dont des éléments non synchronisés · compte B existant.
- **Étapes** : dérouler le scénario S-D · puis, avec le jeton de B, vérifier en staging qu'aucune course de A n'a été envoyée vers B, y compris les éléments qui étaient en attente.
- **Attendu** : aucune donnée de A dans B, quel que soit le choix fait sur l'appareil.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### R2.05 · Aucun appel de synchronisation pendant une course

*Critère : « Pendant une course : 0 appel réseau de synchro (test avec session simulée). »* · Type : appareil et preuve

- **Préconditions** : proxy HTTPS sur l'appareil de test · des éléments en attente dans l'outbox.
- **Étapes**
  1. Hors ligne, modifier deux courses. Revenir en ligne et démarrer aussitôt une course de 5 minutes.
  2. Pendant la course, observer le proxy : aucun appel aux RPC `sync_*` ni à Storage.
  3. Terminer la course : la synchronisation démarre quelques secondes après.
  4. Joindre la preuve du test automatique avec session simulée.
- **Attendu** : zéro appel de synchronisation pendant la course, reprise à la fin.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### R2.06 · Réconciliation après plus de 60 jours

*Critère : « Réconciliation avant envoi après 60 jours hors ligne. Une modification en attente d'une course supprimée reste suspendue après la purge du tombstone. Au-delà du seuil de 10 courses ou 20 % d'écart, la décision de suppression locale attend la confirmation. »* · Type : appareil (outil de recette)

- **Préconditions** : compte avec 40 courses synchronisées sur deux appareils · outil « dernière synchronisation il y a 61 jours » · purge des tombstones déclenchable en staging.
- **Étapes**
  1. Appareil 2 : supprimer trois courses, synchroniser, puis faire purger leurs tombstones en staging.
  2. Appareil 1 : simuler 61 jours sans synchronisation et modifier hors ligne l'une des trois courses.
  3. Appareil 1 : revenir en ligne. La réconciliation des identifiants a lieu **avant** l'envoi : les trois courses disparaissent, la modification en attente est mise de côté et ne fait pas réapparaître la course.
  4. Recommencer avec douze courses supprimées : l'app demande une confirmation avant toute suppression locale.
  5. Une course créée localement pendant la période est bien sauvegardée.
- **Attendu** : aucune résurrection, confirmation au-delà du seuil, nouvelles courses envoyées.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### R2.07 · Seuls les réglages portables sont synchronisés

*Critère : « Seuls les réglages portables sont synchronisés (test sur la liste §7.5). »* · Type : appareil

- **Préconditions** : deux appareils connectés au même compte, sauvegarde active, réglages initialement différents.
- **Étapes**
  1. Appareil 1 : modifier l'allure par défaut, le son, les vibrations, l'apparence, la pause automatique et le coaching, ainsi que le suivi en arrière-plan et les réglages Santé et Spotify.
  2. Synchroniser, puis ouvrir les réglages de l'appareil 2.
- **Attendu** : les six réglages portables sont identiques sur l'appareil 2. Les réglages propres à l'appareil n'ont pas changé.

| Combinaison | Réussi | Observé |
|---|:-:|---|
| iPhone → Android | [ ] | |
| Android → iPhone | [ ] | |

#### R2.08 · Jeton expiré

*Critère : « Jeton expiré : un seul rafraîchissement, puis invitation à se reconnecter, aucune perte. »* · Type : appareil (staging)

- **Préconditions** : jeton de rafraîchissement rendu invalide (révocation des sessions depuis l'admin, ou outil de recette) · des éléments en attente.
- **Étapes**
  1. Révoquer les sessions du compte depuis l'admin (`revoke_sessions`).
  2. Sur l'appareil, modifier une course, puis « Réessayer ».
  3. Observer au proxy une seule tentative de rafraîchissement, puis l'invitation à se reconnecter.
  4. Se reconnecter : les éléments en attente partent.
- **Attendu** : une seule tentative, aucune perte, reprise après reconnexion.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### R2.09 · Migration de la base locale

*Critère : « Migration vers le schéma SQLite 4 ; enveloppes d’activité v1/v2/v3 et imports `healthkit:` préservés ; suites du commit candidat réussies. »* · Type : preuve et appareil

- **Préconditions** : version précédente de l'app installable (build interne) · commit de la nouvelle version.
- **Étapes**
  1. Preuve CI : schéma SQLite 4 et lecture des enveloppes `dataVersion` 1, 2 et 3 avec imports `healthkit:` ; suites du commit candidat réussies, sans reprendre un total historique.
  2. Appareil : installer la version précédente, créer quelques courses synthétiques, puis mettre à jour vers la nouvelle version.
- **Attendu** : toutes les courses présentes et correctes après la mise à jour, aucun plantage.

| Appareil | Réussi | Observé |
|---|:-:|---|
| Preuve CI | [ ] | |
| iPhone | [ ] | |

#### R2.10 · Écritures directes refusées

*Critère : « pgTAP : écriture directe sur `runs` refusée ; `sync_push_runs` ne peut écrire pour aucun autre `user_id`, même en le forçant dans le payload. »* · Type : preuve

- **Préconditions** : exécution pgTAP du commit testé · comptes A et B en staging et leurs jetons de test.
- **Étapes** : joindre l'exécution pgTAP verte. En complément, sur staging, avec le jeton du compte A : tentative d'insertion directe dans `runs` (refusée) et appel de `sync_push_runs` avec le `user_id` de B dans le contenu (ligne créée pour A ou refusée, rien pour B).
- **Attendu** : aucune écriture possible pour un autre compte.

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Preuve CI | [ ] | |
| Script staging | [ ] | |


## 4. Scénarios de synchronisation A à J (§7.6)

#### S-A · Anciennes courses locales non liées et premier compte connecté

- **Préconditions** : cinq courses locales, aucun compte.
- **Étapes** : créer un compte neuf · vérifier qu'aucune course ne part tant que la sauvegarde n'est pas activée · activer la sauvegarde · vérifier la sauvegarde locale préalable puis l'import en arrière-plan.
- **Attendu** : appareil lié au compte, cinq courses en ligne, sauvegarde locale créée avant l'import.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### S-B · Nouvel appareil vide, compte existant

- **Préconditions** : compte avec 300 courses et des tracés, sauvegardes actives · appareil vide.
- **Étapes** : se connecter · vérifier que les choix du compte s'appliquent sans nouvelle question · observer l'affichage dès la première page de courses · ouvrir le détail d'une course : tracé téléchargé à la demande · en Wi-Fi, vérifier le préchargement des cinq derniers tracés.
- **Attendu** : choix appliqués, affichage progressif, tracés selon le choix GPS.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### S-C · Appareil avec courses jamais liées, compte existant

- **Préconditions** : compte avec dix courses · autre appareil avec six courses locales jamais liées, dont deux doublons probables (départ à moins de 2 minutes, distance à moins de 2 %).
- **Étapes** : se connecter · activer la sauvegarde · vérifier la sauvegarde locale puis l'union par identifiant · traiter les deux doublons signalés.
- **Attendu** : union sans perte, doublons signalés, choix laissé à l'utilisateur.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### S-D · Appareil lié au compte A, connexion avec le compte B

- **Préconditions** : appareil lié au compte A et contenant ses courses · compte B existant.
- **Étapes** : sur un appareil lié à A et contenant ses courses, se déconnecter puis se connecter avec B · lire le message « Cet appareil contient les données d'un autre compte… » · choisir « Annuler » : rien ne change · recommencer et choisir « Effacer les données de cet appareil » · vérifier dans l'admin que B ne contient aucune course de A.
- **Attendu** : aucun transfert de A vers B sans choix explicite.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### S-E · Déconnexion

- **Préconditions** : compte connecté avec deux éléments non synchronisés (modifiés hors ligne).
- **Étapes** : avec deux éléments non synchronisés, se déconnecter · l'app propose « Synchroniser maintenant » ou « Se déconnecter quand même » et annonce les éléments non synchronisés · vérifier que l'option « Effacer aussi les courses de cet appareil » est décochée par défaut · se déconnecter : les courses restent conservées localement, derrière l’écran de connexion.
- **Attendu** : aucune perte, option d'effacement désactivée par défaut.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### S-F · Suppression de compte

- **Préconditions**, **Étapes** et **Attendu** : ceux de R1.04 (dans l'app) et de R1.10 (à distance). Vérification propre au §7.6 : une fois la suppression achevée, l'app efface la session et les données propres au compte, et les courses restent conservées localement selon le choix, sans accès invité.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### S-G · Hors ligne plus de 60 jours

- **Préconditions**, **Étapes** et **Attendu** : ceux de R2.06 (réconciliation complète des identifiants au retour, §7.7).

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### S-H · Suppression sur l'appareil 1

- **Préconditions** : deux appareils connectés au même compte et synchronisés.
- **Étapes** : supprimer une course sur l'appareil 1, synchroniser · ouvrir l'app sur l'appareil 2.
- **Attendu** : la course disparaît de l'appareil 2 à la récupération suivante.

| Combinaison | Réussi | Observé |
|---|:-:|---|
| iPhone → Android | [ ] | |
| Android → iPhone | [ ] | |

#### S-I · Course en cours d'enregistrement

- **Préconditions**, **Étapes** et **Attendu** : ceux de R2.05 (aucune synchronisation pendant une course, reprise à la fin).

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### S-J · Même import Santé sur deux iPhone du même compte

- **Préconditions** : iPhone 1 et iPhone 2 avec le même identifiant Apple, Santé synchronisée par iCloud, une course présente dans Santé · même compte Sprinter connecté sur les deux.
- **Étapes** : importer la course depuis Santé sur les deux iPhone · synchroniser les deux.
- **Attendu** : une seule course `healthkit:<uuid>` en ligne et sur chaque appareil.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone 1 et iPhone 2 | [ ] | |
