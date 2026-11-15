# Maintenir le cerveau documentaire

[Carte documentaire](../00-INDEX.md) · [Décisions](../decisions/README.md)

## Mise à jour minimale

1. Lire la fiche du domaine, puis les sources nécessaires. Le code décrit l’implémentation ; une preuve datée décrit la validation ; une spécification décrit une intention.
2. Après un changement observable, corriger **la fiche propriétaire**. Mettre à jour la matrice des fonctionnalités seulement si statut, disponibilité ou limite change.
3. Si un choix durable évolue, modifier ou remplacer la décision concernée avec motif et conséquences. Ne pas recopier l’implémentation détaillée.
4. Ajouter à l’index seulement un sujet ou un chemin nouveau. `AGENTS.md` reste un routeur : aucune inclusion automatique du dossier entier.
5. Vérifier les liens relatifs, fragments de titres, chemins sources et statuts ; `git diff --check` détecte les erreurs d’espacement. Ne conserver aucun lien vers une preuve locale ignorée qui disparaîtrait dans un clone.

## Responsabilités documentaires

| Nature du changement | Documents à considérer |
|---|---|
| Comportement produit | Fiche `features/` ; matrice si statut modifié |
| Structure de modules / stockage | Fiche `architecture/` ou `backend/` concernée |
| Signature RPC publique | Migration et contrat admin si concerné ; détail technique dans SQL |
| Choix de plateforme / sécurité / confidentialité | Décision ciblée, puis seule fiche impactée |
| Preuve de test ou recette | `quality/validation.md` ou résultat du scénario avec date, commit, client et limites |
| Données collectées / publication / conservation | Documents RGPD/stores concernés, marqués brouillons jusqu’à validation applicable |
| Incident ou audit clos | Archive datée avec avertissement et lien vers la référence actuelle |

Une commande citée doit exister dans le manifeste ou l’outil indiqué. Un chemin source doit être exact, relatif au document et cliquable. Pour les liens entre documents, préférer les titres stables aux numéros de ligne ; GitHub et Obsidian comprennent les liens Markdown relatifs ordinaires.

## Éviter les doublons

La matrice indique où en est une fonction ; sa fiche explique ses invariants ; la décision explique pourquoi. Les recettes décrivent une observation attendue et la validation consigne ce qui a vraiment été exécuté. L’archive conserve l’histoire et n’est jamais un guide de modification par défaut.

Ne pas tenir d’inventaire permanent des fonctions, constantes, tables ou paramètres déjà exprimés dans le code. L’[inventaire de cette refonte](audit-documentaire-2026-11-15.md) est une trace datée, pas une liste à régénérer à chaque tâche.

Deux chemins de compatibilité sont justifiés : [INSTALL_IPA](../INSTALL_IPA.md), copié dans le paquet par le script existant, et [ACCOUNTS](../ACCOUNTS.md), cité par la configuration Supabase. Les README proches de pages statiques/attributions ne doivent pas répéter les fiches produit.
