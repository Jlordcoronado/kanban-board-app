import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
vi.mock('../src/auth/client', () => ({ supabase: null }));
import { ActionMenu } from '../src/component/ActionMenu';
import { TaskCard } from '../src/component/TaskCard';
import { KanbanColumn } from '../src/component/KanbanColumn';
import Home from '../src/pages/Home';
import {
  defaultColumns,
  GUEST_KEY,
  readGuest,
  saveGuest,
} from '../src/lib/board';
import type { Task } from '../src/types/task';

const task: Task = {
  id: '00000000-0000-4000-8000-000000000001',
  title: 'Plan release',
  description: 'Review the details',
  priority: 'medium',
  status: 'todo',
  startedAt: '2026-10-20',
  dueDate: '2030-10-25',
  expectedFinishAt: '2026-10-24',
};
const homeProps = {
  accountEmail: '',
  onSignOut: vi.fn(),
  theme: 'light' as const,
  onToggleTheme: vi.fn(),
};
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  saveGuest({ revision: 0, columns: defaultColumns(), tasks: [task] });
});

it('places the menu outside clipped content, clamps to the viewport, and flips above a low trigger', async () => {
  vi.stubGlobal('innerWidth', 320);
  vi.stubGlobal('innerHeight', 180);
  const original = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      if (this.getAttribute('aria-haspopup') === 'menu')
        return {
          x: 280,
          y: 140,
          left: 280,
          top: 140,
          right: 312,
          bottom: 172,
          width: 32,
          height: 32,
          toJSON: () => ({}),
        };
      if (this.classList.contains('board-action-menu'))
        return {
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: 192,
          bottom: 88,
          width: 192,
          height: 88,
          toJSON: () => ({}),
        };
      return original.call(this);
    }
  );
  const action = vi.fn();
  render(
    <div style={{ overflow: 'hidden', height: 1 }}>
      <ActionMenu
        label="Task actions"
        items={[
          { label: 'Edit task', onSelect: action },
          { label: 'Archive task', onSelect: action },
        ]}
      />
    </div>
  );
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Task actions' }));
  const menu = screen.getByRole('menu');
  expect(menu.parentElement).toBe(document.body);
  expect(menu).toHaveStyle({ left: '120px', top: '46px', maxHeight: '164px' });
  expect(screen.getByRole('menuitem', { name: 'Edit task' })).toHaveFocus();
});

it('supports menu keyboard navigation, skips disabled items, activates actions, and restores trigger focus', async () => {
  const archive = vi.fn();
  render(
    <ActionMenu
      label="Task actions"
      items={[
        { label: 'Edit task', onSelect: vi.fn() },
        { label: 'Unavailable', onSelect: vi.fn(), disabled: true },
        { label: 'Archive task', onSelect: archive },
      ]}
    />
  );
  const user = userEvent.setup();
  const trigger = screen.getByRole('button', { name: 'Task actions' });
  trigger.focus();
  await user.keyboard('{Enter}');
  expect(screen.getByRole('menuitem', { name: 'Edit task' })).toHaveFocus();
  await user.keyboard('{ArrowDown}');
  expect(screen.getByRole('menuitem', { name: 'Archive task' })).toHaveFocus();
  await user.keyboard('{Home}');
  expect(screen.getByRole('menuitem', { name: 'Edit task' })).toHaveFocus();
  await user.keyboard('{End}{Enter}');
  expect(archive).toHaveBeenCalledOnce();
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  await user.keyboard('{ArrowUp}');
  expect(screen.getByRole('menuitem', { name: 'Archive task' })).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(trigger).toHaveFocus();
  await user.keyboard('{ArrowDown}');
  expect(screen.getByRole('menuitem', { name: 'Edit task' })).toHaveFocus();
});

it.each(['outside', 'scroll', 'resize', 'drag', 'tab', 'remove'])(
  'dismisses menus on %s, while allowing internal scrolling',
  async (method) => {
    const view = render(
      <>
        <ActionMenu
          label="Task actions"
          items={[{ label: 'Edit task', onSelect: vi.fn() }]}
        />
        <button>Outside</button>
      </>
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Task actions' }));
    fireEvent.scroll(screen.getByRole('menu'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    if (method === 'outside') {
      await user.click(screen.getByRole('button', { name: 'Outside' }));
      expect(screen.getByRole('button', { name: 'Outside' })).toHaveFocus();
    } else if (method === 'scroll') fireEvent.scroll(document);
    else if (method === 'resize') fireEvent(window, new Event('resize'));
    else if (method === 'drag') fireEvent.dragStart(document.body);
    else if (method === 'tab') {
      await user.tab();
      expect(screen.getByRole('button', { name: 'Outside' })).toHaveFocus();
    } else view.unmount();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  }
);

it('keeps only one card or column menu open at a time', async () => {
  render(
    <>
      <ActionMenu
        label="First"
        items={[{ label: 'Edit', onSelect: vi.fn() }]}
      />
      <ActionMenu
        label="Second"
        items={[{ label: 'Rename', onSelect: vi.fn() }]}
      />
    </>
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'First' }));
  await user.click(screen.getByRole('button', { name: 'Second' }));
  expect(screen.getAllByRole('menu')).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'First' })).toHaveAttribute(
    'aria-expanded',
    'false'
  );
  expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveFocus();
});

it('opens details from the title, description, dates, card padding, and keyboard', async () => {
  const open = vi.fn();
  render(
    <TaskCard
      task={task}
      status="todo"
      onArchiveTask={vi.fn()}
      onDragEnd={vi.fn()}
      openTask={open}
    />
  );
  const user = userEvent.setup();
  for (const element of [
    screen.getByRole('button', { name: task.title }),
    screen.getByText(task.description),
    screen.getByText(/Started/),
    screen.getByText(/Target/),
    screen.getByText(/Due/),
    screen.getByRole('article'),
  ]) {
    await user.click(element);
    expect(open).toHaveBeenLastCalledWith(task);
  }
  const primary = screen.getByRole('button', { name: task.title });
  primary.focus();
  await user.keyboard('{Enter} ');
  expect(open).toHaveBeenCalledTimes(8);
});

it('distinguishes dragging from clicking, clears cancelled drag feedback, and permits a fresh click', async () => {
  const open = vi.fn();
  const end = vi.fn();
  render(
    <TaskCard
      task={task}
      status="todo"
      onArchiveTask={vi.fn()}
      onDragEnd={end}
      openTask={open}
    />
  );
  const article = screen.getByRole('article');
  const dataTransfer = { effectAllowed: 'none', setData: vi.fn() };
  fireEvent.pointerDown(article);
  fireEvent.dragStart(article, { dataTransfer });
  expect(dataTransfer.effectAllowed).toBe('move');
  expect(dataTransfer.setData).toHaveBeenCalledWith('taskId', task.id);
  expect(article).toHaveClass('board-task-dragging');
  fireEvent.dragEnd(article);
  fireEvent.click(article);
  expect(open).not.toHaveBeenCalled();
  expect(end).toHaveBeenCalledOnce();
  expect(article).not.toHaveClass('board-task-dragging');
  await userEvent.setup().click(article);
  expect(open).toHaveBeenCalledOnce();
  fireEvent.dragStart(article, { dataTransfer });
  fireEvent.dragEnd(article);
  screen.getByRole('button', { name: task.title }).focus();
  await userEvent.setup().keyboard('{Enter}');
  expect(open).toHaveBeenCalledTimes(2);
});

it('isolates menu events from task opening and dragging and offers only Edit and Archive', async () => {
  const open = vi.fn();
  const archive = vi.fn();
  render(
    <TaskCard
      task={task}
      status="todo"
      onArchiveTask={archive}
      onDragEnd={vi.fn()}
      openTask={open}
    />
  );
  const user = userEvent.setup();
  const trigger = screen.getByRole('button', {
    name: `Actions for ${task.title}`,
  });
  await user.click(trigger);
  expect(open).not.toHaveBeenCalled();
  expect(
    screen.getAllByRole('menuitem').map((item) => item.textContent)
  ).toEqual(['Edit task', 'Archive task']);
  const dataTransfer = { setData: vi.fn() };
  fireEvent.dragStart(screen.getByRole('article'), { dataTransfer });
  expect(dataTransfer.setData).not.toHaveBeenCalled();
  await user.click(trigger);
  await user.click(screen.getByRole('menuitem', { name: 'Edit task' }));
  expect(open).toHaveBeenCalledExactlyOnceWith(task, 'edit');
  await user.click(trigger);
  await user.click(screen.getByRole('menuitem', { name: 'Archive task' }));
  expect(archive).toHaveBeenCalledExactlyOnceWith(task);
  expect(trigger).toHaveFocus();
});

function columnProps() {
  return {
    status: 'todo',
    title: 'To Do',
    tasks: [task],
    columns: defaultColumns(),
    moveTask: vi.fn(),
    onArchiveTask: vi.fn(),
    openTask: vi.fn(),
    dragOverColumn: null,
    setDragOverColumn: vi.fn(),
    onRenameColumn: vi.fn(),
    onDeleteColumn: vi.fn(),
    onAddTask: vi.fn(),
  };
}
it('renames through the column menu, saves once on Enter/blur, and cancels with Escape', async () => {
  const props = columnProps();
  render(<KanbanColumn {...props} />);
  const user = userEvent.setup();
  const trigger = screen.getByRole('button', {
    name: 'Actions for column To Do',
  });
  await user.click(trigger);
  await user.click(screen.getByRole('menuitem', { name: 'Rename column' }));
  const input = screen.getByRole('textbox', { name: 'Column name for To Do' });
  expect(input).toHaveFocus();
  await user.clear(input);
  await user.type(input, 'Ready{Enter}');
  fireEvent.blur(input);
  expect(props.onRenameColumn).toHaveBeenCalledExactlyOnceWith('todo', 'Ready');
  expect(trigger).toHaveFocus();
  await user.click(trigger);
  await user.click(screen.getByRole('menuitem', { name: 'Rename column' }));
  await user.type(screen.getByRole('textbox'), 'Discard{Escape}');
  expect(props.onRenameColumn).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it('adds tasks, uses column deletion actions, and disables deleting the last column', async () => {
  const props = columnProps();
  const view = render(<KanbanColumn {...props} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Add task to To Do' }));
  expect(props.onAddTask).toHaveBeenCalledExactlyOnceWith('todo');
  await user.click(
    screen.getByRole('button', { name: 'Actions for column To Do' })
  );
  await user.click(screen.getByRole('menuitem', { name: 'Delete column' }));
  expect(props.onDeleteColumn).toHaveBeenCalledExactlyOnceWith('todo');
  view.rerender(<KanbanColumn {...props} columns={[defaultColumns()[0]]} />);
  await user.click(
    screen.getByRole('button', { name: 'Actions for column To Do' })
  );
  expect(
    screen.getByRole('menuitem', { name: 'Delete column' })
  ).toBeDisabled();
});

it('moves a dragged task between columns without opening it, and does not reorder or save within its own column', () => {
  const props = columnProps();
  const view = render(<KanbanColumn {...props} />);
  const dataTransfer = { getData: vi.fn(() => task.id), dropEffect: 'none' };
  fireEvent.drop(screen.getByRole('region', { name: 'To Do' }), {
    dataTransfer,
  });
  expect(props.moveTask).not.toHaveBeenCalled();
  view.rerender(
    <KanbanColumn {...props} status="done" title="Done" tasks={[]} />
  );
  fireEvent.dragOver(screen.getByRole('region', { name: 'Done' }), {
    dataTransfer,
  });
  expect(dataTransfer.dropEffect).toBe('move');
  fireEvent.drop(screen.getByRole('region', { name: 'Done' }), {
    dataTransfer,
  });
  expect(props.moveTask).toHaveBeenCalledExactlyOnceWith(task.id, 'done');
  expect(props.setDragOverColumn).toHaveBeenLastCalledWith(null);
  expect(props.openTask).not.toHaveBeenCalled();
});

it('confirms task archiving, cancels to the trigger, and focuses Add task after successful persistence', async () => {
  render(<Home {...homeProps} />, { wrapper: MemoryRouter });
  const user = userEvent.setup();
  const trigger = screen.getByRole('button', {
    name: `Actions for ${task.title}`,
  });
  await user.click(trigger);
  await user.click(screen.getByRole('menuitem', { name: 'Archive task' }));
  expect(readGuest().board.tasks[0].archivedAt).toBeUndefined();
  let dialog = screen.getByRole('dialog', { name: 'Archive this task?' });
  expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(trigger).toHaveFocus();
  await user.click(trigger);
  await user.click(screen.getByRole('menuitem', { name: 'Archive task' }));
  dialog = screen.getByRole('dialog', { name: 'Archive this task?' });
  await user.click(
    within(dialog).getByRole('button', { name: 'Archive task' })
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(readGuest().board.tasks[0].archivedAt).toBeTruthy();
  expect(
    screen.queryByRole('button', { name: task.title, exact: true })
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Add task', exact: true })
  ).toHaveFocus();
});

it('retains archive confirmation after browser saving fails, even if the optimistic card disappears, and retries', async () => {
  render(<Home {...homeProps} />, { wrapper: MemoryRouter });
  const user = userEvent.setup();
  await user.click(
    screen.getByRole('button', { name: `Actions for ${task.title}` })
  );
  await user.click(screen.getByRole('menuitem', { name: 'Archive task' }));
  const original = Storage.prototype.setItem;
  const storage = vi
    .spyOn(Storage.prototype, 'setItem')
    .mockImplementation(function (this: Storage, key, value) {
      if (key === GUEST_KEY) throw new Error('Browser storage is full');
      original.call(this, key, value);
    });
  const dialog = screen.getByRole('dialog', { name: 'Archive this task?' });
  await user.click(
    within(dialog).getByRole('button', { name: 'Archive task' })
  );
  expect(within(dialog).getByRole('alert')).toHaveTextContent(
    'Browser storage is full'
  );
  expect(
    screen.queryByRole('button', { name: task.title, exact: true })
  ).not.toBeInTheDocument();
  storage.mockRestore();
  await user.click(
    within(dialog).getByRole('button', { name: 'Archive task' })
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(
    JSON.parse(localStorage.getItem(GUEST_KEY)!).tasks[0].archivedAt
  ).toBeTruthy();
});

it('preserves column deletion confirmation and moves its tasks to the first remaining column', async () => {
  saveGuest({
    revision: 0,
    columns: defaultColumns(),
    tasks: [{ ...task, status: 'done' }],
  });
  render(<Home {...homeProps} />, { wrapper: MemoryRouter });
  const user = userEvent.setup();
  const trigger = screen.getByRole('button', {
    name: 'Actions for column Done',
  });
  await user.click(trigger);
  await user.click(screen.getByRole('menuitem', { name: 'Delete column' }));
  let dialog = screen.getByRole('dialog', { name: 'Delete Column' });
  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(trigger).toHaveFocus();
  await user.click(trigger);
  await user.click(screen.getByRole('menuitem', { name: 'Delete column' }));
  dialog = screen.getByRole('dialog', { name: 'Delete Column' });
  await user.click(
    within(dialog).getByRole('button', { name: 'Delete Column' })
  );
  expect(readGuest().board.columns.some((column) => column.id === 'done')).toBe(
    false
  );
  expect(readGuest().board.tasks[0].status).toBe('todo');
});

it('returns to Add task when cancelling after a failed local archive has removed the original trigger', async () => {
  render(<Home {...homeProps} />, { wrapper: MemoryRouter });
  const user = userEvent.setup();
  await user.click(
    screen.getByRole('button', { name: `Actions for ${task.title}` })
  );
  await user.click(screen.getByRole('menuitem', { name: 'Archive task' }));
  const original = Storage.prototype.setItem;
  const storage = vi
    .spyOn(Storage.prototype, 'setItem')
    .mockImplementation(function (this: Storage, key, value) {
      if (key === GUEST_KEY) throw new Error('Storage unavailable');
      original.call(this, key, value);
    });
  const dialog = screen.getByRole('dialog', { name: 'Archive this task?' });
  await user.click(
    within(dialog).getByRole('button', { name: 'Archive task' })
  );
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Add task', exact: true })
  ).toHaveFocus();
  storage.mockRestore();
  await user.click(screen.getByRole('button', { name: 'Retry', exact: true }));
});

it('keeps archive confirmation open and prevents duplicate requests while saving', async () => {
  const { act } = await import('@testing-library/react');
  const { ArchiveTaskDialog } =
    await import('../src/component/ArchiveTaskDialog');
  let finish: () => void = () => {};
  const archive = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  const close = vi.fn();
  render(
    <ArchiveTaskDialog
      title={task.title}
      onArchive={archive}
      onClose={close}
      returnFocusRef={{ current: null }}
    />
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Archive task' }));
  expect(screen.getByRole('button', { name: 'Archiving…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  fireEvent(
    screen.getByRole('dialog'),
    new Event('cancel', { cancelable: true })
  );
  expect(close).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Archiving…' }));
  expect(archive).toHaveBeenCalledOnce();
  await act(async () => finish());
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(close).toHaveBeenCalledOnce();
});
