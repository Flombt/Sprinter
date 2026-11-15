# Recette · Studio avancé

> **Recette manuelle NON EXÉCUTÉE.** Ne cocher qu’après observation sur le commit et le client consignés. Les attentes de la spécification historique ont été adaptées au compte obligatoire ; elles ne constituent pas une preuve de conformité.

[Campagne et fiche de résultat](README.md) · [État actuel](../../features/etat-fonctionnalites.md)

### 8b · Studio avancé

#### R8b.01 · Édition, configurations et absence de publication

*Critère : « Prévisualisation immédiate, annulation et rétablissement, reprise d'un brouillon, retour au style par défaut et changement de configuration fonctionnent sur iOS et Android. Une configuration ne rend public aucun élément. »*

- **Préconditions** : `profile_studio_enabled = true` · profil privé avec un brouillon en cours.
- **Étapes** : modifier un élément et observer l'aperçu · annuler puis rétablir · quitter et reprendre le brouillon · réinitialiser un élément puis restaurer l'apparence par défaut, en lisant la portée annoncée · créer deux configurations et basculer de l'une à l'autre · vérifier par un script ou un second compte qu'aucun élément n'est visible.
- **Attendu** : toutes les commandes fonctionnent, la restauration conserve la présentation et les choix de partage, aucune configuration ne publie quoi que ce soit.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### R8b.02 · Widgets et lecteur d'écran

*Critère : « Les widgets se redimensionnent et se réordonnent avec et sans glisser-déposer. Les statistiques Sprinter et valeurs saisies sont distinguables au lecteur d'écran et visuellement. Un widget sans données affiche l'état attendu. »*

- **Préconditions** : widgets de statistiques Sprinter et compteurs saisis · VoiceOver et TalkBack activables · un widget sans données.
- **Étapes** : redimensionner et réordonner par glisser-déposer, puis avec Monter, Descendre et Déplacer · faire lire les widgets par le lecteur d'écran · afficher le widget sans données.
- **Attendu** : réorganisation possible sans glisser-déposer, provenance annoncée (« Saisi par vous » ou statistique Sprinter avec période), état neutre ou masquage attendu.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone (VoiceOver) | [ ] | |
| Android (TalkBack) | [ ] | |

#### R8b.03 · Médias, mouvement réduit, lisibilité, mises en page

*Critère : « Les médias surdimensionnés ou incompatibles ont un retour clair. La vue fixe fonctionne partout. La réduction du mouvement, la lisibilité et les mises en page mobile et ordinateur sont vérifiées avec un profil au maximum des limites du §17.8. »*

- **Préconditions** : profil aux limites du §17.8 (images de 5 Mio, animation de 8 Mio et 8 secondes, galerie de 5 images, 8 widgets, 5 configurations) · fichiers synthétiques trop lourds et incompatibles.
- **Étapes** : importer les fichiers refusables · activer « Réduire les animations » dans Sprinter puis dans le système · contrôler les contrastes et les grandes tailles de texte · afficher les vues mobile et ordinateur.
- **Attendu** : refus expliqués et ancien visuel conservé, images fixes en mouvement réduit, contrastes conformes (4,5:1 et 3:1), mises en page lisibles.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |
