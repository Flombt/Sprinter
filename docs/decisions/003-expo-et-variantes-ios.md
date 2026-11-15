# 003 · Expo et variantes natives iOS

Statut : **en vigueur**. [Décisions](README.md).

## Choix et raison

Conserver React Native / Expo SDK 58 et l’alignement React/RN du verrou npm. Expo Go fournit une boucle de développement Windows/iPhone ; les fonctions natives supplémentaires vivent dans des modules et plugins dédiés. L’historique rapporte un alignement sur le SDK attendu par le client iPhone : ce contexte explique le choix sans prouver la compatibilité de tout futur client.

Le client natif normal et le sideload sont des variantes distinctes. `SPRINTER_SIDELOAD=1` retire Santé, App Group, Live Activity et Sign in with Apple pour le paquet personnel ; le bridge JS vérifie aussi cette variante. Ne pas réintroduire ces capacités par un simple changement d’écran.

## Conséquences

- Le bundle Expo ne compile pas le Swift, ne signe pas l’app et ne valide pas les permissions sur appareil.
- Expo Go reste limité au suivi de premier plan. Une Live Activity ne fournit pas un droit GPS de fond.
- Préserver les variantes web, les gardes natives et les sources de configuration plutôt que modifier le projet généré.
- **Une compilation IPA locale, EAS ou GitHub exige une demande explicite de l’utilisateur pour la tâche en cours.** Une demande passée ne s’étend pas aux tâches suivantes ; la documentation de build n’est pas une demande.

Sources : [package.json](../../package.json), [app.config.js](../../app.config.js), [capabilities.ts](../../src/services/capabilities.ts), [bridge.ts](../../src/apple/bridge.ts), [workflow IPA](../../.github/workflows/ios-ipa.yml), [AGENTS](../../AGENTS.md). Détail : [développement](../architecture/developpement.md).
