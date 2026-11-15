# 002 · Compte obligatoire et sauvegardes facultatives

Statut : **en vigueur ; remplace le compte facultatif du cahier des charges v2.1**. [Décisions](README.md).

## Choix et raison

Un compte connecté est requis pour accéder à Sprinter et démarrer une course. Après connexion, Courir s’ouvre directement, sans imposer le remplissage des champs de profil. Ce parcours est une évolution produit explicite, attestée par les commits `f4fc8d4` et `ca7b9a6` et les gardes actuelles ; ne pas le « corriger » en restaurant le mode invité décrit auparavant.

Les sauvegardes des courses et des tracés restent deux choix distincts. Le calcul sportif reste local après accès à l’app ; une session stockée peut se restaurer hors ligne. Le profil personnalisable et les fonctions communautaires restent facultatifs.

## Conséquences

- `accounts_enabled=false` ne contourne pas l’authentification : il ferme les options cloud dépendantes.
- Sans configuration du backend, l’app affiche la connexion indisponible ; le démarrage initial n’est pas un parcours hors ligne anonyme.
- Après déconnexion/suppression, les courses éventuellement conservées restent locales mais la navigation est protégée jusqu’à reconnexion.
- Les brouillons juridiques et les scénarios de recette doivent décrire ce parcours, sans prétendre qu’ils ont été approuvés ou exécutés.

Sources : [App.tsx](../../App.tsx), [AccountGate.tsx](../../src/account/ui/AccountGate.tsx), [accountStore.ts](../../src/account/accountStore.ts), [useRunStart.ts](../../src/navigation/useRunStart.ts), [tests de démarrage](../../tests/account-startup.test.ts). Détail : [comptes](../features/comptes.md).
