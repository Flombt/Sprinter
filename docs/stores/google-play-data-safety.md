# Google Play · Sécurité des données, autorisations et publication · Sprinter

> **Brouillon de travail. Ce document n'est pas un avis juridique.**
> Il prépare les réponses à saisir dans la Play Console pour la version Android qui contient les comptes (phase 5, puis phase 6). Les réponses définitives relèvent de Flo (§13.3, actions 11 et 13). Repères : **[À valider par un juriste]**, **[Décision de Flo]**, **[À vérifier]**. Champs à compléter : `<domaine>`, `<ÉDITEUR>`, `<ADRESSE>`, `<EMAIL_CONTACT_RGPD>`.

| | |
|---|---|
| Version | 0.1 (brouillon) · 14 novembre 2026 |
| Application | Sprinter · package `app.sprinter.running` · Android |
| Sources | §11, §13.2 du cahier des charges v2.1 · `app.json` du dépôt (autorisations Android) · [registre](../rgpd/registre-traitements.md) |
| Références Google | [Section Sécurité des données](https://support.google.com/googleplay/android-developer/answer/10787469?hl=fr) · [Données utilisateur](https://support.google.com/googleplay/android-developer/answer/10144311?hl=fr) · [Localisation en arrière-plan](https://support.google.com/googleplay/android-developer/answer/9799150?hl=fr) · [Services de premier plan](https://support.google.com/googleplay/android-developer/answer/13392821?hl=fr) · [Autorisations et API sensibles](https://support.google.com/googleplay/android-developer/answer/16558241?hl=fr) · [Suppression de compte](https://support.google.com/googleplay/android-developer/answer/13327111?hl=fr) · [Exigences de test des nouveaux comptes personnels](https://support.google.com/googleplay/android-developer/answer/14151465?hl=fr) · [Applications de santé](https://support.google.com/googleplay/android-developer/answer/14738291?hl=fr) · [Données collectées par le Maps SDK for Android](https://developers.google.com/maps/documentation/android-sdk/play-data-disclosure) |

## 1. Règles utiles

- **Collecte** : transmission de données hors de l'appareil, y compris par des bibliothèques, des SDK ou une WebView contrôlée par l'app. Les données pseudonymes se déclarent aussi.
- **Partage** : transfert de données collectées à un tiers. Ne constituent pas un partage, notamment : les transferts à des prestataires qui agissent pour le compte du développeur, les transferts attendus par l'utilisateur à la suite de son action, les données entièrement anonymisées.
- **Exceptions à la collecte** : traitement éphémère en mémoire, traitement uniquement sur l'appareil, chiffrement de bout en bout.
- **SDK tiers** : leurs collectes se déclarent comme celles de l'app. Pour Sprinter, cela vise surtout le **Maps SDK for Android** utilisé par `react-native-maps` (§11).
- **Facultatif ou obligatoire** : une donnée est facultative si chaque utilisateur peut choisir de la fournir ou non. Si la fonction principale en dépend, elle est obligatoire.
- Des réponses incomplètes ou inexactes peuvent bloquer les publications et les mises à jour.

## 2. Réponses générales du formulaire

| Question | Réponse proposée |
|---|---|
| L'app collecte-t-elle ou partage-t-elle des types de données concernés ? | Oui |
| Toutes les données collectées sont-elles chiffrées en transit ? | Oui (HTTPS) |
| Méthodes de création de compte | Connexion avec Google (OAuth) et adresse e-mail avec code à usage unique. Apple n'est pas proposé sur Android (§11). **[À vérifier]** libellés exacts des options de la Play Console |
| Lien de suppression du compte | `https://<domaine>/supprimer-mon-compte` |
| Possibilité de supprimer certaines données sans supprimer le compte | Oui : supprimer une course, supprimer ses parcours en ligne, vider les champs du profil, déconnecter un appareil |
| Examen de sécurité indépendant | Non (facultatif) |
| Conformité à la règle Familles | Sans objet si l'audience cible exclut les enfants (section 7) |

## 3. Types de données

| Catégorie Play | Type | Collecté | Partagé | Facultatif | Finalités | Origine | Remarques |
|---|---|---|---|---|---|---|---|
| Position | Position exacte | Oui | Non | **Facultatif** | Fonctionnalités de l'appli | App | Tracés GPS, uniquement si la personne active la sauvegarde des parcours |
| Position | Position approximative | Oui | Non | Facultatif | Fonctionnalités de l'appli · Analyses | App | Pays et ville déclarés, fuseau horaire des courses. **[À vérifier]** traitement de l'adresse IP collectée par le Maps SDK |
| Informations personnelles | Nom | Oui | Non | Facultatif | Fonctionnalités de l'appli · Gestion du compte | App | Nom affiché facultatif · nom transmis par Google Sign-In et conservé dans les métadonnées d'identité **[À vérifier]** |
| Informations personnelles | Adresse e-mail | Oui | Non | Facultatif, car le compte l'est **[À vérifier]** au regard de la définition de Google | Fonctionnalités de l'appli · Gestion du compte | App | Connexion, codes, avertissement d'inactivité |
| Informations personnelles | ID utilisateur | Oui | Non | Facultatif | Fonctionnalités de l'appli · Gestion du compte | App | Identifiant du compte, identifiant Google |
| Forme et santé | Infos sur l'activité physique | Oui | Non | Facultatif | Fonctionnalités de l'appli · Analyses | App | Courses sauvegardées : distance, durée, allure, dénivelé, séance |
| Forme et santé | Infos sur la santé | Non | — | — | — | — | Apple Santé n'existe pas sur Android, Health Connect n'est pas utilisé **[À vérifier]** |
| Activité dans les applications | Interactions avec l'application | Oui | **[À vérifier]** pour le Maps SDK | Obligatoire une fois connecté | Analyses | App · Maps SDK | `activity_days` (jours d'ouverture connectée) · interactions avec la carte (déplacement, zoom) selon la page de Google |
| Activité dans les applications | Autre contenu généré par l'utilisateur | Oui | Non | Facultatif | Fonctionnalités de l'appli | App | Demandes de support, nom d'itinéraire saisi librement |
| Infos et performances des applis | Diagnostics | Oui | **[À vérifier]** pour le Maps SDK | Obligatoire une fois connecté | Fonctionnalités de l'appli · Analyses | App · Maps SDK | Statut et codes d'erreur de synchronisation, versions · métadonnées de requête du Maps SDK |
| Infos et performances des applis | Journaux de plantage | Oui | **[À vérifier]** | Obligatoire | Fonctionnalités de l'appli | Maps SDK | Traces de plantage du code du SDK selon la page de Google. Les rapports Android vitals, collectés par Google, ne relèvent pas de l'app |
| Appareil ou autres ID | Identifiants de l'appareil ou autres | Oui | **[À vérifier]** pour le Maps SDK | Obligatoire une fois connecté | Fonctionnalités de l'appli · Analyses | App · Maps SDK | `device_id` aléatoire · identifiant pseudonyme propre au Maps SDK |
| Photos et vidéos | — | Non | — | — | — | — | À partir de la phase 8a (avatar, bannière) |
| Messages, contacts, agenda, audio, fichiers, navigation web, infos financières, applications installées, historique de recherche | — | Non | — | — | — | — | — |

**Données du Maps SDK** : selon la page de Google, le SDK collecte par défaut des métadonnées de requête (modèle et version de l'appareil, version du SDK), des traces et indicateurs de plantage, l'adresse IP et un identifiant pseudonyme, ainsi que, selon l'usage, les interactions avec la carte, pour améliorer les services de Google. **[À vérifier]** S'appuyer sur les réponses suggérées par Google pour la version du SDK embarquée, et trancher la case « partagé ». **[À valider par un juriste]** Qualification de Google pour ces données (voir [sous-traitants](../rgpd/sous-traitants.md)).

## 4. Autorisations et déclarations

### 4.1 Localisation pendant une course écran verrouillé

Deux architectures sont possibles en phase 5 (§11). **[À vérifier]** avec l'équipe technique.

| | Option A : accès en arrière-plan | Option B : service de premier plan seul |
|---|---|---|
| Principe | `expo-location` avec `isAndroidBackgroundLocationEnabled`, qui ajoute `ACCESS_BACKGROUND_LOCATION`. La documentation Expo indique qu'Android exige alors les autorisations de premier plan et d'arrière-plan | Service de premier plan de type `location`, démarré au départ de la course, avec notification persistante, sans `ACCESS_BACKGROUND_LOCATION`. La documentation Android considère cet accès comme un accès au premier plan, maintenu écran éteint |
| Déclaration d'accès en arrière-plan | **Oui** : formulaire, vidéo, communiqué visible | Non |
| Déclaration de service de premier plan | Oui | Oui |
| Mise en œuvre | Directe avec Expo | Peut demander un module natif ou une autre bibliothèque |

Références : [Autorisations de localisation (Android)](https://developer.android.com/develop/sensors-and-location/location/permissions) · [Types de services de premier plan (Android)](https://developer.android.com/develop/background-work/services/fgs/service-types) · [Localisation avec Expo](https://docs.expo.dev/versions/latest/sdk/location/)

**Si l'option A est retenue** :
- **Formulaire** : Play Console › Contenu de l'application › Autorisations sensibles. Une seule fonctionnalité basée sur la position : « Enregistrer le parcours d'une course démarrée par l'utilisateur, écran verrouillé ».
- **Critères** : fonction essentielle à l'app (une app de course qui perd la trace dès le verrouillage est inutilisable), bénéfice clair pour l'utilisateur (suivi de son activité sportive), usage attendu.
- **Communiqué visible**, affiché dans l'app **immédiatement avant** la demande système, pendant l'usage normal. Proposition, sur le modèle recommandé par Google :

  > **Localisation pendant vos courses**
  > Sprinter collecte les données de localisation pour enregistrer le parcours de la course que vous démarrez, même lorsque l'application est fermée ou inutilisée, jusqu'à la fin de la course. Ces données restent sur votre téléphone, sauf si vous activez la sauvegarde de vos parcours.
  > [Continuer] (ouvre la demande du système) · [Pas maintenant]

- **Vidéo** (30 secondes au plus, filmée sur un appareil Android) : ouverture de l'app, démarrage d'une course, communiqué visible, demande système, verrouillage de l'écran, notification persistante, déverrouillage avec la trace qui a continué, fin de la course.
- **Politique de confidentialité** : URL active en HTML, présente dans l'app et sur la fiche, qui mentionne précisément la localisation (section 5 de la [politique](../rgpd/politique-confidentialite.md)).

### 4.2 Services de premier plan (cible Android 14 et plus)

Déclarer chaque type utilisé, avec une description, l'impact d'une interruption, une vidéo et le cas d'utilisation.

| Type | Usage dans Sprinter | Impact d'une interruption | Remarque |
|---|---|---|---|
| `location` | Enregistrement d'une course démarrée par l'utilisateur, notification persistante | Trace incomplète, distance et allure fausses, course inexploitable | `FOREGROUND_SERVICE_LOCATION` à ajouter (§11) |
| `mediaPlayback` | **[À vérifier]** coaching audio ou métronome pendant la course | Annonces d'allure interrompues | `FOREGROUND_SERVICE_MEDIA_PLAYBACK` figure déjà dans `app.json`. Le retirer s'il ne sert pas |

Ne pas utiliser de service de premier plan `dataSync` pour la synchronisation : l'import initial reprenable (§7.4) peut s'appuyer sur les mécanismes d'arrière-plan du système.

### 4.3 Autres autorisations

- `POST_NOTIFICATIONS` (Android 13 et plus) : demandée au moment opportun pour la notification de course (§11).
- **Phase 8a** : utiliser le sélecteur de photos du système pour l'avatar et la bannière, afin d'éviter les autorisations d'accès aux médias, encadrées par Google Play **[À vérifier]**.
- **Identifiant publicitaire** : répondre « Non ». **[À vérifier]** dans le manifeste fusionné qu'aucune bibliothèque n'ajoute `com.google.android.gms.permission.AD_ID`. [Identifiant publicitaire (Google Play)](https://support.google.com/googleplay/android-developer/answer/6048248?hl=fr)
- **Sauvegarde automatique Android** : exclure la session, `device_id` et l'état de synchronisation, pour qu'une restauration sur un autre téléphone ne clone pas l'identité de l'appareil **[À vérifier]**. [Sauvegarde automatique](https://developer.android.com/identity/data/autobackup)

## 5. Suppression de compte

Exigences de Google Play à respecter :
- un parcours de suppression **dans l'app**, facile à trouver, même si l'app fonctionne sans compte : Réglages › Compte › Mes données › Supprimer mon compte ;
- une **page web** dont le lien figure dans le formulaire, qui :
  - affiche le nom de l'app ou du développeur tel qu'il apparaît sur la fiche ;
  - présente clairement la marche à suivre ;
  - **ne renvoie pas vers l'app et ne demande pas de la réinstaller** ;
  - indique les données supprimées, celles conservées et leur durée de conservation ;
  - permet d'obtenir une réponse dans un délai raisonnable.

### Contenu proposé pour `https://<domaine>/supprimer-mon-compte`

> # Supprimer votre compte Sprinter
>
> Sprinter est une application éditée par `<ÉDITEUR>`.
>
> **Depuis l'application** : Réglages › Compte › Mes données › Supprimer mon compte.
>
> **Sans l'application**, même si vous l'avez désinstallée : `<FORMULAIRE_OU_ADRESSE>`. Indiquez l'adresse e-mail de votre compte. Pour protéger votre compte, nous vous demanderons de confirmer la demande depuis cette adresse.
>
> **Ce qui est supprimé** : votre compte, votre profil, vos courses et vos parcours sauvegardés en ligne, la liste de vos appareils, l'historique de vos choix et vos demandes de support. Si vous vous connectiez avec Apple, nous révoquons l'autorisation donnée à Sprinter.
>
> **Ce qui est conservé** : une trace technique de l'opération (identifiant et date), pendant 12 mois, pour la sécurité du service. Nos sauvegardes techniques sont remplacées sous 7 jours.
>
> **Délai** : l'accès à votre compte est coupé dès que la demande est confirmée. La suppression est terminée sous un mois au plus, en général en quelques jours.
>
> **Vos courses enregistrées sur votre téléphone** ne sont pas concernées : elles restent sur l'appareil tant que vous ne les supprimez pas.
>
> Vous souhaitez supprimer seulement certaines données ? Dans l'application, vous pouvez supprimer une course, supprimer vos parcours en ligne ou vider les champs de votre profil.
>
> Questions : `<EMAIL_CONTACT_RGPD>` · [Politique de confidentialité](https://<domaine>/confidentialite#suppression)

**[Décision de Flo]** Forme de la demande à distance : formulaire, adresse e-mail, ou connexion directe sur la page (Apple, Google, code e-mail) permettant de supprimer sans intervention. Voir [procédure droits](../rgpd/procedure-droits.md), point PD-8.

## 6. Test fermé

- **Règle** : pour un compte développeur personnel créé après le 13 novembre 2023, Google exige avant l'accès à la production un **test fermé avec au moins 12 testeurs inscrits pendant au moins 14 jours consécutifs**. **[À vérifier]** pour le compte de Flo au moment de la création (§13.2). [Configurer un test ouvert, fermé ou interne](https://support.google.com/googleplay/android-developer/answer/9845334?hl=fr)
- **Plan proposé** :
  1. Test interne (Flo et un ou deux proches) pour vérifier la build `production` signée et les connexions Google (empreinte SHA-1 de la clé de signature Play).
  2. Recruter 15 à 20 testeurs, pour garder une marge, via une liste d'adresses ou un groupe Google.
  3. Ouvrir le test fermé, avec des consignes : rester inscrit 14 jours, utiliser l'app au moins trois fois, tester la sauvegarde et la suppression, répondre à un questionnaire court (qui sert aussi d'avis des personnes pour l'[AIPD](../rgpd/analyse-aipd.md), section 6).
  4. Suivre chaque jour le nombre de testeurs inscrits, puis demander l'accès à la production.
- **Données des testeurs** : ce sont de vraies personnes. La politique de confidentialité doit être publiée **avant** le test, et les testeurs peuvent supprimer leur compte comme tout utilisateur.
- **[Décision de Flo]** Environnement du test fermé : production avec les flags activés (recommandé, car c'est la configuration réelle), ou staging. Les flags étant globaux, vérifier l'effet sur les utilisateurs iOS déjà équipés d'une version qui contient les comptes (voir `docs/LANCEMENT.md`).

## 7. Autres déclarations de la Play Console

| Rubrique | Réponse proposée | Repère |
|---|---|---|
| Accès à l'application | Instructions comme pour App Review : app utilisable sans compte, compte de démonstration avec des courses fictives, identifiants saisis directement dans la console | [Préparer l'examen](https://support.google.com/googleplay/android-developer/answer/9859455?hl=fr) |
| Annonces | Aucune annonce | — |
| Audience cible et contenu | Tranches 16-17 ans et 18 ans et plus, aucune tranche enfant | **[Décision de Flo]** **[À valider par un juriste]** · [Audience cible](https://support.google.com/googleplay/android-developer/answer/9867159?hl=fr) |
| Classification du contenu | Questionnaire IARC, sans contenu généré par les utilisateurs au lancement | À refaire en phase 8c |
| Applications de santé | Formulaire obligatoire pour toutes les apps. Sprinter relève de « Activité et remise en forme » | [Déclaration des applications de santé](https://support.google.com/googleplay/android-developer/answer/14738291?hl=fr) |
| Politique de confidentialité | `https://<domaine>/confidentialite` | — |
| Niveau d'API cible | Respecter l'exigence en vigueur au moment de la publication | [Niveau d'API cible](https://support.google.com/googleplay/android-developer/answer/11926878?hl=fr) |
| Signature d'application Play | Clé gérée par EAS (§11). **Ajouter l'empreinte SHA-1 de la clé de signature Play** au client OAuth Android et à la restriction de la clé Google Maps, en plus de celle de la clé d'importation | [Signature d'application Play](https://support.google.com/googleplay/android-developer/answer/9842756?hl=fr) |
| Déploiement | Déploiement par étapes de la version (voir `docs/LANCEMENT.md`) | [Déploiement par étapes](https://support.google.com/googleplay/android-developer/answer/6346149?hl=fr) |
| Identité du développeur | Informations exigées selon le type de compte | [Valider vos informations d'identité](https://support.google.com/googleplay/android-developer/answer/10841920?hl=fr) |

## 8. Phases suivantes

| Phase | À mettre à jour |
|---|---|
| 7 · classement communautaire | ID utilisateur (pseudo public) · autre contenu généré (signalements) · règles de contenu généré par les utilisateurs |
| 8a · profil privé | Photos et vidéos · autre contenu généré |
| 8c · partage et modération | Contenu généré par les utilisateurs : règles, signalement, blocage, modération opérationnels avant l'ouverture. [Contenu généré par l'utilisateur](https://support.google.com/googleplay/android-developer/answer/9876937?hl=fr) |

## 9. Points ouverts

| Réf. | Point | Repère |
|---|---|---|
| GP-1 | Option A ou B pour la localisation écran verrouillé | **[À vérifier]** en phase 5 |
| GP-2 | Usage réel du service de premier plan `mediaPlayback` | **[À vérifier]** |
| GP-3 | Réponses pour les données du Maps SDK (collecte, partage) | **[À vérifier]** |
| GP-4 | Caractère facultatif de l'adresse e-mail (compte facultatif) | **[À vérifier]** |
| GP-5 | Audience cible | **[Décision de Flo]** |
| GP-6 | Environnement du test fermé et recrutement des testeurs | **[Décision de Flo]** |
| GP-7 | Forme de la demande de suppression à distance | **[Décision de Flo]** |
| GP-8 | Exclusions de la sauvegarde automatique Android | **[À vérifier]** |
