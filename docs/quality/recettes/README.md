# Campagne de recette par domaine

[Carte documentaire](../../00-INDEX.md) · [Validation exécutée](../validation.md) · [Recette terrain iPhone](../recette-course-iphone.md)

**NON EXÉCUTÉE pendant la refonte documentaire du 15 novembre 2026.** Chaque case vide reste ouverte. Les numéros de phase et identifiants sont conservés pour la traçabilité de la recette du 14 novembre ; ils ne décrivent pas l’ordre d’implémentation restant. Les attentes du compte facultatif ont été remplacées par le parcours actuel de connexion obligatoire.

## Choisir uniquement la fiche utile

| Fiche | Scénarios / prérequis |
|---|---|
| [Préparation](preparation.md) | Matériel, environnements, comptes, preuves initiales P0 |
| [Comptes](comptes.md) | R1.01 à R1.11 : identité, OTP, méthodes, accès, flags, export et suppression |
| [Synchronisation](synchronisation.md) | R2.01 à R2.10 et situations A à J : conflits, comptes, reprise, hors ligne |
| [Tracés GPS](traces-gps.md) | R3.01 à R3.06 : choix distinct, Storage, transfert, validité et suppression |
| [Administration](administration.md) | R4a à R4d : accès, audit, recherche, agrégats, support et configuration |
| [Android](android.md) | R5.01 à R5.06 : fond, cartes, modules, connexions, permissions et CI |
| [Lancement](lancement.md) | R6.01 à R6.03 ; complément de la [checklist opérationnelle](../../roadmap/lancement.md) |
| [Communauté](communaute.md) | R7.01 à R7.07 : adhésion, pseudo, données exposées, signalement et retrait |
| [Profil privé](profil-8a.md) | R8a.01 à R8a.04 : caractère facultatif, média, édition et cloisonnement |
| [Studio](profil-8b.md) | R8b.01 à R8b.03 : configurations, widgets et accessibilité |
| [Partage](profil-8c.md) | R8c.01 à R8c.04 : accès, retraits, export et modération |
| [Thèmes et cartes](profil-8d.md) | R8d.01 à R8d.02 : style partagé et génération locale |

Une référence R1.x rencontrée dans une autre fiche renvoie à Comptes ; R2.x et S-A à S-J renvoient à Synchronisation. Les clauses de conformité restent des critères à faire valider, pas des conclusions juridiques de cet audit.

## Conditions de campagne

Utiliser un environnement de recette isolé avec des données synthétiques et une autorisation adaptée aux opérations distantes. Les outils d’injection, vidage de cache ou interruption volontaire cités dans les scénarios sont des **préconditions à fournir**, pas des outils déjà livrés par cette documentation. Ne pas désinstaller le seul conteneur possédant des courses à conserver.

Le site admin est dans un autre dépôt ; les scénarios d’interface admin nécessitent son code et son environnement. La preuve d’un test automatisé doit être enregistrée séparément d’un résultat appareil. Les anciennes références CI/déploiement sont dans les [archives](../../archive/README.md).

## Fiche de résultat et signature

| Champ | À renseigner après observation |
|---|---|
| Date, opérateur, scénario | |
| Commit app / backend / admin | |
| Client et variante (Expo Go, natif normal, sideload), version/build | |
| Appareil, OS, langue, fuseau, réseau et permissions | |
| Projet de recette et flags effectivement lus | |
| Actions, attendu et obtenu | |
| Résultat : réussi / échoué / bloqué / non exécuté | |
| Preuve privée expurgée, anomalie, gravité et suivi | |
| Décision de Flo et réserves restantes | |

Une signature de lancement exige les preuves et anomalies de la campagne, les versions exactes et les réserves acceptées. Cette refonte ne signe aucun lancement et ne coche aucun scénario.
