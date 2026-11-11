# Installer Sprinter sur un iPhone avec un compte Apple gratuit

Cette variante personnelle est un IPA **non signé**, compilé pour un véritable iPhone en mode Release avec son JavaScript intégré. Le PC et Metro ne sont pas nécessaires pour utiliser l’app après installation.

## Installation depuis Windows

1. Télécharger et extraire le résultat **Sprinter-unsigned-ipa** du workflow GitHub. Garder le fichier **Sprinter-unsigned.ipa** et son empreinte SHA-256.
2. Installer AltServer sur Windows et AltStore Classic sur l’iPhone en suivant le [guide officiel](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows).
3. Signer et installer l’IPA avec votre propre compte Apple gratuit via AltStore Classic. Le fichier non signé ne s’installe pas directement depuis Safari ou Fichiers.
4. Renouveler la signature avant son expiration de sept jours, selon les instructions d’AltStore. L’iPhone peut demander l’activation du mode développeur.

Ne placer aucun identifiant Apple, mot de passe ou code de validation dans GitHub, le code source ou les commentaires. L’authentification Apple s’effectue dans l’outil d’installation sur votre ordinateur.

## Fonctions de cette variante

- Course GPS, allure précise, coach, historique, playlists et exports locaux conservés.
- Santé, groupe d’application et extension Live Activity désactivés pour cette variante. La configuration normale reste disponible pour une future version signée avec les droits Apple correspondants.
- La cadence Core Motion conserve sa permission dédiée.
- Les vibrations restent limitées au premier plan ; le suivi GPS verrouillé conserve ses réglages et doit être validé physiquement sur iPhone.
- La connexion et les commandes Spotify nécessitent toujours leur configuration OAuth et les autorisations du compte.

La compilation et les vérifications du paquet ne constituent pas une recette physique. La signature gratuite impose les limites Apple et ne permet pas une publication App Store ou TestFlight.

## Reconstruire

Le workflow **Build unsigned iPhone IPA** utilise un Mac hébergé par GitHub, avec Xcode 27 et Node 24. Il se déclenche sur la branche **codex/ipa-sideload**, ou manuellement après son intégration sur la branche principale. Aucun certificat Apple ni secret de signature n’est nécessaire pour compiler ce paquet non signé. Les compilations utilisent le quota GitHub Actions du dépôt privé.
