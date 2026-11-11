# Validation

## État de référence — 11 novembre 2026

**164 tests réussis dans 12 fichiers, TypeScript et exports JavaScript iOS/web réussis.** Le bilan détaillé des corrections, de la revue iOS, des dépendances et des limites est dans [STABILISATION_2026-11-11.md](STABILISATION_2026-11-11.md). Les comptes rendus ci-dessous sont historiques ; les mentions « aucun test exécuté » concernent uniquement leurs interventions respectives. La recette physique et le build signé restent à réaliser.

## Finition visuelle globale — 2 novembre 2026

États d’appui/désactivation partagés, transition d’entrée légère sans modification du routage, marges sûres, matières limitées à la navigation et adaptations de grands caractères en préparation/course/détail. Les réglages d’accessibilité sont lus avec un état initial conservateur. [Compte rendu](POLISH.md).

Compilation TypeScript finale avec `--noUnusedLocals --noUnusedParameters`, export iOS Hermes (1 263 modules, environ 3,5 Mo) et export web (638 modules, environ 1,5 Mo) réussis. Une erreur de typage de référence `ScrollView` a été corrigée avant les compilations finales. Avertissements Metro de couleur non bloquants ; aucun build Swift/IPA.

Empreintes inchangées des moteurs course/coaching, stockage des séances, configuration, session, localisation, arrière-plan, sorties audio, store Spotify, écrans Apple/Outils et `App.tsx`. Les sources de présentation préparation/course/détail/Musique et les composants partagés sont modifiés. Aucun changement de dépendance ou de schéma.

**Aucun test créé, modifié ou exécuté.** Aucun bouton d’aperçu déclenché, rendu multi-iPhone, clair/sombre ou essai VoiceOver effectué. Revue du code adaptatif uniquement ; validation visuelle et physique encore nécessaire. Les compilations ne démontrent pas l’absence de régression ni une conformité App Store.

## Réglages — 2 novembre 2026

Réglages essentiels visibles, détails du coach et suivi en vues dédiées, dix types d’annonces regroupés en quatre familles, six curseurs organisés par rôle, aperçus repliés et limites d’exécution clarifiées. [Compte rendu](SETTINGS_UI.md).

TypeScript, `--noUnusedLocals --noUnusedParameters`, export iOS Hermes (1 262 modules, environ 3,5 Mo) et export web (638 modules, environ 1,5 Mo) réussis sous Windows. Metro a reconstruit son cache iOS après une erreur de désérialisation et terminé l’export avec un code de sortie 0. Avertissements de couleur non bloquants.

Empreintes SHA-256 inchangées des moteurs de course/coaching, configuration, session, localisation, arrière-plan, sorties audio, stockage des séances, écrans Apple/Outils/course/préparation/Musique, store Spotify et `App.tsx`. **Aucun test créé, modifié ou exécuté ; aucun bouton d’aperçu déclenché.** Aucun rendu iPhone/navigateur vérifié. Les limites de vérification figurent dans le compte rendu.

## Onglet « Musique » — 2 novembre 2026

En-tête allégé, compte compact et configuration repliée, lecteur remonté et états de lecture distincts, sélection séparée pour la prochaine course, ajout par lien structuré, cartes de playlists réutilisables et mini-lecteur partagé amélioré. Vue réelle des morceaux avec pagination et exclusion des réponses tardives après fermeture/déconnexion. [Audit et choix UI](MUSIC_UI.md).

Compilations finales via RTK sous Windows : TypeScript du projet, TypeScript avec `--noUnusedLocals --noUnusedParameters`, export iOS Hermes (1 258 modules, environ 3,5 Mo) et export web (635 modules, environ 1,5 Mo) réussis. Les avertissements Metro `NO_COLOR`/`FORCE_COLOR` n’empêchent pas les exports. Aucun changement de dépendance, build Swift ou IPA signé.

Empreintes SHA-256 identiques avant/après pour `spotify/store.ts`, `auth.ts`, `api.ts`, `device.ts`, `screens/Live.tsx`, `Preparation.tsx`, `services/session.ts`, `audioSession.ts` et `App.tsx`. Aucun schéma ni moteur fonctionnel modifié. Les composants musicaux partagés changent leur présentation ; cette portée inclut le mini-lecteur utilisé en course.

**Aucun test créé, modifié ou exécuté**, conformément à la demande. Aucun compte réel connecté, aucune lecture Spotify commandée, aucun rendu navigateur/iPhone vérifié. Les compilations ne prouvent pas l’absence de régression. Restent à examiner sur appareil : lisibilité, clair/sombre, grands caractères, VoiceOver, playlists et retours, états de connexion/lecture, commandes autorisées/refusées et ouvertures externes pendant une course. Le parcours par liens reste celui prévu dans Expo Go ; OAuth nécessite la configuration et la version de développement existantes.

## Bibliothèque « Séances & Défis » — 2 novembre 2026

Création, dernières séances réelles, modèles essentiels, défis, séances enregistrées et favoris locaux ; cartes avec volume prévu, répétitions, objectif et complexité de structure. Filtres, aperçu du déroulé dans l’éditeur et regroupement des actions de gestion. Les onze modèles et leurs parcours de configuration restent présents. [Compte rendu de la bibliothèque](WORKOUT_LIBRARY.md).

Ajout du champ facultatif `favoriteKeys` aux préférences de séances, compatible avec les anciennes données natives et web, sans modification des tables SQLite ni des snapshots sportifs. La sélection et les réglages vocaux sont conservés. Empreintes inchangées des moteurs de séances/validation/records, des modèles, de la session, des écrans Courir/Sorties/course en direct et d’`App.tsx`.

Compilations finales via RTK sous Windows : TypeScript, TypeScript avec `--noUnusedLocals --noUnusedParameters`, export iOS Hermes (1 255 modules, environ 3,5 Mo) et export web (environ 1,5 Mo) réussis. Les avertissements de couleur de Metro n’empêchent pas les exports. Aucun changement de dépendance, build Swift ou IPA signé.

**Aucun test créé, modifié ou exécuté**, conformément à « NE FAIS PAS DE TEST ». Aucun parcours simulé ni historique fictif. Aucun rendu navigateur/iPhone vérifié. Restent à examiner physiquement : cartes et grands caractères, filtres, retour d’éditeur, persistance des favoris et anciennes préférences, gestion des séances enregistrées, sélection des références GPS et préparation/relance des séances. Les niveaux décrivent la structure, sans évaluation physique du coureur.

## Onglet « Sorties » — 2 novembre 2026

Historique restructuré autour d’un cumul compact, des trois dernières sorties, des accès regroupés aux records/comparaisons/progression et des archives mensuelles. Les lignes détaillées conservent les métriques réelles, la provenance Santé et les informations de séance. État vide contextualisé et affichage progressif de vingt activités. [Compte rendu de l’onglet Sorties](HISTORY.md).

Compilations finales via RTK 0.44.2 sous Windows : TypeScript du projet, TypeScript avec `--noUnusedLocals --noUnusedParameters`, export iOS Hermes (1 251 modules, environ 3,5 Mo) et export web (environ 1,4 Mo) réussis. Les avertissements Metro de couleur n’empêchent pas les exports. RTK est accessible par le chemin `C:/Users/mauba/.local/bin/rtk.exe` malgré son absence du PATH de la session.

Empreintes inchangées : `Home.tsx`, `Live.tsx`, moteurs de records/comparaison/agrégation, stockage, session et `App.tsx`. Les modifications fonctionnelles de présentation sont limitées à `History.tsx` et à la variante facultative de `RunRow`.

**Aucun test créé, modifié ou exécuté**, conformément à « NE FAIS PAS DE TEST ». Aucun historique ou record fictif. Aucun rendu navigateur ou iPhone vérifié ; aucune compilation Swift ou IPA signé. Restent à examiner physiquement : état vide/course en cours, activités longues ou partiellement indisponibles, noms et dates, pagination locale, retour depuis un détail, clair/sombre, Dynamic Type, VoiceOver et destinations des actions.

## Accueil « Courir » — 1er novembre 2026

Refonte ciblée de `Home.tsx` et de son `Hero` : hiérarchie compacte, état de course intégré, résumé hebdomadaire enrichi, objectifs locaux facultatifs, accès progression/calendrier et dernière sortie. Le [compte rendu de l’accueil](HOME.md) détaille les états et les données utilisées.

Compilation TypeScript du projet et compilation avec `--noUnusedLocals --noUnusedParameters` réussies. Exports iOS Hermes (`npm run export:ios`, 1 251 modules, environ 3,5 Mo) et web (`npx expo export --platform web --output-dir web-build`, environ 1,4 Mo) réussis sous Windows. Les avertissements de couleur de Metro n’ont pas empêché ces exports. Empreintes inchangées pour l’écran Live, le moteur de course, la session et `App.tsx`.

**Aucun test créé, modifié ou exécuté**, conformément à « NE FAIS PAS DE TEST ». Aucun scénario de course ni donnée fictive. Aucun rendu navigateur ou iPhone vérifié : l’aperçu local est désactivé dans l’environnement. À examiner sur appareil : proportions du hero, lecture rapide du bilan, états vides/en pause/récupérés, objectifs configurés, Dynamic Type, graphique et VoiceOver. Aucun build Swift, EAS ou IPA signé.

## Design system et audit UI/UX — 1er novembre 2026

Audit des sources des 13 écrans et des composants de modules, puis centralisation du thème et des contrôles de présentation. L’[inventaire et guide du design system](DESIGN_SYSTEM.md) détaillent les incohérences identifiées, les choix, les composants et leurs limites. Aucun moteur sportif, format de stockage ou parcours de navigation n’est reconstruit.

Vérifications finales sous Windows : `npm run typecheck`, `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`, `npm run export:ios` (1 251 modules, environ 3,5 Mo Hermes) et `npx expo export --platform web --output-dir web-build` (environ 1,4 Mo) réussis. Les avertissements Metro `NO_COLOR`/`FORCE_COLOR` n’empêchent pas les exports. Ces commandes compilent le projet ; elles n’exécutent pas les suites de tests.

L’outil navigateur a refusé l’aperçu local, désactivé dans les paramètres de l’environnement. Aucun écran rendu, parcours d’interface ou scénario de course n’a donc été validé dans le navigateur ou sur iPhone. Aucun test créé, modifié ou exécuté, conformément à la consigne précédente ; aucune opération de compte, Santé, partage ou musique. Aucun build Swift/Xcode, EAS ou IPA signé.

Les contrastes de couples de couleurs opaques ont été calculés comme données de conception ; cela ne constitue pas une vérification des écrans, des transparences ou de toute l’accessibilité. Restent à examiner sur iPhone : thèmes forcés/système et Glass, tailles Dynamic Type et roues Picker, lisibilité des chiffres et tableaux, cinq onglets/défilement et zones sûres, dernières actions non masquées, clavier/feuilles, VoiceOver et maintien des parcours fonctionnels existants. L’absence de régression ne peut pas être certifiée par la compilation seule.

## Module 9 — audit technique, 1er novembre 2026

Conformément à « NE FAIS PAS DE TEST », aucun test créé, modifié ou exécuté ; aucun scénario simulé exécuté, essai manuel d’interface, compte Spotify, accès Santé ou iPhone physique utilisé. Les dix fichiers de tests historiques restent présents et n’ont pas été relancés. Il n’existe aucun résultat actuel de test réussi/échoué à annoncer.

Compilations finales sous Windows : `npm run typecheck`, `npm run export:ios` (1 246 modules, environ 3,4 Mo Hermes), `npx expo export --platform web --output-dir web-build` (environ 1,4 Mo), `node --check plugins/with-sprinter-apple.js` et `node --check metro.config.js` réussis. Les avertissements de couleur de Metro sont sans effet sur leur réussite. Aucun navigateur ni appareil n’a exécuté les bundles. Aucun Doctor, prebuild, build EAS, compilation Swift/Xcode ou IPA signé.

Lectures de métadonnées effectuées : arbre npm, recherche d’autolinking Apple et configuration Expo introspectée. Le module local, les permissions/entitlements Santé, l’App Group et l’extension sont détectés ; cela ne compile pas le Swift. Les modes résolus sont `location`, `audio`, `fetch`, ce dernier ajouté par le plugin Expo Task Manager sans tâche fetch propre à Sprinter. Extrait : [module9-native-config.json](../artifacts/module9-native-config.json).

`npm audit --omit=dev --json` a terminé avec **13 alertes modérées, aucune haute ou critique**, propagées depuis glob/minimatch dans les dépendances Expo. [Rapport brut](../artifacts/module9-dependencies.json). Aucun essai d’exploitation ni `audit fix` ; les rétrogradations majeures proposées ne sont pas appliquées. Ces alertes restent à résoudre dans une mise à jour compatible.

Le [rapport d’audit](AUDIT.md) détaille les corrections GPS, concurrence, brouillon, schémas, états après engagement, capital, audio, réseau Spotify, Live Activity et stockage web, ainsi que les risques résiduels. La [procédure future iPhone](RECETTE_IPHONE.md) décrit les scénarios demandés et leurs critères ; toutes les lignes sont **non exécutées**. Restent notamment à valider : chrono lors du sommeil/verrouillage, précision terrain, pauses/reprise, interruption, Santé/ActivityKit et signature, Spotify réel, audio/haptiques, confidentialité des exports, historique volumineux et autonomie.

## Module 8 — outils de course avancés, 1er novembre 2026

Conformément à « NE FAIS PAS DE TEST », aucun test n’a été créé, modifié ou exécuté. Aucun parcours simulé, fichier GPX d’essai, essai manuel d’interface, lecture du métronome, partage effectif, requête météo géolocalisée ou mesure Core Motion sur iPhone n’a été effectué. Les anciens tests n’ont pas été relancés.

Les compilations finales sous Windows ont réussi : `npm run typecheck`, `npm run export:ios` (bundle iOS Hermes de 1 246 modules, environ 3,4 Mo) et `node --check plugins/with-sprinter-apple.js`. Aucun Doctor, prebuild, build EAS, build Swift/Xcode, installation ou IPA signé. Le Swift Core Motion n’est pas compilé par l’export JavaScript.

L’implémentation et les sources sont détaillées dans [TOOLS.md](TOOLS.md) : stockage des favoris, import GPX borné, navigation locale de proximité, métronome avec arbitrage audio, cadence native facultative, météo consentie, copies publiques masquées, résumé et statistiques, contrat Strava sans transport.

Restent à vérifier sur iPhone : GPX et fournisseurs de fichiers réels, persistance/reprise des favoris, guidage et alertes sur tracés avec croisements et pertes GPS, confidentialité des exports avec retours dans les zones masquées, contenu des fichiers et partage, tempo et transitions du métronome, priorité du coach et coexistence Spotify/appels/casque, permissions et fraîcheur Core Motion, consultation/annulation météo, verrouillage, fonctionnement sans réseau et autonomie. Un nouveau binaire iOS est nécessaire pour la cadence. Le fournisseur météo gratuit est réservé au développement personnel ; la distribution nécessite un service adapté. Aucun compte ou envoi Strava n’est actif.

## Module 7 — intégrations Apple, 1er novembre 2026

Conformément à « NE FAIS PAS DE TEST », aucun test n’a été créé, modifié ou exécuté. Aucun parcours, objet Santé ou doublon simulé, essai manuel d’interface, appel à Santé réel ou iPhone physique n’a été utilisé. Les tests historiques ci-dessous n’ont pas été relancés.

Compilations réalisées sous Windows, réussies après les dernières modifications : `npm run typecheck` et `npm run export:ios` (bundle iOS Hermes de 1 185 modules, environ 3,2 Mo). `node --check plugins/with-sprinter-apple.js` confirme la syntaxe JavaScript du plugin. Aucun Doctor, test automatisé, build EAS, prebuild, compilation Swift/Xcode, installation ou IPA signé.

Le nouveau module Swift HealthKit et l’extension Expo Widgets ne sont **pas compilés par cet export JavaScript**. Leur génération, liaison et signature restent à vérifier dans un véritable build iOS. Expo Go conserve le suivi au premier plan et les exports ; Santé et les Live Activities demandent un binaire incluant ces modules.

Restent à vérifier sur iPhone : permissions partielles/refusées/révoquées, exclusion des bases de la sauvegarde, exactitude de la durée active et des pauses dans Santé, confirmation des UUID et comportement des métadonnées de synchronisation lors d’une fermeture, reprise des envois, import et doublons entre sources, lecture partielle/paginée, suppression des copies, partage GPX/CSV, dispositions verrouillées/Dynamic Island, états périmés, fermeture par l’utilisateur, appels/verrouillage/économie d’énergie et autonomie. Le GPS reste soumis à son propre mode d’arrière-plan, sans contournement par ActivityKit.

L’architecture et les limites, ainsi que le contrat préparatoire Apple Watch sans application watchOS, sont détaillés dans [APPLE.md](APPLE.md).

## Module 6 — progression personnelle, 1er novembre 2026

Conformément à « NE FAIS PAS DE TEST », aucun test n’a été créé, modifié ou exécuté. Aucun calendrier, parcours ou résultat simulé, essai manuel d’interface ou iPhone physique n’a été utilisé.

Les vérifications se limitent à `npm run typecheck` et `npm run export:ios` sous Windows, réussis : bundle iOS Hermes de 1 056 modules, environ 2,9 Mo. Aucun build Xcode ni IPA signé. Le rapport [PROGRESSION.md](PROGRESSION.md) documente les agrégations, les records historiques, les associations de calendrier, les plans, les annotations et le stockage local.

Restent à vérifier sur iPhone : périodes et fuseaux, changements de calendrier et dissociations, reprise après fermeture, objectifs, exécution des séances planifiées, journal et kilométrage des chaussures, bilans et records à partir de courses réelles. Les tests historiques ci-dessous n’ont pas été relancés et ne valident pas ce module.

## Module 5 — coach audio et Spotify, 1er novembre 2026

Conformément à « NE FAIS PAS DE TEST », aucun test n’a été créé, modifié ou exécuté. Aucun son d’essai, parcours simulé, essai d’interface, compte Spotify ou iPhone physique n’a été utilisé.

Les vérifications se limitent à `npm run typecheck` et `npm run export:ios` sous Windows, réussis : 1 039 modules et environ 2,8 Mo pour le bundle iOS Hermes. Aucun build Xcode, IPA signé ou déploiement de la page HTTPS. [AUDIO.md](AUDIO.md) décrit les réglages, la file d’annonces, la coexistence audio et les limites.

Restent à vérifier sur iPhone : annonces et espacements, préemption et pauses, mode silencieux, casque/Bluetooth/appels, libération du volume, haptiques et verrouillage dans une version installée, OAuth via HTTPS, permissions Spotify, abonnement et pertes réseau. Client ID, hébergement et compte réel restent à configurer. Les tests historiques ci-dessous n’ont pas été relancés et ne valident pas ce module.

## Module 4 — séances et défis, 1er novembre 2026

Conformément à la dernière consigne explicite « NE FAIS PAS DE TEST », aucun test n’a été créé, modifié ou exécuté. Aucun parcours simulé, essai manuel d’interface ni essai iPhone n’a été effectué.

Compilation TypeScript (`npm run typecheck`) et bundle iOS Hermes (`npm run export:ios`, 1 036 modules, environ 2,8 Mo) réussis sous Windows. Aucun build Xcode ni IPA signé. Le rapport [WORKOUTS.md](WORKOUTS.md) décrit l’existant conservé, les onze modèles, le score de stabilité, les références de records et la persistance.

Restent à vérifier sur iPhone : transitions entre fractions et récupérations, pauses/auto-pause, conditions en cible, défaite sans arrêt de la course, qualification du défi record, stabilité et couverture GPS, récupération du checkpoint et annonces. Les tests historiques du Module 1 n’ont pas été relancés et ne couvrent pas ces ajouts.

## Module 3 — statistiques et historique, 1er novembre 2026

Conformément à la dernière consigne explicite « NE FAIS PAS DE TEST », aucun test n’a été créé, modifié ou exécuté pour ce module. Aucun parcours simulé, contrôle manuel d’interface, import GPX ou essai sur iPhone n’a été effectué.

La compilation TypeScript (`npm run typecheck`) et l’export du bundle iOS Hermes (`npm run export:ios`, 1 035 modules, environ 2,8 Mo) ont réussi sous Windows. Il ne s’agit pas d’une compilation Xcode ou d’un IPA signé. Les calculs, sources des données, critères de qualification, migration et limites sont documentés dans [ANALYTICS.md](ANALYTICS.md).

Restent à vérifier physiquement : carte Apple et ruptures de trace, lecture d’anciennes activités, intermédiaires et records sur des distances mesurées, longues activités, comparaison avec pauses et pertes GPS, feuille de partage et lecture d’un GPX par une autre application. Les résultats de tests du Module 1 ci-dessous sont historiques, n’ont pas été relancés et ne valident pas cette livraison.

## Module 2 — coach d’allure, 1er novembre 2026

Conformément à la consigne finale explicite « NE FAIS PAS DE TEST », aucun test n’a été créé, modifié ou exécuté pour ce module. Aucun parcours simulé ni essai manuel d’interface ou sur iPhone n’a été effectué.

La compilation TypeScript (`npm run typecheck`) et l’export du bundle iOS Hermes (`npm run export:ios`) ont réussi sous Windows. Les conventions de calcul, les changements et leurs limites sont documentés dans [PACING.md](PACING.md). Les résultats du Module 1 ci-dessous sont historiques ; les 148 tests n’ont pas été relancés et ne couvrent pas cette nouvelle livraison.

## Module 1 — suivi sportif, 1er novembre 2026

- `npm run check` : TypeScript strict et **148 tests réussis dans 10 fichiers** (55 nouveaux tests).
- `npm run export:ios` : bundle iOS Hermes généré avec succès sous Windows, 992 modules.
- Parcours simulés droits et bruités, virages, dérive stationnaire, pertes GPS, changements d’heure, deux chronomètres, auto-pause/reprise, altitude et dénivelé.
- Permissions, callbacks tardifs, départ annulé, interruptions natives, lots de fond, sauvegardes lentes et bilan figé à l’action Terminer.
- SQLite réel sous Node : journal incrémental, migration des checkpoints, cohérence, rollback et protection contre les révisions obsolètes. Les services iOS sont simulés.
- Aucune mesure physique sur iPhone, compilation Xcode, génération d’IPA signé ou mesure d’autonomie réalisée. Le bundle exporté ne remplace pas ces vérifications.

Le rapport détaillé, l’analyse initiale et les procédures physiques figurent dans [TRACKING.md](TRACKING.md). Les nouvelles consignes de ce module autorisent explicitement les tests ; la consigne antérieure de les omettre concernait la livraison initiale de Séances & Défis.

## Ajout Séances & Défis

Lors de la livraison initiale de Séances & Défis, aucun test n’avait été écrit ou exécuté à la demande de l’utilisateur. La compilation TypeScript et le bundle iOS avaient été produits. Le Module 1 ajoute maintenant deux tests d’intégration avec le suivi, sans prétendre couvrir tout l’éditeur ni chaque règle de défi.

## Livraison antérieure — exécuté sous Windows

- Contrôle TypeScript strict sans émission.
- **93 tests** Vitest avec Node 24 : 40 tests sportifs (moteur, unités, SQL et cycle de vie), 49 tests Spotify et 4 tests de session audio. Les comptes, transports OAuth et réponses Spotify sont simulés.
- Les tests SQLite exécutent les mêmes requêtes SQL que la version mobile dans le véritable moteur SQLite intégré à Node, y compris les transactions et leur rollback. Ils ne constituent pas un test du module natif Expo SQLite sur iPhone.
- Vérification Expo Doctor pour le SDK 58 : **20/20 contrôles**. Les dépendances natives, React et TypeScript sont alignés sur ce SDK.
- Export du bundle **iOS Hermes** par Metro depuis Windows. Aucun `.ipa` signé n’a été produit.
- Aperçu navigateur contrôlé : accueil vide réel, préparation d’allure, choix de 5 km et estimation 25:50–26:40 pour 5′10–5′20/km, navigation et apparences claire/sombre. Le navigateur n’est pas un simulateur iOS.
- Serveur Expo Go démarré sur le réseau local, réponse HTTP vérifiée. QR généré localement.
- Intégration Musique vérifiée dans l’aperçu navigateur : refus d’un lien externe, import d’une URI Spotify, sélection visible pendant la préparation et retour de la fenêtre Musique sans perdre la plage d’allure ni la distance. Ce contrôle ne valide pas le client iPhone ou un compte Spotify réel.

## Scénarios automatisés

1. Plage 5′10–5′20 : pas d’alerte.
2. 5′00 durable : ralentir après confirmation.
3. 5′30 durable : accélérer après confirmation.
4. Retour dans la plage : silence ; répétitions espacées.
5. Pics GPS, coordonnées invalides, ancienneté, précision insuffisante : rejet.
6. Pause : temps et alertes suspendus ; reprise sans joindre le trajet absent.
7. Passage en arrière-plan **simulé pour Expo Go** : pause explicite, sans prétendre valider iOS.
8. Fin : historique et suppression du checkpoint dans une même transaction ; sauvegarde échouée récupérable.
9. Unités, arrondis, estimation conditionnelle, temps par kilomètre, tronçon partiel, durée fiable pondérée.
10. Restauration en pause, révisions obsolètes, sauvegardes tardives après fin et données corrompues conservées.

## À vérifier sur un iPhone réel — non réalisé

| Essai | Procédure | Réussite attendue | État |
| --- | --- | --- | --- |
| Ouverture Expo Go | Scanner le QR sur le même Wi-Fi | App sans erreur native | À effectuer |
| Permission refusée | Refuser la position puis essayer de démarrer | Message utile, aucun suivi démarré | À effectuer |
| Position exacte désactivée | Partir avec une position approximative | Démarrage refusé avec un message demandant Position exacte | À effectuer |
| Acquisition à l’extérieur | Attendre puis courir en terrain dégagé | Distance cohérente, allure après stabilisation | À effectuer |
| Deux signaux | Tester les deux commandes dans Réglages | Motifs et sons reconnaissables dans la poche | À effectuer |
| Retour en cible | Courir alternativement en/hors cible | Confirmation, cooldown, arrêt des alertes | À effectuer |
| Pause/reprise | Marcher loin pendant la pause | Aucun déplacement ni temps actif ajouté ; le temps total inclut la pause | À effectuer |
| Auto-pause | Arrêt puis mouvement en terrain dégagé ; répéter avec GPS dégradé | Arrêt/reprise confirmés, pas d’auto-pause sur une perte GPS | À effectuer |
| Altitude | Terrain plat puis côte connue | Dénivelé estimé cohérent, couverture indiquée, pas de cumul de bruit à l’arrêt | À effectuer |
| Expo Go verrouillé | Verrouiller l’écran pendant une séance | Pause explicite au retour, pas de fausse continuité | À effectuer |
| Build installé verrouillé | Activer le mode arrière-plan puis verrouiller ≥ 20 min | GPS continu dans les limites iOS ; pas de liaison des trous | À effectuer |
| Audio verrouillé | Deux écarts séparés, après ≥ 5 min de silence | Signaux audio effectivement entendus | À effectuer |
| Interruptions | Appel, musique, Bluetooth, casque débranché | Pas de crash, pas d’ancienne alerte rejouée | À effectuer |
| Récupération | Tuer le processus, relancer puis redémarrer l’iPhone | Dernier checkpoint proposé en pause | À effectuer |
| Enregistrement | Terminer, quitter, redémarrer l’iPhone | Parcours, statistiques et intermédiaires conservés | À effectuer |
| Batterie | Courir 60–120 min sur plusieurs modèles | Pas de chauffe ou consommation excessive ; documenter les mesures | À effectuer |
| Accessibilité | Grandes polices, VoiceOver, animations/transparence réduites | Contrôles lisibles et activables | À effectuer |

## Dépendances

Les versions natives sont alignées sur Expo Go SDK 58. La migration a été motivée par une erreur réelle du client connecté qui signalait attendre le SDK 58. L’audit npm peut encore signaler des dépendances transitives ; ne pas lancer `npm audit fix --force` sans vérification du graphe natif. L’application n’expose pas de serveur de données sportives ; Metro reste un outil de développement. La connexion OAuth et la validation physique nécessitent toujours une version installée et une configuration Spotify réelle.

## Spotify

Voir `SPOTIFY.md` : aucun Client ID ni compte Spotify de test n’a été fourni. Connexion réelle, lecture Premium/Free, interruptions et écoute Bluetooth n’ont donc pas été validées. Les tests simulés ne valent pas validation d’un compte réel. L’importation, la sélection et la conservation des références fonctionnent indépendamment de la connexion.
