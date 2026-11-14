# App Store · confidentialité et soumission · Sprinter

> **Brouillon de travail. Ce document n'est pas un avis juridique.**
> Il prépare les réponses à saisir dans App Store Connect pour la version qui contient les comptes. Les réponses définitives relèvent de Flo (§13.3, action 13). Repères : **[À valider par un juriste]**, **[Décision de Flo]**, **[À vérifier]**. Champs à compléter : `<domaine>`, `<ÉDITEUR>`, `<ADRESSE>`, `<EMAIL_CONTACT_RGPD>`.

| | |
|---|---|
| Version | 0.1 (brouillon) · 14 novembre 2026 |
| Application | Sprinter · `app.sprinter.running` · iOS |
| Sources | §13.2 du cahier des charges v2.1 · `app.json` et `plugins/with-sprinter-apple.js` du dépôt · [registre](../rgpd/registre-traitements.md) |
| Références Apple | [Détails de confidentialité des apps](https://developer.apple.com/app-store/app-privacy-details/) · [Saisie dans App Store Connect](https://developer.apple.com/help/app-store-connect/reference/app-information/app-privacy) · [Fichiers de manifeste de confidentialité](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files) · [Décrire les données dans le manifeste](https://developer.apple.com/documentation/bundleresources/describing-data-use-in-privacy-manifests) · [API à motif obligatoire](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api) · [Exigences pour les SDK tiers](https://developer.apple.com/support/third-party-SDK-requirements/) · [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) · [Suppression de compte, règle 5.1.1(v)](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion) · [Révocation des jetons Apple](https://developer.apple.com/documentation/signinwithapplerestapi/revoke-tokens) · [Vie privée des utilisateurs et usage des données](https://developer.apple.com/app-store/user-privacy-and-data-use/) |

## 1. Ce qu'Apple demande de déclarer

- **Collecter** signifie transmettre des données hors de l'appareil et les conserver au-delà du temps nécessaire pour répondre à la requête en temps réel. Les données traitées uniquement sur l'appareil ne sont pas « collectées » : c'est le cas de tout Sprinter sans compte.
- Une adresse IP ou un jeton envoyés avec une requête puis non conservés n'ont pas à être déclarés.
- Apple précise que le développeur n'a pas à déclarer les données **collectées par Apple**. En revanche, toute donnée issue d'un framework Apple puis envoyée à nos serveurs (par exemple l'e-mail de Se connecter avec Apple, ou une course importée d'Apple Santé) doit être déclarée.
- Les données collectées par les SDK tiers intégrés à l'app doivent être déclarées.
- L'exemption pour les données facultatives exige des conditions cumulatives très strictes (collecte occasionnelle, hors fonction principale, formulaire affichant le nom du compte…). Elle ne s'applique pas ici : tout est déclaré.
- Les réponses se mettent à jour dans App Store Connect **sans nouvelle version de l'app**. Comme les fonctions sont activées par des flags serveur, **déclarer tout ce que la version publiée peut collecter une fois ses flags activés**, et mettre à jour les réponses **avant** d'activer un flag qui ajoute une collecte (phases 7, 8a, 8c).

## 2. Étiquettes App Privacy proposées

Version concernée : la première version qui contient les comptes, la synchronisation et les tracés (flags `accounts_enabled`, `sync_enabled`, `routes_sync_enabled`, `support_enabled`).

**Réponse générale** : « Do you or your third-party partners collect data from this app? » → **Oui**. Aucune donnée n'est utilisée pour le suivi (« tracking »). Toutes les données collectées sont **liées à l'identité** de l'utilisateur, car elles sont rattachées à son compte.

| Catégorie Apple | Type de donnée | Données Sprinter | Finalités | Liée à l'identité | Suivi |
|---|---|---|---|---|---|
| Contact Info | Name | Nom affiché facultatif · nom proposé par Apple et enregistré si l'utilisateur le valide · nom transmis par Google et conservé dans les métadonnées d'identité **[À vérifier]** | App Functionality | Oui | Non |
| Contact Info | Email Address | Adresse de connexion, y compris une adresse relais Apple | App Functionality | Oui | Non |
| Health & Fitness | Fitness | Courses sauvegardées : distance, durée, allure, dénivelé, intermédiaires, séance | App Functionality · Analytics (indicateurs agrégés de l'outil d'administration) | Oui | Non |
| Health & Fitness | Health | Courses importées d'Apple Santé (API HealthKit), sauvegardées si la sauvegarde est active **[À vérifier]** : la définition d'Apple vise les données issues de HealthKit | App Functionality uniquement, à condition de les exclure des statistiques (section 5) | Oui | Non |
| Location | Precise Location | Tracés GPS, uniquement si la personne active la sauvegarde des parcours | App Functionality | Oui | Non |
| Location | Coarse Location | Pays et ville déclarés dans le profil · fuseau horaire des courses **[À vérifier]** | App Functionality · Analytics (ventilations avec seuil k ≥ 10) | Oui | Non |
| User Content | Customer Support | Demandes envoyées depuis « Contacter le support » | App Functionality | Oui | Non |
| User Content | Other User Content | Nom d'itinéraire saisi librement, synchronisé avec la course **[À vérifier]** | App Functionality | Oui | Non |
| Identifiers | User ID | Identifiant du compte, identifiants Apple et Google | App Functionality | Oui | Non |
| Identifiers | Device ID | Identifiant d'installation aléatoire (`device_id`) | App Functionality · Analytics (qualité de service) | Oui | Non |
| Usage Data | Product Interaction | Jours d'ouverture de l'app en étant connecté, nombre de courses du jour (`activity_days`) | Analytics | Oui | Non |
| Diagnostics | Other Diagnostic Data | Statut et code d'erreur de synchronisation, versions du système et de l'app | App Functionality · Analytics | Oui | Non |

**Types non collectés** : Phone Number, Physical Address, Other Contact Info, Payment Info, Credit Info, Other Financial Info, Sensitive Info, Contacts, Emails or Text Messages, Photos or Videos, Audio Data, Gameplay Content, Browsing History, Search History, Purchases, Advertising Data, Other Usage Data, Crash Data, Performance Data, Environment Scanning, Hands, Head, Other Data Types.

- **Crash Data et Performance Data** : non déclarés tant que Sentry n'est pas utilisé. Les rapports de plantage d'App Store Connect sont collectés par Apple. Si Sentry est activé, déclarer Crash Data (App Functionality).
- **Cartes** : sur iPhone, `react-native-maps` affiche par défaut Apple Plans. **[À vérifier]** que le fournisseur Google n'est pas utilisé sur iOS. Sinon, le SDK Google Maps doit être pris en compte.

### 2.1 Évolutions à prévoir

| Phase | Ajouts probables |
|---|---|
| 7 · classement communautaire | User ID (pseudo public) · Other User Content (signalement de pseudo) |
| 8a · profil privé | Photos or Videos (avatar, bannière) · Other User Content (bio, statuts, widgets) |
| 8c · partage et modération | Customer Support ou Other User Content (signalements) · Search History, seulement si les recherches de profils sont conservées, ce qui est à éviter |

Mettre à jour les réponses **avant** l'activation du flag correspondant, puis vérifier la fiche publiée.

## 3. Manifeste de confidentialité `PrivacyInfo.xcprivacy`

### 3.1 État observé

- Le module `modules/sprinter-apple/ios/PrivacyInfo.xcprivacy` déclare `NSPrivacyTracking = false` et des listes vides. Cela convient si le module n'utilise aucune API à motif obligatoire. **[À vérifier]** en particulier l'accès éventuel à `UserDefaults` du groupe d'apps partagé avec les widgets (`group.app.sprinter.running`).
- `app.json` ne contient pas encore de clé `ios.privacyManifests`.

### 3.2 Déclaration au niveau de l'app

Le guide Expo indique de déclarer le manifeste de l'app dans `expo.ios.privacyManifests`. Il ne mentionne explicitement que `NSPrivacyAccessedAPITypes` : **[À vérifier]** que `NSPrivacyTracking` et `NSPrivacyCollectedDataTypes` y sont bien reportés dans le `PrivacyInfo.xcprivacy` généré. À défaut, les ajouter par un plugin de configuration. [Manifestes de confidentialité avec Expo](https://docs.expo.dev/guides/apple-privacy/)

Proposition, à confronter au rapport de confidentialité du build :

```json
{
  "expo": {
    "ios": {
      "privacyManifests": {
        "NSPrivacyTracking": false,
        "NSPrivacyTrackingDomains": [],
        "NSPrivacyCollectedDataTypes": [
          { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeEmailAddress", "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
          { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeName", "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
          { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeFitness", "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality", "NSPrivacyCollectedDataTypePurposeAnalytics"] },
          { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeHealth", "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
          { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypePreciseLocation", "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
          { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeCoarseLocation", "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality", "NSPrivacyCollectedDataTypePurposeAnalytics"] },
          { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeCustomerSupport", "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
          { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeOtherUserContent", "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
          { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeUserID", "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
          { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeDeviceID", "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality", "NSPrivacyCollectedDataTypePurposeAnalytics"] },
          { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeProductInteraction", "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAnalytics"] },
          { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeOtherDiagnosticData", "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality", "NSPrivacyCollectedDataTypePurposeAnalytics"] }
        ],
        "NSPrivacyAccessedAPITypes": [
          { "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryUserDefaults", "NSPrivacyAccessedAPITypeReasons": ["CA92.1"] }
        ]
      }
    }
  }
}
```

- **Identifiants de clés** : à vérifier un par un dans la documentation Apple « Describing data use in privacy manifests » **[À vérifier]**.
- **API à motif obligatoire** : la liste ci-dessus est un point de départ. Recenser les fichiers `PrivacyInfo.xcprivacy` présents dans `node_modules/*/ios`, comme le recommande Expo, puis compléter. Les candidats habituels d'une app React Native sont `UserDefaults` (`CA92.1`, et `1C8F.1` pour un groupe d'apps), les horodatages de fichiers, l'heure de démarrage du système et l'espace disque, chacun avec le motif adapté **[À vérifier]**. Apple signale les motifs manquants par e-mail après l'envoi d'un build : traiter ces messages avant la soumission.
- **SDK tiers** : la liste d'Apple des SDK soumis à manifeste et signature comprend notamment des bibliothèques de connexion Google et Hermes. **[À vérifier]** que les versions embarquées (Google Sign-In et ses dépendances, Hermes) fournissent leur manifeste et leur signature.
- **Contrôle final** : dans Xcode, archiver puis générer le rapport de confidentialité (« Generate Privacy Report ») et le comparer aux étiquettes de la section 2.

## 4. Textes des autorisations

| Clé | Texte actuel | Observation | Proposition |
|---|---|---|---|
| `NSLocationWhenInUseUsageDescription` | « Sprinter utilise votre position précise pour enregistrer vos courses et mesurer votre allure. » | Exact | **[Décision de Flo]** Ajout possible : « Vos parcours ne sont sauvegardés en ligne que si vous l'activez. » |
| `NSLocationAlwaysAndWhenInUseUsageDescription` | « Pendant une course démarrée par vous, Sprinter enregistre le trajet même écran verrouillé… » | Exact | Inchangé |
| `NSLocationAlwaysUsageDescription` | « Sprinter utilise votre position pendant les courses que vous démarrez… » | Exact | Inchangé |
| Précision complète (`locationFullAccuracyPermission`) | « La position précise permet à Sprinter de mesurer votre allure et la distance de votre course. » | Exact | Inchangé |
| `NSMotionUsageDescription` | Cadence mesurée pendant une course au premier plan | Traitement sur l'appareil | Inchangé |
| `NSHealthShareUsageDescription` | « … pour vous permettre de les consulter ou de les importer localement. » | **Inexact une fois la sauvegarde active** : les courses importées peuvent alors être envoyées au serveur | « Avec votre accord, Sprinter lit vos activités de course et leur distance pour vous permettre de les consulter et de les importer. Si vous activez la sauvegarde de vos courses, les courses importées sont aussi sauvegardées dans votre compte Sprinter. » |
| `NSHealthUpdateUsageDescription` | « … ajoute vos courses terminées et leur distance dans Apple Santé… » | Exact | Inchangé |

## 5. Points de conformité à vérifier avant la soumission

- [ ] **Se connecter avec Apple** : capacité activée sur `app.sprinter.running` (§13.3, action 3) · bouton conforme aux règles d'interface d'Apple, au moins aussi visible que Google (§6.1). [Règles d'interface « Sign in with Apple »](https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple)
- [ ] **Suppression du compte dans l'app** (règle 5.1.1(v)) : chemin Réglages › Compte › Mes données › Supprimer mon compte · révocation du jeton Apple par l'API REST · page web en complément.
- [ ] **Apple Santé** (règle 5.1.3) : aucune publicité ni exploitation commerciale des données issues de HealthKit, pas de stockage de données de santé dans iCloud, politique de confidentialité accessible. **[À vérifier]** Exclure les courses `source = 'healthkit'` des indicateurs et analyses de l'outil d'administration, pour ne pas en faire un usage statistique au-delà du service rendu. Mettre à jour `NSHealthShareUsageDescription` (section 4). [Protéger la vie privée des utilisateurs de HealthKit](https://developer.apple.com/documentation/healthkit/protecting-user-privacy)
- [ ] **Localisation en arrière-plan** : `UIBackgroundModes` contient `location` et `audio`, utilisés uniquement pendant une course démarrée par l'utilisateur (suivi verrouillé, coaching audio). Le préciser dans les notes.
- [ ] **Aucun suivi** : pas d'invite App Tracking Transparency, aucun SDK de publicité ou d'analytique. Vérifier qu'aucun SDK ajouté ne réutilise les données à des fins publicitaires.
- [ ] **Étiquettes** (section 2) et **manifeste** (section 3) cohérents avec le rapport de confidentialité du build.
- [ ] **URL de la politique de confidentialité** : `https://<domaine>/confidentialite`, aussi accessible dans l'app. Champ facultatif « Privacy Choices URL » : `https://<domaine>/supprimer-mon-compte` **[Décision de Flo]**.
- [ ] **Classification par âge** : questionnaire à jour. Aucun contenu généré par les utilisateurs au lancement ; le questionnaire change en phase 8c. **[À vérifier]** les catégories d'âge en vigueur. [Valeurs de classification par âge](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions)
- [ ] **Statut de « trader »** au sens du règlement européen sur les services numériques, déclaré dans App Store Connect. Pour un trader, l'adresse, le téléphone et l'e-mail s'affichent sur la fiche dans l'Union. **[Décision de Flo]**, lié au statut de l'éditeur. [Exigences « trader »](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements)
- [ ] **Chiffrement à l'export** : `ITSAppUsesNonExemptEncryption = false`. **[À vérifier]** que le chiffrement local de la session (clé dans le trousseau) reste dans les cas exemptés.
- [ ] **Flags** : `accounts_enabled`, `support_enabled`, `sync_enabled` et `routes_sync_enabled` activés en production pendant l'examen (voir `docs/LANCEMENT.md`, section 6, étape 1). Tant que la version n'est pas publiée, seuls les relecteurs et les testeurs disposent du code des comptes. La règle 2.3.1 proscrit les fonctions cachées ou non documentées : toute fonction activable à distance doit pouvoir être examinée et figurer dans les notes **[À vérifier]**. Activer `routes_sync_enabled` pour l'examen suppose que l'AIPD et ses mesures préalables soient terminées.
- [ ] **Publication progressive** de la version (7 jours). [Publier une mise à jour par étapes](https://developer.apple.com/help/app-store-connect/update-your-app/release-a-version-update-in-phases)

## 6. Notes pour App Review

À saisir dans App Store Connect (informations pour l'examen). Les identifiants du compte de démonstration se saisissent **directement** dans les champs prévus d'App Store Connect, jamais dans ce dépôt ni dans un chat.

### 6.1 Version française

> Sprinter est une application de course à pied qui fonctionne entièrement **sans compte** : depuis l'écran d'accueil, démarrez une course, puis consultez-la dans l'historique et exportez-la (GPX, CSV). Aucune connexion n'est nécessaire pour ces fonctions.
>
> Le **compte est facultatif**. Il permet de sauvegarder ses courses et de les retrouver sur un autre appareil : Réglages › Compte.
> – Connexion : Se connecter avec Apple (vous pouvez utiliser votre propre identifiant Apple), Google, ou un code à 6 chiffres envoyé par e-mail.
> – Compte de démonstration : adresse indiquée dans les informations de connexion. Elle contient des courses **fictives** préparées pour l'examen. `<MODE_D_ACCÈS_AU_CODE>`
> – Après la connexion, l'app propose de sauvegarder les courses, puis, dans un second choix distinct, les parcours GPS. Aucune option n'est présélectionnée.
>
> **Suppression du compte** : Réglages › Compte › Mes données › Supprimer mon compte. Une reconnexion est demandée pour confirmer. Pour un compte Apple, l'autorisation est révoquée. Suppression également possible sans l'app : `https://<domaine>/supprimer-mon-compte`.
>
> **Localisation en arrière-plan** : utilisée uniquement pendant une course démarrée par l'utilisateur, pour continuer l'enregistrement écran verrouillé. Elle s'arrête en pause manuelle et en fin de course. Le mode audio d'arrière-plan sert au coaching vocal pendant la course.
>
> **Apple Santé** est facultatif (import des courses, ajout des courses terminées).
>
> Sprinter ne contient ni publicité, ni outil d'analyse tiers, et ne pratique aucun suivi.
>
> Contact pour l'examen : `<CONTACT_REVIEW>`.

### 6.2 English version

> Sprinter is a running app that works fully **without an account**: start a run from the home screen, then review it in the history and export it (GPX, CSV). No sign-in is needed for these features.
>
> The **account is optional**. It lets users back up their runs and find them on another device: Settings › Account.
> – Sign-in: Sign in with Apple (you may use your own Apple ID), Google, or a 6-digit code sent by email.
> – Demo account: see the sign-in information. It contains **fictitious** runs prepared for review. `<CODE_ACCESS_METHOD>`
> – After sign-in, the app offers to back up runs and then, as a separate choice, GPS routes. No option is preselected.
>
> **Account deletion**: Settings › Account › My data › Delete my account. Users are asked to sign in again to confirm. For Apple accounts, the authorization is revoked. Deletion is also available without the app: `https://<domaine>/supprimer-mon-compte`.
>
> **Background location** is used only during a run started by the user, to keep recording while the screen is locked. It stops when the run is paused manually or finished. The background audio mode is used for voice coaching during a run.
>
> **Apple Health** is optional (import runs, save finished runs).
>
> Sprinter contains no ads, no third-party analytics and does no tracking.
>
> Review contact: `<REVIEW_CONTACT>`.

## 7. Compte de démonstration et données de test

- **[Décision de Flo]** Mode d'accès au code de connexion pour les relecteurs. Options : (a) recommander Se connecter avec Apple, que les relecteurs utilisent avec leur propre identifiant ; (b) fournir l'accès à une boîte e-mail dédiée à l'examen, par exemple `review@<domaine>`, dont les identifiants sont saisis dans App Store Connect. Supabase ne prévoit pas de code fixe pour l'e-mail **[À vérifier]**.
- Le compte de démonstration contient uniquement des **courses fictives**, générées à partir de fichiers GPX synthétiques (parcours inventés, horaires inventés), jamais des courses réelles de Flo ou d'un tiers.
- **[Décision de Flo]** Marquer ce compte et les comptes de recette comme comptes de test pour les exclure des indicateurs de l'outil d'administration.
- Après l'examen, vérifier que le compte n'a pas été supprimé par le relecteur (test de la suppression), le recréer au besoin avant la prochaine soumission et renouveler son accès.

## 8. Points ouverts

| Réf. | Point | Repère |
|---|---|---|
| AS-1 | Déclarer « Health » pour les courses importées d'Apple Santé | **[À vérifier]** |
| AS-2 | Déclarer « Coarse Location » (pays, ville, fuseau) et « Other User Content » (nom d'itinéraire) | **[À vérifier]** |
| AS-3 | Exclure les courses issues d'Apple Santé des statistiques (règle 5.1.3) | **[Décision de Flo]** |
| AS-4 | Nouveau texte `NSHealthShareUsageDescription` | **[Décision de Flo]** |
| AS-5 | Report effectif de `NSPrivacyCollectedDataTypes` par Expo | **[À vérifier]** |
| AS-6 | Accès au code de connexion pour App Review | **[Décision de Flo]** |
| AS-7 | Statut de « trader » | **[Décision de Flo]** |
| AS-8 | Exclusion des comptes de test des statistiques | **[Décision de Flo]** |
