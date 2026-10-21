import { useState } from 'react';
import { Dialog } from './Dialog';
import { apiRequest, requestError } from '../lib/api';
import {
  activeTasks,
  guestFingerprint,
  readGuest,
  validBoard,
  type Board,
} from '../lib/board';
export function GuestImport({
  workspaceId,
  board,
  onImported,
  onClose,
}: {
  workspaceId: string;
  board: Board;
  onImported: (b: Board) => void;
  onClose: () => void;
}) {
  const [guest] = useState(() => readGuest().board);
  const [mapping, setMapping] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      guest.columns.map((c) => [
        c.id,
        board.columns.find(
          (x) => x.title.trim().toLowerCase() === c.title.trim().toLowerCase()
        )?.id ?? `guest-${crypto.randomUUID()}`,
      ])
    )
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const newCount = new Set(
    Object.values(mapping).filter(
      (id) => !board.columns.some((c) => c.id === id)
    )
  ).size;
  const overLimit =
    board.columns.length + newCount > Math.max(7, board.columns.length);
  const dismiss = () => {
    if (busy) return;
    try {
      localStorage.setItem(
        `kanban-copy-dismissed-${workspaceId}`,
        guestFingerprint(guest)
      );
    } catch {
      /* board remains usable */
    }
    onClose();
  };
  const copy = async () => {
    if (busy || overLimit) return;
    setBusy(true);
    setError('');
    try {
      const saved = await apiRequest<Board>('/api/board/import', {
        workspaceId,
        method: 'POST',
        body: JSON.stringify({
          revision: board.revision,
          deviceId: guest.deviceId,
          columns: guest.columns,
          tasks: activeTasks(guest),
          mapping,
        }),
      });
      if (!validBoard(saved))
        throw new Error(
          'Invalid cloud response. Refresh the board before retrying.'
        );
      onImported(saved);
      try {
        localStorage.setItem(
          `kanban-copy-dismissed-${workspaceId}`,
          guestFingerprint(guest)
        );
      } catch {
        /* no board data is lost */
      }
      onClose();
    } catch (e) {
      setError(requestError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title="Copy device work to cloud" onClose={dismiss}>
      <h2>Copy device work to cloud?</h2>
      <p>
        {activeTasks(guest).length} active tasks. Existing cloud work stays in
        place. Archived tasks and the original board remain on this device.
      </p>
      {guest.columns.map((c) => (
        <label key={c.id}>
          {c.title} →
          <select
            disabled={busy}
            value={mapping[c.id]}
            onChange={(e) =>
              setMapping((m) => ({ ...m, [c.id]: e.target.value }))
            }
          >
            {board.columns.map((target) => (
              <option key={target.id} value={target.id}>
                {target.title}
              </option>
            ))}
            <option
              value={
                board.columns.some((x) => x.id === mapping[c.id])
                  ? `guest-${c.id}`
                  : mapping[c.id]
              }
            >
              Create “{c.title}”
            </option>
          </select>
        </label>
      ))}
      {overLimit && (
        <p role="alert">
          Map more stages to existing columns to stay within seven columns.
        </p>
      )}
      {error && (
        <p role="alert">
          {error} Close this preview and refresh the cloud board before retrying
          a conflict.
        </p>
      )}
      <button
        type="button"
        className="auth-primary"
        disabled={busy || overLimit}
        onClick={() => void copy()}
      >
        {busy ? 'Copying…' : 'Copy to cloud'}
      </button>
      <button
        type="button"
        className="auth-secondary"
        disabled={busy}
        onClick={dismiss}
      >
        Keep on this device
      </button>
    </Dialog>
  );
}
