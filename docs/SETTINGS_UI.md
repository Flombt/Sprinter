# Réglages — 2 novembre 2026

L’audit montrait une longue succession de dix types d’annonces et six curseurs, avec peu de séparation entre usages quotidiens et paramètres avancés.

L’écran principal conserve vibrations, signaux audio et voix ; il donne accès au coach, au suivi, aux parcours/GPX, à Apple, à l’apparence et aux options avancées. Les boutons existants de ralentissement/accélération restent dans « Reconnaître les signaux », sans avoir été déclenchés.

Le coach regroupe les dix types en quatre familles, avec compteurs réels, réglages individuels repliables, intervalles et priorités inchangés. Les niveaux Discret/Normal/Complet conservent leurs préréglages ; leur réapplication est explicitée et les personnalisations sont signalées. Les six curseurs gardent leurs bornes, unités et étapes, regroupés par stabilité, confirmation et objectif chronométrique.

La voix reste dépendante des signaux audio, sans activation automatique. Les limites premier plan/arrière-plan/verrouillage sont expliquées ; GPS et Activités en direct restent distincts. Les options de suivi restent bloquées pendant une course. La permission de localisation est relue au retour dans l’app, avec nettoyage de l’abonnement et exclusion des réponses tardives.

Les composants `SettingsDisclosure`, `SettingRange` et `SettingsNotice` reprennent le thème, les espacements, les contrôles natifs et les états accessibles du design system. Les sélecteurs s’adaptent aux grands caractères ; les actions ont une cible d’au moins 44 points. Aucun moteur, stockage, service audio ou réglage persistant ajouté ou modifié. Les écrans Apple et Outils conservent leurs fonctions.

TypeScript et compilation avec options de détection des éléments inutilisés réussis ; exports iOS Hermes (1 262 modules, environ 3,5 Mo) et web (638 modules, environ 1,5 Mo) réussis. Metro a reconstruit son cache iOS après une erreur de lecture, sans empêcher l’export. Aucun build Swift/IPA.

**Aucun test créé, modifié ou exécuté.** Aucun aperçu sonore déclenché ni rendu sur iPhone/navigateur vérifié. Les grands caractères, VoiceOver, clair/sombre, navigation et permissions restent à examiner sur appareil ; les compilations ne démontrent pas l’absence de régression.
