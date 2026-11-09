# Module 8 — outils de course avancés

Développement sous Windows pour l’application iPhone Expo SDK 58 existante. Aucun test, parcours simulé, fichier d’essai, appel météo géolocalisé, lecture audio, partage effectif ou essai physique n’a été effectué pour cette livraison. Les seules vérifications exécutées sont les compilations TypeScript, du bundle JavaScript/Hermes iOS et de la syntaxe du plugin JavaScript. Le Swift ajouté doit encore être compilé dans un véritable build iOS.

## Existant réutilisé

L’application disposait de Core Location via Expo Location, d’un filtre GPS avec ruptures explicites, de deux chronomètres, d’un coach avec file d’annonces, de SQLite, d’une carte Apple via React Native Maps, d’un historique analysé et des exports GPX/CSV. Ces composants restent en place. Il manquait les favoris, l’import d’un tracé externe, la proximité à un parcours choisi, un métronome, une source de cadence, une consultation météo et une préparation des copies publiques.

Les nouveaux outils sont accessibles depuis les **Réglages**, la préparation et le détail d’une sortie. Le détail permet d’enregistrer le tracé en favori et de le choisir pour une prochaine course. Les outils ne sont ni une condition de démarrage ni une source alternative des compteurs sportifs.

## Parcours locaux et import GPX

`src/routes/` sépare les modèles, la validation, la géométrie, l’import, la proximité et la persistance. `sprinter-tools-v1.db` contient les favoris dans des lignes séparées et les petites préférences dans une autre table. Les schémas des bases historiques ne changent pas. Un `routeId` et un nom optionnels lient une course à un favori ; ils ne modifient ni distance, ni chrono, ni calculs d’allure. Une ancienne activité reste lisible sans ces champs.

Un favori provenant de l’historique reprend les seuls segments qualifiés par le moteur d’analyse. Les portions manquantes ne sont pas raccordées. La géométrie d’un GPX est enregistrée comme itinéraire, jamais comme activité passée : les dates, performances, fréquences cardiaques et extensions du fichier ne créent pas de statistiques sportives. Les traces `trk/trkseg/trkpt` et itinéraires `rte/rtept`, avec préfixes XML éventuels, sont pris en charge ; les points isolés ne deviennent pas des segments navigables.

Le sélecteur système utilise [Expo DocumentPicker](https://docs.expo.dev/versions/latest/sdk/document-picker/), installé dans la version compatible SDK 58. Le fichier est copié dans le cache, limité à 2 Mo et lu localement. La suppression de la copie ne vise que le cache de l’application, jamais l’original du fournisseur de documents. Le parseur JavaScript [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) est verrouillé par le fichier npm. Les DTD et déclarations d’entités sont refusées, le traitement des entités est désactivé, la profondeur limitée à 32 niveaux et le nombre de positions à 20 000.

Les coordonnées invalides rompent les segments. Les liaisons de plus de 1 km sont retirées et signalées ; les positions stationnaires redondantes sont compactées pour un itinéraire. L’interface présente le tracé et ses avertissements avant de proposer son enregistrement. La longueur est une estimation géométrique sur les seules liaisons conservées. La bibliothèque est limitée à 50 favoris et 200 000 points au total. Un favori peut être nommé, consulté, partagé, choisi pour une prochaine sortie ou supprimé ; supprimer ce favori ne supprime aucune course historique.

Le choix du tracé et sa tolérance se font entre deux courses. Un favori utilisé par la course actuelle ne peut pas être supprimé. Ses coordonnées ne sont pas modifiées après création ; renommer un favori ne remplace pas le nom enregistré dans une ancienne sortie. Après récupération, le moteur reste en pause comme auparavant. Si le favori référencé manque sur l’appareil, la course continue sans guidage.

## Navigation de proximité

Dans la version native intégrant le Module 7, les bases SQLite, dont les favoris et leurs préférences, sont exclues de la sauvegarde iCloud de l’application. Le partage explicite d’un GPX dans Fichiers permet de conserver une copie de l’itinéraire ; les réglages personnels ne sont pas inclus dans cet export.

`TraceNavigator` calcule la distance au segment géodésique le plus proche, avec bornes aux extrémités. Il respecte les coupures du tracé et les longitudes à proximité de l’antiméridien. Il ne demande ni réseau ni second service GPS. L’observateur reçoit les positions déjà acceptées par la course et travaille au plus toutes les cinq secondes. La carte superpose la référence bleue et la trace enregistrée verte ; ses fonds dépendent toujours des tuiles disponibles et du réseau/cache Apple.

L’avertissement exige une précision horizontale de 15 m au maximum, réduite à un tiers de la tolérance si celle-ci est plus petite, une position récente et dix secondes d’écart confirmé. La marge de précision est soustraite avant de conclure à un éloignement. Le retour emploie un seuil inférieur et une confirmation de cinq secondes. Les répétitions d’éloignement sont espacées, avec temporisation supplémentaire après un premier signal. Les pauses et pertes GPS annulent les confirmations en cours ; une position ancienne ne déclenche pas d’avertissement.

Les événements `routeOff` et `routeBack` passent par le coach central et sa catégorie configurable « Écart au parcours ». Les annonces opposées en attente se remplacent, un retour peut interrompre une annonce devenue contradictoire et les interruptions GPS annulent les annonces de navigation. Les règles habituelles de niveau, volume, priorité et espacement s’appliquent. Sans signaux autorisés, le panneau visuel reste disponible.

Ce guidage n’est pas un calcul d’itinéraire : aucune instruction de virage, aucun recalcul routier, aucune garantie de passage ou d’accès. Aux croisements et dans les boucles, il indique la proximité à une portion du tracé, sans inventer un progrès univoque sur le parcours. Il ne mesure ni danger, ni fréquentation, ni qualité du sol. La distance de course reste entièrement calculée par le moteur GPS existant.

## Métronome et coordination audio

Le métronome est désactivé initialement. Sa cible est réglable de 80 à 220 bpm par pas de cinq, avec volume réglable ; un clic correspond à un pas visé. Il génère localement un fichier PCM de huit clics dont les positions sont calculées en échantillons, puis confie la boucle au lecteur natif Expo Audio. JavaScript ne programme pas chaque battement. Les fichiers sont mis en cache par tempo. La précision audible, les transitions de tempo, les limites du volume et la boucle restent à vérifier matériellement.

`src/services/audioSession.ts` coordonne les demandes audio de Sprinter. Les signaux et la voix du coach prennent la priorité ; le métronome est suspendu durant leurs sorties, puis peut reprendre en mélange avec la musique. L’arrêt d’une alerte ne désactive pas arbitrairement un autre lecteur Sprinter encore propriétaire de la session. Les pauses, la fin de course ou la déconnexion de l’observateur arrêtent le métronome et libèrent ses ressources. Les erreurs restent propres aux outils et ne remontent pas au writer GPS.

La lecture audio de fond n’est tentée que pour une course toujours active dont le suivi de fond est réellement actif. Il n’existe aucun son silencieux destiné à maintenir le processus. Expo Go conserve sa règle de pause lorsque la course quitte le premier plan. Le métronome n’est pas proposé comme lecture fiable dans l’aperçu web. Les limites et interruptions restent celles d’[Expo Audio](https://docs.expo.dev/versions/latest/sdk/audio/) et d’iOS ; aucun contrôle supplémentaire de Spotify n’est ajouté.

## Cadence réellement estimée

Le tempo du métronome est toujours présenté séparément de la **cadence Core Motion en pas/min**. Aucune cadence n’est calculée à partir de l’allure, de la distance GPS, d’un tempo choisi ou d’une longueur de foulée supposée.

Le module local `SprinterCadence` utilise `CMPedometer.currentCadence` lors des mises à jour en direct et convertit les pas/seconde en pas/min. Apple décrit cette valeur facultative dans [currentCadence](https://developer.apple.com/documentation/coremotion/cmpedometerdata/currentcadence) ; elle peut manquer, notamment pour les requêtes historiques ou sur un appareil incompatible. Le code vérifie la disponibilité, l’autorisation, les bornes techniques, la fin d’intervalle et l’ancienneté de l’observation. Une mesure absente ou vieille de plus de dix secondes reste « — ».

L’autorisation de mouvements est demandée seulement après une action explicite. Une brève requête native déclenche la demande système ; son résultat historique n’est pas utilisé comme cadence. Le plugin ajoute `NSMotionUsageDescription`, et le pod inclut CoreMotion. La collecte continue n’est démarrée que pendant une course active au premier plan, puis arrêtée en pause, à la sortie du premier plan et en fin de course. La cadence actuelle n’est ni archivée ni envoyée dans Santé ou vers un autre service dans cette livraison.

Cette source nécessite une **reconstruction du binaire iOS**, y compris après le Module 7. Expo Go conserve le métronome, mais n’inclut pas notre module de cadence. Aucune autorisation de fréquence cardiaque ni application Watch n’est ajoutée. Le Swift et le comportement du capteur n’ont pas été validés sous Windows.

## Météo facultative et consentement

`WeatherProvider` sépare le service de l’interface. Avant le départ, un bouton déclenche une consultation pour le début du favori choisi ou pour une position locale obtenue avec accord. La position n’est envoyée qu’après cette action, arrondie au centième de degré ; ni tracé, nom, identifiant de course, position exacte, compte Santé ou cadence n’est transmis. Aucun rafraîchissement continu. L’attente de position et la requête disposent de délais et sont annulées en quittant l’écran ; la course peut être démarrée indépendamment.

L’adaptateur utilise les champs courants du modèle [Open-Meteo](https://open-meteo.com/en/docs) : température en °C, précipitations en mm sur l’intervalle indiqué, vent et rafales en km/h, code de conditions générales. Les unités, valeurs et dates sont contrôlées. La source, l’heure du modèle, l’heure de consultation et les données anciennes sont affichées. Le cache reste en mémoire dix minutes pour une même zone ; une panne ou un refus reste une absence de météo, sans valeur fictive.

Les remarques de prudence concernent les conditions annoncées : chaleur, froid/gel, pluie, vent et orages possibles. Elles sont présentées comme indications modélisées, sans conclure à la sécurité du parcours ou remplacer les vigilances locales. Ce module ne fournit ni alerte d’urgence ni prévision exhaustive.

Les [conditions d’Open-Meteo](https://open-meteo.com/en/terms) réservent son endpoint gratuit aux usages non commerciaux. Il est donc branché uniquement pour l’usage personnel **en développement** (`__DEV__`, notamment Metro/Expo Go et client de développement). Dans un bundle distribué, aucun appel à cet endpoint gratuit n’est effectué et l’interface affiche le service non configuré. Avant une diffusion commerciale, fournir un adaptateur avec licence et authentification adaptées, gérer ses éventuels secrets hors du bundle public et mettre à jour la déclaration de confidentialité. Aucun abonnement, clé, serveur ou appel météo réel n’a été configuré ici.

## Partage, statistiques et zones privées

Les contrôles sont regroupés dans le détail de la course et dans le favori. La copie publique est le choix initial, avec rayon de 300 m, réglable entre 100 et 2 000 m autour des extrémités. Une copie complète exige de désactiver explicitement ce masquage dans l’interface. Le choix ne modifie jamais l’historique local. Un aperçu affiche la copie choisie ; seul cet aperçu cartographique peut être simplifié pour le rendu, jamais le contenu exporté.

Le masquage retire les positions à l’intérieur des deux zones, même lorsqu’une portion intermédiaire y revient, et rompt aussi une liaison entre deux positions extérieures qui traverserait une zone. Aucune nouvelle position de bord n’est calculée. Les interruptions et portions supprimées ne sont pas reconnectées. Pour une activité, les extrémités qualifiées et les premières/dernières positions enregistrées contribuent aux zones de protection. Si tout le tracé est masqué, le GPX est refusé avec une explication, sans réactiver silencieusement la copie complète.

Le GPX public ne contient que les coordonnées restantes, un nom générique et les segments : aucun UUID, date, horaire, décompte kilométrique cumulatif, note ou nom de favori. Le CSV public utilise les mêmes portions géographiques, sans compteurs par position ni horaires ni source identifiante. Ses compteurs de résumé restent ceux de la course entière, ce que l’écran précise. La copie complète d’une activité conserve le GPX/CSV détaillé existant avec mesures et horaires ; un favori géométrique n’obtient pas d’horodatages artificiels.

Le résumé textuel ne contient ni position ni horaire de départ. Ses distance, temps actif/total, allure et pourcentage en cible viennent de l’analyse réelle. Le CSV de statistiques sans positions ajoute les extrema fiables, dénivelés, couvertures, écarts et leur durée ; les données manquantes restent vides avec l’état `unavailable`. Ses identifiants, sources et dates ne sont ajoutés que pour une copie privée. Les textes CSV sont échappés et protégés contre une interprétation comme formule de tableur.

La feuille de partage système est toujours déclenchée par la personne. Les fichiers sont écrits dans le cache de Sprinter ; ils peuvent ensuite être conservés explicitement dans Fichiers. Le masquage réduit l’exposition de certaines zones sans garantir l’anonymat ou effacer le contexte d’une publication effectuée ailleurs. Aucun réseau social, lien de suivi en direct, publication automatique ou transmission de parcours à un serveur Sprinter n’a été ajouté. Le fournisseur de carte peut toujours recevoir les demandes de tuiles nécessaires à son affichage.

## Préparation Strava, sans synchronisation active

`src/integrations/strava.ts` définit le consentement par activité, un document d’envoi, un identifiant stable et un reçu de traitement asynchrone. Aucun transport, OAuth, secret, stockage de jeton ou bouton de connexion n’est implémenté. Les routes et statistiques ne sont pas envoyées à Strava.

Une future implémentation devra respecter l’[authentification officielle](https://developers.strava.com/docs/authentication/), vérifier les scopes effectivement accordés, protéger l’échange nécessitant un secret, supporter la révocation, les quotas, les conditions d’utilisation et les doublons. Les [uploads Strava](https://developers.strava.com/docs/uploads/) exigent des horodatages de points et un suivi du traitement. Le contrat refuse donc de transformer un GPX public sans horaires en upload complet : une future solution compatible devra demander un nouveau choix explicite, sans contourner le masquage.

## Compilation et limites restantes

`npm start` conserve le client Expo Go. Les favoris, import GPX, exports, guidage de proximité et métronome utilisent les API déjà présentes dans ce client ou DocumentPicker ; leur comportement reste à vérifier sur téléphone. La météo est facultative en développement. Pour la source de cadence, reconstruire et installer un client de développement iOS incluant le module Swift et le plugin, puis utiliser `npm run start:dev`. Aucun build EAS ni Xcode n’a été lancé.

Aucun test n’a été créé, modifié ou exécuté. Restent à vérifier physiquement : fournisseurs de fichiers et GPX réels, ruptures et conservation des favoris, trajets avec croisements et GPS dégradé, masquage de boucles revenant au départ, contenu exact des fichiers et feuille de partage, régularité audible et consommation du métronome, pauses/annonces/appels/casque/Spotify, permission et fraîcheur de Core Motion, consultation météo consentie et annulation, fonctionnement hors ligne et comportement lors du verrouillage. Les compilations sous Windows ne remplacent pas ces vérifications.
