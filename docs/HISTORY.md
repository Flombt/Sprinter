# Onglet « Sorties » — historique et analyse

Livraison du **2 novembre 2026**. Intervention sur `src/screens/History.tsx` et ajout d’une variante facultative `detailed` à `src/ui/RunRow.tsx`. Les données existantes, les calculs et les destinations de navigation sont conservés.

## Organisation de l’écran

1. **Vos sorties · Historique & analyse** : titre et accès rapide à la préparation d’une course, ou à la course en cours.
2. **Cumul enregistré** : distance, temps actif et nombre de sorties disponibles, dans une carte compacte utilisant le moteur d’agrégation existant.
3. **Dernières sorties** : jusqu’à trois activités réelles, classées de la plus récente à la plus ancienne.
4. **Analyser & progresser** : records personnels, comparaison et progression/calendrier réunis dans une liste d’actions avec descriptions. Leurs destinations existantes sont inchangées.
5. **Sorties précédentes** : activités restantes regroupées par mois et année, avec affichage progressif par lots de vingt activités au total, dernières sorties comprises.

Les trois grands boutons placés auparavant au-dessus de l’historique sont remplacés par des lignes contextualisées après les dernières activités. Aucune vignette de parcours fictive, performance d’exemple ou donnée de record inventée n’est ajoutée.

## États et lignes d’activité

| Situation | Présentation |
| --- | --- |
| Historique vide | Carte sobre expliquant les données disponibles après une course et CTA « Commencer une course » vers la préparation existante. |
| Course non terminée | CTA « Retrouver ma course ». L’ouverture du suivi ne déclenche pas de reprise automatique. |
| Une seule sortie | Dernière activité mise en avant ; comparaison désactivée avec la mention « Deux sorties minimum ». |
| Plusieurs sorties | Cumul, dernières activités, outils d’analyse et archives mensuelles. La comparaison conserve les exigences de distance et de qualité de son écran existant. |
| Activités illisibles | Nombre d’activités indisponibles signalé, sans suppression ni remplacement. Les activités lisibles restent accessibles. |
| Activité non admissible au cumul | Ligne conservée et consultable ; indication que certaines activités ne participent pas au cumul calculé. |
| Historique volumineux | Vingt lignes affichées initialement, puis bouton secondaire indiquant le nombre de sorties supplémentaires à afficher et compteur visible/total. |

Les lignes détaillées montrent **distance, date et heure, temps actif, allure moyenne**, ainsi que le nom/résultat de séance et la provenance Santé lorsque ces informations existent. L’allure indisponible reste un tiret ; son absence est annoncée explicitement dans le libellé accessible. Une date inutilisable reçoit un libellé de repli.

La variante détaillée est activée uniquement dans « Sorties ». Le rendu compact utilisé par l’accueil reste celui du design system. Les cartes, couleurs, espacements, rayons, textes, zones tactiles et dispositions pour texte agrandi réutilisent le socle existant.

## Préservation des données et des calculs

- Le tri et les regroupements portent sur une copie de l’historique ; aucun enregistrement n’est modifié ou filtré hors de la liste.
- Le cumul réutilise `aggregate`, avec ses critères existants. Le temps présenté est le temps actif. Les valeurs agrégées couvrent les activités admissibles de tout l’historique, indépendamment du nombre de lignes affichées.
- L’affichage progressif limite seulement les vues montées initialement : l’ensemble des activités lisibles reste accessible. Ce n’est pas une nouvelle pagination SQLite ni une synchronisation réseau ; son état est local à cet écran.
- Les calculs du cumul et du regroupement sont mémorisés ; les dates des lignes détaillées le sont également. Les records GPS ne sont pas recalculés automatiquement pour décorer le hub : leur moteur reste sollicité depuis l’écran réel de records.
- Les callbacks de détail, préparation/course, records, comparaison et progression sont conservés. Aucun nouveau stockage, modèle, export, écran de démonstration ou service externe.

Les empreintes de l’accueil, de l’écran de course en direct, des moteurs de records/comparaison/agrégation, du stockage, de la session et d’`App.tsx` sont identiques avant et après l’intervention.

## Vérifications et limites

Compilations réussies sous Windows via **RTK 0.44.2**, trouvé dans `C:/Users/mauba/.local/bin/rtk.exe` :

- TypeScript du projet (`npm run typecheck`).
- TypeScript avec `--noUnusedLocals --noUnusedParameters`.
- Export iOS Hermes : 1 251 modules, environ 3,5 Mo.
- Export web : environ 1,4 Mo.

**Aucun test créé, modifié ou exécuté**, conformément à la consigne. Aucun scénario de course, activité fictive ou accès réel à Santé/Spotify. Le navigateur local reste désactivé dans l’environnement ; aucun rendu d’interface ni validation physique n’est revendiqué. Les exports JavaScript ne produisent pas d’IPA signé.

Restent à examiner sur iPhone : lisibilité de l’état vide, rythme des sections, lignes avec noms longs et imports Santé, grands caractères/VoiceOver, activation des liens, comparaison à moins de deux sorties, affichage de lots supplémentaires et retour depuis une activité ancienne. La compilation et le contrôle du périmètre ne certifient pas à eux seuls l’absence de régression à l’usage.
