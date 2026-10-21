import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Task, Column } from '../types/task.ts';
import { apiRequest, requestError } from '../lib/api';

interface TaskModalProps {
  workspaceId?: string;
  onSignIn?: () => void;
  onDraft?: (draft: Task) => void;
  task: Task;
  columns?: Column[];
  onSave: (
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
  ) => Promise<void>;
  onClose: () => void;
}

const inputClass =
  'w-full rounded-md border border-[var(--border)] bg-[var(--surface-raised)] px-3.5 py-2.5 text-[0.95rem] text-[var(--text)] transition-[border-color,box-shadow] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgb(61_90_76/0.15)] focus:outline-none dark:focus:shadow-[0_0_0_3px_rgb(107_158_130/0.2)]';

const btnBase =
  'cursor-pointer rounded-md border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]';

const editableFieldClass =
  'w-full cursor-pointer rounded-md border border-transparent px-3.5 py-2.5 text-left transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-raised)] focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgb(61_90_76/0.15)]';

function toDateInputString(value: string | null): string {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toISOString().slice(0, 10);
}

function toDateOrNull(value: string): string | null {
  return value ? value : null;
}

function buildRecommendedDescription(taskTitle: string): string {
  if (!taskTitle.trim()) {
    return 'Add a title to generate a recommended description.';
  }

  return 'Describe the work required, the important details or steps, and the outcome that will confirm it is complete.';
}

export function TaskModal({
  task,
  columns,
  onSave,
  onClose,
  workspaceId,
  onSignIn,
  onDraft,
}: TaskModalProps) {
  const isNewTask = !task.id;
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [suggestedDescription, setSuggestedDescription] = useState(
    buildRecommendedDescription(task.title)
  );
  const [suggestionSource, setSuggestionSource] = useState<'local' | 'gemini'>(
    'local'
  );
  const [status, setStatus] = useState<string>(task.status);
  const [priority, setPriority] = useState<Task['priority']>(task.priority);
  const [startedAt, setStartedAt] = useState(toDateInputString(task.startedAt));
  const [dueDate, setDueDate] = useState(toDateInputString(task.dueDate));
  const [expectedFinishAt, setExpectedFinishAt] = useState(
    toDateInputString(task.expectedFinishAt)
  );
  const [error, setError] = useState('');
  const [aiError, setAiError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [confirmation, setConfirmation] = useState<'save' | 'discard' | null>(
    null
  );
  const [activeField, setActiveField] = useState<
    'title' | 'description' | null
  >(null);

  const hasChanges =
    title !== task.title ||
    description !== task.description ||
    status !== task.status ||
    priority !== task.priority ||
    startedAt !== toDateInputString(task.startedAt) ||
    dueDate !== toDateInputString(task.dueDate) ||
    expectedFinishAt !== toDateInputString(task.expectedFinishAt);

  const requestClose = useCallback(() => {
    if (isSaving) return;

    if (hasChanges) {
      setConfirmation('discard');
      return;
    }

    onClose();
  }, [hasChanges, isSaving, onClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== 'Escape' ||
        isSaving ||
        document.querySelector('dialog[open]')
      )
        return;

      if (confirmation) {
        setConfirmation(confirmation === 'discard' ? null : 'discard');
        return;
      }

      requestClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [confirmation, isSaving, requestClose]);

  useEffect(() => {
    onDraft?.({
      ...task,
      title,
      description,
      status,
      priority,
      startedAt: toDateOrNull(startedAt),
      dueDate: toDateOrNull(dueDate),
      expectedFinishAt: toDateOrNull(expectedFinishAt),
    });
  }, [
    onDraft,
    task,
    title,
    description,
    status,
    priority,
    startedAt,
    dueDate,
    expectedFinishAt,
  ]);
  useEffect(() => {
    if (!hasChanges) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasChanges]);

  useEffect(() => {
    if (suggestionSource === 'gemini') return;

    setSuggestedDescription(buildRecommendedDescription(title));
    setAiError('');
  }, [suggestionSource, title]);

  const handleRewrite = async () => {
    if (!workspaceId) {
      onSignIn?.();
      setAiError(
        'Sign in to use Gemini, then request a rewrite when you are ready.'
      );
      return;
    }
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setAiError('Add a task title before using Gemini.');
      return;
    }

    setAiError('');
    setIsRewriting(true);

    try {
      const data: unknown = await apiRequest('/api/ai/rewrite-task', {
        method: 'POST',
        workspaceId,
        body: JSON.stringify({ title: trimmedTitle }),
      });
      const suggestion =
        typeof data === 'object' &&
        data !== null &&
        'suggestedDescription' in data &&
        typeof data.suggestedDescription === 'string'
          ? data.suggestedDescription.trim()
          : '';

      if (!suggestion) {
        throw new Error('Gemini returned an empty suggestion');
      }

      setSuggestedDescription(suggestion);
      setSuggestionSource('gemini');
    } catch (cause) {
      setAiError(requestError(cause));
    } finally {
      setIsRewriting(false);
    }
  };

  const applySuggestedDescription = () => {
    setDescription(suggestedDescription);
  };

  const saveChanges = async () => {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setError('Title is required.');
      return;
    }

    setError('');
    setIsSaving(true);

    try {
      await onSave({
        title: trimmedTitle,
        description,
        status,
        priority,
        startedAt: toDateOrNull(startedAt),
        dueDate: toDateOrNull(dueDate),
        expectedFinishAt: toDateOrNull(expectedFinishAt),
      });
    } catch {
      setError('Unable to save this task. Please try again.');
      setIsSaving(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    setError('');
    setConfirmation('save');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !confirmation)
          requestClose();
      }}
    >
      <form
        className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-md)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-task-title"
        onSubmit={handleSubmit}
      >
        {!workspaceId && (
          <button type="button" className="auth-theme" onClick={onSignIn}>
            Save to cloud
          </button>
        )}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2
              id="edit-task-title"
              className="m-0 text-xl font-bold text-[var(--text)]"
            >
              {isNewTask ? 'New task' : 'Task details'}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {isNewTask
                ? 'Add the details for this task.'
                : 'Click any detail to update it.'}
            </p>
          </div>
          <button
            type="button"
            className="cursor-pointer rounded-md p-1 text-xl leading-none text-[var(--text-muted)] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            aria-label="Close edit task dialog"
            onClick={requestClose}
            disabled={isSaving}
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          {isNewTask || activeField === 'title' ? (
            <label className="block text-sm font-semibold text-[var(--text)]">
              Title
              <input
                className={`${inputClass} mt-1.5`}
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={() => !isNewTask && setActiveField(null)}
                maxLength={200}
                autoFocus={isNewTask || activeField === 'title'}
                required
              />
            </label>
          ) : (
            <button
              type="button"
              className={editableFieldClass}
              onClick={() => setActiveField('title')}
              aria-label="Edit title"
            >
              <span className="block text-sm font-semibold text-[var(--text)]">
                Title
              </span>
              <span className="mt-1 block break-words text-[0.95rem] font-semibold text-[var(--text)]">
                {title || 'Untitled task'}
              </span>
            </button>
          )}

          {isNewTask || activeField === 'description' ? (
            <label className="block text-sm font-semibold text-[var(--text)]">
              Description
              <textarea
                className={`${inputClass} mt-1.5 min-h-24 resize-y`}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                onBlur={() => !isNewTask && setActiveField(null)}
                placeholder={suggestedDescription}
                maxLength={2000}
                rows={3}
              />
            </label>
          ) : (
            <button
              type="button"
              className={editableFieldClass}
              onClick={() => setActiveField('description')}
              aria-label="Edit description"
            >
              <span className="block text-sm font-semibold text-[var(--text)]">
                Description
              </span>
              <span
                className={`mt-1 block whitespace-pre-wrap break-words text-[0.95rem] font-normal leading-relaxed ${
                  description
                    ? 'text-[var(--text)]'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                {description || 'Add a description'}
              </span>
            </button>
          )}

          {(isNewTask || activeField === 'description') && (
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-sm)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#8ab4ff_0%,#7c5cff_45%,#48d0b7_100%)] text-[#fff] shadow-[0_8px_20px_rgba(80,104,176,0.18)]">
                    <svg
                      className="h-4.5 w-4.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M12 3l1.6 4.8L18.4 9.4l-4.8 1.5L12 15.7l-1.6-4.8L5.6 9.4l4.8-1.6L12 3Z"
                        fill="currentColor"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--text)]">
                      Gemini suggestion
                    </h3>
                    <p className="text-xs text-[var(--text-muted)]">
                      Create a description from the current title
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="cursor-pointer rounded-md border border-[var(--accent)] bg-[var(--accent)] px-2.5 py-1.5 text-xs font-semibold text-[#faf8f5] transition-colors hover:border-[var(--accent-hover)] hover:bg-[var(--accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={handleRewrite}
                    disabled={isSaving || isRewriting}
                  >
                    {isRewriting
                      ? 'Rewriting...'
                      : workspaceId
                        ? 'Rewrite with Gemini'
                        : 'Sign in to use Gemini'}
                  </button>
                  <button
                    type="button"
                    className="cursor-pointer rounded-md border border-[var(--border)] bg-transparent px-2.5 py-1.5 text-xs font-semibold text-[var(--text)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={applySuggestedDescription}
                    disabled={
                      isSaving || isRewriting || !suggestedDescription.trim()
                    }
                  >
                    Apply
                  </button>
                </div>
              </div>
              {aiError && (
                <p
                  className="mt-3 text-xs font-medium text-[var(--danger)]"
                  role="alert"
                >
                  {aiError}
                </p>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {columns && columns.length > 0 && (
              <label className="block text-sm font-semibold text-[var(--text)]">
                Status / Column
                <select
                  className={`${inputClass} mt-1.5`}
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  {columns.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.title}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="block text-sm font-semibold text-[var(--text)]">
              Priority
              <select
                className={`${inputClass} mt-1.5`}
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value as Task['priority'])
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm font-semibold text-[var(--text)]">
              Started
              <input
                className={`${inputClass} mt-1.5`}
                type="date"
                value={startedAt}
                onChange={(event) => setStartedAt(event.target.value)}
              />
            </label>

            <label className="block text-sm font-semibold text-[var(--text)]">
              Due date
              <input
                className={`${inputClass} mt-1.5`}
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>

            <label className="block text-sm font-semibold text-[var(--text)]">
              Expected finish
              <input
                className={`${inputClass} mt-1.5`}
                type="date"
                value={expectedFinishAt}
                onChange={(event) => setExpectedFinishAt(event.target.value)}
              />
            </label>
          </div>
        </div>

        {error && (
          <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className={`${btnBase} border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]`}
            onClick={requestClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`${btnBase} border-[var(--accent)] bg-[var(--accent)] text-[#faf8f5] hover:border-[var(--accent-hover)] hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60`}
            disabled={isSaving}
          >
            {isSaving ? 'Saving…' : isNewTask ? 'Create task' : 'Save changes'}
          </button>
        </div>
      </form>

      {confirmation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-md)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-changes-confirmation-title"
          >
            <h2
              id="task-changes-confirmation-title"
              className="m-0 text-xl font-bold text-[var(--text)]"
            >
              {confirmation === 'save' ? 'Save changes?' : 'Disregard changes?'}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {confirmation === 'save'
                ? 'Save the edits to this task, or close without saving them.'
                : 'Your edits have not been saved.'}
            </p>

            <div className="mt-5 flex flex-wrap justify-end gap-2.5 border-t border-[var(--border-subtle)] pt-4">
              {confirmation === 'save' ? (
                <button
                  type="button"
                  className={`${btnBase} border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]`}
                  onClick={() => setConfirmation(null)}
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  className={`${btnBase} border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]`}
                  onClick={() => setConfirmation(null)}
                >
                  Keep editing
                </button>
              )}
              <button
                type="button"
                className={`${btnBase} border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)] hover:bg-[var(--danger-border)]`}
                onClick={onClose}
              >
                Disregard changes
              </button>
              {confirmation === 'save' && (
                <button
                  type="button"
                  className={`${btnBase} border-[var(--accent)] bg-[var(--accent)] text-[#faf8f5] hover:border-[var(--accent-hover)] hover:bg-[var(--accent-hover)]`}
                  onClick={() => {
                    setConfirmation(null);
                    void saveChanges();
                  }}
                >
                  Save changes
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
