import { beforeEach, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
const fixture = vi.hoisted(() => ({
  session: null as Session | null,
  listener: undefined as
    | ((event: AuthChangeEvent, session: Session | null) => void)
    | undefined,
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
import {
  defaultColumns,
  GUEST_KEY,
  guestFingerprint,
  type GuestBoard,
} from '../src/lib/board';
function session(id: string): Session {
  return {
    access_token: `token-${id}`,
    user: { id, email: `${id}@example.com` },
  } as Session;
}
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('kanban-account-choice-v1', 'seen');
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
  fixture.session = null;
  fixture.auth.getSession.mockImplementation(async () => ({
    data: { session: fixture.session },
    error: null,
  }));
  fixture.auth.onAuthStateChange.mockImplementation((listener) => {
    fixture.listener = listener;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  fixture.auth.signOut.mockImplementation(async () => {
    fixture.session = null;
    fixture.listener?.('SIGNED_OUT', null);
    return { error: null };
  });
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});
it('finishes session checking before offering an account choice over the guest board', async () => {
  localStorage.removeItem('kanban-account-choice-v1');
  let finish!: (value: { data: { session: null }; error: null }) => void;
  fixture.auth.getSession.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  render(<App />);
  expect(screen.getByRole('status')).toHaveTextContent('Checking your session');
  expect(
    screen.queryByRole('button', { name: 'Add task' })
  ).not.toBeInTheDocument();
  await act(async () => finish({ data: { session: null }, error: null }));
  expect(
    await screen.findByRole('dialog', { name: 'Welcome to jlord.dev' })
  ).toBeInTheDocument();
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Continue as guest' }));
  expect(screen.getByRole('button', { name: 'Add task' })).toHaveFocus();
});
it.each([undefined, '', '   '])(
  'opens the guest board without API requests when the stored session token is %s',
  async (token) => {
    fixture.session = { ...session('a'), access_token: token } as Session;
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    render(<App />);
    expect(
      await screen.findByRole('button', { name: 'Log in' })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'Add task' })[0]
    ).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  }
);

it('selects the personal workspace, ignores old-account responses, and clears the board on sign-out', async () => {
  localStorage.removeItem('kanban-account-choice-v1');
  const guest: GuestBoard = {
    version: 1,
    deviceId: crypto.randomUUID(),
    revision: 0,
    columns: defaultColumns(),
    tasks: [
      {
        id: 'local-task',
        title: 'Original guest work',
        description: '',
        status: 'todo',
        priority: 'medium',
        startedAt: null,
        dueDate: null,
        expectedFinishAt: null,
      },
    ],
  };
  localStorage.setItem(GUEST_KEY, JSON.stringify(guest));
  localStorage.setItem(
    'kanban-copy-dismissed-personal-a',
    guestFingerprint(guest)
  );
  localStorage.setItem(
    'kanban-copy-dismissed-personal-b',
    guestFingerprint(guest)
  );
  fixture.session = session('a');
  let finishOld!: (response: Response) => void;
  const requests: { path: string; workspace: string | null }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      const account =
        headers.get('Authorization') === 'Bearer token-b' ? 'b' : 'a';
      requests.push({ path: url, workspace: headers.get('x-workspace-id') });
      if (url.endsWith('/api/me'))
        return Response.json({
          user: { id: account },
          workspaces: [
            { id: 'unselected-team', kind: 'team', role: 'member' },
            { id: `personal-${account}`, kind: 'personal', role: 'owner' },
          ],
        });
      if (account === 'a')
        return new Promise<Response>((resolve) => {
          finishOld = resolve;
        });
      return Response.json({
        revision: 0,
        columns: defaultColumns(),
        tasks: [
          {
            id: 'task-b',
            title: 'B private task',
            description: '',
            status: 'todo',
            priority: 'medium',
            startedAt: null,
            dueDate: null,
            expectedFinishAt: null,
          },
        ],
      });
    })
  );
  render(<App />);
  await waitFor(() => expect(finishOld).toBeDefined());
  expect(requests.some((request) => request.workspace === 'personal-a')).toBe(
    true
  );
  await act(async () => {
    fixture.session = session('b');
    fixture.listener?.('SIGNED_IN', fixture.session);
  });
  expect(await screen.findByText('B private task')).toBeInTheDocument();
  expect(
    screen.queryByRole('dialog', { name: 'Welcome to jlord.dev' })
  ).not.toBeInTheDocument();
  await act(async () =>
    finishOld(
      Response.json([{ id: 'old', title: 'A private task', status: 'todo' }])
    )
  );
  expect(screen.queryByText('A private task')).not.toBeInTheDocument();
  expect(requests.some((request) => request.workspace === 'personal-b')).toBe(
    true
  );
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Sign out' }));
  expect(
    await screen.findByRole('button', { name: 'Log in' })
  ).toBeInTheDocument();
  expect(screen.queryByText('B private task')).not.toBeInTheDocument();
  expect(screen.getByText('Original guest work')).toBeInTheDocument();
});
it('offers retry when the authenticated backend is unavailable', async () => {
  fixture.session = session('a');
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ message: 'Service unavailable' }, { status: 503 })
      )
  );
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Service unavailable'
  );
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Add task' })
  ).not.toBeInTheDocument();
});

it('keeps a task visible when archiving fails', async () => {
  fixture.session = session('b');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input, init) => {
      if (String(input).endsWith('/api/me'))
        return Response.json({
          user: { id: 'b' },
          workspaces: [{ id: 'personal-b', kind: 'personal', role: 'owner' }],
        });
      if (init?.method === 'PUT')
        return Response.json(
          { message: 'Archive unavailable' },
          { status: 503 }
        );
      return Response.json({
        revision: 0,
        columns: defaultColumns(),
        tasks: [
          {
            id: 'task-b',
            title: 'Keep this task',
            description: '',
            status: 'todo',
            priority: 'medium',
            startedAt: null,
            dueDate: null,
            expectedFinishAt: null,
          },
        ],
      });
    })
  );
  render(<App />);
  expect(await screen.findByText('Keep this task')).toBeInTheDocument();
  const user = userEvent.setup();
  await user.click(
    screen.getByRole('button', { name: 'Actions for Keep this task' })
  );
  await user.click(screen.getByRole('menuitem', { name: 'Archive task' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Archive unavailable'
  );
  expect(screen.getByText('Keep this task')).toBeInTheDocument();
});

it('returns to the guest board when the backend rejects an expired token', async () => {
  localStorage.removeItem('kanban-account-choice-v1');
  fixture.session = session('a');
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(Response.json({}, { status: 401 }))
  );
  render(<App />);
  expect(
    await screen.findByRole('button', { name: 'Log in' })
  ).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('session expired');
  expect(
    screen.queryByRole('dialog', { name: 'Welcome to jlord.dev' })
  ).not.toBeInTheDocument();
  expect(
    screen.getAllByRole('button', { name: 'Add task' })[0]
  ).toBeInTheDocument();
});

it('preserves a valid recovery flow across a refresh in the same tab', async () => {
  fixture.session = session('a');
  sessionStorage.setItem('kanban-recovery-user', 'a');
  window.history.replaceState({}, '', '/reset-password');
  render(<App />);
  expect(await screen.findByLabelText('New password')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Add task' })
  ).not.toBeInTheDocument();
});

it('keeps guest-to-cloud copying explicit after the first-visit login choice', async () => {
  localStorage.removeItem('kanban-account-choice-v1');
  const guest = {
    version: 1,
    deviceId: crypto.randomUUID(),
    revision: 0,
    columns: defaultColumns(),
    tasks: [
      {
        id: crypto.randomUUID(),
        title: 'Local planning',
        description: '',
        status: 'todo',
        priority: 'medium',
        startedAt: null,
        dueDate: null,
        expectedFinishAt: null,
      },
    ],
  };
  localStorage.setItem(GUEST_KEY, JSON.stringify(guest));
  const fetcher = vi.fn(async (input) =>
    String(input).endsWith('/api/me')
      ? Response.json({
          user: { id: 'a' },
          workspaces: [{ id: 'personal-a', kind: 'personal', role: 'owner' }],
        })
      : Response.json({ revision: 0, columns: defaultColumns(), tasks: [] })
  );
  vi.stubGlobal('fetch', fetcher);
  render(<App />);
  const user = userEvent.setup();
  const welcome = await screen.findByRole('dialog', {
    name: 'Welcome to jlord.dev',
  });
  await user.click(within(welcome).getByRole('button', { name: 'Log in' }));
  expect(screen.getByRole('dialog', { name: 'Log in' })).toBeInTheDocument();
  await act(async () => {
    fixture.session = session('a');
    fixture.listener?.('SIGNED_IN', fixture.session);
  });
  expect(
    await screen.findByRole('dialog', { name: 'Copy device work to cloud' })
  ).toBeInTheDocument();
  expect(
    fetcher.mock.calls.every(
      ([input]) => !String(input).endsWith('/api/board/import')
    )
  ).toBe(true);
  await user.click(screen.getByRole('button', { name: 'Keep on this device' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(GUEST_KEY)!)).toEqual(guest);
});
