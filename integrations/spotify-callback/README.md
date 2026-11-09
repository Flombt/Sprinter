# Retour HTTPS Spotify

Cette page termine le retour HTTPS de la Web API dans la session native Sprinter. Elle ne contient aucun secret, n’échange pas de jeton et n’a pas besoin de serveur applicatif.

1. Héberger `index.html` sur un domaine HTTPS que vous contrôlez, par exemple sous `/spotify-callback/`. L’exemple n’est pas une adresse préconfigurée.
2. Servir la page sans authentification préalable, scripts tiers, analytics ou ressources externes. Configurer `Cache-Control: no-store` et `Referrer-Policy: no-referrer`. `_headers` est fourni pour les hébergeurs qui comprennent ce format ; adapter les en-têtes autrement.
3. Désactiver les journaux contenant les paramètres de requête sur cet emplacement : le code d’autorisation temporaire et protégé par PKCE transite dans l’URL. Ne pas transmettre cette URL à un outil d’analyse.
4. Déclarer **l’adresse HTTPS exacte**, barre finale comprise, dans les Redirect URIs de Spotify Developer.
5. Saisir le Client ID public et cette adresse dans **Musique → Configuration de la connexion**.
6. Utiliser la version iPhone installée, qui déclare déjà `app.sprinter.running`. La page retourne à `app.sprinter.running://spotify-callback`. **Ce schéma interne n’est pas l’URI à enregistrer dans Spotify Developer.**

La destination native est fixe. La page retire les paramètres de l’historique visible, n’affiche pas leur contenu et fournit un bouton si l’ouverture automatique est bloquée. Sprinter vérifie le retour, `state` et PKCE, puis échange le code avec l’URI HTTPS originale. Garder cet emplacement sous votre contrôle et servir la page intacte.

Aucun domaine, déploiement ou compte n’a été configuré pendant le Module 5. Aucun test de cette page n’a été effectué, conformément à la consigne. Voir [la règle Spotify](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri) et [le rapport audio](../../docs/AUDIO.md).
