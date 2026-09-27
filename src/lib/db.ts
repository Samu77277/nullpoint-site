// Хранилище заявок: SQLite на сервере в РФ (152-ФЗ — первичный сбор ПДн в РФ).
// Встроенный node:sqlite — без нативных зависимостей.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DB_PATH as DB_PATH_ENV } from 'astro:env/server';

const DB_PATH = resolve(DB_PATH_ENV);
export const UPLOADS_DIR = resolve(dirname(DB_PATH), 'uploads');

mkdirSync(UPLOADS_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    name        TEXT    NOT NULL,
    contact     TEXT    NOT NULL,
    message     TEXT    NOT NULL DEFAULT '',
    budget      TEXT    NOT NULL DEFAULT '',
    file_path   TEXT,
    file_name   TEXT,
    source_page TEXT,
    utm         TEXT,
    ip          TEXT,
    delivered   INTEGER NOT NULL DEFAULT 0,
    attempts    INTEGER NOT NULL DEFAULT 0,
    last_error  TEXT
  )
`);

export interface LeadRow {
  id: number;
  created_at: string;
  name: string;
  contact: string;
  message: string;
  budget: string;
  file_path: string | null;
  file_name: string | null;
  source_page: string | null;
  utm: string | null;
  ip: string | null;
}

export function insertLead(data: Omit<LeadRow, 'id' | 'created_at'>): number {
  const result = db
    .prepare(
      `INSERT INTO leads (name, contact, message, budget, file_path, file_name, source_page, utm, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      data.name,
      data.contact,
      data.message,
      data.budget,
      data.file_path,
      data.file_name,
      data.source_page,
      data.utm,
      data.ip,
    );
  return Number(result.lastInsertRowid);
}

export function getLead(id: number): LeadRow | undefined {
  return db.prepare('SELECT * FROM leads WHERE id = ?').get(id) as LeadRow | undefined;
}

export function getUndelivered(maxAttempts = 20): LeadRow[] {
  return db
    .prepare('SELECT * FROM leads WHERE delivered = 0 AND attempts < ? ORDER BY id')
    .all(maxAttempts) as unknown as LeadRow[];
}

export function markDelivered(id: number) {
  db.prepare('UPDATE leads SET delivered = 1, attempts = attempts + 1, last_error = NULL WHERE id = ?').run(id);
}

export function markFailed(id: number, error: string) {
  db.prepare('UPDATE leads SET attempts = attempts + 1, last_error = ? WHERE id = ?').run(error, id);
}
