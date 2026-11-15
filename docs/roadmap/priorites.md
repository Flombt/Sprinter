# Priorités et incertitudes ouvertes

[État des fonctionnalités](../features/etat-fonctionnalites.md) · [Validation](../quality/validation.md) · [Lancement](lancement.md)

Ce document sépare le travail restant du code déjà présent. Aucun flag distant, service ou compte réel n’a été interrogé pendant la refonte du 15 novembre 2026.

| Priorité | Travail restant | Preuve attendue |
|---|---|---|
| Qualité locale | Réinstaller le verrou dans un environnement propre ; revalider lint/types/tests/couverture et isoler les worktrees de la découverte Vitest | Exécution datée sur le commit cible, sans total mélangeant plusieurs arbres |
| Course et données | Recetter permissions, GPS verrouillé, auto-pause, reprise, fin transactionnelle, stockage volumineux | [Recette iPhone](../quality/recette-course-iphone.md), précision/autonomie mesurées |
| Compte obligatoire | Tester OTP, fournisseurs compatibles, restauration hors ligne, changement de compte, déconnexion/suppression | [Recettes comptes](../quality/recettes/comptes.md) et [sync](../quality/recettes/synchronisation.md) |
| Backend réel | Vérifier migrations, fonctions, RLS/buckets, Auth/SMTP, jobs et sauvegarde/restauration sur l’environnement choisi | Relevé récent et tests isolés ; les rapports du 14 novembre ne suffisent pas |
| Conformité/publication | Compléter éditeur, domaine, contacts et durées ouvertes ; faire valider les brouillons affectés par le compte obligatoire | [Dossier RGPD](../rgpd/README.md) et checklist de lancement |
| Profils et communauté | Recetter les fonctions déjà codées, les dépendances de flags, les retraits et la modération avant activation | [Recettes ciblées](../quality/recettes/README.md) et décision d’ouverture |
| Apple et musique | Tester le client natif normal, droits Santé/Live Activity, compte Spotify réel, casque/appels/audio | Résultat séparé par variante ; aucune nouvelle IPA sans demande explicite |
| Android | Cartes, OAuth, permission et suivi de fond sur appareils | [Recette Android](../quality/recettes/android.md) |
| UI/performance | VoiceOver, grande taille de texte, transparence, couple de contraste connu et course longue | [Performance](../quality/performance.md), appareil/version consignés |
| Météo distribuée | Choisir et brancher un fournisseur de production adapté | Adaptateur effectif, configuration et déclaration de données mises à jour |

Strava et Watch restent des contrats préparatoires ; une vraie intégration nécessiterait une décision et une tâche dédiées. Sentry et cartes téléchargeables hors ligne ne sont pas des capacités opérationnelles constatées. Ne pas relancer leur implémentation par simple lecture d’un ancien backlog.

Le site privé `sprinter-admin` est hors de cet arbre : son code et sa configuration ne peuvent pas être validés par l’audit de Sprinter. L’état d’un tableau GitHub au 11 novembre n’est pas une liste actuelle de bugs ; son relevé reste dans les [archives](../archive/README.md).
