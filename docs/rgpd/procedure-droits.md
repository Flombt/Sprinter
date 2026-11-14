# Procédure de traitement des demandes d'exercice des droits · Sprinter

> **Brouillon de travail. Ce document n'est pas un avis juridique.**
> Procédure interne à faire relire par un juriste avant le lancement. Repères : **[À valider par un juriste]**, **[Décision de Flo]**, **[À vérifier]**. Champs à compléter : `<domaine>`, `<ÉDITEUR>`, `<ADRESSE>`, `<EMAIL_CONTACT_RGPD>`.

| | |
|---|---|
| Version | 0.1 (brouillon) · 14 novembre 2026 |
| Sources | §6.5, §6.6, §10.2, §10.4, §13.4 du cahier des charges v2.1 · `ADMIN_RPC_CONTRACT.md` v1 (`admin_get_user`, `admin-user-action`, `admin_list_audit`) |
| Références | [Respecter les droits des personnes (CNIL)](https://www.cnil.fr/fr/respecter-les-droits-des-personnes) · [Répondre à une demande de droit d'accès (CNIL)](https://www.cnil.fr/fr/repondre-une-demande-de-droit-dacces) · [Délai de réponse (CNIL)](https://www.cnil.fr/fr/cnil-direct/question/exercice-des-droits-informatique-et-libertes-dans-quel-delai-doit-me-repondre) · [Droit à la portabilité (CNIL)](https://www.cnil.fr/fr/respecter-les-droits-des-personnes/professionnels-comment-repondre-une-demande-de-droit-la-portabilite) · [Lignes directrices 01/2022 du CEPD sur le droit d'accès](https://www.edpb.europa.eu/documents/guideline/guidelines-012022-on-data-subject-rights-right-of-access_en) |

## 1. Objet

Cette procédure décrit comment Sprinter reçoit, vérifie et traite les demandes relatives aux droits suivants : accès, rectification, effacement, limitation, portabilité, opposition, retrait du consentement et directives post mortem. Elle s'applique quel que soit le canal utilisé.

Une demande n'a pas besoin d'une forme particulière. Un message au support, un e-mail ou un courrier qui exprime clairement la volonté d'exercer un droit doit être traité comme tel.

## 2. Rôles

| Rôle | Qui | Tâches |
|---|---|---|
| Responsable des demandes | Flo (rôle `owner`) | Reçoit, qualifie, vérifie l'identité, traite, répond, tient le registre des demandes |
| Suppléant | **[Décision de Flo]** personne de confiance ou réponse automatique en cas d'absence de plus de 10 jours | Accuse réception et prévient la personne d'un éventuel délai |
| Rôle `support` (Sprinter Admin) | Non activé au lancement | Ne voit pas la tranche d'âge et ne peut pas lancer de suppression (`users.manage` réservé à `owner`) |

## 3. Délais

| Étape | Délai | Remarque |
|---|---|---|
| Accusé de réception | 3 jours ouvrés au plus (objectif interne) | Modèle 9.1 |
| Réponse | **1 mois** au plus à compter de la réception | Art. 12.3. Exemple : demande reçue le 14 novembre, réponse au plus tard le 14 décembre |
| Prolongation | 2 mois supplémentaires au plus, si la demande est complexe ou si les demandes sont nombreuses | La personne est informée **dans le premier mois**, avec le motif (modèle 9.5) |
| Suppression de compte | Objectif interne : 72 heures après la vérification | Le plafond reste d'un mois (§6.6) |
| Gratuité | Toujours gratuit | Une demande manifestement infondée ou excessive peut donner lieu à un refus motivé ou à des frais raisonnables **[À valider par un juriste]** |

Le délai court à partir de la réception, y compris pendant la vérification d'identité. Si la vérification n'aboutit pas, on informe la personne avant l'échéance.

## 4. Canaux de réception

| Canal | Droits couverts | Vérification d'identité | Suite |
|---|---|---|---|
| **App, en autonomie** : Réglages › Compte › Mes données, profil, Synchronisation | Accès et portabilité (Exporter), rectification (profil), effacement (course, parcours en ligne, compte), retrait des choix (sauvegardes) | Session authentifiée. Réauthentification de moins de 5 minutes pour l'export et la suppression (§6.6) | Immédiat. Aucune intervention de Flo |
| **App** : Contacter le support, catégorie `data_request` | Tous | Session authentifiée : la demande est rattachée au compte | Section 6 |
| **Web** : `https://<domaine>/supprimer-mon-compte` | Effacement | Section 5 | Section 6.3 |
| **E-mail** : `<EMAIL_CONTACT_RGPD>` | Tous | Section 5 | Section 6 |
| **Courrier** : `<ADRESSE>` | Tous | Section 5 | Section 6 |

La page web de suppression ne doit **pas** demander de réinstaller l'application : Google Play l'interdit expressément. [Exigences de suppression de compte (Google Play)](https://support.google.com/googleplay/android-developer/answer/13327111?hl=fr)

## 5. Vérification de l'identité

### 5.1 Principes

- **Proportionnalité** : ne pas demander de pièce d'identité par défaut. Le compte Sprinter n'est pas rattaché à une identité civile : la preuve pertinente est le contrôle de l'une des méthodes de connexion du compte.
- **Pas de divulgation** : ne jamais confirmer l'existence d'un compte à une personne non vérifiée. Utiliser la réponse générique du modèle 9.2.
- **Bonne adresse** : toujours répondre à l'adresse e-mail du compte, jamais à une autre adresse fournie dans la demande.
- **Doute raisonnable** : des informations complémentaires ne sont demandées qu'en cas de doute sérieux (art. 12.6).
- Si l'identité ne peut pas être établie, l'indiquer à la personne en expliquant pourquoi (art. 12.2).

### 5.2 Méthodes selon la situation

| Situation | Méthode |
|---|---|
| Demande depuis l'app | La session suffit. Export et suppression : réauthentification de moins de 5 minutes |
| E-mail envoyé depuis l'adresse du compte | Répondre **à l'adresse du compte** en demandant une confirmation par retour. Recevoir la réponse prouve le contrôle de la boîte |
| E-mail envoyé depuis une autre adresse | Demander une confirmation depuis l'adresse du compte, ou une connexion à l'app, ou à la page web si elle permet de se connecter **[Décision de Flo]** |
| Compte Apple avec adresse relais | La réponse envoyée à l'adresse relais parvient à la personne, à condition que le domaine d'envoi soit enregistré auprès d'Apple (§6.2). [Relais d'e-mails privé (Apple)](https://developer.apple.com/help/account/capabilities/configure-private-email-relay-service/) |
| Personne qui n'a plus accès à sa méthode de connexion | Demander de se connecter avec une autre méthode liée. À défaut, l'identifiant court du compte (8 caractères, visible dans l'app) et des éléments que seul le titulaire connaît peuvent aider. En cas de doute, refuser de façon motivée plutôt que risquer de divulguer ou de supprimer les données d'autrui |
| Mandataire (avocat, proche) | Mandat signé et justificatif d'identité du mandant |
| Héritiers | Section 6.8 |

## 6. Parcours par droit

### 6.1 Accès (art. 15)

**En autonomie** : Mes données › Exporter. L'archive ZIP contient `profile.json`, `preferences.json`, `consents.json`, `devices.json`, l'activité, les demandes de support destinées à la personne, `runs/<id>.json` et les tracés `.json.gz` conservés en ligne (§6.6). Chaque course reste exportable en GPX ou CSV.

**Par le support** :
1. Vérifier l'identité (section 5) et noter la demande dans le registre (section 8).
2. Si la personne peut utiliser l'app, lui indiquer le chemin d'export.
3. Sinon, **[Décision de Flo]** choisir l'une de ces solutions :
   - **(a) recommandée** : permettre l'export depuis la page web, après connexion, avec la même fonction `export-my-data` ;
   - **(b)** inviter la personne à installer l'app et à se connecter, solution acceptable pour l'accès mais jamais exigée pour une suppression ;
   - **(c)** procédure exceptionnelle de Flo : appel de `export-my-data` pour le compte concerné par une fonction dédiée, réservée à `owner`, motivée et journalisée. Elle n'existe pas aujourd'hui, car le site admin n'exporte aucune donnée personnelle (§10.2).
4. Ajouter les données détenues hors de la base : échanges de support dans la messagerie de Flo et, **[À valider par un juriste]** sur demande, la liste des consultations de la fiche (dates et motifs) tirée du journal d'administration (`admin_list_audit`, filtre `target_user_id`).
5. Joindre les informations exigées par l'article 15 (modèle 9.3) : finalités, catégories de données, destinataires, durées, droits, source des données (Apple, Google, Apple Santé), absence de décision automatisée produisant des effets significatifs, garanties des transferts hors UE.

### 6.2 Rectification (art. 16)

| Donnée | Parcours |
|---|---|
| Nom affiché, pays, ville, tranche d'âge | En autonomie dans le profil |
| Courses | Modification ou suppression dans l'app, puis synchronisation |
| Adresse e-mail | Compte Apple ou Google : à modifier chez le fournisseur. Compte e-mail : **[À vérifier]** le changement d'adresse n'est pas prévu par le cahier des charges. Contournement : lier la nouvelle adresse comme méthode de connexion, puis retirer l'ancienne |
| Validité d'une course | Information calculée par le serveur, non modifiable par la personne (§9.1). En cas de contestation, Flo examine la règle appliquée. **[Décision de Flo]** si une règle se trompe, publier une nouvelle `rules_version` et relancer le recalcul. Aucune correction manuelle n'est prévue |

### 6.3 Effacement (art. 17)

**Suppression du compte**

| Étape | App | À distance (page web, e-mail, courrier) |
|---|---|---|
| Demande | Mes données › Supprimer mon compte | Formulaire ou adresse indiqués sur `https://<domaine>/supprimer-mon-compte` |
| Vérification | Réauthentification de moins de 5 minutes | Section 5 |
| Exécution | Edge Function `delete-account` | Sprinter Admin › fiche (motif `data_request`) › action `process_deletion` via `admin-user-action`, confirmation typée `SUPPRIMER <id court>` et réauthentification de moins de 5 minutes |
| Effets | Accès coupés et sessions révoquées dès la validation · révocation Apple · purge Storage · `auth.admin.deleteUser` · trace dans l'audit système (§6.6) | Identiques |
| Contrôle | L'app affiche l'état jusqu'à la confirmation | Vérifier que la fiche n'existe plus et que le statut est terminé. En cas de blocage, `resume-deletions` reprend le nettoyage |
| Confirmation | Écran de confirmation | Modèle 9.4, envoyé à l'adresse du compte **avant** la suppression effective ou à l'adresse de la demande vérifiée |

**Effacements partiels, sans fermeture du compte** : supprimer une course (tombstone, contenu vidé immédiatement) · supprimer les parcours en ligne · vider un champ du profil · déconnecter un appareil · supprimer une demande de support **[Décision de Flo]** aucune RPC ne le permet : prévoir une action `owner` journalisée ou un traitement manuel consigné.

**Ce qui est conservé après suppression**, à indiquer à la personne : la trace système de l'opération (identifiant technique et date, 12 mois) et les sauvegardes de la base pendant leur rotation (7 jours avec l'offre Pro).

**Titulaire de moins de 16 ans** : si l'on apprend qu'un titulaire n'avait pas l'âge requis, supprimer le compte après avoir prévenu la personne (et, si elle est connue, la personne qui exerce l'autorité parentale) **[À valider par un juriste]**.

### 6.4 Limitation (art. 18)

Cas typiques : la personne conteste l'exactitude d'une donnée, ou s'oppose à un traitement et attend la réponse.

- Solution d'abord proposée : suspendre la sauvegarde (en autonomie) ou ne plus traiter la donnée contestée.
- Si nécessaire : `disable` via `admin-user-action` (motif `data_request`, audité). Cela bloque aussi l'accès de la personne : l'en informer.
- **[À valider par un juriste]** Vérifier que la désactivation du compte constitue une mesure de limitation adaptée.

### 6.5 Portabilité (art. 20)

- Données concernées : celles fournies par la personne et traitées sur la base du contrat ou du consentement (courses, tracés, profil, réglages, choix).
- Format : archive ZIP de fichiers JSON (structurés et lisibles par machine), tracés compressés, et exports GPX ou CSV par course.
- Transmission directe à un autre responsable : non proposée techniquement. L'expliquer à la personne.

### 6.6 Opposition (art. 21)

| Traitement | Base | Réponse |
|---|---|---|
| Mesure d'usage (`activity_days`, T6) | Intérêt légitime | Faire droit à l'opposition. **[Décision de Flo]** créer un réglage « Ne pas mesurer mon activité », qui suspend `touch_activity`. En attendant, appliquer manuellement un marqueur d'exclusion **[À vérifier]** à prévoir dans le schéma |
| Journal d'administration, journaux techniques (T9, T10) | Intérêt légitime, sécurité | En principe, motifs légitimes impérieux : refus motivé, avec mention du droit de réclamation (modèle 9.6) **[À valider par un juriste]** |
| Prospection | — | Sans objet : Sprinter n'envoie aucune prospection |

### 6.7 Retrait du consentement

- Profil : vider le champ. Effet immédiat.
- Classement communautaire (phase 7) : retrait immédiat du classement.
- Choix de sauvegarde : désactivation dans Compte › Synchronisation. L'envoi s'arrête aussitôt sur l'appareil, et sur les autres dès la confirmation du serveur (§6.5). Pour les tracés, proposer « Supprimer aussi mes parcours en ligne » (§8).
- Le retrait ne remet pas en cause la licéité du traitement antérieur.

### 6.8 Directives post mortem (art. 85 de la loi Informatique et Libertés)

- Un proche qui signale un décès fournit un acte de décès et un justificatif de sa qualité d'héritier ou de la mission qui lui a été confiée.
- Flo applique les directives particulières éventuellement laissées par la personne. À défaut, les héritiers peuvent demander la clôture du compte : suppression selon la section 6.3.
- **[À valider par un juriste]** Étendue des droits des héritiers. [Mort numérique (CNIL)](https://www.cnil.fr/fr/mort-numerique-ou-eternite-virtuelle-que-deviennent-vos-donnees-apres-la-mort-0)

### 6.9 Recours

Toute réponse négative, totale ou partielle, mentionne la possibilité de saisir la CNIL et de former un recours juridictionnel (art. 12.4). [Adresser une plainte à la CNIL](https://www.cnil.fr/fr/adresser-une-plainte)

## 7. Points de vigilance techniques

- La suppression d'un compte coupe les accès **dès la validation**, même si le nettoyage prend du temps. Un ancien JWT encore valide ne donne plus accès aux données (§5.3, recette R1.4).
- Une demande reçue pendant qu'un appareil n'est pas synchronisé : les données locales de la personne restent sur cet appareil. Le lui rappeler.
- Le site admin ne permet ni de lire un tracé, ni d'exporter des données personnelles. Ne jamais contourner cette règle avec la console Supabase pour répondre à une demande, sauf procédure exceptionnelle décidée par Flo, consignée et limitée au strict nécessaire.

## 8. Registre des demandes (modèle)

À tenir dans un fichier privé, hors du dépôt, sans contenu superflu. Conservation : 12 mois après la réponse **[À valider par un juriste]**.

| N° | Reçue le | Canal | Droit | Vérification (méthode, date) | Échéance | Prolongation (motif, date d'information) | Réponse le | Issue | Remarques |
|---|---|---|---|---|---|---|---|---|---|
| 2026-001 | 14/11/2026 | E-mail | Effacement | Confirmation depuis l'adresse du compte, 15/11/2026 | 14/12/2026 | — | 16/11/2026 | Compte supprimé | Exemple fictif |

## 9. Modèles de réponse (brouillons)

### 9.1 Accusé de réception

> Bonjour,
> Nous avons bien reçu votre demande du `<DATE>` concernant vos données personnelles dans Sprinter. Nous y répondrons au plus tard le `<ÉCHÉANCE>`.
> `<ÉDITEUR>` · Sprinter

### 9.2 Vérification (réponse générique, sans confirmer l'existence d'un compte)

> Bonjour,
> Pour protéger les comptes Sprinter, nous ne traitons une demande qu'après avoir vérifié qu'elle vient du titulaire. Si un compte est associé à l'adresse indiquée, nous venons d'y envoyer un message : il suffit d'y répondre pour confirmer votre demande. Vous pouvez aussi la faire directement dans l'app, dans Réglages › Compte › Mes données.

### 9.3 Réponse à une demande d'accès

> Bonjour,
> Vous trouverez ci-joint une copie des données personnelles que nous détenons sur vous. Pour rappel :
> – finalités et bases légales, catégories de données, destinataires, durées de conservation : voir la politique de confidentialité, jointe en version `<VERSION>` ;
> – source : vous-même, et `<Apple / Google / Apple Santé>` pour `<DONNÉES>` ;
> – vos données sont hébergées dans l'Union européenne. Les transferts éventuels hors de l'Union sont encadrés par `<GARANTIES>` ;
> – aucune décision produisant des effets juridiques ou vous affectant de manière significative n'est prise de façon automatisée ;
> – vous pouvez demander la rectification, l'effacement ou la limitation de vos données, ou vous opposer à certains traitements, en répondant à ce message. Vous pouvez aussi saisir la CNIL.

### 9.4 Confirmation de suppression

> Bonjour,
> Votre demande de suppression du compte Sprinter a été validée le `<DATE>`. L'accès au compte est désormais impossible. Vos données en ligne sont effacées : compte, profil, courses, parcours, appareils, historique de vos choix et demandes de support. Nous conservons pendant 12 mois une trace technique de l'opération (identifiant et date), et nos sauvegardes techniques sont remplacées sous 7 jours. Les courses présentes sur votre téléphone n'ont pas été touchées.

### 9.5 Prolongation du délai

> Bonjour,
> Votre demande du `<DATE>` nécessite un examen complémentaire en raison de `<MOTIF>`. Conformément à l'article 12.3 du RGPD, notre délai de réponse est prolongé jusqu'au `<NOUVELLE_ÉCHÉANCE>`.

### 9.6 Refus motivé

> Bonjour,
> Nous ne pouvons pas donner suite à votre demande du `<DATE>`, pour la raison suivante : `<MOTIF>`. Vous pouvez adresser une réclamation à la CNIL (www.cnil.fr) et former un recours devant les juridictions compétentes.

## 10. Recette et contrôles

- Avant le lancement : traiter une demande fictive de bout en bout pour chaque canal (app, page web, e-mail) avec un compte de test, en moins d'une journée. Scénarios R1.4, R1.5 et R1.10 de `docs/RECETTE_COMPTES.md`.
- Chaque trimestre : revoir le registre des demandes et les délais tenus.

## 11. Points ouverts

| Réf. | Point | Repère |
|---|---|---|
| PD-1 | Export à distance sans l'app : solution (a), (b) ou (c) | **[Décision de Flo]** |
| PD-2 | Réglage d'opposition à la mesure d'usage | **[Décision de Flo]** |
| PD-3 | Suppression d'une demande de support à la demande de la personne | **[Décision de Flo]** |
| PD-4 | Changement d'adresse e-mail d'un compte e-mail | **[À vérifier]** |
| PD-5 | Communication des consultations de la fiche issues du journal d'administration | **[À valider par un juriste]** |
| PD-6 | Désactivation du compte comme mesure de limitation | **[À valider par un juriste]** |
| PD-7 | Suppléant en cas d'absence de Flo | **[Décision de Flo]** |
| PD-8 | Page web de suppression : simple formulaire ou connexion directe (Apple, Google, code e-mail) permettant de supprimer sans intervention | **[Décision de Flo]** |
