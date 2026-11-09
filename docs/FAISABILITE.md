# Faisabilité des alertes d’allure

Décision pour cette version : **React Native + Expo SDK 58**, aligné sur le client Expo Go observé dans le journal de connexion. Pas de promesse de vibrations personnalisées écran verrouillé.

| Fonction | Expo Go sur iPhone | Version installée de développement | Validation réalisée |
| --- | --- | --- | --- |
| GPS au premier plan | API disponible | API disponible | Tests simulés, pas de mesure physique |
| GPS en arrière-plan | Non pris en charge | Tâche Expo Location configurée | Non validé sur appareil |
| Deux motifs au premier plan | Deux impacts Expo Haptics / vibration système | Même mécanisme | Non validé sur appareil |
| Deux motifs haptiques écran verrouillé | Non garanti, non essayé par le code | Non garanti, non essayé par le code | Non validé ; aucune garantie publique |
| Deux signaux audio | Fonction implémentée ; limites du client | Mode audio d’arrière-plan configuré | Fichiers générés, lecture physique non validée |
| Historique persistant | SQLite du projet Expo Go | SQLite de l’application | SQL réel testé sous Node ; iOS à vérifier |

## Core Location et Expo Location

[Apple — allowsBackgroundLocationUpdates](https://developer.apple.com/documentation/corelocation/cllocationmanager/allowsbackgroundlocationupdates) décrit la continuité des mises à jour après un démarrage au premier plan, avec la capacité `location` et l’indicateur système. [Apple — CLBackgroundActivitySession](https://developer.apple.com/documentation/corelocation/clbackgroundactivitysession-3mzv3) fournit une session explicite pour l’usage en arrière-plan.

L’API Expo Location utilisée n’expose pas cette session directement. L’implémentation utilise la voie publique `startLocationUpdatesAsync` avec une tâche définie au niveau du module, l’activité fitness, `Accuracy.Highest`, un filtre de distance de 2 m (nul avec l’auto-pause) et l’indicateur système. Des lots différés de trois secondes sont demandés. Les permissions d’arrière-plan sont préparées avant le départ seulement quand la personne active ce mode dans une version compatible. Elles ne sont pas demandées dans Expo Go. Aucun suivi n’est démarré au lancement de l’application.

[Expo — Location](https://docs.expo.dev/versions/latest/sdk/location/) précise que le suivi d’arrière-plan iOS nécessite une version de développement et n’est pas disponible dans Expo Go. La fermeture forcée n’est pas contournée. Si le contexte JavaScript est recréé, Sprinter restaure une course en pause et arrête la tâche résiduelle pour ne pas calculer de durée fictive.

Le SDK 58 expose l’autorisation de précision iOS : Sprinter refuse un démarrage en position approximative et explique comment activer Position exacte. La précision de vitesse Doppler n’est pas fournie dans le type de mesure utilisé. Le code contrôle la précision horizontale, filtre les positions et utilise leurs déplacements sur une fenêtre temporelle. Il ne suppose pas de précision Doppler absente de ce contrat. La vitesse disponible participe au rejet des pointes et à la détection de l’arrêt.

## Haptiques

[Apple — Preparing your app to play haptics](https://developer.apple.com/documentation/corehaptics/preparing-your-app-to-play-haptics) décrit l’arrêt du moteur pour des causes externes, notamment l’arrière-plan. [Apple — applicationSuspended](https://developer.apple.com/documentation/corehaptics/chhapticengine/stoppedreason/applicationsuspended) indique de redémarrer le moteur au retour au premier plan. Une autorisation GPS ne constitue pas une garantie de disponibilité de Core Haptics.

La version Expo utilise [Expo Haptics](https://docs.expo.dev/versions/latest/sdk/haptics/) pour les deux impacts courts (180 ms d’écart) et `Vibration.vibrate()` pour la vibration système unique. Sa durée est déterminée par iOS ; il ne s’agit pas d’une onde Core Haptics personnalisée réglable. Le code n’essaie ces signaux que lorsque l’application est active. Les préférences système et les capacités du téléphone peuvent les empêcher.

## Audio et notifications

[Apple — AVAudioSession playback](https://developer.apple.com/documentation/avfaudio/avaudiosession/category-swift.struct/playback) décrit l’usage audio avec écran verrouillé et le mode `audio`. L’implémentation [Expo Audio](https://docs.expo.dev/versions/latest/sdk/audio/) utilise des fichiers PCM locaux, une session autorisant la lecture en mode silencieux et le mélange avec les autres applications. Il n’y a ni microphone, ni enregistrement audio, ni lecture continue artificielle pour maintenir l’application active.

Deux notes descendantes indiquent de ralentir, une note aiguë prolongée indique d’accélérer. L’utilisateur doit activer l’audio. Le volume nul, une interruption ou le routage Bluetooth peuvent rendre le signal inaudible. Le GPS en arrière-plan doit fournir l’exécution nécessaire au déclenchement ; cette combinaison reste à valider sur appareil, en particulier après plusieurs minutes sans alerte.

[Apple — UNNotificationSound](https://developer.apple.com/documentation/usernotifications/unnotificationsound) expose des sons de notification, pas un motif vibratoire arbitraire. Les réglages de notification, le résumé et les modes de concentration compliquent également une promesse de coaching ponctuel. Aucun droit de notification n’est donc demandé et aucune notification répétitive n’est utilisée comme contournement.

## ActivityKit et apparence iOS

[Apple — Displaying live data with Live Activities](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities) indique qu’une activité en direct ne reçoit pas elle-même de positions GPS. Elle ne remplace pas le service d’enregistrement ni le moteur d’alertes. Le Module 7 fournit maintenant une extension Expo Widgets pour les binaires iOS reconstruits, avec état périmé après interruption. Elle reste indisponible dans Expo Go et n’a pas été validée physiquement. [APPLE.md](APPLE.md) décrit également le module HealthKit, les permissions séparées et la faisabilité Watch.

Le choix Expo Go conserve les écrans React Native. [Expo GlassEffect](https://docs.expo.dev/versions/latest/sdk/glass-effect/) fournit un effet natif quand il est disponible. Il est limité à la barre de navigation, avec repli et respect de Réduire la transparence. Le Module 7 utilise les composants SwiftUI d’Expo UI uniquement pour son extension d’activité en direct. Aucune API iOS 27 fictive n’est utilisée.

## Précision et limites de mesure

Le Module 8 ajoute des favoris et un import GPX locaux, un guidage de proximité indépendant des compteurs sportifs, un métronome natif et des copies publiques avec masquage. La cadence Core Motion reste distincte du tempo cible et exige une nouvelle version iOS installée ; elle n’est pas estimée avec le GPS. La météo est une consultation externe facultative en développement personnel, sans trace transmise. Les capacités, permissions et limites sont décrites dans [TOOLS.md](TOOLS.md). Aucun de ces ajouts n’a été validé physiquement.

Valeurs initiales : précision horizontale ≤ 25 m, ancienneté ≤ 10 s, trou entre mesures ≤ 6 s, vitesse maximale 12 m/s, fenêtre lissée de 20 s avec au moins 8 s et 12 m. Ces valeurs sont des réglages initiaux, pas une certification de précision. Une cible très étroite (10 s/km) doit être calibrée dehors, avec différents téléphones, parcours et conditions de réception. La distance GPS n’est pas une mesure de piste homologuée.

Une phase stationnaire sans allure fiable ne déclenche pas de fausse alerte ; son temps actif reste dans le chronomètre mais est exclu du dénominateur fiable. La meilleure allure est la meilleure fenêtre lissée suffisamment fiable. Les kilomètres sont interpolés dans les segments acceptés ; le temps actif inclut les pertes de signal, alors que la distance ne relie jamais les extrémités d’un trou GPS.

Depuis le Module 1, l’auto-pause facultative suspend le temps actif après confirmation d’un arrêt. Le temps total continue pendant les pauses. L’altitude et le dénivelé sont filtrés avec un contrôle de précision verticale, sans extrapolation des portions manquantes. Les seuils, tests et limites physiques sont détaillés dans [TRACKING.md](TRACKING.md).
