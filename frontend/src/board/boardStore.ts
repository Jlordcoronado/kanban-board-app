import { ApiError, requestError } from '../lib/api';
import {
  loadCloud,
  readGuest,
  saveCloud,
  saveGuest,
  type Board,
} from '../lib/board';
import { rebaseBoard } from './rebaseBoard';
import type { BoardController } from './types';

const emptyBoard = (): Board => ({ columns: [], tasks: [], revision: 0 });
type Schedule = (action: () => Promise<void>) => Promise<void>;

// One queue per authenticated session covers initial loads, refreshes and conflict reads.
export function createReadQueue(limit = 3): Schedule {
  let active = 0;
  const waiting: (() => void)[] = [];
  const drain = () => {
    while (active < limit && waiting.length) waiting.shift()!();
  };
  return (action) =>
    new Promise<void>((resolve, reject) => {
      waiting.push(() => {
        active += 1;
        void action()
          .then(resolve, reject)
          .finally(() => {
            active -= 1;
            drain();
          });
      });
      drain();
    });
}

export function createBoardStore(
  workspaceId?: string,
  schedule: Schedule = (action) => action()
) {
  const guest = workspaceId ? null : readGuest();
  let active = false;
  let generation = 0;
  let busy = false;
  let reading: Promise<void> | null = null;
  let baseline = guest?.board ?? emptyBoard();
  const listeners = new Set<() => void>();
  const requests = new Set<AbortController>();
  const notify = (patch: Partial<BoardController>) => {
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  };
  const current = (revision: number) => active && generation === revision;
  const fetchBoard = async (revision: number): Promise<Board | null> => {
    let result: Board | null = null;
    await schedule(async () => {
      if (!current(revision) || !workspaceId) return;
      const controller = new AbortController();
      requests.add(controller);
      try {
        const board = await loadCloud(workspaceId, controller.signal);
        if (current(revision) && !controller.signal.aborted) result = board;
      } catch (error) {
        if (
          current(revision) &&
          error instanceof ApiError &&
          error.status === 403
        ) {
          baseline = emptyBoard();
          notify({
            board: baseline,
            pending: null,
            latest: null,
            available: false,
            lastUpdated: null,
          });
        }
        throw error;
      } finally {
        requests.delete(controller);
      }
    });
    return result;
  };
  const refresh = (): Promise<void> => {
    if (!active || busy || snapshot.pending) return Promise.resolve();
    if (reading) return reading;
    const revision = generation;
    notify({ loading: true, error: '' });
    const request = Promise.resolve().then(async () => {
      try {
        const board = workspaceId
          ? await fetchBoard(revision)
          : readGuest().board;
        if (!current(revision) || !board) return;
        baseline = board;
        notify({
          board,
          available: true,
          lastUpdated: Date.now(),
          error: '',
          status: workspaceId ? 'Saved to cloud' : 'Saved on this device',
        });
      } catch (error) {
        if (!current(revision)) return;
        notify({
          available: false,
          error: requestError(error),
          status: 'Not saved—retry',
          ...(error instanceof ApiError && error.status === 403
            ? { board: emptyBoard(), lastUpdated: null }
            : {}),
        });
      } finally {
        if (current(revision)) {
          reading = null;
          notify({ loading: false });
        }
      }
    });
    reading = request;
    return request;
  };
  const persist = async (draft: Board): Promise<void> => {
    if (!active) throw new Error('This board is no longer open.');
    if (busy) throw new Error('Wait for the current save.');
    if (snapshot.loading)
      throw new Error('Wait for this board to finish loading.');
    const revision = generation;
    busy = true;
    notify({ pending: draft, saving: true, status: 'Saving…', error: '' });
    try {
      let saved: Board;
      if (workspaceId) {
        saved = await saveCloud(workspaceId, draft);
      } else {
        notify({ board: draft });
        saveGuest(draft);
        saved = draft;
      }
      if (!current(revision)) return;
      baseline = saved;
      notify({
        board: saved,
        pending: null,
        latest: null,
        available: true,
        lastUpdated: Date.now(),
        error: '',
        status: workspaceId ? 'Saved to cloud' : 'Saved on this device',
      });
    } catch (error) {
      if (!current(revision)) return;
      notify({ status: 'Not saved—retry', error: requestError(error) });
      if (workspaceId && error instanceof ApiError && error.status === 409) {
        try {
          const latest = await fetchBoard(revision);
          if (current(revision) && latest) notify({ latest });
        } catch (cause) {
          if (current(revision)) notify({ error: requestError(cause) });
        }
      }
      throw error;
    } finally {
      if (current(revision)) {
        busy = false;
        notify({ saving: false });
      }
    }
  };
  let snapshot: BoardController = {
    board: baseline,
    loading: Boolean(workspaceId),
    error: guest?.error ?? '',
    status: workspaceId
      ? 'Loading…'
      : guest?.error
        ? 'Not saved—retry'
        : 'Saved on this device',
    pending: null,
    latest: null,
    available: !workspaceId,
    saving: false,
    lastUpdated: workspaceId ? null : Date.now(),
    resolution: 0,
    resolvedTaskIds: {},
    change: async (update) => {
      if (
        snapshot.loading ||
        busy ||
        (workspaceId &&
          (snapshot.pending ||
            !snapshot.available ||
            !snapshot.board.columns.length))
      )
        throw new Error(
          'Resolve the pending save before making another change.'
        );
      await persist({
        ...update(snapshot.board),
        revision: snapshot.board.revision + (workspaceId ? 0 : 1),
      });
    },
    persist,
    acceptLatest: () => {
      if (!snapshot.latest || busy) return;
      baseline = snapshot.latest;
      notify({
        board: baseline,
        pending: null,
        latest: null,
        available: true,
        error: '',
        status: 'Saved to cloud',
        lastUpdated: Date.now(),
        resolution: snapshot.resolution + 1,
        resolvedTaskIds: {},
      });
    },
    discardPending: () => {
      if (busy || !snapshot.pending) return;
      const latest = snapshot.latest;
      baseline = latest ?? baseline;
      notify({
        board: baseline,
        pending: null,
        latest: null,
        error: '',
        status: workspaceId ? 'Saved to cloud' : 'Saved on this device',
        available: !workspaceId || baseline.columns.length > 0,
        lastUpdated: latest ? Date.now() : snapshot.lastUpdated,
        resolution: snapshot.resolution + 1,
        resolvedTaskIds: {},
      });
    },
    retry: async () => {
      if (snapshot.pending) return persist(snapshot.pending);
      if (!workspaceId) return persist(snapshot.board);
      await refresh();
    },
    applyDraft: async () => {
      if (!snapshot.latest || !snapshot.pending) return;
      const revision = generation;
      const resolvedTaskIds: Record<string, string> = {};
      await persist(
        rebaseBoard(
          baseline,
          snapshot.pending,
          snapshot.latest,
          (oldId, newId) => {
            resolvedTaskIds[oldId] = newId;
          }
        )
      );
      if (current(revision))
        notify({ resolution: snapshot.resolution + 1, resolvedTaskIds });
    },
    replace: (board) => {
      if (!active || busy || snapshot.pending) return;
      if (reading) {
        generation += 1;
        for (const request of requests) request.abort();
        requests.clear();
        reading = null;
      }
      baseline = board;
      notify({
        board,
        loading: false,
        available: true,
        lastUpdated: Date.now(),
        error: '',
        status: workspaceId ? 'Saved to cloud' : 'Saved on this device',
      });
    },
    refresh,
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start: () => {
      active = true;
      if (workspaceId) void refresh();
    },
    stop: () => {
      active = false;
      generation += 1;
      for (const request of requests) request.abort();
      requests.clear();
      reading = null;
      busy = false;
      if (workspaceId) {
        baseline = emptyBoard();
        notify({
          board: baseline,
          pending: null,
          latest: null,
          available: false,
          loading: true,
          saving: false,
          lastUpdated: null,
          resolvedTaskIds: {},
        });
      }
    },
  };
}

export type BoardStore = ReturnType<typeof createBoardStore>;
