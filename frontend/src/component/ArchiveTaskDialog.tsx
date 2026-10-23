import { useRef, useState, type RefObject } from 'react';
import { Dialog } from './Dialog';
import { requestError } from '../lib/api';

export function ArchiveTaskDialog({
  title,
  onArchive,
  onClose,
  returnFocusRef,
}: {
  title: string;
  onArchive: () => Promise<void>;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const archive = async () => {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      await onArchive();
    } catch (cause) {
      setError(
        `Unable to archive this task. ${requestError(cause)} Try again.`
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  return (
    <Dialog
      title="Archive this task?"
      className="task-discard"
      hideClose
      dismissOnBackdrop
      returnFocusRef={returnFocusRef}
      onClose={() => {
        if (!saving.current) onClose();
      }}
    >
      <h2>Archive this task?</h2>
      <p className="board-archive-title">{title}</p>
      <p>The task will be removed from your active board.</p>
      {error && (
        <p className="task-error" role="alert">
          {error}
        </p>
      )}
      <div className="task-actions">
        <button
          type="button"
          className="task-button task-secondary"
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="button"
          className="task-button task-danger"
          onClick={() => void archive()}
          disabled={busy}
        >
          {busy ? 'Archiving…' : 'Archive task'}
        </button>
      </div>
    </Dialog>
  );
}
