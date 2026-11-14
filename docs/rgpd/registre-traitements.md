# Registre des activités de traitement · Sprinter

> **Brouillon de travail. Ce document n'est pas un avis juridique.**
> Il prépare la phase 6 de Sprinter à partir du cahier des charges v2.1 (§13) et du contrat RPC admin v1. Faites-le relire par un juriste, ou confrontez-le aux ressources de la CNIL, avant toute mise en production.
> Repères utilisés : **[À valider par un juriste]** point de droit à trancher · **[Décision de Flo]** choix produit ou d'organisation · **[À vérifier]** fait technique ou documentaire à confirmer sur la source officielle à jour.
> Champs à compléter (décisions ouvertes §16) : `<domaine>`, `<ÉDITEUR>`, `<ADRESSE>`, `<EMAIL_CONTACT_RGPD>`.

| | |
|---|---|
| Version | 0.1 (brouillon) · 14 novembre 2026 |
| Fondement | Article 30 du RGPD (registre des activités de traitement du responsable) |
| Sources | `COMPTES_SYNC_ADMIN_v2_1.md` (§2, §5, §5.7, §6 à §10, §12.3, §13, §17) · `ADMIN_RPC_CONTRACT.md` v1 · observation du dépôt de l'app (types `RunRecord`, `SavedRoute`, plugins iOS) |
| Documents liés | [Durées de conservation](durees-conservation.md) · [Sous-traitants](sous-traitants.md) · [AIPD](analyse-aipd.md) · [Procédure droits](procedure-droits.md) · [Procédure violation](procedure-violation.md) · [Politique de confidentialité](politique-confidentialite.md) |

## Comment lire ce registre

- Une fiche par traitement, de T1 à T13. T0 décrit pour mémoire le fonctionnement local sans compte.
- **Actif au lancement** : traitement en service dès que les flags `accounts_enabled`, `sync_enabled` ou `routes_sync_enabled` sont activés en production. **Préparatoire** : fonction prévue (phases 7 et 8) et non activée au lancement. Une fiche préparatoire doit être complétée et validée avant l'activation du flag correspondant.
- Les bases légales sont celles **proposées** au §13.1 du cahier des charges. Aucune n'est validée à ce stade.
- La CNIL publie un modèle de registre et une fiche explicative : [Le registre des activités de traitement](https://www.cnil.fr/fr/RGPD-le-registre-des-activites-de-traitement).

## 1. Responsable du traitement

| | |
|---|---|
| Responsable du traitement | `<ÉDITEUR>` · **[Décision de Flo]** statut de particulier ou de micro-entreprise (§16 n° 2) |
| Adresse | `<ADRESSE>` |
| Contact pour les données personnelles | `<EMAIL_CONTACT_RGPD>` (adresse `privacy@<domaine>` prévue au §13.3, action 5) |
| Représentant dans l'Union | Sans objet si l'éditeur est établi en France |
| Délégué à la protection des données | Non désigné à ce stade. **[À valider par un juriste]** L'article 37 impose un DPO lorsque les activités de base consistent en un suivi régulier et systématique à grande échelle. Les lignes directrices du G29 sur les DPO, reprises par le CEPD, citent le suivi de localisation par application parmi les exemples de suivi. Sprinter enregistre la position sur l'appareil, à la demande de la personne, et ne la reçoit côté serveur que sur choix explicite. L'échelle reste faible au lancement : réexaminer ce point si l'audience grandit. [Désignation d'un DPO (CNIL)](https://www.cnil.fr/fr/designation-dpo) · [Lignes directrices du G29 reprises par le CEPD](https://www.edpb.europa.eu/endorsed-wp29-guidelines_en) |
| Création · dernière mise à jour | 14/11/2026 · 14/11/2026 |

## 2. Vue d'ensemble

| Réf. | Traitement | Finalité principale | Base légale proposée | Durée principale | Statut |
|---|---|---|---|---|---|
| T0 | Fonctionnement local sans compte | Enregistrer et consulter ses courses sur l'appareil | Pour mémoire, aucune donnée transmise à l'éditeur | Sur l'appareil, sous le contrôle de la personne | Actif |
| T1 | Comptes et authentification | Créer, sécuriser et fermer le compte facultatif | Exécution du contrat (CGU) | Durée du compte, 24 mois d'inactivité au plus | Actif au lancement |
| T2 | Profil de compte facultatif | Nom affiché, statistiques agrégées | Consentement (champs facultatifs) | Durée du compte ou jusqu'à effacement du champ | Actif au lancement |
| T3 | Sauvegarde et synchronisation des courses | Sauvegarde en ligne et synchronisation demandées | Exécution du contrat, sur choix explicite | Durée du compte · tombstones 90 jours | Actif au lancement |
| T4 | Sauvegarde des tracés GPS | Retrouver ses parcours sur un autre appareil | Exécution du contrat, sur choix explicite distinct | Jusqu'à suppression des tracés ou du compte | Actif au lancement |
| T5 | Journal des choix et acceptations | Prouver les acceptations et les choix | Obligation légale (art. 7.1) et intérêt légitime | Durée du compte | Actif au lancement |
| T6 | Mesure d'usage et statistiques agrégées | Mesure d'usage minimale, pilotage du service | Intérêt légitime | 25 mois (`activity_days`) | Actif au lancement |
| T7 | Support | Répondre aux demandes | Exécution du contrat / intérêt légitime | 12 mois après clôture | Actif au lancement |
| T8 | Exercice des droits et suppressions à distance | Traiter les demandes RGPD, y compris sans l'app | Obligation légale (art. 12 à 22) | Voir fiche | Actif au lancement |
| T9 | Administration et journal d'audit | Sécurité et traçabilité des accès | Intérêt légitime / obligation de sécurité (art. 32) | 12 mois | Actif au lancement |
| T10 | Journaux techniques et rapports de plantage | Exploiter, sécuriser, corriger | Intérêt légitime | ≤ 30 jours (journaux) · ≤ 90 jours (Sentry éventuel) | Actif au lancement |
| T11 | Classement communautaire (phase 7) | Fonction sociale facultative sous pseudo | Consentement | Jusqu'au retrait | Préparatoire |
| T12 | Profil personnalisable privé (phases 8a, 8b) | Espace personnel et studio | Exécution du service demandé, à valider | Jusqu'à suppression ou fermeture du compte | Préparatoire |
| T13 | Partage de profil, recherche et modération (phases 8c, 8d) | Partage choisi, traitement des abus | À valider séparément | Publication jusqu'au retrait · signalements à fixer | Préparatoire |

## 3. Fiches de traitement

### T0 · Fonctionnement local sans compte (pour mémoire)

Sprinter fonctionne pleinement sans compte (§0.1, décision 1). Les courses, les points GPS, les brouillons, les réglages, les itinéraires, les séances et les imports Apple Santé restent dans les bases SQLite de l'appareil. Rien n'est transmis à l'éditeur.

- **Qualification** · **[À valider par un juriste]** Préciser si l'éditeur agit comme responsable d'un traitement purement local auquel il n'a pas accès. La fiche est tenue pour la transparence. La politique de confidentialité informe de ce fonctionnement dans tous les cas.
- **Services tiers déjà présents dans l'app** (hors compte) : affichage des cartes (Apple Plans sur iOS, Google Maps SDK sur Android), connexion Spotify à l'initiative de la personne, lecture et écriture Apple Santé avec autorisation, exports GPX/CSV partagés par la personne. La météo n'est active que dans les builds de développement (`src/tools/weather.ts`). Si un fournisseur météo est activé en production, il recevra une position arrondie à environ 1 km : mettre alors à jour ce registre, la politique et les déclarations des stores.
- **Sauvegardes système** · **[À vérifier]** Sur iOS, les bases sont exclues d'iCloud selon `docs/RECETTE_IPHONE.md`. Sur Android, la sauvegarde automatique peut copier les données de l'app vers le compte Google de la personne : décider en phase 5 des fichiers exclus (session, `device_id`, état de synchronisation). [Sauvegarde automatique Android](https://developer.android.com/identity/data/autobackup)

### T1 · Comptes et authentification

| Rubrique | Contenu |
|---|---|
| Statut | Actif au lancement (flag `accounts_enabled`) |
| Finalités | Créer le compte facultatif · authentifier par Apple, Google ou code e-mail · lier ou retirer des méthodes de connexion · sécuriser les sessions · envoyer les e-mails de service (code, avertissement d'inactivité) · fermer le compte |
| Base légale proposée | Exécution du contrat (CGU), art. 6.1.b (§13.1) |
| Personnes concernées | Personnes de 16 ans et plus ayant créé un compte |
| Données | Adresse e-mail, y compris une adresse relais Apple, et sa copie normalisée `email_norm` dans `private.user_directory` · `user_id` (UUID) · identifiant du compte chez Apple ou Google · méthodes de connexion · statut (actif, désactivé, suppression en cours) · date d'inscription et de dernière connexion · données transmises par le fournisseur d'identité et conservées par Supabase Auth dans les métadonnées d'identité (Google : nom et adresse de la photo de profil) **[À vérifier en staging]** · nom complet Apple transmis une seule fois à l'app et enregistré dans le profil seulement si la personne le valide (§6.2) · sessions (jetons, niveau d'authentification, adresse IP et agent utilisateur dans `auth.sessions`) · codes à usage unique et compteurs d'essais · jeton de rafraîchissement Apple chiffré (`apple-link`), nécessaire à la révocation · adresse destinataire, objet et statut de remise des e-mails chez le prestataire SMTP |
| Condition d'âge | Case « J'ai 16 ans ou plus » cochée avant activation du compte. Elle n'est pas conservée sous forme de date. L'acceptation des CGU, qui rappellent cette condition, est journalisée (T5). **[À valider par un juriste]** suffisance d'une déclaration non vérifiée (§16 n° 3) |
| Source | La personne · Apple ou Google lors de la connexion |
| Données sensibles (art. 9) | Aucune |
| Destinataires internes | Flo (rôle `owner`) : e-mail masqué dans les listes, e-mail complet uniquement dans la fiche individuelle, ouverte avec un motif et journalisée (§10.2, §10.4). Rôle `support` prévu, non activé |
| Sous-traitants | Supabase (Auth, base, Edge Functions) · prestataire SMTP **[Décision de Flo]** Resend, Brevo ou Postmark · Vercel et Cloudflare pour la consultation administrateur |
| Tiers indépendants | Apple (Se connecter avec Apple, relais d'e-mails privé) · Google (Google Sign-In). Ils agissent pour leur propre service et selon leurs propres politiques |
| Transferts hors UE | Base en région UE. Transferts possibles chez les sous-traitants et chez le prestataire SMTP selon le choix retenu : voir [sous-traitants](sous-traitants.md) |
| Durées | Compte : jusqu'à sa suppression, ou après 24 mois d'inactivité avec un avertissement 30 jours avant (§5.7) · sessions : jusqu'à déconnexion, révocation ou expiration **[Décision de Flo]** durée maximale et délai d'inactivité · code e-mail : expiration courte, environ 10 minutes **[À vérifier]** · jeton Apple : jusqu'à la révocation lors de la suppression · journaux de la plateforme : 7 jours avec l'offre Pro · suppression du compte traitée dans un délai d'un mois au plus, accès coupés dès la validation (§6.6) |
| Mesures de sécurité | Aucun mot de passe · code à 6 chiffres, expiration courte, 5 essais puis délai, renvoi après 60 s · nonce Apple (SHA-256) · réauthentification réelle de moins de 5 minutes pour la suppression et la liaison · liaison manuelle des identités, sans fusion fondée sur des similarités · session chiffrée sur l'appareil (clé dans SecureStore) · contrôle « compte actif et session autorisée » sur toute donnée privée, testé avec un ancien JWT · SMTP personnalisé avec SPF, DKIM et DMARC · domaine d'envoi enregistré auprès du relais Apple |
| Points ouverts | **[Décision de Flo]** Désactiver le suivi des ouvertures et des clics chez le prestataire SMTP. **[Décision de Flo]** Désactiver l'écriture du journal d'audit Auth en base (option « Write audit logs to the database ») ou prévoir sa purge, car il peut contenir des adresses IP. **[À vérifier]** Vérifier la purge native des jetons et sessions expirés par Supabase |

### T2 · Profil de compte facultatif

| Rubrique | Contenu |
|---|---|
| Statut | Actif au lancement |
| Finalités | Afficher un nom dans le compte · produire des statistiques agrégées par pays, ville et tranche d'âge · faciliter le support |
| Base légale proposée | Consentement : chaque champ est facultatif, accompagné de « Pourquoi cette information ? » (§6.5, §13.1) |
| Personnes concernées | Titulaires d'un compte ayant rempli au moins un champ |
| Données | `display_name` (1 à 50 caractères) · `country_code` (ISO 3166-1) · `city` (80 caractères au plus) · `age_band` (16-24, 25-34, 35-44, 45-54, 55+) |
| Source | La personne. Nom éventuellement prérempli par Apple, enregistré uniquement après validation |
| Données sensibles | Aucune |
| Destinataires internes | Flo (`owner`) : fiche individuelle motivée et journalisée. Le rôle `support`, s'il est activé, ne voit pas la tranche d'âge. Ventilations statistiques : comptes distincts, cellules de moins de 10 comptes regroupées dans « Autres » puis masquées si nécessaire (k ≥ 10, §10.4) |
| Sous-traitants | Supabase · Vercel et Cloudflare pour la consultation administrateur |
| Transferts hors UE | Voir [sous-traitants](sous-traitants.md) |
| Durées | Durée du compte. Un champ vidé par la personne est effacé immédiatement de la table (hors sauvegardes techniques en rotation) |
| Mesures de sécurité | RLS sur `profiles` (lecture et mise à jour par le propriétaire uniquement) · aucun filtre admin sur l'âge exact, l'adresse ou une position (§10.4) · seuil k ≥ 10 sur les ventilations et les exports |
| Points ouverts | **[À valider par un juriste]** Le `consent_log` ne comporte pas de finalité propre aux champs du profil : la preuve du consentement repose sur la saisie volontaire et l'information affichée. Dire si une entrée dédiée est nécessaire. **[À valider par un juriste]** Une base « intérêt légitime » ou « contrat » serait-elle plus adaptée au seul nom affiché ? |

### T3 · Sauvegarde et synchronisation des courses, réglages et appareils

| Rubrique | Contenu |
|---|---|
| Statut | Actif au lancement (flag `sync_enabled`) |
| Finalités | Sauvegarder les courses en ligne et les retrouver sur ses appareils · synchroniser les réglages portables · afficher les appareils liés et l'état de synchronisation · appliquer les règles de validité (§9.1) |
| Base légale proposée | Exécution du contrat, après un choix explicite de la personne (`cloud_sync_runs`, §6.5, §13.1) |
| Personnes concernées | Titulaires d'un compte ayant activé la sauvegarde des courses |
| Données | **Courses** (`public.runs`, sans aucun point GPS) : identifiant de course, source (`sprinter`, `healthkit`, `gpx`), début et fin, fuseau horaire IANA, temps actif et total, distance, allure, dénivelé, type de séance, plateforme, version de l'app, meilleurs efforts, validité et motifs, horodatages de synchronisation, marque de suppression · `payload` = `RunRecord` sans `points` : configuration d'allure, cible, intermédiaires par kilomètre, instantanés de séance et de coaching, pauses, références de chaussure, d'itinéraire et de plan, **nom d'itinéraire en texte libre** (`routeName`), **origine d'un import Apple Santé** (`healthKit.sourceName` et `sourceBundle`, qui peuvent contenir le nom d'un appareil, par exemple « Apple Watch de Camille ») · **réglages portables** (`user_preferences`) : allure par défaut, audio, haptique, apparence, pause automatique, coaching (§7.5) · **appareils** (`user_devices`) : identifiant aléatoire généré à l'installation, plateforme, versions du système et de l'app, dernière activité, dernière synchronisation, statut et code d'erreur |
| Source | L'appareil de la personne · Apple Santé (import à l'initiative de la personne, lecture des courses et de leur distance uniquement) · fichiers GPX importés |
| Données sensibles | **[À valider par un juriste]** Distance, durée, allure et dénivelé sont des données d'activité physique. Ils ne paraissent pas constituer des données de santé au sens de l'article 9 tant qu'aucune conclusion n'est tirée sur l'état de santé, mais l'analyse doit être revue si une donnée physiologique (fréquence cardiaque, poids…) était ajoutée. [Qu'est-ce qu'une donnée de santé ? (CNIL)](https://www.cnil.fr/fr/quest-ce-ce-quune-donnee-de-sante) |
| Destinataires internes | Flo (`owner`) : agrégats par utilisateur uniquement (nombre de courses, kilomètres, jours actifs sur 30 jours, date de la dernière course), sans détail de course ni tracé (`admin_get_user`) |
| Sous-traitants | Supabase · Vercel et Cloudflare pour la consultation administrateur |
| Transferts hors UE | Voir [sous-traitants](sous-traitants.md) |
| Durées | Durée du compte · une course supprimée devient un tombstone : son contenu est vidé immédiatement et la ligne est purgée après 90 jours (`purge-tombstones`) · appareils : jusqu'à « Déconnecter cet appareil » ou à la fermeture du compte. **[Décision de Flo]** purger les appareils non vus depuis 24 mois |
| Mesures de sécurité | Écritures uniquement par RPC validées (`sync_push_*`) avec `user_id` forcé à l'utilisateur authentifié · RLS en lecture par le propriétaire · contrôle serveur du choix de sauvegarde · aucune synchronisation pendant une course · idempotence et rejeu sans doublon · suppression prioritaire sur une modification tardive · tests pgTAP et test d'IDOR |
| Points ouverts | **[Décision de Flo]** Minimiser le `payload` : exclure ou tronquer `healthKit.sourceName`, et signaler à la personne que `routeName` est synchronisé. **[Décision de Flo]** Si la phase 2b synchronise les itinéraires (`synced_documents.kind = 'route'`), ceux-ci contiennent des coordonnées GPS (`SavedRoute.segments`) : les soumettre au même choix que les tracés (`cloud_sync_routes`) et aux mêmes règles d'accès, ou les exclure. **[À vérifier]** Règle 5.1.3 de l'App Store : voir T6 pour les courses importées d'Apple Santé |

### T4 · Sauvegarde des tracés GPS (sur choix explicite)

| Rubrique | Contenu |
|---|---|
| Statut | Actif au lancement si `routes_sync_enabled` est activé (décision 10, §8) |
| Finalité | Retrouver ses parcours sur un autre appareil |
| Base légale proposée | Exécution du contrat, sur **choix explicite et distinct** (`cloud_sync_routes`), proposé une seule fois sans option présélectionnée. L'envoi exige que les sauvegardes des courses et des tracés soient actives toutes les deux (décision 22). **[À valider par un juriste]** Le consentement (art. 6.1.a) serait-il une base plus adaptée, compte tenu du caractère hautement personnel de la localisation ? L'autorisation de localisation donnée au système ne vaut pas accord pour l'envoi au serveur (§13.1) |
| Personnes concernées | Titulaires d'un compte ayant activé les deux sauvegardes |
| Données | Points GPS de chaque course (latitude, longitude, altitude, horodatage, précision, grandeurs dérivées comme la distance cumulée, l'allure et la qualité du signal), compressés dans un fichier opaque `run-tracks/<user_id>/<base64url(run_id)>.json.gz` (8 Mo au plus) · ligne `run_routes` : chemin, nombre de points, taille et `preview_polyline` (tracé simplifié de 300 points au plus, stocké en clair en base, qui révèle notamment les points de départ et d'arrivée) |
| Source | L'appareil de la personne, au repos après la course, jamais pendant |
| Données sensibles | Pas au sens de l'article 9, mais données **hautement personnelles** au sens des lignes directrices du CEPD sur l'AIPD : elles peuvent révéler le domicile, les habitudes et les déplacements. Voir [AIPD](analyse-aipd.md) |
| Destinataires internes | **Aucun.** Aucune RPC ni aucune page d'administration n'expose de tracé, d'extrait de parcours ou d'aperçu de carte (§0.2 règle 5, §8.6, contrat RPC §3). L'accès technique reste possible par la console Supabase avec des droits d'administration de projet : il est encadré par la règle de non-consultation et par la traçabilité de la plateforme **[À vérifier]** |
| Sous-traitants | Supabase (Storage privé, base) |
| Transferts hors UE | Données stockées en région UE. Voir [sous-traitants](sous-traitants.md) pour les accès éventuels du prestataire |
| Durées | Jusqu'à la suppression par la personne (« Supprimer aussi mes parcours en ligne » au passage à `off`, ou suppression d'une course), ou jusqu'à la fermeture du compte. Les fichiers orphelins sont purgés chaque jour par `purge-storage` via l'API Storage |
| Mesures de sécurité | Bucket privé · policies par dossier `<user_id>/`, avec contrôle du compte actif et de l'opération · envoi et remplacement refusés sans les deux sauvegardes actives · le serveur ne lit ni n'analyse les fichiers · téléchargement à la demande par le propriétaire · test automatisé d'accès croisé · aucune position en direct |
| Points ouverts | **[Décision de Flo]** Rogner le départ et l'arrivée de `preview_polyline` (par exemple 200 m), ce qui limiterait l'impact d'une fuite de la base sans gêner le propriétaire. **[Décision de Flo]** Chiffrement de bout en bout des tracés (backlog §15 n° 6) à planifier |

### T5 · Journal des choix et acceptations (`consent_log`)

| Rubrique | Contenu |
|---|---|
| Statut | Actif au lancement |
| Finalités | Prouver l'acceptation des versions des CGU et de la politique de confidentialité · conserver l'historique des activations et retraits des sauvegardes (courses, tracés) et des fonctions communautaires · faire foi en cas de conflit entre appareils (dernière décision confirmée par le serveur) |
| Base légale proposée | Obligation de pouvoir démontrer le consentement (art. 7.1), art. 6.1.c · intérêt légitime à prouver l'acceptation des CGU, art. 6.1.f · **[À valider par un juriste]** |
| Données | `purpose` (`terms`, `privacy_policy`, `cloud_sync_runs`, `cloud_sync_routes`, `community_leaderboard`) · version · accordé ou retiré · horodatage |
| Destinataires internes | Flo (`owner`) : états de consentement dans la fiche individuelle |
| Sous-traitants | Supabase |
| Durées | Durée du compte (suppression en cascade). Journal en ajout seul, rejeu idempotent |
| Mesures de sécurité | Lecture par le propriétaire · ajout validé par le serveur · aucune modification ni suppression unitaire |

### T6 · Mesure d'usage minimale et statistiques agrégées

| Rubrique | Contenu |
|---|---|
| Statut | Actif au lancement |
| Finalités | Mesurer l'usage de façon minimale (actifs quotidiens, hebdomadaires et mensuels, rétention, activation) · suivre la qualité de service (succès de synchronisation, versions) · détecter l'inactivité des comptes (règle des 24 mois) · produire des statistiques agrégées pour piloter le service (§10.5) |
| Base légale proposée | Intérêt légitime de l'éditeur à connaître l'usage de son service sous une forme minimisée et première partie (§13.1). Mise en balance : une ligne par compte et par jour, aucun SDK tiers, aucun suivi inter-apps, ventilations k ≥ 10, conservation de 25 mois · ventilations par pays, ville et tranche d'âge : consentement donné en renseignant les champs (T2) |
| Personnes concernées | Titulaires d'un compte |
| Données | `activity_days` (jour local, nombre de courses) · `user_devices.last_seen_at` · `user_directory.last_active_day` · agrégats `private.daily_metrics` (non personnels) · statistiques calculées à la demande par les RPC `admin_overview`, `admin_analytics`, `admin_runs_stats`, `admin_quality`, `admin_leaderboard` |
| Destinataires internes | Flo (`owner`, `analyst` prévu) : agrégats. Le mode nominatif des classements (top 50, nom affiché) exige une capacité dédiée, un motif, une réauthentification et un audit |
| Sous-traitants | Supabase · Vercel et Cloudflare pour la consultation administrateur |
| Durées | `activity_days` : 25 mois glissants (`purge-activity`) · `daily_metrics` : sans limite, car agrégats non personnels (§5.7) · exports CSV d'agrégats : périodes de 366 jours au plus |
| Mesures de sécurité | Aucun SDK d'analytique ou de publicité · seuil k ≥ 10 sur les ventilations, « Autres » masqué s'il reste sous le seuil, totaux non renvoyés lorsqu'une cellule masquée deviendrait déductible · exports d'agrégats uniquement, audités · « non disponible » plutôt qu'une valeur inventée |
| Points ouverts | **[À valider par un juriste]** L'appel `touch_activity` à l'ouverture de l'app pourrait relever de l'article 82 de la loi Informatique et Libertés (accès au terminal). L'exemption de la CNIL pour la mesure d'audience suppose des statistiques anonymes au profit exclusif de l'éditeur : l'usage individuel de l'activité (fiche support, inactivité) sort de ce cadre. [Mesure d'audience (CNIL)](https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies-solutions-pour-les-outils-de-mesure-daudience) · [Lignes directrices 2/2023 du CEPD](https://www.edpb.europa.eu/documents/guideline/guidelines-22023-on-technical-scope-of-art-53-of-eprivacy-directive_en). **[Décision de Flo]** Droit d'opposition : prévoir un réglage « Ne pas mesurer mon activité » qui suspend `touch_activity`, car le cahier des charges n'en prévoit pas. **[Décision de Flo]** Préciser la finalité du mode nominatif des classements admin (par exemple contrôle de vraisemblance) ou ne pas l'activer. **[À vérifier]** Exclure les courses `source = 'healthkit'` des KPI et analyses admin : la règle 5.1.3 de l'App Store encadre l'usage des données issues de HealthKit au-delà du service rendu. **[Décision de Flo]** Exclure les comptes de test et le compte App Review des statistiques |

### T7 · Support

| Rubrique | Contenu |
|---|---|
| Statut | Actif au lancement (flag `support_enabled`) |
| Finalités | Recevoir et traiter les demandes envoyées depuis « Contacter le support » · y répondre par e-mail |
| Base légale proposée | Exécution du contrat / intérêt légitime (§13.1). Demandes d'exercice des droits : voir T8 |
| Données | Catégorie (`account`, `sync`, `bug`, `data_request`, `other`) · message libre (4 000 caractères au plus) · plateforme, version de l'app · statut · note interne (2 000 caractères au plus) · dates · échanges d'e-mails dans la messagerie de Flo |
| Destinataires internes | Flo (`owner`) ; rôle `support` prévu, non activé |
| Sous-traitants | Supabase · Vercel et Cloudflare (consultation) · fournisseur de la messagerie de Flo **[Décision de Flo]** à identifier et à ajouter aux [sous-traitants](sous-traitants.md) |
| Durées | 12 mois après la clôture, et suppression avec le compte (§5.7). **[Décision de Flo]** appliquer la même durée aux échanges conservés dans la messagerie |
| Mesures de sécurité | La personne ne voit que les champs qui lui sont destinés, jamais la note interne (§5.3) · audit `support.update` sans le texte de la note · aucune donnée superflue dans la note |
| Points ouverts | **[À vérifier]** Le job de purge des demandes clôturées depuis 12 mois manque à la liste du §5.6 : l'ajouter (`purge-support`). **[Décision de Flo]** Prévoir la suppression d'une demande à la demande de la personne : aucune RPC ne le permet aujourd'hui |

### T8 · Exercice des droits et suppressions à distance

| Rubrique | Contenu |
|---|---|
| Statut | Actif au lancement |
| Finalités | Recevoir, vérifier et traiter les demandes d'accès, de rectification, d'effacement, de limitation, de portabilité et d'opposition · traiter les suppressions demandées depuis `https://<domaine>/supprimer-mon-compte`, y compris après désinstallation · garder la trace des demandes traitées |
| Base légale proposée | Obligation légale (art. 12 à 22 du RGPD), art. 6.1.c. [L'obligation légale (CNIL)](https://www.cnil.fr/fr/les-bases-legales/obligation-legale) |
| Personnes concernées | Titulaires d'un compte · personnes qui affirment l'être · héritiers (directives post mortem) |
| Données | Identité déclarée et adresse de contact · éléments de vérification (preuve de contrôle de l'adresse e-mail du compte) · type de demande, dates de réception et de réponse, décision · pour une suppression : identifiant technique de l'opération et date dans l'audit système (§6.6) |
| Destinataires internes | Flo (`owner`) |
| Sous-traitants | Supabase · hébergeur de la page publique **[Décision de Flo]** · prestataire SMTP · messagerie de Flo |
| Durées | Suivi des demandes : 12 mois après la réponse, aligné sur le journal d'administration · **[À valider par un juriste]** une durée plus longue peut se justifier à titre de preuve |
| Mesures de sécurité | Vérification proportionnée de l'identité, sans copie systématique de pièce d'identité · réponse qui ne révèle pas l'existence d'un compte à un demandeur non vérifié · confirmation typée `SUPPRIMER <id court>` et réauthentification pour `process_deletion` · voir [procédure droits](procedure-droits.md) |

### T9 · Administration, sécurité du back-office et journal d'audit

| Rubrique | Contenu |
|---|---|
| Statut | Actif au lancement (Sprinter Admin) |
| Finalités | Réserver l'administration aux personnes habilitées · tracer chaque consultation et chaque action sensible · détecter un usage anormal |
| Base légale proposée | Intérêt légitime et obligation de sécurité (art. 32), §13.1 |
| Personnes concernées | Administrateurs (Flo) · utilisateurs concernés par une consultation ou une action |
| Données | `private.admin_users` (identifiant, rôle) · facteurs TOTP (Supabase Auth) · `private.admin_audit_logs` : date, administrateur, action, utilisateur ciblé, motif, métadonnées **sans e-mail ni texte de recherche** · journaux Cloudflare Access (identité de l'administrateur, adresse IP, date) · journaux Vercel |
| Destinataires internes | Flo (`owner`, capacité `audit.read`) |
| Sous-traitants | Supabase · Vercel (fonctions en région `cdg1`, Paris) · Cloudflare (Access) |
| Durées | Journal d'audit : 12 mois (`purge-audit`, mensuel) · journaux Cloudflare et Vercel : durée de l'offre souscrite **[À vérifier]** |
| Mesures de sécurité | Site séparé derrière Cloudflare Access · connexion par code sans création de compte · TOTP obligatoire (AAL2) vérifié en SQL par `assert_admin` · réauthentification de moins de 5 minutes pour les actions sensibles · aucune clé `service_role` dans le site · journal en ajout seul, protégé par trigger · en-têtes de sécurité, CSP stricte, `Cache-Control: private, no-store` · limitation de débit |

### T10 · Journaux techniques et rapports de plantage

| Rubrique | Contenu |
|---|---|
| Statut | Actif au lancement |
| Finalités | Exploiter et sécuriser le service · diagnostiquer les erreurs · corriger les plantages |
| Base légale proposée | Intérêt légitime |
| Données | Journaux Supabase (passerelle API, PostgREST, Auth, Storage, Edge Functions) : date, chemin, statut, identifiant d'utilisateur, adresse IP selon la source **[À vérifier]** · journaux Vercel des fonctions admin · rapports de plantage transmis par Apple (App Store Connect) et Google (Play Console) pour les personnes qui ont accepté de partager leurs diagnostics · Sentry **non utilisé par défaut** (§16 n° 8) |
| Sous-traitants | Supabase · Vercel · Sentry si activé (région UE, `sendDefaultPii: false`) |
| Tiers indépendants | Apple et Google pour leurs rapports de diagnostic |
| Durées | 30 jours au plus pour les journaux techniques (Supabase Pro : 7 jours) · 90 jours au plus pour Sentry s'il est activé (§5.7) |
| Mesures de sécurité | Aucune donnée personnelle dans les journaux applicatifs (redaction `pino`, `beforeSend`) · test vérifiant qu'un événement d'erreur ne contient ni e-mail ni coordonnée (§12.3) |

### T11 · Classement communautaire (phase 7, préparatoire)

| Rubrique | Contenu |
|---|---|
| Statut | Préparatoire, flag `leaderboard_enabled` à `false` au lancement |
| Finalité | Fonction sociale facultative : classement hebdomadaire sous pseudo |
| Base légale proposée | Consentement (`consent_log` `community_leaderboard`), retrait immédiat (§13.1, §14 phase 7) |
| Données | `public_handle` (pseudo unique, jamais le nom réel) · métriques sur les courses éligibles (§9.2) · signalements et masquages de pseudos |
| Destinataires | Membres connectés qui consultent le classement (pseudo et valeur uniquement) · Flo pour la modération des pseudos |
| Exclusions | Aucun parcours GPS, aucun lieu, aucun nom réel. La participation ne crée aucun profil partageable (§17.7) |
| Durées | Jusqu'au retrait. **[À vérifier]** Le retrait doit être immédiat : `public_leaderboard` filtre l'inscription au moment de la lecture, sans attendre `refresh-rankings` |
| Points ouverts | **[Décision de Flo]** Durée de conservation des signalements de pseudos · mise à jour de la politique, des CGU et des déclarations des stores avant activation |

### T12 · Profil personnalisable privé (phases 8a et 8b, préparatoire)

| Rubrique | Contenu |
|---|---|
| Statut | Préparatoire (`profiles_enabled`, `profile_studio_enabled`) |
| Finalité | Créer, enregistrer et synchroniser l'espace personnel demandé (§17) |
| Base légale proposée | Exécution du service demandé, **[À valider par un juriste]** (§13.1) |
| Données | Pseudo de profil · avatar, bannière et galerie (images réencodées, métadonnées de localisation retirées, §17.8) · textes (bio, intérêts, citation, liens HTTPS) · statuts avec expiration · widgets et valeur des statistiques choisies · configurations et préférences d'apparence · brouillons conservés sur l'appareil uniquement |
| Destinataires | La personne seule tant que rien n'est publié |
| Durées | Jusqu'à la suppression par la personne ou la fermeture du compte · médias remplacés purgés via `purge-storage` (§17.9) |
| Points ouverts | Utiliser le sélecteur de photos du système Android pour éviter les autorisations d'accès aux médias **[À vérifier]** · mettre à jour l'export (`export-my-data`) et la suppression (§6.6, §17.9) |

### T13 · Partage de profil, recherche, signalements, blocages et modération (phases 8c et 8d, préparatoire)

| Rubrique | Contenu |
|---|---|
| Statut | Préparatoire (`profile_sharing_enabled`, `theme_library_enabled`, `profile_cards_enabled`) |
| Finalités | Partager le profil avec l'audience choisie · permettre la recherche facultative de profils · traiter les signalements, les blocages et les contestations |
| Base légale proposée | Choix explicite de publication. Bases légales du partage et de la modération **[À valider par un juriste]** séparément (§13.1) |
| Données | Éléments publiés et leur visibilité · liens révocables · index de recherche limité au pseudo et à l'aperçu autorisé (sans e-mail, identifiant interne, pays, ville, tranche d'âge, appareils, consentements ni présence) · présence éphémère, désactivée par défaut · signalements (auteur, cible, motif, extrait de 280 caractères au plus), blocages, décisions de modération (audit `moderation.view`, `moderation.decide`) |
| Destinataires | Membres connectés autorisés selon le mode (lien, membres) · Flo et, sur habilitation dédiée, le rôle `support` pour la modération |
| Durées | Publication jusqu'au retrait · **[Décision de Flo]** durée des signalements et des éléments nécessaires à leur traitement, à fixer avant l'ouverture (§16 n° 14) |
| Points ouverts | **[À valider par un juriste]** Obligations d'hébergeur de contenus de tiers (règlement (UE) 2022/2065 sur les services numériques : point de contact, mécanisme de notification, motivation des décisions) · nouvelle AIPD ou mise à jour de l'AIPD avant ouverture · déclarations des stores sur le contenu généré par les utilisateurs |

## 4. Mesures de sécurité communes (art. 32)

| Domaine | Mesures |
|---|---|
| Hébergement | Supabase en région UE, projets distincts local, staging et prod · offre Pro en production : sauvegardes quotidiennes conservées 7 jours, pas de mise en pause · **[Décision de Flo]** région précise : Paris (`eu-west-3`) conseillée, proche des fonctions Vercel `cdg1`. L'option générale « Europe » de Supabase peut déployer à Londres ou Zurich, hors Union : choisir une région UE précise. [Régions Supabase](https://supabase.com/docs/guides/platform/regions) |
| Cloisonnement | RLS sur toute table `public`, avec tests pgTAP · schéma `private` jamais exposé · fonctions `SECURITY DEFINER` avec `search_path = ''` et droits d'exécution explicites · écritures client par RPC validées |
| Secrets | Aucun secret dans le dépôt ni dans l'app (gitleaks, garde `check-no-secrets.cjs`) · secrets saisis directement dans les gestionnaires (Supabase, Vercel, EAS) · clé `service_role` réservée aux Edge Functions |
| Accès administrateur | Cloudflare Access, OTP sans création de compte, TOTP obligatoire (AAL2), rôles et capacités en base, motif d'accès, audit en ajout seul, réauthentification, e-mails masqués, aucun accès aux tracés, aucun export de données personnelles |
| Transport | HTTPS partout, HSTS sur le site admin |
| Application | Local-first : aucune dépendance réseau pendant une course · session chiffrée · aucun SDK d'analytique ou de publicité · aucun suivi inter-apps |
| Journaux | Sans donnée personnelle applicative · durées courtes |
| Continuité | Restauration de sauvegarde testée une fois avant lancement (§13.5) · flags `accounts_enabled` et `sync_enabled` coupables sans mise à jour de l'app |
| Organisation | **[Décision de Flo]** Double authentification sur tous les comptes de service de Flo (Supabase, Vercel, Cloudflare, Apple Developer, Google Play et Cloud, registrar, SMTP, GitHub) · aucune donnée de production sur le poste de travail · procédure de violation testée |

## 5. Inventaire des données côté serveur

| Emplacement | Données principales | Traitement | Accès administrateur |
|---|---|---|---|
| `auth.users`, `auth.identities` | E-mail, fournisseurs, identifiants externes, métadonnées d'identité, dates | T1 | Par RPC uniquement : e-mail masqué en liste, complet en fiche |
| `auth.sessions`, `auth.refresh_tokens`, `auth.mfa_*`, `auth.one_time_tokens` | Sessions, adresse IP, agent utilisateur, facteurs TOTP, codes | T1, T9 | Aucun par le site admin |
| `public.profiles` | Nom affiché, pays, ville, tranche d'âge | T2 | Fiche motivée, k ≥ 10 en statistiques |
| `public.user_preferences` | Réglages portables | T3 | Aucun |
| `public.consent_log` | Choix et acceptations versionnés | T5 | États dans la fiche |
| `public.runs` | Courses sans points GPS | T3, T6 | Agrégats uniquement |
| `public.run_routes` + bucket `run-tracks` | Tracés compressés, aperçu simplifié | T4 | **Aucun** |
| `public.user_devices` | Appareils, versions, statut de synchronisation | T3, T6 | Fiche et page Qualité (agrégats) |
| `public.activity_days` | Jour actif, nombre de courses | T6 | Agrégats, jours actifs sur 30 jours en fiche |
| `public.support_requests` | Demandes de support | T7, T8 | Page Support |
| `public.app_config` | Flags et configuration, sans donnée personnelle | — | Écriture auditée |
| `private.user_directory` | Copie minimale pour la recherche admin | T1, T6 | Recherche, e-mail masqué |
| `private.admin_users`, `private.admin_audit_logs` | Rôles, journal d'audit | T9 | Journal en lecture (`owner`) |
| `private.daily_metrics` | Agrégats quotidiens | T6 | Vue d'ensemble |
| Stockage du jeton Apple chiffré (emplacement **[À vérifier]** à l'implémentation) | Jeton de rafraîchissement | T1 | Aucun |
| Journaux des prestataires | Requêtes, adresses IP, statuts | T10 | Consoles des prestataires |

## 6. Tenue du registre

- Mettre à jour la fiche concernée **avant** d'activer un flag qui crée un traitement (phases 7, 8a, 8b, 8c, 8d) ou qui en change l'étendue.
- Revoir le registre à chaque ajout ou changement de sous-traitant, à chaque modification d'une durée de conservation et au moins une fois par an.
- Conserver l'historique des versions de ce fichier (git) : il sert de preuve de conformité (principe de responsabilité, art. 5.2).
