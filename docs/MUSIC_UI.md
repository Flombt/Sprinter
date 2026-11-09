# Onglet Musique — 2 novembre 2026

## Audit de l’existant

L’écran réunissait déjà import de liens/URI, références locales, sélection pour une course, lancement automatique, consultation des morceaux, bibliothèque du compte et commandes Spotify. L’authentification, les permissions, les refus de commandes et les délais après erreur étaient gérés dans les services existants.

La hiérarchie rendait ces fonctions difficiles à distinguer : introduction volumineuse, lecteur après la liste, configuration Developer développée en l’absence d’identifiants, et rangées cumulant choix, ouverture, morceaux et suppression. « Compte connecté » dans le lecteur ne décrivait pas la lecture. Le mini-lecteur pouvait associer un morceau sans image à la pochette d’une autre playlist sélectionnée.

## Choix retenus

- En-tête court, carte de compte compacte et configuration repliée. Connexion, reconnexion, réautorisation et déconnexion sont conservées. Dans Expo Go, une explication remplace le bouton de connexion inutilisable ; la configuration reste accessible.
- Lecteur remonté pour un compte connecté : métadonnées réelles, état de lecture, position reçue, appareil, commandes et motif d’indisponibilité. Les contrôles morts d’un lecteur non connecté ne prennent plus la place principale.
- Bloc « Pour la prochaine course » séparé du lecteur. Choisir une playlist ne signifie pas qu’elle joue. Un rapprochement avec la lecture n’est affiché qu’avec un état récent et un `contextUri` identique. « Lancer cette playlist » conserve l’action existante ; les options de départ regroupent lancement automatique et absence de sélection.
- Ajout par lien avec champ nommé, collage explicite, URI toujours acceptées et état d’ajout propre à cette action. Le champ reste stable pendant l’import ; une réponse tardive du presse-papiers ne remplace pas une saisie plus récente.
- Cartes réutilisables pour playlists enregistrées et playlists du compte. Nom, propriétaire et nombre d’éléments sont fournis par l’API lorsqu’ils existent. Sans métadonnées, seule une référence identifiable est affichée. Le menu révèle le nom complet, les morceaux, l’URL et le retrait confirmé de Sprinter.
- Vue des morceaux adossée à l’API existante, avec retour, pagination, erreurs et nouvelle tentative. Un identifiant de requête invalide les réponses après fermeture, changement de playlist, déconnexion ou démontage ; une réponse ancienne ne peut plus rouvrir la mauvaise liste.
- Mini-lecteur partagé : texte et commandes sur deux rangées, état de lecture explicite et distinction entre métadonnées du morceau et sélection future. Les confirmations avant une ouverture externe pendant une course limitée au premier plan sont conservées.

## États présentés

| Donnée disponible | Présentation |
| --- | --- |
| Initialisation | Chargement |
| Compte absent / autorisation expirée | Non connecté / À reconnecter ; liens utilisables |
| Compte connecté, réponse sans lecture | Lecture inactive |
| Aucune réponse récente | Lecture non synchronisée / État à actualiser |
| Commande envoyée | Commande en cours ; pas de succès anticipé |
| Réponse récente avec lecture | Lecture en cours |
| Réponse récente avec morceau en pause | En pause |
| Publicité signalée | Publicité Spotify ; restrictions conservées |
| Playlist choisie | Sélection pour la prochaine course, indépendante du lecteur |

`presentation.ts` décrit seulement ces états. Une information dépassant quinze secondes, marquée ancienne ou en attente de commande n’est pas présentée comme une lecture active confirmée. La position n’est pas interpolée. Aucun minuteur, polling supplémentaire ou changement optimiste de lecture n’a été ajouté. `controlReason` reste la source des permissions de commande.

## Composants et périmètre

`Music.tsx` compose `ConnectionCard`, `PlaylistCard` et le lecteur partagé. Couleurs, typographie, cartes, champs, boutons et espacements viennent du design system. Les contenus passent en colonne avec les grands caractères ; les actions ont une cible d’au moins 44 points. Les états sont nommés et ne dépendent pas seulement de la couleur. Le bas de page utilise l’inset mesuré de la navigation.

Les logos officiels noir/blanc sont conservés. Les pochettes restent entières, sans superposition ni traitement, avec un petit rayon de 4 ; les noms complets restent accessibles. Ces choix s’appuient sur les [consignes de présentation Spotify](https://developer.spotify.com/documentation/design). Les commandes de lecture conservent les exigences Premium et d’autorisation de l’[API officielle](https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback).

Stockage, schéma des préférences, OAuth, API, limitations réseau, moteur de session et session audio restent identiques. Aucun fichier musical, SDK de streaming, serveur ou dépendance ajouté. Les écrans course en direct et préparation ne sont pas modifiés ; ils utilisent le mini-lecteur partagé amélioré.

## Vérification et limites

TypeScript et compilation avec `--noUnusedLocals --noUnusedParameters` réussis sous Windows. Les résultats des exports sont consignés dans [VALIDATION.md](VALIDATION.md).

**Aucun test créé, modifié ou exécuté.** Aucun jeu de données fictif, connexion à un compte réel ou rendu navigateur/iPhone vérifié. Les compilations ne démontrent pas l’absence de régression visuelle ou fonctionnelle. Aucun build Swift ni IPA signé effectué.

Restent à examiner sur iPhone : petits écrans, clair/sombre, grands caractères et VoiceOver ; import/collage, sélection et retrait ; retour depuis les morceaux ; affichage des états Spotify, commandes autorisées et refusées, expiration et pertes de réseau ; ouverture externe en course. La connexion réelle exige la configuration Developer et la page de retour HTTPS déjà prévues, puis une version de développement installée. Dans Expo Go, le parcours par lien reste le mode prévu.
