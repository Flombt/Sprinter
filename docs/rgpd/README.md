# Documents réglementaires et points ouverts

[Carte documentaire](../00-INDEX.md) · [Comptes actuels](../features/comptes.md) · [Checklist de lancement](../roadmap/lancement.md)

Les **neuf documents RGPD et deux dossiers stores d’origine sont conservés**. Ce sont des brouillons et procédures à compléter/valider, sans publication ni approbation juridique produite par cette refonte. Leurs références juridiques et fournisseur n’ont pas été réauditées pour leur actualité.

## Trouver le document utile

| Document | Responsabilité / état |
|---|---|
| [Mentions légales](mentions-legales.md) | Identité, hébergement et contact ; variantes et placeholders à trancher |
| [CGU](cgu.md) | Accès, compte, service et responsabilité ; revue nécessaire du compte obligatoire et de la fin de service |
| [Politique de confidentialité](politique-confidentialite.md) | Information publique sur les traitements ; révision technique du parcours, publication à préparer |
| [Registre des traitements](registre-traitements.md) | Fiches T0 à T13 et périmètres ; activation réelle non attestée |
| [Durées de conservation](durees-conservation.md) | Objectifs, purges et exceptions ; comparer chaque mécanisme avec le backend et sa planification réelle |
| [Sous-traitants](sous-traitants.md) | Prestataires, contrats et transferts ; valeurs réelles à renseigner |
| [Analyse AIPD](analyse-aipd.md) | Évaluation et mesures préalables ; validation et suivi ouverts |
| [Procédure droits](procedure-droits.md) | Demandes, export/suppression et délais de traitement ; rôles opérationnels à confirmer |
| [Procédure violation](procedure-violation.md) | Qualification, réponse et notifications ; exercice et contacts à préparer |
| [App Store](stores/app-store-confidentialite.md) | Déclarations et préparation de soumission, selon les capacités réellement distribuées |
| [Google Play](stores/google-play-data-safety.md) | Données, permissions et publication Android ; réponses définitives à vérifier |

## Écarts traités et réserves

Le code exige désormais un compte. Les promesses de mode invité dans CGU, politique, registre, rétention et dossiers stores ont été corrigées comme **descriptions techniques de brouillons**. La sauvegarde des courses et celle des tracés restent deux choix distincts ; le profil et la communauté sont facultatifs. Les bases légales, clauses de responsabilité et durées n’ont pas été remplacées par de nouvelles décisions juridiques.

Les profils et fonctions communautaires sont codés mais conditionnés par flags. « Préparatoire » dans un registre signifie que le traitement reste à autoriser et ouvrir ; cela ne signifie plus absence de code. « Actif au lancement » décrit une cible, sans prouver une activation en production.

À fermer avant publication : identité/statut de l’éditeur, domaine et contacts, région et prestataires réels, durées de modération encore ouvertes, portée des déclarations stores, AIPD et versions des textes effectivement acceptés. Les promesses de continuité après arrêt du service nécessitent une décision cohérente avec l’authentification obligatoire.

Le dépôt contient une [page de suppression](../../web/README.md), pas une preuve de son hébergement. Les mécanismes SQL et jobs se trouvent dans [backend/architecture](../backend/architecture.md) et [exploitation](../backend/exploitation.md) ; leur configuration réelle reste à contrôler.
