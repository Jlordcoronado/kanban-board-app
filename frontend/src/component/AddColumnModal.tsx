import { useEffect, useState, type FormEvent } from 'react';

interface AddColumnModalProps {
  existingTitles: string[];
  onAddColumn: (title: string) => void;
  onClose: () => void;
}

const inputClass =
  'w-full rounded-md border border-[var(--border)] bg-[var(--surface-raised)] px-3.5 py-2.5 text-[0.95rem] text-[var(--text)] transition-[border-color,box-shadow] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgb(61_90_76/0.15)] focus:outline-none dark:focus:shadow-[0_0_0_3px_rgb(107_158_130/0.2)]';

const btnBase =
  'cursor-pointer rounded-md border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]';

export function AddColumnModal({ existingTitles, onAddColumn, onClose }: AddColumnModalProps) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const sanitizedTitle = title.trim();

    if (!sanitizedTitle) {
      setError('Column name cannot be empty.');
      return;
    }

    if (sanitizedTitle.length > 50) {
      setError('Column name cannot exceed 50 characters.');
      return;
    }

    const isDuplicate = existingTitles.some(
      (t) => t.toLowerCase() === sanitizedTitle.toLowerCase()
    );

    if (isDuplicate) {
      setError('A column with this name already exists.');
      return;
    }

    setError('');
    onAddColumn(sanitizedTitle);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-md)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-column-title"
        onSubmit={handleSubmit}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="add-column-title" className="m-0 text-xl font-bold text-[var(--text)]">
              Add New Column
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Enter a title to create a new board status column.
            </p>
          </div>
          <button
            type="button"
            className="cursor-pointer rounded-md p-1 text-xl leading-none text-[var(--text-muted)] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            aria-label="Close dialog"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] p-3 text-xs font-medium text-[var(--danger)]">
            {error}
          </div>
        )}

        <div className="mb-5 space-y-2">
          <label className="block text-sm font-semibold text-[var(--text)]" htmlFor="column-name-input">
            Column Name
          </label>
          <input
            id="column-name-input"
            className={inputClass}
            type="text"
            placeholder="e.g. Production, QA, Backlog"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (error) setError('');
            }}
            maxLength={50}
            autoFocus
            required
          />
          <p className="text-[0.75rem] text-[var(--text-muted)]">{title.length}/50 characters</p>
        </div>

        <div className="flex justify-end gap-2.5 border-t border-[var(--border-subtle)] pt-4">
          <button
            type="button"
            className={`${btnBase} border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--text)]`}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`${btnBase} border-[var(--accent)] bg-[var(--accent)] text-[#faf8f5] hover:border-[var(--accent-hover)] hover:bg-[var(--accent-hover)]`}
          >
            Add Column
          </button>
        </div>
      </form>
    </div>
  );
}
