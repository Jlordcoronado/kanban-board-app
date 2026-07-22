import { useEffect, useState, type FormEvent } from 'react';
import type { Task, Column } from '../types/task.ts';

interface TaskModalProps {
  task: Task;
  columns?: Column[];
  onSave: (
    changes: Pick<
      Task,
      'title' | 'description' | 'priority' | 'status' | 'startedAt' | 'dueDate' | 'expectedFinishAt'
    >
  ) => Promise<void>;
  onClose: () => void;
}

const inputClass =
  'w-full rounded-md border border-[var(--border)] bg-[var(--surface-raised)] px-3.5 py-2.5 text-[0.95rem] text-[var(--text)] transition-[border-color,box-shadow] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgb(61_90_76/0.15)] focus:outline-none dark:focus:shadow-[0_0_0_3px_rgb(107_158_130/0.2)]';

const btnBase =
  'cursor-pointer rounded-md border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]';

function toDateTimeLocal(value: string | null): string {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 16);
}

function toIsoOrNull(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

export function TaskModal({ task, columns, onSave, onClose }: TaskModalProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [status, setStatus] = useState<string>(task.status);
  const [priority, setPriority] = useState<Task['priority']>(task.priority);
  const [startedAt, setStartedAt] = useState(toDateTimeLocal(task.startedAt));
  const [dueDate, setDueDate] = useState(toDateTimeLocal(task.dueDate));
  const [expectedFinishAt, setExpectedFinishAt] = useState(
    toDateTimeLocal(task.expectedFinishAt)
  );
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onClose]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
        startedAt: toIsoOrNull(startedAt),
        dueDate: toIsoOrNull(dueDate),
        expectedFinishAt: toIsoOrNull(expectedFinishAt),
      });
    } catch {
      setError('Unable to save this task. Please try again.');
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose();
      }}
    >
      <form
        className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-md)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-task-title"
        onSubmit={handleSubmit}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="edit-task-title" className="m-0 text-xl font-bold text-[var(--text)]">
              Edit task
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Update the task details.</p>
          </div>
          <button
            type="button"
            className="cursor-pointer rounded-md p-1 text-xl leading-none text-[var(--text-muted)] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            aria-label="Close edit task dialog"
            onClick={onClose}
            disabled={isSaving}
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-semibold text-[var(--text)]">
            Title
            <input
              className={`${inputClass} mt-1.5`}
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              autoFocus
              required
            />
          </label>

          <label className="block text-sm font-semibold text-[var(--text)]">
            Description
            <textarea
              className={`${inputClass} mt-1.5 min-h-24 resize-y`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Description (optional)"
              maxLength={2000}
              rows={3}
            />
          </label>

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
                onChange={(event) => setPriority(event.target.value as Task['priority'])}
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
                type="datetime-local"
                value={startedAt}
                onChange={(event) => setStartedAt(event.target.value)}
              />
            </label>

            <label className="block text-sm font-semibold text-[var(--text)]">
              Due date
              <input
                className={`${inputClass} mt-1.5`}
                type="datetime-local"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>

            <label className="block text-sm font-semibold text-[var(--text)]">
              Expected finish
              <input
                className={`${inputClass} mt-1.5`}
                type="datetime-local"
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
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`${btnBase} border-[var(--accent)] bg-[var(--accent)] text-[#faf8f5] hover:border-[var(--accent-hover)] hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60`}
            disabled={isSaving}
          >
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

