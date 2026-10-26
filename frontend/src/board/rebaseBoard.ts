import type { Board } from '../lib/board';

// Reapply only the user's changes. Unrelated newer cloud work is retained.
export function rebaseBoard(
  base: Board,
  draft: Board,
  latest: Board,
  onRecreated?: (oldId: string, newId: string) => void
): Board {
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
    .map((t) => {
      if (
        !base.tasks.some((old) => old.id === t.id) ||
        latest.tasks.some((current) => current.id === t.id)
      )
        return t;
      const id = crypto.randomUUID();
      onRecreated?.(t.id, id);
      return { ...t, id };
    })
    .map((t) =>
      columns.some((c) => c.id === t.status)
        ? t
        : { ...t, status: columns[0].id }
    );
  return { columns, tasks, revision: latest.revision };
}
