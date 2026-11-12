# Identité Sprinter — Performance

La navigation principale comporte trois onglets, dans cet ordre :

- **Stats** : temps actif, distance, allures actuelle et moyenne, objectif, vibrations et signaux audio.
- **Courir** : départ avec compte à rebours annulable, puis distance, chronomètre, pause, reprise et enregistrement.
- **Spotify** : import d’un lien, sélection des playlists enregistrées et lecteur lorsque le compte connecté le permet.

Les réglages avancés et l’historique restent accessibles par leurs boutons secondaires. La nouvelle identité associe le carbone `#101011`, le blanc craie `#F2F0E9` et l’orange `#FF5C35`. Les chiffres et les titres utilisent Barlow Condensed, embarquée localement avec sa licence OFL dans `assets/fonts/` ; les informations et les commandes utilisent la police système.

Les surfaces claires mettent les données principales au premier plan. Les cartes secondaires sont compactes ; les actions et la sélection de navigation utilisent l’orange. Les grandes orbites et les dégradés ont été retirés. Les transitions durent 200 ms ; la navigation conserve un verre discret sur iOS compatible. Les préférences de réduction des animations et de la transparence sont respectées.

L’allure cible et la distance se choisissent avant le départ. Les vibrations et les signaux audio restent modifiables pendant la course. Les données affichées viennent des services existants ; aucune activité ni playlist fictive n’est ajoutée.

Le départ simple propose une [allure précise](ALLURE_PRECISE.md), sans marge, par défaut 5′00″/km. Les plages d’allure restent disponibles dans la préparation.

## Fonctions préservées et vérification

La préparation avancée et le départ rapide partagent la séance, le calendrier, la chaussure et le parcours. Les panneaux de séance, navigation, carte, progression et rythme restent disponibles dans Stats. Spotify propose les morceaux et les options du lecteur à la demande. Le thème peut suivre le système ou être choisi dans les réglages. L’icône et le lancement reprennent le signe de vitesse orange.

Les contrôles actuels, la stabilisation des données et les limites iPhone sont consignés dans [le bilan du 11 novembre](STABILISATION_2026-11-11.md).

Aperçus vérifiés : [Courir](../artifacts/stabilisation-home.jpg), [Stats](../artifacts/stabilisation-stats.jpg), [Spotify](../artifacts/stabilisation-spotify.jpg).

La version web compilée est servie localement sur le port 8082. La compilation JavaScript iOS ne constitue pas une validation du binaire natif.
