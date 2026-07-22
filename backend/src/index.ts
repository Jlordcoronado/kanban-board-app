import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

const app = express();
const PORT = process.env.PORT || 5000;
const DATABASE_PATH = process.env.DATABASE_PATH ?? './kanban.db';
const priorities = ['low', 'medium', 'high'] as const;

type Priority = (typeof priorities)[number];

app.use(cors());
app.use(express.json());

// The model (Interface)
interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in progress' | 'done';
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
      status TEXT CHECK(status IN ('todo', 'in progress', 'done')) DEFAULT 'todo',
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

  console.log('Database connected and table ready.');
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

// API Routes

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
  const { title, description, status, priority, startedAt, dueDate, expectedFinishAt } = req.body;

  if (!title) {
    return res.status(400).json({ message: 'Title is required' });
  }

  if (priority !== undefined && !isPriority(priority)) {
    return res.status(400).json({ message: 'Priority must be low, medium, or high' });
  }

  for (const value of [startedAt, dueDate, expectedFinishAt]) {
    if (value !== undefined && !isDateValue(value)) {
      return res.status(400).json({ message: 'Dates must be valid ISO date or datetime strings' });
    }
  }

  const newTask: Task = {
    id: uuidv4(),
    title,
    description: description || '',
    status: status || 'todo',
    priority: priority || 'medium',
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
  const { title, description, status, priority, startedAt, dueDate, expectedFinishAt } = req.body;

  if (priority !== undefined && !isPriority(priority)) {
    return res.status(400).json({ message: 'Priority must be low, medium, or high' });
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
