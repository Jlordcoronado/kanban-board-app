import { useEffect, useMemo, type ReactNode } from 'react';
import type { Workspace } from '../types/workspace';
import {
  createWorkspaceRegistry,
  WorkspaceBoardsContext,
} from './workspaceContext';

export function WorkspaceBoardsProvider({
  userId,
  workspaces,
  children,
}: {
  userId: string;
  workspaces: Workspace[];
  children: ReactNode;
}) {
  const registry = useMemo(
    () => createWorkspaceRegistry(userId, workspaces),
    [userId, workspaces]
  );
  useEffect(() => {
    registry.start();
    const warn = (event: BeforeUnloadEvent) => {
      if (!registry.getSnapshot().some(({ storage }) => storage.pending))
        return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      registry.stop();
    };
  }, [registry]);
  return (
    <WorkspaceBoardsContext.Provider value={registry}>
      {children}
    </WorkspaceBoardsContext.Provider>
  );
}
