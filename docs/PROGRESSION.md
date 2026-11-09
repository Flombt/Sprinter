# Module 6 — progression et suivi sportif

## Analyse de l’existant

Avant modification, le projet possédait l’historique local, un récapitulatif hebdomadaire simple sur l’accueil, les analyses détaillées et les records GPS du Module 3. Les séances personnalisées étaient déjà des définitions versionnées interprétées par le moteur du Module 4. Il n’existait pas de calendrier, de plan de préparation, de journal de sensations, de suivi des chaussures ou d’objectifs hebdomadaires persistés.

Ces structures sont réutilisées. Les agrégations lisent les `RunRecord` terminés ; les records emploient `runRecords` et leurs critères existants. Les entraînements planifiés sont de véritables `WorkoutDefinition`, éditables et exécutables par le moteur existant. Aucune course, mesure GPS, performance ou sensation de démonstration n’a été ajoutée.

## Accès et parcours

Depuis **Courir** ou **Sorties**, ouvrir **Ma progression et mon calendrier** / **Progression et calendrier**. Cette section donne accès au tableau de bord, au calendrier, aux plans et aux chaussures. Le bilan de chaque course affiche automatiquement son commentaire calculé ; le journal est disponible en bas du détail de l’activité.

Pour organiser une séance : choisir une date dans le calendrier, ajouter un élément Course, sélectionner une copie de séance de la bibliothèque ou créer ses blocs, puis enregistrer. Le même éditeur de séance sert aux blocs planifiés. Appliquer les blocs ne suffit pas : l’enregistrement de la date confirme la copie dans le calendrier. Une séance peut être déplacée, modifiée, dupliquée, supprimée, marquée non réalisée ou préparée pour la course. Les modifications sont enregistrées avant le lancement depuis le calendrier.

La préparation affiche la date et la séance choisies ainsi que les chaussures. Ces identifiants sont figés dans la nouvelle activité au départ et conservés dans ses checkpoints. Le choix de calendrier peut être retiré pour courir librement. Une séance déjà associée ne démarre pas une seconde activité avec le même lien : la dupliquer ou dissocier l’ancienne association. Une activité en cours bloque un nouveau départ.

## Agrégations et comparaisons

- Kilomètres, temps actif, nombre de sorties et nombre de jours de course pour la semaine et le mois courants, puis pour tout l’historique exploitable.
- Temps total enregistré, pauses comprises, distinct du temps actif. Les anciens totaux absents et les totaux estimés après récupération sont signalés ; une absence n’est pas remplacée par zéro.
- Moyenne d’allure pondérée : somme des temps actifs divisée par somme des distances enregistrées, jamais moyenne arithmétique des allures de sorties différentes.
- Comparaison de semaines ou de mois sélectionnés avec la période précédente. Pour une période en cours, la précédente est limitée au même avancement calendaire et à sa fin si elle est plus courte ; pour une période passée, comparaison des périodes complètes. Les mois peuvent avoir des longueurs différentes.
- Comparaison des meilleurs segments sur la même distance standard dans chaque période, avec temps indisponible si aucune mesure n’est qualifiée. L’allure moyenne de sorties de distances ou d’efforts différents n’est pas présentée comme la preuve d’une progression chronométrique.

Les semaines vont du lundi au dimanche. Les dates suivent le fuseau local courant de l’appareil ; une course entière appartient à son jour de départ, y compris lorsqu’elle traverse minuit. Les limites sont des débuts de jours locaux et les décalages calendaires ne supposent pas que chaque journée dure 24 heures. Une activité située dans le futur n’alimente pas les compteurs à la date courante. Changer de fuseau peut changer le regroupement des activités proches de minuit ; les dates planifiées, stockées comme jours civils, restent celles saisies.

La distance est celle effectivement enregistrée, parfois partielle après une perte GPS. Elle n’est pas extrapolée. Les durées et dates incohérentes sont exclues des agrégations de progression, sans supprimer l’activité source.

## Records et bilan automatique

L’historique des records conserve la succession des nouvelles meilleures marques sur 1 km, 5 km, 10 km, semi-marathon et marathon. Le moteur réutilisé qualifie uniquement des segments continus avec précision horizontale ≤ 15 m, observations espacées d’au plus 6 s et chronologie cohérente, sans pause ou extrapolation. Chaque événement porte la course source, la date de fin du segment, le temps et le gain par rapport à la meilleure marque précédente. Une égalité ne crée pas de record ; la première marque n’est pas appelée amélioration. Les records sont calculés progressivement, une activité à la fois, avec réutilisation du cache existant.

La comparaison par période classe les performances selon la période de départ de la course. La chronologie des records utilise les dates des segments mesurés. L’historique est dérivé des activités encore disponibles : une suppression peut retirer une marque et changer les gains ultérieurs. Il s’agit de records GPS parmi les activités exploitables, pas de chronos de compétition homologués.

Le bilan automatique s’affiche dans le détail dès la fin de course et reste consultable ensuite. Il combine le pourcentage en cible et sa durée fiable avec les nouvelles marques ou améliorations de cette activité. Les gains sont annoncés seulement après le calcul complet de l’historique, par rapport aux marques antérieures, sans comparer une ancienne course à un record acquis plus tard. Les secondes affichées sont arrondies ; un très petit gain est indiqué comme inférieur à une seconde. Les mesures manquantes restent indisponibles. Aucun texte d’IA externe ni prédiction de résultat n’est utilisé.

## Objectifs et régularité

Un objectif est attaché à une semaine précise et peut viser des kilomètres, un nombre de sorties, ou les deux. Il est modifiable et supprimable. La progression utilise seulement les activités terminées ; les distances prévues au calendrier ne comptent pas. Deux sorties le même jour comptent deux sorties, tandis que le nombre de jours actifs compte ce jour une seule fois. Une semaine sans objectif n’est pas traitée comme un échec.

La régularité observe au maximum les douze semaines terminées précédentes, plus la partie courante pour la fréquence et les jours. La fenêtre ne commence pas avant la première activité disponible. Le pourcentage hebdomadaire compte les semaines terminées observées contenant au moins une sortie, avec les semaines à zéro conservées ; la première semaine connue peut être partielle. La fréquence est le nombre de sorties ramené à sept jours calendaires observés. La série de semaines actives peut se prolonger depuis la semaine précédente si la semaine en cours est encore vide. Il n’y a pas d’incitation à courir tous les jours.

Les jours sans course enregistrée sont indiqués comme tels, sans certifier un repos physique. Un repos prévu et une course le même jour restent visibles côte à côte. Les séances passées sans association sont marquées manquées uniquement après la fin de leur date locale ; aujourd’hui reste planifié. Les éléments explicitement marqués non réalisés sont décomptés séparément.

## Calendrier et associations

Une date de planning reste distincte de la date de l’activité réelle. Déplacer un élément ne réécrit ni la date GPS, ni les objectifs de la course, ni son volume statistique. La copie de séance du calendrier reste indépendante de la bibliothèque ; la sortie démarrée reçoit ensuite sa propre copie figée.

Les associations sont automatiques pour un départ depuis le planning, ou explicites depuis une sortie enregistrée. Une activité ne peut pas être affectée automatiquement à une autre date au seul motif qu’elle ressemble à la séance prévue. Une séance partielle ou dont les blocs diffèrent de ceux attendus est signalée comme telle. « Activité réalisée » signifie association avec une course enregistrée ; cela ne transforme pas un défi perdu en défi réussi.

La dissociation est persistante et ne se rétablit pas au redémarrage à cause d’un ancien identifiant de planning dans la course. Supprimer un élément conserve ses activités. Supprimer une course conserve un état de source supprimée dans l’élément déjà associé, plutôt que d’inventer une réalisation. Retirer un plan conserve ses éléments déjà associés, y compris leurs références indisponibles, et retire ses éléments non réalisés. Les dates et associations sont enregistrées atomiquement avec le reste de l’état de progression.

## Plans 5 km, 10 km et semi

Les trois structures proposent respectivement six, huit et douze semaines par défaut, toutes modifiables de quatre à vingt-quatre semaines. L’utilisateur choisit deux à quatre jours hebdomadaires, le volume initial, un plafond par sortie et une progression linéaire facultative. La progression initiale est zéro. Lorsque des courses récentes existent, volume et plafond sont préremplis à partir des 28 jours calendaires, à confirmer par l’utilisateur ; sans données, ils doivent être saisis.

Toutes les allures sont libres au départ. Les sorties utilisent des blocs de distance du moteur existant, avec la possibilité de les remplacer ou de les éditer dans le calendrier. La dernière journée de course choisie reçoit une part initiale de 40 %, 45 % ou 50 % du volume selon le plan ; le reste est réparti entre les autres sorties. Le plafond peut redistribuer ces parts. Une semaine demandant plus que le nombre de sorties multiplié par le plafond est refusée avant sauvegarde. Les distances sont arrondies au mètre inférieur pour respecter ce plafond.

Ces plans sont des structures d’organisation personnalisables, pas une évaluation de capacité future. Ils ne forcent ni allure rapide ni course de la distance finale à une date fixée. Aucun chrono futur, probabilité de réussite ou promesse de résultat n’est calculé. Les jours non choisis sont inscrits comme repos prévu ; les chevauchements avec un planning déjà existant restent visibles et ajustables dans le calendrier. Une prévisualisation précède l’ajout, enregistré en une seule écriture.

## Journal et chaussures

Le journal facultatif comprend sensations, difficulté ressentie de 1 à 10, notes et attribution des chaussures. Une valeur non renseignée reste vide, distincte de zéro. Il peut être complété ou modifié dans une ancienne activité.

Chaque paire conserve son nom, un kilométrage initial déclaré et un état actif/archivé. Le total affiche séparément la distance déclarée avant Sprinter et la somme des distances des activités attribuées. Le choix par défaut ne s’applique qu’aux nouveaux départs. Une ancienne attribution peut être changée dans le journal ; une activité supprimée n’ajoute plus de kilomètres. Archiver une paire conserve son historique et retire son choix par défaut. Aucun seuil universel de remplacement n’est imposé.

## Persistance et architecture

`src/progression/` sépare dates, agrégations, chronologie des records, génération de plans, stockage et écrans fonctionnels. Les calculs n’appellent aucun serveur. Le moteur sportif et les analyses existants gardent leurs responsabilités.

Le module utilise une base SQLite séparée, `sprinter-progression-v1.db`, avec enveloppe version 1 et écriture atomique de l’état de progression. Les modifications sont sérialisées et publiées après réussite du stockage ; un plan et toutes ses dates ne peuvent pas être ajoutés partiellement. Le repli web est localStorage. Une version inconnue ou des données illisibles ne sont pas remplacées par un état vide sauvegardé : l’erreur est signalée et les données restent conservées.

Le schéma de courses existant reste inchangé. Les champs facultatifs `RunRecord.plannedEntryId` et `shoeId` accompagnent les nouvelles activités dans le JSON version 3 et le journal de checkpoint. Les anciennes activités n’acquièrent pas une chaussure, une sensation ou une date planifiée inventée. Les annotations restent séparées des observations GPS et permettent des corrections sans réécrire les parcours.

Une réconciliation au lancement et après enregistrement retrouve les associations depuis les activités conservées. Si le processus s’arrête après la sauvegarde d’une course mais avant la mise à jour du calendrier, le lien est retrouvable au prochain chargement. Une erreur du stockage de progression n’empêche pas le stockage des données sportives.

## Vérifications du 1er novembre 2026

Conformément à **« NE FAIS PAS DE TEST »**, aucun test n’a été créé, modifié ou exécuté. Aucun parcours, calendrier ou résultat simulé, essai manuel d’interface ou essai sur iPhone n’a été exécuté. Les tests historiques des modules antérieurs n’ont pas été relancés et ne valident pas ces calculs.

Les seules vérifications exécutées sont la compilation TypeScript (`npm run typecheck`) et le bundle iOS Hermes (`npm run export:ios`) sous Windows, réussis : 1 056 modules et environ 2,9 Mo. Aucun build Xcode ni IPA signé. La compilation ne valide pas l’exactitude des agrégations ou les interactions sur iPhone.

Restent à vérifier sur iPhone : limites de semaine/mois et changement de fuseau, association/dissociation et déplacement des dates, reprise après arrêt du processus, enregistrement/suppression des objectifs, édition et lancement des blocs planifiés, plan complet, journal persistant et recalcul des kilomètres de chaussures, ainsi que la chronologie des records et les bilans sur de véritables courses connues.
