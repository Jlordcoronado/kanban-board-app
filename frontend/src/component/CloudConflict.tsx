import { useState } from 'react';
import type { BoardController } from '../board/types';
import type { Board } from '../lib/board';
import { requestError } from '../lib/api';
import { Dialog } from './Dialog';

export function CloudConflict({
  storage,
  onResolved,
  hideReviewTrigger = false,
}: {
  storage: BoardController;
  onResolved?: () => void;
  hideReviewTrigger?: boolean;
}) {
  const [hidden, setHidden] = useState<Board | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!storage.latest || !storage.pending) return null;
  if (hidden === storage.latest)
    return hideReviewTrigger ? null : (
      <button className="auth-theme" onClick={() => setHidden(null)}>
        Review cloud conflict
      </button>
    );
  return (
    <Dialog
      title="Cloud save conflict"
      onClose={() => {
        if (!busy) setHidden(storage.latest);
      }}
    >
      <h2>Your cloud board changed</h2>
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      <p>
        Review the latest cloud values and your proposed changes. Applying your
        draft keeps unrelated cloud changes.
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
      <button
        className="auth-secondary"
        disabled={busy}
        onClick={() => {
          storage.acceptLatest();
          onResolved?.();
        }}
      >
        Keep cloud value
      </button>
      <button
        className="auth-primary"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError('');
          void storage
            .applyDraft()
            .then(() => onResolved?.())
            .catch((cause) => setError(requestError(cause)))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? 'Saving…' : 'Apply draft against latest revision'}
      </button>
    </Dialog>
  );
}

function BoardValues({ board }: { board: Board }) {
  return (
    <div className="conflict-board">
      <p>Columns: {board.columns.map((c) => c.title).join(' → ')}</p>
      {!board.tasks.length && <p>No active tasks</p>}
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
