# Recette · administration

> **Recette manuelle NON EXÉCUTÉE.** Ne cocher qu’après observation sur le commit et le client consignés. Les attentes de la spécification historique ont été adaptées au compte obligatoire ; elles ne constituent pas une preuve de conformité.

[Campagne et fiche de résultat](README.md) · [État actuel](../../features/etat-fonctionnalites.md)

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
- **Attendu** : chaque donnée purgée à l'échéance et rien avant ([durées](../../rgpd/durees-conservation.md)), second passage sans effet.

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
