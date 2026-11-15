# 006 · Interface partagée et abonnements ciblés

Statut : **en vigueur, constaté dans le code**. [Décisions](README.md).

## Choix et raison

Les calculs sportifs vivent dans les moteurs et services ; l’UI consomme des instantanés par sélecteurs. Les panneaux d’onglets conservent leur état tout en limitant les mises à jour rapides des écrans masqués. Ce choix vise à préserver la continuité du parcours et réduire le travail pendant le GPS ; ses gains matériels restent à mesurer.

Couleurs, texte et contrôles réutilisent `src/ui/` et ses rôles sémantiques. Le thème et les préférences d’accessibilité sont centraux ; le verre natif a un repli.

## Conséquences

- Ne pas déplacer les calculs de course dans un rendu ni abonner toute la navigation à chaque tick.
- Préserver état d’onglet, paramètres de route, retour natif et variantes web.
- Une couleur seule ne suffit pas à exprimer un état d’allure ; conserver texte, position et commandes accessibles.
- Les tests de contraste de couples ne prouvent pas la conformité de tous les écrans ; garder l’exception connue et la recette matérielle visibles.

Sources : [useSessionSelector.ts](../../src/services/useSessionSelector.ts), [RunTabs.tsx](../../src/navigation/RunTabs.tsx), [theme.tsx](../../src/ui/theme.tsx), [tokens.ts](../../src/ui/tokens.ts). Détails : [interface](../design/interface.md), [système visuel](../design/systeme-visuel.md), [performance](../quality/performance.md).
