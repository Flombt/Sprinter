# Découvrir Nice et Côte d’Azur

[Carte documentaire](../00-INDEX.md) · [Preuves de validation](../quality/validation.md)

L’onglet Découvrir se trouve à côté de Courir, Stats et Spotify. Courir s’ouvre à la connexion. Le catalogue embarqué s’affiche dès la restauration du compte et fonctionne avec la dernière réponse conservée lorsque le réseau est indisponible.

## Utilisation

- **Explorer** met en avant une course datée, puis propose l’agenda, les clubs et les spots. La loupe cherche dans toutes les catégories. Le bouton Filtres permet de choisir le secteur, le rayon, la distance, le terrain, le prix vérifié, l’accès PMR documenté et les inscriptions ouvertes confirmées.
- **Agenda** filtre les rendez-vous en heure de Paris par jour, week-end, 7 jours, 30 jours ou dates choisies. Les annonces sans jour confirmé apparaissent à part. Une course sort des résultats futurs à sa fin publiée ou, sans heure de fin, à la fin du dernier jour confirmé.
- **Carte** regroupe les repères du cadre visible. La liste sous la carte donne accès aux fiches du groupe ou de la zone recherchée. Les contours IGN / Etalab prennent le relais sur le web, hors ligne et sur Android sans fournisseur configuré. Les distances par commune peuvent utiliser un centre approximatif pour le filtre. Les repères exigent des coordonnées documentées.
- **Clubs** présente les adresses et canaux officiels. Les créneaux habituels sont décrits sur la fiche du club. Une séance ponctuelle entre dans l’agenda après vérification de sa date.
- **Parcours** réunit sentiers, pistes et lieux. Les directions ouvrent Apple Plans ou Google Maps à la destination publique. Un tracé validé et redistribuable ouvre la carte GPX et peut être enregistré dans la bibliothèque de Sprinter.
- **Favoris et objectifs** conserve les fiches et les choix de distance dans le stockage local du compte. La fiche donne accès au site officiel, au partage du lien et à l’export `.ics` vers un calendrier. Les objectifs sont des entrées de Découvrir. Le plan utilise le générateur existant pour 5 km, 10 km et semi-marathon lorsque quatre semaines au moins restent disponibles. Les autres formats ouvrent la préparation manuelle. Un plan confirmé peut porter l’identifiant et le jour de l’épreuve dans les documents de progression, selon les réglages de synchronisation existants.

Les favoris et filtres sont isolés par compte et supprimés avec le compte sur l’appareil qui réalise la suppression. La position précise est demandée via « Autour de moi » et reste en mémoire. Le cadrage cartographique utilise une position arrondie. Lors d’une course et pendant ses pauses, les lectures réseau du catalogue sont suspendues. Les pages et favoris locaux restent consultables en pause manuelle.

## Catalogue vérifié le 15 novembre 2026

| Domaine | Contenu et provenance |
|---|---|
| Courses datées | Urban Trail de Vence, Mounta Cala, Course de Noël du Cap-Ferrat, Prom’Classic et Marathon Nice–Cannes. Les sources sont les organisateurs, la mairie ou l’Office de tourisme. |
| Date partielle | Semi-Marathon International de Nice, annoncé en avril 2027. |
| Sortie confirmée | Breakfast Run, le 9 janvier 2027, publiée dans le programme officiel de la Prom’Classic. |
| Clubs | Nice Côte d’Azur Athlétisme, Runfest Run Club et ASPTT Nice Côte d’Azur. |
| Lieux et parcours | Promenade des Anglais, plateau sportif Vauban, parc des sports Charles Ehrmann et sentier du canal de Gairaut. |

Les fiches, liens, dates de vérification et renseignements d’accès sont versionnés dans [catalogue.json](../../src/discovery/catalogue.json). Les statuts d’inscription et prix d’événements expirent après sept jours sans revérification. Les tarifs permanents sont présentés pendant 90 jours après vérification. La carte de Gairaut indique le départ et la distance annoncée par l’Office. La fourniture d’un GPX de ce sentier dépend d’une géométrie dont la redistribution est autorisée.

### Médias et carte

Les photos WebP sont redimensionnées. Sprinter crédite les photographes et la licence sur la fiche. Les visuels situent les lieux et les communes. Les cartes sans photo utilisent les illustrations géométriques de Sprinter.

| Média | Attribution et preuve |
|---|---|
| Promenade des Anglais | Uhooep, CC BY-SA 4.0. [Fichier original et licence](https://commons.wikimedia.org/wiki/File:Promenade_des_Anglais_(Nice),_France.jpg) |
| Port de la Santé à Villefranche-sur-Mer | JChevall, CC BY-SA 4.0. [Fichier original et licence](https://commons.wikimedia.org/wiki/File:Vue_g%C3%A9n%C3%A9rale_de_Villefranche_sur_Mer.jpg) |
| Cascade près du sentier de Gairaut | Kheper, CC BY-SA 3.0. [Fichier original et licence](https://commons.wikimedia.org/wiki/File:Cascade_de_Gairaut_vue_d%27ensemble.jpg) |
| Vence | Myrabella, CC BY-SA 3.0. [Fichier original et licence](https://commons.wikimedia.org/wiki/File:Vence.jpg) |
| Fond cartographique simplifié | IGN ADMIN EXPRESS via API Découpage administratif, Licence Ouverte 2.0. [Contours administratifs](https://www.data.gouv.fr/datasets/contours-administratifs) |

## Lecture et actualisation

[0021_discovery.sql](../../supabase/migrations/0021_discovery.sql) conserve fiches, révisions, candidats et journaux dans le schéma privé. `GET /rest/v1/rpc/discovery_feed_v1` reçoit `p_market=nice` et, pour la page suivante, `p_after` et `p_revision`. La RPC vérifie la session du compte. Une réponse contient jusqu’à 20 fiches ou marqueurs de retrait, un curseur et une révision cohérente. L’application filtre l’ensemble localement et conserve la dernière révision complète. Un échec réseau, une version invalide ou un changement de révision en cours de lecture laisse le cache disponible.

L’[adaptateur Apidae](../../supabase/functions/_shared/discovery-apidae.ts) résout l’export JSON métropolitain à partir des métadonnées data.gouv.fr et exige la Licence Ouverte 2.0. Il importe les occurrences plausibles de course en file de revue. Il interprète les horaires en `Europe/Paris`. Une heure ambiguë exige une preuve avec décalage horaire. La file contient les champs publics utiles et les occurrences confirmées par une date dans la source.

Le sondage réel du **15 novembre 2026** a reçu la ressource `4d57cbed-521f-44be-a2e4-da313cddd089`, format Apidae `v002`. Le serveur indiquait une modification le 14 novembre à 06 h 00, heure de Paris. Le fichier fournit une seule tranche de **200 objets sur 412 déclarés**, avec **0 course candidate** dans cette tranche. L’import journalise cette couverture partielle et les fiches existantes restent disponibles.

L’Edge Function [discovery-import](../../supabase/functions/discovery-import/index.ts) accepte un `POST` avec `x-cron-secret` et utilise le secret serveur `CRON_SECRET`. Le bail SQL, le délai minimum entre deux appels, l’ETag, `Last-Modified` et l’empreinte SHA-256 protègent les reprises. Après un changement significatif, le candidat revient en revue. Les erreurs de source laissent le dernier checkpoint valide et la file de revue disponibles. Les rapprochements affichent les fiches du même jour et de la même commune. En cas de doublon, le propriétaire rattache la source à l’identifiant existant.

## Démarrage et modération

Pour consulter le catalogue de secours, configurer le compte Supabase comme indiqué dans [Exploitation](../backend/exploitation.md), lancer `npm start`, se connecter et ouvrir **Découvrir**. Expo Go peut utiliser le catalogue et la carte compatible avec l’appareil.

Vérifier le contenu et la source depuis la racine du dépôt.

```sh
npx deno run --allow-read=src/discovery/catalogue.json supabase/functions/tools/discovery.ts preview
npx deno run --allow-net=www.data.gouv.fr,opendata.nicecotedazur.org supabase/functions/tools/discovery.ts probe
```

Pour un environnement de développement isolé, démarrer Supabase avec `supabase start`, appliquer `supabase migration up --local`, puis alimenter le catalogue et servir `discovery-import` avec un `CRON_SECRET` local. Par défaut, l’outil vise `http://127.0.0.1:54321`. Définir les variables dans l’environnement du terminal, à partir du projet choisi.

```sh
npx deno run --allow-env --allow-net=127.0.0.1:54321 --allow-read=src/discovery/catalogue.json supabase/functions/tools/discovery.ts seed
npx deno run --allow-env --allow-net=127.0.0.1:54321 supabase/functions/tools/discovery.ts trigger
```

`seed` utilise `SUPABASE_SERVICE_ROLE_KEY` et insère seulement les nouvelles fiches. `trigger` transmet `CRON_SECRET`. La lecture de la file et les décisions d’édition passent par le JWT d’un `owner` avec MFA (`DISCOVERY_EDITOR_JWT`) et la clé publique `SUPABASE_ANON_KEY`. Les écritures exigent une réauthentification récente. Les révisions, motifs et décisions sont auditables.

1. Examiner `queue [ID_FICHE] [CURSEUR]` pour retrouver les dernières tentatives, les candidats et les révisions.
2. Confirmer le programme et le lien sur la source. Prévisualiser un fichier JSON validé par `preview FICHIER`. Pour une image, vérifier les droits de redistribution et l’attribution. Pour un tracé, vérifier la continuité et le droit de redistribution.
3. Appliquer `write FICHIER ÉTAT RÉVISION MOTIF` à la révision affichée par la file. Utiliser `0` pour une nouvelle fiche. `archived` retire la fiche des résultats. `cancelled` et `postponed` conservent le statut dans les favoris. Documenter séparément l’heure annoncée et les éléments à confirmer.
4. Relier ou rejeter le candidat avec `review ID_EXTERNE accepted|rejected UPDATED_AT FICHE_OU_TIRET MOTIF`. En cas de conflit, relire la file avant de décider.

L’activation de l’actualisation sur un projet partagé nécessite l’application de la migration, l’initialisation éditoriale, le déploiement de la fonction et la configuration d’un appel quotidien. La livraison actuelle utilise la ligne de commande pour modérer. Les notifications, les inscriptions déclarées et le portail organisateur sont prévus après le pilote. Les prochaines occurrences confirmées des clubs et les nouveaux médias dépendent des sources et partenaires.
