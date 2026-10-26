import { beforeEach, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
vi.mock('../src/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/api')>()),
  apiRequest: vi.fn(),
}));
import { apiRequest, ApiError } from '../src/lib/api';
import { defaultColumns, GUEST_KEY, type Board } from '../src/lib/board';
import { useBoard } from '../src/board/useBoard';
const request = vi.mocked(apiRequest);
const original: Board = {
  revision: 1,
  columns: defaultColumns(),
  tasks: [
    {
      id: '00000000-0000-4000-8000-000000000001',
      title: 'Original task',
      description: '',
      status: 'todo',
      priority: 'medium',
      startedAt: null,
      dueDate: null,
      expectedFinishAt: null,
    },
  ],
};
beforeEach(() => {
  request.mockReset();
  localStorage.clear();
});
it('retains failed cloud proposals, never writes them to guest storage, warns before unload, and retries only explicitly', async () => {
  request
    .mockResolvedValueOnce(original)
    .mockRejectedValueOnce(new ApiError('Connection failed', 0));
  const hook = renderHook(() => useBoard('workspace'));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  await act(async () => {
    await expect(
      hook.result.current.change((b) => ({
        ...b,
        tasks: b.tasks.map((t) => ({ ...t, title: 'My pending edit' })),
      }))
    ).rejects.toThrow('Connection failed');
  });
  expect(hook.result.current.status).toBe('Not saved—retry');
  expect(hook.result.current.pending?.tasks[0].title).toBe('My pending edit');
  expect(hook.result.current.board.tasks[0].title).toBe('Original task');
  expect(localStorage.getItem(GUEST_KEY)).toBeNull();
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(request).toHaveBeenCalledTimes(2);
  request.mockResolvedValueOnce({
    ...hook.result.current.pending!,
    revision: 2,
  });
  await act(() => hook.result.current.retry());
  expect(hook.result.current.status).toBe('Saved to cloud');
  expect(hook.result.current.board.tasks[0].title).toBe('My pending edit');
  expect(hook.result.current.pending).toBeNull();
});
it('detects a stale revision and explicitly reapplies the draft while retaining unrelated other-device changes', async () => {
  const latest = {
    ...original,
    revision: 3,
    tasks: [{ ...original.tasks[0], description: 'Other device' }],
  };
  request
    .mockResolvedValueOnce(original)
    .mockRejectedValueOnce(new ApiError('Board changed', 409))
    .mockResolvedValueOnce(latest);
  const hook = renderHook(() => useBoard('workspace'));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  await act(async () => {
    await expect(
      hook.result.current.change((b) => ({
        ...b,
        tasks: b.tasks.map((t) => ({ ...t, title: 'My title' })),
      }))
    ).rejects.toThrow();
  });
  expect(hook.result.current.latest).toEqual(latest);
  request.mockImplementationOnce(async (_path, options) => ({
    ...JSON.parse(String(options?.body)),
    revision: 4,
  }));
  await act(() => hook.result.current.applyDraft());
  expect(hook.result.current.board.tasks[0]).toMatchObject({
    title: 'My title',
    description: 'Other device',
  });
  expect(
    JSON.parse(String(request.mock.calls.at(-1)?.[1]?.body)).revision
  ).toBe(3);
  expect(hook.result.current.status).toBe('Saved to cloud');
});
it('can keep the cloud value and discard the pending proposal', async () => {
  const latest = { ...original, revision: 2 };
  request
    .mockResolvedValueOnce(original)
    .mockRejectedValueOnce(new ApiError('Board changed', 409))
    .mockResolvedValueOnce(latest);
  const hook = renderHook(() => useBoard('workspace'));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  await act(async () => {
    await expect(
      hook.result.current.change((b) => ({ ...b, tasks: [] }))
    ).rejects.toThrow();
  });
  act(() => hook.result.current.acceptLatest());
  expect(hook.result.current.board).toEqual(latest);
  expect(hook.result.current.pending).toBeNull();
});

it('prompts once for unchanged guest work and keeps an explicit copy action available', async () => {
  const { render, screen } = await import('@testing-library/react');
  const { default: userEvent } = await import('@testing-library/user-event');
  const { default: Home } = await import('../src/pages/Home');
  const guest = { version: 1, deviceId: crypto.randomUUID(), ...original };
  localStorage.setItem(GUEST_KEY, JSON.stringify(guest));
  request.mockResolvedValue(original);
  const props = {
    workspaceId: 'workspace',
    accountEmail: 'account@example.com',
    onSignOut: vi.fn(),
    theme: 'light' as const,
    onToggleTheme: vi.fn(),
  };
  const user = userEvent.setup();
  const first = render(<Home {...props} />);
  expect(
    await screen.findByRole('dialog', { name: 'Copy device work to cloud' })
  ).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Keep on this device' }));
  expect(JSON.parse(localStorage.getItem(GUEST_KEY)!).tasks).toEqual(
    original.tasks
  );
  first.unmount();
  render(<Home {...props} />);
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent('Saved to cloud')
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await user.click(
    screen.getByRole('button', { name: 'Copy device work to cloud' })
  );
  expect(
    screen.getByRole('dialog', { name: 'Copy device work to cloud' })
  ).toBeInTheDocument();
});

it('previews name mappings and copies only active guest tasks without changing local work', async () => {
  const { render, screen } = await import('@testing-library/react');
  const { default: userEvent } = await import('@testing-library/user-event');
  const { GuestImport } = await import('../src/component/GuestImport');
  const guest = {
    version: 1,
    deviceId: crypto.randomUUID(),
    ...original,
    tasks: [
      original.tasks[0],
      {
        ...original.tasks[0],
        id: 'archived',
        archivedAt: new Date().toISOString(),
      },
    ],
  };
  localStorage.setItem(GUEST_KEY, JSON.stringify(guest));
  request.mockResolvedValue({ ...original, revision: 2 });
  const imported = vi.fn();
  render(
    <GuestImport
      workspaceId="workspace"
      board={original}
      onImported={imported}
      onClose={vi.fn()}
    />
  );
  expect(screen.getByLabelText('To Do →')).toHaveValue('todo');
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Copy to cloud' }));
  await waitFor(() => expect(imported).toHaveBeenCalled());
  const payload = JSON.parse(String(request.mock.calls[0][1]?.body));
  expect(payload.tasks).toHaveLength(1);
  expect(payload.mapping.todo).toBe('todo');
  expect(payload.deviceId).toBe(guest.deviceId);
  expect(JSON.parse(localStorage.getItem(GUEST_KEY)!)).toEqual(guest);
});

it('keeps cloud edits after failure and retries the latest form values into saved details', async () => {
  const { render, screen, fireEvent, within } =
    await import('@testing-library/react');
  const { default: userEvent } = await import('@testing-library/user-event');
  const { default: Home } = await import('../src/pages/Home');
  request
    .mockResolvedValueOnce(original)
    .mockRejectedValueOnce(new ApiError('Connection failed', 0));
  render(
    <Home
      workspaceId="workspace"
      accountEmail="account@example.com"
      onSignOut={vi.fn()}
      theme="light"
      onToggleTheme={vi.fn()}
    />
  );
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: 'Original task', exact: true })
  );
  await user.click(
    screen.getByRole('button', { name: 'Edit task', exact: true })
  );
  fireEvent.change(screen.getByLabelText('Title'), {
    target: { value: 'First proposal' },
  });
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(screen.getByLabelText('Title')).toHaveValue('First proposal');
  expect(
    within(screen.getByRole('dialog', { name: 'Edit task' })).getByRole('alert')
  ).toHaveTextContent('Your edits are still here');
  expect(request).toHaveBeenCalledTimes(2);
  fireEvent.change(screen.getByLabelText('Title'), {
    target: { value: 'Latest proposal' },
  });
  request.mockImplementationOnce(async (_path, options) => ({
    ...JSON.parse(String(options?.body)),
    revision: 2,
  }));
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(
    screen.getByRole('dialog', { name: 'Task details' })
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole('dialog', { name: 'Task details' })).getByRole(
      'heading',
      { name: 'Latest proposal' }
    )
  ).toBeInTheDocument();
  expect(
    JSON.parse(String(request.mock.calls.at(-1)?.[1]?.body))
  ).toMatchObject({ revision: 1, tasks: [{ title: 'Latest proposal' }] });
  expect(localStorage.getItem(GUEST_KEY)).toBeNull();
});

it('retries failed cloud creation with the same task identity and closes only on success', async () => {
  const { render, screen, fireEvent } = await import('@testing-library/react');
  const { default: userEvent } = await import('@testing-library/user-event');
  const { default: Home } = await import('../src/pages/Home');
  request
    .mockResolvedValueOnce(original)
    .mockRejectedValueOnce(new ApiError('Connection failed', 0));
  render(
    <Home
      workspaceId="workspace"
      accountEmail="account@example.com"
      onSignOut={vi.fn()}
      theme="dark"
      onToggleTheme={vi.fn()}
    />
  );
  await screen.findByRole('button', { name: 'Original task', exact: true });
  const user = userEvent.setup();
  await user.click(
    screen.getByRole('button', { name: 'Add task', exact: true })
  );
  fireEvent.change(screen.getByLabelText('Title'), {
    target: { value: 'New cloud work' },
  });
  await user.click(screen.getByRole('button', { name: 'Create task' }));
  expect(screen.getByLabelText('Title')).toHaveValue('New cloud work');
  const first = JSON.parse(String(request.mock.calls.at(-1)?.[1]?.body));
  request.mockImplementationOnce(async (_path, options) => ({
    ...JSON.parse(String(options?.body)),
    revision: 2,
  }));
  await user.click(screen.getByRole('button', { name: 'Create task' }));
  const retried = JSON.parse(String(request.mock.calls.at(-1)?.[1]?.body));
  expect(retried.tasks).toHaveLength(2);
  expect(retried.tasks[1].id).toBe(first.tasks[1].id);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'New cloud work', exact: true })
  ).toBeInTheDocument();
});

it('retains the editor and explicit cloud-conflict choices after a stale save', async () => {
  const { render, screen, fireEvent } = await import('@testing-library/react');
  const { default: userEvent } = await import('@testing-library/user-event');
  const { default: Home } = await import('../src/pages/Home');
  const latest = {
    ...original,
    revision: 3,
    tasks: [{ ...original.tasks[0], description: 'Other device' }],
  };
  request
    .mockResolvedValueOnce(original)
    .mockRejectedValueOnce(new ApiError('Board changed', 409))
    .mockResolvedValueOnce(latest);
  render(
    <Home
      workspaceId="workspace"
      accountEmail="account@example.com"
      onSignOut={vi.fn()}
      theme="light"
      onToggleTheme={vi.fn()}
    />
  );
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: 'Original task', exact: true })
  );
  await user.click(
    screen.getByRole('button', { name: 'Edit task', exact: true })
  );
  fireEvent.change(screen.getByLabelText('Title'), {
    target: { value: 'My conflict draft' },
  });
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(
    await screen.findByRole('dialog', { name: 'Cloud save conflict' })
  ).toBeInTheDocument();
  expect(screen.getByLabelText('Title')).toHaveValue('My conflict draft');
  expect(
    screen.getByRole('button', { name: 'Keep cloud value' })
  ).toBeInTheDocument();
  request.mockImplementationOnce(async (_path, options) => ({
    ...JSON.parse(String(options?.body)),
    revision: 4,
  }));
  await user.click(
    screen.getByRole('button', { name: 'Apply draft against latest revision' })
  );
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Cloud save conflict' })
    ).not.toBeInTheDocument()
  );
  const payload = JSON.parse(String(request.mock.calls.at(-1)?.[1]?.body));
  expect(payload.tasks[0]).toMatchObject({
    title: 'My conflict draft',
    description: 'Other device',
  });
  expect(payload.revision).toBe(3);
  expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  expect(
    screen.getByRole('dialog', { name: 'Task details' })
  ).toHaveTextContent('Other device');
  await user.click(
    screen.getByRole('button', { name: 'Edit task', exact: true })
  );
  expect(screen.getByLabelText('Description')).toHaveValue('Other device');
  request.mockImplementationOnce(async (_path, options) => ({
    ...JSON.parse(String(options?.body)),
    revision: 5,
  }));
  await user.selectOptions(screen.getByLabelText('Priority'), 'high');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(
    JSON.parse(String(request.mock.calls.at(-1)?.[1]?.body)).tasks[0]
  ).toMatchObject({
    title: 'My conflict draft',
    description: 'Other device',
    priority: 'high',
  });
});

it('retains failed archive confirmation and retries explicitly against the same cloud revision', async () => {
  const { render, screen, within } = await import('@testing-library/react');
  const { default: userEvent } = await import('@testing-library/user-event');
  const { default: Home } = await import('../src/pages/Home');
  request
    .mockResolvedValueOnce(original)
    .mockRejectedValueOnce(new ApiError('Archive unavailable', 503));
  render(
    <Home
      workspaceId="workspace"
      accountEmail="account@example.com"
      onSignOut={vi.fn()}
      theme="light"
      onToggleTheme={vi.fn()}
    />
  );
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: 'Actions for Original task' })
  );
  await user.click(screen.getByRole('menuitem', { name: 'Archive task' }));
  const dialog = screen.getByRole('dialog', { name: 'Archive this task?' });
  expect(request).toHaveBeenCalledTimes(1);
  await user.click(
    within(dialog).getByRole('button', { name: 'Archive task' })
  );
  expect(within(dialog).getByRole('alert')).toHaveTextContent(
    'Archive unavailable'
  );
  expect(
    screen.getByRole('button', { name: 'Original task', exact: true })
  ).toBeInTheDocument();
  expect(request).toHaveBeenCalledTimes(2);
  request.mockImplementationOnce(async (_path, options) => ({
    ...JSON.parse(String(options?.body)),
    revision: 2,
  }));
  await user.click(
    within(dialog).getByRole('button', { name: 'Archive task' })
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(
    JSON.parse(String(request.mock.calls.at(-1)?.[1]?.body))
  ).toMatchObject({ revision: 1, tasks: [] });
  expect(
    screen.getByRole('button', { name: 'Add task', exact: true })
  ).toHaveFocus();
  expect(localStorage.getItem(GUEST_KEY)).toBeNull();
});
