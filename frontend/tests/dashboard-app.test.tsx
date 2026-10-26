import { beforeEach, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Session } from '@supabase/supabase-js';
import type { Board } from '../src/lib/board';
import type { Task } from '../src/types/task';
import type { Workspace } from '../src/types/workspace';

const fixture = vi.hoisted(() => ({
  session: null as Session | null,
  auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(), signOut: vi.fn() },
}));
vi.mock('../src/auth/client', () => ({
  supabase: { auth: fixture.auth },
  initialRecovery: false,
  callbackError: null,
  authRedirect: () => '/auth/callback',
  recoveryRedirect: () => '/reset-password',
}));
import App from '../src/App';
import { defaultColumns } from '../src/lib/board';
import { addCalendarDays, localCalendarDate } from '../src/lib/dashboard';

const personal: Workspace = {
  id: 'personal-one',
  name: 'Personal',
  kind: 'personal',
  role: 'owner',
};
const team: Workspace = {
  id: 'team-one',
  name: 'Studio team',
  kind: 'team',
  role: 'member',
};
const makeTask = (id: string, title: string): Task => ({
  id,
  title,
  description: `${title} description`,
  status: 'todo',
  priority: 'medium',
  startedAt: null,
  dueDate: addCalendarDays(localCalendarDate(), -1),
  expectedFinishAt: null,
});
let boards: Record<string, Board>;
let requests: {
  path: string;
  workspace: string | null;
  method: string;
  body?: Board;
}[];
let failNextSave: boolean;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('kanban-account-choice-v1', 'seen');
  window.history.replaceState({}, '', '/dashboard');
  fixture.session = {
    access_token: 'test-session-only',
    user: { id: 'one', email: 'one@example.com' },
  } as Session;
  fixture.auth.getSession.mockImplementation(async () => ({
    data: { session: fixture.session },
    error: null,
  }));
  fixture.auth.onAuthStateChange.mockImplementation(() => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  }));
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  boards = {
    [personal.id]: {
      revision: 1,
      columns: defaultColumns(),
      tasks: [makeTask('private-task', 'Private planning')],
    },
    [team.id]: {
      revision: 2,
      columns: defaultColumns(),
      tasks: [makeTask('team-task', 'Shared delivery')],
    },
  };
  requests = [];
  failNextSave = false;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input, init) => {
      const path = new URL(String(input)).pathname;
      const workspace = new Headers(init?.headers).get('x-workspace-id');
      const method = init?.method ?? 'GET';
      const body = init?.body
        ? (JSON.parse(String(init.body)) as Board)
        : undefined;
      requests.push({ path, workspace, method, body });
      if (path === '/api/me')
        return Response.json({
          user: { id: 'one', email: 'one@example.com' },
          workspaces: [personal, team],
        });
      if (!workspace || !boards[workspace])
        return Response.json({ message: 'Access denied' }, { status: 403 });
      if (method === 'PUT') {
        if (failNextSave) {
          failNextSave = false;
          return Response.json(
            { message: 'Temporary save failure' },
            { status: 503 }
          );
        }
        if (body!.revision !== boards[workspace].revision)
          return Response.json({ message: 'Board changed' }, { status: 409 });
        boards[workspace] = { ...body!, revision: body!.revision + 1 };
      }
      return Response.json(boards[workspace]);
    })
  );
});

it('opens a filtered team task, saves an edit, and immediately updates dashboard counts', async () => {
  const user = userEvent.setup();
  render(<App />);
  expect(
    await screen.findByRole('button', { name: 'Overdue: 2 tasks' })
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Add task' })
  ).not.toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText('View work'), team.id);
  await user.click(
    screen.getByRole('button', {
      name: 'Open Shared delivery from Studio team',
    })
  );
  const details = screen.getByRole('dialog', { name: 'Task details' });
  expect(
    within(details).getByText('Shared delivery description')
  ).toBeInTheDocument();
  await user.click(within(details).getByRole('button', { name: 'Edit task' }));
  await user.selectOptions(screen.getByLabelText('Status'), 'done');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() =>
    expect(
      screen.getByRole('dialog', { name: 'Task details' })
    ).toBeInTheDocument()
  );
  await user.click(
    within(screen.getByRole('dialog', { name: 'Task details' })).getByRole(
      'button',
      { name: 'Close', exact: true }
    )
  );
  expect(
    screen.getByRole('button', { name: 'Overdue: 0 tasks' })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Done: 1 tasks' })
  ).toBeInTheDocument();
  const writes = requests.filter((request) => request.method === 'PUT');
  expect(writes).toHaveLength(1);
  expect(writes[0].workspace).toBe(team.id);
  expect(writes[0].body?.tasks.map((task) => task.id)).toEqual(['team-task']);
  expect(boards[personal.id].tasks[0].status).toBe('todo');
});

it('opens the homepage for an authenticated visitor without loading any workspaces or boards', async () => {
  window.history.replaceState({}, '', '/');
  render(<App />);
  await waitFor(() =>
    expect(
      screen.getByRole('heading', { name: /I build full-stack applications/ })
    ).toBeInTheDocument()
  );
  await waitFor(() => expect(fixture.auth.getSession).toHaveBeenCalled());
  expect(requests).toHaveLength(0);
  await userEvent
    .setup()
    .click(screen.getByRole('link', { name: 'Explore Kanban Desk' }));
  expect(
    await screen.findByRole('heading', { name: 'Dashboard', exact: true })
  ).toBeInTheDocument();
  expect(window.location.pathname).toBe('/dashboard');
  expect(requests.filter(({ path }) => path === '/api/me')).toHaveLength(1);
});

it.each(['/dashboard/', '/DASHBOARD'])(
  'preserves the router matching behavior for %s',
  async (path) => {
    window.history.replaceState({}, '', path);
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: 'Dashboard', exact: true })
    ).toBeInTheDocument();
  }
);

it('keeps an unrelated pending board save and unload protection across public/app navigation without rereading boards', async () => {
  render(<App />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('link', { name: 'Personal board' }));
  await user.click(screen.getByRole('button', { name: 'Add column' }));
  await user.type(screen.getByLabelText('Column Name'), 'Review');
  failNextSave = true;
  await user.click(
    within(screen.getByRole('dialog', { name: 'Add New Column' })).getByRole(
      'button',
      { name: 'Add Column', exact: true }
    )
  );
  await screen.findByText('Temporary save failure');
  // A failed column save lives in the account store, independently of editors.
  const reads = requests.filter(({ method }) => method === 'GET').length;
  await user.click(screen.getByRole('link', { name: 'Personal website' }));
  expect(
    await screen.findByRole('heading', {
      name: /I build full-stack applications/,
    })
  ).toBeInTheDocument();
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(requests.filter(({ method }) => method === 'GET')).toHaveLength(reads);
  await user.click(screen.getByRole('link', { name: 'Explore Kanban Desk' }));
  expect(
    await screen.findByText('Unsaved changes in Personal.')
  ).toBeInTheDocument();
  expect(requests.filter(({ method }) => method === 'GET')).toHaveLength(reads);
  await user.click(screen.getByRole('link', { name: 'Review pending save' }));
  expect(screen.getByText('Temporary save failure')).toBeInTheDocument();
});

it('keeps Personal private, opens the team board, and hides manager-only bulk archive from members', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('button', { name: 'Open: 2 tasks' });
  await user.click(screen.getByRole('link', { name: 'Personal board' }));
  expect(
    await screen.findByRole('heading', { name: 'Personal board' })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Private planning', exact: true })
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Shared delivery', exact: true })
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Archive all', exact: true })
  ).toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: 'Studio team, member' }));
  expect(
    await screen.findByRole('heading', { name: 'Studio team' })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Shared delivery', exact: true })
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Private planning', exact: true })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Archive all', exact: true })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Copy device work to cloud' })
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole('link', { name: 'Dashboard', exact: true })
  );
  expect(
    await screen.findByRole('button', { name: 'Open: 2 tasks' })
  ).toBeInTheDocument();
  expect(
    requests.filter(
      (request) => request.path === '/api/board' && request.method === 'GET'
    )
  ).toHaveLength(2);
});

it('retains a failed editor draft and retries only after another explicit Save changes', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(
    await screen.findByRole('button', {
      name: 'Open Shared delivery from Studio team',
    })
  );
  await user.click(screen.getByRole('button', { name: 'Edit task' }));
  await user.clear(screen.getByLabelText('Title'));
  await user.type(screen.getByLabelText('Title'), 'Retained draft title');
  failNextSave = true;
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Unable to save this task'
  );
  expect(screen.getByLabelText('Title')).toHaveValue('Retained draft title');
  expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(
    1
  );
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  const details = await screen.findByRole('dialog', { name: 'Task details' });
  expect(
    within(details).getByRole('heading', { name: 'Retained draft title' })
  ).toBeInTheDocument();
  expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(
    2
  );
  expect(boards[team.id].tasks[0].title).toBe('Retained draft title');
});

it('rejects a direct URL for a workspace outside the account without requesting its board', async () => {
  window.history.replaceState({}, '', '/boards/another-users-board');
  render(<App />);
  expect(
    await screen.findByRole('heading', { name: 'Board unavailable' })
  ).toBeInTheDocument();
  expect(
    screen.getByText('You do not have access to this board.')
  ).toBeInTheDocument();
  expect(
    requests.every((request) => request.workspace !== 'another-users-board')
  ).toBe(true);
});

it('keeps dashboard access signed-in only and returns guests to the public homepage', async () => {
  fixture.session = null;
  window.history.replaceState({}, '', '/dashboard');
  render(<App />);
  expect(
    await screen.findByRole('link', { name: 'Explore Kanban Desk' })
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Add task' })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('heading', { name: 'Dashboard', exact: true })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('complementary', { name: 'Sidebar' })
  ).not.toBeInTheDocument();
  expect(requests).toHaveLength(0);
});

it('discards only its failed task proposal before saving another task', async () => {
  boards[team.id].tasks.push(makeTask('second-team-task', 'Second team task'));
  const user = userEvent.setup();
  render(<App />);
  await user.click(
    await screen.findByRole('button', {
      name: 'Open Shared delivery from Studio team',
    })
  );
  await user.click(screen.getByRole('button', { name: 'Edit task' }));
  await user.clear(screen.getByLabelText('Title'));
  await user.type(screen.getByLabelText('Title'), 'Failed first-task draft');
  failNextSave = true;
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Unable to save this task'
  );
  await user.click(screen.getByRole('button', { name: 'Close task dialog' }));
  await user.click(
    within(screen.getByRole('dialog', { name: 'Discard changes?' })).getByRole(
      'button',
      { name: 'Discard changes' }
    )
  );
  expect(
    screen.queryByRole('link', { name: 'Review pending save' })
  ).not.toBeInTheDocument();

  await user.click(
    screen.getByRole('button', {
      name: 'Open Second team task from Studio team',
    })
  );
  await user.click(screen.getByRole('button', { name: 'Edit task' }));
  await user.clear(screen.getByLabelText('Title'));
  await user.type(screen.getByLabelText('Title'), 'Second-task draft');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  const secondDetails = await screen.findByRole('dialog', {
    name: 'Task details',
  });
  expect(
    within(secondDetails).getByRole('heading', { name: 'Second-task draft' })
  ).toBeInTheDocument();
  await user.click(
    within(secondDetails).getByRole('button', { name: 'Edit task' })
  );
  await user.clear(screen.getByLabelText('Title'));
  await user.type(screen.getByLabelText('Title'), 'Second-task saved again');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  await screen.findByRole('dialog', { name: 'Task details' });
  const writes = requests.filter((request) => request.method === 'PUT');
  expect(writes).toHaveLength(3);
  expect(writes[0].body?.tasks.map((task) => task.title)).toEqual([
    'Failed first-task draft',
    'Second team task',
  ]);
  expect(writes[1].body?.tasks.map((task) => task.title)).toEqual([
    'Shared delivery',
    'Second-task draft',
  ]);
  expect(writes[2].body?.tasks.map((task) => task.title)).toEqual([
    'Shared delivery',
    'Second-task saved again',
  ]);
  expect(boards[team.id].tasks.map((task) => task.title)).toEqual([
    'Shared delivery',
    'Second-task saved again',
  ]);
});

it('reopens merged cloud values after conflict resolution and preserves them on the next edit', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(
    await screen.findByRole('button', {
      name: 'Open Shared delivery from Studio team',
    })
  );
  await user.click(screen.getByRole('button', { name: 'Edit task' }));
  await user.clear(screen.getByLabelText('Title'));
  await user.type(screen.getByLabelText('Title'), 'My task title');
  boards[team.id] = {
    ...boards[team.id],
    revision: boards[team.id].revision + 1,
    tasks: boards[team.id].tasks.map((task) => ({
      ...task,
      description: 'Description from another device',
    })),
  };
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  let conflict = await screen.findByRole('dialog', {
    name: 'Cloud save conflict',
  });
  expect(
    within(conflict).getByText('Description from another device')
  ).toBeInTheDocument();
  await user.click(
    within(conflict).getByRole('button', { name: 'Close', exact: true })
  );
  const editor = screen.getByRole('dialog', { name: 'Edit task' });
  await user.click(
    within(editor).getByRole('button', { name: 'Review cloud conflict' })
  );
  conflict = await screen.findByRole('dialog', { name: 'Cloud save conflict' });
  await user.click(
    within(conflict).getByRole('button', {
      name: 'Apply draft against latest revision',
    })
  );
  const details = await screen.findByRole('dialog', { name: 'Task details' });
  expect(
    within(details).getByRole('heading', { name: 'My task title' })
  ).toBeInTheDocument();
  expect(
    within(details).getByText('Description from another device')
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('dialog', { name: 'Cloud save conflict' })
  ).not.toBeInTheDocument();

  await user.click(within(details).getByRole('button', { name: 'Edit task' }));
  expect(screen.getByLabelText('Description')).toHaveValue(
    'Description from another device'
  );
  await user.clear(screen.getByLabelText('Title'));
  await user.type(screen.getByLabelText('Title'), 'My second task title');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  await screen.findByRole('dialog', { name: 'Task details' });
  expect(boards[team.id].tasks[0]).toMatchObject({
    title: 'My second task title',
    description: 'Description from another device',
  });
  const writes = requests.filter((request) => request.method === 'PUT');
  expect(writes).toHaveLength(3);
  expect(writes[2].body?.tasks[0].description).toBe(
    'Description from another device'
  );
});

it('waits for an in-flight board read before exposing a task editor', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('button', { name: 'Open: 2 tasks' });
  const originalFetch = vi.mocked(fetch).getMockImplementation()!;
  let finishRead!: (response: Response) => void;
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    if (
      new URL(String(input)).pathname === '/api/board' &&
      new Headers(init?.headers).get('x-workspace-id') === team.id &&
      (init?.method ?? 'GET') === 'GET'
    )
      return new Promise<Response>((resolve) => {
        finishRead = resolve;
      });
    return originalFetch(input, init);
  });
  await user.click(screen.getByRole('button', { name: 'Refresh' }));
  await waitFor(() => expect(finishRead).toBeDefined());
  await user.click(
    screen.getByRole('button', {
      name: 'Open Shared delivery from Studio team',
    })
  );
  expect(
    screen.queryByRole('button', { name: 'Edit task' })
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  const fresh = {
    ...boards[team.id],
    revision: boards[team.id].revision + 1,
    tasks: boards[team.id].tasks.map((task) => ({
      ...task,
      description: 'Refreshed before editing',
    })),
  };
  await act(async () => finishRead(Response.json(fresh)));
  const details = await screen.findByRole('dialog', { name: 'Task details' });
  expect(
    within(details).getByText('Refreshed before editing')
  ).toBeInTheDocument();
  await user.click(within(details).getByRole('button', { name: 'Edit task' }));
  expect(screen.getByLabelText('Description')).toHaveValue(
    'Refreshed before editing'
  );
  expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(
    0
  );
});

it('cannot submit or discard an unrelated pending column change through a task editor', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('link', { name: 'Personal board' }));
  await user.click(
    await screen.findByRole('button', { name: 'Actions for column To Do' })
  );
  await user.click(screen.getByRole('menuitem', { name: 'Rename column' }));
  await user.clear(screen.getByLabelText('Column name for To Do'));
  await user.type(
    screen.getByLabelText('Column name for To Do'),
    'Pending column name'
  );
  failNextSave = true;
  await user.keyboard('{Enter}');
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Temporary save failure'
  );
  await user.click(
    screen.getByRole('link', { name: 'Dashboard', exact: true })
  );
  expect(
    screen.getByRole('link', { name: 'Review pending save' })
  ).toBeInTheDocument();
  await user.click(
    screen.getByRole('button', { name: 'Open Private planning from Personal' })
  );
  await user.click(screen.getByRole('button', { name: 'Edit task' }));
  await user.clear(screen.getByLabelText('Title'));
  await user.type(screen.getByLabelText('Title'), 'Blocked task draft');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Unable to save this task'
  );
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(
    1
  );
  expect(boards[personal.id].columns[0].title).toBe('To Do');
  expect(boards[personal.id].tasks[0].title).toBe('Private planning');
  await user.click(screen.getByRole('button', { name: 'Close task dialog' }));
  await user.click(
    within(screen.getByRole('dialog', { name: 'Discard changes?' })).getByRole(
      'button',
      { name: 'Discard changes' }
    )
  );
  expect(
    screen.getByRole('link', { name: 'Review pending save' })
  ).toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: 'Account settings' }));
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  await user.click(screen.getByRole('link', { name: 'Reset password' }));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(window.location.pathname).toBe('/account');
  expect(
    screen.getByRole('heading', { name: 'Account settings' })
  ).toBeInTheDocument();
  confirm.mockReturnValue(true);
  await user.click(screen.getByRole('link', { name: 'Reset password' }));
  expect(
    await screen.findByRole('heading', { name: 'Reset your password' })
  ).toBeInTheDocument();
  expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(
    1
  );
});

it('protects a dirty board editor from browser Back and discards it only after confirmation', async () => {
  const user = userEvent.setup();
  render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  await screen.findByRole('heading', { name: 'Dashboard', exact: true });
  await user.click(screen.getByRole('link', { name: 'Personal board' }));
  await user.click(
    await screen.findByRole('button', { name: 'Private planning', exact: true })
  );
  await user.click(screen.getByRole('button', { name: 'Edit task' }));
  await user.clear(screen.getByLabelText('Title'));
  await user.type(
    screen.getByLabelText('Title'),
    'Draft kept while navigating'
  );

  await act(async () => {
    window.history.back();
  });
  const firstConfirmation = await screen.findByRole('dialog', {
    name: 'Discard changes?',
  });
  expect(screen.getByLabelText('Title')).toHaveValue(
    'Draft kept while navigating'
  );
  await user.click(
    within(firstConfirmation).getByRole('button', { name: 'Keep editing' })
  );
  await waitFor(() =>
    expect(window.location.pathname).toBe(`/boards/${personal.id}`)
  );
  expect(
    screen.queryByRole('dialog', { name: 'Discard changes?' })
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText('Title')).toHaveValue(
    'Draft kept while navigating'
  );

  await act(async () => {
    window.history.back();
  });
  const secondConfirmation = await screen.findByRole('dialog', {
    name: 'Discard changes?',
  });
  await user.click(
    within(secondConfirmation).getByRole('button', { name: 'Discard changes' })
  );
  expect(
    await screen.findByRole('heading', { name: 'Dashboard', exact: true })
  ).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(
    0
  );
  expect(boards[personal.id].tasks[0].title).toBe('Private planning');

  await act(async () => {
    window.history.forward();
  });
  expect(
    await screen.findByRole('heading', { name: 'Personal board', exact: true })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Private planning', exact: true })
  ).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
