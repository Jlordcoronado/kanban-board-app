import { createContext } from 'react';
import { createBoardStore, createReadQueue } from './boardStore';
import type { Workspace } from '../types/workspace';
import type { WorkspaceBoardEntry } from './types';

export function createWorkspaceRegistry(
  userId: string,
  workspaces: Workspace[]
) {
  const schedule = createReadQueue(3);
  const stores = new Map(
    workspaces.map((workspace) => [
      workspace.id,
      createBoardStore(workspace.id, schedule),
    ])
  );
  const listeners = new Set<() => void>();
  const entries = () =>
    workspaces.map((workspace) => ({
      workspace,
      storage: stores.get(workspace.id)!.getSnapshot(),
    }));
  let snapshot: WorkspaceBoardEntry[] = entries();
  for (const store of stores.values())
    store.subscribe(() => {
      snapshot = entries();
      for (const listener of listeners) listener();
    });
  return {
    userId,
    stores,
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh: async () => {
      await Promise.all(
        [...stores.values()].map((store) => store.getSnapshot().refresh())
      );
    },
    start: () => {
      for (const store of stores.values()) store.start();
    },
    stop: () => {
      for (const store of stores.values()) store.stop();
    },
  };
}

export const WorkspaceBoardsContext = createContext<ReturnType<
  typeof createWorkspaceRegistry
> | null>(null);
