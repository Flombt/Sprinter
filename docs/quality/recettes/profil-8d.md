# Recette · Évolutions facultatives

> **Recette manuelle NON EXÉCUTÉE.** Ne cocher qu’après observation sur le commit et le client consignés. Les attentes de la spécification historique ont été adaptées au compte obligatoire ; elles ne constituent pas une preuve de conformité.

[Campagne et fiche de résultat](README.md) · [État actuel](../../features/etat-fonctionnalites.md)

### 8d · Évolutions facultatives

#### R8d.01 · Bibliothèque de thèmes

*Critère : « Un thème publié et un thème appliqué depuis la bibliothèque contiennent uniquement les éléments de style autorisés. Le retrait et le signalement d'un thème suivent les règles de modération. »*

- **Préconditions** : `theme_library_enabled = true` · profil source contenant une photo, des textes, des liens et des statistiques.
- **Étapes** : publier un thème depuis ce profil · inspecter son contenu · l'appliquer depuis un autre compte · le signaler, puis le retirer.
- **Attendu** : le thème ne contient que des paramètres visuels autorisés et des références au catalogue, aucune donnée personnelle · signalement et retrait suivent la modération.

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Appareil et navigateur | [ ] | |

#### R8d.02 · Cartes et liens, puis non-régression

*Critère : « Les cartes et liens reposent sur un aperçu validé par le titulaire. En désactivant ces options, vérifier à nouveau les parcours de course et les fonctions 8a à 8c. »*

- **Préconditions** : `profile_cards_enabled = true`.
- **Étapes** : composer une carte et un lien : l'aperçu est montré et validé avant génération · désactiver les options · rejouer R1.06, R2.05 et une version courte de R8a.01 à R8c.04.
- **Attendu** : rien n'est généré sans validation, aucune régression après désactivation.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |
