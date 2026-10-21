import { useEffect, useRef, useState } from 'react';
import { ApiError, requestError } from '../lib/api';
import {
  loadCloud,
  readGuest,
  saveCloud,
  saveGuest,
  type Board,
} from '../lib/board';

// Reapply only the user's changes. Unrelated newer cloud work is retained.
export function rebaseBoard(base: Board, draft: Board, latest: Board): Board {
  const merge = <T extends { id: string }>(
    before: T[],
    proposed: T[],
    current: T[]
  ) => {
    const old = new Map(before.map((x) => [x.id, x]));
    const next = new Map(proposed.map((x) => [x.id, x]));
    const result = current
      .filter((x) => !old.has(x.id) || next.has(x.id))
      .map((x) => {
        const prior = old.get(x.id);
        const change = next.get(x.id);
        if (!prior || !change) return x;
        const fields = Object.fromEntries(
          Object.entries(change).filter(
            ([k, v]) =>
              JSON.stringify(v) !== JSON.stringify(prior[k as keyof T])
          )
        );
        return { ...x, ...fields };
      });
    for (const x of proposed)
      if (
        !current.some((c) => c.id === x.id) &&
        (!old.has(x.id) || JSON.stringify(x) !== JSON.stringify(old.get(x.id)))
      )
        result.push(x);
    return result;
  };
  const columns = merge(base.columns, draft.columns, latest.columns);
  if (!columns.length)
    throw new Error(
      'Both devices removed different columns. Keep the cloud value, then choose a column to retain.'
    );
  const tasks = merge(base.tasks, draft.tasks, latest.tasks)
    .map((t) =>
      base.tasks.some((old) => old.id === t.id) &&
      !latest.tasks.some((current) => current.id === t.id)
        ? { ...t, id: crypto.randomUUID() }
        : t
    )
    .map((t) =>
      columns.some((c) => c.id === t.status)
        ? t
        : { ...t, status: columns[0].id }
    );
  return { columns, tasks, revision: latest.revision };
}
export function useBoard(workspaceId?: string) {
  const [initial] = useState(readGuest);
  const [board, setBoard] = useState<Board>(
    workspaceId ? { columns: [], tasks: [], revision: 0 } : initial.board
  );
  const [loading, setLoading] = useState(Boolean(workspaceId));
  const [error, setError] = useState(workspaceId ? '' : initial.error);
  const [status, setStatus] = useState(
    workspaceId
      ? 'Loading…'
      : initial.error
        ? 'Not saved—retry'
        : 'Saved on this device'
  );
  const [pending, setPending] = useState<Board | null>(null);
  const [latest, setLatest] = useState<Board | null>(null);
  const current = useRef(board);
  const baseline = useRef(board);
  const busy = useRef(false);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  useEffect(() => {
    if (!workspaceId) return;
    const controller = new AbortController();
    void loadCloud(workspaceId, controller.signal)
      .then((b) => {
        if (controller.signal.aborted) return;
        current.current = b;
        baseline.current = b;
        setBoard(b);
        setStatus('Saved to cloud');
        setError('');
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(requestError(e));
          setStatus('Not saved—retry');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [workspaceId]);
  useEffect(() => {
    if (!pending) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pending]);
  const persist = async (draft: Board) => {
    if (busy.current) throw new Error('Wait for the current save.');
    busy.current = true;
    setPending(draft);
    setStatus('Saving…');
    setError('');
    try {
      if (workspaceId) {
        const saved = await saveCloud(workspaceId, draft);
        if (!live.current) return;
        current.current = saved;
        baseline.current = saved;
        setBoard(saved);
      } else {
        current.current = draft;
        setBoard(draft);
        saveGuest(draft);
        baseline.current = draft;
      }
      if (!live.current) return;
      setPending(null);
      setLatest(null);
      setStatus(workspaceId ? 'Saved to cloud' : 'Saved on this device');
    } catch (e) {
      if (!live.current) return;
      setStatus('Not saved—retry');
      setError(requestError(e));
      if (workspaceId && e instanceof ApiError && e.status === 409) {
        try {
          const b = await loadCloud(workspaceId);
          if (live.current) setLatest(b);
        } catch (cause) {
          if (live.current) setError(requestError(cause));
        }
      }
      throw e;
    } finally {
      busy.current = false;
    }
  };
  const change = async (update: (b: Board) => Board) => {
    if (
      loading ||
      (workspaceId && pending) ||
      busy.current ||
      (workspaceId && !board.columns.length)
    )
      throw new Error('Resolve the pending save before making another change.');
    await persist({
      ...update(current.current),
      revision: current.current.revision + (workspaceId ? 0 : 1),
    });
  };
  const acceptLatest = () => {
    if (!latest) return;
    current.current = latest;
    baseline.current = latest;
    setBoard(latest);
    setPending(null);
    setLatest(null);
    setError('');
    setStatus('Saved to cloud');
  };
  return {
    board,
    loading,
    error,
    status,
    pending,
    latest,
    change,
    persist,
    acceptLatest,
    retry: async () => {
      if (pending) return persist(pending);
      if (!workspaceId) return persist(current.current);
      setLoading(true);
      try {
        const b = await loadCloud(workspaceId);
        current.current = b;
        baseline.current = b;
        setBoard(b);
        setError('');
        setStatus('Saved to cloud');
      } catch (e) {
        setError(requestError(e));
      } finally {
        setLoading(false);
      }
    },
    applyDraft: async () => {
      if (latest && pending)
        await persist(rebaseBoard(baseline.current, pending, latest));
    },
    replace: (b: Board) => {
      current.current = b;
      baseline.current = b;
      setBoard(b);
      setStatus('Saved to cloud');
    },
  };
}
