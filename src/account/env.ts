/**
 * Configuration publique du backend, embarquée au build par Expo (EXPO_PUBLIC_*).
 * Ces valeurs sont publiques par construction : uniquement l'URL du projet et sa clé
 * publique. Sans elles, l'app fonctionne exactement comme avant (aucun appel réseau).
 */
export interface BackendConfig {
  url: string;
  publishableKey: string;
}

export function readBackendConfig(env: Record<string, string | undefined>): BackendConfig | null {
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) return null;
  try {
    const parsed = new URL(url);
    const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname.endsWith('.local');
    if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) return null;
  } catch {
    return null;
  }
  return { url: url.replace(/\/+$/, ''), publishableKey };
}

// Expo remplace statiquement chaque `process.env.EXPO_PUBLIC_*` au build : accès explicites requis.
export const backend: BackendConfig | null = readBackendConfig({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});
