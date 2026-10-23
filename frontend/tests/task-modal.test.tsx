import { useState } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
vi.mock('../src/lib/api', () => ({
  apiRequest: vi.fn(),
  requestError: (e: unknown) => (e instanceof Error ? e.message : 'Try again.'),
}));
import { apiRequest } from '../src/lib/api';
import { TaskModal } from '../src/component/TaskModal';
import { defaultColumns } from '../src/lib/board';
import type { Task } from '../src/types/task';

const task: Task = {
  id: 'task-1',
  title: 'Prepare release',
  description: 'Check the board.\nShip the update.',
  status: 'todo',
  priority: 'medium',
  startedAt: null,
  dueDate: null,
  expectedFinishAt: null,
};
const save = vi.fn();
const draft = vi.fn();
const editorEnd = vi.fn();
const request = vi.mocked(apiRequest);
function Harness({
  initial = task,
  mode = 'details',
  workspaceId,
}: {
  initial?: Task;
  mode?: 'details' | 'edit';
  workspaceId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(initial);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open task</button>
      {open && (
        <TaskModal
          task={saved}
          initialMode={mode}
          columns={defaultColumns()}
          workspaceId={workspaceId}
          onDraft={draft}
          onEditorEnd={editorEnd}
          onSave={async (changes) => {
            await save(changes);
            setSaved({ ...saved, ...changes });
            if (!saved.id) setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
async function open(props: Parameters<typeof Harness>[0] = {}) {
  const user = userEvent.setup();
  render(<Harness {...props} />);
  await user.click(screen.getByRole('button', { name: 'Open task' }));
  return user;
}
function unloadPrevented() {
  const e = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(e);
  return e.defaultPrevented;
}
beforeEach(() => {
  save.mockReset().mockResolvedValue(undefined);
  draft.mockReset();
  editorEnd.mockReset();
  request.mockReset();
});

it('shows complete read-only details without creating a draft or unload warning', async () => {
  await open();
  const dialog = screen.getByRole('dialog', { name: 'Task details' });
  expect(dialog).toHaveAttribute('open');
  expect(
    within(dialog).getByRole('heading', { name: task.title })
  ).toBeInTheDocument();
  expect(within(dialog).getByText(/Check the board/)).toHaveTextContent(
    'Ship the update.'
  );
  expect(within(dialog).getByText('To Do')).toBeInTheDocument();
  expect(within(dialog).getByText(/medium priority/)).toBeInTheDocument();
  expect(within(dialog).getAllByText('Not set')).toHaveLength(3);
  expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
  expect(within(dialog).queryByRole('combobox')).not.toBeInTheDocument();
  expect(screen.queryByText('Help write description')).not.toBeInTheDocument();
  expect(draft).not.toHaveBeenCalled();
  expect(unloadPrevented()).toBe(false);
  expect(screen.getByRole('button', { name: 'Edit task' })).toHaveFocus();
});

it('renders missing descriptions and full long descriptions', () => {
  const view = render(
    <TaskModal
      task={{ ...task, description: '' }}
      onSave={save}
      onClose={vi.fn()}
    />
  );
  expect(screen.getByText('No description')).toBeInTheDocument();
  const long = 'Long description.\n'.repeat(100);
  view.rerender(
    <TaskModal
      task={{ ...task, description: long }}
      onSave={save}
      onClose={vi.fn()}
    />
  );
  expect(
    screen.getByRole('region', { name: 'Description' }).querySelector('p')
      ?.textContent
  ).toBe(long);
});

it('edits every field, saves directly once, and returns to updated details and focus', async () => {
  const user = await open();
  await user.click(screen.getByRole('button', { name: 'Edit task' }));
  expect(screen.getByLabelText('Title')).toHaveFocus();
  fireEvent.change(screen.getByLabelText('Title'), {
    target: { value: '  Ready to ship  ' },
  });
  fireEvent.change(screen.getByLabelText('Description'), {
    target: { value: 'All checks complete' },
  });
  await user.selectOptions(screen.getByLabelText('Status'), 'done');
  await user.selectOptions(screen.getByLabelText('Priority'), 'high');
  for (const [label, value] of [
    ['Start date', '2026-10-20'],
    ['Due date', '2026-10-25'],
    ['Target finish', '2026-10-24'],
  ]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  expect(screen.getByLabelText('Title')).toHaveAttribute('maxlength', '200');
  expect(screen.getByLabelText('Description')).toHaveAttribute(
    'maxlength',
    '2000'
  );
  expect(unloadPrevented()).toBe(true);
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(save).toHaveBeenCalledExactlyOnceWith({
    title: 'Ready to ship',
    description: 'All checks complete',
    status: 'done',
    priority: 'high',
    startedAt: '2026-10-20',
    dueDate: '2026-10-25',
    expectedFinishAt: '2026-10-24',
  });
  const details = screen.getByRole('dialog', { name: 'Task details' });
  expect(
    within(details).getByRole('heading', { name: 'Ready to ship' })
  ).toBeInTheDocument();
  expect(within(details).getByText('All checks complete')).toBeInTheDocument();
  expect(within(details).getByText('Done')).toBeInTheDocument();
  expect(within(details).queryByText('Not set')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Edit task' })).toHaveFocus();
  expect(unloadPrevented()).toBe(false);
  expect(editorEnd).toHaveBeenCalledOnce();
  await user.click(screen.getByRole('button', { name: 'Edit task' }));
  expect(screen.getByLabelText('Title')).toHaveValue('Ready to ship');
});

it('retains edits after save failure and saves on explicit retry', async () => {
  save.mockRejectedValueOnce(new Error('Offline'));
  const user = await open({ mode: 'edit' });
  await user.type(screen.getByLabelText('Description'), ' More work');
  await user.selectOptions(screen.getByLabelText('Priority'), 'low');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Your edits are still here'
  );
  expect(screen.getByLabelText('Description')).toHaveValue(
    `${task.description} More work`
  );
  expect(screen.getByLabelText('Priority')).toHaveValue('low');
  expect(editorEnd).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(save).toHaveBeenCalledTimes(2);
  expect(
    screen.getByRole('dialog', { name: 'Task details' })
  ).toBeInTheDocument();
});

it('validates whitespace-only titles without losing the draft', async () => {
  const user = await open({ mode: 'edit' });
  fireEvent.change(screen.getByLabelText('Title'), {
    target: { value: '   ' },
  });
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Title is required');
  expect(screen.getByLabelText('Title')).toHaveFocus();
  expect(save).not.toHaveBeenCalled();
});

it('cancels unchanged edits immediately and resets changed edits after confirmation', async () => {
  const user = await open({ mode: 'edit' });
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(
    screen.getByRole('dialog', { name: 'Task details' })
  ).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Edit task' }));
  await user.type(screen.getByLabelText('Title'), ' draft');
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  const confirm = screen.getByRole('dialog', { name: 'Discard changes?' });
  expect(
    within(confirm).getByRole('button', { name: 'Keep editing' })
  ).toHaveFocus();
  fireEvent(confirm, new Event('cancel', { cancelable: true }));
  expect(screen.getByLabelText('Title')).toHaveValue(`${task.title} draft`);
  expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await user.click(screen.getByRole('button', { name: 'Keep editing' }));
  expect(
    screen.queryByRole('dialog', { name: 'Discard changes?' })
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await user.click(screen.getByRole('button', { name: 'Discard changes' }));
  expect(screen.getByRole('button', { name: 'Edit task' })).toHaveFocus();
  expect(screen.getByRole('heading', { name: task.title })).toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
});

it.each(['close', 'escape', 'backdrop'])(
  'protects dirty edits on %s and restores the trigger after discarding',
  async (method) => {
    const user = await open({ mode: 'edit' });
    await user.type(screen.getByLabelText('Title'), ' changed');
    const dialog = screen.getByRole('dialog', { name: 'Edit task' });
    if (method === 'close')
      await user.click(
        screen.getByRole('button', { name: 'Close task dialog' })
      );
    else if (method === 'escape')
      fireEvent(dialog, new Event('cancel', { cancelable: true }));
    else fireEvent.click(dialog, { clientX: -1, clientY: -1 });
    expect(
      screen.getByRole('dialog', { name: 'Discard changes?' })
    ).toHaveAttribute('open');
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByLabelText('Title')).toHaveValue(`${task.title} changed`);
    await user.click(screen.getByRole('button', { name: 'Close task dialog' }));
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open task' })).toHaveFocus();
  }
);

it.each(['details', 'edit'] as const)(
  'dismisses unchanged %s on Escape without prompting',
  async (mode) => {
    await open({ mode });
    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { cancelable: true })
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open task' })).toHaveFocus();
  }
);

it('protects new-task drafts and closes after successful creation', async () => {
  const user = await open({
    initial: { ...task, id: '', title: '', description: '' },
  });
  expect(screen.getByRole('dialog', { name: 'New task' })).toBeInTheDocument();
  expect(screen.getByLabelText('Title')).toHaveFocus();
  await user.type(screen.getByLabelText('Title'), 'New work');
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await user.click(screen.getByRole('button', { name: 'Keep editing' }));
  await user.click(screen.getByRole('button', { name: 'Create task' }));
  expect(save).toHaveBeenCalledOnce();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('generates explicitly, previews the suggestion, and applies only to the draft description', async () => {
  request.mockResolvedValue({
    suggestedDescription: 'Review and publish the release.',
  });
  const user = await open({ mode: 'edit', workspaceId: 'workspace' });
  await user.click(
    screen.getByRole('button', { name: 'Help write description' })
  );
  expect(
    screen.getByRole('button', { name: 'Help write description' })
  ).toHaveAttribute('aria-expanded', 'true');
  expect(request).not.toHaveBeenCalled();
  expect(
    screen.queryByRole('button', { name: 'Apply suggestion' })
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole('button', { name: 'Generate with Gemini' })
  );
  expect(request).toHaveBeenCalledExactlyOnceWith(
    '/api/ai/rewrite-task',
    expect.objectContaining({
      workspaceId: 'workspace',
      method: 'POST',
      body: JSON.stringify({ title: task.title }),
    })
  );
  expect(
    screen.getByText('Review and publish the release.')
  ).toBeInTheDocument();
  expect(screen.getByLabelText('Description')).toHaveValue(task.description);
  await user.click(screen.getByRole('button', { name: 'Apply suggestion' }));
  expect(screen.getByLabelText('Description')).toHaveValue(
    'Review and publish the release.'
  );
  expect(screen.getByLabelText('Title')).toHaveValue(task.title);
  expect(screen.getByLabelText('Priority')).toHaveValue(task.priority);
  expect(save).not.toHaveBeenCalled();
});

it('gates Gemini behind explicit sign-in and keeps the guest draft', async () => {
  const signIn = vi.fn();
  render(
    <TaskModal
      task={task}
      initialMode="edit"
      onSignIn={signIn}
      onSave={save}
      onClose={vi.fn()}
    />
  );
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Description'), ' Keep this');
  await user.click(
    screen.getByRole('button', { name: 'Help write description' })
  );
  expect(signIn).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole('button', { name: 'Sign in to use Gemini' })
  );
  expect(signIn).toHaveBeenCalledOnce();
  expect(request).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Description')).toHaveValue(
    `${task.description} Keep this`
  );
});

it('keeps the description on failed generation and supports explicit retry', async () => {
  request
    .mockRejectedValueOnce(new Error('Connection failed'))
    .mockResolvedValueOnce({ suggestedDescription: 'Recovered suggestion' });
  const user = await open({ mode: 'edit', workspaceId: 'workspace' });
  await user.click(
    screen.getByRole('button', { name: 'Help write description' })
  );
  await user.click(
    screen.getByRole('button', { name: 'Generate with Gemini' })
  );
  expect(screen.getByRole('alert')).toHaveTextContent('Connection failed');
  expect(screen.getByLabelText('Description')).toHaveValue(task.description);
  await user.click(
    screen.getByRole('button', { name: 'Generate with Gemini' })
  );
  expect(screen.getByText('Recovered suggestion')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('ignores late AI responses after leaving editing or switching tasks', async () => {
  let resolve: (data: { suggestedDescription: string }) => void = () => {};
  request.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  const props = {
    initialMode: 'edit' as const,
    workspaceId: 'workspace',
    onSave: save,
    onClose: vi.fn(),
  };
  const view = render(<TaskModal task={task} {...props} />);
  const user = userEvent.setup();
  await user.click(
    screen.getByRole('button', { name: 'Help write description' })
  );
  await user.click(
    screen.getByRole('button', { name: 'Generate with Gemini' })
  );
  const signal = request.mock.calls[0][1]?.signal;
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(signal?.aborted).toBe(true);
  await user.click(screen.getByRole('button', { name: 'Edit task' }));
  await user.click(
    screen.getByRole('button', { name: 'Help write description' })
  );
  await act(async () => resolve({ suggestedDescription: 'Old suggestion' }));
  expect(screen.queryByText('Old suggestion')).not.toBeInTheDocument();
  await user.click(
    screen.getByRole('button', { name: 'Generate with Gemini' })
  );
  const secondSignal = request.mock.calls[1][1]?.signal;
  view.rerender(
    <TaskModal
      task={{ ...task, id: 'another', title: 'Other task' }}
      {...props}
    />
  );
  expect(secondSignal?.aborted).toBe(true);
  await act(async () =>
    resolve({ suggestedDescription: 'Other stale suggestion' })
  );
  expect(screen.getByLabelText('Title')).toHaveValue('Other task');
  expect(screen.queryByText('Other stale suggestion')).not.toBeInTheDocument();
});
