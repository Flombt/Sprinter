# Finition visuelle — 2 novembre 2026

La finition s’appuie sur le design system existant : identité claire/lime, thèmes sémantiques, composants natifs et données réelles. Les Réglages ont été harmonisés en amont ; voir [SETTINGS_UI.md](SETTINGS_UI.md).

## Changements

- Retours d’appui et états désactivés centralisés dans `interaction`, utilisés par boutons, boutons d’icône, sélecteurs, listes, panneaux de réglages, commandes musicales et actions de séances. L’échelle d’appui est plus discrète ; elle est réinitialisée si un bouton devient désactivé.
- Transition d’entrée de 160 ms pour les écrans partagés : léger fondu de 94 à 100 %, sans masque, blocage des commandes ou changement de routage. Aucun rejeu sur les mises à jour de distance ou de chronomètre. Animation native arrêtée au démontage et désactivée avec Réduire les animations.
- Préférences d’accessibilité initialisées sans animation ni transparence, puis ajustées après lecture des réglages système. Réduire la transparence conserve une navigation opaque ; les matières restent limitées à la barre basse, avec variante claire/sombre. Aucune nouvelle couche de verre sur les données sportives.
- Marges latérales communes tenant compte des zones sûres, largeur de navigation cohérente avec le contenu et onglet sélectionné rendu visible dans la barre défilante en grands caractères.
- Préparation : allure empilée sur petit écran ou grands caractères, chiffres réutilisables et titre harmonisé. Actions et limites numériques inchangées.
- Course : statut pouvant revenir à la ligne, réduction des libellés accessoires avec grands caractères, espacements et séparateurs communs. Pause, reprise, GPS et chronométrage inchangés.
- Détail : distance avec rôle typographique partagé et lecture horizontale en grands caractères ; pourcentage présenté comme métrique plutôt que coincé dans un anneau de taille fixe avec Dynamic Type. Les mêmes valeurs calculées sont conservées.

## Vérification

Compilation TypeScript finale avec `--noUnusedLocals --noUnusedParameters` et exports iOS/web réussis. Une incompatibilité de type de référence `ScrollView` a été détectée puis corrigée avec le type d’instance du SDK installé. Les résultats sont consignés dans [VALIDATION.md](VALIDATION.md).

Empreintes inchangées des moteurs de course/coaching, stockage des séances, configuration métier, localisation, arrière-plan, sorties audio, store Spotify, écrans Apple/Outils et `App.tsx`. Aucun schéma, dépendance ou fonctionnalité ajouté.

**Aucun test créé, modifié ou exécuté.** Aucun rendu visuel ni essai fonctionnel sur iPhone ou navigateur effectué, conformément à la demande. Les tailles d’écran, les thèmes et l’accessibilité ont été examinés dans le code : seuil compact inférieur à 375 points, adaptation aux grands caractères à partir de 1,3, textes sans plafonnement de taille, éléments interactifs d’au moins 44 points et états nommés.

Restent à examiner sur iPhone : dispositions compactes et larges, clair/sombre, tailles de texte, VoiceOver, réduction des animations/transparences, rendu réel des matières, fluidité des transitions et commandes de course. Ces vérifications ne sont pas déclarées réussies ; les exports ne prouvent pas une conformité App Store ou l’absence de régression.
