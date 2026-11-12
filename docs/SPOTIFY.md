# Spotify dans Sprinter

## Interface Musique — 2 novembre 2026

Compte, lecteur réel et playlist prévue pour la course sont maintenant séparés. Cartes de playlists réutilisables, configuration repliée, ajout de lien plus lisible et mini-lecteur partagé amélioré. Les services OAuth/API, la persistance et les restrictions de contrôle restent inchangés. Voir le [compte rendu UI](MUSIC_UI.md) pour l’audit, les états affichés et les limites de vérification. Aucun test créé, modifié ou exécuté pour cette évolution.

## Module 5 — état de livraison

Le coach possède trois niveaux et une file commune configurable ; voir [AUDIO.md](AUDIO.md). Spotify conserve les fonctions existantes, avec vérification des scopes, réautorisation, commandes ciblées, exclusion des réponses anciennes et attente progressive après perte réseau. Le mini-lecteur expose aussi Précédent. Le lancement de course ne redémarre pas une playlist déjà confirmée en lecture.

OAuth utilise maintenant une **page de retour HTTPS**. Le schéma natif termine seulement le retour depuis cette page ; il n’est plus présenté comme l’URI Web API à déclarer chez Spotify. La page et les instructions sont fournies dans `integrations/spotify-callback/`. Aucun domaine n’a été hébergé et aucun compte réel n’a été connecté. [Règle Spotify](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri)

**Aucun test créé, modifié ou exécuté pour le Module 5.** Les anciens tests simulés mentionnés plus bas sont historiques et n’ont pas été relancés. Seules les compilations TypeScript et du bundle iOS ont été effectuées.

## Choix technique

L’application existante est développée en React Native / Expo à la demande de l’utilisateur. Cette intégration conserve cette architecture. Le moteur GPS, le chronomètre, le coach et la base des activités ne dépendent pas du module Spotify.

La lecture est assurée par Spotify. Sprinter ne télécharge, ne décode et ne diffuse aucun fichier musical Spotify. Le contrôle intégré utilise la **Web API officielle** ; aucun SDK de streaming ou lecteur web n’est caché dans l’application.

**App Remote iOS n’est pas intégré.** Ce framework natif ne peut pas être ajouté à l’application Expo Go déjà installée. La Web API offre ici l’alternative officielle pour piloter un appareil actif depuis une version installée avec OAuth. Le code ne prétend pas disposer d’une connexion App Remote. [SDK iOS Spotify](https://developer.spotify.com/documentation/ios).

## Utilisation dans Expo Go

1. Ouvrir l’onglet **Musique**.
2. Coller un lien de playlist ou une URI `spotify:playlist:…` et toucher Ajouter.
3. La référence est enregistrée localement et sélectionnée pour la prochaine course.
4. Toucher **Ouvrir la playlist dans Spotify**, lancer la musique dans Spotify, revenir dans Sprinter et démarrer la course.

Sans compte connecté, le titre, la couverture, le propriétaire et le nombre de morceaux restent absents. « Playlist Spotify » est un libellé générique, pas un nom récupéré. Aucun morceau n’est fabriqué. Les liens standard `open.spotify.com`, localisés, intégrables et les URI historiques de playlist sont reconnus. Les liens abrégés officiels `spotify.link` et `spotify.app.link` sont résolus par redirection HTTP sans analyser de page ; si cela échoue, l’interface demande le lien complet.

**OAuth est désactivé dans Expo Go.** Son schéma de retour ne peut pas être personnalisé pour ce projet. Le lecteur affiche donc les commandes indisponibles et leur raison. La [documentation Expo sur l’authentification](https://docs.expo.dev/guides/authentication/) exige une version de développement pour tester ce parcours natif.

## Configurer la connexion sans client secret

Aucun Client ID n’a été fourni. La configuration est prête dans **Musique → Votre compte Spotify → Configuration de la connexion**.

1. Créer votre application dans le [tableau de bord Spotify Developer](https://developer.spotify.com/dashboard), en sélectionnant les usages Web API et iOS applicables.
2. Héberger la page de `integrations/spotify-callback/` sur votre domaine HTTPS, puis déclarer son adresse exacte dans les Redirect URIs de Spotify Developer. La page retourne ensuite vers `app.sprinter.running://spotify-callback`, schéma interne déclaré dans `app.json` pour l’identifiant iOS `app.sprinter.running`. Le code PKCE est échangé avec l’URI HTTPS originale. Voir les [règles de redirection](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri).
3. Ajouter les comptes de test autorisés dans Users and Access.
4. Copier le **Client ID public** et l’adresse HTTPS exacte de la page dans Sprinter. Ne jamais saisir de client secret ni de mot de passe dans Sprinter.
5. Depuis Windows, générer une version iOS de développement avec EAS : `npm run build:ios`. Cette opération nécessite les comptes et droits de signature Expo/Apple appropriés ; elle n’a pas été exécutée ici.
6. Installer cette version, lancer `npx expo start --dev-client`, puis toucher **Connecter Spotify**.

OAuth utilise Authorization Code avec PKCE S256, un vérificateur aléatoire et une vérification de `state` assurés par Expo AuthSession. L’échange du code et le renouvellement passent exclusivement par `accounts.spotify.com`. Les jetons sont conservés dans le Keychain via SecureStore, uniquement lorsque l’appareil est déverrouillé et sans migration vers un autre appareil. Aucun jeton ne figure dans SQLite, localStorage, les états React, les fichiers de configuration ou les journaux applicatifs. La configuration publique et les références de playlists utilisent une base musicale séparée de celle des activités.

Scopes demandés : `playlist-read-private`, `playlist-read-collaborative`, `user-read-playback-state`, `user-modify-playback-state`, et `user-read-private` pour les informations d’abonnement lorsqu’elles sont disponibles. Aucun accès à l’adresse email, aux fichiers audio, à la modification des playlists ou aux données sportives n’est demandé. Les permissions réellement accordées sont conservées ; une ancienne connexion peut nécessiter **Réautoriser Spotify**. Les requêtes concurrentes partagent un seul rafraîchissement de jeton. Une déconnexion ou une nouvelle connexion invalide les anciennes opérations.

## Commandes et états réels

- Les boutons lecture/pause, précédent, suivant et aléatoire appellent les endpoints Player officiels. Les épisodes disposent aussi de sauts de ±15 secondes quand la commande est autorisée.
- Le morceau, l’artiste, l’image, la position et l’appareil proviennent exclusivement d’une réponse Spotify. Une réponse 204 ne crée aucun morceau ni appareil fictif.
- Les commandes nécessitent un appareil actif non restreint et un état récent. Les interdictions `actions.disallows` désactivent chaque action concernée. Une ancienne réponse, une publicité ou un refus ne sont pas assimilés à une autorisation de changer de titre.
- Les commandes Web API exigent Premium. Le champ `product` ayant été retiré de certaines réponses en 2026, l’absence de ce champ n’est jamais interprétée comme la preuve d’un abonnement Premium ; les refus de Spotify sont traités explicitement. [API de lecture](https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback).
- Le lancement avec la course est facultatif, sans changement d’application automatique, et n’est jamais attendu par le moteur sportif. Si Spotify n’est pas prêt, la course démarre quand même. La sélection précédente est mémorisée.
- Lors d’une ouverture explicite de Spotify pendant une course au premier plan uniquement, une confirmation explique que quitter Sprinter suspendra la course. Dans Expo Go, ouvrir Spotify avant de démarrer évite ce changement d’état pendant la séance.

Le lecteur interroge Spotify toutes les cinq secondes seulement lorsqu’il est visible et que l’application est active. À l’arrière-plan, il cesse de sonder le serveur et marque ses données comme anciennes. Au retour, il se resynchronise. Écran verrouillé, les commandes de Spotify et des écouteurs restent la voie prévue ; aucune permanence de contrôle depuis Sprinter n’est annoncée. Spotify recommande également de déconnecter App Remote quand une application native devient inactive. [Cycle de vie App Remote](https://developer.spotify.com/documentation/ios/concepts/application-lifecycle).

## Restrictions Spotify de 2026

Les nouvelles applications en mode développement sont limitées à un Client ID par développeur et cinq comptes autorisés ; leur propriétaire doit avoir Premium. Certaines restrictions d’endpoints ont été différées pour des intégrations existantes : la capacité réelle dépend du Client ID, des autorisations et des réponses reçues. [Annonce Spotify](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security), [quotas](https://developer.spotify.com/documentation/web-api/concepts/quota-modes).

Les listes détaillées utilisent `GET /playlists/{id}/items`. Un 403 n’entraîne ni tentative de récupération via `/tracks`, ni scraping, ni invention de contenu. Le lien de la playlist reste disponible. Les champs `items` de 2026 et `tracks` des métadonnées plus anciennes sont reconnus pour le décompte lorsqu’il existe. [Morceaux des playlists](https://developer.spotify.com/documentation/web-api/reference/get-playlists-items), [changements de février](https://developer.spotify.com/documentation/web-api/references/changes/february-2026).

Une diffusion publique ne peut pas s’appuyer sans vérification sur ce mode de développement. Les demandes d’extension de quota visent actuellement des organisations établies et un service disposant d’une audience importante, avec examen Spotify. La compilation ou la distribution d’un binaire Apple ne vaut pas autorisation Spotify. Aucun agrément Spotify ni examen App Store n’a été obtenu pour ce projet.

## Erreurs, confidentialité et alertes du coach

Un 401 provoque au plus un renouvellement puis exige une reconnexion. Un 403 conserve un message explicite et désactive les commandes refusées. Un 429 respecte `Retry-After` et suspend les nouvelles requêtes ; aucun essai en boucle ne cherche à dépasser un quota. Le mode hors ligne conserve les références sans promettre de piloter Spotify. L’absence de l’application Spotify conduit à son lien HTTPS officiel.

La déconnexion supprime les jetons locaux et retire les métadonnées du compte ; les références expressément enregistrées restent disponibles. Elle ne coupe pas la musique déjà jouée par Spotify et n’arrête pas une course. Pour retirer aussi l’autorisation côté Spotify, utiliser la [page des applications du compte Spotify](https://www.spotify.com/account/apps/).

Les signaux du coach utilisent une courte session audio `duckOthers`, puis désactivent cette session à la fin, à l’annulation ou en cas d’erreur. Ils n’envoient jamais pause/play à Spotify. Les haptiques ne dépendent pas de la connexion musicale. Le résultat acoustique, la remontée du volume, les appels et le Bluetooth nécessitent encore une vérification physique.

Les pochettes ne sont ni recadrées ni superposées avec du texte. Les logos monochromes originaux proviennent du kit Spotify et les contenus sont reliés à Spotify. Les images et métadonnées peuvent être rafraîchies ; les URL de couverture anciennes sont purgées à la restauration après 24 heures. [Règles d’affichage](https://developer.spotify.com/documentation/design).

## Validation

Lors de la livraison Spotify initiale, les tests automatisés employaient des services et comptes **simulés**, sans réseau Spotify réel. Ils couvraient les liens, PKCE/renouvellement, 401/403/429, les métadonnées, commandes HTTP, sélection, persistance, déconnexion, restrictions du lecteur, cycle de vie et libération de la session audio. Ils n’ont pas été relancés pour le Module 5 et ne valident pas ses changements, notamment le retour HTTPS.

Non réalisés : connexion d’un vrai compte, lecture Free/Premium, réception audio dans des écouteurs, installation d’un development build, verrouillage réel de l’iPhone, test de reprise après appel et validation des droits de publication. Aucun Client ID ni compte de test n’était disponible. Voir aussi `VALIDATION.md` pour les contrôles exécutés et le protocole général.
