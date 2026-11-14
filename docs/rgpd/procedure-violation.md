# Procédure de gestion des violations de données personnelles · Sprinter

> **Brouillon de travail. Ce document n'est pas un avis juridique.**
> Procédure interne à faire relire par un juriste et à tester par un exercice avant le lancement. Repères : **[À valider par un juriste]**, **[Décision de Flo]**, **[À vérifier]**. Champs à compléter : `<domaine>`, `<ÉDITEUR>`, `<ADRESSE>`, `<EMAIL_CONTACT_RGPD>`.

| | |
|---|---|
| Version | 0.1 (brouillon) · 14 novembre 2026 |
| Fondement | Articles 4.12, 33 et 34 du RGPD |
| Références | [Violations de données : les règles à suivre (CNIL)](https://www.cnil.fr/fr/violations-de-donnees-personnelles-les-regles-suivre) · [Notifier une violation (téléservice CNIL)](https://www.cnil.fr/fr/services-en-ligne/notifier-une-violation-de-donnees-personnelles) · [Notifications d'incidents : à qui s'adresser (CNIL)](https://www.cnil.fr/fr/notifications-dincidents-de-securite-aux-autorites-de-regulation-comment-sorganiser-et-qui-sadresser) · [Lignes directrices 9/2022 du CEPD](https://www.edpb.europa.eu/documents/guideline/guidelines-92022-on-personal-data-breach-notification-under-gdpr_en) · [Lignes directrices 01/2021 du CEPD (exemples)](https://www.edpb.europa.eu/documents/guideline/guidelines-012021-on-examples-regarding-personal-data-breach-notification_en) |

## 1. Ce qu'est une violation

Une violation de données personnelles est un incident de sécurité qui entraîne, de façon accidentelle ou illicite, la destruction, la perte, l'altération ou la divulgation non autorisée de données personnelles, ou l'accès non autorisé à ces données.

| Type | Exemples propres à Sprinter |
|---|---|
| **Confidentialité** | Un compte peut lire les courses ou les tracés d'un autre (défaut de RLS ou de policy Storage) · bucket `run-tracks` rendu public par erreur · clé secrète Supabase publiée · compte administrateur compromis · e-mail de support envoyé au mauvais destinataire |
| **Intégrité** | Courses modifiées ou rattachées au mauvais compte (scénario D du §7.6 mal protégé) · configuration (`app_config`) altérée par un tiers |
| **Disponibilité** | Perte de données serveur sans sauvegarde utilisable · suppression massive accidentelle · indisponibilité prolongée. Le fonctionnement local-first limite fortement l'impact pour les courses présentes sur les appareils |

Un incident sans donnée personnelle (par exemple une panne de l'outil d'administration sans fuite) n'est pas une violation, mais il se consigne dans le journal d'incidents.

## 2. Rôles et contacts

| Rôle | Qui | Coordonnées |
|---|---|---|
| Responsable de la gestion de la violation | Flo | `<EMAIL_CONTACT_RGPD>` · `<TÉLÉPHONE_D_ASTREINTE>` |
| Suppléant | **[Décision de Flo]** | `<CONTACT_SUPPLÉANT>` |
| Conseil juridique | **[Décision de Flo]** | `<CONTACT_JURISTE>` |
| Sous-traitants | Supabase, Vercel, Cloudflare, `<PRESTATAIRE_SMTP>` | Contacts sécurité et support à reporter depuis leurs DPA (voir [sous-traitants](sous-traitants.md)). Ils doivent notifier Flo dans les meilleurs délais (art. 33.2) |
| Autorité de contrôle | CNIL | [Téléservice de notification](https://www.cnil.fr/fr/services-en-ligne/notifier-une-violation-de-donnees-personnelles) |

Les accès nécessaires à la gestion d'un incident (consoles Supabase, Vercel, Cloudflare, Apple Developer, Google Play et Cloud, SMTP, registrar) sont rangés dans un gestionnaire de mots de passe protégé par une double authentification, avec des codes de secours conservés hors ligne.

## 3. Déroulé

H0 désigne le moment où Flo a une certitude raisonnable qu'une violation s'est produite. C'est le point de départ du délai de 72 heures.

| Étape | Délai visé | Actions | Trace |
|---|---|---|---|
| 1. Alerter | H0 | Ouvrir une fiche dans le registre des violations (section 9). Noter l'heure du constat et la source de l'alerte | Fiche ouverte |
| 2. Contenir | H0 à H+4 | Couper ce qui doit l'être (section 5). **Préserver les preuves avant leur rotation** : exporter immédiatement les journaux Supabase (conservés 7 jours avec l'offre Pro), Vercel, Cloudflare et le journal d'administration | Actions horodatées |
| 3. Qualifier | H+24 au plus tard | Établir les faits : données touchées, nombre de personnes, durée d'exposition, exploitation avérée ou non. Évaluer le risque (section 6) | Évaluation motivée |
| 4. Notifier la CNIL | H+72 au plus tard, si la violation présente un risque | Notification initiale, même incomplète, puis complémentaire (section 7). Motiver tout retard | Numéro de notification |
| 5. Informer les personnes | Sans délai injustifié, si le risque est élevé | E-mail et message public (section 8) | Copie du message, date et nombre de destinataires |
| 6. Corriger | Selon la gravité | Correctif, migration, rotation complète, tests de non-régression (pgTAP, IDOR) | Liens vers les PR |
| 7. Tirer les leçons | J+30 | Analyse des causes, mise à jour de l'AIPD, du registre et des procédures | Section « Retour d'expérience » de la fiche |

## 4. Détection

| Source | Signal |
|---|---|
| Supabase | Alertes des Security et Performance Advisors · pics d'erreurs `42501` ou de requêtes inhabituelles · alertes d'usage |
| Journal d'administration | Consultations de fiches inhabituelles en volume ou en horaire · actions `config.write` inattendues |
| Cloudflare Access, Vercel | Connexions refusées en série · connexion depuis un pays inhabituel |
| Surveillance de disponibilité | Interruption de l'API ou du site admin |
| CI | Alerte gitleaks ou garde `check-no-secrets.cjs` sur une branche publiée |
| Utilisateurs et support | « Je vois des courses qui ne sont pas les miennes », e-mail suspect reçu au nom de Sprinter |
| Prestataires | Notification de violation, bulletin de sécurité |
| Tiers | Signalement d'un chercheur en sécurité via `<EMAIL_SÉCURITÉ>` **[Décision de Flo]** publier une adresse dédiée, par exemple dans un fichier `security.txt` |

## 5. Leviers de confinement

| Levier | Effet | Où | Attention |
|---|---|---|---|
| `sync_enabled = false` | Arrête la synchronisation des courses | Sprinter Admin › Config (`config.write` + réauthentification) | L'app lit `app_config` au lancement avec un cache de 24 heures. **[À vérifier]** Les RPC de synchronisation doivent aussi refuser les écritures quand le flag est éteint pour que la coupure soit immédiate (voir `docs/LANCEMENT.md`) |
| `routes_sync_enabled = false` | Arrête l'envoi des tracés | Idem | Idem |
| `accounts_enabled = false` | Masque les écrans de compte | Idem | Masque aussi « Supprimer mon compte » dans l'app : garder la page web de suppression opérationnelle |
| `maintenance` | Message affiché dans l'app | Idem | Message global, sans ciblage |
| Révocation des sessions | `revoke_sessions` pour un compte, rotation des clés de signature JWT pour tous **[À vérifier]** | `admin-user-action` · console Supabase | Une rotation globale déconnecte tout le monde : sans perte de données, grâce au local-first |
| Blocage des inscriptions | Plus aucun nouveau compte | Réglages Supabase Auth | — |
| Rotation des secrets | Rend inutilisable une clé exposée | Supabase (clés d'API), Apple (clé `.p8`), Google Cloud (client OAuth Web), SMTP, Vercel, GitHub | Mettre à jour les secrets des Edge Functions dans la foulée |
| Fermeture de Storage | Plus aucune lecture ni écriture de tracés | Policy temporaire de refus | Les tracés restent disponibles sur les appareils |
| Restriction de l'outil d'administration | Accès limité à Flo seul, ou fermé | Cloudflare Access | — |
| Boutiques | Pause du déploiement progressif · version corrective · `min_version` | App Store Connect, Play Console, `app_config` | `min_version` affiche l'écran de mise à jour |

## 6. Évaluer le risque

### 6.1 Critères

- **Nature des données** : les tracés GPS et l'aperçu `preview_polyline` pèsent le plus lourd (domicile, habitudes, déplacements). Viennent ensuite les adresses e-mail associées à une activité sportive, puis le profil (ville, tranche d'âge), puis les courses sans GPS.
- **Volume** : nombre de personnes et d'enregistrements.
- **Identifiabilité** : e-mail en clair ou masqué, données pseudonymes.
- **Conséquences possibles** : localisation du domicile, filature, cambriolage pendant les sorties habituelles, hameçonnage, perte d'historique.
- **Personnes vulnérables** : des mineurs de 16 et 17 ans peuvent avoir un compte.
- **Circonstances** : malveillance ou erreur, exposition publique ou limitée, données récupérées ou détruites, chiffrement avec clé intacte.

### 6.2 Niveaux et suites

| Niveau | Suite |
|---|---|
| Risque improbable | Registre des violations uniquement, avec la motivation |
| Risque | Registre et notification à la CNIL sous 72 heures |
| Risque élevé | Registre, notification à la CNIL et information des personnes concernées |

### 6.3 Scénarios préqualifiés (à confirmer au cas par cas)

| Scénario | Niveau probable | Actions particulières |
|---|---|---|
| API indisponible quelques heures, données intactes | Improbable | Registre ou journal d'incidents. Les courses restent enregistrées localement |
| Sauvegarde chiffrée perdue, clé non compromise | Improbable | Registre |
| E-mail de support envoyé au mauvais destinataire | Risque, selon le contenu | Demander la suppression au destinataire, notifier si des données d'activité ou de contact sont exposées |
| Défaut de RLS : lecture des courses d'un autre compte (sans tracé) | Risque | `sync_enabled = false`, correctif, analyse des journaux pour établir l'exploitation. Information des personnes si l'exploitation est avérée ou probable **[À valider par un juriste]** |
| Tracés GPS accessibles à un tiers (bucket public, policy erronée) | **Risque élevé** | `routes_sync_enabled = false`, fermeture de Storage, notification CNIL et information des personnes |
| Clé secrète Supabase exposée publiquement | **Risque élevé présumé** jusqu'à preuve de non-exploitation | Rotation immédiate, analyse des journaux, notification |
| Compte administrateur compromis | Risque, à réévaluer selon les fiches consultées (journal d'audit) | Révocation, Cloudflare Access fermé, rotation, audit des consultations |
| Compte SMTP compromis | Risque | Rotation, alerte aux personnes contre l'hameçonnage, vérification de l'exfiltration de la liste des destinataires |
| Perte de courses côté serveur, sans sauvegarde | Risque, souvent limité par le local-first | Informer les personnes dont l'historique n'existe plus que sur un appareil absent |
| Phase 8c : profil privé visible, contenu bloqué accessible | Risque, selon le contenu | `profile_sharing_enabled = false` |
| Violation chez un sous-traitant | Selon les données touchées | Obtenir les faits du prestataire, puis qualifier comme ci-dessus |

Le vol du téléphone d'un utilisateur ne constitue pas une violation chez Sprinter. La personne peut néanmoins demander la révocation de ses sessions au support.

## 7. Notifier la CNIL

- **Quand** : dès qu'une violation présente un risque, si possible dans les 72 heures suivant le constat. Une notification initiale incomplète peut être complétée ensuite. Au-delà de 72 heures, motiver le retard.
- **Comment** : [téléservice de la CNIL](https://www.cnil.fr/fr/services-en-ligne/notifier-une-violation-de-donnees-personnelles). Conserver le numéro de notification dans la fiche.
- **Contenu** (art. 33.3) : nature de la violation · catégories et nombre approximatif de personnes et d'enregistrements · coordonnées du point de contact · conséquences probables · mesures prises ou envisagées, y compris pour limiter les effets négatifs.
- **[À valider par un juriste]** En cas d'acte malveillant, envisager une plainte et un signalement aux autorités compétentes (voir la page CNIL « à qui s'adresser »).

## 8. Informer les personnes

- **Quand** : sans délai injustifié, si la violation présente un **risque élevé** pour leurs droits et libertés (art. 34).
- **Exceptions** (art. 34.3) : données rendues incompréhensibles (chiffrement avec clé intacte) · mesures ultérieures qui écartent le risque élevé · effort disproportionné, auquel cas une communication publique est faite.
- **Canaux** : e-mail aux comptes concernés (y compris les adresses relais Apple, le domaine d'envoi étant enregistré) · message sur `https://<domaine>` · message de maintenance dans l'app si la situation le justifie. **[Décision de Flo]** Aucun canal ciblé dans l'app n'existe aujourd'hui.
- **Contenu** : nature de la violation en termes simples, point de contact, conséquences probables, mesures prises, recommandations concrètes.

Modèle (brouillon) :

> **Objet :** Information importante sur la sécurité de votre compte Sprinter
>
> Bonjour,
> Le `<DATE>`, nous avons constaté `<DESCRIPTION SIMPLE>`. Les données concernées sont `<DONNÉES>`. `<Ce qui n'est pas concerné>`.
> Conséquences possibles : `<CONSÉQUENCES>`.
> Ce que nous avons fait : `<MESURES>`.
> Ce que nous vous conseillons : `<RECOMMANDATIONS>` (par exemple : méfiez-vous des e-mails qui se réclament de Sprinter et vous demandent un code ; Sprinter ne vous demandera jamais votre code de connexion).
> Pour toute question : `<EMAIL_CONTACT_RGPD>`. Vous pouvez aussi saisir la CNIL.
> `<ÉDITEUR>`

## 9. Registre des violations (art. 33.5)

Toute violation y figure, **qu'elle soit notifiée ou non**. À tenir dans un fichier privé, hors du dépôt, sans copie des données touchées.

| Champ | Contenu |
|---|---|
| N° | 2026-V-001 |
| Constat (date, heure, source) | |
| Description des faits | |
| Type (confidentialité, intégrité, disponibilité) | |
| Données et personnes concernées (catégories, nombres approximatifs) | |
| Conséquences probables | |
| Évaluation du risque et motivation | |
| Mesures de confinement et correctives | |
| Notification CNIL (oui ou non, date, numéro, motif d'un éventuel retard) | |
| Information des personnes (oui ou non, date, canal, motivation) | |
| Retour d'expérience et actions de suivi | |
| Clôture (date) | |

**[À valider par un juriste]** Durée de conservation du registre : la CNIL peut le demander lors d'un contrôle. Proposition : 5 ans après la clôture de chaque fiche.

## 10. Retour d'expérience

Dans les 30 jours : chronologie, cause racine, ce qui a fonctionné, ce qui a manqué, actions datées avec un responsable. Mettre à jour [l'AIPD](analyse-aipd.md), [le registre](registre-traitements.md), les tests (pgTAP, IDOR) et cette procédure.

## 11. Préparation avant le lancement

- [ ] Exercice sur table, chronométré, à partir du scénario « tracés GPS accessibles à un tiers » : couper les flags, fermer Storage, exporter les journaux, rédiger un brouillon de notification CNIL, préparer le message aux personnes.
- [ ] Vérifier que Flo sait exporter les journaux Supabase avant leur rotation de 7 jours.
- [ ] Contacts des sous-traitants reportés dans la section 2.
- [ ] Inscription aux pages d'état et aux bulletins de sécurité des sous-traitants.
- [ ] Gestionnaire de mots de passe et codes de secours prêts.
- [ ] Adresse de signalement de vulnérabilités publiée **[Décision de Flo]**.

## 12. Points ouverts

| Réf. | Point | Repère |
|---|---|---|
| PV-1 | Suppléant et conseil juridique à désigner | **[Décision de Flo]** |
| PV-2 | Coupure immédiate côté serveur par les flags (au-delà du cache de 24 heures de l'app) | **[À vérifier]** |
| PV-3 | Procédure de rotation globale des sessions (clés de signature JWT) | **[À vérifier]** |
| PV-4 | Canal d'information ciblé dans l'app | **[Décision de Flo]** |
| PV-5 | Durée de conservation du registre des violations | **[À valider par un juriste]** |
| PV-6 | Adresse de signalement de vulnérabilités | **[Décision de Flo]** |
