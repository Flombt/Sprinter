# Recette des comptes, de la synchronisation et des profils · Sprinter

> **Brouillon de travail. Ce document n'est pas un avis juridique.**
> Recette manuelle guidée sur appareils réels (iPhone et Android), prévue au §12.1 et exigée pour l'acceptation de la phase 6 (§14). Un scénario par critère d'acceptation du §14 (phases 1 à 8d, avec les critères du §17.10) et un scénario par situation de synchronisation du §7.6 (A à J). Repères : **[À valider par un juriste]**, **[Décision de Flo]**, **[À vérifier]**. Champs à compléter : `<domaine>`, `<ÉDITEUR>`, `<ADRESSE>`, `<EMAIL_CONTACT_RGPD>`.

| | |
|---|---|
| Version | 0.1 (brouillon) · 14 novembre 2026 |
| Statut | **NON EXÉCUTÉ.** Chaque scénario reste non exécuté tant que son résultat n'a pas été observé et consigné |
| Sources | §6, §7, §8, §9, §10, §11, §13.5, §14, §17.10 du cahier des charges v2.1 · `ADMIN_RPC_CONTRACT.md` v1 |
| Documents liés | [Lancement](LANCEMENT.md) · [Procédure droits](rgpd/procedure-droits.md) · [Durées](rgpd/durees-conservation.md) |

## Mode d'emploi

- Chaque scénario indique le **critère** repris du cahier des charges, son **type** (appareil, navigateur, preuve automatisée), les **préconditions**, les **étapes** et le **résultat attendu**.
- Pour consigner un résultat : cocher `[x]` dans la colonne « Réussi », puis remplir « Observé » avec la date, la version testée et les remarques. En cas d'échec, laisser la case vide, écrire « Échec » et ouvrir une anomalie (section 11).
- « N/A » s'écrit dans « Observé » avec la raison (par exemple « fonction iOS uniquement »).
- Les critères qui relèvent d'un test automatisé (pgTAP, Vitest, Playwright, CI) se valident par la **preuve** : lien vers l'exécution verte et commit testé. La recette ne remplace pas ces tests.

## 0. Préparer la campagne

### 0.1 Matériel et versions

| Élément | Détail à consigner |
|---|---|
| iPhone 1 (obligatoire) | Modèle, version d'iOS, langue, fuseau |
| iPhone 2 (scénario J, facultatif) | Même identifiant Apple qu'iPhone 1, Santé synchronisée par iCloud |
| Android 14 et Android 15 (obligatoires pour la phase 5) | Modèle, version, surcouche du constructeur, réglages d'économie d'énergie |
| Ordinateur | Système, navigateur, accès Cloudflare Access à l'admin de staging |
| Builds | iOS : EAS `preview` (staging) et `production` (TestFlight) · Android : EAS `preview` (staging) et `production` (test interne Play) · numéro de version et de build pour chacun |
| Admin | Commit déployé (preview Vercel derrière Access) |
| Base | Projet `sprinter-staging`, dernière migration appliquée, seed **synthétique** |

### 0.2 Comptes et données de test

- **Comptes** : `recette.a@<domaine>`, `recette.b@<domaine>`, `recette.c@<domaine>`, `recette.d@<domaine>` (boîtes accessibles à Flo) · `<IDENTIFIANT_APPLE_DE_RECETTE>` · `<COMPTE_GOOGLE_DE_RECETTE>`. Noms affichés fictifs : « Testeur A », « Testeur B », « Testeur Homonyme ».
- **Administration (staging)** : le compte `owner` de Flo · un compte non administrateur · un compte de rôle `support` créé pour la recette uniquement.
- **Données** : courses synthétiques (fichiers GPX générés, parcours et horaires inventés) et seed synthétique. **Aucune donnée réelle d'un tiers**, aucune capture contenant une adresse autre que celles des comptes de recette.
- **Courses réelles de Flo** (phases 3 et 5) : elles produisent de vraies positions. Démarrer et terminer loin du domicile, garder les captures privées, supprimer les tracés de staging et de production en fin de campagne.

### 0.3 Outils

- Chronomètre, mode avion, possibilité de couper le Wi-Fi.
- Proxy HTTPS installé sur un appareil de test uniquement, pour observer les appels réseau (scénarios R2.05 et R3.03). Ne jamais partager de capture contenant un jeton.
- Mesure des images et du démarrage : Instruments (Xcode) sur iPhone, outils de profilage d'Android Studio sur Android.
- **[À vérifier]** **Outils de recette** à fournir par l'équipe technique, actifs uniquement dans les builds `development` et `preview` : injection de 500 courses synthétiques, simulation d'une dernière synchronisation ancienne de 61 jours, vidage du cache `app_config`, interruption contrôlée d'une suppression en staging.

## 1. Préalables de la phase 0 (preuves)

| Réf. | Critère (§14, phase 0) | Preuve attendue | Réussi | Observé |
|---|---|---|:-:|---|
| P0.1 | `supabase db reset` reproductible, pgTAP vert en CI | Exécution CI verte (job `db`) | [ ] | |
| P0.2 | `app_config` consultable sans compte, données utilisateur et notes internes protégées (§5.3) | Tests pgTAP correspondants | [ ] | |
| P0.3 | Aucune table `public` sans RLS, aucune fonction `SECURITY DEFINER` exécutable par `anon` | Test automatique, requêtes A et B de [LANCEMENT](LANCEMENT.md) | [ ] | |
| P0.4 | `npm run check`, `expo install --check`, export iOS et web verts et inchangés | CI `verify.yml` | [ ] | |
| P0.5 | Aucun changement de comportement de l'app (flags éteints) | Comparaison manuelle de l'ancienne et de la nouvelle version sur iPhone | [ ] | |
| P0.6 | `ACCOUNTS_RECON.md` relu par Flo | Date de relecture | [ ] | |

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
  7. Appareil 1 : les courses restent en mode invité. Refaire le scénario avec l'option d'effacement local : les courses disparaissent.
  8. Avec l'équipe technique : interrompre une suppression après la révocation des sessions. L'accès reste refusé et `resume-deletions` termine le nettoyage.
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

#### R1.06 · Sans compte, app identique et démarrage non ralenti

*Critère : « Sans compte : app identique ; démarrage non ralenti (mesure avant/après documentée). »* · Type : appareil

- **Préconditions** : version précédente et nouvelle version installables sur le même appareil · aucune session.
- **Étapes**
  1. Version précédente : mesurer dix démarrages à froid, noter la médiane.
  2. Nouvelle version, sans compte : mêmes mesures.
  3. Démarrer une course de 5 minutes, la terminer, la consulter, l'exporter en GPX.
- **Attendu** : parcours identiques, médiane de démarrage dans la tolérance **[Décision de Flo]** (5 % proposés), mesures consignées.

| Appareil | Réussi | Observé (médiane avant / après) |
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

*Critère : « `accounts_enabled=false` → aucun écran de compte visible. »* · Type : appareil et navigateur

- **Préconditions** : compte de recette connecté · accès à Config dans l'admin de staging (`config.write`) · outil de vidage du cache `app_config`.
- **Étapes**
  1. Admin staging › Config : `accounts_enabled = false` (réauthentification demandée, ligne d'audit créée).
  2. Vider le cache `app_config` (outil de recette ou réinstallation), relancer l'app.
  3. Parcourir Réglages, l'écran d'accueil et la fin de course (bandeau « Sauvegardez vos courses »).
  4. Remettre le flag à `true`, relancer.
- **Attendu** : aucun écran, bouton ou bandeau lié au compte quand le flag est éteint · retour normal ensuite.

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

*Critère : « Migration SQLite validée sur fixtures v1/v2/v3 + imports `healthkit:` ; les 164 tests existants verts. »* · Type : preuve et appareil

- **Préconditions** : version précédente de l'app installable (build interne) · commit de la nouvelle version.
- **Étapes**
  1. Preuve CI : fixtures `dataVersion` 1, 2 et 3 et imports `healthkit:` migrés, 164 tests existants verts.
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

#### S-A · Appareil sans compte, courses locales, premier compte

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
- **Étapes** : avec deux éléments non synchronisés, se déconnecter · l'app propose « Synchroniser maintenant » ou « Se déconnecter quand même » et annonce les éléments non synchronisés · vérifier que l'option « Effacer aussi les courses de cet appareil » est décochée par défaut · se déconnecter : les courses restent visibles en mode invité.
- **Attendu** : aucune perte, option d'effacement désactivée par défaut.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### S-F · Suppression de compte

- **Préconditions**, **Étapes** et **Attendu** : ceux de R1.04 (dans l'app) et de R1.10 (à distance). Vérification propre au §7.6 : une fois la suppression achevée, l'app efface la session et les données propres au compte, et les courses restent disponibles en mode invité, sauf choix contraire.

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

## 6. Phase 4 · Sprinter Admin

Préconditions communes : navigateur sur ordinateur, admin de staging derrière Cloudflare Access, seed synthétique de 10 000 comptes et 100 000 courses, compte `owner` de Flo avec TOTP enrôlé.

### 4a · Socle et vue d'ensemble

#### R4a.01 · Accès refusé sans droits, TOTP obligatoire, AAL1 refusé

*Critère : « Utilisateur non admin → « Accès refusé » ; admin sans TOTP → bloqué ; session AAL1 → RPC refusée (pgTAP + e2e). »* Complété par le §13.5 : impossible de se déclarer administrateur via `user_metadata` ou en forgeant `aal2`. · Type : navigateur et preuve

- **Préconditions** : un compte non administrateur et un compte administrateur sans TOTP en staging · script d'appel de RPC.
- **Étapes**
  1. Se connecter avec le compte non administrateur : message générique « Accès refusé » et déconnexion. Avec une adresse inconnue : aucun compte créé.
  2. Compte administrateur sans TOTP : enrôlement imposé, aucune donnée affichée avant.
  3. Abandonner le défi TOTP (session AAL1) : redirection vers le défi. Appel direct d'une RPC avec ce jeton : `aal2_required`.
  4. Le compte non administrateur écrit `role: owner` dans ses `user_metadata` : toujours refusé. Un JWT forgé avec `aal2` : rejeté.
  5. Joindre les preuves pgTAP et e2e.
- **Attendu** : aucun accès sans le rôle en base et l'AAL2.

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Navigateur | [ ] | |
| Preuves | [ ] | |

#### R4a.02 · Aucune clé `service_role` dans le site

*Critère : « `service_role` absent du code du site (garde CI). »* · Type : preuve

- **Préconditions** : commit du dépôt `sprinter-admin` déployé en preview.
- **Étapes**
  1. Vérifier que la garde CI est verte sur ce commit.
  2. Rechercher `service_role` et `sb_secret_` dans le code et dans les fichiers JavaScript servis par le site (outils de développement du navigateur).
  3. Vérifier que les variables d'environnement Vercel ne contiennent aucune clé secrète Supabase.
- **Attendu** : aucune occurrence. Les RPC sont appelées avec le JWT de l'administrateur.

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Preuve CI et navigateur | [ ] | |

#### R4a.03 · Périodes, comparaison et indicateurs non mesurés

*Critère : « Toutes les périodes et la comparaison fonctionnent ; « non disponible » pour tout indicateur non mesuré ; date de mise à jour affichée. »* · Type : navigateur

- **Préconditions** : `daily_metrics` calculées sur au moins 400 jours du seed.
- **Étapes** : parcourir aujourd'hui, 7 jours, 30 jours, 90 jours, année et une période personnalisée, avec et sans comparaison · vérifier « n/d » quand la période précédente vaut zéro · vérifier « non disponible » pour la conversion invité → compte · relever la date de mise à jour.
- **Attendu** : valeurs cohérentes, jamais 0 à la place d'une valeur non mesurée, date de mise à jour visible.

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Navigateur | [ ] | |

#### R4a.04 · Indicateurs conformes aux requêtes de référence

*Critère : « Chaque KPI vérifié contre une requête SQL de référence sur le seed (tests). »* · Type : preuve et contrôle

- **Préconditions** : requêtes SQL de référence versionnées avec les tests.
- **Étapes**
  1. Joindre l'exécution verte des tests des indicateurs.
  2. En staging, calculer avec les requêtes de référence trois indicateurs sur 30 jours : inscriptions, actifs mensuels, distance.
  3. Comparer avec la Vue d'ensemble sur la même période.
- **Attendu** : valeurs identiques, aux arrondis d'affichage près.

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Preuve et contrôle | [ ] | |

#### R4a.05 · Performances, accessibilité et mouvement réduit

*Critère : « Budgets §10.6 tenus ; axe sans violation critique ; `prefers-reduced-motion` respecté. »* · Type : navigateur et preuve

- **Préconditions** : rapports Lighthouse CI et axe du commit testé · réglage système « Réduire les animations » disponible.
- **Étapes** : joindre les rapports · activer la réduction des animations : aucune interpolation, transitions instantanées · naviguer au clavier seul (⌘K, `/`, tabulation dans les tableaux).
- **Attendu** : budgets tenus, aucune violation critique, mouvement réduit respecté, navigation complète au clavier.

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Navigateur | [ ] | |

#### R4a.06 · Audit en ajout seul

*Critère : « Chaque RPC sensible écrit une ligne d'audit ; la table refuse UPDATE/DELETE. »* · Type : navigateur et staging

- **Préconditions** : accès SQL d'administration à la base de staging.
- **Étapes** : ouvrir une fiche, modifier une configuration, exporter un CSV : trois lignes dans le Journal, sans e-mail ni texte de recherche · en staging, tenter une modification puis une suppression d'une ligne du journal · joindre la preuve pgTAP.
- **Attendu** : traçabilité complète, modification et suppression refusées hors purge.

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Navigateur et staging | [ ] | |

### 4b · Utilisateurs et recherche

#### R4b.01 · Recherche et temps de réponse

*Critère : « Recherche par e-mail complet, préfixe d'e-mail, nom partiel et id court : bons résultats (jeu de tests) ; p95 < 300 ms sur 10 000 comptes. »* · Type : navigateur et preuve

- **Préconditions** : jeu de recherches issu du seed (e-mails complets, préfixes, noms partiels, identifiants courts) avec les résultats attendus.
- **Étapes** : lancer chaque recherche dans la palette ⌘K et dans la page Utilisateurs · joindre la mesure du p95 sur le seed.
- **Attendu** : résultats conformes au jeu de tests, p95 sous 300 ms.

| Plateforme | Réussi | Observé (p95) |
|---|:-:|---|
| Navigateur | [ ] | |

#### R4b.02 · E-mail complet seulement dans la fiche

*Critère : « E-mail complet visible uniquement dans la fiche. »* · Type : navigateur

- **Préconditions** : un compte du seed dont l'adresse fictive est connue.
- **Étapes** : chercher ce compte dans la palette et dans la page Utilisateurs · exporter un CSV d'agrégats · consulter le Journal · ouvrir la fiche avec un motif.
- **Attendu** : adresse masquée (`f***@…`) ou absente partout, complète seulement dans la fiche.

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Navigateur | [ ] | |

#### R4b.03 · Filtres combinés

*Critère : « Filtres combinés (ex. inscrits ce mois + Android + ≥ 5 courses) : résultats identiques au SQL de référence ; nombre de résultats, puces, réinitialisation, URL partageable. »* · Type : navigateur

- **Préconditions** : requête SQL de référence pour la combinaison de l'exemple.
- **Étapes** : appliquer la combinaison · comparer avec la requête · vérifier les puces et « Réinitialiser » · ouvrir l'URL copiée dans une autre session.
- **Attendu** : mêmes comptes et même nombre que la requête, état restitué par l'URL.

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Navigateur | [ ] | |

#### R4b.04 · Aucun filtre sur l'âge exact, l'adresse ou la position

*Critère : « Aucun filtre ni colonne sur âge exact / adresse / GPS (l'API refuse le paramètre). »* · Type : navigateur et script

- **Préconditions** : script d'appel de RPC en staging avec un jeton `owner`.
- **Étapes** : inspecter les filtres et les colonnes disponibles · appeler `admin_search_users` avec un filtre `age` puis `location`.
- **Attendu** : aucun filtre ni colonne de ce type · réponse `invalid_parameter:filters.<clé>`.

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Navigateur et script | [ ] | |

#### R4b.05 · Motif obligatoire, audit, restrictions du rôle `support`

*Critère : « Fiche impossible sans motif ; audit créé ; `support` ne voit pas la tranche d'âge. »* · Type : navigateur

- **Préconditions** : compte de rôle `support` créé pour la recette en staging · compte cible avec une tranche d'âge renseignée.
- **Étapes** : tenter d'ouvrir une fiche sans motif · l'ouvrir avec un motif et vérifier la ligne `user.view` · se connecter avec le compte `support` et ouvrir la même fiche.
- **Attendu** : aucune fiche sans motif · audit avec motif · pour `support`, tranche d'âge masquée et aucune action de gestion du compte.

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Navigateur | [ ] | |

#### R4b.06 · Désactivation et réactivation

*Critère : « Désactivation → connexion impossible ; réactivation OK ; confirmation typée + ré-authentification < 5 min. »* · Type : navigateur et appareil

- **Préconditions** : compte B connecté sur un appareil de test · dernière authentification de l'administrateur ancienne de plus de 5 minutes.
- **Étapes** : désactiver B : confirmation et réauthentification demandées · sur l'appareil, tenter une synchronisation avec l'ancien jeton puis une nouvelle connexion · réactiver B · se reconnecter · consulter le Journal.
- **Attendu** : B ne peut plus rien faire tant qu'il est désactivé, se reconnecte après réactivation, deux lignes d'audit.

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Navigateur et appareil | [ ] | |

### 4c · Classements et analyses

#### R4c.01 · Éligibilité aux classements

*Critère : « Éligibilité §9.2 appliquée (tests avec courses valid/suspect/invalid et imports). »* · Type : navigateur et preuve

- **Préconditions** : seed contenant des courses valides, suspectes, invalides, importées de Santé et de GPX · requête de référence du §9.2.
- **Étapes** : afficher le classement `distance_total` du mois en mode agrégé · comparer `eligible_users` et les centiles avec la requête · joindre la preuve des tests.
- **Attendu** : seules comptent les courses `sprinter`, valides, d'au moins 1 000 m et 300 s, non supprimées.

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Navigateur et preuve | [ ] | |

#### R4c.02 · Mode nominatif encadré

*Critère : « Mode nominatif : capacité + motif + ré-authentification + audit ; top ≤ 50 ; ni e-mail ni tracé. »* · Type : navigateur

- **Préconditions** : compte `owner` (capacité `leaderboard.nominative`).
- **Étapes** : passer en mode nominatif · choisir un motif · se réauthentifier · consulter la liste et le Journal.
- **Attendu** : 50 lignes au plus, sans e-mail ni carte · ligne `leaderboard.view_nominative` avec le motif.

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Navigateur | [ ] | |

#### R4c.03 · Seuil de confidentialité des ventilations

*Critère : « Ventilations pays, ville et tranche d'âge conformes au seuil du §10.4, y compris pour « Autres » et les exports. »* · Type : navigateur

- **Préconditions** : seed préparé avec une ville de 9 comptes et un groupe « Autres » inférieur au seuil.
- **Étapes** : afficher les ventilations par pays, par ville et par tranche d'âge · exporter le CSV correspondant.
- **Attendu** : cellules de moins de 10 comptes regroupées, « Autres » masqué s'il reste sous le seuil, aucun total permettant de déduire une cellule masquée, même comportement dans l'export.

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Navigateur | [ ] | |

#### R4c.04 · Graphiques accessibles

*Critère : « Chaque graphique a sa vue tableau, ses infobulles, un clic → détail agrégé. »* · Type : navigateur

- **Préconditions** : page Analyses alimentée par le seed.
- **Étapes** : pour chaque graphique, ouvrir « Voir en tableau », survoler une valeur, cliquer sur un point.
- **Attendu** : tableau équivalent au graphique, infobulle avec la définition, détail agrégé sans donnée individuelle.

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Navigateur | [ ] | |

#### R4c.05 · Méthode de calcul visible

*Critère : « Méthode de calcul visible pour les allures et les courses incomplètes. »* · Type : navigateur

- **Préconditions** : pages Courses et Classements alimentées par le seed.
- **Étapes** : ouvrir les explications de méthode de l'allure moyenne et des courses incomplètes.
- **Attendu** : « Σ temps actif ÷ Σ distance » affiché avec la médiane, traitement des courses incomplètes expliqué.

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Navigateur | [ ] | |

### 4d · Qualité, support, configuration, exports

#### R4d.01 · Version minimale et échec ouvert

*Critère : « App en dessous de la version minimale → écran de mise à jour ; serveur injoignable → l'app fonctionne (échec ouvert). »* · Type : appareil et navigateur

- **Préconditions** : clé `min_version` modifiable dans l'admin · outil de vidage du cache `app_config`.
- **Étapes** : fixer `min_version` au-dessus de la version installée, vider le cache, relancer · rétablir la valeur · passer en mode avion avec un cache vide, relancer et enregistrer une course.
- **Attendu** : écran de mise à jour dans le premier cas · app pleinement utilisable hors ligne dans le second.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### R4d.02 · Export CSV d'agrégats

*Critère : « Export CSV : période ≤ 366 j, audité, aucune donnée personnelle. »* · Type : navigateur

- **Préconditions** : capacité `export.aggregates`.
- **Étapes** : exporter chaque type (`daily_kpis`, `runs_by_day`, `versions`, `breakdown_country`) aux formats standard et Excel FR · tenter une période de 367 jours · consulter le Journal · ouvrir les fichiers.
- **Attendu** : période trop longue refusée, une ligne `export.aggregates` par export, aucun e-mail, identifiant ou nom dans les fichiers.

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Navigateur | [ ] | |

#### R4d.03 · Jobs de rétention

*Critère : « Jobs de rétention exécutés sur staging (comptes inactifs simulés, tombstones, journal). »* · Type : staging

- **Préconditions** : données de staging vieillies par l'équipe technique : compte inactif depuis 23 puis 24 mois, tombstones de 91 jours, journal de 13 mois, `activity_days` de 26 mois, demande de support clôturée depuis 13 mois.
- **Étapes** : lancer les jobs · vérifier l'e-mail d'avertissement, les suppressions et les comptes rendus des jobs · relancer une seconde fois.
- **Attendu** : chaque donnée purgée à l'échéance et rien avant ([durées](rgpd/durees-conservation.md)), second passage sans effet.

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Staging | [ ] | |

#### R4d.04 · Demande de support de bout en bout

*Critère : « Demande de support créée dans l'app, visible dans l'admin, avec note interne et statuts. »* · Type : appareil et navigateur

- **Préconditions** : `support_enabled = true` · compte connecté.
- **Étapes** : envoyer une demande depuis l'app · la retrouver dans l'admin, ajouter une note interne, changer le statut · rouvrir la demande dans l'app.
- **Attendu** : demande visible dans l'admin avec plateforme et version · la personne voit le statut, jamais la note interne · ligne `support.update` sans le texte de la note.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

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

- **Préconditions** : installation neuve · option A ou B retenue pour la localisation écran verrouillé ([Google Play](stores/google-play-data-safety.md)) · manifeste fusionné du build.
- **Étapes** : démarrer une première course : communiqué visible avant la demande système si l'option A est retenue · n'accorder que la position approximative · vérifier la demande `POST_NOTIFICATIONS` sur Android 13 et plus · lire le manifeste fusionné.
- **Attendu** : demandes au bon moment et expliquées, message clair en position approximative, aucune autorisation inattendue (`AD_ID`, accès aux médias), types de service de premier plan déclarés.

| Appareil | Réussi | Observé |
|---|:-:|---|
| Android 14 | [ ] | |
| Android 15 | [ ] | |

## 8. Phase 6 · Lancement

#### R6.01 · Checklists du §13

*Critère : « Toutes les cases du §13 cochées. »* · Type : revue

- **Préconditions** : sections 1 à 4 de [LANCEMENT](LANCEMENT.md) remplies.
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
- **Étapes** : passer `sync_enabled` puis `accounts_enabled` à `false` · relever le délai de prise en compte (au lancement après expiration du cache, ou immédiatement si les contrôles serveur existent) · vérifier l'arrêt de la synchronisation, puis la disparition des écrans de compte · vérifier que la page web de suppression reste utilisable · réactiver.
- **Attendu** : coupure et reprise sans nouvelle version, sans perte, délai connu et consigné.

| Appareil | Réussi | Observé (délai mesuré) |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

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

## 10. Phase 8 · Personnalisation des profils (§17.10)

Images, textes et liens de test uniquement synthétiques.

### 8a · Profil privé

#### R8a.01 · Mode invité intact

*Critère : « En mode invité, l'enregistrement, la consultation et l'export local des courses passent la recette du socle. Les étapes de compte et de personnalisation restent facultatives. »*

- **Préconditions** : `profiles_enabled = true` · aucune session.
- **Étapes** : rejouer R1.06 (course, consultation, export local) · vérifier que Mon profil n'apparaît qu'avec un compte et n'est jamais imposé.
- **Attendu** : mode invité identique au socle, mesures de démarrage inchangées.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### R8a.02 · Thème en quelques gestes, avatar et bannière bien cadrés

*Critère : « Un thème intégré peut être appliqué en quelques gestes. Un avatar et une bannière personnels restent bien cadrés après fermeture et réouverture. »*

- **Préconditions** : compte connecté · images synthétiques en paysage et en portrait.
- **Étapes** : appliquer un thème intégré en comptant les gestes · importer un avatar et une bannière, recadrer, enregistrer · fermer puis rouvrir l'app.
- **Attendu** : thème appliqué en quelques gestes, cadrage conservé.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### R8a.03 · Édition hors ligne, second appareil, cloisonnement

*Critère : « Une édition hors ligne survit au redémarrage. Après enregistrement et reconnexion, la version privée apparaît sur un second appareil du titulaire. Un compte différent n'accède à aucun brouillon, fichier ou cache associé. »*

- **Préconditions** : deux appareils du titulaire · un compte tiers.
- **Étapes** : hors ligne, modifier le profil et redémarrer l'app · enregistrer et revenir en ligne · ouvrir le profil sur le second appareil · se déconnecter et se connecter avec le compte tiers sur le premier appareil.
- **Attendu** : brouillon intact après redémarrage, version privée présente sur le second appareil, aucun brouillon, fichier ou cache accessible au compte tiers.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### R8a.04 · Statut temporaire, transfert interrompu, performances

*Critère : « Un statut temporaire expire sur les deux appareils. Un transfert interrompu reprend après la course sans doublon. Le démarrage et l'enregistrement GPS tiennent les mesures de référence du socle. »*

- **Préconditions** : deux appareils · média synthétique volumineux · mesures de référence de R1.06.
- **Étapes** : poser un statut de 10 minutes et attendre son expiration sur les deux appareils · lancer l'envoi d'un média puis démarrer une course · terminer la course · mesurer le démarrage et vérifier l'enregistrement GPS.
- **Attendu** : statut disparu partout, envoi suspendu pendant la course puis repris sans doublon, mesures dans la tolérance.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

### 8b · Studio avancé

#### R8b.01 · Édition, configurations et absence de publication

*Critère : « Prévisualisation immédiate, annulation et rétablissement, reprise d'un brouillon, retour au style par défaut et changement de configuration fonctionnent sur iOS et Android. Une configuration ne rend public aucun élément. »*

- **Préconditions** : `profile_studio_enabled = true` · profil privé avec un brouillon en cours.
- **Étapes** : modifier un élément et observer l'aperçu · annuler puis rétablir · quitter et reprendre le brouillon · réinitialiser un élément puis restaurer l'apparence par défaut, en lisant la portée annoncée · créer deux configurations et basculer de l'une à l'autre · vérifier par un script ou un second compte qu'aucun élément n'est visible.
- **Attendu** : toutes les commandes fonctionnent, la restauration conserve la présentation et les choix de partage, aucune configuration ne publie quoi que ce soit.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### R8b.02 · Widgets et lecteur d'écran

*Critère : « Les widgets se redimensionnent et se réordonnent avec et sans glisser-déposer. Les statistiques Sprinter et valeurs saisies sont distinguables au lecteur d'écran et visuellement. Un widget sans données affiche l'état attendu. »*

- **Préconditions** : widgets de statistiques Sprinter et compteurs saisis · VoiceOver et TalkBack activables · un widget sans données.
- **Étapes** : redimensionner et réordonner par glisser-déposer, puis avec Monter, Descendre et Déplacer · faire lire les widgets par le lecteur d'écran · afficher le widget sans données.
- **Attendu** : réorganisation possible sans glisser-déposer, provenance annoncée (« Saisi par vous » ou statistique Sprinter avec période), état neutre ou masquage attendu.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone (VoiceOver) | [ ] | |
| Android (TalkBack) | [ ] | |

#### R8b.03 · Médias, mouvement réduit, lisibilité, mises en page

*Critère : « Les médias surdimensionnés ou incompatibles ont un retour clair. La vue fixe fonctionne partout. La réduction du mouvement, la lisibilité et les mises en page mobile et ordinateur sont vérifiées avec un profil au maximum des limites du §17.8. »*

- **Préconditions** : profil aux limites du §17.8 (images de 5 Mio, animation de 8 Mio et 8 secondes, galerie de 5 images, 8 widgets, 5 configurations) · fichiers synthétiques trop lourds et incompatibles.
- **Étapes** : importer les fichiers refusables · activer « Réduire les animations » dans Sprinter puis dans le système · contrôler les contrastes et les grandes tailles de texte · afficher les vues mobile et ordinateur.
- **Attendu** : refus expliqués et ancien visuel conservé, images fixes en mouvement réduit, contrastes conformes (4,5:1 et 3:1), mises en page lisibles.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

### 8c · Partage et modération

#### R8c.01 · Matrice des accès

*Critère : « Vérifier les accès à partir d'un compte neuf, d'un membre autorisé, d'un membre bloqué et d'une session absente. Tester les lectures directes, la recherche, les liens et les médias pour chaque mode et chaque niveau de visibilité. »*

- **Préconditions** : `profile_sharing_enabled = true` en staging · profil cible avec des éléments visibles et des éléments privés · quatre profils de test.
- **Étapes** : pour chaque case du tableau, tester la lecture directe, la recherche, le lien et l'accès aux médias.
- **Attendu** : accès seulement là où le mode et la visibilité le permettent · même réponse générique pour un profil privé, retiré, inexistant ou bloqué.

| Profil testé | Privé | Par lien | Membres | Observé |
|---|:-:|:-:|:-:|---|
| Compte neuf | [ ] | [ ] | [ ] | |
| Membre autorisé | [ ] | [ ] | [ ] | |
| Membre bloqué | [ ] | [ ] | [ ] | |
| Sans session | [ ] | [ ] | [ ] | |

#### R8c.02 · Retraits effectifs et non réversibles par synchronisation

*Critère : « Masquer un widget, rendre privé, révoquer un lien, bloquer, retirer un contenu et supprimer le compte rendent les éléments concernés inaccessibles par les canaux prévus. Une synchronisation ancienne ne peut pas rétablir une publication retirée. »*

- **Préconditions** : profil publié · second appareil du titulaire resté hors ligne avec une ancienne version · adresse de média relevée avant les retraits.
- **Étapes** : masquer un widget · rendre le profil privé · révoquer un lien puis republier · bloquer un membre · retirer un contenu par la modération · à chaque étape, tester la page, la recherche, le lien et l'adresse de média · remettre en ligne l'ancien appareil · supprimer le compte.
- **Attendu** : chaque élément devient inaccessible dès la confirmation du serveur, le lien révoqué reste invalide, l'ancienne synchronisation ne rétablit rien.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### R8c.03 · Exposition limitée, export et purge

*Critère : « Le profil partagé n'expose que les données choisies. L'export du titulaire comprend ses contenus. La suppression et la purge sont vérifiées sur le stockage et les projections de recherche. »*

- **Préconditions** : profil publié avec un mélange d'éléments visibles et privés.
- **Étapes** : inspecter la réponse reçue par un visiteur (script) · exporter les données du titulaire · supprimer le compte, puis contrôler le stockage des médias et l'index de recherche en staging.
- **Attendu** : seuls les champs publiés sont renvoyés, export complet, plus aucun média ni entrée d'index après la purge.

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Appareil et staging | [ ] | |

#### R8c.04 · Signalements et obligations avant ouverture

*Critère : « Un signalement est reçu, traité avec motif, et journalisé. Les comptes de support à droits limités n'accèdent qu'aux éléments autorisés. Les règles, le contact, le blocage et la vérification des obligations des stores sont opérationnels avant ouverture. »*

- **Préconditions** : un compte `support` avec l'habilitation de modération et un sans · contenu publié fictif à signaler.
- **Étapes** : signaler le contenu · le traiter avec motif (`admin_get_report`, `admin_moderate`) · vérifier les lignes `moderation.view` et `moderation.decide` · tenter l'accès avec le compte `support` sans habilitation · vérifier les règles d'usage, le contact, le blocage et les déclarations des stores.
- **Attendu** : traitement motivé et journalisé, accès refusé sans habilitation, obligations prêtes avant l'ouverture.

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Appareil et navigateur | [ ] | |

### 8d · Évolutions facultatives

#### R8d.01 · Bibliothèque de thèmes

*Critère : « Un thème publié et un thème appliqué depuis la bibliothèque contiennent uniquement les éléments de style autorisés. Le retrait et le signalement d'un thème suivent les règles de modération. »*

- **Préconditions** : `theme_library_enabled = true` · profil source contenant une photo, des textes, des liens et des statistiques.
- **Étapes** : publier un thème depuis ce profil · inspecter son contenu · l'appliquer depuis un autre compte · le signaler, puis le retirer.
- **Attendu** : le thème ne contient que des paramètres visuels autorisés et des références au catalogue, aucune donnée personnelle · signalement et retrait suivent la modération.

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Appareil et navigateur | [ ] | |

#### R8d.02 · Cartes et liens, puis non-régression

*Critère : « Les cartes et liens reposent sur un aperçu validé par le titulaire. En désactivant ces options, vérifier à nouveau les parcours de course et les fonctions 8a à 8c. »*

- **Préconditions** : `profile_cards_enabled = true`.
- **Étapes** : composer une carte et un lien : l'aperçu est montré et validé avant génération · désactiver les options · rejouer R1.06, R2.05 et une version courte de R8a.01 à R8c.04.
- **Attendu** : rien n'est généré sans validation, aucune régression après désactivation.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

## 11. Bilan et anomalies

### 11.1 Bilan

| Bloc | Scénarios | Exécutés | Réussis | Échecs | N/A |
|---|---|---|---|---|---|
| Préalables phase 0 | 6 | | | | |
| Phase 1 | 11 | | | | |
| Phase 2 | 10 | | | | |
| Scénarios A à J | 10 | | | | |
| Phase 3 | 6 | | | | |
| Phase 4 | 21 | | | | |
| Phase 5 | 6 | | | | |
| Phase 6 | 3 | | | | |
| Phase 7 | 7 | | | | |
| Phase 8 | 13 | | | | |

### 11.2 Anomalies

| ID | Scénario | Gravité (bloquante, majeure, mineure) | Description (sans donnée réelle) | Correctif (PR) | Statut |
|---|---|---|---|---|---|
| AN-001 | | | | | |

Une anomalie bloquante interdit la signature du bloc concerné.

## 12. Signature

### 12.1 Versions testées

| Élément | Valeur |
|---|---|
| App iOS (version, build, profil EAS) | |
| App Android (version, code de version, profil EAS) | |
| Sprinter Admin (commit) | |
| Dernière migration Supabase | |
| Projets utilisés | `sprinter-staging` · `sprinter-prod` (R6.02, R6.03) |
| Période de recette | du ____ au ____ |

### 12.2 Attestation

Je soussigné Flo, propriétaire produit de Sprinter, atteste avoir exécuté ou fait exécuter les scénarios ci-dessus sur appareils réels, avec des comptes et des données de test uniquement, et avoir consigné les résultats observés. Les réserves éventuelles figurent ci-dessous.

Réserves : ____

| Bloc | Décision | Date | Signature |
|---|---|---|---|
| Socle, phases 1 à 6 (condition d'acceptation de la phase 6) | Accepté · Accepté avec réserves · Refusé | | Flo |
| Phase 7 | Accepté · Accepté avec réserves · Refusé | | Flo |
| Phase 8a | Accepté · Accepté avec réserves · Refusé | | Flo |
| Phase 8b | Accepté · Accepté avec réserves · Refusé | | Flo |
| Phase 8c | Accepté · Accepté avec réserves · Refusé | | Flo |
| Phase 8d | Accepté · Accepté avec réserves · Refusé | | Flo |
