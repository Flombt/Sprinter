# Accueil « Courir » — harmonisation ciblée

Livraison du 1er novembre 2026. Intervention limitée à `src/screens/Home.tsx` et à son composant `Hero` dans `src/ui/components.tsx`. Le design system, les autres composants partagés, la navigation et les moteurs restent conservés. L’écran de course en direct n’a pas été modifié.

## Hiérarchie retenue

1. **Repère quotidien** : marque compacte et date locale, à la place du sous-titre promotionnel et du badge RUN CLUB.
2. **Coach et action principale** : hero lime plus court, titre de 32 points au lieu du slogan de 44 points sur deux lignes, description concise et bouton de départ. Suppression du minimum de hauteur de 300 points ; la hauteur suit le contenu et Dynamic Type.
3. **Semaine en un regard** : dates de la semaine, kilomètres au premier plan, temps actif, nombre de sorties et nombre de jours avec sortie. Le graphique représente les kilomètres quotidiens réellement enregistrés.
4. **Progression et calendrier** : une ligne de navigation explicite, accompagnée de « Vos objectifs, vos records et vos prochaines séances », vers la page de progression existante.
5. **Dernière sortie** : ligne d’activité du design system et accès « Tout voir » quand une sortie terminée est disponible.

La piste décorative et la palette lime sont conservées, avec une illustration réduite à un coin du hero. Les boutons, cartes, libellés, métriques, espacements et contrastes réutilisent le socle existant. Aucun nouveau visuel externe, branding, service ou écran n’est ajouté.

## États et actions

| Situation | Présentation |
| --- | --- |
| Prêt à partir | « À votre rythme. », rappel du coach et « Commencer une course ». L’action ouvre toujours la préparation existante. |
| Course en cours | Titre contextuel, distance et temps actif réels, puis « Retrouver ma course ». |
| Pause manuelle ou automatique | État de pause explicite dans le hero ; même accès aux commandes existantes. |
| Course récupérée | Mention de la récupération en pause et résumé des données restaurées. Ouvrir la course ne la reprend pas automatiquement. |
| Première utilisation | Compteurs de semaine issus de l’historique vide et invitation courte à enregistrer la première sortie. Pas de second grand bloc vide sous le hero. |
| Historique présent, semaine vide | Compteurs de semaine à zéro, texte sobre ; la dernière sortie reste accessible. |
| Objectifs hebdomadaires configurés | Progression en distance et/ou fréquence, calculée à partir des objectifs locaux existants. Aucun objectif arbitraire si rien n’est configuré. |
| Activités illisibles | Accès à l’historique avec le nombre d’activités conservées mais indisponibles. Le bilan utilise les activités lisibles. |

L’ancienne carte « course en cours » répétait l’action du hero : ses informations sont désormais intégrées dans ce dernier. L’accès à la course reste unique et prioritaire. Les handlers `onStart`, `onProgression`, `onHistory` et `onDetail` restent ceux fournis par l’application.

## Données et lisibilité

- Les agrégations réutilisent `aggregate` et les dates du module de progression, du lundi au dimanche dans le calendrier local. Seules les activités terminées admissibles entrent dans le bilan ; la course active y apparaît après son enregistrement.
- Le total présenté est le **temps actif**. Aucune allure, performance ou distance d’exemple n’est ajoutée.
- Le graphique distingue aujourd’hui, jours terminés et jours à venir. Les jours futurs restent sans barre ; une semaine sans sortie remplace le graphique vide par un message court.
- Les objectifs viennent de la progression locale, en lecture seule sur cet écran. Leur chargement facultatif ne conditionne pas le départ. Les barres plafonnent à 100 % et l’état « atteint » dépend du compteur réel, pas d’un arrondi d’affichage.
- Les calculs de semaine sont mémorisés : actualisation lors d’un changement d’historique ou via l’horloge locale partagée. Une activité fraîchement enregistrée n’attend pas le rafraîchissement de minute pour apparaître.
- Les métriques passent en colonne avec le texte agrandi ; le graphique peut défiler horizontalement. Les jours ont un libellé accessible complet avec date, distance et nombre de sorties ; les objectifs exposent leur progression.

## Vérifications effectuées

Les compilations sous Windows ont réussi : `npm run typecheck`, `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`, `npm run export:ios` (1 251 modules, environ 3,5 Mo Hermes) et `npx expo export --platform web --output-dir web-build` (environ 1,4 Mo). L’export iOS reste un bundle JavaScript, pas un IPA signé.

Les empreintes SHA-256 de `src/screens/Live.tsx`, `src/core/engine.ts`, `src/services/session.ts` et `App.tsx` sont identiques avant et après cette intervention. Cette vérification de périmètre ne constitue pas une validation fonctionnelle.

**Aucun test créé, modifié ou exécuté**, aucun parcours simulé, scénario de course, compte ou donnée de démonstration. L’aperçu navigateur local est désactivé dans l’environnement ; aucun rendu navigateur ou iPhone n’est déclaré vérifié. Restent à examiner sur appareil : densité réelle du hero, lisibilité au premier coup d’œil, petites largeurs, grands caractères, défilement du graphique, VoiceOver et états de reprise d’une course.

Les instructions RTK reçues en cours d’intervention ont été lues. `rtk --version` a signalé que l’exécutable n’était pas accessible dans le PATH. Les compilations étaient déjà réalisées ; la finalisation documentaire a utilisé l’outil d’édition de fichiers sans nouvelles commandes shell.
