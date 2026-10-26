import { StrictMode, useEffect, type ReactNode } from 'react';
import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../src/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/api')>()),
  apiRequest: vi.fn(),
}));
import { apiRequest, ApiError } from '../src/lib/api';
import { defaultColumns, GUEST_KEY, type Board } from '../src/lib/board';
import type { Workspace } from '../src/types/workspace';
import { WorkspaceBoardsProvider } from '../src/board/WorkspaceBoardsProvider';
import { useWorkspaceBoards } from '../src/board/useWorkspaceBoards';
import { useBoard } from '../src/board/useBoard';
import type { BoardController } from '../src/board/types';

const request = vi.mocked(apiRequest);
const workspaces: Workspace[] = [
  { id: 'personal', name: 'Personal', kind: 'personal', role: 'owner' },
  { id: 'team', name: 'Studio', kind: 'team', role: 'member' },
];
const original: Board = {
  revision: 1,
  columns: defaultColumns(),
  tasks: [
    {
      id: 'task',
      title: 'Original',
      description: '',
      status: 'todo',
      priority: 'medium',
      startedAt: null,
      dueDate: null,
      expectedFinishAt: null,
    },
  ],
};
function wrapper({ children }: { children: ReactNode }) {
  return (
    <WorkspaceBoardsProvider userId="account" workspaces={workspaces}>
      {children}
    </WorkspaceBoardsProvider>
  );
}
beforeEach(() => {
  request.mockReset();
  localStorage.clear();
});

it('shares a single board between dashboard and board consumers and publishes successful saves to both', async () => {
  request.mockImplementation(async (_path, options) =>
    options?.method === 'PUT'
      ? { ...JSON.parse(String(options.body)), revision: 2 }
      : original
  );
  const hook = renderHook(
    () => ({ overview: useWorkspaceBoards(), board: useBoard('personal') }),
    { wrapper }
  );
  await waitFor(() =>
    expect(
      hook.result.current.overview.entries.every(
        ({ storage }) => storage.available
      )
    ).toBe(true)
  );
  expect(request).toHaveBeenCalledTimes(2);
  expect(hook.result.current.overview.entries[0].storage).toBe(
    hook.result.current.board
  );
  await act(() =>
    hook.result.current.board.change((board) => ({
      ...board,
      tasks: [{ ...board.tasks[0], title: 'Saved title' }],
    }))
  );
  expect(
    hook.result.current.overview.entries[0].storage.board.tasks[0].title
  ).toBe('Saved title');
  expect(request.mock.calls.at(-1)?.[1]?.workspaceId).toBe('personal');
  expect(localStorage.getItem(GUEST_KEY)).toBeNull();
});

it('retains pending saves when a board view unmounts and remounts within the same account shell', async () => {
  request.mockResolvedValue(original);
  let controller: BoardController | undefined;
  function BoardView() {
    const storage = useBoard('personal');
    useEffect(() => {
      controller = storage;
    }, [storage]);
    return <p>{storage.pending ? 'Pending board' : 'Saved board'}</p>;
  }
  function Overview() {
    const { hasPending } = useWorkspaceBoards();
    return <p>{hasPending ? 'Pending overview' : 'Saved overview'}</p>;
  }
  const page = render(wrapper({ children: <BoardView /> }));
  await waitFor(() => expect(controller?.available).toBe(true));
  request.mockRejectedValueOnce(new ApiError('Offline', 0));
  await act(async () => {
    await expect(
      controller!.change((board) => ({ ...board, tasks: [] }))
    ).rejects.toThrow('Offline');
  });
  page.rerender(wrapper({ children: <Overview /> }));
  expect(screen.getByText('Pending overview')).toBeInTheDocument();
  page.rerender(wrapper({ children: <BoardView /> }));
  expect(screen.getByText('Pending board')).toBeInTheDocument();
  expect(request).toHaveBeenCalledTimes(3);
  const warning = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(warning);
  expect(warning.defaultPrevented).toBe(true);
});

it('never submits or replaces a pending draft when refreshing the overview', async () => {
  request.mockResolvedValue(original);
  const hook = renderHook(
    () => ({ overview: useWorkspaceBoards(), board: useBoard('personal') }),
    { wrapper }
  );
  await waitFor(() =>
    expect(
      hook.result.current.overview.entries.every(
        ({ storage }) => storage.available
      )
    ).toBe(true)
  );
  request.mockRejectedValueOnce(new ApiError('Offline', 0));
  await act(async () => {
    await expect(
      hook.result.current.board.change((board) => ({ ...board, tasks: [] }))
    ).rejects.toThrow();
  });
  const pending = hook.result.current.board.pending;
  const writesBefore = request.mock.calls.filter(
    ([, options]) => options?.method === 'PUT'
  ).length;
  await act(() => hook.result.current.overview.refresh());
  expect(hook.result.current.board.pending).toBe(pending);
  expect(hook.result.current.board.board).toEqual(original);
  expect(
    request.mock.calls.filter(([, options]) => options?.method === 'PUT')
  ).toHaveLength(writesBefore);
  request.mockResolvedValueOnce({ ...pending!, revision: 2 });
  await act(() => hook.result.current.board.retry());
  expect(hook.result.current.board.pending).toBeNull();
});

it('limits both initial and repeated dashboard refreshes to three concurrent GETs', async () => {
  let active = 0;
  let maximum = 0;
  const many: Workspace[] = Array.from({ length: 7 }, (_, index) => ({
    ...workspaces[0],
    id: `workspace-${index}`,
  }));
  request.mockImplementation(async () => {
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return original;
  });
  const hook = renderHook(useWorkspaceBoards, {
    wrapper: ({ children }) => (
      <WorkspaceBoardsProvider userId="account" workspaces={many}>
        {children}
      </WorkspaceBoardsProvider>
    ),
  });
  await waitFor(() =>
    expect(
      hook.result.current.entries.every(({ storage }) => storage.available)
    ).toBe(true)
  );
  await act(async () => {
    await Promise.all([
      hook.result.current.refresh(),
      hook.result.current.refresh(),
    ]);
  });
  expect(maximum).toBe(3);
  expect(request).toHaveBeenCalledTimes(14);
});

it('marks failed GETs unavailable and clears inaccessible task data before an explicit retry', async () => {
  request.mockResolvedValue(original);
  const hook = renderHook(() => useBoard('personal'), { wrapper });
  await waitFor(() => expect(hook.result.current.available).toBe(true));
  request.mockRejectedValueOnce(new ApiError('Permission denied', 403));
  await act(() => hook.result.current.refresh());
  expect(hook.result.current.available).toBe(false);
  expect(hook.result.current.board.tasks).toEqual([]);
  expect(hook.result.current.error).toBe('Permission denied');
  await act(() => hook.result.current.refresh());
  expect(hook.result.current.available).toBe(true);
  expect(hook.result.current.board.tasks[0].title).toBe('Original');
});

it('aborts old account reads and ignores responses that arrive after an account change', async () => {
  let finishOld: (board: Board) => void = () => {};
  let previousSignal: AbortSignal | null | undefined;
  request.mockImplementationOnce((_path, options) => {
    previousSignal = options?.signal;
    return new Promise((resolve) => {
      finishOld = resolve;
    });
  });
  request.mockResolvedValue({
    ...original,
    tasks: [{ ...original.tasks[0], title: 'New account' }],
  });
  const one = [workspaces[0]];
  function Tasks() {
    const { entries } = useWorkspaceBoards();
    return <p>{entries[0].storage.board.tasks[0]?.title ?? 'Loading'}</p>;
  }
  const page = render(
    <WorkspaceBoardsProvider userId="old" workspaces={one}>
      <Tasks />
    </WorkspaceBoardsProvider>
  );
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  page.rerender(
    <WorkspaceBoardsProvider userId="new" workspaces={one}>
      <Tasks />
    </WorkspaceBoardsProvider>
  );
  expect(await screen.findByText('New account')).toBeInTheDocument();
  expect(previousSignal?.aborted).toBe(true);
  await act(async () => finishOld(original));
  expect(screen.queryByText('Original')).not.toBeInTheDocument();
});

it('publishes a conflict-resolution revision after saving a rebased draft', async () => {
  request.mockResolvedValue(original);
  const hook = renderHook(() => useBoard('personal'), { wrapper });
  await waitFor(() => expect(hook.result.current.available).toBe(true));
  request
    .mockRejectedValueOnce(new ApiError('Conflict', 409))
    .mockResolvedValueOnce({
      ...original,
      revision: 2,
      tasks: [{ ...original.tasks[0], description: 'Other device' }],
    });
  await act(async () => {
    await expect(
      hook.result.current.change((board) => ({
        ...board,
        tasks: [{ ...board.tasks[0], title: 'My title' }],
      }))
    ).rejects.toThrow();
  });
  request.mockImplementationOnce(async (_path, options) => ({
    ...JSON.parse(String(options?.body)),
    revision: 3,
  }));
  await act(() => hook.result.current.applyDraft());
  expect(hook.result.current.resolution).toBe(1);
  expect(hook.result.current.board.tasks[0]).toMatchObject({
    title: 'My title',
    description: 'Other device',
  });
});

it('survives Strict Mode effect cleanup and mounts a fresh readable session', async () => {
  request.mockResolvedValue(original);
  const hook = renderHook(useWorkspaceBoards, {
    wrapper: ({ children }) => <StrictMode>{wrapper({ children })}</StrictMode>,
  });
  await waitFor(() =>
    expect(
      hook.result.current.entries.every(({ storage }) => storage.available)
    ).toBe(true)
  );
});

it('blocks saves during a refresh and ignores that refresh after an imported snapshot replaces it', async () => {
  request.mockResolvedValue(original);
  const hook = renderHook(() => useBoard('personal'), { wrapper });
  await waitFor(() => expect(hook.result.current.available).toBe(true));
  let finishRead: (board: Board) => void = () => {};
  let signal: AbortSignal | null | undefined;
  request.mockImplementationOnce((_path, options) => {
    signal = options?.signal;
    return new Promise((resolve) => {
      finishRead = resolve;
    });
  });
  let reading = Promise.resolve();
  act(() => {
    reading = hook.result.current.refresh();
  });
  await waitFor(() => expect(request).toHaveBeenCalledTimes(3));
  await act(async () => {
    await expect(hook.result.current.persist(original)).rejects.toThrow(
      'finish loading'
    );
  });
  const imported = {
    ...original,
    revision: 2,
    tasks: [{ ...original.tasks[0], title: 'Imported' }],
  };
  act(() => hook.result.current.replace(imported));
  expect(signal?.aborted).toBe(true);
  await act(async () => {
    finishRead(original);
    await reading;
  });
  expect(hook.result.current.board).toEqual(imported);
  expect(hook.result.current.loading).toBe(false);
  expect(
    request.mock.calls.some(([, options]) => options?.method === 'PUT')
  ).toBe(false);
});

it('redacts stored tasks and proposals if membership is revoked during a conflict read', async () => {
  request.mockResolvedValue(original);
  const hook = renderHook(() => useBoard('personal'), { wrapper });
  await waitFor(() => expect(hook.result.current.available).toBe(true));
  request
    .mockRejectedValueOnce(new ApiError('Conflict', 409))
    .mockRejectedValueOnce(new ApiError('Access revoked', 403));
  await act(async () => {
    await expect(
      hook.result.current.change((board) => ({ ...board, tasks: [] }))
    ).rejects.toThrow('Conflict');
  });
  expect(hook.result.current.available).toBe(false);
  expect(hook.result.current.board.tasks).toEqual([]);
  expect(hook.result.current.pending).toBeNull();
  expect(hook.result.current.latest).toBeNull();
  expect(hook.result.current.error).toBe('Access revoked');
});

it('discards a failed proposal without writing it and restores the latest known saved board', async () => {
  request.mockResolvedValue(original);
  const hook = renderHook(() => useBoard('personal'), { wrapper });
  await waitFor(() => expect(hook.result.current.available).toBe(true));
  request.mockRejectedValueOnce(new ApiError('Offline', 0));
  await act(async () => {
    await expect(
      hook.result.current.change((board) => ({ ...board, tasks: [] }))
    ).rejects.toThrow();
  });
  const calls = request.mock.calls.length;
  act(() => hook.result.current.discardPending());
  expect(hook.result.current.pending).toBeNull();
  expect(hook.result.current.board).toEqual(original);
  expect(hook.result.current.error).toBe('');
  expect(hook.result.current.resolution).toBe(1);
  expect(request).toHaveBeenCalledTimes(calls);

  const latest = {
    ...original,
    revision: 2,
    tasks: [{ ...original.tasks[0], description: 'Saved elsewhere' }],
  };
  request
    .mockRejectedValueOnce(new ApiError('Conflict', 409))
    .mockResolvedValueOnce(latest);
  await act(async () => {
    await expect(
      hook.result.current.change((board) => ({ ...board, tasks: [] }))
    ).rejects.toThrow();
  });
  act(() => hook.result.current.discardPending());
  expect(hook.result.current.board).toEqual(latest);
  expect(hook.result.current.latest).toBeNull();
  expect(hook.result.current.resolvedTaskIds).toEqual({});
});

it('reports recreated task IDs when applying edits after another device archived the original', async () => {
  request.mockResolvedValue(original);
  const hook = renderHook(() => useBoard('personal'), { wrapper });
  await waitFor(() => expect(hook.result.current.available).toBe(true));
  request
    .mockRejectedValueOnce(new ApiError('Conflict', 409))
    .mockResolvedValueOnce({ ...original, revision: 2, tasks: [] });
  await act(async () => {
    await expect(
      hook.result.current.change((board) => ({
        ...board,
        tasks: [{ ...board.tasks[0], title: 'Recreated' }],
      }))
    ).rejects.toThrow();
  });
  request.mockImplementationOnce(async (_path, options) => ({
    ...JSON.parse(String(options?.body)),
    revision: 3,
  }));
  await act(() => hook.result.current.applyDraft());
  const recreated = hook.result.current.board.tasks[0];
  expect(recreated.id).not.toBe(original.tasks[0].id);
  expect(hook.result.current.resolvedTaskIds).toEqual({
    [original.tasks[0].id]: recreated.id,
  });
  expect(recreated.title).toBe('Recreated');
});
