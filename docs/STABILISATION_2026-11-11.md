# Stabilisation et refonte Sprinter — 11 novembre 2026

Branche locale : `codex/stabilisation-sprinter`. Le point de départ et les 64 fiches GitHub examinées sont décrits dans [l’audit initial](AUDIT_2026-11-11.md). Ce bilan est l’état de référence après cette intervention ; les anciens comptes rendus décrivent leurs versions respectives.

## Résultat dans l’application

L’interface utilise le carbone, la craie et l’orange, avec Barlow Condensed embarquée et la police système pour les textes. L’icône et le lancement reprennent le même signe de vitesse. Les trois onglets restent Stats à gauche, Courir au centre et Spotify à droite. Les animations sont courtes ; le verre reste dans la navigation iOS compatible et respecte la réduction de transparence. Les thèmes clair, sombre et système sont de nouveau disponibles.

Le bouton de préparation ouvre les fonctions avancées : séances, défis, objectif de temps, allures par kilomètre, calendrier, chaussures, parcours et outils. Le départ rapide et la préparation partagent désormais le même contrat de départ : ils transmettent la séance et ses identifiants de calendrier, de chaussure et de parcours. Une sélection devenue invalide doit être revue avant le départ.

Dans Stats, la séance et la navigation sont à nouveau accessibles pendant la course. La cible affichée suit le bloc ou le kilomètre actuel. La carte, l’historique d’allure, la progression du coach et le métronome se déplient à la demande. Les vibrations et les signaux restent accessibles directement.

Spotify conserve l’import par lien et la sélection sans compte. Les morceaux paginés et les commandes avancées sont de nouveau accessibles lorsque le compte le permet. Les réponses tardives sont ignorées après fermeture ou déconnexion. Une préférence n’apparaît comme sélectionnée qu’après son écriture ; une panne de stockage conserve le dernier choix durable et explique l’échec. Le lancement automatique lit les préférences sauvegardées.

## Protections des données

- **Santé :** l’intention d’export automatique est inscrite dans l’activité lors du même enregistrement sportif. À la reprise, les activités marquées sans reçu Santé sont récupérées, même si l’écriture de la file Apple n’a jamais eu lieu. Les anciennes activités non marquées ne sont pas exportées rétroactivement. L’option désactivée et les activités déjà acquittées sont respectées.
- **Brouillon illisible :** une action explicite conserve le contenu brut et son journal GPS dans une archive SQLite avant de libérer le brouillon. L’insertion et la libération sont transactionnelles. Une erreur laisse les données originales et le blocage intacts. Le schéma passe de 2 à 3 sans supprimer les activités. Les archives restent consultables et exportables depuis les réglages ; elles peuvent contenir des positions privées. Le navigateur conserve lui aussi une copie avant de libérer son brouillon.

Ces protections évitent une perte supplémentaire ; elles ne reconstruisent pas automatiquement des positions déjà corrompues.

## Correspondance avec le projet GitHub

| Fiches | Travail effectué | Suite nécessaire |
|---|---|---|
| #11, #12 | Import natif facultatif isolé dans les tests session ; fixtures OAuth HTTPS et paramètres d’appareil Spotify actualisés | Relecture du changement |
| #13 | Intention Santé durable et reprise sans dépendre uniquement de la file Apple | Vérifier interruption/reprise sur client natif |
| #14 | Archivage conservateur, migration SQLite et écran de récupération | Recette iPhone et export privé |
| #19 | Préférences Spotify publiées après écriture, erreurs et file concurrente traitées | Vérifier sur stockage réel |
| #16 | Correctifs compatibles Expo SDK 58 et parseur GPX actualisés | Trois alertes modérées transitives restantes |
| #17 | Audit et preuves de validation actualisés | Compléter avec les futurs résultats terrain |
| #18 | Configuration iOS calculée inspectée ; messages GPS français, Face ID inutilisé retiré | Vérifier le binaire signé de distribution |
| #53–#56 | Trois onglets, fonctions avancées rétablies, thèmes et états accessibles | VoiceOver et grandes tailles sur iPhone |
| #60 | Workflow GitHub ajouté : types, tests, compatibilité Expo, exports iOS/web | Première exécution distante après publication de la branche |

Aucune fiche ni colonne GitHub n’a été modifiée. « Implémenté localement » et « validé sur iPhone » restent deux étapes distinctes.

## Vérifications réalisées

- `npm run check` : **12 fichiers, 164 tests réussis**, TypeScript réussi.
- TypeScript avec `--noUnusedLocals --noUnusedParameters` : réussi lors de la revue.
- Export iOS Hermes et web : réussi, environ 3,5 Mo pour iOS et 1,5 Mo pour le web.
- Compatibilité Expo : `expo install --check` réussi, SDK 58 conservé.
- Audit npm : **3 alertes modérées, aucune faible, haute ou critique**, contre neuf au départ. La chaîne restante est `expo → @expo/fingerprint → minimatch`. La correction automatique proposée rétrograde Expo en SDK 52 : elle n’a pas été appliquée. Le parseur XML est maintenant verrouillé en 5.12.0.
- SQLite réel en mémoire : conservation d’un brouillon et d’un journal illisibles, annulation d’un archivage incomplet, migration depuis le schéma 2, réouverture et nouveau départ.
- Services simulés : reprise des sessions, engagement de l’intention Santé avec la course, conservation du blocage sur erreur disque, préparation et sélections, préférence Spotify durable et récupération après échec d’écriture.
- Navigateur à 390 × 844 : trois onglets, préparation vers accueil avec distance conservée, thèmes clair/sombre, retour depuis les réglages et écran de récupération. Les interactions de la première passe ont aussi couvert 375 × 667. Aucun compte Spotify réel ni autorisation GPS du navigateur n’a été utilisé.

La configuration iOS calculée contient Santé, le groupe d’application et Live Activities ; les permissions microphone et Face ID sont absentes. Les modes `location`, `audio` et `fetch` proviennent de la configuration et des plugins installés. L’introspection inclut le client de développement et ne permet pas de certifier les exceptions réseau, les manifestes agrégés, la signature ou le comportement du binaire App Store.

Le workflow s’appuie sur les versions officielles [checkout 7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1) et [setup-node 7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0), référencées par leur empreinte de commit. Il utilise Node 24, des permissions de lecture et ne construit pas d’IPA signé.

## Prochaines priorités

1. **#20 et #21 :** configurer le Client ID et le retour HTTPS Spotify existant, puis construire et installer un client iOS signé avec le module Apple. Ces étapes nécessitent les comptes et la chaîne Apple correspondants.
2. **#22–#27, #37–#39, #43–#45, #49, #58–#59 :** recette courte sur iPhone : position exacte, course réelle, pause, verrouillage, interruption, conservation au redémarrage, son/vibrations, Santé, Live Activity, Bluetooth, fonctionnement hors ligne et batterie. Procédure dans [RECETTE_IPHONE.md](RECETTE_IPHONE.md).
3. **#15 :** mesurer le chargement d’un historique volumineux avant de remplacer le chargement intégral des traces par des résumés et des détails à la demande.
4. **#61 :** choisir/configurer le service météo pour la distribution. La météo reste facultative ; le démarrage d’une course n’en dépend pas.
5. Garder Strava, Watch et FIT (#62–#64) après ces validations pour ne pas multiplier les intégrations avant d’avoir sécurisé le socle iPhone.

L’export JavaScript vérifie les sources et les ressources. Il ne valide ni la compilation Swift, ni l’installation d’un IPA, ni le suivi physique en arrière-plan.
