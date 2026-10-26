import { useRef, useState } from 'react';
import { useBoard } from '../board/useBoard';
import type { Workspace } from '../types/workspace';
import { TaskModal } from './TaskModal';
import { CloudConflict } from './CloudConflict';
import { Dialog } from './Dialog';

export function WorkspaceTaskDialog({
  workspace,
  taskId,
  onClose,
}: {
  workspace: Workspace;
  taskId: string;
  onClose: () => void;
}) {
  const storage = useBoard(workspace.id);
  const failedSave = useRef(false);
  const [conflictReview, setConflictReview] = useState(0);
  const currentId = storage.resolvedTaskIds[taskId] ?? taskId;
  const task = storage.board.tasks.find(
    (task) => task.id === currentId && !task.archivedAt
  );
  const discardOwnPending = () => {
    if (failedSave.current && storage.pending) storage.discardPending();
    failedSave.current = false;
  };
  if (storage.loading)
    return (
      <Dialog title="Loading task" onClose={onClose}>
        <p role="status">Loading the latest task…</p>
      </Dialog>
    );
  if (!storage.available || !task)
    return (
      <Dialog title="Task unavailable" onClose={onClose}>
        <h2>Task unavailable</h2>
        <p>
          {storage.error ||
            'This task is no longer available. Refresh the dashboard to see current work.'}
        </p>
      </Dialog>
    );
  return (
    <>
      <TaskModal
        key={`${currentId}:${storage.resolution}`}
        workspaceId={workspace.id}
        task={task}
        columns={storage.board.columns}
        onClose={() => {
          discardOwnPending();
          onClose();
        }}
        onEditorEnd={discardOwnPending}
        onReviewConflict={
          storage.latest && storage.pending
            ? () => setConflictReview((value) => value + 1)
            : undefined
        }
        onSave={async (changes) => {
          const update = (board: typeof storage.board) => ({
            ...board,
            tasks: board.tasks.map((item) =>
              item.id === currentId ? { ...item, ...changes } : item
            ),
          });
          if (storage.pending && (storage.latest || !failedSave.current))
            throw new Error(
              'Resolve the pending cloud save before saving this task.'
            );
          try {
            if (storage.pending) {
              await storage.persist(update(storage.pending));
            } else await storage.change(update);
            failedSave.current = false;
          } catch (error) {
            failedSave.current = true;
            throw error;
          }
        }}
      />
      <CloudConflict
        key={conflictReview}
        hideReviewTrigger
        storage={storage}
        onResolved={() => {
          failedSave.current = false;
        }}
      />
    </>
  );
}
