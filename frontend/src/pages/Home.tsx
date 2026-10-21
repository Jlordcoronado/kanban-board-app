import { useState, useEffect } from 'react';
import { apiRequest, requestError } from '../lib/api';
import type { Task, Column } from '../types/task.ts';
import { KanbanColumn } from '../component/KanbanColumn.tsx';
import { TaskModal } from '../component/TaskModal.tsx';
import { AddColumnModal } from '../component/AddColumnModal.tsx';
import { ConfirmDeleteModal } from '../component/ConfirmDeleteModal.tsx';

interface HomeProps {
  workspaceId: string;
  accountEmail: string;
  onSignOut: () => Promise<void>;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

function Home({
  theme,
  onToggleTheme,
  workspaceId,
  accountEmail,
  onSignOut,
}: HomeProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [columns, setColumns] = useState<Column[]>([
    { id: 'todo', title: 'To Do' },
    { id: 'in progress', title: 'In Progress' },
    { id: 'done', title: 'Done' },
  ]);
  const [dragOverColumn, setDragOverColumn] = useState<Task['status'] | null>(
    null
  );
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTaskStatus, setNewTaskStatus] = useState<string | null>(null);

  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
  const [deletingColumnId, setDeletingColumnId] = useState<string | null>(null);
  const [isConfirmDeleteAllOpen, setIsConfirmDeleteAllOpen] = useState(false);

  const [error, setError] = useState('');
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [archivingAll, setArchivingAll] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<Task[]>('/api/tasks', {
      workspaceId,
      signal: controller.signal,
    })
      .then((data) => {
        if (!Array.isArray(data))
          throw new Error('The server returned an invalid task list.');
        setTasks(data);
      })
      .catch((cause) => {
        if (!controller.signal.aborted && cause?.name !== 'AbortError')
          setError(requestError(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingTasks(false);
      });
    return () => controller.abort();
  }, [workspaceId, loadAttempt]);

  const MAX_COLUMNS = 7;
  const isMaxColumnsReached = columns.length >= MAX_COLUMNS;

  const handleRenameColumn = (id: string, newTitle: string) => {
    const sanitized = newTitle.trim();
    if (!sanitized) return;

    setColumns((prev) =>
      prev.map((col) => (col.id === id ? { ...col, title: sanitized } : col))
    );
  };

  const handleAddColumn = (title: string) => {
    const sanitized = title.trim();
    if (!sanitized || columns.length >= MAX_COLUMNS) return;

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
      | 'title'
      | 'description'
      | 'priority'
      | 'status'
      | 'startedAt'
      | 'dueDate'
      | 'expectedFinishAt'
    >
  ) => {
    const newTask = await apiRequest<Task>('/api/tasks', {
      method: 'POST',
      workspaceId,
      body: JSON.stringify(taskData),
    });
    setTasks((prev) => [...prev, newTask]);
    setNewTaskStatus(null);
  };

  const moveTask = async (id: string, newStatus: Task['status']) => {
    try {
      const updatedTask = await apiRequest<Task>(`/api/tasks/${id}`, {
        method: 'PUT',
        workspaceId,
        body: JSON.stringify({ status: newStatus }),
      });
      setTasks((prev) => prev.map((t) => (t.id === id ? updatedTask : t)));
    } catch (err) {
      setError(requestError(err));
    }
  };

  const updateTask = async (
    id: string,
    changes: Pick<
      Task,
      | 'title'
      | 'description'
      | 'priority'
      | 'status'
      | 'startedAt'
      | 'dueDate'
      | 'expectedFinishAt'
    >
  ) => {
    const updatedTask = await apiRequest<Task>(`/api/tasks/${id}`, {
      method: 'PUT',
      workspaceId,
      body: JSON.stringify(changes),
    });
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? updatedTask : task))
    );
    setEditingTask(null);
  };

  const deleteTask = async (id: string) => {
    try {
      await apiRequest<void>(`/api/tasks/${id}`, {
        method: 'DELETE',
        workspaceId,
      });
      setTasks((previous) => previous.filter((t) => t.id !== id));
    } catch (err) {
      setError(requestError(err));
    }
  };

  const confirmDeleteAllTasks = async () => {
    if (archivingAll) return;
    setArchivingAll(true);
    try {
      await apiRequest<void>('/api/tasks', { method: 'DELETE', workspaceId });
      setTasks([]);
      setIsConfirmDeleteAllOpen(false);
    } catch (cause) {
      setError(requestError(cause));
      setIsConfirmDeleteAllOpen(false);
    } finally {
      setArchivingAll(false);
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-[1400px] px-4 py-4 sm:px-5 sm:py-5 md:flex md:h-screen md:min-h-0 md:flex-col md:px-8 md:py-6">
      <header className="mb-4 flex shrink-0 flex-col items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-4 sm:flex-row md:mb-5">
        <div className="text-left">
          <h1 className="m-0 text-[1.65rem] font-bold tracking-tight text-[var(--text)]">
            jlord.dev
          </h1>
          <p className="mt-1.5 text-sm text-[var(--text-muted)]">
            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} across{' '}
            {columns.length} columns
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
          <button
            type="button"
            className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[var(--accent)] bg-[var(--accent)] px-3 text-xs font-semibold text-[var(--accent-ink)] transition-colors hover:border-[var(--accent-hover)] hover:bg-[var(--accent-hover)]"
            onClick={() => setNewTaskStatus(columns[0]?.id || 'todo')}
            disabled={loadingTasks}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Task
          </button>
          <button
            type="button"
            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors ${
              isMaxColumnsReached
                ? 'cursor-not-allowed border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] opacity-50'
                : 'cursor-pointer border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
            }`}
            onClick={() => !isMaxColumnsReached && setIsAddColumnOpen(true)}
            disabled={isMaxColumnsReached}
            title={
              isMaxColumnsReached
                ? 'Maximum limit of 7 columns reached'
                : 'Add a new column'
            }
          >
            + Column
          </button>
          <button
            type="button"
            className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 text-xs font-semibold text-[var(--danger)] transition-colors hover:bg-[var(--danger-border)]"
            onClick={() => setIsConfirmDeleteAllOpen(true)}
            disabled={archivingAll || loadingTasks}
          >
            Archive all
          </button>
          <button
            type="button"
            className="auth-theme"
            title={accountEmail}
            onClick={() =>
              void onSignOut().catch((cause) => setError(requestError(cause)))
            }
          >
            Sign out
          </button>
          <button
            type="button"
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-raised)] p-0 text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            onClick={onToggleTheme}
            aria-label={
              theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'
            }
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

      {error && (
        <div role="alert" className="board-error">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              setError('');
              setLoadingTasks(true);
              setLoadAttempt((value) => value + 1);
            }}
          >
            Retry loading
          </button>
        </div>
      )}
      {loadingTasks && (
        <p role="status" className="auth-note">
          Loading tasks…
        </p>
      )}
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-5 sm:px-5 md:-mx-8 md:flex md:min-h-0 md:flex-1 md:px-8">
        <div className="flex min-w-max items-start gap-4 md:flex-1 md:items-stretch md:gap-5">
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

          {!isMaxColumnsReached ? (
            <button
              type="button"
              onClick={() => setIsAddColumnOpen(true)}
              className="flex min-h-80 w-[19rem] shrink-0 flex-col items-center justify-center gap-2 rounded-[10px] border-2 border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm font-semibold text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--surface-raised)] hover:text-[var(--accent)] cursor-pointer"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add Column
            </button>
          ) : (
            <div className="flex min-h-80 w-[19rem] shrink-0 flex-col items-center justify-center gap-2 rounded-[10px] border-2 border-dashed border-[var(--border-subtle)] bg-[var(--surface)]/50 p-6 text-center text-xs font-medium text-[var(--text-muted)] opacity-60">
              <span>Max 7 columns reached</span>
            </div>
          )}
        </div>
      </div>

      {newTaskStatus !== null && (
        <TaskModal
          workspaceId={workspaceId}
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
          title="Archive all tasks?"
          message="This moves all active tasks into the archive. Owners and admins can restore them."
          confirmText={archivingAll ? 'Archiving…' : 'Archive all tasks'}
          onConfirm={confirmDeleteAllTasks}
          onClose={() => setIsConfirmDeleteAllOpen(false)}
        />
      )}

      {editingTask && (
        <TaskModal
          workspaceId={workspaceId}
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
