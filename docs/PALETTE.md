# Palettes de Sprinter

Tempo est la palette par défaut. Dans un build de développement, ouvrir **Réglages → Palette (dev)**
pour comparer Tempo, Signal et Cobalt en direct. Le choix est conservé en mémoire et revient à la valeur
de `ACTIVE_PALETTE` au redémarrage. Pour changer ce défaut, modifier `ACTIVE_PALETTE` dans
[`src/ui/palettes.ts`](../src/ui/palettes.ts).

| Rôle | Usage |
| --- | --- |
| `accent`, `accentInk`, `accentText`, `accentSoft` | Marque, action principale, liens et commandes sélectionnées. `switchOn` suit l’accent du thème. |
| `heroAction`, `heroActionText` | Action sur la surface crème, avec la même paire en clair et en sombre. |
| `zone.on`, `zone.fast`, `zone.slow` | Dans la cible, trop rapide, trop lent. La jauge associe la couleur à une position, un pictogramme et un libellé. |
| `color`, `text`, `soft`, `onColor` | Graphiques ou aplats, texte, fond teinté et texte sur aplat. |
| `warning`, `info` | Avertissements et informations. Leurs teintes suivent respectivement `zone.fast` et `zone.slow`. |
| `routePosition`, `routeStart`, `routeFinish`, `routeReference` | Accent, couleur dans la cible, texte neutre et couleur trop lent. |

Les statuts GPS, la pause et les états sans mesure utilisent les neutres. Les graphiques d’allure distinguent
les limites par le motif du trait. La lecture d’un point ajoute le libellé d’allure à la mesure.

[`tests/palette-contrast.test.ts`](../tests/palette-contrast.test.ts) calcule la luminance relative sRGB
pour chaque palette dans les deux thèmes. Les seuils sont de 4,5:1 pour le texte et 3:1 pour les éléments
graphiques. Toutes les teintes fournies passent aux emplacements prévus. [Contraste du texte](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) · [Contraste des éléments graphiques](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)

| Thème | Texte | `background` | `surface` | `raised` | `field` |
| --- | --- | ---: | ---: | ---: | ---: |
| Clair | `text` | 15,70 | 17,90 | 14,10 | 16,55 |
| Clair | `secondary` | 5,48 | 6,25 | 4,92 | 5,78 |
| Clair | `muted` | 4,92 | 5,61 | 4,41 | 5,18 |
| Sombre | `text` | 18,06 | 16,32 | 14,52 | 17,32 |
| Sombre | `secondary` | 7,32 | 6,61 | 5,88 | 7,02 |
| Sombre | `muted` | 6,32 | 5,71 | 5,08 | 6,06 |

Le contraste existant de 4,41:1 en clair figure au rapport sans assertion de conformité. Les deux
fonds de démarrage natifs restent déclarés à `#101011` dans `app.json`.

Les images [`assets/icon.png`](../assets/icon.png), aussi utilisée comme premier plan de l’icône adaptative
Android, et [`assets/splash.png`](../assets/splash.png) contiennent encore l’orange historique. Le projet ne
déclare aucun favicon dédié.
