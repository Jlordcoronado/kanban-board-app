import type { Board } from '../lib/board';
import type { Workspace } from '../types/workspace';

export interface BoardController {
  board: Board;
  loading: boolean;
  error: string;
  status: string;
  pending: Board | null;
  latest: Board | null;
  available: boolean;
  saving: boolean;
  lastUpdated: number | null;
  resolution: number;
  resolvedTaskIds: Record<string, string>;
  change: (update: (board: Board) => Board) => Promise<void>;
  persist: (draft: Board) => Promise<void>;
  acceptLatest: () => void;
  discardPending: () => void;
  retry: () => Promise<void>;
  applyDraft: () => Promise<void>;
  replace: (board: Board) => void;
  refresh: () => Promise<void>;
}

export interface WorkspaceBoardEntry {
  workspace: Workspace;
  storage: BoardController;
}
