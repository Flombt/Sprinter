import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const config = require('../app.json').expo;
const eas = require('../eas.json');
const configure = require('../app.config.js');

describe('configuration OTA des futures versions store', () => {
  it('préserve le démarrage local, le bundle embarqué et les protections Expo', () => {
    expect(config.runtimeVersion).toEqual({ policy: 'fingerprint' });
    expect(config.updates.url).toBe(`https://u.expo.dev/${config.extra.eas.projectId}`);
    expect(config.updates.checkAutomatically).toBe('NEVER');
    expect(config.updates.fallbackToCacheTimeout).toBe(0);
    expect(config.updates.useEmbeddedUpdate).toBe(true);
    expect(config.updates.disableAntiBrickingMeasures).not.toBe(true);
  });

  it('sépare les canaux et environnements EAS sans activer de publication automatique', () => {
    for (const name of ['development', 'preview', 'production']) {
      expect(eas.build[name].channel).toBe(name);
      expect(eas.build[name].environment).toBe(name);
    }
    const ipa = readFileSync(new URL('../.github/workflows/ios-ipa.yml', import.meta.url), 'utf8');
    expect(ipa).toMatch(/on:\s*\n\s+workflow_dispatch:\s*\n\s*\npermissions:/);
  });

  it('désactive les OTA dans la variante IPA personnelle sans modifier les plugins store', () => {
    const previous = process.env.SPRINTER_SIDELOAD;
    const before = JSON.stringify(config);
    try {
      process.env.SPRINTER_SIDELOAD = '1';
      const sideload = configure({ config });
      expect(sideload.updates.enabled).toBe(false);
      expect(sideload.updates.url).toBeUndefined();
      expect(sideload.updates.requestHeaders).toBeUndefined();
      expect(sideload.extra.sprinterSideload).toBe(true);
      expect(JSON.stringify(config)).toBe(before);
      process.env.SPRINTER_SIDELOAD = '';
      const store = configure({ config });
      expect(store.updates).toEqual(config.updates);
      expect(store.ios.usesAppleSignIn).toBe(true);
      expect(store.plugins).toContain('expo-apple-authentication');
      expect(store.plugins).toContain('./plugins/with-sprinter-apple');
    } finally {
      if (previous === undefined) delete process.env.SPRINTER_SIDELOAD;
      else process.env.SPRINTER_SIDELOAD = previous;
    }
  });

  it('ne donne accès à aucune API de rechargement au service ou à ses écrans', () => {
    for (const path of [
      'App.tsx',
      'src/services/updateManager.ts',
      'src/services/updates.ts',
      'src/services/updates.web.ts',
      'src/settings/VersionPanel.tsx',
    ]) {
      const text = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
      expect(text).not.toMatch(
        /\b(?:reloadAsync|reloadAppAsync|setUpdateURLAndRequestHeadersOverride|setUpdateRequestHeadersOverride)\b/,
      );
    }
    const web = readFileSync(new URL('../src/services/updates.web.ts', import.meta.url), 'utf8');
    expect(web).not.toMatch(/['"]expo-updates['"]|netinfo/);
  });
});
