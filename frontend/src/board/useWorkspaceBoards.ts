import { useContext, useSyncExternalStore } from 'react';
import { WorkspaceBoardsContext } from './workspaceContext';

export function useWorkspaceBoards() {
  const registry = useContext(WorkspaceBoardsContext);
  if (!registry)
    throw new Error(
      'Workspace boards must be opened inside their account session.'
    );
  const entries = useSyncExternalStore(
    registry.subscribe,
    registry.getSnapshot,
    registry.getSnapshot
  );
  return {
    entries,
    refresh: registry.refresh,
    hasPending: entries.some(({ storage }) => Boolean(storage.pending)),
  };
}
