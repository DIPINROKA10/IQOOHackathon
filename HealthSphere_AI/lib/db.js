import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// Writable storage location:
// - HealthSphere_DATA_DIR / DATA_DIR env override
// - Vercel lambdas: read-only FS except /tmp (ephemeral — demo re-seeds per cold start)
// - Local dev: ./data next to the project root
const DATA_DIR = process.env.HealthSphere_DATA_DIR
  || process.env.DATA_DIR
  || (process.env.VERCEL ? '/tmp/healthsphere-data' : path.join(ROOT, 'data'));
const DB_PATH = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function defaults() {
  return {
    users: [],
    sessions: [],
    profiles: {},
    families: {},
    reports: {},
    metrics: {},
    logs: {},
    plans: {},
    doctors: {},
    contacts: {},
    reminders: {},
    settings: {},
    audit: {}
  };
}

let db;
try {
  db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  for (const k of Object.keys(defaults())) if (!(k in db)) db[k] = defaults()[k];
} catch {
  db = defaults();
}

export function persist() {
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
  fs.renameSync(tmp, DB_PATH);
}

process.on('exit', () => {
  try { persist(); } catch { /* noop */ }
});

/** Get or create the per-user array for a collection. */
export function coll(name, userId) {
  if (!db[name][userId]) db[name][userId] = [];
  return db[name][userId];
}

export function objColl(name, userId) {
  if (!db[name][userId]) db[name][userId] = {};
  return db[name][userId];
}

export { db, ROOT, DATA_DIR, UPLOAD_DIR };
