import { useEffect } from 'react';

interface ConfirmDeleteModalProps {
  title: string;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
  onClose: () => void;
}

const btnBase =
  'cursor-pointer rounded-md border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]';

export function ConfirmDeleteModal({
  title,
  message,
  confirmText = 'Delete',
  onConfirm,
  onClose,
}: ConfirmDeleteModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-md)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="confirm-modal-title" className="m-0 text-xl font-bold text-[var(--text)]">
              {title}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{message}</p>
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

        <div className="flex justify-end gap-2.5 border-t border-[var(--border-subtle)] pt-4">
          <button
            type="button"
            className={`${btnBase} border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--text)]`}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`${btnBase} border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)] hover:bg-[var(--danger-border)]`}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
