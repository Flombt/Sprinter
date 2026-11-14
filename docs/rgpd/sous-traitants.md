# Sous-traitants et tiers · Sprinter

> **Brouillon de travail. Ce document n'est pas un avis juridique.**
> Les informations sur les prestataires proviennent de leurs pages officielles consultées le 14 novembre 2026. Elles évoluent : **tous les liens et toutes les régions sont à revérifier** au moment de la souscription et à chaque revue. Repères : **[À valider par un juriste]**, **[Décision de Flo]**, **[À vérifier]**. Champs à compléter : `<domaine>`, `<ÉDITEUR>`, `<ADRESSE>`, `<EMAIL_CONTACT_RGPD>`.

| | |
|---|---|
| Version | 0.1 (brouillon) · 14 novembre 2026 |
| Fondement | Article 28 (sous-traitants) et chapitre V (transferts hors UE) du RGPD |
| Sources | §2 (décisions 2, 17, 19), §4, §12.3, §13.3, §16 du cahier des charges v2.1 · faits d'implémentation transmis par l'équipe technique |
| Références | [Guide du sous-traitant (CNIL, PDF)](https://www.cnil.fr/sites/cnil/files/atoms/files/rgpd-guide_sous-traitant-cnil.pdf) · [Transférer des données hors de l'UE (CNIL)](https://www.cnil.fr/fr/les-outils-de-la-conformite/transferer-des-donnees-hors-de-lue) · [Lignes directrices 07/2020 du CEPD (responsable et sous-traitant)](https://www.edpb.europa.eu/documents/guideline/guidelines-072020-on-the-concepts-of-controller-and-processor-in-the-gdpr_en) · [Recommandations 01/2020 du CEPD (mesures supplémentaires)](https://www.edpb.europa.eu/documents/recommendation/recommendations-012020-on-measures-that-supplement-transfer-tools-to_en) |

## 1. Principes

- Un **sous-traitant** traite des données personnelles pour le compte de Sprinter et sur ses instructions. Un contrat conforme à l'article 28 (DPA) est obligatoire.
- Un **responsable indépendant** (Apple, Google…) traite les données pour son propre service, selon sa propre politique. Ce n'est pas un sous-traitant de Sprinter, mais la politique de confidentialité doit l'indiquer.
- Les données de Sprinter sont hébergées dans l'Union européenne. Un transfert hors UE peut toutefois résulter d'un accès à distance par le prestataire (support, exploitation) ou de ses propres sous-traitants. Chaque transfert doit reposer sur un mécanisme valable : décision d'adéquation (dont le cadre de protection des données UE–États-Unis pour les entreprises certifiées) ou clauses contractuelles types de la Commission, complétées si nécessaire par une évaluation de l'impact du transfert.
- **[À vérifier]** Le statut juridique à jour du cadre UE–États-Unis au moment de la souscription.

## 2. Sous-traitants

### 2.1 Synthèse

| Prestataire | Rôle pour Sprinter | Traitements | Localisation des données | Accord de traitement | Transferts hors UE | Statut |
|---|---|---|---|---|---|---|
| **Supabase** | Base Postgres, Auth, Storage privé, Edge Functions, pg_cron | T1 à T10 | Région UE choisie à la création du projet. **[Décision de Flo]** Paris (`eu-west-3`) conseillée | DPA de Supabase | Possibles (société américaine, sous-traitants ultérieurs) **[À vérifier]** dans le DPA | À souscrire (offre Pro en production) |
| **Vercel** | Hébergement du site Sprinter Admin, fonctions épinglées à Paris (`cdg1`) | T1, T2, T3 et T6 en consultation, T9, T10 | Fonctions à Paris, réseau de diffusion mondial | DPA de Vercel | Possibles (société américaine, réseau mondial) **[À vérifier]** | À souscrire. L'offre Hobby est réservée à un usage non commercial (§4.4) **[Décision de Flo]** |
| **Cloudflare** | Cloudflare Access devant `admin.<domaine>` · éventuellement DNS et proxy de `<domaine>` | T9 · T8 si le site public passe par Cloudflare | Réseau mondial | DPA client de Cloudflare | Possibles **[À vérifier]** | À souscrire |
| **Prestataire SMTP** | Envoi des codes de connexion, des avertissements d'inactivité et des messages de service | T1, T8 | Selon le prestataire (2.3) | DPA du prestataire | Selon le prestataire | **[Décision de Flo]** Resend, Brevo ou Postmark |
| **Messagerie de Flo** | Réception et réponse au support et aux demandes de droits | T7, T8 | `<LOCALISATION>` | `<DPA_MESSAGERIE>` | **[À vérifier]** | **[Décision de Flo]** fournisseur à identifier |
| **Hébergeur des pages publiques** | `https://<domaine>` : politique, CGU, mentions légales, page de suppression de compte | T8 | `<LOCALISATION>` | `<DPA>` | **[À vérifier]** | **[Décision de Flo]** par exemple Vercel |
| **Sentry** | Rapports d'erreurs (app et admin) | T10 | Région UE disponible **[À vérifier]** | DPA de Sentry | **[À vérifier]** | **Non utilisé par défaut** (§16 n° 8). Fiche à activer seulement si Sentry est retenu |

### 2.2 Fiches détaillées

#### Supabase

| | |
|---|---|
| Rôle | Hébergement de toutes les données serveur : comptes (`auth.*`), tables `public` et `private`, fichiers de tracés (bucket privé `run-tracks`), Edge Functions (`delete-account`, `export-my-data`, `apple-link`, `admin-user-action`, `purge-storage`…), jobs pg_cron |
| Données | Toutes les catégories des traitements T1 à T10, dont les tracés GPS (T4) et les journaux techniques (7 jours avec l'offre Pro) |
| Région | Région UE précise à choisir à la création des projets `sprinter-staging` et `sprinter-prod` (§13.3, action 1). L'option générale « Europe » peut déployer à Londres ou à Zurich, hors Union : choisir une région nommée dans l'Union (Paris, Francfort, Irlande ou Stockholm) |
| Sauvegardes | Quotidiennes, conservées 7 jours avec l'offre Pro. Les fichiers Storage n'en font pas partie |
| Responsabilité partagée | Supabase sécurise la plateforme. Sprinter reste responsable de la configuration : RLS, policies Storage, droits des fonctions, secrets, réglages Auth |
| Liens officiels **[À vérifier]** | [DPA](https://supabase.com/legal/customer-resources/data-processing-addendum) · [Sous-traitants ultérieurs](https://supabase.com/legal/customer-resources/subprocessor-list) · [Politique de confidentialité](https://supabase.com/privacy) · [Sécurité](https://supabase.com/security) · [Régions](https://supabase.com/docs/guides/platform/regions) · [Modèle de responsabilité partagée](https://supabase.com/docs/guides/deployment/shared-responsibility-model) · [Sauvegardes](https://supabase.com/docs/guides/platform/backups) |

#### Vercel

| | |
|---|---|
| Rôle | Exécution du site Sprinter Admin (Next.js) : rendu serveur et appels RPC avec le JWT de l'administrateur. Aucune clé `service_role` |
| Données | Cookie de session de l'administrateur, adresse IP de l'administrateur, réponses des RPC en transit (e-mails masqués dans les listes, e-mail complet dans la fiche individuelle, agrégats) · journaux des fonctions, sans donnée personnelle applicative (`pino` avec redaction) · aucun cache partagé (`Cache-Control: private, no-store`) |
| Région | Fonctions épinglées à Paris (`cdg1`). Le réseau de diffusion reste mondial |
| Liens officiels **[À vérifier]** | [DPA](https://vercel.com/legal/dpa) · [Sous-traitants ultérieurs](https://vercel.com/legal/sub-processors) · [Avis de confidentialité](https://vercel.com/legal/privacy-notice) · [Région des fonctions](https://vercel.com/docs/functions/configuring-functions/region) · [Liste des régions](https://vercel.com/docs/regions) · [Journaux d'exécution](https://vercel.com/docs/logs/runtime) |

#### Cloudflare

| | |
|---|---|
| Rôle | Cloudflare Access devant `admin.<domaine>` (couche d'accès supplémentaire, §10.2). Éventuellement DNS et proxy du domaine public **[Décision de Flo]** |
| Données | Identité de l'administrateur utilisée par Access, adresses IP, informations sur l'appareil et le navigateur, journaux d'accès · visiteurs du site public si celui-ci passe par le proxy |
| Liens officiels **[À vérifier]** | [DPA client](https://www.cloudflare.com/cloudflare-customer-dpa/) · [Sous-traitants ultérieurs](https://www.cloudflare.com/gdpr/subprocessors/) · [Politique de confidentialité](https://www.cloudflare.com/privacypolicy/) · [Politiques Access](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/) |

### 2.3 Choisir le prestataire SMTP **[Décision de Flo]**

| Critère | Resend | Brevo | Postmark |
|---|---|---|---|
| Société | Établie aux États-Unis | Établie en France (Brevo France SAS), avec des activités aux États-Unis | ActiveCampaign, établie aux États-Unis |
| Localisation des traitements | Selon son DPA, traitements principaux aux États-Unis | Hébergement à confirmer dans le DPA **[À vérifier]** | Selon sa page dédiée, serveurs principaux aux États-Unis, sans projet de serveurs dans l'UE |
| Encadrement des transferts | Clauses contractuelles types et cadre UE–États-Unis selon son DPA | Brevo Inc. déclare adhérer au cadre UE–États-Unis **[À vérifier]** pour les transferts éventuels | Clauses contractuelles types selon sa page dédiée |
| Changement de sous-traitant ultérieur | Préavis de 14 jours selon son DPA | **[À vérifier]** | **[À vérifier]** |
| Liens officiels **[À vérifier]** | [DPA](https://resend.com/legal/dpa) · [Sous-traitants](https://resend.com/legal/subprocessors) · [Confidentialité](https://resend.com/legal/privacy-policy) | [Conditions](https://www.brevo.com/legal/termsofuse/) · [Confidentialité](https://www.brevo.com/legal/privacypolicy/) · [RGPD](https://www.brevo.com/company/gdpr/) | [DPA](https://postmarkapp.com/dpa) · [FAQ vie privée UE](https://postmarkapp.com/eu-privacy) |

Critères communs à vérifier quel que soit le choix :
- **désactiver le suivi des ouvertures et des clics** : les e-mails de Sprinter ne contiennent ni pixel ni lien de suivi ;
- durée de conservation des journaux d'envoi, la plus courte possible ;
- SPF, DKIM et DMARC sur le domaine d'envoi (§13.3, action 5) ;
- enregistrement du domaine d'envoi auprès du relais d'e-mails privé d'Apple (§6.2) ;
- configuration du SMTP personnalisé dans Supabase Auth (décision 19). [SMTP personnalisé (Supabase)](https://supabase.com/docs/guides/auth/auth-smtp)

À qualité égale, un hébergement dans l'Union réduit les transferts et simplifie l'information des personnes.

### 2.4 Sentry (si activé)

Non utilisé par défaut : les rapports de plantage d'App Store Connect et de la Play Console suffisent au lancement (§16 n° 8). En cas d'activation : région UE, `sendDefaultPii: false`, nettoyage dans `beforeSend`, stockage des adresses IP désactivé **[À vérifier]**, conservation de 90 jours au plus, mise à jour du registre (T10), de la politique et des déclarations des stores (données de plantage). [DPA](https://sentry.io/legal/dpa/) · [Sous-traitants](https://sentry.io/legal/subprocessors/) · [Emplacement du stockage des données](https://docs.sentry.io/organization/data-storage-location/)

### 2.5 Outils sans données des utilisateurs

| Outil | Usage | Remarque |
|---|---|---|
| Surveillance de disponibilité (UptimeRobot, Better Stack…) | Sondes sur l'API et le site admin (§12.3) | Aucune donnée d'utilisateur. Seul le compte de Flo est concerné |
| Expo Application Services (EAS) | Compilation et signature des builds | Aucune donnée d'utilisateur. **[À vérifier]** Si EAS Update est activé un jour, les appareils interrogeront les serveurs d'Expo (adresse IP, identifiants d'installation) : l'ajouter alors à ce document |
| GitHub | Dépôts de code et CI | Aucune donnée de production dans les dépôts (§0.2, règle 12) |

## 3. Responsables de traitement indépendants

| Tiers | Intervention | Données | Lien officiel |
|---|---|---|---|
| **Apple** | Se connecter avec Apple et relais d'e-mails privé · App Store et TestFlight · rapports de plantage d'App Store Connect pour les personnes qui partagent leurs diagnostics · fonds de carte Apple Plans sur iPhone · Apple Santé, traité sur l'appareil | Identifiants Apple, adresse relais, diagnostics, requêtes de cartes | [Confidentialité Apple](https://www.apple.com/fr/legal/privacy/fr-ww/) · [Se connecter avec Apple](https://support.apple.com/fr-fr/102609) |
| **Google** | Google Sign-In · Google Play · Android vitals dans la Play Console · **Maps SDK for Android** pour les cartes | Identifiants Google · selon la page de Google, le Maps SDK collecte par défaut des métadonnées de requête, des traces de plantage, l'adresse IP et un identifiant pseudonyme propre au SDK, et selon l'usage les interactions avec la carte | [Règles de confidentialité Google](https://policies.google.com/privacy?hl=fr) · [Données collectées par le Maps SDK for Android](https://developers.google.com/maps/documentation/android-sdk/play-data-disclosure) |
| **Spotify** | Connexion facultative, à l'initiative de la personne, pour contrôler sa musique · lecteur intégré de playlist | Échanges directs entre l'app et Spotify. Sprinter ne reçoit rien côté serveur | Politique de Spotify **[À vérifier]** |
| **Open-Meteo** | Météo, **builds de développement uniquement** | Position arrondie à environ 1 km | Sans objet en production |

**[À valider par un juriste]** Qualification de Google pour le Maps SDK (responsable indépendant selon ses conditions, ou autre) et conséquences pour l'information des personnes. Les données collectées par ce SDK doivent de toute façon figurer dans le formulaire Data Safety (voir [Google Play Data Safety](../stores/google-play-data-safety.md)).

## 4. Contrôle des accords (article 28)

À vérifier dans chaque DPA :

- [ ] Objet, durée, nature et finalité du traitement, types de données et catégories de personnes
- [ ] Traitement uniquement sur instruction documentée de Sprinter
- [ ] Confidentialité des personnes autorisées
- [ ] Mesures de sécurité (art. 32)
- [ ] Sous-traitants ultérieurs : autorisation, information préalable, possibilité d'objection, mêmes obligations
- [ ] Aide pour l'exercice des droits des personnes
- [ ] Aide pour la sécurité, les violations (notification sans délai), l'AIPD et la consultation préalable
- [ ] Suppression ou restitution des données en fin de contrat
- [ ] Mise à disposition des informations nécessaires et possibilité d'audit
- [ ] Mécanisme de transfert hors UE identifié (clauses types, cadre UE–États-Unis) et liste des pays

## 5. Suivi

| Prestataire | DPA accepté le | Version du DPA | Sous-traitants consultés le | Alerte de changement activée | Région vérifiée le | Prochaine revue |
|---|---|---|---|---|---|---|
| Supabase | | | | [ ] | | |
| Vercel | | | | [ ] | | |
| Cloudflare | | | | [ ] | | |
| `<PRESTATAIRE_SMTP>` | | | | [ ] | | |
| `<FOURNISSEUR_MESSAGERIE>` | | | | [ ] | | |
| `<HÉBERGEUR_SITE>` | | | | [ ] | | |

Revue au moins annuelle, et à chaque nouveau prestataire ou changement d'offre.

## 6. Points ouverts

| Réf. | Point | Repère |
|---|---|---|
| ST-1 | Région Supabase (Paris `eu-west-3` conseillée) | **[Décision de Flo]** |
| ST-2 | Prestataire SMTP | **[Décision de Flo]** |
| ST-3 | Offre Vercel (Hobby réservé au non commercial) | **[Décision de Flo]** |
| ST-4 | Hébergeur des pages publiques et usage du proxy Cloudflare | **[Décision de Flo]** |
| ST-5 | Fournisseur de la messagerie de Flo et son DPA | **[Décision de Flo]** |
| ST-6 | Mécanismes de transfert effectifs de chaque prestataire, à relever dans les DPA | **[À vérifier]** |
| ST-7 | Qualification de Google pour le Maps SDK | **[À valider par un juriste]** |
