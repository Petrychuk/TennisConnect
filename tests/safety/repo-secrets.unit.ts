// npx tsx --test tests/safety/repo-secrets.unit.ts
//
// Stage 2: credentials, authenticated storage state and database connection
// strings must never be committed. Complements the gitleaks job in CI:
//   1. every place a credential or session file could be written is ignored;
//   2. no tracked file is such a file, or holds a real-looking connection string.
// Reads the git index only - no network, no secrets needed.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUTH_STATE_DIR, storageStatePath } from '../helpers/e2e-auth';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const git = (...args: string[]) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });

function isIgnored(file: string): boolean {
  try {
    git('check-ignore', '-q', '--no-index', file);
    return true;
  } catch {
    return false;
  }
}

const tracked = git('ls-files', '-z').split('\0').filter(Boolean);

test('credential, env and session-state paths are gitignored', () => {
  const mustBeIgnored = [
    '.env', '.env.dev', '.env.staging', '.env.sync', 'staging.env', '.env.e2e.staging.local',
    storageStatePath('admin', 0), storageStatePath('player', 3, 1), path.join(AUTH_STATE_DIR, 'anything.json'),
    'tests/.auth/admin.json', 'storageState.json', 'e2e-storage-state.json', 'admin-auth-state.json',
    '.pgpass', 'credentials.json', 'deploy.key', 'server.pem',
  ];
  for (const file of mustBeIgnored) assert.ok(isIgnored(file), `${file} must be gitignored`);
  assert.equal(isIgnored('.env.example'), false, '.env.example stays committable');
  assert.equal(isIgnored('.env.e2e.staging.example'), false, '.env.e2e.staging.example stays committable');
});

test('no tracked env, auth-state or key files', () => {
  const forbidden = tracked.filter(file =>
    (/(^|\/)\.env(\.(?!example$)[^/]+)?$/.test(file) && file !== '.env.e2e.staging.example') ||
    /(^|\/)\.auth\//.test(file) ||
    /storage-?state|auth-state/i.test(path.basename(file)) ||
    /\.(pem|key|pgpass)$/.test(file)
  );
  assert.deepEqual(forbidden, []);
});

test('no tracked Playwright storage state (cookies + origins JSON)', () => {
  const offenders = tracked
    .filter(file => file.endsWith('.json'))
    .filter(file => {
      const text = readFileSync(path.join(ROOT, file), 'utf8');
      return /"cookies"\s*:/.test(text) && /"origins"\s*:/.test(text);
    });
  assert.deepEqual(offenders, []);
});

// Placeholder hosts/passwords used by unit tests are fine; anything else
// with an embedded password is treated as a real connection string.
const SAFE_HOST = /^(localhost|127\.0\.0\.1|h|host|[^/]*\.(example|invalid|test)(\.[a-z]+)?|[^/]*\.example\.internal)$/i;
const SAFE_PASSWORD = /^(fake|p|pw|pass|password|secret|not-a-real-secret|x+|\*+|<[^>]+>|\$\{[^}]+\}|\.\.\.)$/i;
const CONNECTION = /postgres(?:ql)?:\/\/[^:/@\s"'`]+:([^@\s"'`]+)@([^/:\s"'`?]+)/g;

test('no tracked file contains a real-looking database connection string', () => {
  const offenders: string[] = [];
  for (const file of tracked) {
    if (/\.(png|jpe?g|webp|gif|ico|woff2?|ttf|pdf|zip|gz)$/i.test(file)) continue;
    let text: string;
    try {
      text = readFileSync(path.join(ROOT, file), 'utf8');
    } catch {
      continue; // deleted in the working tree
    }
    for (const match of Array.from(text.matchAll(CONNECTION))) {
      const [, password, host] = match;
      if (!SAFE_HOST.test(host) && !SAFE_PASSWORD.test(password)) offenders.push(`${file} (host ${host})`);
    }
  }
  assert.deepEqual(offenders, [], 'never commit connection strings - use environment variables');
});

test('the connection-string check flags real-looking values and allows placeholders', () => {
  const flagged = (text: string) =>
    Array.from(text.matchAll(CONNECTION)).some(([, password, host]) => !SAFE_HOST.test(host) && !SAFE_PASSWORD.test(password));
  // Real-looking samples are assembled at runtime so this file never contains
  // one itself (it would trip the scan above and gitleaks once committed).
  const url = (user: string, password: string, hostAndDb: string) => ['postgresql://', user, ':', password, '@', hostAndDb].join('');
  assert.ok(flagged(`DATABASE_URL=${url('postgres.abcd', 'Zq8vR2kLmN4', 'pooler-host.supabase.com:6543/postgres')}`));
  assert.ok(flagged(url('admin', 'hunter2hunter2', 'db.internal.company.net/tc')));
  assert.ok(!flagged('postgres://fake:fake@localhost:5432/fake'));
  assert.ok(!flagged('postgresql://seed_user:not-a-real-secret@staging-db.example.internal:5432/tc_staging'));
  assert.ok(!flagged('postgres://user:${DB_PASSWORD}@db.prod.net/tc'));
});
