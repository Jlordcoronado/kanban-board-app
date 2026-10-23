import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type RefObject,
} from 'react';
import { requestError } from '../lib/api';
import { useBoard } from '../board/useBoard';
import {
  type Board,
  activeTasks,
  guestFingerprint,
  readGuest,
  readGuestDraft,
  rememberGuestDraft,
  forgetGuestDraft,
  hasGuestWork,
} from '../lib/board';
import { GuestImport } from '../component/GuestImport';
import { Dialog } from '../component/Dialog';
import type { Task } from '../types/task.ts';
import { KanbanColumn } from '../component/KanbanColumn.tsx';
import { TaskModal } from '../component/TaskModal.tsx';
import { AddColumnModal } from '../component/AddColumnModal.tsx';
import { ConfirmDeleteModal } from '../component/ConfirmDeleteModal.tsx';

interface HomeProps {
  addTaskRef?: RefObject<HTMLButtonElement | null>;
  workspaceId?: string;
  onSignIn?: () => void;
  accountEmail: string;
  onSignOut: () => Promise<void>;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

function Home({
  addTaskRef,
  theme,
  onToggleTheme,
  workspaceId,
  accountEmail,
  onSignOut,
  onSignIn,
}: HomeProps) {
  const storage = useBoard(workspaceId);
  const newTaskIdentity = useRef(crypto.randomUUID());
  const failedTaskSave = useRef<string | null>(null);
  const { board, loading: loadingTasks } = storage;
  const tasks = activeTasks(board);
  const columns = board.columns;
  const [showImport, setShowImport] = useState(false);
  const [conflictHidden, setConflictHidden] = useState(false);
  useEffect(() => {
    setConflictHidden(false);
  }, [storage.latest]);
  const [importChecked, setImportChecked] = useState(false);
  const [draftError, setDraftError] = useState('');
  const [deviceDraft] = useState(readGuestDraft);
  const clearDraft = () => {
    if (!workspaceId) forgetGuestDraft();
  };
  const rememberDraft = useCallback(
    (draft: Task) => {
      if (workspaceId) return;
      try {
        rememberGuestDraft(draft);
      } catch {
        setDraftError(
          'Unable to preserve this draft through a redirect. Keep this page open until it is saved.'
        );
      }
    },
    [workspaceId]
  );
  useEffect(() => {
    if (!workspaceId || loadingTasks || importChecked || !columns.length)
      return;
    const guest = readGuest().board;
    let dismissed = false;
    try {
      dismissed =
        localStorage.getItem(`kanban-copy-dismissed-${workspaceId}`) ===
        guestFingerprint(guest);
    } catch {
      /* offer explicit choice */
    }
    if (hasGuestWork(guest) && !dismissed) setShowImport(true);
    setImportChecked(true);
  }, [workspaceId, loadingTasks, importChecked, columns.length]);
  const [dragOverColumn, setDragOverColumn] = useState<Task['status'] | null>(
    null
  );
  const [editingTask, setEditingTask] = useState<Task | null>(() =>
    !workspaceId ? deviceDraft : null
  );
  const [taskMode, setTaskMode] = useState<'details' | 'edit'>(
    !workspaceId && deviceDraft ? 'edit' : 'details'
  );
  const openTask = (task: Task, mode: 'details' | 'edit' = 'details') => {
    setTaskMode(mode);
    setEditingTask(task);
  };
  const [newTaskStatus, setNewTaskStatus] = useState<string | null>(null);

  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
  const [deletingColumnId, setDeletingColumnId] = useState<string | null>(null);
  const [isConfirmDeleteAllOpen, setIsConfirmDeleteAllOpen] = useState(false);

  const [error, setError] = useState('');
  const [archivingAll, setArchivingAll] = useState(false);
  const MAX_COLUMNS = 7;
  const isMaxColumnsReached = columns.length >= MAX_COLUMNS;
  const attempt = (action: Promise<unknown>) => {
    void action.catch((cause) => setError(requestError(cause)));
  };
  const handleRenameColumn = (id: string, title: string) => {
    if (!title.trim()) return;
    attempt(
      storage.change((b) => ({
        ...b,
        columns: b.columns.map((c) =>
          c.id === id ? { ...c, title: title.trim() } : c
        ),
      }))
    );
  };
  const handleAddColumn = (title: string) => {
    if (!title.trim() || columns.length >= MAX_COLUMNS) return;
    attempt(
      storage.change((b) => ({
        ...b,
        columns: [
          ...b.columns,
          { id: `col-${crypto.randomUUID()}`, title: title.trim() },
        ],
      }))
    );
  };
  const confirmDeleteColumn = (id: string) => {
    if (columns.length <= 1) return;
    const fallback = columns.find((c) => c.id !== id)!.id;
    attempt(
      storage.change((b) => ({
        ...b,
        columns: b.columns.filter((c) => c.id !== id),
        tasks: b.tasks.map((t) =>
          t.status === id ? { ...t, status: fallback } : t
        ),
      }))
    );
    setDeletingColumnId(null);
  };
  type Changes = Pick<
    Task,
    | 'title'
    | 'description'
    | 'priority'
    | 'status'
    | 'startedAt'
    | 'dueDate'
    | 'expectedFinishAt'
  >;
  const saveTaskChange = async (id: string, update: (b: Board) => Board) => {
    if (workspaceId && storage.pending) {
      if (storage.latest || failedTaskSave.current !== id)
        throw new Error(
          'Resolve the pending cloud save before saving this task.'
        );
      // Retry this editor's proposal with its latest edits and the same revision.
      await storage.persist(update(storage.pending));
    } else {
      try {
        await storage.change(update);
      } catch (cause) {
        failedTaskSave.current = id;
        throw cause;
      }
    }
    failedTaskSave.current = null;
  };
  const createTask = async (data: Changes) => {
    await saveTaskChange(newTaskIdentity.current, (b) => ({
      ...b,
      tasks: [
        ...b.tasks.filter((t) => t.id !== newTaskIdentity.current),
        { ...data, id: newTaskIdentity.current },
      ],
    }));
    clearDraft();
    setNewTaskStatus(null);
    setEditingTask(null);
    newTaskIdentity.current = crypto.randomUUID();
  };
  const updateTask = async (id: string, changes: Changes) => {
    await saveTaskChange(id, (b) => ({
      ...b,
      tasks: b.tasks.map((t) => (t.id === id ? { ...t, ...changes } : t)),
    }));
    clearDraft();
  };
  const moveTask = async (id: string, status: string) => {
    try {
      await storage.change((b) => ({
        ...b,
        tasks: b.tasks.map((t) => (t.id === id ? { ...t, status } : t)),
      }));
    } catch (e) {
      setError(requestError(e));
    }
  };
  const deleteTask = async (id: string) => {
    try {
      await storage.change((b) => ({
        ...b,
        tasks: workspaceId
          ? b.tasks.filter((t) => t.id !== id)
          : b.tasks.map((t) =>
              t.id === id ? { ...t, archivedAt: new Date().toISOString() } : t
            ),
      }));
    } catch (e) {
      setError(requestError(e));
    }
  };
  const confirmDeleteAllTasks = async () => {
    setArchivingAll(true);
    try {
      await storage.change((b) => ({
        ...b,
        tasks: workspaceId
          ? []
          : b.tasks.map((t) => ({
              ...t,
              archivedAt: t.archivedAt || new Date().toISOString(),
            })),
      }));
    } catch (e) {
      setError(requestError(e));
    } finally {
      setArchivingAll(false);
      setIsConfirmDeleteAllOpen(false);
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-[1400px] px-4 py-4 sm:px-5 sm:py-5 md:flex md:h-screen md:min-h-0 md:flex-col md:px-8 md:py-6">
      <header className="mb-4 flex shrink-0 items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4 sm:flex-row md:mb-5">
        <div className="text-left">
          <h1 className="m-0 text-[1.65rem] font-bold tracking-tight text-[var(--text)]">
            jlord.dev
          </h1>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className="auth-theme"
            title={accountEmail}
            onClick={() =>
              workspaceId
                ? (!storage.pending ||
                    window.confirm(
                      'There are unsaved cloud changes. Sign out and discard them?'
                    )) &&
                  void onSignOut().catch((cause) =>
                    setError(requestError(cause))
                  )
                : onSignIn?.()
            }
          >
            {workspaceId ? 'Sign out' : 'Log in'}
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

      <section aria-labelledby="board-title" className="shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h2 id="board-title" className="text-lg font-semibold">
            Board
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} across{' '}
            {columns.length} columns ·{' '}
            <span role="status">{storage.status}</span>
          </p>
        </div>
        <div className="mt-3 mb-2 flex flex-wrap items-center gap-2">
          <button
            ref={addTaskRef}
            type="button"
            className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[var(--accent)] bg-[var(--accent)] px-3 text-xs font-semibold text-[var(--accent-ink)] transition-colors hover:border-[var(--accent-hover)] hover:bg-[var(--accent-hover)]"
            onClick={() => setNewTaskStatus(columns[0]?.id || 'todo')}
            disabled={
              loadingTasks ||
              !columns.length ||
              Boolean(workspaceId && storage.pending)
            }
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
            Add task
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
            Add column
          </button>
          <button
            type="button"
            className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-transparent bg-transparent px-3 text-xs font-semibold text-[var(--danger)] transition-colors hover:bg-[var(--danger-bg)]"
            onClick={() => setIsConfirmDeleteAllOpen(true)}
            disabled={archivingAll || loadingTasks}
          >
            Archive all
          </button>
        </div>
      </section>

      {!workspaceId && (
        <div className="board-notice">
          <p>
            Welcome! Start planning your work. Your board saves automatically in
            this browser.
          </p>
          <p>Clearing browser data removes local work.</p>
        </div>
      )}
      {(error || storage.error || draftError) && (
        <div role="alert" className="board-error">
          <span>{storage.error || error || draftError}</span>
          <button
            type="button"
            onClick={() => {
              setError('');
              attempt(storage.retry());
            }}
          >
            Retry
          </button>
        </div>
      )}
      {workspaceId && (
        <div className="board-notice">
          <button
            className="auth-theme"
            disabled={Boolean(workspaceId && storage.pending) || loadingTasks}
            onClick={() => setShowImport(true)}
          >
            Copy device work to cloud
          </button>
          {deviceDraft && (
            <button
              className="auth-theme"
              onClick={() =>
                openTask(
                  {
                    ...deviceDraft,
                    id: '',
                    status: columns.some((c) => c.id === deviceDraft.status)
                      ? deviceDraft.status
                      : columns[0].id,
                  },
                  'edit'
                )
              }
            >
              Resume device task draft
            </button>
          )}
        </div>
      )}
      {storage.latest && conflictHidden && (
        <button className="auth-theme" onClick={() => setConflictHidden(false)}>
          Review cloud conflict
        </button>
      )}
      {storage.latest && storage.pending && !conflictHidden && (
        <Dialog
          title="Cloud save conflict"
          onClose={() => setConflictHidden(true)}
        >
          <h2>Your cloud board changed</h2>
          {error && <p role="alert">{error}</p>}
          <p>
            Review the latest cloud values and your proposed changes. Applying
            your draft keeps unrelated cloud changes.
          </p>
          <div className="conflict-values">
            <div>
              <h3>Latest cloud value</h3>
              <BoardValues board={storage.latest} />
            </div>
            <div>
              <h3>Your proposed change</h3>
              <BoardValues board={storage.pending} />
            </div>
          </div>
          <button className="auth-secondary" onClick={storage.acceptLatest}>
            Keep cloud value
          </button>
          <button
            className="auth-primary"
            onClick={() => attempt(storage.applyDraft())}
          >
            Apply draft against latest revision
          </button>
        </Dialog>
      )}
      {showImport && workspaceId && (
        <GuestImport
          workspaceId={workspaceId}
          board={board}
          onImported={storage.replace}
          onClose={() => setShowImport(false)}
        />
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
              openTask={openTask}
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
          onSignIn={onSignIn}
          onDraft={rememberDraft}
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
          onClose={() => {
            clearDraft();
            setNewTaskStatus(null);
          }}
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
          message="This moves all active tasks into the archive. Device archives stay in this browser; cloud archives can be restored by owners and admins."
          confirmText={archivingAll ? 'Archiving…' : 'Archive all tasks'}
          onConfirm={confirmDeleteAllTasks}
          onClose={() => setIsConfirmDeleteAllOpen(false)}
        />
      )}

      {editingTask && (
        <TaskModal
          workspaceId={workspaceId}
          onSignIn={onSignIn}
          onDraft={rememberDraft}
          onEditorEnd={clearDraft}
          key={editingTask.id || 'draft'}
          initialMode={taskMode}
          initialDraft={editingTask}
          task={tasks.find((task) => task.id === editingTask.id) ?? editingTask}
          columns={columns}
          onSave={(changes) =>
            editingTask.id
              ? updateTask(editingTask.id, changes)
              : createTask(changes)
          }
          onClose={() => {
            clearDraft();
            setEditingTask(null);
          }}
        />
      )}
    </div>
  );
}

export default Home;

function BoardValues({ board }: { board: Board }) {
  return (
    <div className="conflict-board">
      <p>Columns: {board.columns.map((c) => c.title).join(' → ')}</p>
      {board.tasks.length === 0 && <p>No active tasks</p>}
      {board.tasks.map((task) => (
        <article key={task.id}>
          <strong>{task.title}</strong>
          <p>
            {board.columns.find((c) => c.id === task.status)?.title} ·{' '}
            {task.priority} priority
          </p>
          <p>{task.description || 'No description'}</p>
          <p>
            Started: {task.startedAt?.slice(0, 10) || '—'} · Due:{' '}
            {task.dueDate?.slice(0, 10) || '—'} · Expected finish:{' '}
            {task.expectedFinishAt?.slice(0, 10) || '—'}
          </p>
        </article>
      ))}
    </div>
  );
}
