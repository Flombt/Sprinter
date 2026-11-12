# Sprinter — audit UI/UX et socle de design system

Livraison du 1er novembre 2026. Intervention sur le projet réel React Native / Expo SDK 58, conservant la compatibilité Expo Go. L’objectif est d’harmoniser la présentation existante ; les moteurs sportifs, calculs, formats de stockage et parcours de navigation sont conservés.

L’audit est fondé sur les sources des 13 écrans principaux et des vues des modules. L’outil d’aperçu local a refusé l’ouverture du navigateur car cette capacité est désactivée dans l’environnement. **Aucun écran rendu sur navigateur ou iPhone n’a été inspecté pendant cette livraison.** Les problèmes de mise en page signalés ci-dessous sont identifiés dans le code, sans prétendre avoir observé leurs effets sur appareil.

## Inventaire de l’existant

| Ensemble existant | Composants / vues inspectés | Décision |
| --- | --- | --- |
| Socle `src/ui/` | `ThemeProvider`, `Copy`, `Label`, `Icon`, `Button`, `IconButton`, `Panel`, `Screen`, `Header`, `SectionHeading`, `Metric`, `EmptyState`, `Hero`, `TrackArt` | Consolider ces composants et conserver les API utilisées par les écrans. |
| Navigation `App.tsx` | Cinq onglets Courir/Sorties/Séances/Musique/Réglages, sous-pages, feuilles musique/séances/outils, bandeau de message | Extraire la présentation des onglets ; conserver états, destinations, liens profonds et callbacks. |
| Écrans sportifs | Accueil, préparation, course en direct, historique, détail, records, comparaison | Réutiliser cartes/métriques/lignes ; améliorer l’adaptation des chiffres et tableaux au texte agrandi. |
| Configuration | Réglages, coach, objectifs d’allure, éditeur de séances, intégrations Apple, outils | Supprimer les variantes locales de champs, choix et interrupteurs au profit de contrôles partagés. |
| Progression | Tableau de bord, calendrier, objectifs, plans, chaussures, journal et bilan | Conserver formulaires, validations, données et liens ; partager champs, choix, sélecteurs et grilles. |
| Musique | Sélection de playlist, bibliothèque, lecteur, commandes, configuration Spotify | Conserver images et identité officielles Spotify ; reprendre les styles communs autour des contenus et commandes. |
| Cartographie / graphiques | Carte native/web, tracé, repères, courbes et bandes d’allure | Centraliser les couleurs et rayons sans changer géométrie, calculs, données ou simplification des traces. |
| Widget verrouillé | `src/apple/RunLiveActivity.tsx`, rendu isolé Expo Widgets/SwiftUI | Conservé : son environnement de rendu ne partage pas le contexte React des écrans. |

## Problèmes identifiés et choix retenus

| Constat dans les sources | Amélioration appliquée |
| --- | --- |
| Un thème existait, mais l’accueil, la barre basse, les cartes, curseurs et cartes GPS définissaient encore leurs propres verts. | Palette sémantique centralisée : accent lime conservé, vert lisible sur surface claire, rôles de statut et couleurs de tracé. Les couleurs hexadécimales de présentation sont regroupées dans `tokens.ts`. |
| Les rayons et espacements variaient selon les modules ; champs et choix existaient sous plusieurs formes locales. | Échelle commune et composants de base réutilisés. Les espacements propres à une composition ou à une géométrie de graphique restent locaux lorsqu’ils ont un sens précis. |
| `Copy` utilisait un interligne commun même lorsque des écrans lui donnaient une taille de texte différente. | Rôles typographiques complets, avec interlignes associés. Compatibilité des anciens styles conservée avec adaptation de l’interligne si seule leur taille est fournie. Plus de 180 occurrences simples ont été migrées vers des rôles nommés. |
| Champs parfois sans fond commun, avec bordure peu visible et aucun style de focus partagé. | `Input` / `TextField` avec fond, bordure, focus, état invalide, texte indicatif et état désactivé. Les parseurs et validations restent dans leurs modules. |
| Interrupteurs redéfinis dans Réglages, Préparation, Séances, Apple et les modules. | `Switch` natif thémé et `Toggle` réutilisable pour titre/description/valeur, sans duplication des callbacks métier. |
| Barre basse étroite, capsule haute, grande pastille sur chaque onglet sélectionné et texte de 10 points. | Barre plus large et plus sobre, sélection limitée au support de l’icône, libellés de 11 points, icônes actives cohérentes. Les cinq destinations restent visibles en taille standard. |
| L’espace sous les écrans était une constante, indépendante de la taille réelle de la barre et du texte. | Hauteur de la barre et du bouton fixe de préparation mesurée ; le contenu réserve l’espace réellement occupé. Les feuilles n’héritent pas de l’inset des onglets. |
| Plusieurs paires de métriques et tableaux à colonnes fixes risquaient de se comprimer avec Dynamic Type. | `MetricGrid`, disposition en colonne, comparaison et intermédiaires adaptés ; lecture de longs chiffres défilable horizontalement aux grandes tailles plutôt que réduction forcée. |
| Les couleurs discrètes étaient moins lisibles en sombre ; le matériau Glass suivait implicitement l’apparence système. | Contrastes renforcés, apparence Glass explicitement liée au thème de Sprinter, repli opaque si transparence réduite. |

L’identité reste celle du projet : fond clair légèrement teinté, cartes sobres, accent **lime `#D1F17D`**, encre verte sombre, typographie système forte et illustration de piste existante. Aucun nouveau logo, police externe, visuel généré ou branding n’a été introduit.

## Source de vérité

| Fichier | Usage |
| --- | --- |
| `src/ui/tokens.ts` | Palettes clair/sombre, couleurs sémantiques, espacements, rayons, dimensions minimales, typographie et variantes de cartes. |
| `src/ui/theme.tsx` | Préférence Clair/Sombre/Système, Réduire les animations, Réduire la transparence et informations de disposition adaptative. |
| `src/ui/components.tsx` | Texte, boutons, cartes, entêtes, sections, métriques, lignes de liste, états vides et hero. |
| `src/ui/controls.tsx` | Champs natifs, champ avec libellé/aide/erreur, switch, ligne de réglage, groupes de choix, contrôle segmenté et Picker natif thémé. |
| `src/ui/navigation.tsx` | `BottomTabs`, présentation générique des onglets ; aucune autorité sur les états de course ou de page. |
| `src/ui/layout.tsx` | Inset de navigation mesuré, partagé avec les écrans concernés. |
| `src/ui/RunRow.tsx` | Ligne d’activité réutilisée par l’accueil et l’historique. L’ancien export de `Home` reste disponible. |
| `src/ui/RangeSlider.tsx` / `.web.tsx` | Adaptateurs de curseur cohérents, conservant les événements de valeur et de validation existants. |

`Panel` reste un alias de `Card`, et `secondary` continue de fonctionner sur `Button`. Les adaptateurs de formulaires de progression et de séances délèguent aux contrôles communs : pas de second design system par module.

Depuis le 2 novembre 2026, `RunRow` accepte `detailed` pour l’onglet Sorties : date/heure et métriques essentielles sont regroupées dans le contenu de la ligne. Le mode compact par défaut reste utilisé sur l’accueil. Voir [HISTORY.md](HISTORY.md).

## Règles d’utilisation

**Couleurs.** Utiliser `useTheme().colors` : `background`, `surface`, `raised`, `field`, `text`, `secondary`, `muted`, `line`, `controlLine`, `accent`, `accentInk`, `accentText`, `accentSoft`, `danger`, `orange`, `blue`. `accent` est une surface/illustration, et `accentText` la couleur lisible d’une action sur une surface normale. `accentInk` sert au texte posé sur le lime. Les rôles `hero*` et `route*` préservent leurs contextes spécifiques.

**Espacements.** `spacing` expose 0, 4, 8, 12, 16, 20, 24, 32 et 40 points. Les écrans ont une gouttière standard de 24 points, ramenée à 16 sur largeur compacte ou texte agrandi. Les cartes standard et métrique ont 20 points de marge interne, les cartes liste/réglage 16 et le hero 24.

**Rayons.** `radii.sm` 8 ; `control` 14 ; `button` 18 ; `card` 24 ; `hero` 28 ; `pill` pour les éléments circulaires/capsules. Ne pas créer une nouvelle valeur pour chaque formulaire.

**Typographie.** `Copy` accepte `variant` : `hero`, `display`, `pace`, `title`, `heading`, `section`, `body`, `emphasis`, `caption`, `small`, `label`, `button`, `tab`, `metric`, `metricLarge`. `Label` utilise le rôle `label`. Les métriques ont des chiffres tabulaires. La police reste celle du système, sans chargement réseau. Les styles locaux restent disponibles pour une composition particulière ; privilégier un rôle nommé pour les nouveaux textes.

```tsx
const { colors } = useTheme();

<Card variant="metric">
  <MetricGrid>
    <Metric label="Temps actif" value={duration(run.activeSeconds)} />
    <Metric label="Distance" value={km(run.distanceMeters)} unit="km" />
  </MetricGrid>
</Card>

<TextField label="Nom de la séance" value={name} onChangeText={setName}
  description="Un nom facile à retrouver." maxLength={100} />

<Toggle title="Signaux audio" body="Reconnaître les écarts sans regarder l’écran."
  value={enabled} onChange={setEnabled} />

<Button title="Enregistrer" onPress={save} />
<Button title="Dupliquer" variant="secondary" onPress={duplicate} />
<Button title="Annuler" variant="quiet" onPress={close} />
```

Les variantes de cartes sont `default`, `hero`, `metric`, `list`, `setting`. `hero` conserve le dégradé lime ; les autres utilisent les surfaces du thème. Une carte ne porte aucune logique métier. La variante secondaire d’un bouton ne signifie pas qu’il est désactivé : utiliser `disabled` pour cela. Une action destructive conserve `danger` et sa confirmation existante.

`ChoiceGroup` propose des choix indépendants qui peuvent revenir à la ligne ; `SegmentedControl` est destiné à un petit ensemble de modes exclusifs. Les deux reçoivent les mêmes tuples `[valeur, libellé]`, exposent la sélection aux technologies d’assistance et conservent le callback du module. `Picker.Item` reste compatible avec les sélecteurs existants.

## Navigation et accessibilité

La barre reste un composant React Native, avec matériaux iOS quand disponibles ; ce n’est pas une migration vers un `UITabBarController` ou une nouvelle navigation SwiftUI. `App.tsx` conserve ses états de pages, onglets, feuilles et liens profonds. Sous iOS, Glass suit le thème choisi ; Blur ou surface opaque servent de repli. Réduire la transparence supprime le matériau translucide.

Le texte n’est pas plafonné par un `maxFontSizeMultiplier`. À partir de `fontScale >= 1.3`, les grilles se réorganisent, les actions de course s’empilent et la barre devient défilable horizontalement pour conserver les cinq destinations avec leurs libellés. Les chiffres longs peuvent être déplacés horizontalement sans les réduire. Les intermédiaires et la comparaison disposent d’une disposition lisible en colonne. Le sélecteur d’allure est dans une feuille défilable et respecte Réduire les animations.

Le Picker iOS installé applique `scaleMultiplier:1` à sa police explicite (`RNCPickerComponentView.mm`). L’adaptateur partage donc la taille utilisateur avec sa police et sa hauteur natives, autorise davantage de lignes et conserve ses événements. La roue, le défilement de feuille et les libellés longs doivent encore être observés ensemble sur iPhone.

Les boutons ont une hauteur minimale de 56 points, les actions discrètes et boutons d’icône 44 ; les champs 52. Les interrupteurs conservent le contrôle système avec marge tactile. Les icônes décoratives ne créent pas une lecture de glyphe supplémentaire ; boutons, champs, onglets et choix ont des libellés/états accessibles. Les statuts sportifs conservent leur texte, pas seulement une couleur.

Les rapports de contraste suivants sont des **calculs de palette sur surfaces opaques**, pas une certification d’un écran rendu : texte clair/surface 16,68:1 ; secondaire clair/surface surélevée 5,42:1 ; discret clair/surface surélevée 4,61:1 ; discret sombre/surface surélevée 6,25:1 ; encre/accent lime 11,08:1. La référence de conception est 4,5:1 pour le texte courant ; les matériaux, cartes et contenus externes nécessitent un contrôle visuel distinct. [Référence W3C](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

Les propriétés de texte et d’accessibilité suivent les API de la version React Native utilisée. [Text](https://reactnative.dev/docs/text), [Accessibility](https://reactnative.dev/docs/accessibility). L’accessibilité complète, VoiceOver et les tailles extrêmes ne sont pas déclarés validés par ces seuls changements.

## Préservation fonctionnelle et vérifications

Les calculs GPS/allure/distance, la session, les séances, statistiques, exports, permissions, persistance, synchronisation Santé et commandes audio/Spotify ne sont pas réécrits. La bibliothèque de contrôles conserve leurs valeurs et fonctions existantes. Un import de type inutilisé a été retiré du store Spotify, sans modification de son implémentation. Aucune dépendance ajoutée, aucun changement de modèle ou migration de données, aucun nouveau module natif.

Vérifications sous Windows :

- Compilation TypeScript du projet : `npm run typecheck`.
- Compilation avec détection des imports/variables/paramètres inutilisés : `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`.
- Export iOS Hermes : `npm run export:ios`.
- Export web : `npx expo export --platform web --output-dir web-build`.

Les vérifications finales de compilation sont consignées dans [VALIDATION.md](VALIDATION.md). **Aucun test automatisé créé, modifié ou exécuté**, conformément à la consigne précédente. Aucun scénario de course lancé, aucune action Santé/Spotify effectuée et aucune validation physique revendiquée. Les exports JavaScript ne compilent pas le Swift et ne produisent pas d’IPA signé.

À examiner ultérieurement sur iPhone : tailles standard et accessibilité, petits écrans/paysage, contraste clair/sombre/système et Glass, lecture VoiceOver et ordre de focus, cinq onglets et dernières lignes non masquées, clavier et feuilles, roues natives agrandies, puis les parcours existants de préparation/course/historique. L’absence de régression fonctionnelle ne peut pas être garantie par la seule compilation. Le socle est prêt pour poursuivre l’harmonisation des compositions d’écrans à partir de ces composants communs.
