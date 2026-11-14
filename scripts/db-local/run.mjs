#!/usr/bin/env node
// Banc d'essai SQL local sans Docker : démarre un PostgreSQL éphémère, applique une
// émulation minimale de Supabase, les migrations, pgTAP, puis exécute les tests de
// supabase/tests/database. La référence reste `supabase test db` (CI, job `db`).
//
// Usage : node scripts/db-local/run.mjs [--seed [--seed-users N]] [--seed-file f.sql] [--sql f.sql] [--only motif] [--keep-data]
// Variables : PG_BIN (dossier contenant initdb/postgres), PGTAP_SRC (sources pgTAP décompressées).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

const PG_BIN = process.env.PG_BIN ?? join(homedir(), '.local/opt/pg17/node_modules/@embedded-postgres/darwin-arm64/native/bin');
const PGTAP_SRC = process.env.PGTAP_SRC ?? join(homedir(), '.local/opt/pgtap-src');
for (const [label, path] of [['PG_BIN', join(PG_BIN, 'postgres')], ['PGTAP_SRC', join(PGTAP_SRC, 'sql/pgtap.sql.in')]]) {
  if (!existsSync(path)) { console.error(`${label} introuvable : ${path}`); process.exit(2); }
}

const work = mkdtempSync(join(tmpdir(), 'sprinter-pg-'));
const data = join(work, 'data');
const port = 54329;
const started = Date.now();
let server;

function pgtapSql() {
  const source = readFileSync(join(PGTAP_SRC, 'sql/pgtap.sql.in'), 'utf8');
  return source.replaceAll('MODULE_PATHNAME', 'pgtap').replaceAll('__OS__', process.platform).replaceAll('__VERSION__', '1.3');
}
// pgTAP est déjà chargé par le banc : on neutralise son installation en extension.
const adapt = (sql) => sql.replace(/create\s+extension\s+if\s+not\s+exists\s+pgtap[^;]*;/gi, '-- pgtap déjà chargé');

async function connect(database = 'postgres') {
  for (let attempt = 0; attempt < 100; attempt++) {
    const client = new pg.Client({ host: work, port, user: 'postgres', database });
    try { await client.connect(); return client; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('PostgreSQL ne répond pas.');
}

function tapLines(result) {
  const results = Array.isArray(result) ? result : [result];
  const lines = [];
  for (const r of results) for (const row of r.rows ?? []) {
    const value = Object.values(row)[0];
    if (typeof value === 'string') lines.push(...value.split('\n'));
  }
  return lines;
}

async function main() {
  const init = spawnSync(join(PG_BIN, 'initdb'), ['-D', data, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8', '--locale=C'], { encoding: 'utf8' });
  if (init.status !== 0) throw new Error(init.stderr || 'initdb a échoué');
  server = spawn(join(PG_BIN, 'postgres'), ['-D', data, '-k', work, '-p', String(port), '-c', "listen_addresses=", '-c', 'fsync=off', '-c', 'full_page_writes=off', '-c', 'timezone=UTC'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let serverLog = ''; server.stderr.on('data', (d) => { serverLog += d; });
  const admin = await connect();
  await admin.query('create database sprinter_test');
  await admin.end();
  const db = await connect('sprinter_test');
  await db.query(`alter database sprinter_test set search_path = "$user", public, extensions`);
  await db.query('set search_path = "$user", public, extensions');
  await db.query(readFileSync(join(here, 'supabase-shim.sql'), 'utf8'));
  const migrations = readdirSync(join(root, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort();
  for (const file of migrations) {
    try { await db.query(readFileSync(join(root, 'supabase/migrations', file), 'utf8')); }
    catch (error) { throw new Error(`Migration ${file} : ${error.message}${error.where ? `\n  ${error.where}` : ''}`); }
  }
  console.log(`✓ ${migrations.length} migrations appliquées`);
  await db.query('set search_path = extensions'); await db.query(pgtapSql()); await db.query('set search_path = "$user", public, extensions');
  const seedFile = option('--seed-file') ?? (flag('--seed') ? join(root, 'supabase/seed.sql') : undefined);
  if (seedFile) {
    if (option('--seed-users')) await db.query(`set sprinter.seed_users = '${Number(option('--seed-users'))}'`);
    const t = Date.now(); await db.query(readFileSync(resolve(seedFile), 'utf8'));
    console.log(`✓ graine ${seedFile.replace(root + '/', '')} chargée en ${((Date.now() - t) / 1000).toFixed(1)} s`);
  }
  if (option('--sql')) {
    const result = await db.query(readFileSync(resolve(option('--sql')), 'utf8'));
    for (const r of Array.isArray(result) ? result : [result]) for (const row of r.rows ?? []) console.log(Object.values(row).join(' | '));
  }
  const testsDir = join(root, 'supabase/tests/database');
  const only = option('--only');
  const files = existsSync(testsDir) ? readdirSync(testsDir).filter((f) => f.endsWith('.sql') && (!only || f.includes(only))).sort() : [];
  let failedFiles = 0, total = 0, failed = 0;
  for (const file of files) {
    const sql = adapt(readFileSync(join(testsDir, file), 'utf8'));
    let lines = [], error = null;
    // Une connexion par fichier, comme pg_prove (l'état de plan() de pgTAP est propre à la session).
    const session = await connect('sprinter_test');
    try { lines = tapLines(await session.query(sql)); } catch (e) { error = e; }
    await session.end().catch(() => undefined);
    const plan = lines.find((l) => /^1\.\.\d+/.test(l));
    const planned = plan ? Number(plan.split('..')[1]) : NaN;
    const oks = lines.filter((l) => /^ok \d+/.test(l)).length;
    const notOks = lines.filter((l) => /^not ok \d+/.test(l) && !/# TODO/.test(l));
    total += oks + notOks.length; failed += notOks.length;
    const bad = error || notOks.length || oks + notOks.length !== planned;
    if (bad) failedFiles++;
    console.log(`${bad ? '✗' : '✓'} ${file} ${bad ? '' : `(${oks})`}`);
    if (error) console.log(`    erreur : ${error.message}${error.where ? ` — ${error.where}` : ''}`);
    for (const line of notOks) console.log(`    ${line}`);
    if (bad) for (const line of lines.filter((l) => l.startsWith('#'))) console.log(`    ${line}`);
    if (!error && oks + notOks.length !== planned) console.log(`    plan ${planned}, exécutés ${oks + notOks.length}`);
  }
  await db.end();
  console.log(`\n${files.length} fichiers · ${total} assertions · ${failed} échec(s) · ${failedFiles} fichier(s) en échec · ${((Date.now() - started) / 1000).toFixed(1)} s`);
  if (serverLog.includes('FATAL')) console.log(serverLog.split('\n').filter((l) => l.includes('FATAL')).join('\n'));
  return failedFiles === 0;
}

main()
  .then((ok) => { process.exitCode = ok ? 0 : 1; })
  .catch((error) => { console.error(`✗ ${error.message}`); process.exitCode = 1; })
  .finally(() => {
    server?.kill('SIGINT');
    setTimeout(() => { if (!flag('--keep-data')) rmSync(work, { recursive: true, force: true }); }, 300);
  });
