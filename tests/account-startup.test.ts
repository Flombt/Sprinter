import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// Supabase est chargé au démarrage uniquement avec un backend configuré.
// Les SDK natifs Apple et Google sont toujours chargés au moment de la connexion.
const root = join(__dirname, '..');
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}
const sources = [join(root, 'App.tsx'), ...files(join(root, 'src'))].map((path) => ({
  path: relative(root, path).split(sep).join('/'),
  text: readFileSync(path, 'utf8'),
}));
const staticImport = (module: string) => new RegExp(`^import\\s+(?!type\\b)[^;]*?from\\s+['"]${module.replace(/[/@.-]/g, (c) => `\\${c}`)}['"]`, 'm');

describe('chargement du module compte', () => {
  it('ne charge Supabase que dans le module client, lui-même chargé à la demande', () => {
    const importers = sources.filter((file) => staticImport('@supabase/supabase-js').test(file.text)).map((file) => file.path);
    expect(importers).toEqual(['src/account/supabaseClient.ts']);
    const clientImporters = sources.filter((file) => /^import\s+(?!type\b)[^;]*from\s+['"]\.\/supabaseClient['"]/m.test(file.text));
    expect(clientImporters).toEqual([]);
  });

  it('ne charge les modules natifs de connexion qu’au moment du geste', () => {
    for (const module of ['expo-apple-authentication', '@react-native-google-signin/google-signin', 'aes-js']) {
      const importers = sources.filter((file) => staticImport(module).test(file.text)).map((file) => file.path);
      expect(importers.every((path) => path === 'src/account/secureSession.ts'), `${module} : ${importers.join(', ')}`).toBe(true);
    }
  });

  it('n’expose aucune clé serveur côté app', () => {
    for (const file of sources) expect(file.text, file.path).not.toMatch(/service_role|sb_secret_/i);
  });
});
