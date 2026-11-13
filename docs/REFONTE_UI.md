# Refonte UI de Sprinter

Branche locale `codex/refonte-ui`, créée à partir de `main` au commit `cb517f1`. Le projet est dans un worktree
séparé. Les modifications locales de `app.json` du projet d’origine sont conservées.

## Vérifié dans le code et par les outils

La base a été installée avec `npm ci` et ses 170 tests passaient. TypeScript et Vitest sont repassés après
chaque phase. Le contrôle final inclut ESLint. Les exports Metro iOS et web sont des bundles JavaScript.

### Phase 0 · Nettoyage

Commit `f9df94f`. 170 tests passent.

Recherche d’imports et revue des fonctions de Live. L’allure et le guidage sont dans Stats. Le mini-lecteur, la carte et le rythme sont dans Carte, allure et rythme. Les deux actions de pause automatique sont dans Courir.

Fichiers du commit

- `App.tsx`
- `src/screens/Home.tsx`
- `src/screens/Live.tsx`
- `src/screens/RunInsights.tsx`
- `src/screens/RunStats.tsx`

### Phase 1 · Retours tactiles et lisibilité

Commit `dc05b7e`. 170 tests passent.

Lecture des commandes et recherche des tailles inférieures à 12 points. Le seul rôle à 11 points est celui de la barre d’onglets. Les alertes du coach utilisent toujours leur service d’origine.

Fichiers du commit

- `App.tsx`
- `src/screens/Detail.tsx`
- `src/screens/Home.tsx`
- `src/screens/Music.tsx`
- `src/screens/Preparation.tsx`
- `src/screens/RunStats.tsx`
- `src/screens/Settings.tsx`
- `src/ui/PaceChart.tsx`
- `src/ui/RouteMap.web.tsx`
- `src/ui/RunCountdown.tsx`
- `src/ui/RunRow.tsx`
- `src/ui/components.tsx`
- `src/ui/controls.tsx`
- `src/ui/design.tsx`
- `src/ui/haptics.ts`
- `src/ui/navigation.tsx`
- `src/ui/tokens.ts`

### Phase 2 · Onglets et carte

Commit `fc8ffcc`. 170 tests passent.

Lecture du cycle de montage, du cache de position et des abonnements Spotify. Le changement d’onglet préserve les composants. Le fondu de carte dure 150 ms et la taille change d’un coup.

Fichiers du commit

- `App.tsx`
- `src/screens/Home.tsx`
- `src/screens/Music.tsx`
- `src/screens/RunInsights.tsx`
- `src/screens/RunStats.tsx`
- `src/spotify/components.tsx`
- `src/ui/RouteMap.tsx`
- `src/ui/navigation.tsx`
- `src/ui/useMapPosition.ts`

### Phase 3 · Commandes en course

Commit `b6977f1`. 173 tests passent.

Tests de la cible exacte et des limites de la jauge. Lecture du maintien d’une seconde et de l’action VoiceOver. Le retour haptique de succès est déclenché quand l’enregistrement réussit.

Fichiers du commit

- `App.tsx`
- `src/screens/Home.tsx`
- `src/screens/LiveRunMetrics.tsx`
- `src/screens/RunStats.tsx`
- `src/ui/HoldToFinish.tsx`
- `src/ui/PaceGauge.tsx`
- `src/ui/RunPauseButton.tsx`
- `src/ui/components.tsx`
- `src/ui/design.tsx`
- `src/ui/navigation.tsx`
- `src/ui/paceGaugePosition.ts`
- `src/ui/tokens.ts`
- `tests/paceGaugePosition.test.ts`

### Phase 4 · Kit d’interface

Commit `fb511ee`. 173 tests passent.

Recherche des anciens imports et revue des couleurs et des variantes de texte, des cartes et de l’interrupteur natif.

Fichiers du commit

- `App.tsx`
- `src/screens/Detail.tsx`
- `src/screens/Home.tsx`
- `src/screens/Music.tsx`
- `src/screens/Preparation.tsx`
- `src/screens/Recovery.tsx`
- `src/screens/RunInsights.tsx`
- `src/screens/RunStats.tsx`
- `src/spotify/TrackSheet.tsx`
- `src/ui/RunCountdown.tsx`
- `src/ui/RunRow.tsx`
- `src/ui/brand.tsx`
- `src/ui/components.tsx`
- `src/ui/controls.tsx`
- `src/ui/design.tsx`
- `src/ui/motion.tsx`
- `src/ui/navigation.tsx`
- `src/ui/tokens.ts`

### Phase 5 · Pile native

Commit `e1b9eed`. 175 tests passent.

Tests de résolution du détail par identifiant. Expo valide les versions et Metro génère les bundles iOS et web. La navigation garde le lien profond Sprinter.

Fichiers du commit

- `App.tsx`
- `package-lock.json`
- `package.json`
- `src/navigation/AppSheets.tsx`
- `src/navigation/RootStack.tsx`
- `src/navigation/RunTabs.tsx`
- `src/navigation/routes.ts`
- `src/screens/Settings.tsx`
- `src/ui/motion.tsx`
- `tests/routeRun.test.ts`

### Phase 6 · Bilan, préparation et graphiques

Commit `397464e`. 179 tests passent.

Tests du pas d’allure, de la sélection temporelle et de la gravité des messages. Vérification des chemins de départ, des exports et des quatre sections du détail par lecture.

Fichiers du commit

- `App.tsx`
- `src/analysis/SeriesChart.tsx`
- `src/navigation/RootStack.tsx`
- `src/navigation/useRunStart.ts`
- `src/screens/Detail.tsx`
- `src/screens/Preparation.tsx`
- `src/screens/RunStats.tsx`
- `src/screens/RunSummary.tsx`
- `src/ui/PaceChart.tsx`
- `src/ui/PaceStepper.tsx`
- `src/ui/RouteMap.tsx`
- `src/ui/RouteMap.web.tsx`
- `src/ui/Sheet.tsx`
- `src/ui/TargetRing.tsx`
- `src/ui/Toast.tsx`
- `src/ui/components.tsx`
- `src/ui/nearestTimeIndex.ts`
- `src/ui/paceStep.ts`
- `src/ui/routeMapData.ts`
- `src/ui/sessionMessageSeverity.ts`
- `tests/nearestTimeIndex.test.ts`
- `tests/paceStep.test.ts`
- `tests/sessionMessageSeverity.test.ts`

### Phase 7 · Abonnements et tracé

Commit `fbb8ffc`. 184 tests passent.

Tests d’égalité des sélections, de fraîcheur GPS et de décimation. Les lots de 6 200 points traversent trois seuils et plusieurs segments. Le protocole de mesure est dans PERF.md.

Fichiers du commit

- `App.tsx`
- `docs/PERF.md`
- `src/navigation/AppSheets.tsx`
- `src/navigation/RootStack.tsx`
- `src/navigation/RunTabs.tsx`
- `src/screens/History.tsx`
- `src/screens/Home.tsx`
- `src/screens/Preparation.tsx`
- `src/screens/Recovery.tsx`
- `src/screens/RunInsights.tsx`
- `src/screens/Settings.tsx`
- `src/services/session.ts`
- `src/services/sessionView.ts`
- `src/services/snapshotSelection.ts`
- `src/services/useSessionSelector.ts`
- `src/settings/TrackingPanel.tsx`
- `src/ui/RouteMap.tsx`
- `src/ui/RouteMap.web.tsx`
- `src/ui/navigation.tsx`
- `src/ui/routeMapData.ts`
- `src/ui/theme.tsx`
- `tests/recordedTrack.test.ts`
- `tests/sessionView.test.ts`

### Phase 8 · Lint et mise en forme

`package.json`, `package-lock.json`, `eslint.config.cjs`, `.prettierrc.json`, `.prettierignore`,
`.github/workflows/verify.yml`, `docs/DESIGN_SYSTEM.md`, `docs/INTERFACE.md` et ce rapport.
Les derniers ajustements concernent `Home`, `Preparation`, `Detail` et `useMapPosition`.
Le commit de mise en forme couvre `App.tsx`, les écrans, la navigation, les composants d’interface,
le graphique et la feuille de morceaux Spotify. Les périmètres protégés sont exclus du formatage.

ESLint utilise la configuration Expo et vérifie les règles et dépendances des Hooks. Les diagnostics d’éligibilité
à React Compiler sont désactivés. Le projet n’utilise pas ce compilateur. Il reste huit avertissements sur du
code préexistant. L’installation a signalé huit avis npm modérés, dont trois dans les dépendances de production.
Aucun test existant n’a été retiré.

## Décisions et écarts

- La barre d’onglets se masque sur Courir pendant la course et la pause automatique. **Détails** ouvre Stats.
  La barre réapparaît lors d’une pause manuelle.
- Courir utilise une vue fixe. Un défilement est prévu aussi sur les écrans de moins de 700 points de haut,
  en plus des grandes tailles de texte, pour garder les commandes accessibles.
- La jauge utilise une courbe de ressort en 220 ms. Le bilan compte les valeurs par translation native et
  affiche directement la valeur finale lorsque le texte est fortement agrandi.
- Le GPS distingue une position récente d’une position d’aperçu mémorisée. La carte échantillonne par
  paliers de puissance de deux et conserve le premier et le dernier point de chaque segment.
- Les messages historiques de la session exposent du texte. Les informations reconnues se ferment au bout de
  quatre secondes. Les messages incertains restent visibles pour éviter de masquer une erreur.
- La suppression garde sa confirmation immédiate. Un délai d’annulation aurait changé le cycle d’écriture.
- La phase 9 est optionnelle. La Live Activity et le calendrier restent tels quels.

## Constats issus du code

Avant la refonte, chaque émission de la session remplaçait le snapshot de l’application, et l’abonnement
racine pouvait déclencher un rendu des onglets, de la navigation et des feuilles. Les abonnements lisent
désormais les champs utilisés. La carte d’origine recalculait ses segments après chaque ajout et gardait
le suivi des changements de la vue du marqueur actif. Le cache de tracé et le marqueur ont été ajustés.
Ces constats sont vérifiés dans le code. Le coût CPU, la mémoire et le nombre d’images perdues restent à mesurer.

## À vérifier sur iPhone

- Démarrer depuis Courir et Préparation. Annuler le compte à rebours, refuser puis autoriser la localisation,
  revenir d’une autre app et vérifier la prise en compte de la séance, du parcours et de la playlist.
- Courir à la cible, deux secondes plus vite et deux secondes plus lentement. Vérifier le libellé, la jauge
  et les vibrations avec le réglage activé puis désactivé.
- Déclencher la pause automatique. Contrôler le temps actif, la reprise automatique, **Reprendre maintenant**
  et **Pause manuelle**. Vérifier le retour du dock après une pause manuelle.
- Relâcher la fin de course avant une seconde. Puis maintenir jusqu’à l’enregistrement et retrouver le bilan,
  le tracé et l’historique. Refaire depuis Stats, avec VoiceOver et avec « Réduire les animations ».
- Revenir par glissement depuis l’historique, le détail, le bilan, la préparation, les records, la comparaison,
  la progression, les intégrations Apple et la récupération. Vérifier le lien profond depuis une page secondaire.
- Changer d’onglet après avoir défilé et zoomé. Vérifier le maintien du défilement, du zoom et de la playlist.
  Agrandir la carte, recentrer, passer en satellite et retrouver un repère choisi dans un graphique.
- Suivre le scénario GPX de 90 minutes décrit dans [PERF.md](PERF.md). Vérifier les reprises du tracé sans
  segments reliés à travers les interruptions et relever les mesures avant/après.
- Refaire les gestes et les commandes avec VoiceOver, la plus grande taille de texte, les préférences de
  mouvement et de transparence réduits, ainsi que les thèmes clair et sombre.

Les principaux risques restant à vérifier sur appareil concernent les gestes natifs, la coexistence des
feuilles avec le clavier, le rendu de la carte après un retour et les effets haptiques sous les réglages iOS.
Aucune mesure ou observation visuelle sur iPhone n’a été réalisée. Aucun IPA n’a été généré.

## Pistes hors périmètre

Une future intervention pourrait revoir l’organisation des onglets, les filtres et actions de l’historique.
La prise en charge web et Android, ainsi que l’évolution du moteur de course, se décident séparément.
