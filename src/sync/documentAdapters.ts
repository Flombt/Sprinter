import type { WorkoutDefinition } from '../workouts/types';
import type { CalendarEntry, Shoe, TrainingPlan } from '../progression/types';
import type { SavedRoute } from '../routes/types';
import { workouts } from '../workouts/store';
import { progression } from '../progression/store';
import { toolsStore } from '../tools/store';
import { session } from '../services/session';
import type { DocumentAdapter } from './documents';

const without = (payload: Record<string, unknown>, ...keys: string[]) => {
  const copy = { ...payload };
  for (const name of keys) delete copy[name];
  return copy;
};

/** Adaptateurs des stores existants (aucune modification de leur logique). */
export const documentAdapters: DocumentAdapter[] = [
  {
    kind: 'workout',
    async list() {
      await workouts.initialize();
      return workouts.getSnapshot().definitions.map((definition) => ({ id: definition.id, payload: definition as unknown as Record<string, unknown>, updatedAt: definition.updatedAt }));
    },
    async apply(id, payload) {
      if (payload) await workouts.save(payload as unknown as WorkoutDefinition);
      else if (workouts.getSnapshot().definitions.some((definition) => definition.id === id)) await workouts.remove(id);
    },
    // `save` réécrit updatedAt : l'empreinte l'ignore pour éviter les allers-retours.
    fingerprint: (payload) => without(payload, 'updatedAt'),
  },
  {
    kind: 'shoe',
    async list() {
      await progression.initialize();
      return progression.getSnapshot().data.shoes.map((shoe) => ({ id: shoe.id, payload: shoe as unknown as Record<string, unknown> }));
    },
    async apply(id, payload) {
      const existing = progression.getSnapshot().data.shoes.find((shoe) => shoe.id === id);
      // Une chaussure n'est jamais effacée : supprimée ailleurs, elle est archivée ici.
      if (payload) await progression.saveShoe(payload as unknown as Shoe);
      else if (existing && !existing.archived) await progression.saveShoe({ ...existing, archived: true });
    },
  },
  {
    kind: 'plan',
    async list() {
      await progression.initialize();
      const data = progression.getSnapshot().data;
      return data.plans.map((plan) => ({
        id: plan.id, updatedAt: plan.createdAt,
        payload: { plan, entries: data.entries.filter((entry) => entry.planId === plan.id) } as unknown as Record<string, unknown>,
      }));
    },
    async apply(id, payload) {
      const data = progression.getSnapshot().data;
      if (payload) {
        const { plan, entries } = payload as unknown as { plan: TrainingPlan; entries: CalendarEntry[] };
        if (!data.plans.some((item) => item.id === id)) await progression.savePlan(plan, entries);
      } else if (data.plans.some((item) => item.id === id)) {
        await progression.removePlan(id, session.getSnapshot().history);
      }
    },
    // Le plan est synchronisé à sa création ; l'état des séances découle des courses synchronisées.
    fingerprint: (payload) => (payload as { plan?: unknown }).plan,
  },
  {
    kind: 'route',
    requiresRoutes: true,
    async list() {
      await toolsStore.initialize();
      return toolsStore.getSnapshot().routes.map((route) => ({ id: route.id, payload: route as unknown as Record<string, unknown>, updatedAt: route.createdAt }));
    },
    async apply(id, payload) {
      const existing = toolsStore.getSnapshot().routes.find((route) => route.id === id);
      if (!payload) { if (existing) await toolsStore.deleteRoute(id); return; }
      const route = payload as unknown as SavedRoute;
      if (existing) { if (existing.name !== route.name) await toolsStore.renameRoute(id, route.name); }
      else await toolsStore.addRoute(route);
    },
  },
];
