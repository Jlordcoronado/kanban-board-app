import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../src/pages/Dashboard';
import type { WorkspaceBoardEntry } from '../src/board/types';
import type { Task } from '../src/types/task';
import type { Workspace } from '../src/types/workspace';
import {
  addCalendarDays,
  calendarDate,
  dashboardCounts,
  localCalendarDate,
  selectDashboardTasks,
  tasksForView,
} from '../src/lib/dashboard';

const personal: Workspace = {
  id: 'private',
  name: 'Personal workspace',
  kind: 'personal',
  role: 'owner',
};
const team: Workspace = {
  id: 'team',
  name: "jlord's team",
  kind: 'team',
  role: 'member',
};
const today = localCalendarDate();
const task = (id: string, values: Partial<Task> = {}): Task => ({
  id,
  title: id,
  description: '',
  status: 'todo',
  priority: 'medium',
  startedAt: null,
  dueDate: null,
  expectedFinishAt: null,
  ...values,
});
function entry(
  workspace: Workspace,
  tasks: Task[],
  values: Partial<WorkspaceBoardEntry['storage']> = {}
): WorkspaceBoardEntry {
  return {
    workspace,
    storage: {
      board: {
        revision: 1,
        columns: [
          { id: 'todo', title: 'To do' },
          { id: 'done', title: 'Finished' },
          { id: 'custom', title: 'Review' },
        ],
        tasks,
      },
      available: true,
      loading: false,
      error: '',
      status: 'Saved to cloud',
      pending: null,
      latest: null,
      saving: false,
      lastUpdated: Date.now(),
      resolution: 0,
      change: vi.fn(),
      persist: vi.fn(),
      retry: vi.fn(),
      refresh: vi.fn().mockResolvedValue(undefined),
      applyDraft: vi.fn(),
      acceptLatest: vi.fn(),
      replace: vi.fn(),
      ...values,
    },
  };
}

describe('dashboard date and task selection', () => {
  it('keeps calendar dates intact across timestamp serialization and validates dates', () => {
    expect(calendarDate('2030-03-20')).toBe('2030-03-20');
    expect(calendarDate('2030-03-20T00:00:00+00:00')).toBe('2030-03-20');
    expect(calendarDate('2030-03-20T00:00:00.000Z')).toBe('2030-03-20');
    expect(calendarDate('2030-02-30')).toBeNull();
    expect(calendarDate(null)).toBeNull();
    expect(addCalendarDays('2030-03-10', 6)).toBe('2030-03-16');
    expect(addCalendarDays('2030-12-29', 6)).toBe('2031-01-04');
  });

  it('uses exact Done status, excludes archives, and includes today through day six', () => {
    const tasks = selectDashboardTasks([
      entry(personal, [
        task('past', { dueDate: '2030-03-14T00:00:00Z' }),
        task('today', { dueDate: '2030-03-15' }),
        task('six-days', { dueDate: '2030-03-21', status: 'custom' }),
        task('seven-days', { dueDate: '2030-03-22' }),
        task('no-date'),
        task('finished', { dueDate: '2030-03-14', status: 'done' }),
        task('archived', {
          dueDate: '2030-03-14',
          archivedAt: '2030-03-14T12:00:00Z',
        }),
      ]),
    ]);
    expect(dashboardCounts(tasks, '2030-03-15')).toEqual({
      open: 5,
      overdue: 1,
      today: 1,
      done: 1,
    });
    expect(
      tasksForView(tasks, 'upcoming', '2030-03-15').map((item) => item.id)
    ).toEqual(['today', 'six-days']);
    expect(tasksForView(tasks, 'done', '2030-03-15')[0].statusLabel).toBe(
      'Finished'
    );
  });

  it('sorts by due date, then priority and title, with undated tasks last', () => {
    const tasks = selectDashboardTasks([
      entry(personal, [
        task('undated', { priority: 'high' }),
        task('low', { dueDate: '2030-03-15', priority: 'low' }),
        task('high-b', {
          title: 'Beta',
          dueDate: '2030-03-15',
          priority: 'high',
        }),
        task('high-a', {
          title: 'Alpha',
          dueDate: '2030-03-15',
          priority: 'high',
        }),
        task('earlier', { dueDate: '2030-03-14', priority: 'low' }),
      ]),
    ]);
    expect(
      tasksForView(tasks, 'open', '2030-03-15').map((item) => item.id)
    ).toEqual(['earlier', 'high-a', 'high-b', 'low', 'undated']);
  });

  it('excludes unavailable workspaces and preserves the source when IDs match', () => {
    const entries = [
      entry(personal, [task('same')]),
      entry(team, [task('same')]),
    ];
    expect(selectDashboardTasks(entries).map((item) => item.source.id)).toEqual(
      ['private', 'team']
    );
    expect(selectDashboardTasks(entries, 'private')).toHaveLength(1);
    entries[1].storage.available = false;
    expect(selectDashboardTasks(entries).map((item) => item.source.id)).toEqual(
      ['private']
    );
  });
});

function renderDashboard(entries: WorkspaceBoardEntry[]) {
  const onOpenTask = vi.fn();
  const onRefresh = vi.fn().mockResolvedValue(undefined);
  render(
    <MemoryRouter>
      <Dashboard
        entries={entries}
        onOpenTask={onOpenTask}
        onRefresh={onRefresh}
      />
    </MemoryRouter>
  );
  return { onOpenTask, onRefresh };
}

it('filters counts and opens task details with the correct workspace', async () => {
  const user = userEvent.setup();
  const overdue = task('Personal overdue', {
    dueDate: addCalendarDays(today, -1),
  });
  const entries = [
    entry(personal, [overdue, task('Personal today', { dueDate: today })]),
    entry(team, [
      task('Team overdue', { dueDate: addCalendarDays(today, -2) }),
      task('Team done', { status: 'done' }),
    ]),
  ];
  const { onOpenTask } = renderDashboard(entries);
  expect(
    screen.getByRole('button', { name: 'Open: 3 tasks' })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Overdue: 2 tasks' })
  ).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText('View work'), 'private');
  await user.click(screen.getByRole('button', { name: 'Open: 2 tasks' }));
  expect(
    screen.getByRole('heading', { name: 'Open tasks' })
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /Open Team overdue/ })
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole('button', { name: 'Open Personal overdue from Personal' })
  );
  expect(onOpenTask).toHaveBeenCalledWith(
    personal,
    expect.objectContaining({ id: overdue.id })
  );
  await user.click(screen.getByRole('button', { name: 'Back to overview' }));
  expect(
    screen.getByRole('region', { name: 'Next 7 days' })
  ).toBeInTheDocument();
});

it('shows partial totals, retries only the failed workspace, and exposes read-only refresh', async () => {
  const user = userEvent.setup();
  const failed = entry(team, [task('Hidden stale task')], {
    available: false,
    error: 'Connection unavailable',
  });
  const { onRefresh } = renderDashboard([
    entry(personal, [task('Private work')]),
    failed,
  ]);
  expect(screen.getByText(/Totals are incomplete/)).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Open: 1 tasks' })
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /Open Hidden stale task/ })
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: "Retry jlord's team" }));
  expect(failed.storage.refresh).toHaveBeenCalledTimes(1);
  expect(failed.storage.persist).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Refresh' }));
  expect(onRefresh).toHaveBeenCalledTimes(1);
});

it('shows placeholders during initial loading rather than misleading zero counts', () => {
  renderDashboard([
    entry(personal, [], { available: false, loading: true, lastUpdated: null }),
  ]);
  expect(
    screen.getByRole('button', { name: 'Open: unavailable tasks' })
  ).toBeDisabled();
  expect(screen.getByText('Loading your work…')).toBeInTheDocument();
  expect(screen.getByLabelText('Task counts')).toHaveAttribute(
    'aria-busy',
    'true'
  );
});

it('reveals more attention rows and caps the initial filtered list at twenty', async () => {
  const user = userEvent.setup();
  renderDashboard([
    entry(
      personal,
      Array.from({ length: 25 }, (_, i) =>
        task(`Task ${i}`, { dueDate: addCalendarDays(today, -1) })
      )
    ),
  ]);
  const overdue = screen.getByRole('region', { name: 'Overdue' });
  expect(within(overdue).getAllByRole('listitem')).toHaveLength(5);
  await user.click(
    within(overdue).getByRole('button', { name: 'Show more overdue tasks' })
  );
  expect(within(overdue).getAllByRole('listitem')).toHaveLength(10);
  await user.click(screen.getByRole('button', { name: 'Open: 25 tasks' }));
  expect(screen.getAllByRole('listitem')).toHaveLength(20);
});

it('recalculates overdue work when the app regains focus on another day', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2030, 2, 15, 23, 59));
  try {
    renderDashboard([
      entry(personal, [task('Due tonight', { dueDate: '2030-03-15' })]),
    ]);
    expect(
      screen.getByRole('button', { name: 'Due today: 1 tasks' })
    ).toBeInTheDocument();
    vi.setSystemTime(new Date(2030, 2, 16, 1));
    fireEvent(window, new Event('focus'));
    expect(
      screen.getByRole('button', { name: 'Overdue: 1 tasks' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Due today: 0 tasks' })
    ).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});
