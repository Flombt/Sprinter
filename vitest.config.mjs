import { configDefaults, defineConfig } from 'vitest/config';

// Les tests Deno des Edge Functions (supabase/functions) et le banc SQL s'exécutent à part.
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, 'supabase/**', 'scripts/db-local/**'] },
});
