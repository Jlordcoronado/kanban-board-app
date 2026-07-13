import { useState, useEffect } from 'react';
import type { Task } from '../types/task.ts';
import { KanbanColumn } from '../component/KanbanColumn.tsx';

interface HomeProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const inputClass =
  'flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-raised)] px-3.5 py-2.5 text-[0.95rem] text-[var(--text)] transition-[border-color,box-shadow] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgb(61_90_76/0.15)] focus:outline-none dark:focus:shadow-[0_0_0_3px_rgb(107_158_130/0.2)]';

const btnBase =
  'cursor-pointer rounded-md border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]';

function Home({ theme, onToggleTheme }: HomeProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [dragOverColumn, setDragOverColumn] = useState<Task['status'] | null>(null);

  const API_URL = 'http://localhost:5000/api/tasks';

  useEffect(() => {
    const loadTasks = async () => {
      try {
        const res = await fetch(API_URL);
        const data = await res.json();
        setTasks(data);
      } catch (err) {
        console.error('Error fetching tasks:', err);
      }
    };

    loadTasks();
  }, []);

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          status: 'todo',
        }),
      });
      const newTask = await res.json();
      setTasks([...tasks, newTask]);
      setNewTitle('');
      setNewDescription('');
    } catch (err) {
      console.error('Error adding task:', err);
    }
  };

  const moveTask = async (id: string, newStatus: Task['status']) => {
    try {
      const res = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const updatedTask = await res.json();
      setTasks(tasks.map((t) => (t.id === id ? updatedTask : t)));
    } catch (err) {
      console.error('Error moving task:', err);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      setTasks(tasks.filter((t) => t.id !== id));
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  const deleteAllTasks = async () => {
    if (!window.confirm('Are you sure you want to delete ALL tasks? This cannot be undone')) {
      return;
    }
    try {
      const res = await fetch(API_URL, { method: 'DELETE' });
      if (res.ok) {
        setTasks([]);
      }
    } catch (err) {
      console.error('Error deleting all tasks:', err);
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-[1400px] px-5 py-6 md:px-8 md:py-8 md:pb-10">
      <header className="mb-7 flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
        <div className="text-left">
          <h1 className="m-0 text-[1.65rem] font-bold tracking-tight text-[var(--text)]">
            Kanban Desk
          </h1>
          <p className="mt-1.5 font-mono text-[0.8rem] text-[var(--text-muted)]">
            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} across 3 columns
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-raised)] p-0 text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            onClick={onToggleTheme}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? (
              <svg
                className="h-[1.1rem] w-[1.1rem]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg
                className="h-[1.1rem] w-[1.1rem]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <form
        className="mb-6 flex flex-col gap-3 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] p-4 md:flex-row md:items-stretch md:gap-2.5"
        onSubmit={addTask}
      >
        <input
          className={inputClass}
          type="text"
          placeholder="Task title"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          required
        />
        <input
          className={inputClass}
          type="text"
          placeholder="Description (optional)"
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
        />
        <div className="flex shrink-0 gap-2">
          <button
            className={`${btnBase} border-[var(--accent)] bg-[var(--accent)] text-[#faf8f5] hover:border-[var(--accent-hover)] hover:bg-[var(--accent-hover)]`}
            type="submit"
          >
            Add task
          </button>
          <button
            className={`${btnBase} border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)] hover:bg-[var(--danger-border)]`}
            type="button"
            onClick={deleteAllTasks}
          >
            Clear all
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3 md:gap-5">
        <KanbanColumn
          status="todo"
          title="To Do"
          tasks={tasks.filter((t) => t.status === 'todo')}
          moveTask={moveTask}
          deleteTask={deleteTask}
          dragOverColumn={dragOverColumn}
          setDragOverColumn={setDragOverColumn}
        />

        <KanbanColumn
          status="in progress"
          title="In Progress"
          tasks={tasks.filter((t) => t.status === 'in progress')}
          moveTask={moveTask}
          deleteTask={deleteTask}
          dragOverColumn={dragOverColumn}
          setDragOverColumn={setDragOverColumn}
        />

        <KanbanColumn
          status="done"
          title="Done"
          tasks={tasks.filter((t) => t.status === 'done')}
          moveTask={moveTask}
          deleteTask={deleteTask}
          dragOverColumn={dragOverColumn}
          setDragOverColumn={setDragOverColumn}
        />
      </div>
    </div>
  );
}

export default Home;
