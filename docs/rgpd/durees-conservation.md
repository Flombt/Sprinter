# Durées de conservation et mécanique de purge · Sprinter

> **Révision documentaire technique du 15 novembre 2026.** Le compte est obligatoire dans le code actuel ; les sauvegardes restent des choix distincts. Les mentions d’activation/lancement de ce brouillon sont des objectifs à vérifier, pas une preuve d’exploitation. La portée juridique et les déclarations publiées doivent être revalidées ; cette révision ne publie ni n’approuve le texte. Voir [état et points ouverts](README.md).

> **Brouillon de travail. Ce document n'est pas un avis juridique.**
> Les durées reprennent les valeurs par défaut du §5.7 et du §17.9 du cahier des charges v2.1. Elles restent à valider avant la phase 6 (§16 n° 4). Repères : **[À valider par un juriste]**, **[Décision de Flo]**, **[À vérifier]**. Champs à compléter : `<domaine>`, `<ÉDITEUR>`, `<ADRESSE>`, `<EMAIL_CONTACT_RGPD>`.

| | |
|---|---|
| Version | 0.1 (brouillon) · 14 novembre 2026 |
| Sources | §5.6 (jobs), §5.7 (rétention), §6.6 (suppression), §8 (tracés), §12.3 (journaux), §17.6 et §17.9 (profils) |
| Références | [Les durées de conservation des données (CNIL)](https://www.cnil.fr/fr/passer-laction/les-durees-de-conservation-des-donnees) · [Sauvegardes Supabase](https://supabase.com/docs/guides/platform/backups) · [Supabase Cron](https://supabase.com/docs/guides/cron) |

## 1. Principes

1. Chaque durée a un **point de départ** explicite et un **mécanisme d'effacement** automatique. Aucune durée ne repose sur une purge manuelle, sauf pour la messagerie de support.
2. Les jobs sont **idempotents** et **reprenables** : relancer un job ne change pas le résultat, et un job interrompu reprend là où il s'est arrêté.
3. Les fichiers Storage se suppriment **uniquement par l'API Storage**, depuis une fonction serveur (§5.5). Supprimer une ligne de `storage.objects` en SQL ne supprime pas le fichier.
4. Les sauvegardes techniques suivent leur propre rotation (section 5). Après toute restauration, les suppressions intervenues depuis la date de la sauvegarde sont rejouées.
5. Les données présentes sur l'appareil restent sous le contrôle de la personne (section 6).

## 2. Durées côté serveur

### 2.1 Socle (actif au lancement)

| Donnée | Emplacement | Durée | Point de départ | Mécanisme d'effacement | Source |
|---|---|---|---|---|---|
| Compte et identités | `auth.users`, `auth.identities`, `private.user_directory` | Durée du compte. Suppression après 24 mois d'inactivité, avec avertissement 30 jours avant | Création · dernière activité | `delete-account` (Edge) ou `inactive-accounts` (Edge, hebdomadaire), puis cascades | §5.7, §6.6 |
| Profil de compte | `public.profiles` | Durée du compte. Un champ vidé est effacé aussitôt | — | Cascade à la suppression du compte | §5.7 |
| Réglages portables | `public.user_preferences` | Durée du compte | — | Cascade | §5.7 |
| Courses | `public.runs` | Durée du compte, ou jusqu'à la suppression de la course | — | Tombstone, puis purge | §5.7 |
| Tombstones de courses | `public.runs` avec `deleted_at` (contenu vidé immédiatement) | 90 jours | `deleted_at` | `private.job_retention()` (job `retention`, quotidien) | §5.6, §5.7 |
| Tracés GPS | Bucket `run-tracks` et `public.run_routes` | Jusqu'à la suppression du tracé, de la course ou du compte, ou au choix « Supprimer aussi mes parcours en ligne » | — | Suppression via l'API Storage, puis `purge-storage` (quotidien) pour les fichiers orphelins | §5.6, §8 |
| Choix et acceptations | `public.consent_log` | Durée du compte | — | Cascade | §6.5 |
| Appareils | `public.user_devices` | Jusqu'à « Déconnecter cet appareil » ou la fermeture du compte. **[Décision de Flo]** purger les appareils non vus depuis 24 mois | `last_seen_at` | Cascade · `purge-devices` (proposé) | §5.2 |
| Jours d'activité | `public.activity_days` | 25 mois glissants | `day` | `retention` (quotidien) | §5.6, §5.7 |
| Agrégats quotidiens | `private.daily_metrics` | Sans limite | — | Aucun. Condition : aucune dimension ne doit permettre d'isoler une personne (pas de ville, pas de cellule nominative) | §5.7 |
| Demandes de support | `public.support_requests` | 12 mois après la clôture. Supprimées avec le compte | `closed_at` | `retention` (quotidien), implémenté en migration 0013 | §5.7 |
| Journal d'administration | `private.admin_audit_logs` | 12 mois | `at` | `retention` (quotidien), avec la garde attendue par le trigger | §5.6, §5.7 |
| Trace système d'une suppression de compte | Audit système (action, date, identifiant technique de l'opération) | 12 mois | Date de suppression | `retention` ; contrôle de la trace à vérifier selon son emplacement | §6.6 |
| Sessions et jetons | `auth.sessions`, `auth.refresh_tokens` | Jusqu'à la déconnexion, la révocation ou l'expiration | — | Natif Supabase **[À vérifier]** · **[Décision de Flo]** durée maximale de session et délai d'inactivité | §6.3 |
| Journal d'audit Auth en base | `auth.audit_log_entries` (adresse IP pour certains événements) | **[Décision de Flo]** désactiver l'écriture en base (l'audit reste disponible dans les journaux de la plateforme) ou purger après 30 jours | — | Réglage « Write audit logs to the database » · `purge-auth-audit` (proposé) | §12.3 |
| Codes à usage unique | Supabase Auth | Expiration courte, environ 10 minutes **[À vérifier]** | Envoi | Natif | §6.2 |
| Jeton de rafraîchissement Apple chiffré | `private.apple_tokens`, contenu chiffré par `apple-link` | Jusqu'à la révocation à la suppression du compte | — | `delete-account` | §6.6 |
| Archive d'export | Si elle transite par Storage | **[Décision de Flo]** 24 heures conseillées, 7 jours au plus | Création | `purge-storage` (extension proposée) · lien signé de courte durée | §6.6 |
| Suivi des demandes d'exercice des droits | Registre des demandes (voir [procédure droits](procedure-droits.md)) | 12 mois après la réponse **[À valider par un juriste]** | Date de réponse | Revue mensuelle | — |
| Échanges de support dans la messagerie de Flo | Messagerie `<FOURNISSEUR_MESSAGERIE>` | **[Décision de Flo]** 12 mois après la clôture, comme les demandes | Clôture | Revue mensuelle manuelle | — |

### 2.2 Journaux et diagnostics

| Donnée | Durée | Mécanisme |
|---|---|---|
| Journaux Supabase (API, base, Auth, Storage, Edge Functions) | 7 jours avec l'offre Pro | Rotation de la plateforme |
| Journaux Vercel (fonctions de l'outil d'administration) | Selon l'offre **[À vérifier]**, 30 jours au plus visés | Rotation de la plateforme |
| Journaux Cloudflare Access | Selon l'offre **[À vérifier]**, 30 jours au plus visés si réglable | Rotation de la plateforme |
| Journaux du prestataire SMTP | Selon le prestataire **[À vérifier]**, au plus court possible | Réglage du prestataire |
| Sentry (non utilisé par défaut) | 90 jours au plus, sans donnée personnelle | Réglage de rétention Sentry |
| Rapports de plantage App Store Connect et Play Console | Selon Apple et Google | Hors de notre contrôle |

Les journaux applicatifs ne contiennent ni e-mail, ni coordonnées, ni tracé (§12.3). Le cahier des charges fixe 30 jours au plus pour les journaux techniques et 90 jours au plus pour Sentry (§5.7).

### 2.3 Fonctions préparatoires (phases 7 et 8)

| Donnée | Durée | Mécanisme | Source |
|---|---|---|---|
| Inscription au classement communautaire et pseudo | Jusqu'au retrait, avec effet **immédiat** | `public_leaderboard` filtre l'inscription au moment de la lecture, sans attendre `refresh-rankings` **[À vérifier]** | §14 phase 7 |
| Signalements de pseudos | **[Décision de Flo]** à fixer avant la phase 7 | — | §14 phase 7 |
| Contenus, configurations et médias du profil | Jusqu'à la suppression par le titulaire ou la fermeture du compte | Cascade et `purge-storage` pour les médias | §5.7, §17.9 |
| Brouillons de profil | Sur l'appareil uniquement, jamais synchronisés | Effacement local à la suppression du compte | §17.6 |
| Médias remplacés ou supprimés | L'ancienne version est gardée jusqu'à ce que le remplacement soit prêt, puis purgée | `purge-storage` | §17.6, §17.9 |
| Statut temporaire | Jusqu'à son expiration | Filtrage à la lecture, puis purge | §17.4 |
| Présence | Éphémère, sans historique **[Décision de Flo]** durée de vie de quelques minutes | Expiration automatique | §17.4 |
| Publication et visibilité | Jusqu'au retrait. Retrait effectif dès la confirmation du serveur | Invalidation des lectures, de la recherche et des liens | §17.7 |
| Liens révoqués | Révocation définitive, même en cas de nouvelle publication | Conservation de l'empreinte du lien révoqué pendant la durée du compte | §17.7 |
| Index de recherche | Aligné sur la publication | Mise à jour au retrait, au blocage et à la suppression | §17.7 |
| Signalements, blocages et décisions de modération | **[Décision de Flo]** à fixer avant l'ouverture de la phase 8c (§16 n° 14). Proposition : signalements et décisions conservés 12 mois après la décision, blocages jusqu'à leur levée ou la fermeture de l'un des comptes | `purge-moderation` (proposé) | §17.9 |

## 3. Jobs planifiés : code présent et propositions

La référence technique est [l’exploitation backend](../backend/exploitation.md), avec les migrations sources. Les horaires ci-dessous sont ceux déclarés en SQL, en UTC ; leur installation dépend de pg_cron et leur exécution distante n’a pas été vérifiée ici.

| Job déclaré | Plan UTC | Action implémentée |
|---|---|---|
| `daily-metrics` | `15 1 * * *` | Métriques quotidiennes ; migration 0009 |
| `refresh-rankings` | `30 1 * * *` | Vue matérialisée ; migration 0012 |
| `retention` | `45 2 * * *` | Tombstones courses/documents, audit admin, jours d’activité, support clos, traces de suppression terminée ; migration 0013 |
| `profile-media` | `20 3 * * *` | Réservations abandonnées et médias inutilisés ; migration 0015 |
| `recompute-validity` | `*/15 * * * *` | Validité des courses ; migration 0019 |

Les fonctions HTTP `process-deletions`, `purge-storage` et `inactive-accounts` existent ; leurs horaires, secrets et résultats doivent être relevés dans l’environnement choisi. Les fréquences visées restent respectivement toutes les 15 minutes, quotidiennes et hebdomadaires jusqu’à validation opérationnelle.

Les noms historiques `purge-tombstones`, `purge-audit`, `purge-activity` et `purge-support` décrivaient des tâches séparées : elles sont regroupées dans `retention`. `purge-devices`, `purge-auth-audit`, `purge-moderation`, la table de suivi `private.job_runs` et la purge d’archives d’export restent des **propositions non attestées par le code actuel** ; ne pas les compter parmi les jobs installés.

## 4. Mécanique de purge

### 4.1 Jobs SQL (pg_cron)

[private.job_retention](../../supabase/migrations/0013_admin_ops.sql) est la référence du mécanisme effectif. Il applique les durées ci-dessus et la garde du trigger d’audit dans sa transaction. Le squelette SQL proposé auparavant n’est plus reproduit : il ne correspondait pas à une fonction livrée.

Cette fonction utilise des suppressions SQL sans plafond explicite de 1 000 lignes. Un traitement par lots et un journal durable des passages restent des choix à concevoir si les volumes l’exigent ; ils ne doivent pas être présentés comme déjà validés.

### 4.2 Jobs Edge Functions

`purge-storage`, `inactive-accounts` et `process-deletions` ont besoin de l'API Storage, de l'API Auth ou de l'envoi d'e-mails : ils tournent en Edge Functions. La documentation Supabase décrit leur planification par pg_cron avec un appel HTTP (extension `pg_net`), le secret d'appel étant conservé dans Vault et jamais dans une migration **[À vérifier]**.

- Chaque fonction vérifie un secret d'appel dédié et refuse tout autre appelant.
- Les suppressions de fichiers passent par l'API Storage, par lots.
- En cas d'échec partiel, la ligne reste en file de purge et sera reprise au passage suivant.

### 4.3 Suppression d'un compte (rappel du §6.6)

1. Validation de la demande (app : réauthentification de moins de 5 minutes · à distance : vérification par le support puis `process_deletion`).
2. Accès suspendus et sessions révoquées immédiatement. Le statut passe à « suppression en cours ».
3. Révocation du jeton Apple, si une identité Apple est liée.
4. Suppression des objets `run-tracks/<uid>/` via l'API Storage, ainsi que des médias du profil pour les fonctions déjà implémentées.
5. `auth.admin.deleteUser(uid)`. Les cascades retirent les données relationnelles.
6. Trace dans l'audit système (action, date, identifiant de l'opération).

`process-deletions` reprend toute suppression restée « en cours », sans jamais réactiver le compte. Objectif : suppression complète en quelques heures. Le délai maximal d'un mois est un plafond, pas une cible.

### 4.4 Comptes inactifs

- **Critère d'inactivité** (proposition) : aucune ouverture connectée (`activity_days`), aucune connexion (`auth.users.last_sign_in_at`) et aucune synchronisation (`user_devices.last_sync_at`) depuis 23 mois. Ne pas s'appuyer sur `activity_days` seul : si la personne s'oppose à la mesure d'usage, elle ne doit pas être considérée comme inactive pour autant.
- **À 23 mois** : envoi de l'e-mail d'avertissement (section 7) et enregistrement de la date d'avertissement.
- **À 24 mois**, si l'inactivité persiste et que l'avertissement date d'au moins 30 jours : même chaîne que `delete-account`. Audit système `account.inactive_deleted`.
- **Retour de la personne** avant l'échéance : le compteur est remis à zéro.
- **Adresse relais Apple** : le domaine d'envoi doit être enregistré auprès d'Apple, sinon l'avertissement n'arrive pas (§6.2).
- **E-mail en échec** : la suppression a lieu quand même à 24 mois. L'échec est consigné sans l'adresse.

### 4.5 Après une restauration de sauvegarde

Les sauvegardes de la base n'incluent pas les fichiers Storage. Une restauration peut donc :
- faire réapparaître un compte supprimé depuis la date de la sauvegarde ;
- faire réapparaître des lignes `run_routes` dont le fichier n'existe plus.

Procédure : avant de rouvrir le service, rejouer les suppressions de comptes et de courses enregistrées dans l'audit système depuis la date de la sauvegarde, lancer `purge-tombstones` et `purge-storage`, puis réconcilier `run_routes` avec le contenu réel du bucket. Consigner l'opération dans le registre des violations si la restauration fait suite à un incident (voir [procédure violation](procedure-violation.md)).

### 4.6 Vérification

- Recette **R4d.03** (`docs/quality/recettes/README.md`) : jobs exécutés sur staging avec des comptes inactifs simulés, des tombstones anciens et un journal ancien.
- **Surveillance à mettre en place et vérifier** : contrôle des exécutions via les outils de l’environnement ; `private.job_runs` n’est pas implémentée. Les seuils proposés restent deux échecs successifs ou une absence de passage depuis 48 heures.
- Test pgTAP : le journal d'administration refuse `UPDATE` et `DELETE` en dehors de la purge.

## 5. Sauvegardes techniques

| Élément | Durée | Remarque |
|---|---|---|
| Base de données (offre Pro) | Sauvegardes quotidiennes conservées 7 jours | Une donnée supprimée peut y subsister jusqu'à 7 jours, sans être utilisée. À indiquer dans la politique de confidentialité (section 10) |
| Restauration à un instant donné (PITR) | Option payante : 7, 14 ou 28 jours | Si elle est activée, les sauvegardes quotidiennes ne sont plus prises. Adapter alors la durée annoncée **[Décision de Flo]** |
| Fichiers Storage | Non inclus dans les sauvegardes de la base | Une suppression de tracé est définitive |

## 6. Données sur l'appareil

- Les données locales restent jusqu'à leur suppression par la personne ou la désinstallation de l'app.
- À la déconnexion, les données restent sur l'appareil, liées à l'ancien compte. L'option « Effacer aussi les courses de cet appareil » est désactivée par défaut (§7.8).
- Après la suppression du compte, l'app efface la session et les données propres au compte, dont les brouillons de profil (phase 8). Les courses conservées selon le choix restent sur l’appareil, mais leur accès nécessite une connexion ; aucun mode invité n’est fourni par le code actuel.

## 7. Modèle d'e-mail d'avertissement d'inactivité (brouillon)

> **Objet :** Votre compte Sprinter sera supprimé le `<DATE_SUPPRESSION>`
>
> Bonjour,
>
> Votre compte Sprinter n'a pas été utilisé depuis près de deux ans. Comme l'indique notre politique de confidentialité, nous supprimons les comptes inactifs depuis 24 mois.
>
> Sans action de votre part, votre compte et les données sauvegardées en ligne (courses, parcours, réglages) seront supprimés le `<DATE_SUPPRESSION>`. Les courses présentes sur votre téléphone ne seront pas touchées.
>
> Pour conserver votre compte, ouvrez simplement Sprinter et connectez-vous avant cette date.
> Pour récupérer vos données, utilisez Réglages › Compte › Mes données › Exporter.
>
> Cet e-mail est envoyé une seule fois. Pour toute question : `<EMAIL_CONTACT_RGPD>`.
>
> L'équipe Sprinter

Envoyé depuis l'adresse d'expédition de `<domaine>`, sans pixel de suivi ni lien de suivi.

## 8. Points ouverts

| Réf. | Point | Repère |
|---|---|---|
| DC-1 | Valider l'ensemble des durées du §5.7 (§16 n° 4) | **[À valider par un juriste]** |
| DC-2 | Vérifier `retention` pour le support et planifier/relever `process-deletions` dans l’environnement réel | **[Décision de Flo]** |
| DC-3 | Purger les appareils non vus depuis 24 mois | **[Décision de Flo]** |
| DC-4 | Journal d'audit Auth : désactiver l'écriture en base ou le purger après 30 jours | **[Décision de Flo]** |
| DC-5 | Durée de vie de l'archive d'export | **[Décision de Flo]** |
| DC-6 | Messagerie de support : durée et mode de purge | **[Décision de Flo]** |
| DC-7 | Signalements de pseudos (phase 7) et modération (phase 8c) : durées | **[Décision de Flo]** |
| DC-8 | Durées de conservation réelles des journaux Vercel, Cloudflare et SMTP selon les offres souscrites | **[À vérifier]** |
| DC-9 | PITR : activer ou non, et adapter la durée annoncée | **[Décision de Flo]** |
