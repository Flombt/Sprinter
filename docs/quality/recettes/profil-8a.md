# Recette · Profil privé

> **Recette manuelle NON EXÉCUTÉE.** Ne cocher qu’après observation sur le commit et le client consignés. Les attentes de la spécification historique ont été adaptées au compte obligatoire ; elles ne constituent pas une preuve de conformité.

[Campagne et fiche de résultat](README.md) · [État actuel](../../features/etat-fonctionnalites.md)

### 8a · Profil privé

#### R8a.01 · Profil facultatif après connexion obligatoire

Critère actuel : le compte donne accès à l’application sans imposer de profil personnalisé.

- **Préconditions** : compte connecté ; `profiles_enabled` vrai dans l’environnement de recette ; profil non configuré.
- **Étapes** : rejouer [R1.06](comptes.md#r106--accès-protégé-accueil-direct-et-reprise-hors-ligne) ; démarrer, terminer, consulter et exporter une course sans ouvrir l’éditeur de profil. Désactiver les fonctions de profil puis refaire ce parcours.
- **Attendu** : accès initial protégé ; profil facultatif ; aucune dépendance du GPS à l’ouverture de sa base ou à sa synchronisation.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### R8a.02 · Thème en quelques gestes, avatar et bannière bien cadrés

*Critère : « Un thème intégré peut être appliqué en quelques gestes. Un avatar et une bannière personnels restent bien cadrés après fermeture et réouverture. »*

- **Préconditions** : compte connecté · images synthétiques en paysage et en portrait.
- **Étapes** : appliquer un thème intégré en comptant les gestes · importer un avatar et une bannière, recadrer, enregistrer · fermer puis rouvrir l'app.
- **Attendu** : thème appliqué en quelques gestes, cadrage conservé.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### R8a.03 · Édition hors ligne, second appareil, cloisonnement

*Critère : « Une édition hors ligne survit au redémarrage. Après enregistrement et reconnexion, la version privée apparaît sur un second appareil du titulaire. Un compte différent n'accède à aucun brouillon, fichier ou cache associé. »*

- **Préconditions** : deux appareils du titulaire · un compte tiers.
- **Étapes** : hors ligne, modifier le profil et redémarrer l'app · enregistrer et revenir en ligne · ouvrir le profil sur le second appareil · se déconnecter et se connecter avec le compte tiers sur le premier appareil.
- **Attendu** : brouillon intact après redémarrage, version privée présente sur le second appareil, aucun brouillon, fichier ou cache accessible au compte tiers.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### R8a.04 · Statut temporaire, transfert interrompu, performances

*Critère : « Un statut temporaire expire sur les deux appareils. Un transfert interrompu reprend après la course sans doublon. Le démarrage et l'enregistrement GPS tiennent les mesures de référence du socle. »*

- **Préconditions** : deux appareils · média synthétique volumineux · mesures de référence de R1.06.
- **Étapes** : poser un statut de 10 minutes et attendre son expiration sur les deux appareils · lancer l'envoi d'un média puis démarrer une course · terminer la course · mesurer le démarrage et vérifier l'enregistrement GPS.
- **Attendu** : statut disparu partout, envoi suspendu pendant la course puis repris sans doublon, mesures dans la tolérance.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |
