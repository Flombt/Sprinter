# Système visuel et accessibilité

[Interface](interface.md) · [Validation](../quality/validation.md)

## Sources de référence

| Source | Rôle |
|---|---|
| [tokens.ts](../../src/ui/tokens.ts) | Espacement, rayons, typographie, tailles et interactions |
| [palettes.ts](../../src/ui/palettes.ts) | Couleurs sémantiques et `ACTIVE_PALETTE` |
| [theme.tsx](../../src/ui/theme.tsx) | Clair/sombre/système, mouvement et transparence |
| [components.tsx](../../src/ui/components.tsx), [controls.tsx](../../src/ui/controls.tsx) | Texte, cartes, boutons, champs et contrôles partagés |
| [navigation.tsx](../../src/ui/navigation.tsx), [GlassSurface.tsx](../../src/ui/GlassSurface.tsx) | Dock, visibilité accessible et repli du verre natif |
| [Sheet.tsx](../../src/ui/Sheet.tsx), [motion.tsx](../../src/ui/motion.tsx), [layout.tsx](../../src/ui/layout.tsx) | Feuilles, transitions et marges d’écran |
| [brand.tsx](../../src/ui/brand.tsx), [App.tsx](../../App.tsx) | Marque et chargement des polices embarquées |

Le défaut est sombre et la palette **Tempo**. En développement, Tempo, Signal et Cobalt se comparent depuis les réglages ; le choix de palette reste en mémoire, contrairement à l’apparence persistée. Les deux graisses Barlow Condensed sont embarquées pour titres/métriques ; le texte courant emploie la police système.

## Conventions à préserver

Utiliser `Copy` et ses rôles, `Label`, les composants de contrôle et les couleurs sémantiques. L’état d’allure associe libellé, position et pictogramme à la couleur. Ne pas recopier des valeurs hexadécimales dans un nouvel écran pour reproduire une palette.

Les cibles tactiles de base font 44 points et les boutons de course 72 selon les tokens. Adapter les grilles à la taille du texte, conserver les libellés et proposer une alternative accessible aux gestes personnalisés. Respecter Réduire les animations et Réduire la transparence ; le verre natif possède un repli et reste lié à sa disponibilité iOS.

## Contrastes et limites

[palette-contrast.test.ts](../../tests/palette-contrast.test.ts) contrôle des couples prévus à 4,5:1 pour le texte et 3:1 pour les éléments graphiques. Il exclut explicitement l’ancien couple `muted` sur `raised` en clair, mesuré à environ **4,41:1**. Il est donc incorrect de déclarer toute l’interface conforme sur la seule base de ces tests.

Icône et splash peuvent conserver des teintes historiques distinctes des palettes ; [app.json](../../app.json) possède aussi ses fonds natifs. Les transparences, Dynamic Type, VoiceOver et le rendu effectif nécessitent la [recette iPhone](../quality/recette-course-iphone.md). Les mesures de fluidité restent dans [performance](../quality/performance.md).
