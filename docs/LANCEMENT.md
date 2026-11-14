# Lancement des comptes et de la synchronisation · Sprinter

> **Brouillon de travail. Ce document n'est pas un avis juridique.**
> Checklist de la phase 6 (§14) : sécurité (§13.5), conformité (§13.4), stores (§13.2), retour arrière, activation progressive et critères d'arrêt. Les seuils chiffrés sont des propositions. Repères : **[À valider par un juriste]**, **[Décision de Flo]**, **[À vérifier]**. Champs à compléter : `<domaine>`, `<ÉDITEUR>`, `<ADRESSE>`, `<EMAIL_CONTACT_RGPD>`.

| | |
|---|---|
| Version | 0.1 (brouillon) · 14 novembre 2026 |
| Propriétaire | Flo, seul décisionnaire du passage à chaque étape |
| Sources | §2 (décision 21), §10.4 (Config), §13, §14 du cahier des charges v2.1 · `ADMIN_RPC_CONTRACT.md` v1 (`admin_set_config`) |
| Documents liés | [Recette](RECETTE_COMPTES.md) · [Registre](rgpd/registre-traitements.md) · [AIPD](rgpd/analyse-aipd.md) · [Procédure violation](rgpd/procedure-violation.md) · [App Store](stores/app-store-confidentialite.md) · [Google Play](stores/google-play-data-safety.md) |

**Critère d'acceptation de la phase 6** : toutes les cases du §13 cochées et la recette signée par Flo dans [`RECETTE_COMPTES.md`](RECETTE_COMPTES.md).

Pour chaque case : cocher, puis noter la preuve (lien de CI, capture sans donnée réelle, date, commit). Une case sans preuve reste ouverte.

## 1. Préalables (go / no-go)

| Préalable | Preuve | Fait |
|---|---|---|
| Décisions ouvertes tranchées : domaine (§16 n° 1), éditeur et contact RGPD (n° 2), âge minimum validé (n° 3), durées (n° 4), Sentry ou non (n° 8). Voir aussi la section 9 | Décisions consignées | [ ] |
| Placeholders remplacés dans les documents publiés : `<domaine>`, `<ÉDITEUR>`, `<ADRESSE>`, `<EMAIL_CONTACT_RGPD>` | Relecture | [ ] |
| Documents de `docs/rgpd/` relus par un juriste | Avis daté | [ ] |
| AIPD validée et mesures préalables à l'activation des tracés réalisées (M1, M4, M5, M6, M10, M12) | AIPD signée | [ ] |
| Recette complète exécutée et signée | `RECETTE_COMPTES.md` | [ ] |
| Phases 1 à 5 acceptées (PR et preuves) | PR fusionnées | [ ] |

## 2. Sécurité (§13.5)

| # | Vérification | Comment | Preuve | Fait |
|---|---|---|---|---|
| S1 | Security Advisor et Performance Advisor de Supabase sans alerte critique · RLS sur toutes les tables | Console Supabase (projet `sprinter-prod`) · requête A ci-dessous : résultat vide | Capture des advisors, sortie de la requête | [ ] |
| S2 | Revue manuelle de **chaque** fonction `SECURITY DEFINER` : `search_path` fixé, droits d'exécution, usage de `auth.uid()` | Requête B ci-dessous, puis relecture fonction par fonction. Aucune fonction exécutable par `anon`, sauf exception documentée | Tableau de revue signé | [ ] |
| S3 | Test d'IDOR automatisé vert · impossible de se déclarer administrateur via `user_metadata` ou en forgeant `aal2` | CI (script IDOR, pgTAP) · recette R4a.01 | Lien de CI | [ ] |
| S4 | Aucun secret dans l'historique git des deux dépôts · clés d'API restreintes | gitleaks sur tout l'historique · clé Google Maps restreinte au package et aux empreintes SHA-1 (clé d'importation **et** clé de signature Play) · clients OAuth limités | Rapports gitleaks, captures des restrictions | [ ] |
| S5 | En-têtes de sécurité et CSP validés · Cloudflare Access actif · limitations de débit actives | `curl -sI` sur `admin.<domaine>` après authentification : HSTS, CSP sans script tiers, `frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`, `Cache-Control: private, no-store` sur les données · accès sans identité Access refusé · 6ᵉ tentative de connexion en 15 minutes bloquée | Sorties de commandes | [ ] |
| S6 | Sauvegardes Supabase actives et **restauration testée une fois** | Restaurer dans un projet temporaire **pendant que la production ne contient que des données de test**, vérifier, puis supprimer le projet temporaire. Rappel : les fichiers Storage ne sont pas inclus | Compte rendu daté | [ ] |
| S7 | Journaux sans donnée personnelle | Provoquer des erreurs (synchronisation refusée, RPC admin refusée, Edge Function en échec) et inspecter les journaux Supabase, Edge Functions et Vercel : ni e-mail, ni coordonnée, ni tracé, ni texte de recherche | Extraits anonymisés | [ ] |
| S8 | Retour arrière : `accounts_enabled` et `sync_enabled` désactivables **sans mise à jour de l'app** | Recette R6.03 | Résultat de recette | [ ] |
| S9 | `npm audit` : aucune vulnérabilité haute non justifiée | Dans les deux dépôts | Sortie et justification éventuelle | [ ] |

Requêtes de contrôle, en lecture seule :

```sql
-- A. Tables du schéma public sans RLS (résultat attendu : vide)
select c.relname
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;

-- B. Fonctions SECURITY DEFINER : configuration et droits d'exécution
select p.oid::regprocedure as fonction,
       p.proconfig as reglages,
       has_function_privilege('anon', p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where p.prosecdef and n.nspname in ('public', 'private')
order by 1;

-- C. Buckets : run-tracks doit être privé
select id, public, file_size_limit, allowed_mime_types from storage.buckets;

-- D. Policies en place
select schemaname, tablename, policyname, roles, cmd from pg_policies order by 1, 2, 3;
```

### 2.1 Vérifications complémentaires recommandées

| # | Vérification | Fait |
|---|---|---|
| S10 | Double authentification sur tous les comptes de service de Flo : Supabase, Vercel, Cloudflare, Apple Developer, Google Play Console et Google Cloud, registrar, prestataire SMTP, GitHub, EAS **[Décision de Flo]** | [ ] |
| S11 | Supabase Auth : code à 6 chiffres, expiration courte, limites d'envoi, liaison manuelle d'identités, MFA TOTP activé, connexion anonyme désactivée, seul le schéma `public` exposé (§14 phase 0) | [ ] |
| S12 | SMTP : SPF, DKIM et DMARC valides · suivi des ouvertures et des clics désactivé · domaine d'envoi enregistré auprès du relais d'e-mails privé d'Apple | [ ] |
| S13 | Cloudflare Access : politique limitée à l'identité de Flo · `ADMIN_ALLOWED_EMAILS` renseigné dans Vercel | [ ] |
| S14 | Bucket `run-tracks` privé, limite de 8 Mo, type `application/gzip` (requête C) · test CI qui échoue si le bucket devient public (AIPD, M6) | [ ] |
| S15 | Surveillance de disponibilité active sur l'API et le site admin (§12.3) | [ ] |
| S16 | Exercice de violation réalisé ([procédure](rgpd/procedure-violation.md), section 11) | [ ] |

## 3. Conformité (§13.4)

| Document | Relu par un juriste | Publié (URL) | Fait |
|---|---|---|---|
| [Registre des traitements](rgpd/registre-traitements.md) | [ ] | Interne | [ ] |
| [Politique de confidentialité](rgpd/politique-confidentialite.md) | [ ] | `https://<domaine>/confidentialite` | [ ] |
| [CGU](rgpd/cgu.md) | [ ] | `https://<domaine>/cgu` | [ ] |
| [Mentions légales](rgpd/mentions-legales.md) | [ ] | `https://<domaine>/mentions-legales` | [ ] |
| [Durées de conservation](rgpd/durees-conservation.md) | [ ] | Interne | [ ] |
| [Procédure droits](rgpd/procedure-droits.md) | [ ] | Interne | [ ] |
| [Procédure violation](rgpd/procedure-violation.md) | [ ] | Interne | [ ] |
| [Sous-traitants](rgpd/sous-traitants.md) · DPA acceptés | [ ] | Interne | [ ] |
| [AIPD](rgpd/analyse-aipd.md) · signée | [ ] | Interne | [ ] |
| Page de suppression de compte | [ ] | `https://<domaine>/supprimer-mon-compte` | [ ] |
| Versions des CGU et de la politique identiques à celles enregistrées dans `consent_log` | — | — | [ ] |

## 4. Stores (§13.2)

**Apple** (détails : [App Store](stores/app-store-confidentialite.md))

- [ ] Capacité « Sign in with Apple » sur `app.sprinter.running`, suppression de compte dans l'app et révocation du jeton Apple.
- [ ] Étiquettes App Privacy conformes aux traitements activés, `PrivacyInfo.xcprivacy` à jour, textes de permission de localisation et d'Apple Santé cohérents, lien vers la politique de confidentialité.
- [ ] Absence de suivi inter-apps vérifiée.
- [ ] Notes App Review décrivant le parcours sans compte et un moyen de tester les fonctions de compte avec des données de test.
- [ ] Statut de « trader » déclaré · classification par âge à jour · version publiée manuellement après approbation.

**Google Play** (détails : [Google Play](stores/google-play-data-safety.md))

- [ ] Formulaire Sécurité des données, politique de confidentialité, déclaration de localisation en arrière-plan avec vidéo si l'option A est retenue, déclaration des services de premier plan.
- [ ] Suppression accessible dans l'app et à distance par l'URL web.
- [ ] Test fermé réalisé si le compte développeur personnel est concerné (12 testeurs, 14 jours consécutifs).
- [ ] Formulaire des applications de santé, audience cible, classification IARC, accès à l'application.

## 5. Plan de retour arrière

### 5.1 Flags disponibles

Clés de `app_config`, modifiables dans Sprinter Admin › Config (`admin_set_config`, capacité `config.write`, réauthentification, audit avec ancienne et nouvelle valeur) :

| Clé | Effet attendu à `false` |
|---|---|
| `routes_sync_enabled` | Plus aucun envoi de tracé. Les tracés déjà en ligne restent privés et consultables par leur propriétaire |
| `sync_enabled` | Synchronisation suspendue. L'outbox continue de se remplir sur l'appareil, sans perte. Reprise à la réactivation |
| `accounts_enabled` | Aucun écran de compte visible (§14 phase 1). Les données locales restent intactes |
| `support_enabled` | Formulaire « Contacter le support » masqué. L'adresse e-mail reste le canal de secours |
| `leaderboard_enabled`, `profiles_enabled`, `profile_studio_enabled`, `profile_sharing_enabled`, `theme_library_enabled`, `profile_cards_enabled` | Fonctions des phases 7 et 8, éteintes au lancement |
| `min_version` | Version minimale par plateforme : en dessous, écran « Mise à jour requise » |
| `maintenance` | Message affiché dans l'app (280 caractères au plus) |

### 5.2 Délai de propagation : point d'attention

L'app lit `app_config` après le démarrage, garde la dernière valeur connue et la relit en arrière-plan dès qu'elle a plus d'une heure (lancement, retour au premier plan) ; elle échoue en mode ouvert (§10.4).

**Coupure immédiate côté serveur (implémentée, migration `0013_admin_ops`)** :
- les écritures de synchronisation d'un utilisateur (`runs`, `synced_documents`, `user_preferences`, `run_routes`) sont refusées avec `sync_disabled` dès que `accounts_enabled` ou `sync_enabled` passe à `false` ; l'app traite ce statut comme une **pause de 30 minutes**, sans bloquer ni perdre les éléments en attente ;
- les policies Storage d'envoi de tracés lisent `routes_sync_enabled` à chaque requête (migration `0010_routes`).

**Reste manuel** : Supabase Auth ne lit pas `app_config`. Pour bloquer les nouvelles inscriptions immédiatement, désactiver « Allow new users to sign up » dans Authentication › Sign In / Providers (les comptes existants restent utilisables).

### 5.3 Leviers par ordre de gravité croissante

| Niveau | Levier | Quand | Effet sur les utilisateurs |
|---|---|---|---|
| 1 | `routes_sync_enabled = false` | Problème lié aux tracés | Les courses continuent de se synchroniser |
| 2 | `sync_enabled = false` | Problème de synchronisation, de charge ou d'intégrité | Les données restent sur les appareils |
| 3 | Blocage des inscriptions dans Supabase Auth · `accounts_enabled = false` | Problème d'authentification ou de compte | **Attention** : l'écran « Supprimer mon compte » disparaît de l'app. Garder la page web de suppression et le support opérationnels pendant toute la coupure **[Décision de Flo]** : envisager de laisser « Mes données » visible aux comptes déjà connectés |
| 4 | `maintenance` | Information des utilisateurs | Message global |
| 5 | Révocation des sessions (un compte ou tous) | Compromission | Reconnexion nécessaire, sans perte de données locales |
| 6 | `min_version` | Version défectueuse publiée | Écran de mise à jour. À n'utiliser que si une version corrigée est disponible |
| 7 | Pause de la publication progressive (App Store) · arrêt du déploiement par étapes (Google Play) | Plantage ou régression liés au code | Les nouveaux téléchargements reçoivent l'ancienne version |
| 8 | Restauration de la base | Corruption étendue | Rejouer ensuite les suppressions intervenues depuis la sauvegarde ([durées](rgpd/durees-conservation.md), section 4.5) |

**Ordre de coupure** : du plus sensible au plus large (tracés, puis synchronisation, puis comptes). **Ordre de réactivation** : l'inverse, une étape à la fois, après correctif et rejeu des scénarios de recette concernés.

Toute utilisation d'un levier est consignée dans le journal de lancement (section 8). En cas de doute sur une fuite de données, ouvrir aussitôt la [procédure violation](rgpd/procedure-violation.md).

## 6. Activation progressive

Les flags sont **globaux** : un même interrupteur vaut pour iOS et Android. **[Décision de Flo]** Si une activation par plateforme est nécessaire, faire évoluer le schéma des flags (par exemple `{ "ios": true, "android": false }`) avant le lancement.

| Étape | Flags | Condition d'entrée | Durée minimale d'observation | À surveiller |
|---|---|---|---|---|
| **0 · Préparation** | Tous à `false` en production | Sections 1 à 4 cochées · premier administrateur créé et TOTP enrôlé (§10.2) · prestataires configurés | — | Exercice de violation, restauration testée |
| **1 · Examen des stores** | `accounts_enabled`, `support_enabled`, `sync_enabled`, `routes_sync_enabled` à `true` **pendant l'examen uniquement** | Build soumis. Seuls les relecteurs et les testeurs disposent du code des comptes. Toutes les fonctions activables à distance doivent être examinables (règle 2.3.1 de l'App Store) **[À vérifier]**. AIPD validée et mesures préalables aux tracés réalisées, puisque `routes_sync_enabled` est activé | Durée de l'examen | Compte de démonstration fonctionnel. Remettre les flags à `false` après approbation si l'on suit l'étape 2 |
| **2 · Version sombre** | Tous à `false` | Approbation, publication manuelle, publication progressive iOS (7 jours) et déploiement par étapes Android | 7 jours | Aucun changement de comportement (§14 phase 0) · taux de sessions sans plantage · temps de démarrage par rapport à la mesure de référence de la phase 1 |
| **3 · Comptes** | `accounts_enabled`, `support_enabled` | Étape 2 sans alerte | 7 jours | Inscriptions par fournisseur · remise des codes e-mail · erreurs d'authentification · suppressions terminées · demandes de support |
| **4 · Synchronisation** | `sync_enabled` | Étape 3 sans alerte | 14 jours | Succès de synchronisation (KPI `sync_success`) · codes d'erreur par version · charge de la base · doublons signalés · durée de l'import initial · aucun appel réseau pendant une course |
| **5 · Tracés** | `routes_sync_enabled` | Étape 4 sans alerte · AIPD validée · mesures M1, M4, M5, M6, M10 et M12 réalisées | 14 jours | Échecs d'envoi · volume Storage · taux d'activation · test d'accès croisé rejoué en production avec deux comptes de test |
| **Ensuite** | Phases 7 puis 8a, 8b, 8c, 8d | Recette propre à chaque phase · documents RGPD et déclarations des stores mis à jour **avant** l'activation | Selon la phase | Voir la recette correspondante |

Si Android arrive après iOS : les flags étant déjà actifs, la version Android dispose des fonctions dès son installation. Le test fermé Google Play (14 jours) précède l'accès à la production.

## 7. Critères d'arrêt

Seuils proposés, **[Décision de Flo]** à confirmer avant l'étape 2.

### 7.1 Arrêt immédiat (couper puis analyser)

| Constat | Action immédiate |
|---|---|
| Une donnée d'un compte est visible depuis un autre compte | `sync_enabled = false` (et `routes_sync_enabled = false`) · procédure violation |
| Un tracé est accessible à une autre personne que son propriétaire | `routes_sync_enabled = false`, fermeture de Storage · procédure violation |
| Un appel réseau de synchronisation pendant une course | `sync_enabled = false` · correctif |
| Une perte de courses locales signalée et confirmée | `sync_enabled = false` · analyse, restauration depuis la sauvegarde locale prise avant import |
| Une suppression de compte qui ne coupe pas l'accès (ancien JWT accepté) | `accounts_enabled = false`, blocage des inscriptions · correctif |
| Un secret exposé | Rotation · procédure violation |

### 7.2 Dégradations (pause de l'étape, puis décision)

| Indicateur | Seuil proposé | Action |
|---|---|---|
| Sessions sans plantage | Sous 99,5 % ou baisse de plus de 0,5 point par rapport à la version précédente | Pause du déploiement, correctif |
| Temps de démarrage | Hausse de plus de 10 % par rapport à la mesure de référence | Pause, analyse |
| Succès de synchronisation | Sous 95 % sur 24 heures | `sync_enabled = false` si la cause n'est pas identifiée sous 24 heures |
| Remise des codes e-mail | Plus de 5 % d'échecs sur 24 heures, ou alerte du prestataire (rebonds, plaintes) | Blocage temporaire des inscriptions par e-mail, vérification DNS et SMTP |
| Suppressions de compte | Une suppression non terminée après 72 heures | Correctif avant toute nouvelle étape |
| Erreurs serveur des RPC | Plus de 2 % des appels sur une heure | Analyse, coupure du flag concerné si besoin |
| Charge de la base | CPU ou entrées-sorties au-dessus de 80 % pendant 30 minutes, connexions proches de la limite | Pause de l'étape, `sync_enabled = false` si la situation persiste |
| Support | Plus de `<SEUIL_SUPPORT>` demandes par jour sur un même problème | Pause de l'étape, message de maintenance |
| Stores | Avertissement, rejet ou retrait | Correction avant toute nouvelle étape |
| Coûts | Dépassement de `<BUDGET_MENSUEL>` | Analyse |

## 8. Surveillance et journal de lancement

**Chaque jour** pendant les deux semaines qui suivent chaque étape, puis chaque semaine : Sprinter Admin (Vue d'ensemble, Qualité, Support, Journal) · rapports et journaux Supabase (dont les Edge Functions `delete-account` et `purge-storage`) · App Store Connect (plantages) · Play Console (Android vitals) · surveillance de disponibilité · tableau de bord du prestataire SMTP · boîte de support.

Modèle de journal :

| Date et heure | Étape | Action (flag, version, levier) | Valeur avant → après | Observation | Décision | Par |
|---|---|---|---|---|---|---|
| | | | | | | Flo |

## 9. Décisions à prendre avant le lancement

| Réf. | Décision | Documents | Repère |
|---|---|---|---|
| D1 | Domaine public et sous-domaine admin | Tous | **[Décision de Flo]** (§16 n° 1) |
| D2 | Statut de l'éditeur, adresse, contact RGPD · statut de « trader » sur l'App Store · médiation de la consommation | Mentions légales, CGU, App Store | **[Décision de Flo]** (§16 n° 2) |
| D3 | Âge minimum de 16 ans et sa vérification déclarative | CGU, politique | **[À valider par un juriste]** (§16 n° 3) |
| D4 | Durées de conservation et jobs à ajouter (`purge-support`, `resume-deletions`, appareils, journal Auth, archive d'export) | Durées | **[Décision de Flo]** (§16 n° 4) |
| D5 | Région Supabase (Paris `eu-west-3` conseillée) · prestataire SMTP · offre Vercel · hébergeur des pages publiques · messagerie de support | Sous-traitants | **[Décision de Flo]** |
| D6 | Bases légales (tracés, profil, mesure d'usage) et articulation avec l'article 82 de la loi Informatique et Libertés | Registre, politique | **[À valider par un juriste]** |
| D7 | Réglage d'opposition à la mesure d'usage | Registre, droits | **[Décision de Flo]** |
| D8 | Minimisation : rognage de `preview_polyline`, retrait de `healthKit.sourceName` | AIPD | **[Décision de Flo]** |
| D9 | Exclusion des courses Apple Santé et des comptes de test des statistiques · nouveau texte d'autorisation Santé | App Store, registre | **[Décision de Flo]** |
| D10 | Coupure côté serveur par les flags · accès à « Mes données » quand `accounts_enabled` est éteint · flags par plateforme | Lancement | **[Décision de Flo]** |
| D11 | Export et suppression à distance sans l'app (formulaire ou connexion sur la page web) | Droits, Google Play | **[Décision de Flo]** |
| D12 | Option A ou B pour la localisation Android écran verrouillé | Google Play | **[À vérifier]** en phase 5 |
| D13 | Accès des relecteurs au code de connexion · comptes de test | App Store, Google Play | **[Décision de Flo]** |
| D14 | Itinéraires de la phase 2b soumis au choix des tracés | Registre, AIPD | **[Décision de Flo]** (§16 n° 11) |
| D15 | Seuils des critères d'arrêt | Lancement | **[Décision de Flo]** |
| D16 | Suppléant, conseil juridique, adresse de signalement de vulnérabilités | Violation, droits | **[Décision de Flo]** |

## 10. Décision de lancement

| | |
|---|---|
| Sections 1 à 4 complètes | [ ] |
| Recette signée | [ ] |
| Décisions de la section 9 tranchées | [ ] |
| Décision | Lancement autorisé · Lancement reporté |
| Date et signature | Flo · ____ |
