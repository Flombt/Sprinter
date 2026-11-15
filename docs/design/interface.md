# Interface et navigation actuelles

[Carte documentaire](../00-INDEX.md) · [Système visuel](systeme-visuel.md)

## Entrée et onglets

[App.tsx](../../App.tsx) ouvre la connexion sans session puis **Courir** après connexion. [RunTabs.tsx](../../src/navigation/RunTabs.tsx) déclare, dans l’ordre : **Spotify · Courir · Stats**. Ce sont des panneaux conservés, pas cinq onglets historiques. Spotify est monté après sa première visite ; les écrans visibles seuls reçoivent les abonnements rapides utiles.

| Surface | Responsabilité / source |
|---|---|
| Courir | Carte, départ, pause/reprise et commandes de course ; [Home.tsx](../../src/screens/Home.tsx) |
| Stats | Tableau de bord, sorties, records, progression, chaussures et accès aux réglages de course ; [StatsDashboard.tsx](../../src/screens/StatsDashboard.tsx), [RunStats.tsx](../../src/screens/RunStats.tsx) |
| Spotify | Import, sélection, bibliothèque et lecteur selon capacités ; [Music.tsx](../../src/screens/Music.tsx) |
| Préparation | Allure, distance, séance, musique et options avancées ; [Preparation.tsx](../../src/screens/Preparation.tsx) |
| Réglages / compte / outils | Feuilles pilotées par [AppSheets.tsx](../../src/navigation/AppSheets.tsx) |
| Historique / détail / comparaison / bilan / récupération | Pages dans [RootStack.tsx](../../src/navigation/RootStack.tsx), contrats dans [routes.ts](../../src/navigation/routes.ts) |

## Pendant et après une course

Départ rapide et préparation partagent le même compte à rebours annulable. Sur Courir, la barre d’onglets se masque pendant la course et l’auto-pause ; elle revient en pause manuelle. Les données en direct et outils sont accessibles par les surfaces raccordées, sans créer un second moteur de course.

[HoldToFinish.tsx](../../src/ui/HoldToFinish.tsx) propose le maintien de fin et une confirmation accessible. Le bilan ouvre le détail, dont les sections relient graphiques et carte. Les pages secondaires utilisent la pile native et Retour ; une feuille ne doit pas masquer les actions du lecteur d’écran derrière elle.

## Liens et destinations

- `sprinter://run` ouvre Courir.
- Les liens de playlist sont traités par [spotify/links.ts](../../src/spotify/links.ts), puis orientent vers Spotify.
- `sprinter://profil?t=…` attend connexion et flags nécessaires avant la vue visiteur.
- `app.sprinter.running://spotify-callback` termine une session d’authentification ; ce n’est pas l’URI HTTPS à déclarer chez Spotify.

La navigation du profil et du compte est interne à [AccountSheet.tsx](../../src/account/ui/AccountSheet.tsx), distincte de la pile des sorties. Pour modifier une destination, commencer par son routeur puis vérifier le contrat de paramètres.

Les descriptions historiques de hero lime, de cinq onglets ou de Stats à gauche sont archivées. Les détails d’animation, palette et accessibilité appartiennent au [système visuel](systeme-visuel.md) ; les validations réelles à [quality/validation](../quality/validation.md).
