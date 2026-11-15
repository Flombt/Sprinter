# Recette · comptes

> **Recette manuelle NON EXÉCUTÉE.** Ne cocher qu’après observation sur le commit et le client consignés. Les attentes de la spécification historique ont été adaptées au compte obligatoire ; elles ne constituent pas une preuve de conformité.

[Campagne et fiche de résultat](README.md) · [État actuel](../../features/etat-fonctionnalites.md)

## 2. Phase 1 · Comptes

#### R1.01 · Même compte pour une même identité

*Critère : « Sur iPhone réel : Apple, Google et e-mail → même `user_id` pour une même identité après déconnexion/reconnexion. »* · Type : appareil

- **Préconditions** : build `preview` sur staging · `accounts_enabled = true` · identités Apple, Google et e-mail de recette, sans compte existant.
- **Étapes**
  1. Se connecter avec Apple. Relever l'identifiant court du compte (Compte, ou fiche admin ouverte avec le motif « anomalie technique »).
  2. Se déconnecter, se reconnecter avec Apple : relever l'identifiant.
  3. Refaire les étapes 1 et 2 avec Google, puis avec `recette.a@<domaine>`.
  4. Dans l'admin, relever le nombre total de comptes avant et après le scénario.
- **Attendu** : chaque identité retrouve toujours le même identifiant après reconnexion. Exactement trois comptes ont été créés, aucun lors d'une reconnexion.

| Appareil | Réussi | Observé (date · build · remarques) |
|---|:-:|---|
| iPhone | [ ] | |
| Android (Google et e-mail) | [ ] | |

#### R1.02 · Code e-mail : erreurs, renvoi, expiration

*Critère : « OTP : 5 mauvais codes → blocage temporaire ; renvoi après 60 s ; code expiré refusé. »* · Type : appareil

- **Préconditions** : `recette.b@<domaine>` accessible · chronomètre.
- **Étapes**
  1. Demander un code. Vérifier le focus automatique et la proposition du code par le clavier.
  2. Saisir cinq codes faux : un blocage temporaire s'affiche, avec un message clair.
  3. Après le délai, demander un code : « Renvoyer » reste inactif pendant 60 secondes, puis devient actif.
  4. Laisser expirer un code (durée configurée, environ 10 minutes **[À vérifier]**) puis le saisir.
- **Attendu** : blocage après 5 erreurs, renvoi possible seulement après 60 secondes, code expiré refusé avec un message compréhensible, aucune perte de données locales.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### R1.03 · Liaison de méthodes, retrait, absence de fusion

*Critère : « Liaison d'une 2ᵉ méthode après ré-authentification ; retrait de la dernière méthode impossible ; aucune fusion automatique sur similarité (test : deux comptes de même `display_name` restent distincts). »* · Type : appareil et navigateur

- **Préconditions** : compte A (e-mail) connecté depuis plus de 5 minutes.
- **Étapes**
  1. Méthodes de connexion › Ajouter Google : une réauthentification est demandée. Après la liaison, se déconnecter puis se connecter avec Google : même identifiant court.
  2. Retirer Google : possible. Tenter de retirer l'e-mail, dernière méthode : impossible.
  3. Créer deux comptes avec le même nom affiché « Testeur Homonyme » et la même ville.
  4. Sur iPhone : lier Apple avec une adresse relais différente : le parcours de liaison manuelle est proposé.
- **Attendu** : liaison seulement après réauthentification récente, dernière méthode non retirable, deux comptes homonymes distincts dans l'admin, aucune proposition de fusion.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### R1.04 · Suppression du compte

*Critère : « Suppression · Données du compte et fichiers effacés, révocation Apple confirmée et audit système minimal. Un ancien JWT encore valide ne donne accès à aucune donnée privée. Un échec de nettoyage simulé reprend sans rouvrir les accès. Les courses locales sont conservées selon le choix du titulaire. »* · Type : appareil, navigateur et preuve

- **Préconditions** : compte C relié à l'identité Apple de recette, avec un profil rempli, trois courses synchronisées, un tracé (si la phase 3 est livrée) et une demande de support · un second appareil connecté au même compte · outil d'interruption contrôlée en staging.
- **Étapes**
  1. Appareil 1 : Mes données › Supprimer mon compte. Vérifier le texte d'avertissement (§6.7) et la réauthentification demandée si la dernière connexion date de plus de 5 minutes.
  2. Juste après la validation, sur l'appareil 2 encore connecté : Compte › Synchronisation › Réessayer. Aucune donnée n'est renvoyée, l'app invite à se reconnecter sans perte locale.
  3. Admin : la fiche passe à « suppression en cours », puis devient introuvable.
  4. Console staging : aucun objet sous `run-tracks/<uid>/` (compter sans ouvrir les fichiers).
  5. iPhone : Réglages › identifiant Apple › Se connecter avec Apple : Sprinter n'apparaît plus **[À vérifier]** le chemin exact.
  6. Journal : une trace système de la suppression (action, date, identifiant d'opération), sans adresse e-mail.
  7. Appareil 1 : les courses choisies restent sur l’appareil ; la connexion est requise pour y accéder. Refaire le scénario avec l'option d'effacement local : les courses disparaissent.
  8. Avec l'équipe technique : interrompre une suppression après la révocation des sessions. L'accès reste refusé et `process-deletions` termine le nettoyage.
- **Attendu** : accès coupé dès la validation, données et fichiers effacés, révocation Apple effective, trace minimale, reprise sans réouverture, courses locales selon le choix.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone (identité Apple) | [ ] | |
| Android (Google ou e-mail) | [ ] | |

#### R1.05 · Export des données

*Critère : « Export : contient toutes les données serveur de l'utilisateur et rien d'un autre. »* · Type : appareil et ordinateur

- **Préconditions** : compte A avec profil, réglages, trois courses, un tracé, deux appareils, une demande de support avec note interne · compte B avec ses propres données.
- **Étapes**
  1. Mes données › Exporter, avec réauthentification si demandée. Récupérer l'archive ZIP.
  2. Sur l'ordinateur, vérifier la présence de `profile.json`, `preferences.json`, `consents.json`, `devices.json`, de l'activité, des demandes de support, de `runs/<id>.json` pour chaque course et des tracés `.json.gz`.
  3. Comparer les nombres avec les compteurs de Mes données.
  4. Chercher dans l'archive l'adresse, l'identifiant et le nom affiché de B : aucun résultat. Chercher le texte de la note interne : aucun résultat.
- **Attendu** : archive complète pour A, rien de B, aucune note interne.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### R1.06 · Accès protégé, accueil direct et reprise hors ligne

Critère actuel : compte obligatoire, profil de compte facultatif, course locale après accès authentifié. Type : appareil.

- **Préconditions** : même appareil et builds identifiés ; backend de recette configuré ; aucune course personnelle exposée.
- **Étapes** : sans session, ouvrir l’app et vérifier la connexion obligatoire ; essayer un départ par lien. Se connecter puis vérifier l’ouverture directe de Courir sans formulaire imposé. Mesurer séparément dix démarrages à froid et le délai après authentification. Avec une session déjà stockée, passer hors ligne, relancer et effectuer une courte course, puis consulter/exporter. Se déconnecter et vérifier le retour à la connexion sans effacement implicite.
- **Attendu** : pas de départ anonyme ; accueil après connexion ; aucune dépendance réseau sur le calcul de course une fois la session restaurée ; données conservées selon le choix. Consigner les mesures sans reprendre la comparaison historique avec le mode invité.
- **Sources** : [App](../../../App.tsx), [AccountGate](../../../src/account/ui/AccountGate.tsx), [décision 002](../../decisions/002-compte-obligatoire-et-cloud-facultatif.md).

| Appareil | Réussi | Observé (date, commit, variante, réseau, médiane) |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### R1.07 · Aucun secret dans le bundle, journaux sans données personnelles

*Critère : « Aucun secret dans le bundle (garde CI) ; logs/Sentry sans PII. »* · Type : preuve et manipulation

- **Préconditions** : build candidat à la publication · accès aux journaux Supabase de staging.
- **Étapes**
  1. CI du commit de version : jobs `secrets` (gitleaks) et `check-no-secrets` verts.
  2. Chercher `service_role`, `sb_secret_` et `BEGIN PRIVATE KEY` dans le bundle exporté : aucun résultat.
  3. Provoquer une erreur de synchronisation (mode avion pendant l'envoi) et une erreur d'Edge Function, puis lire les journaux Supabase : ni e-mail, ni coordonnée.
- **Attendu** : aucun secret, aucune donnée personnelle dans les journaux.

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Preuve CI | [ ] | |
| Journaux staging | [ ] | |

#### R1.08 · Flag `accounts_enabled` éteint

Critère actuel : désactiver les options cloud dépendantes sans retirer l’exigence de connexion. Type : appareil et navigateur.

- **Préconditions** : staging identifié ; compte de recette ; modification de configuration autorisée pour cette campagne ; données sauvegardées avant manipulation.
- **Étapes** : passer `accounts_enabled` à faux ; attendre la relecture documentée du cache ou utiliser un environnement de recette isolé ; vérifier les fonctions dépendantes, les refus serveur de synchronisation et la conservation de l’outbox. Sans session, vérifier que la connexion reste présente. Avec session, vérifier l’accès aux données du compte et le parcours de suppression. Réactiver et relever la reprise.
- **Attendu** : aucun mode invité ; pas de synchronisation lorsque le socle cloud est coupé ; aucune perte locale. Les délais UI et les coupures serveur sont relevés séparément.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### R1.09 · Création de compte : âge, CGU et politique (complément §6.1, §6.5)

*Critère complémentaire : case « J'ai 16 ans ou plus » obligatoire, liens CGU et confidentialité présentés, acceptation journalisée une seule fois.* · Type : appareil

- **Préconditions** : aucune session · adresse `recette.b@<domaine>` sans compte · versions des CGU et de la politique publiées en staging.
- **Étapes**
  1. Commencer une création de compte sans cocher la case : impossible de continuer.
  2. Ouvrir les liens CGU et confidentialité : pages accessibles, versions affichées.
  3. Cocher et créer le compte. Mes données › historique des choix : une entrée `terms` et une entrée `privacy_policy`, avec leur version.
  4. Se déconnecter, se reconnecter : aucune entrée en double.
- **Attendu** : condition d'âge bloquante, acceptations journalisées une seule fois avec la bonne version.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### R1.10 · Suppression à distance par la page web (complément §6.6)

*Critère complémentaire : page `https://<domaine>/supprimer-mon-compte` utilisable après désinstallation, traitement par le support via `process_deletion`, délai d'un mois au plus.* · Type : navigateur

- **Préconditions** : compte D avec des données · app désinstallée.
- **Étapes**
  1. Ouvrir la page depuis l'ordinateur : nom de Sprinter et de l'éditeur, étapes, données supprimées et conservées, aucune obligation de réinstaller l'app.
  2. Faire la demande pour `recette.d@<domaine>`. Recevoir la demande de confirmation à l'adresse du compte, confirmer.
  3. Admin : fiche D avec le motif « demande d'accès/suppression », action `process_deletion`. Vérifier qu'une confirmation incorrecte est refusée, puis saisir `SUPPRIMER <id court>`, avec réauthentification de moins de 5 minutes.
  4. Vérifier la suppression (comme R1.04, étapes 3, 4 et 6) et l'envoi du message de confirmation.
- **Attendu** : demande possible sans l'app, identité vérifiée par l'adresse du compte, suppression complète et tracée.

| Plateforme | Réussi | Observé (délai total) |
|---|:-:|---|
| Navigateur | [ ] | |

#### R1.11 · Mes données et appareils (complément §6.5)

*Critère complémentaire : compteurs, liste des appareils avec « Déconnecter cet appareil », historique des choix.* · Type : appareil

- **Préconditions** : compte avec des courses et des tracés en ligne, connecté sur deux appareils.
- **Étapes**
  1. Avec deux appareils connectés, ouvrir Mes données : nombre de courses et de tracés, taille en ligne, liste des deux appareils.
  2. Depuis l'appareil 1, déconnecter l'appareil 2. Sur l'appareil 2, la synchronisation s'arrête et l'app demande de se reconnecter, sans perte locale.
- **Attendu** : compteurs exacts, déconnexion à distance effective.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |
