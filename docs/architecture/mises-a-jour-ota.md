# Mises à jour automatiques des futures versions store

[Développement](developpement.md) · [Validation](../quality/validation.md) · [Données et récupération](donnees-et-cycle-course.md)

État au **15 novembre 2026** : MVP intégré au code, **aucun binaire compatible construit ni aucune OTA publiée pour cette intégration**. Ce mécanisme prépare les versions futures App Store et Play Store. Il ne met pas à jour les IPA personnelles : `SPRINTER_SIDELOAD=1` désactive Expo Updates et retire son URL.

## Périmètre

Les correctifs JavaScript, textes embarqués, traductions, images et ajustements d’interface compatibles peuvent être téléchargés sans installation manuelle d’une nouvelle version du store. Les nouvelles permissions, dépendances natives, plugins, widgets et changements de runtime exigent un nouveau binaire. Toute publication doit aussi respecter les règles des stores ; la faisabilité JavaScript ne suffit pas à autoriser une modification de fonctionnalités.

La configuration distante métier existante reste distincte de la livraison du code. Aucun serveur de code maison, migration Supabase, nouvelle télémétrie, annonce systématique ou bouton de redémarrage n’a été ajouté. La configuration distante supplémentaire, les notes de version éditoriales et la signature OTA restent des évolutions ultérieures.

## Configuration et compatibilité

- [package.json](../../package.json) et son verrou ajoutent `expo-updates` dans la version recommandée par Expo SDK 58.
- [app.json](../../app.json) cible le projet EAS existant via `https://u.expo.dev/429ba0a6-7672-4e65-b1b0-d0f311820e23`.
- La politique `runtimeVersion: { policy: "fingerprint" }` calcule la compatibilité à partir du graphe et de la configuration natives. Les plugins Apple, widgets, OAuth et Maps existants sont conservés pour les versions store.
- `checkAutomatically: "NEVER"` réserve les recherches au service protégé. `fallbackToCacheTimeout: 0` conserve un lancement immédiat sur le cache local ; `useEmbeddedUpdate: true` garde le bundle de secours. Les protections natives Expo ne sont pas désactivées.
- [eas.json](../../eas.json) associe `development`, `preview`, `production` à leurs canaux et environnements homonymes. Un canal est le routage du binaire ; une branche EAS contient les publications ; le runtime et la plateforme déterminent leur compatibilité. Une branche Git n’est pas une branche EAS.
- [app.config.js](../../app.config.js) désactive les OTA en sideload, indépendamment des canaux. Aucun canal ni profil OTA sideload n’est ajouté.

**Les anciennes installations sans Expo Updates ne peuvent pas recevoir cette intégration à distance.** Le premier binaire store doit embarquer le module et sa configuration. Sa construction, l’activation des canaux EAS et la publication des bundles feront l’objet d’opérations futures explicitement demandées. Aucun workflow de publication OTA automatique n’est ajouté ; le workflow IPA reste manuel.

Le fingerprint ne dispense pas d’utiliser les mêmes paramètres natifs lors du build et de la publication. Le schéma Google iOS, la clé Maps Android et les variables qui modifient les plugins doivent correspondre. Comparer les fingerprints du binaire et de l’OTA avant diffusion, plateforme par plateforme. `preview` doit représenter le runtime et les services de la cible. Ne pas promouvoir un export preview contenant d’autres variables publiques : reconstruire et revalider la cible si les environnements diffèrent.

## Service client et protections de course

[UpdateManager](../../src/services/updateManager.ts) possède les états `idle`, `checking`, `downloading`, `ready`, `deferred`, `failed`. [updates.ts](../../src/services/updates.ts) relie Expo, NetInfo, le premier plan et la session. [App.tsx](../../App.tsx) branche ce service sans attendre son résultat pour afficher l’application. [updates.web.ts](../../src/services/updates.web.ts) ne charge aucun transport OTA natif.

1. Expo Go, le développement, le web, le sideload et les clients sans module actif n’effectuent aucun appel OTA.
2. La recherche attend une session initialisée, sans chargement, course (y compris pause ou récupération), récupération bloquée ou opération `busy`. Elle exige le premier plan et une connexion disponible, non déclarée coûteuse.
3. Les changements de contexte sont regroupés pendant une seconde. Aucun polling périodique ni traitement GPS n’est ajouté. Les recherches sans nouveauté sont espacées de six heures dans le processus ; après erreur, le prochain déclencheur admissible attend au moins quinze minutes. Un nouveau processus peut rechercher à nouveau.
4. Une seule opération native s’exécute à la fois. La sécurité est relue après la recherche et avant le téléchargement : un départ survenu entre les deux reporte celui-ci.
5. Les watchdogs signalent une recherche dépassant 30 secondes ou un téléchargement dépassant 120 secondes. Expo n’offrant pas d’annulation, le verrou est conservé jusqu’au règlement réel de la promesse native. Un résultat tardif de recherche ne déclenche pas de téléchargement ; un téléchargement tardif confirmé peut rester prêt.
6. Une opération déjà engagée peut finir pendant une course ou en arrière-plan ; elle ne fait que mettre le bundle en cache. **Aucun appel de rechargement n’existe dans le service ou la page de version.** Le GPS, les horloges, l’audio et SQLite ne sont pas pilotés par le service OTA.
7. Une directive Expo de retour au bundle embarqué est récupérée même si `isAvailable` est faux. Un résultat rejeté ou incompatible par Expo ne devient pas une mise à jour prête. Seuls des codes fixes `check`, `download`, `timeout` sont journalisés localement, sans erreur native brute ni données de course.

### Activation et récupération au lancement

Une mise à jour prête attend le prochain **démarrage complet du processus**. Un retour du fond au premier plan n’impose aucun changement de bundle. L’absence de réseau n’empêche pas l’utilisation de la dernière version locale exploitable.

**Limite native à conserver dans les recettes :** Expo sélectionne le bundle avant l’exécution de JavaScript. Le MVP ne peut donc pas inspecter un brouillon SQLite pour empêcher cette sélection au démarrage après une interruption. Le blocage de récupération protège les nouvelles recherches et téléchargements, pas la sélection d’un bundle déjà mis en cache par un processus antérieur. La récupération existante doit continuer à restaurer la course **en pause**, sans modifier les points ni inventer des durées fiables.

Une OTA et son rollback doivent conserver la compatibilité des données avec le bundle embarqué et les versions précédentes. Aucune migration de données n’accompagne ce MVP. Bloquer la sélection native selon SQLite demanderait un travail natif distinct et une nouvelle build ; ne pas annoncer cette garantie sur la base du gestionnaire JavaScript.

## Informations dans les réglages

**Réglages → Version de Sprinter**, raccordé dans [Settings.tsx](../../src/screens/Settings.tsx) via [VersionPanel.tsx](../../src/settings/VersionPanel.tsx), affiche version native, build et état discret. Les diagnostics dépliables indiquent canal, runtime, identifiant OTA, date de création du bundle et origine embarquée/téléchargée. La date du bundle n’est pas une date de publication certifiée. Un lancement de secours est signalé sans exposer son erreur native brute. Aucune popup, sollicitation store ou action « Installer maintenant » n’est ajoutée.

## Exploitation future : preview, production, rollback

**Les commandes suivantes sont documentaires et n’ont pas été exécutées pour cette intégration.** Publications et rollbacks modifient EAS et nécessitent une demande explicite. Utiliser une CLI EAS actuelle compatible SDK 58, un compte autorisé, les environnements configurés et une build store/preview représentative. Une compilation IPA exige sa propre demande pour la tâche courante.

1. Repartir d’un commit propre, exécuter les validations locales ci-dessous et contrôler variables publiques et plugins de chaque cible.
2. Faire construire, sur demande, le premier binaire compatible avec son canal et un bundle embarqué sain. Conserver son fingerprint et sa configuration. Vérifier ou créer les canaux distants et leurs branches lors de cette opération : leur existence n’a pas été attestée ici.
3. Publier sur preview, puis exécuter la recette physique. Expo Go ne constitue pas cette preuve.
4. Après validation et autorisation, diffuser production progressivement, surveiller puis augmenter le pourcentage. Le push Git ne publie aucune OTA.

```powershell
# Lecture / diagnostic du routage distant, quand EAS est configuré
npx eas-cli@latest channel:view preview
npx eas-cli@latest channel:view production
npx eas-cli@latest update:list --branch production

# Publications futures seulement, après autorisation
npx eas-cli@latest update --channel preview --environment preview --message "Recette du correctif <commit>"
npx eas-cli@latest update --channel production --environment production --rollout-percentage 10 --message "Correctif validé <commit>"

# Pilotage futur du rollout : sélectionner la bonne plateforme et le bon runtime
npx eas-cli@latest update:edit
npx eas-cli@latest update:revert-update-rollout

# Assistant de rollback : ancienne OTA saine ou bundle embarqué
npx eas-cli@latest update:rollback
```

SDK 58 exige l’environnement explicite à la publication. Le rollback republie une version saine ou une directive de retour à l’embarqué ; il ne restaure ni ne réécrit les données utilisateur. Identifier le groupe défectueux et le canal, arrêter/revenir sur le rollout ou lancer l’assistant selon l’incident, puis vérifier l’adoption sur un appareil connecté au prochain démarrage. Examiner les publications avec `update:list` et `update:view <groupe>` ; ne pas republier sur tous les runtimes sans contrôle. Un appareil hors ligne ne reçoit pas instantanément l’annulation.

Conserver pour chaque diffusion : commit Git, version/build, canal, branche EAS, runtime, plateforme, environnement, message, identifiant du groupe/OTA, pourcentage, résultat de recette et état du rollback. Aucun registre nominatif ou suivi de crash distant n’a été créé. La surveillance large et la signature OTA restent à préparer avant diffusion large ; aucune clé privée dans le dépôt ou l’application.

## Vérifications et recette physique à exécuter plus tard

Résultats locaux datés : [validation](../quality/validation.md). Scénarios simulés : [updates.test.ts](../../tests/updates.test.ts) et [updates-config.test.ts](../../tests/updates-config.test.ts). Ils ne prouvent ni réception EAS réelle ni garanties des stores.

```powershell
rtk npm run check
rtk proxy npx expo install --check
rtk proxy node scripts/check-sideload-config.cjs
```

Recette iPhone release/preview et équivalent Android avant Play Store : **non exécutée ici**. Utiliser des comptes et courses de test dédiés ; ne jamais supprimer les données personnelles pour préparer ces scénarios.

| Scénario physique | Manipulation et résultat attendu |
|---|---|
| Premier lancement sans réseau | Installer une build représentative puis démarrer en mode avion ; le bundle embarqué ouvre l’application sans attendre EAS |
| OTA compatible | Publier un changement bénin sur preview ; ouvrir sans course, attendre le téléchargement et contrôler Version de Sprinter ; aucun écran imposé |
| Activation différée | Le contenu chargé reste inchangé ; fermer complètement et relancer ; l’OTA et son identifiant apparaissent |
| Course / pause / auto-pause | Déclencher réseau/premier plan avec GPS, Spotify et haptique ; aucune nouvelle recherche admissible, aucun redémarrage ni saut de chronomètre |
| Départ pendant recherche / téléchargement | Reporter le téléchargement si départ pendant la recherche ; laisser celui déjà engagé finir en cache sans interrompre la course |
| Interruption avec brouillon | Préparer une OTA en cache, interrompre une course de test puis relancer ; contrôler sélection native, restauration en pause, points et durées conservés |
| Stockage / récupération bloquée | Avec un état de récupération de test, contrôler l’absence de recherche avant résolution ; ne pas corrompre une base personnelle |
| Réseau coûteux, coupure, timeout | Utiliser un réseau déclaré coûteux ou couper le téléchargement ; l’app reste utilisable ; reprise sur déclencheur admissible après le délai |
| EAS inaccessible / bundle invalide | Simuler une panne ou publication de test rejetée ; conserver bundle local et données, diagnostics sans informations sensibles |
| Runtime / canal différent | Publier sur une autre cible de test ; aucune activation incompatible ; comparer fingerprints et plateforme |
| Rollback OTA / embarqué | Sur preview, tester les deux retours ; adoption au démarrage suivant, données inchangées |
| Échec au démarrage | Sur cible isolée, exercer récupération native Expo et rollback distant ; ne pas présumer un retour arrière infaillible |
| Sideload, Expo Go, web | Aucune recherche OTA ; l’IPA personnelle ne reçoit jamais les canaux store |

## Références officielles

- [Expo Updates : configuration, API et prochain démarrage](https://docs.expo.dev/versions/latest/sdk/updates/).
- [Runtime versions et fingerprint](https://docs.expo.dev/eas-update/runtime-versions/).
- [Déploiement et canaux](https://docs.expo.dev/eas-update/deployment/), [rollouts](https://docs.expo.dev/eas-update/rollouts/) et [rollbacks](https://docs.expo.dev/eas-update/rollbacks/).
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) : vérifier les règles applicables avant publication.
