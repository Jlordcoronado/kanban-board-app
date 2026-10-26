import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import { Dialog } from './Dialog';

export function TaskNavigationGuard({
  changed,
  saving,
  onDiscard,
}: {
  changed: boolean;
  saving: boolean;
  onDiscard: () => void;
}) {
  const blocker = useBlocker(changed || saving);
  useEffect(() => {
    if (blocker.state === 'blocked' && !changed && !saving) blocker.proceed();
  }, [blocker, changed, saving]);
  if (blocker.state !== 'blocked') return null;
  return (
    <Dialog
      title="Discard changes?"
      className="task-discard"
      hideClose
      onClose={() => blocker.reset()}
    >
      <h2>{saving ? 'Saving your task…' : 'Discard changes?'}</h2>
      <p>
        {saving
          ? 'Wait for the current save before leaving this page.'
          : 'Your edits have not been saved.'}
      </p>
      <div className="task-actions">
        <button
          className="task-button task-secondary"
          type="button"
          onClick={() => blocker.reset()}
        >
          Keep editing
        </button>
        <button
          className="task-button task-danger"
          type="button"
          disabled={saving}
          onClick={() => {
            onDiscard();
            blocker.proceed();
          }}
        >
          Discard changes
        </button>
      </div>
    </Dialog>
  );
}
