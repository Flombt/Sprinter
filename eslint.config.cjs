const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');

const compilerDiagnostics = [
  'static-components', 'use-memo', 'preserve-manual-memoization', 'incompatible-library',
  'immutability', 'globals', 'refs', 'set-state-in-effect', 'error-boundaries', 'purity',
  'set-state-in-render', 'unsupported-syntax', 'config', 'gating',
];

const fontSizeMessage = 'Utilisez fontSizes ou un rôle de typography depuis src/ui/tokens.ts.';

module.exports = defineConfig([
  expo,
  { ignores: ['.expo/**', '.verification/**', 'dist/**', 'artifacts/**'] },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      ...Object.fromEntries(compilerDiagnostics.map(name => ['react-hooks/' + name, 'off'])),
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['App.tsx', 'src/**/*.{ts,tsx}'],
    ignores: ['src/ui/tokens.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: 'Property[key.name="fontSize"] > Literal, Property[key.value="fontSize"] > Literal', message: fontSizeMessage },
        { selector: 'Property[key.name="fontSize"] ConditionalExpression > Literal', message: fontSizeMessage },
        { selector: 'JSXAttribute[name.name="fontSize"] > Literal, JSXAttribute[name.name="fontSize"] JSXExpressionContainer > Literal', message: fontSizeMessage },
      ],
    },
  },
]);
