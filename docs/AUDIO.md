# Module 5 — coach audio et Spotify

## Évolution du Module 8

Les signaux et la voix partagent maintenant `src/services/audioSession.ts` avec le métronome facultatif. Les annonces suspendent cette boucle, puis la session peut revenir au mélange musical. La fin d’un signal ne désactive plus un autre lecteur Sprinter encore actif. Le coach ajoute une catégorie « Écart au parcours », disponible aussi dans le préréglage discret, avec remplacement des annonces opposées et annulation des alertes de navigation devenues invalides. Les détails et limites figurent dans [TOOLS.md](TOOLS.md). Aucun test audio ni essai physique n’a été effectué pour cette évolution.

## Analyse initiale

Le projet possédait déjà cinq sons locaux, les signaux d’allure confirmés, des haptiques, une file de coaching et la voix facultative. Spotify disposait de PKCE, SecureStore, l’import de liens, la sélection avant course, des commandes officielles et du morceau courant. Le moteur GPS et Spotify étaient indépendants. Ces fonctions sont conservées ; les ajouts portent sur la configuration, les annonces et leur arbitrage, puis sur les erreurs et permissions musicales.

## Réglages

Activer **Signaux audio**, puis **Voix du coach** dans Réglages pour les messages parlés. **Niveau et annonces** regroupe les préréglages, les types, leurs intervalles et priorités. Les aperçus des signaux se trouvent dans **Reconnaître les signaux**. Le réglage vocal existant reste partagé avec Séances : aucune préférence concurrente n’a été créée. L’audio et la voix ne sont pas activés automatiquement chez les utilisateurs existants. Voir [SETTINGS_UI.md](SETTINGS_UI.md).

| Niveau | Préréglage |
| --- | --- |
| Discret | Écarts d’allure confirmés, avertissements/résultats des défis et fins de séance/course |
| Normal | Ajoute retour en cible, distance, avance/retard, étapes, répétitions et anticipation |
| Complet | Ajoute les bilans périodiques de progression |

Chaque catégorie peut ensuite être activée ou désactivée, avec un intervalle minimal et une priorité basse, normale ou haute. L’espacement global est réglable de 3 à 30 s ; les valeurs initiales sont 15, 8 et 6 s selon le niveau. Les paliers de distance sont 500 m, 1 km, 2 km ou 5 km. Changer de niveau réapplique son préréglage. Modifier le contenu arrête la sortie en attente et applique les choix immédiatement.

Une fréquence ne fabrique pas un événement : les mesures fiables et confirmations restent nécessaires. Les annonces chronométriques ne dépassent pas la fréquence de leur moteur source, actuellement une minute. Les résultats finaux conservent une priorité réservée ; ils peuvent passer après deux secondes plutôt que l’espacement ordinaire, et ne sont pas répétés. La confirmation après sauvegarde d’une course repart d’une file vide. Les paramètres GPS et de confirmation restent appliqués au départ de la prochaine course.

Les réglages sont normalisés et conservés dans le stockage existant. Sans ancien champ de coaching, le niveau Normal est utilisé. Aucune nouvelle table n’est nécessaire.

## Annonces

- **Accélérer/ralentir** : événements confirmés du moteur, recontrôlés selon la classification actuelle avant mise en file.
- **Bonne plage retrouvée** : après un écart confirmé, quatre secondes continues dans la cible effective avec allure fiable. La marge silencieuse seule ne suffit pas ; pause et signal dégradé coupent cette continuité.
- **Distance** : palier de distance réellement enregistrée. Un lot GPS ne produit pas un récit de tous les anciens kilomètres. Changer le palier ou récupérer l’app ne rejoue pas le passé.
- **Avance/retard** : capital calculé par le Module 2, soumis à ses critères de fiabilité, sans estimation inventée sur une distance interrompue.
- **Blocs/répétitions** : événements du moteur de séance, avec nom, répétition et cible. L’introduction et le premier bloc sont regroupés ; une nouvelle étape supprime les consignes périmées.
- **Transition proche** : anticipation autour de dix secondes. La durée utilise le temps actif ; une fin par distance utilise l’allure fiable et dit « environ ». Une condition en cible n’est pas prédite. Le message expire après au plus 1,5 s pour éviter un compte à rebours trompeur.
- **Fin de séance/résultat de défi** : regroupés si simultanés. Ils ne terminent pas le GPS. **Fin de course** : confirmation seulement après sauvegarde réussie, sans attendre l’audio pour rendre la main.
- **Progression complète** : distance réelle, temps actif et allure fiable, sans doubler une annonce de distance simultanée.

## Arbitre et interruptions

`src/coaching/config.ts` définit les règles pures ; `progress.ts` observe les compteurs. La file existante dans `src/workouts/events.ts` reste l’unique file de course et de séance : seize éléments au maximum, priorités effectives, dédoublonnage et expiration. Les consignes opposées d’allure, d’avance et de retard ne restent pas simultanément en attente.

`src/workouts/coaching.ts` conserve l’arbitre physique unique. Il préempte les messages devenus contradictoires, écarte les anciens callbacks et interrompt une consigne au changement d’étape approprié. Les lots GPS sont traités avant un seul passage dans le coach avec le chronomètre à jour. Pause, auto-pause, récupération et changements d’état effacent ou rebasent les annonces sans rattrapage vocal.

La voix reste au premier plan. L’état inactif interrompt la sortie audio et empêche une nouvelle annonce ; le GPS conserve ses règles propres. Une annonce vocale est bornée à vingt secondes. Une erreur vocale peut employer le son local correspondant, sans rejouer une sortie annulée. Un échec haptique ne bloque pas l’audio et un arrêt de lecteur défaillant ne remonte pas dans le traitement GPS.

## Coexistence audio et haptiques

Les sons courts demandent une baisse temporaire des autres sources via `duckOthers`, puis relâchent leur session. Un garde-fou de huit secondes libère aussi la session si la fin du lecteur manque. Aucun son silencieux ne maintient artificiellement cette session. [Expo Audio](https://docs.expo.dev/versions/latest/sdk/audio/)

La voix utilise `useApplicationAudioSession: false` pour laisser iOS gérer une session distincte et le mélange. Le coach n’envoie jamais pause/lecture à Spotify et ne modifie aucun fichier musical. Le mélange effectif, le volume après annonce, les appels et le Bluetooth restent à vérifier sur appareil. Sur iPhone, le mode silencieux peut rendre Expo Speech inaudible. La voix écran verrouillé n’est pas promise. [Expo Speech](https://docs.expo.dev/versions/latest/sdk/speech/)

Au premier plan : deux impacts forts pour ralentir, vibration système pour accélérer, sélection légère pour la distance, impact moyen pour les transitions et notifications système pour réussite/échec/retour en cible. Il n’y a pas de forme d’onde Core Haptics personnalisée. iOS peut supprimer les effets selon les réglages ou l’économie d’énergie. **Aucune vibration personnalisée écran verrouillé n’a été validée.** [Expo Haptics](https://docs.expo.dev/versions/latest/sdk/haptics/)

## Spotify

Les fonctions existantes sont conservées. Précédent est ajouté au mini-lecteur. Les commandes ciblent l’appareil de l’état Spotify récent ; une réponse incertaine marque l’état ancien et ne déclenche pas de répétition automatique d’une commande. Les titres et positions restent ceux de Spotify, sans progression fabriquée.

Les scopes accordés sont connus de l’état musical. Les droits manquants demandent une réautorisation. `user-read-private` est ajouté pour les informations d’abonnement lorsqu’elles sont fournies ; un champ absent ne prouve pas Premium. Une reconnexion invalide les anciennes opérations et une réponse d’une ancienne session ne peut pas déconnecter la nouvelle. [Scopes Spotify](https://developer.spotify.com/documentation/web-api/concepts/scopes), [PKCE](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow)

Le lecteur visible au premier plan conserve son sondage de cinq secondes. Après perte réseau : attentes de 10, 20, 40 puis 60 s, et respect du délai imposé par un 429. Les 401/403 de lecture arrêtent le sondage automatique. Le retour au premier plan invalide les réponses anciennes et resynchronise sans relancer automatiquement une musique mise en pause. Le démarrage facultatif avec la course évite de redémarrer une playlist déjà confirmée en lecture.

La Web API demande une redirection HTTPS. La configuration comprend maintenant le Client ID public et l’adresse exacte d’une page de retour à héberger. `integrations/spotify-callback/` fournit cette page : elle relaie code temporaire et `state` vers le schéma interne Sprinter, sans échanger de jeton. L’app vérifie le retour et PKCE, et conserve l’URI HTTPS originale pour l’échange. Aucun domaine ou hébergement n’a été inventé ou publié. [Redirections Spotify](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri)

Les commandes Web API nécessitent Premium et un appareil autorisé ; les refus et quotas restent gérés. Le mode développement demande un propriétaire Premium et des comptes autorisés, dans ses limites propres. Aucun fichier musical Spotify n’est téléchargé ou copié. [Lecture officielle](https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback), [quotas](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)

OAuth reste désactivé dans Expo Go ; une version de développement installée est nécessaire pour le retour natif. L’import de liens reste disponible sans connexion. Client ID, domaine HTTPS et compte réel restent à configurer. Voir [SPOTIFY.md](SPOTIFY.md) et le guide du dossier de retour. [Authentification Expo](https://docs.expo.dev/guides/authentication/)

## Vérifications du 1er novembre 2026

Conformément à **« NE FAIS PAS DE TEST »**, aucun test n’a été créé, modifié ou exécuté. Aucun son d’essai, compte Spotify, parcours simulé, essai d’interface ou iPhone physique n’a été utilisé. Les anciens tests ne valident pas ces ajouts.

Les seules vérifications sont `npm run typecheck` et `npm run export:ios` sous Windows, réussis : bundle iOS Hermes de 1 039 modules, environ 2,8 Mo. Aucun build Xcode, IPA signé ni hébergement de la page de retour n’a été réalisé. La compilation ne démontre pas le résultat acoustique.

Restent à vérifier sur iPhone : ordre et espacement, changements de bloc pendant une phrase, mode silencieux, Bluetooth/appels/débranchement, remontée du volume après erreur, haptiques, verrouillage dans une version installée et véritable OAuth via HTTPS avec compte autorisé, abonnement et pertes réseau.
