# Recette · preparation

> **Recette manuelle NON EXÉCUTÉE.** Ne cocher qu’après observation sur le commit et le client consignés. Les attentes de la spécification historique ont été adaptées au compte obligatoire ; elles ne constituent pas une preuve de conformité.

[Campagne et fiche de résultat](README.md) · [État actuel](../../features/etat-fonctionnalites.md)

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
| P0.3 | Aucune table `public` sans RLS, aucune fonction `SECURITY DEFINER` exécutable par `anon` | Test automatique, requêtes A et B de [LANCEMENT](../../roadmap/lancement.md) | [ ] | |
| P0.4 | `npm run check`, `expo install --check`, export iOS et web verts et inchangés | CI `verify.yml` | [ ] | |
| P0.5 | Connexion obligatoire conservée avec flags cloud éteints ; course locale après connexion | Comparaison manuelle de l'ancienne et de la nouvelle version sur iPhone | [ ] | |
| P0.6 | [Reconnaissance historique](../../archive/audits/2026-11-14-reconnaissance-comptes.md) relue pour son contexte, écarts actuels pris en compte | Date de relecture | [ ] | |
