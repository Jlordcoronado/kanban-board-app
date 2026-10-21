import type { Column, Task } from '../types/task';
import { apiRequest } from './api';
export interface Board {
  columns: Column[];
  tasks: Task[];
  revision: number;
}
export interface GuestBoard extends Board {
  version: 1;
  deviceId: string;
}
export const GUEST_KEY = 'kanban-guest-v1';
export const GUEST_DRAFT = 'kanban-guest-editor-v1';
export const defaultColumns = (): Column[] => [
  { id: 'todo', title: 'To Do' },
  { id: 'in progress', title: 'In Progress' },
  { id: 'done', title: 'Done' },
];
export function validBoard(value: unknown): value is Board {
  if (!value || typeof value !== 'object') return false;
  const b = value as Board;
  if (
    !Number.isSafeInteger(b.revision) ||
    b.revision < 0 ||
    !Array.isArray(b.columns) ||
    !b.columns.length ||
    !Array.isArray(b.tasks)
  )
    return false;
  const ids = new Set<string>();
  for (const c of b.columns) {
    if (
      !c ||
      typeof c.id !== 'string' ||
      !c.id.trim() ||
      c.id.length > 100 ||
      typeof c.title !== 'string' ||
      !c.title.trim() ||
      c.title.length > 100 ||
      ids.has(c.id)
    )
      return false;
    ids.add(c.id);
  }
  const tasks = new Set<string>();
  return b.tasks.every((t) => {
    if (
      !t ||
      typeof t.id !== 'string' ||
      !t.id ||
      tasks.has(t.id) ||
      typeof t.title !== 'string' ||
      !t.title.trim() ||
      t.title.length > 200 ||
      typeof t.description !== 'string' ||
      t.description.length > 2000 ||
      !ids.has(t.status) ||
      !['low', 'medium', 'high'].includes(t.priority) ||
      ![t.startedAt, t.dueDate, t.expectedFinishAt].every(
        (d) =>
          d === null || (typeof d === 'string' && !Number.isNaN(Date.parse(d)))
      ) ||
      (t.archivedAt != null &&
        (typeof t.archivedAt !== 'string' ||
          Number.isNaN(Date.parse(t.archivedAt))))
    )
      return false;
    tasks.add(t.id);
    return true;
  });
}
let guestCache: GuestBoard | undefined;
let unsavedGuest = false;
export function readGuest(): { board: GuestBoard; error: string } {
  if (unsavedGuest && guestCache)
    return {
      board: guestCache,
      error:
        'Browser saving failed. Your current work is still in memory; retry before leaving.',
    };
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (
        data.version !== 1 ||
        typeof data.deviceId !== 'string' ||
        !validBoard(data)
      )
        throw new Error('Invalid browser board');
      guestCache = data as GuestBoard;
      return { board: guestCache, error: '' };
    }
    guestCache = {
      version: 1,
      deviceId: crypto.randomUUID(),
      revision: 0,
      columns: defaultColumns(),
      tasks: [],
    };
    return { board: guestCache, error: '' };
  } catch {
    guestCache ??= {
      version: 1,
      deviceId: crypto.randomUUID(),
      revision: 0,
      columns: defaultColumns(),
      tasks: [],
    };
    return {
      board: guestCache,
      error:
        'Browser storage is unavailable or invalid. Changes may not survive a refresh.',
    };
  }
}
export function saveGuest(board: Board): void {
  const current = readGuest().board;
  guestCache = { ...board, version: 1, deviceId: current.deviceId };
  unsavedGuest = true;
  localStorage.setItem(GUEST_KEY, JSON.stringify(guestCache));
  unsavedGuest = false;
}
export const activeTasks = (b: Board) => b.tasks.filter((t) => !t.archivedAt);
export async function loadCloud(
  workspaceId: string,
  signal?: AbortSignal
): Promise<Board> {
  const b = await apiRequest<Board>('/api/board', { workspaceId, signal });
  if (!validBoard(b))
    throw new Error('Invalid cloud board. Try loading again.');
  return b;
}
export async function saveCloud(
  workspaceId: string,
  board: Board
): Promise<Board> {
  const saved = await apiRequest<Board>('/api/board', {
    workspaceId,
    method: 'PUT',
    body: JSON.stringify(board),
  });
  if (!validBoard(saved))
    throw new Error(
      'Invalid cloud save response. Retry to check the saved revision.'
    );
  return saved;
}
export function guestFingerprint(b: GuestBoard): string {
  return JSON.stringify({ columns: b.columns, tasks: activeTasks(b) });
}

export function readGuestDraft(): Task | null {
  for (const storage of [() => sessionStorage, () => localStorage]) {
    try {
      const raw = storage().getItem(GUEST_DRAFT);
      const t = raw ? JSON.parse(raw) : null;
      if (
        t &&
        typeof t.id === 'string' &&
        typeof t.title === 'string' &&
        t.title.length <= 200 &&
        typeof t.description === 'string' &&
        t.description.length <= 2000 &&
        typeof t.status === 'string' &&
        t.status.length <= 100 &&
        ['low', 'medium', 'high'].includes(t.priority) &&
        [t.startedAt, t.dueDate, t.expectedFinishAt].every(
          (d) =>
            d === null ||
            (typeof d === 'string' && !Number.isNaN(Date.parse(d)))
        )
      )
        return t;
    } catch {
      /* Try the other browser store. */
    }
  }
  return null;
}
export function rememberGuestDraft(draft: Task) {
  const raw = JSON.stringify(draft);
  try {
    localStorage.setItem(GUEST_DRAFT, raw);
    try {
      sessionStorage.removeItem(GUEST_DRAFT);
    } catch {
      /* optional fallback */
    }
  } catch {
    sessionStorage.setItem(GUEST_DRAFT, raw);
  }
}
export function forgetGuestDraft() {
  try {
    localStorage.removeItem(GUEST_DRAFT);
  } catch {
    /* unavailable */
  }
  try {
    sessionStorage.removeItem(GUEST_DRAFT);
  } catch {
    /* unavailable */
  }
}
export function hasGuestWork(board: Board): boolean {
  return (
    activeTasks(board).length > 0 ||
    JSON.stringify(board.columns) !== JSON.stringify(defaultColumns())
  );
}
