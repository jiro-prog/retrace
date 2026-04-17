import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCHEMA_SQL } from './schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_DB_PATH = resolve(__dirname, '../../data/retrace.sqlite');

export type DB = Database.Database;

// When `path` is omitted, opens an in-memory DB — safe default for tests.
// Production wiring passes an explicit file path.
export function createDb(path?: string): Database.Database {
  const target = path ?? ':memory:';
  if (target !== ':memory:') {
    mkdirSync(dirname(target), { recursive: true });
  }
  const db = new Database(target);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  return db;
}

export const db = createDb(DEFAULT_DB_PATH);

export function closeDb(): void {
  db.close();
}
