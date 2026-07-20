import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DATABASE_PATH ?? path.join(__dirname, '..', 'kanban.db');

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  started_at: string | null;
  due_date: string | null;
  expected_finish_at: string | null;
  comment: string | null;
  user_id: string | null;
}

let db: Database<sqlite3.Database, sqlite3.Statement>;

async function columnExists(table: string, column: string): Promise<boolean> {
  const cols = await db.all<{ name: string }>(`PRAGMA table_info(${table})`);
  return cols.some((c) => c.name === column);
}

async function migrate(): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT CHECK(status IN ('todo', 'in progress', 'done')) DEFAULT 'todo',
      priority TEXT CHECK(priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
      started_at TEXT,
      due_date TEXT,
      expected_finish_at TEXT,
      comment TEXT,
      user_id TEXT REFERENCES users(id)
    )
  `);

  const taskColumns: [string, string][] = [
    ['priority', "TEXT CHECK(priority IN ('low', 'medium', 'high')) DEFAULT 'medium'"],
    ['started_at', 'TEXT'],
    ['due_date', 'TEXT'],
    ['expected_finish_at', 'TEXT'],
    ['comment', 'TEXT'],
    ['user_id', 'TEXT REFERENCES users(id)'],
  ];

  for (const [col, def] of taskColumns) {
    if (!(await columnExists('tasks', col))) {
      await db.exec(`ALTER TABLE tasks ADD COLUMN ${col} ${def}`);
    }
  }

  await db.run(`UPDATE tasks SET priority = 'medium' WHERE priority IS NULL`);
}

export async function initDb(): Promise<Database<sqlite3.Database, sqlite3.Statement>> {
  db = await open({ filename: DB_PATH, driver: sqlite3.Database });
  await migrate();
  console.log('Database connected and migrations applied.');
  return db;
}

export function getDb(): Database<sqlite3.Database, sqlite3.Statement> {
  return db;
}
