import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// The model (Interface)
interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in progress' | 'done';
}

// Database Setup
let db: Database<sqlite3.Database, sqlite3.Statement>;

(async () => {
  // Open the database file (it will be created if it doesn't exist)
  db = await open({
    filename: './kanban.db',
    driver: sqlite3.Database,
  });

  // Create the tasks table if it doesn't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT CHECK(status IN ('todo', 'in progress', 'done')) DEFAULT 'todo'
    )
  `);

  console.log('Database connected and table ready.');
})();

// API Routes

// 1. GET all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await db.all<Task[]>('SELECT * FROM tasks');
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching tasks' });
  }
});

// 2. POST a new task
app.post('/api/tasks', async (req, res) => {
  const { title, description, status } = req.body;

  if (!title) {
    return res.status(400).json({ message: 'Title is required' });
  }

  const newTask: Task = {
    id: uuidv4(),
    title,
    description: description || '',
    status: status || 'todo',
  };

  try {
    await db.run(
      'INSERT INTO tasks (id, title, description, status) VALUES (?, ?, ?, ?)',
      [newTask.id, newTask.title, newTask.description, newTask.status]
    );
    res.status(201).json(newTask);
  } catch (err) {
    res.status(500).json({ message: 'Error creating task' });
  }
});

// 3. PUT (Update) an existing task
app.put('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, status } = req.body;

  try {
    const existingTask = await db.get<Task>('SELECT * FROM tasks WHERE id = ?', [id]);

    if (!existingTask) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const updatedTitle = title !== undefined ? title : existingTask.title;
    const updatedDesc = description !== undefined ? description : existingTask.description;
    const updatedStatus = status !== undefined ? status : existingTask.status;

    await db.run(
      'UPDATE tasks SET title = ?, description = ?, status = ? WHERE id = ?',
      [updatedTitle, updatedDesc, updatedStatus, id]
    );

    res.json({ id, title: updatedTitle, description: updatedDesc, status: updatedStatus });
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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});