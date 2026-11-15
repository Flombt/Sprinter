# Sprinter

Application de running en français : suivi GPS, coach d’allure, séances, analyse et progression personnelle. Le calcul sportif et la persistance restent locaux ; un compte est obligatoire pour accéder à l’application. La sauvegarde cloud des courses et celle des tracés GPS sont deux choix distincts.

**Commencer par la [carte documentaire](docs/00-INDEX.md).** Pour Codex, les instructions essentielles et le routage sont dans [AGENTS.md](AGENTS.md).

## Développer

Stack déclarée : Expo SDK 58, React Native 0.88.1, React 19.3, TypeScript strict. Node 24 est utilisé en CI. Les versions exactes sont dans [package.json](package.json) et [package-lock.json](package-lock.json).

```sh
npm ci
# Renseigner les deux variables publiques Supabase avant le lancement.
npm start
```

Configurer `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` dans l’environnement local non versionné. Sans backend configuré, l’écran de connexion bloque l’accès. Dans Expo Go, utiliser le code e-mail ; les connexions natives et les capacités iOS supplémentaires nécessitent un client adapté.

- [Commandes, clients Expo et contraintes natives](docs/architecture/developpement.md)
- [Configuration du backend et exploitation](docs/backend/exploitation.md)
- [Fonctionnalités et limites réelles](docs/features/etat-fonctionnalites.md)
- [Validation actuelle et limites des preuves](docs/quality/validation.md)
- [Installation de la variante IPA personnelle](docs/INSTALL_IPA.md)

Une compilation IPA nécessite une demande explicite pour la tâche en cours. Un export JavaScript Expo ne valide ni le Swift, ni la signature, ni le fonctionnement sur iPhone.
