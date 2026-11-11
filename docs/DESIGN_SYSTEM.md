# Kit d’interface Sprinter

Le thème sombre est proposé par défaut. Les préférences Clair, Sombre et Système se choisissent dans Réglages.
Les palettes de la refonte reprennent les valeurs de `cb517f1`. Les titres et les chiffres utilisent les deux
graisses de Barlow Condensed intégrées à l’application. Le texte courant utilise la police système.

| Fichier | Composants et rôles |
| --- | --- |
| `src/ui/tokens.ts` | `typography`, `spacing`, `radii`, `layout`, palettes et état pressé |
| `src/ui/theme.tsx` | Préférences système, couleurs et adaptation à la taille du texte |
| `src/ui/components.tsx` | `Copy`, `Label`, `Card`, `Button`, `IconButton`, `Header`, `Screen`, métriques et lignes |
| `src/ui/controls.tsx` | Champs, choix, interrupteur natif et sélecteur |
| `src/ui/brand.tsx` | Signe de vitesse, symbole de course et signature Sprinter |
| `src/ui/haptics.ts` | Retours tactiles pilotés par le réglage Vibrations |
| `src/ui/navigation.tsx` | Barre d’onglets, animation de sélection et visibilité accessible |
| `src/ui/Sheet.tsx` | Feuille de préparation avec deux hauteurs, poignée et fermeture |

Privilégier `Copy` avec un rôle nommé et `Label` pour les libellés de métrique. Les textes courants commencent
à 12 points et les libellés d’onglet à 11. Les grilles passent en colonne quand le texte est agrandi. Les
commandes gardent leurs libellés et le lecteur d’écran peut agir sans geste personnalisé.

`Button` propose les variantes `primary`, `secondary` et `quiet`. La taille `run` réserve au moins 72 points.
La flèche de fin est explicite avec `arrow`. `Panel` reste un alias de `Card`. `Toggle` délègue à l’interrupteur
natif `Switch`. Les surfaces de craie utilisent la variante `paper`.

Les animations de commande courtes utilisent le pilote natif sur iOS. Le compte à rebours annonce le départ,
la jauge indique l’écart par un curseur, un pictogramme et un libellé, et la carte s’agrandit avec un fondu.
« Réduire les animations » désactive ces transitions. Le dock suit la préférence de transparence.

Voir [Interface](INTERFACE.md), [vérifications](REFONTE_UI.md) et [mesures sur iPhone](PERF.md).
