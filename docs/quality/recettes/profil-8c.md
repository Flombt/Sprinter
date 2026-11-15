# Recette · Partage et modération

> **Recette manuelle NON EXÉCUTÉE.** Ne cocher qu’après observation sur le commit et le client consignés. Les attentes de la spécification historique ont été adaptées au compte obligatoire ; elles ne constituent pas une preuve de conformité.

[Campagne et fiche de résultat](README.md) · [État actuel](../../features/etat-fonctionnalites.md)

### 8c · Partage et modération

#### R8c.01 · Matrice des accès

*Critère : « Vérifier les accès à partir d'un compte neuf, d'un membre autorisé, d'un membre bloqué et d'une session absente. Tester les lectures directes, la recherche, les liens et les médias pour chaque mode et chaque niveau de visibilité. »*

- **Préconditions** : `profile_sharing_enabled = true` en staging · profil cible avec des éléments visibles et des éléments privés · quatre profils de test.
- **Étapes** : pour chaque case du tableau, tester la lecture directe, la recherche, le lien et l'accès aux médias.
- **Attendu** : accès seulement là où le mode et la visibilité le permettent · même réponse générique pour un profil privé, retiré, inexistant ou bloqué.

| Profil testé | Privé | Par lien | Membres | Observé |
|---|:-:|:-:|:-:|---|
| Compte neuf | [ ] | [ ] | [ ] | |
| Membre autorisé | [ ] | [ ] | [ ] | |
| Membre bloqué | [ ] | [ ] | [ ] | |
| Sans session | [ ] | [ ] | [ ] | |

#### R8c.02 · Retraits effectifs et non réversibles par synchronisation

*Critère : « Masquer un widget, rendre privé, révoquer un lien, bloquer, retirer un contenu et supprimer le compte rendent les éléments concernés inaccessibles par les canaux prévus. Une synchronisation ancienne ne peut pas rétablir une publication retirée. »*

- **Préconditions** : profil publié · second appareil du titulaire resté hors ligne avec une ancienne version · adresse de média relevée avant les retraits.
- **Étapes** : masquer un widget · rendre le profil privé · révoquer un lien puis republier · bloquer un membre · retirer un contenu par la modération · à chaque étape, tester la page, la recherche, le lien et l'adresse de média · remettre en ligne l'ancien appareil · supprimer le compte.
- **Attendu** : chaque élément devient inaccessible dès la confirmation du serveur, le lien révoqué reste invalide, l'ancienne synchronisation ne rétablit rien.

| Appareil | Réussi | Observé |
|---|:-:|---|
| iPhone | [ ] | |
| Android | [ ] | |

#### R8c.03 · Exposition limitée, export et purge

*Critère : « Le profil partagé n'expose que les données choisies. L'export du titulaire comprend ses contenus. La suppression et la purge sont vérifiées sur le stockage et les projections de recherche. »*

- **Préconditions** : profil publié avec un mélange d'éléments visibles et privés.
- **Étapes** : inspecter la réponse reçue par un visiteur (script) · exporter les données du titulaire · supprimer le compte, puis contrôler le stockage des médias et l'index de recherche en staging.
- **Attendu** : seuls les champs publiés sont renvoyés, export complet, plus aucun média ni entrée d'index après la purge.

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Appareil et staging | [ ] | |

#### R8c.04 · Signalements et obligations avant ouverture

*Critère : « Un signalement est reçu, traité avec motif, et journalisé. Les comptes de support à droits limités n'accèdent qu'aux éléments autorisés. Les règles, le contact, le blocage et la vérification des obligations des stores sont opérationnels avant ouverture. »*

- **Préconditions** : un compte `support` avec l'habilitation de modération et un sans · contenu publié fictif à signaler.
- **Étapes** : signaler le contenu · le traiter avec motif (`admin_get_report`, `admin_moderate`) · vérifier les lignes `moderation.view` et `moderation.decide` · tenter l'accès avec le compte `support` sans habilitation · vérifier les règles d'usage, le contact, le blocage et les déclarations des stores.
- **Attendu** : traitement motivé et journalisé, accès refusé sans habilitation, obligations prêtes avant l'ouverture.

| Plateforme | Réussi | Observé |
|---|:-:|---|
| Appareil et navigateur | [ ] | |
