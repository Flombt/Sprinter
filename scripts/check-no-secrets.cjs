#!/usr/bin/env node
// Garde anti-secrets (§0.2 règle 2, §12.2) : échoue si le code embarqué dans l'app ou sa
// configuration de build contient une clé serveur, une clé privée ou une clé Apple .p8.
// Les variables EXPO_PUBLIC_* sont publiques par construction : seules l'URL Supabase et
// la clé publique (publishable/anon) peuvent y figurer.
const { readdirSync, readFileSync, statSync, existsSync } = require('node:fs');
const { join, relative, extname } = require('node:path');

const root = join(__dirname, '..');
const targets = ['src', 'App.tsx', 'index.ts', 'app.config.js', 'app.json', 'eas.json', 'plugins', 'modules'];
const forbidden = [
  { label: 'rôle serveur Supabase', pattern: /service_role/i },
  { label: 'clé secrète Supabase', pattern: /sb_secret_/ },
  { label: 'variable de clé secrète', pattern: /SUPABASE_SECRET|SUPABASE_SERVICE_ROLE/ },
  { label: 'clé privée PEM', pattern: /-----BEGIN (?:EC |RSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/ },
  { label: 'variable EXPO_PUBLIC_ portant un secret', pattern: /EXPO_PUBLIC_[A-Z0-9_]*(?:SECRET|PRIVATE|SERVICE)/ },
];
const textExtensions = new Set(['.ts', '.tsx', '.js', '.cjs', '.mjs', '.json', '.swift', '.m', '.h', '.plist', '.xml', '.kt', '.java', '.gradle', '.rb', '.md', '']);
const failures = [];

function scan(path) {
  if (!existsSync(path)) return;
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path)) if (entry !== 'node_modules' && !entry.startsWith('.')) scan(join(path, entry));
    return;
  }
  const rel = relative(root, path);
  if (extname(path).toLowerCase() === '.p8') { failures.push(`${rel} : fichier de clé Apple .p8`); return; }
  if (!textExtensions.has(extname(path).toLowerCase()) || stat.size > 2_000_000) return;
  const text = readFileSync(path, 'utf8');
  for (const { label, pattern } of forbidden) if (pattern.test(text)) failures.push(`${rel} : ${label}`);
}

for (const target of targets) scan(join(root, target));
// Une clé .p8 ne doit exister nulle part dans le dépôt.
(function findP8(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) findP8(path);
    else if (extname(entry).toLowerCase() === '.p8') failures.push(`${relative(root, path)} : fichier de clé Apple .p8`);
  }
})(root);

const unique = [...new Set(failures)];
if (unique.length) {
  console.error('✗ Secrets ou motifs interdits détectés :');
  for (const failure of unique) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`✓ Aucun secret détecté (${targets.join(', ')}).`);
