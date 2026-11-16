# Interface et navigation actuelles

[Carte documentaire](../00-INDEX.md) · [Système visuel](systeme-visuel.md) · [Prototype de refonte Editorial Performance](refonte-editorial-performance.md)

## Entrée et onglets

[App.tsx](../../App.tsx) ouvre l’accueil photo et la connexion en l’absence de session. Une session restaurée accède directement à **Courir**, ou à la course interrompue en pause. [RunTabs.tsx](../../src/navigation/RunTabs.tsx) affiche **Courir · Découvrir · Progrès · Profil**. Les autres onglets conservent leur état après la première visite.

| Surface | Responsabilité / source |
|---|---|
| Courir | Couverture, cible, préparation, séances, musique et départ dans [Home.tsx](../../src/screens/Home.tsx). La carte s’ouvre depuis Préparer ou en course. |
| Découvrir | Catalogue, filtres, favoris et carte. [Fiche Découvrir Nice](../features/decouvrir-nice.md) |
| Progrès | Distances et régularité de la période civile choisie, historique, objectifs, records, chaussures et comparaison ; [StatsDashboard.tsx](../../src/screens/StatsDashboard.tsx), [distanceDashboard.ts](../../src/progression/distanceDashboard.ts) |
| Profil | Bannière, avatar, nom, sorties, confidentialité, compte et communauté selon les fonctionnalités activées ; [ProfileTab.tsx](../../src/screens/ProfileTab.tsx) |
| Musique | Destination depuis Courir, Préparer et les outils en course : import, sélection, états de lecture et restrictions Spotify ; [Music.tsx](../../src/screens/Music.tsx) |
| Préparer | Allure, distance, séance, musique, parcours, chaussures et options avancées. Valeurs visibles par ligne et bouton de départ fixe ; [Preparation.tsx](../../src/screens/Preparation.tsx) |
| Réglages / compte / outils | Feuilles pilotées par [AppSheets.tsx](../../src/navigation/AppSheets.tsx) |
| Historique / détail / comparaison / bilan / récupération | Pages dans [RootStack.tsx](../../src/navigation/RootStack.tsx), contrats dans [routes.ts](../../src/navigation/routes.ts) |

## Pendant et après une course

Départ rapide et préparation partagent le même compte à rebours annulable. [LiveRun.tsx](../../src/screens/LiveRun.tsx) affiche la console sombre et les commandes fixes pendant le suivi et la pause. En pause manuelle, **Outils de course → Ouvrir l’accueil** réaffiche les onglets et permet de revenir à la console. Pendant ce temps, le catalogue reste en consultation locale, sans actualisation distante.

[HoldToFinish.tsx](../../src/ui/HoldToFinish.tsx) propose le maintien de fin et une confirmation par appui simple. Le bilan ouvre le détail ou l’historique après enregistrement. Les tracés de synthèse et les exports utilisent les points enregistrés ; le détail conserve la carte et les options de partage. Le mini-lecteur affiche le titre observé ou la playlist choisie entre les sorties. La console permet de retrouver le lecteur depuis ses outils.

## Liens et destinations

- `sprinter://run` ouvre Courir.
- Les liens de playlist reconnus par [spotify/links.ts](../../src/spotify/links.ts) ouvrent l’import de Musique après connexion, dans la pile courante.
- `sprinter://profil?t=…` attend connexion et flags nécessaires avant la vue visiteur.
- `app.sprinter.running://spotify-callback` termine une session d’authentification ; ce n’est pas l’URI HTTPS à déclarer chez Spotify.

La navigation du profil et du compte est interne à [AccountSheet.tsx](../../src/account/ui/AccountSheet.tsx), distincte de la pile des sorties. Pour modifier une destination, commencer par son routeur puis vérifier le contrat de paramètres.

Les descriptions historiques de hero lime, de cinq onglets ou de Stats à gauche sont archivées. Les détails d’animation, palette et accessibilité appartiennent au [système visuel](systeme-visuel.md) ; les validations réelles à [quality/validation](../quality/validation.md).
