import type { ToolsPersistence } from './persistence';
import { readRoute, readTools } from './validation';
import { defaultToolsData, type SavedRoute, type ToolsData } from './types';
export async function openTools(): Promise<ToolsPersistence> {
  const key = 'sprinter.tools.v1';
  const raw = localStorage.getItem(key), data = raw ? JSON.parse(raw) : { routes: [], preferences: defaultToolsData() };
  if (!Array.isArray(data.routes)) throw new Error('Bibliothèque de parcours illisible. Données conservées.');
  let routes: SavedRoute[] = data.routes.map(readRoute), preferences = readTools(data.preferences);
  const persist = (nextRoutes: SavedRoute[], nextPreferences: ToolsData) => {
    // Publish the in-memory version only after the storage write succeeds (including quota failures).
    localStorage.setItem(key, JSON.stringify({ routes: nextRoutes, preferences: nextPreferences }));
    routes = nextRoutes; preferences = nextPreferences;
  };
  return { async load() { return { routes: [...routes], preferences }; },
    async saveRoute(route) { persist([route, ...routes.filter(r => r.id !== route.id)], preferences); },
    async deleteRoute(id) { persist(routes.filter(r => r.id !== id), preferences); },
    async savePreferences(value) { persist(routes, value); } };
}
