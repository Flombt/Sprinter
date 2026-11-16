# Système visuel et accessibilité

[Interface](interface.md) · [Validation](../quality/validation.md)

## Sources de référence

| Source | Rôle |
|---|---|
| [tokens.ts](../../src/ui/tokens.ts) | Espacement, rayons, typographie, tailles et interactions |
| [palettes.ts](../../src/ui/palettes.ts) | Couleurs sémantiques et `ACTIVE_PALETTE` |
| [theme.tsx](../../src/ui/theme.tsx) | Clair/sombre/système, mouvement et transparence |
| [components.tsx](../../src/ui/components.tsx), [controls.tsx](../../src/ui/controls.tsx) | Texte, cartes, boutons, champs et contrôles partagés |
| [editorial.tsx](../../src/ui/editorial.tsx), [RouteTrace.tsx](../../src/ui/RouteTrace.tsx) | Couvertures Expo Image, lignes éditoriales et tracés compacts issus du GPS |
| [navigation.tsx](../../src/ui/navigation.tsx), [GlassSurface.tsx](../../src/ui/GlassSurface.tsx) | Dock, visibilité accessible et repli du verre natif |
| [Sheet.tsx](../../src/ui/Sheet.tsx), [motion.tsx](../../src/ui/motion.tsx), [layout.tsx](../../src/ui/layout.tsx) | Feuilles, transitions et marges d’écran |
| [brand.tsx](../../src/ui/brand.tsx), [App.tsx](../../App.tsx) | Marque et chargement des polices embarquées |

La direction **Editorial Coast** associe un fond papier chaud, des surfaces claires et un turquoise mesuré. Sa version sombre garde un contraste entre fond et surfaces. L’apparence du système est le défaut en l’absence de préférence enregistrée ; les choix clair et sombre restent persistés. La console de course applique sa surface instrumentale sombre, quelle que soit l’apparence de l’accueil. Les accents du coach distinguent toujours les trois zones. Tempo, Signal et Cobalt restent comparables en développement. Barlow Condensed sert aux titres et mesures ; le texte courant emploie la police système. Voir les [attributions](../../assets/editorial/ATTRIBUTION.md).

## Conventions à préserver

Utiliser `Copy` et ses rôles, `Label`, les composants de contrôle et les couleurs sémantiques. L’état d’allure associe libellé, position et pictogramme à la couleur. Ne pas recopier des valeurs hexadécimales dans un nouvel écran pour reproduire une palette.

Les cibles tactiles de base font 44 points et les boutons de course 72 selon les tokens. Adapter les grilles à la taille du texte, conserver les libellés et proposer une alternative accessible aux gestes personnalisés. Respecter Réduire les animations et Réduire la transparence ; le verre natif possède un repli et reste lié à sa disponibilité iOS.

Les durées sont partagées : pression 100 ms, favori 130 ms après enregistrement, onglet 150 ms et indicateur 200 ms, feuille 240 ms, fiche 280 ms et graphique 300 ms lors d’un changement de données. Le GPS n’anime pas les chiffres. Les fiches utilisent une transition de pile avec une alternative sans mouvement ; la photographie ne se déplace pas d’un écran à l’autre.

## Contrastes et limites

[palette-contrast.test.ts](../../tests/palette-contrast.test.ts) contrôle des couples prévus à 4,5:1 pour le texte et 3:1 pour les éléments graphiques en clair, sombre et console. Il vérifie aussi le texte secondaire sur les surfaces surélevées. Les dégradés sur photographie et le rendu complet se jugent sur les écrans.

Icône et splash peuvent conserver des teintes historiques distinctes des palettes ; [app.json](../../app.json) possède aussi ses fonds natifs. Les transparences, Dynamic Type, VoiceOver et le rendu effectif nécessitent la [recette iPhone](../quality/recette-course-iphone.md). Les mesures de fluidité restent dans [performance](../quality/performance.md).
