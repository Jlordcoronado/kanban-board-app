import { beforeEach, expect, it, vi } from 'vitest';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
vi.mock('../src/auth/client', () => ({
  supabase: null,
  initialRecovery: false,
  callbackError: null,
  authRedirect: () => '/auth/callback',
  recoveryRedirect: () => '/reset-password',
}));
import App from '../src/App';
import {
  GUEST_KEY,
  activeTasks,
  defaultColumns,
  readGuest,
  saveGuest,
  validBoard,
  type Board,
} from '../src/lib/board';
import { useBoard, rebaseBoard } from '../src/board/useBoard';
const task = {
  id: '00000000-0000-4000-8000-000000000001',
  title: 'Guest work',
  description: 'Device draft',
  status: 'todo',
  priority: 'medium' as const,
  startedAt: null,
  dueDate: null,
  expectedFinishAt: null,
};
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('kanban-account-choice-v1', 'seen');
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
  localStorage.setItem(
    GUEST_KEY,
    JSON.stringify({
      version: 1,
      deviceId: crypto.randomUUID(),
      revision: 0,
      columns: defaultColumns(),
      tasks: [],
    })
  );
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});
it('works without authentication configuration or network requests and retains tasks, stages and archives after remount', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const hook = renderHook(() => useBoard());
  await act(() =>
    hook.result.current.change((b) => ({
      ...b,
      columns: [...b.columns, { id: 'review', title: 'Review' }],
      tasks: [{ ...task, status: 'review' }],
    }))
  );
  hook.unmount();
  const restored = renderHook(() => useBoard());
  expect(restored.result.current.board.columns.at(-1)?.title).toBe('Review');
  expect(restored.result.current.board.tasks[0].status).toBe('review');
  await act(() =>
    restored.result.current.change((b) => ({
      ...b,
      columns: b.columns.filter((c) => c.id !== 'review'),
      tasks: b.tasks.map((t) => ({
        ...t,
        status: 'todo',
        archivedAt: new Date().toISOString(),
      })),
    }))
  );
  restored.unmount();
  const archived = renderHook(() => useBoard());
  expect(activeTasks(archived.result.current.board)).toHaveLength(0);
  expect(archived.result.current.board.tasks).toHaveLength(1);
  expect(archived.result.current.board.tasks[0].status).toBe('todo');
  expect(fetch).not.toHaveBeenCalled();
});
it('retains current local work when saving fails, reports failure, and retries', async () => {
  const hook = renderHook(() => useBoard());
  const setItem = vi
    .spyOn(Storage.prototype, 'setItem')
    .mockImplementation(() => {
      throw new Error('Quota exceeded');
    });
  await act(async () => {
    await expect(
      hook.result.current.change((b) => ({ ...b, tasks: [task] }))
    ).rejects.toThrow();
  });
  expect(hook.result.current.board.tasks).toHaveLength(1);
  expect(hook.result.current.status).toBe('Not saved—retry');
  expect(hook.result.current.pending?.tasks[0].title).toBe('Guest work');
  setItem.mockRestore();
  await act(() => hook.result.current.retry());
  expect(hook.result.current.status).toBe('Saved on this device');
  expect(readGuest().board.tasks).toHaveLength(1);
});
it('opens cloud access over a task draft, switches account forms, closes and restores focus without requesting AI', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  render(<App />);
  const user = userEvent.setup();
  await user.click(screen.getAllByRole('button', { name: 'Add task' })[0]);
  await user.type(screen.getByLabelText('Title'), 'Keep my draft');
  await user.type(
    screen.getByLabelText('Description'),
    'Before authentication'
  );
  const trigger = screen
    .getAllByRole('button', { name: 'Save to cloud' })
    .at(-1)!;
  await user.click(trigger);
  const account = screen.getByRole('dialog', { name: 'Log in' });
  expect(account).toHaveAttribute('open');
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Cloud access is unavailable'
  );
  await user.click(screen.getByRole('link', { name: 'Create an account' }));
  expect(screen.getByLabelText('Display name')).toBeInTheDocument();
  fireEvent(account, new Event('cancel', { cancelable: true }));
  expect(
    screen.queryByRole('dialog', { name: 'Create your account' })
  ).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  expect(screen.getByLabelText('Title')).toHaveValue('Keep my draft');
  expect(screen.getByLabelText('Description')).toHaveValue(
    'Before authentication'
  );
  expect(fetch).not.toHaveBeenCalled();
});
it('restores a device editor draft after a callback/remount without submitting it', async () => {
  const view = render(<App />);
  const user = userEvent.setup();
  await user.click(screen.getAllByRole('button', { name: 'Add task' })[0]);
  await user.type(screen.getByLabelText('Title'), 'After redirect');
  view.unmount();
  render(<App />);
  expect(screen.getByLabelText('Title')).toHaveValue('After redirect');
  expect(readGuest().board.tasks).toHaveLength(0);
});
it('validates stored records before rendering and rebases only changed fields onto newer cloud work', () => {
  const base: Board = { revision: 1, columns: defaultColumns(), tasks: [task] };
  expect(validBoard({ ...base, tasks: [{ ...task, status: 'lost' }] })).toBe(
    false
  );
  expect(
    validBoard({ ...base, tasks: [{ ...task, priority: 'critical' }] })
  ).toBe(false);
  const latest = {
    ...base,
    revision: 2,
    tasks: [
      { ...task, description: 'Other device change' },
      { ...task, id: 'other', title: 'New cloud work' },
    ],
  };
  const result = rebaseBoard(
    base,
    { ...base, tasks: [{ ...task, title: 'My new title' }] },
    latest
  );
  expect(result.revision).toBe(2);
  expect(result.tasks[0]).toMatchObject({
    title: 'My new title',
    description: 'Other device change',
  });
  expect(result.tasks[1].title).toBe('New cloud work');
  saveGuest(base);
});

it('explicit reapplication recreates a task archived elsewhere and prevents a merge with no remaining columns', () => {
  const base: Board = { revision: 1, columns: defaultColumns(), tasks: [task] };
  const draft = { ...base, tasks: [{ ...task, title: 'Keep my edited work' }] };
  const result = rebaseBoard(base, draft, { ...base, revision: 2, tasks: [] });
  expect(result.tasks[0].title).toBe('Keep my edited work');
  expect(result.tasks[0].id).not.toBe(task.id);
  const twoColumns = { ...base, columns: base.columns.slice(0, 2), tasks: [] };
  expect(() =>
    rebaseBoard(
      twoColumns,
      { ...twoColumns, columns: [twoColumns.columns[1]] },
      { ...twoColumns, columns: [twoColumns.columns[0]], revision: 2 }
    )
  ).toThrow('Both devices removed different columns');
});

it('opens saved tasks as details, edits directly from the menu, and keeps saved details open', async () => {
  saveGuest({ revision: 0, columns: defaultColumns(), tasks: [task] });
  render(<App />);
  const user = userEvent.setup();
  const title = screen.getByRole('button', { name: task.title, exact: true });
  await user.click(title);
  expect(
    screen.getByRole('dialog', { name: 'Task details' })
  ).toBeInTheDocument();
  expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  expect(localStorage.getItem('kanban-guest-editor-v1')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Close', exact: true }));
  expect(title).toHaveFocus();
  const actions = screen.getByRole('button', {
    name: `Actions for ${task.title}`,
  });
  await user.click(actions);
  await user.click(screen.getByRole('menuitem', { name: 'Edit task' }));
  expect(screen.getByRole('dialog', { name: 'Edit task' })).toBeInTheDocument();
  expect(screen.getByLabelText('Title')).toHaveFocus();
  await user.clear(screen.getByLabelText('Title'));
  await user.type(screen.getByLabelText('Title'), 'Updated guest work');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(
    screen.getByRole('dialog', { name: 'Task details' })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: 'Updated guest work' })
  ).toBeInTheDocument();
  expect(readGuest().board.tasks[0].title).toBe('Updated guest work');
  expect(localStorage.getItem('kanban-guest-editor-v1')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Close', exact: true }));
  expect(actions).toHaveFocus();
});

it('restores an existing editor draft against saved details and clears it when discarded', async () => {
  saveGuest({ revision: 0, columns: defaultColumns(), tasks: [task] });
  localStorage.setItem(
    'kanban-guest-editor-v1',
    JSON.stringify({ ...task, title: 'Recovered edit' })
  );
  render(<App />);
  const user = userEvent.setup();
  expect(screen.getByLabelText('Title')).toHaveValue('Recovered edit');
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await user.click(screen.getByRole('button', { name: 'Discard changes' }));
  expect(screen.getByRole('heading', { name: task.title })).toBeInTheDocument();
  expect(localStorage.getItem('kanban-guest-editor-v1')).toBeNull();
  expect(readGuest().board.tasks[0].title).toBe(task.title);
});

it('creates a new task directly and restores the Add task trigger', async () => {
  render(<App />);
  const user = userEvent.setup();
  const add = screen.getByRole('button', { name: 'Add task', exact: true });
  await user.click(add);
  await user.type(
    screen.getByLabelText('Title'),
    'Create without confirmation'
  );
  await user.click(screen.getByRole('button', { name: 'Create task' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(readGuest().board.tasks[0].title).toBe('Create without confirmation');
  expect(add).toHaveFocus();
});

it('keeps a restored new-task draft protected on cancellation', async () => {
  localStorage.setItem(
    'kanban-guest-editor-v1',
    JSON.stringify({ ...task, id: '', title: 'Recovered new task' })
  );
  render(<App />);
  const user = userEvent.setup();
  expect(screen.getByLabelText('Title')).toHaveValue('Recovered new task');
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(
    screen.getByRole('dialog', { name: 'Discard changes?' })
  ).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Keep editing' }));
  expect(screen.getByLabelText('Title')).toHaveValue('Recovered new task');
});

it('keeps a guest editor and its draft through Gemini sign-in and account dismissal', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  render(<App />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Add task', exact: true }));
  await user.type(screen.getByLabelText('Title'), 'Keep my Gemini draft');
  await user.type(screen.getByLabelText('Description'), 'My original description');
  await user.click(screen.getByRole('button', { name: 'Help write description' }));
  expect(fetch).not.toHaveBeenCalled();
  const trigger = screen.getByRole('button', { name: 'Sign in to use Gemini' });
  await user.click(trigger);
  const account = screen.getByRole('dialog', { name: 'Log in' });
  expect(account).toHaveAttribute('open');
  fireEvent(account, new Event('cancel', { cancelable: true }));
  expect(screen.getByRole('dialog', { name: 'New task' })).toHaveAttribute('open');
  expect(trigger).toHaveFocus();
  expect(screen.getByLabelText('Title')).toHaveValue('Keep my Gemini draft');
  expect(screen.getByLabelText('Description')).toHaveValue('My original description');
  expect(fetch).not.toHaveBeenCalled();
});
