import { configDefaults, defineConfig } from 'vitest/config';

// Les tests Deno des Edge Functions (supabase/functions) et le banc SQL s'exécutent à part.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'supabase/**', 'scripts/db-local/**'],
    coverage: {
      provider: 'v8',
      include: ['src/sync/settings.ts', 'src/sync/duplicates.ts', 'src/sync/routes.ts', 'src/sync/engine.ts', 'src/sync/documents.ts'],
      reporter: ['text', 'json-summary', 'html'],
      thresholds: { functions: 90 },
    },
  },
});
