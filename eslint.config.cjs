const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');

// Keep the Hooks contract enforced independently of the optional React Compiler migration.
const compilerDiagnostics = [
  'static-components', 'use-memo', 'preserve-manual-memoization', 'incompatible-library',
  'immutability', 'globals', 'refs', 'set-state-in-effect', 'error-boundaries', 'purity',
  'set-state-in-render', 'unsupported-syntax', 'config', 'gating',
];
const compilerRules = Object.fromEntries(compilerDiagnostics.map(name => ['react-hooks/' + name, 'off']));

module.exports = defineConfig([
  expo,
  { ignores: ['.expo/**', '.verification/**', 'dist/**', 'artifacts/**', 'supabase/**', 'scripts/db-local/**'] },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      ...compilerRules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
]);
