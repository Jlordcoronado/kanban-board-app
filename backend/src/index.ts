import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { z } from 'zod';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 5000;
const DATABASE_PATH = process.env.DATABASE_PATH ?? './kanban.db';
const priorities = ['low', 'medium', 'high'] as const;
const AI_REWRITE_LIMIT = 3;
const AI_REWRITE_WINDOW_MS = 10 * 60 * 1000;
const aiRewriteRequests = new Map<string, number[]>();

type Priority = (typeof priorities)[number];

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400 && 'body' in err) {
    return res.status(400).json({ message: 'Invalid JSON payload' });
  }

  next(err);
});

// The model (Interface)
interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: Priority;
  startedAt: string | null;
  dueDate: string | null;
  expectedFinishAt: string | null;
}

interface TaskRow {
  id: string;
  title: string;
  description: string;
  status: Task['status'];
  priority: Priority;
  started_at: string | null;
  due_date: string | null;
  expected_finish_at: string | null;
}

// Database Setup
let db: Database<sqlite3.Database, sqlite3.Statement>;

function isPriority(value: unknown): value is Priority {
  return typeof value === 'string' && priorities.includes(value as Priority);
}

function isDateValue(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && !Number.isNaN(Date.parse(value)));
}

function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    status: row.status,
    priority: row.priority ?? 'medium',
    startedAt: row.started_at,
    dueDate: row.due_date,
    expectedFinishAt: row.expected_finish_at,
  };
}

function isTaskStatus(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function resolveTaskString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function resolveTaskOptionalString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === 'string' ? value : undefined;
}

const rewriteTaskSchema = z.object({
  text: z.string().trim().min(1, 'Text is required').max(3_000, 'Text must be 3,000 characters or fewer'),
});

function getAiRateLimit(ip: string): number | null {
  const now = Date.now();
  const recentRequests = (aiRewriteRequests.get(ip) ?? []).filter(
    (requestedAt) => now - requestedAt < AI_REWRITE_WINDOW_MS
  );

  if (recentRequests.length >= AI_REWRITE_LIMIT) {
    aiRewriteRequests.set(ip, recentRequests);
    return Math.ceil((AI_REWRITE_WINDOW_MS - (now - recentRequests[0]!)) / 1000);
  }

  recentRequests.push(now);
  aiRewriteRequests.set(ip, recentRequests);
  return null;
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const columns = await db.all<{ name: string }[]>(`PRAGMA table_info(${table})`);
  return columns.some((item) => item.name === column);
}

async function startServer() {
  // Open the database file (it will be created if it doesn't exist)
  db = await open({
    filename: DATABASE_PATH,
    driver: sqlite3.Database,
  });

  // Create the tasks table if it doesn't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'todo',
      priority TEXT CHECK(priority IN ('low', 'medium', 'high')) DEFAULT 'medium'
    )
  `);

  // Add priority to databases created before Phase 2 without removing existing tasks.
  if (!(await columnExists('tasks', 'priority'))) {
    await db.exec(
      "ALTER TABLE tasks ADD COLUMN priority TEXT CHECK(priority IN ('low', 'medium', 'high')) DEFAULT 'medium'"
    );
  }

  await db.run("UPDATE tasks SET priority = 'medium' WHERE priority IS NULL");

  const dateColumns: [string, string][] = [
    ['started_at', 'TEXT'],
    ['due_date', 'TEXT'],
    ['expected_finish_at', 'TEXT'],
  ];

  for (const [column, definition] of dateColumns) {
    if (!(await columnExists('tasks', column))) {
      await db.exec(`ALTER TABLE tasks ADD COLUMN ${column} ${definition}`);
    }
  }

  // Migrate: remove status CHECK constraint from existing databases so custom columns work.
  const tableInfo = await db.get<{ sql: string }>(`SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks'`);
  if (tableInfo?.sql && tableInfo.sql.includes("CHECK(status IN")) {
    console.log('Migrating tasks table to remove status CHECK constraint...');
    await db.exec(`
      BEGIN TRANSACTION;
      CREATE TABLE tasks_new (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'todo',
        priority TEXT CHECK(priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
        started_at TEXT,
        due_date TEXT,
        expected_finish_at TEXT
      );
      INSERT INTO tasks_new SELECT id, title, description, status, priority, started_at, due_date, expected_finish_at FROM tasks;
      DROP TABLE tasks;
      ALTER TABLE tasks_new RENAME TO tasks;
      COMMIT;
    `);
    console.log('Migration complete.');
  }

  console.log('Database connected and table ready.');
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

// API Routes

// Rewrites task text without persisting changes. The frontend will let the user review it first.
app.post('/api/ai/rewrite-task', async (req, res) => {
  const parsedBody = rewriteTaskSchema.safeParse(req.body);

  if (!parsedBody.success) {
    return res.status(400).json({ message: parsedBody.error.issues[0]?.message ?? 'Invalid request body' });
  }

  const retryAfterSeconds = getAiRateLimit(req.ip ?? 'unknown');
  if (retryAfterSeconds !== null) {
    res.set('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      message: `AI rewrite limit reached. Try again in ${retryAfterSeconds} seconds.`,
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ message: 'AI rewriting is not configured on this server.' });
  }

  try {
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model: process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite',
      contents: parsedBody.data.text,
      config: {
        systemInstruction:
          'Rewrite only the provided Kanban task text into a concise, clear, professional task description. Preserve the original intent. Do not invent requirements, names, deadlines, steps, or technical facts. Return plain text only: no title, labels, bullets, quotation marks, or explanation.',
        temperature: 0.2,
      },
    });
    const rewrittenText = response.text?.trim() ?? '';

    if (!rewrittenText) {
      return res.status(502).json({ message: 'AI did not return a rewrite. Please try again.' });
    }

    res.json({ rewrittenText });
  } catch (error) {
    console.error('AI task rewrite failed:', error);
    res.status(502).json({ message: 'Unable to rewrite the task right now. Please try again later.' });
  }
});

// 1. GET all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await db.all<TaskRow[]>('SELECT * FROM tasks');
    res.json(tasks.map(mapTask));
  } catch (err) {
    res.status(500).json({ message: 'Error fetching tasks' });
  }
});

// 2. POST a new task
app.post('/api/tasks', async (req, res) => {
  const body = req.body ?? {};
  const rawBody = body as Record<string, unknown>;

  const title = typeof rawBody.title === 'string' ? rawBody.title.trim() : '';
  const description = resolveTaskString(rawBody.description);
  const status = isTaskStatus(rawBody.status) ? rawBody.status : undefined;
  const priority = isPriority(rawBody.priority) ? rawBody.priority : undefined;
  const startedAt = resolveTaskOptionalString(rawBody.startedAt);
  const dueDate = resolveTaskOptionalString(rawBody.dueDate);
  const expectedFinishAt = resolveTaskOptionalString(rawBody.expectedFinishAt);

  if (!title) {
    return res.status(400).json({ message: 'Title is required' });
  }

  if (rawBody.priority !== undefined && priority === undefined) {
    return res.status(400).json({ message: 'Priority must be low, medium, or high' });
  }

  if (rawBody.status !== undefined && status === undefined) {
    return res.status(400).json({ message: 'Status must be todo, in progress, or done' });
  }

  for (const value of [startedAt, dueDate, expectedFinishAt]) {
    if (value !== undefined && !isDateValue(value)) {
      return res.status(400).json({ message: 'Dates must be valid ISO date or datetime strings' });
    }
  }

  const newTask: Task = {
    id: uuidv4(),
    title,
    description,
    status: status ?? 'todo',
    priority: priority ?? 'medium',
    startedAt: startedAt ?? null,
    dueDate: dueDate ?? null,
    expectedFinishAt: expectedFinishAt ?? null,
  };

  try {
    await db.run(
      `INSERT INTO tasks (
        id, title, description, status, priority, started_at, due_date, expected_finish_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newTask.id,
        newTask.title,
        newTask.description,
        newTask.status,
        newTask.priority,
        newTask.startedAt,
        newTask.dueDate,
        newTask.expectedFinishAt,
      ]
    );
    res.status(201).json(newTask);
  } catch (err) {
    res.status(500).json({ message: 'Error creating task' });
  }
});

// 3. PUT (Update) an existing task
app.put('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const body = req.body ?? {};
  const rawBody = body as Record<string, unknown>;

  const title = typeof rawBody.title === 'string' ? rawBody.title : undefined;
  const description = typeof rawBody.description === 'string' ? rawBody.description : undefined;
  const status = isTaskStatus(rawBody.status) ? rawBody.status : undefined;
  const priority = isPriority(rawBody.priority) ? rawBody.priority : undefined;
  const startedAt = resolveTaskOptionalString(rawBody.startedAt);
  const dueDate = resolveTaskOptionalString(rawBody.dueDate);
  const expectedFinishAt = resolveTaskOptionalString(rawBody.expectedFinishAt);

  if (rawBody.priority !== undefined && priority === undefined) {
    return res.status(400).json({ message: 'Priority must be low, medium, or high' });
  }

  if (rawBody.status !== undefined && status === undefined) {
    return res.status(400).json({ message: 'Status must be todo, in progress, or done' });
  }

  for (const value of [startedAt, dueDate, expectedFinishAt]) {
    if (value !== undefined && !isDateValue(value)) {
      return res.status(400).json({ message: 'Dates must be valid ISO date or datetime strings' });
    }
  }

  try {
    const existingRow = await db.get<TaskRow>('SELECT * FROM tasks WHERE id = ?', [id]);

    if (!existingRow) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const existingTask = mapTask(existingRow);

    const updatedTitle = title !== undefined ? title : existingTask.title;
    const updatedDesc = description !== undefined ? description : existingTask.description;
    const updatedStatus = status !== undefined ? status : existingTask.status;
    const updatedPriority = priority !== undefined ? priority : existingTask.priority;
    let updatedStartedAt = startedAt !== undefined ? startedAt : existingTask.startedAt;
    const updatedDueDate = dueDate !== undefined ? dueDate : existingTask.dueDate;
    const updatedExpectedFinishAt =
      expectedFinishAt !== undefined ? expectedFinishAt : existingTask.expectedFinishAt;

    if (
      updatedStatus === 'in progress' &&
      existingTask.status !== 'in progress' &&
      !updatedStartedAt
    ) {
      updatedStartedAt = new Date().toISOString();
    }

    await db.run(
      `UPDATE tasks
       SET title = ?, description = ?, status = ?, priority = ?, started_at = ?, due_date = ?, expected_finish_at = ?
       WHERE id = ?`,
      [
        updatedTitle,
        updatedDesc,
        updatedStatus,
        updatedPriority,
        updatedStartedAt,
        updatedDueDate,
        updatedExpectedFinishAt,
        id,
      ]
    );

    res.json({
      id,
      title: updatedTitle,
      description: updatedDesc,
      status: updatedStatus,
      priority: updatedPriority,
      startedAt: updatedStartedAt,
      dueDate: updatedDueDate,
      expectedFinishAt: updatedExpectedFinishAt,
    });
  } catch (err) {
    res.status(500).json({ message: 'Error updating task' });
  }
});

// 4. DELETE a task
app.delete('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.run('DELETE FROM tasks WHERE id = ?', [id]);
    
    if (result.changes === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: 'Error deleting task' });
  }
});

// DELETE ALL TASKS
app.delete('/api/tasks', async (req, res)=> {

  try{
    await db.run('DELETE FROM tasks');
    res.status(204).send(); // 204 means no content

  } catch (err) {
    res.status(500).json({ message: 'Error deleting all tasks' });
  }
})

startServer().catch((err) => {
  console.error('Unable to start server:', err);
  process.exit(1);
});
