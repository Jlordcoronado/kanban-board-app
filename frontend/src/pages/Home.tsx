import { useState, useEffect } from 'react';
import type { Task, Column } from '../types/task.ts';
import { KanbanColumn } from '../component/KanbanColumn.tsx';
import { TaskModal } from '../component/TaskModal.tsx';
import { AddColumnModal } from '../component/AddColumnModal.tsx';
import { ConfirmDeleteModal } from '../component/ConfirmDeleteModal.tsx';

interface HomeProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

function Home({ theme, onToggleTheme }: HomeProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [columns, setColumns] = useState<Column[]>([
    { id: 'todo', title: 'To Do' },
    { id: 'in progress', title: 'In Progress' },
    { id: 'done', title: 'Done' },
  ]);
  const [dragOverColumn, setDragOverColumn] = useState<Task['status'] | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTaskStatus, setNewTaskStatus] = useState<string | null>(null);

  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
  const [deletingColumnId, setDeletingColumnId] = useState<string | null>(null);
  const [isConfirmDeleteAllOpen, setIsConfirmDeleteAllOpen] = useState(false);

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

  const handleRenameColumn = (id: string, newTitle: string) => {
    const sanitized = newTitle.trim();
    if (!sanitized) return;

    setColumns((prev) =>
      prev.map((col) => (col.id === id ? { ...col, title: sanitized } : col))
    );
  };

  const handleAddColumn = (title: string) => {
    const sanitized = title.trim();
    if (!sanitized) return;

    const newId = `col-${Date.now()}`;
    setColumns((prev) => [...prev, { id: newId, title: sanitized }]);
  };

  const confirmDeleteColumn = (id: string) => {
    if (columns.length <= 1) return;
    const fallbackId = columns.find((c) => c.id !== id)?.id || 'todo';
    setTasks((prev) =>
      prev.map((t) => (t.status === id ? { ...t, status: fallbackId } : t))
    );
    setColumns((prev) => prev.filter((col) => col.id !== id));
    setDeletingColumnId(null);
  };

  const createTask = async (
    taskData: Pick<
      Task,
      'title' | 'description' | 'priority' | 'status' | 'startedAt' | 'dueDate' | 'expectedFinishAt'
    >
  ) => {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskData),
    });

    if (!res.ok) throw new Error('Task creation failed');

    const newTask = await res.json();
    setTasks((prev) => [...prev, newTask]);
    setNewTaskStatus(null);
  };

  const moveTask = async (id: string, newStatus: Task['status']) => {
    try {
      const res = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const updatedTask = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === id ? updatedTask : t)));
    } catch (err) {
      console.error('Error moving task:', err);
    }
  };

  const updateTask = async (
    id: string,
    changes: Pick<
      Task,
      'title' | 'description' | 'priority' | 'status' | 'startedAt' | 'dueDate' | 'expectedFinishAt'
    >
  ) => {
    const res = await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    });

    if (!res.ok) throw new Error('Task update failed');

    const updatedTask = await res.json();
    setTasks((prev) => prev.map((task) => (task.id === id ? updatedTask : task)));
    setEditingTask(null);
  };

  const deleteTask = async (id: string) => {
    try {
      await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      setTasks(tasks.filter((t) => t.id !== id));
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  const confirmDeleteAllTasks = async () => {
    try {
      const res = await fetch(API_URL, { method: 'DELETE' });
      if (res.ok) {
        setTasks([]);
      }
    } catch (err) {
      console.error('Error deleting all tasks:', err);
    }
    setIsConfirmDeleteAllOpen(false);
  };

  return (
    <div className="mx-auto min-h-screen max-w-[1400px] px-5 py-6 md:px-8 md:py-8 md:pb-10">
      <header className="mb-7 flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
        <div className="text-left">
          <h1 className="m-0 text-[1.65rem] font-bold tracking-tight text-[var(--text)]">
            Kanban Desk
          </h1>
          <p className="mt-1.5 text-sm text-[var(--text-muted)]">
            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} across {columns.length} columns
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[var(--accent)] bg-[var(--accent)] px-3 text-xs font-semibold text-[#faf8f5] transition-colors hover:border-[var(--accent-hover)] hover:bg-[var(--accent-hover)]"
            onClick={() => setNewTaskStatus(columns[0]?.id || 'todo')}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Add Task
          </button>
          <button
            type="button"
            className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-raised)] px-3 text-xs font-semibold text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            onClick={() => setIsAddColumnOpen(true)}
          >
            + Column
          </button>
          <button
            type="button"
            className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 text-xs font-semibold text-[var(--danger)] transition-colors hover:bg-[var(--danger-border)]"
            onClick={() => setIsConfirmDeleteAllOpen(true)}
          >
            Clear All
          </button>
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

      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3 lg:grid-cols-4 md:gap-5">
        {columns.map((col) => (
          <KanbanColumn
            key={col.id}
            status={col.id}
            title={col.title}
            tasks={tasks.filter((t) => t.status === col.id)}
            columns={columns}
            moveTask={moveTask}
            deleteTask={deleteTask}
            dragOverColumn={dragOverColumn}
            setDragOverColumn={setDragOverColumn}
            openTask={setEditingTask}
            onRenameColumn={handleRenameColumn}
            onDeleteColumn={(id) => setDeletingColumnId(id)}
            onAddTask={(status) => setNewTaskStatus(status)}
          />
        ))}

        <button
          type="button"
          onClick={() => setIsAddColumnOpen(true)}
          className="flex min-h-80 flex-col items-center justify-center gap-2 rounded-[10px] border-2 border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm font-semibold text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--surface-raised)] hover:text-[var(--accent)] cursor-pointer"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Column
        </button>
      </div>

      {newTaskStatus !== null && (
        <TaskModal
          task={{
            id: '',
            title: '',
            description: '',
            status: newTaskStatus,
            priority: 'medium',
            startedAt: null,
            dueDate: null,
            expectedFinishAt: null,
          }}
          columns={columns}
          onSave={async (changes) => {
            await createTask(changes);
          }}
          onClose={() => setNewTaskStatus(null)}
        />
      )}

      {isAddColumnOpen && (
        <AddColumnModal
          existingTitles={columns.map((c) => c.title)}
          onAddColumn={handleAddColumn}
          onClose={() => setIsAddColumnOpen(false)}
        />
      )}

      {deletingColumnId && (
        <ConfirmDeleteModal
          title="Delete Column"
          message={`Are you sure you want to delete the column "${columns.find((c) => c.id === deletingColumnId)?.title}"? Any remaining tasks will be moved to the first column.`}
          confirmText="Delete Column"
          onConfirm={() => confirmDeleteColumn(deletingColumnId)}
          onClose={() => setDeletingColumnId(null)}
        />
      )}

      {isConfirmDeleteAllOpen && (
        <ConfirmDeleteModal
          title="Delete All Tasks"
          message="Are you sure you want to delete ALL tasks from your Kanban board? This action cannot be undone."
          confirmText="Delete All Tasks"
          onConfirm={confirmDeleteAllTasks}
          onClose={() => setIsConfirmDeleteAllOpen(false)}
        />
      )}

      {editingTask && (
        <TaskModal
          task={editingTask}
          columns={columns}
          onSave={(changes) => updateTask(editingTask.id, changes)}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  );
}

export default Home;


