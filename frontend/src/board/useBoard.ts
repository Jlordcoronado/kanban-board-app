import { useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { createBoardStore } from './boardStore';
import { WorkspaceBoardsContext } from './workspaceContext';

export { rebaseBoard } from './rebaseBoard';

export function useBoard(workspaceId?: string) {
  const registry = useContext(WorkspaceBoardsContext);
  const shared = workspaceId ? registry?.stores.get(workspaceId) : undefined;
  const local = useMemo(
    () => (shared ? null : createBoardStore(workspaceId)),
    [shared, workspaceId]
  );
  const store = shared ?? local!;
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot
  );
  useEffect(() => {
    if (shared) return;
    store.start();
    return store.stop;
  }, [shared, store]);
  useEffect(() => {
    if (shared || !snapshot.pending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [shared, snapshot.pending]);
  return snapshot;
}
