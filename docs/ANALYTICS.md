# Module 3 — statistiques et historique sportif

Livraison du 1er novembre 2026, développée sous Windows pour l’application iPhone Expo existante. Aucun parcours de démonstration ni activité artificielle n’a été ajouté. Le moteur d’analyse utilise uniquement les compteurs, points GPS et journaux réellement enregistrés.

## État du projet avant modification

L’application disposait déjà d’un historique local, d’un bilan, d’une carte Apple sur iPhone via `react-native-maps`, d’un graphique d’allure et de temps intermédiaires. Le moteur de course enregistrait la distance filtrée, l’allure stabilisée, les temps actif et total, les segments de parcours, les mesures verticales et, depuis le Module 2, le journal du coach. Les séances structurées possédaient leurs propres résultats et records par configuration.

Le stockage mobile repose sur SQLite : activités terminées dans `runs.payload`, checkpoint dans `draft`, points ajoutés progressivement dans `draft_points`. Le schéma SQL est en version 2. L’aperçu web emploie son adaptateur localStorage ; il ne remplace pas le stockage iPhone.

Il manquait une analyse commune indépendante des écrans, des records sur distances standard, une comparaison à distance réellement identique et un export du parcours. Ces fonctions ont été ajoutées sans remplacer le moteur de suivi, les séances ni la navigation principale.

## Organisation

| Fichier ou répertoire | Responsabilité |
| --- | --- |
| `src/analysis/types.ts` | Résultats d’analyse et provenance des mesures |
| `src/analysis/track.ts` | Qualification des positions, continuité, allure et altitude fiables |
| `src/analysis/distanceTime.ts` | Franchissements de distance et temps intermédiaires |
| `src/analysis/summary.ts` | Séries d’allure, vitesse, altitude, statistiques et écarts |
| `src/analysis/records.ts` | Meilleurs segments et records personnels |
| `src/analysis/compare.ts` | Comparaison sur une distance commune effectivement parcourue |
| `src/analysis/export/` | Contrat des exporteurs et encodeur GPX indépendant des fichiers natifs |
| `src/services/activityExport.ts` | Écriture locale et feuille de partage native |
| `src/screens/PersonalRecords.tsx`, `Comparison.tsx` | Consultation des records et comparaison |
| `src/storage/migrations.ts` | Migration de l’enveloppe des activités |

Les calculs sportifs purs n’importent ni React Native, ni MapKit, ni le système de fichiers. Les interfaces consomment leurs résultats. Les analyses complètes sont mises en cache pour six activités au maximum ; les petits résultats de records utilisent un cache faible distinct. L’écran des records traite une activité à la fois en rendant la main entre les activités et annule le travail lorsqu’il est quitté.

## Mesures et continuité

Les coordonnées restent dans leur ordre enregistré. Les positions invalides, précisions insuffisantes, horloges incohérentes et déplacements physiquement incompatibles rompent la continuité. Une perte GPS, une récupération ou une interruption ancienne de cause inconnue ne sont jamais reliées pour fabriquer une performance. Les graphiques et la carte conservent ces coupures.

Les nouveaux points conservent trois informations supplémentaires : la qualité du signal, la raison de reprise de la trace et le début de l’intervalle de distance acquis par le filtre. Ce dernier évite de prendre pour une accélération instantanée la distance accumulée puis libérée pendant l’acquisition GPS. Lorsque l’origine est documentée, les points intermédiaires du plateau horizontal sont ramenés à cette origine pour les calculs de distance. Les observations originales restent disponibles pour les séries d’allure et d’altitude. Les anciens points sans ces informations sont traités prudemment, sans leur attribuer une précision ou une raison d’interruption inventée.

Une pause explicitement identifiée peut conserver la comparabilité du temps actif, à condition qu’aucune distance ne soit ajoutée sur le déplacement absent. Les records ne traversent aucune pause. Une perte GPS suivie d’une pause reste une perte GPS ; elle n’est pas requalifiée en simple pause.

## Statistiques du bilan

- **Temps actif** : durée comptée hors pauses. **Temps total** : durée comprenant les pauses, lorsqu’elle a été enregistrée. Un total estimé après récupération reste signalé et ne qualifie pas une comparaison de temps total.
- **Allure moyenne** : temps actif divisé par distance enregistrée, en s/km. La vitesse moyenne utilise les mêmes compteurs. Une distance partielle reste signalée ; la moyenne n’est pas présentée comme une estimation de la portion manquante.
- **Allures la plus rapide et la plus lente** : extrema des observations d’allure déjà stabilisées dont le signal est qualifié. Elles sont distinctes du meilleur segment sur une distance standard. Une allure en s/km plus faible correspond à une course plus rapide.
- **Graphiques** : allure fiable enregistrée ; vitesse en km/h dérivée de cette allure ; altitude seulement si les valeurs filtrées ont une précision verticale enregistrée d’au plus 8 m et des observations voisines cohérentes. Les points isolés et sauts verticaux sont exclus. L’axe horizontal est le temps actif. La réduction des points concerne uniquement le dessin et conserve les extrema ; les statistiques emploient les observations complètes.
- **Dénivelés** : priorité aux compteurs verticaux enregistrés avec leur couverture fiable ; sinon calcul prudent sur les altitudes qualifiées, sans cumuler le bruit à l’arrêt. L’absence de mesure reste indisponible, distincte d’un dénivelé nul mesuré.
- **Intermédiaires** : franchissements interpolés entre deux observations compatibles du même segment, par kilomètre, puis dernière portion partielle. Le premier kilomètre commence au départ de l’activité. Le tableau distingue actif et total ; une interruption empêche la qualification de l’allure de la portion. Sans parcours, les anciens compteurs peuvent être affichés comme archives, sans qualifier un record.

Le pourcentage en cible et les écarts utilisent en priorité le journal enregistré du coach. Pour une ancienne activité dépourvue de journal, une reconstruction est possible à partir des allures fiables et des cibles réellement enregistrées, y compris les cibles par kilomètre et les segments de séance. Cette provenance est indiquée. Les pauses, trous GPS et phases non fiables sont exclus. Lorsque seuls les anciens compteurs de temps en cible existent, le pourcentage reste accessible mais aucun nombre ou historique d’écarts n’est inventé. La durée couverte accompagne les statistiques. Le nombre, la durée cumulée, le plus long écart et les écarts confirmés sont distincts.

## Records personnels

Les distances sont 1 000 m, 5 000 m, 10 000 m, 21 097,5 m et 42 195 m. Le moteur recherche le meilleur segment de cette longueur dans chaque activité terminée, puis choisit le meilleur résultat de l’historique. Une performance peut se trouver à l’intérieur d’une sortie plus longue.

Les candidats utilisent des positions d’une précision horizontale d’au plus 15 m, espacées d’au plus six secondes entre observations, dans une portion continue sans pause, perte GPS, récupération ni saut d’horloge. Le chrono monotone enregistré est prioritaire ; à défaut, les timestamps GPS doivent être cohérents avec le temps actif. La durée retenue ne peut être inférieure au temps actif du segment.

La recherche examine les fenêtres dont le début ou la fin coïncide avec une observation, avec interpolation de l’autre borne à l’intérieur d’une liaison fiable. Cela permet de rechercher le minimum sur la courbe de distance enregistrée, sans limiter les records aux kilomètres entiers du départ. Aucune distance n’est extrapolée ni arrondie pour rendre une activité éligible : une sortie affichée à 5,00 km peut avoir moins de 5 000 m réellement enregistrés.

L’écran indique la date, la durée, l’allure et les bornes kilométriques du segment, avec accès à la course source. Un record indisponible reste vide. La suppression d’une course retire automatiquement ses candidatures au prochain calcul. Ce sont des meilleurs segments mesurés au GPS, pas des chronos de compétition homologués. Les anciens records de défis restent indépendants et conservés.

## Comparaison de deux sorties

Deux activités distinctes sont proposées si leurs distances diffèrent de 5 % au maximum, rapportés à la plus longue. La comparaison chronométrique s’arrête à la distance effectivement enregistrée de la plus courte, atteinte dans chacune des deux traces. Elle part du début de l’activité et utilise le premier franchissement de cette distance ; elle ne multiplie pas une allure moyenne pour inventer un temps équivalent.

Le parcours doit être exploitable sur tout ce préfixe ; une pause explicitement connue est admise mais une perte GPS ou une continuité inconnue empêche la qualification chronométrique. Les temps actif et total sont comparés séparément. Un écart B − A négatif signifie que B est plus rapide. Si la qualification échoue, les résumés enregistrés restent consultables côte à côte avec une explication, sans faux chrono comparable.

## GPX et futurs formats

Le bilan propose l’export d’une activité terminée possédant au moins deux positions exploitables. L’encodeur produit du GPX 1.1 : latitude/longitude des points retenus, heures UTC enregistrées, altitude qualifiée si disponible. Chaque portion continue possède son propre `trkseg` ; les pauses et pertes de réception ne sont pas reliées. Les plateaux stationnaires sont réduits à leurs bornes pour limiter la dérive exportée. Aucun point n’est créé pour remplir un trou.

Les extensions sous `urn:sprinter:activity:1` conservent distance cumulée, temps actif, temps total lorsqu’il existe, indication d’estimation du total et allure fiable. Une application tierce peut ignorer ces extensions et recalculer sa propre distance à partir des coordonnées ; son résultat peut différer de la distance filtrée de Sprinter. Les valeurs absentes sont omises, les noms sont échappés et le nom de fichier est nettoyé.

Sur iPhone, le service écrit le document dans le cache puis ouvre la feuille de partage, qui permet notamment l’enregistrement dans Fichiers. L’adaptateur web propose un téléchargement local. Le calcul et l’écriture ne demandent pas de serveur Sprinter. Les fonds de carte gardent leurs contraintes de disponibilité de tuiles.

Le contrat `ActivityExporter` accepte du texte ou des octets et sépare encodage, registre et destination. Un encodeur FIT pourra être enregistré ultérieurement sans modifier le moteur d’analyse. **L’export FIT n’est pas implémenté** et aucun bouton ne prétend le proposer.

Références utilisées pour l’implémentation : [spécification GPX 1.1](https://www.topografix.com/GPX/1/1/), [API Expo FileSystem](https://docs.expo.dev/versions/latest/sdk/filesystem/), [API Expo Sharing](https://docs.expo.dev/versions/latest/sdk/sharing/).

## Persistance et migration

Les activités portent maintenant `dataVersion: 3`. La lecture accepte les anciennes enveloppes sans version, les versions 1 et 2, et la version 3. La migration conserve les observations et ajoute seulement la version de l’enveloppe ; elle ne crée pas les métadonnées absentes des anciens points. Les nouvelles sauvegardes enregistrent la version 3 et les métadonnées disponibles.

Le schéma SQL reste en version 2 : les nouveaux champs sont contenus dans les documents JSON et ne demandent aucune nouvelle colonne. Le journal incrémental de points, les transactions de fin de course et la récupération restent utilisés. Les versions futures inconnues et données illisibles sont conservées dans le stockage et signalées par le mécanisme existant, sans suppression automatique. Les statistiques et records sont dérivés des activités ; aucune table de résultats susceptible de devenir périmée n’a été ajoutée.

## Vérifications réellement effectuées

Conformément à la dernière instruction explicite **« NE FAIS PAS DE TEST »**, aucun test n’a été créé, modifié ou exécuté pour ce module. Aucun parcours simulé, essai manuel d’interface, export partagé, import GPX ni essai sur iPhone n’a été effectué. Les tests du Module 1 sont historiques et n’ont pas été relancés ; ils ne valident pas les nouveaux calculs.

- `npm run typecheck` : compilation TypeScript réussie, sans émission.
- `npm run export:ios` : bundle iOS Hermes généré sous Windows, 1 035 modules, environ 2,8 Mo, dans `dist/`.

Ces compilations vérifient la construction du code, pas l’exactitude numérique ou le comportement natif. Aucune compilation Xcode, signature ni génération d’IPA n’a été réalisée.

Restent à vérifier sur un iPhone physique : affichage MapKit et coupures de trace avec de vraies activités, restauration des anciennes activités, cohérence des intermédiaires et records sur des parcours mesurés, consultation de longues sorties, comparaison incluant des pauses et pertes GPS, feuille de partage puis ouverture d’un GPX dans un lecteur externe. Ces vérifications sont documentées ici et n’ont pas été exécutées pendant cette livraison.
