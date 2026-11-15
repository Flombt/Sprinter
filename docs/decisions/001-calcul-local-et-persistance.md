# 001 · Calcul sportif local et récupération en pause

Statut : **en vigueur, constaté dans le code**. [Décisions](README.md).

## Choix et raison

Le moteur sportif reste séparé des API natives, de React et du backend. SQLite est la référence opérationnelle sur l’appareil. Le GPS et le calcul ne doivent pas attendre une sauvegarde réseau : cette séparation protège le suivi lors des pertes de connexion et permet des tests déterministes.

Les horloges d’exécution sont monotones ; temps actif, total et périodes fiables sont distincts. Une perte de mesure ne crée pas de distance ou de qualité fictive. La récupération revient en pause pour ne pas redémarrer silencieusement les capteurs.

## Conséquences

- Conserver l’écriture sérialisée, le journal incrémental et la transaction finale ; une écriture ancienne ne doit pas recréer un brouillon fermé.
- Refuser les versions plus récentes sans réinitialiser les données ; préserver les activités illisibles et signaler la limite.
- Accepter que les mesures restent estimées et les bilans partiels ; la documentation ne promet pas une précision terrain non mesurée.

Sources : [engine.ts](../../src/core/engine.ts), [clock.ts](../../src/core/clock.ts), [session.ts](../../src/services/session.ts), [repository.ts](../../src/storage/repository.ts). Détail : [cycle de course](../architecture/donnees-et-cycle-course.md).
