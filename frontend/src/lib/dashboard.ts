import type { WorkspaceBoardEntry } from '../board/types';
import type { Task } from '../types/task';
import type { Workspace } from '../types/workspace';

export interface DashboardTask extends Task {
  source: Workspace;
  statusLabel: string;
}

export type DashboardView = 'open' | 'overdue' | 'today' | 'done' | 'upcoming';

// Dates entered by the user are calendar dates, including after PostgreSQL
// serializes them as midnight timestamps. Do not shift them through local time.
export function calendarDate(value: string | null): string | null {
  const prefix = value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!prefix) return null;
  const parsed = new Date(`${prefix}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== prefix
    ? null
    : prefix;
}

export function localCalendarDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function addCalendarDays(value: string, count: number): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() + count);
  return localCalendarDate(date);
}

export function displayCalendarDate(
  value: string | null,
  today: string
): string {
  const date = calendarDate(value);
  if (!date) return 'No due date';
  if (date === today) return 'Today';
  if (date === addCalendarDays(today, 1)) return 'Tomorrow';
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    ...(year !== Number(today.slice(0, 4)) ? { year: 'numeric' as const } : {}),
  }).format(new Date(year, month - 1, day, 12));
}

export function selectDashboardTasks(
  entries: WorkspaceBoardEntry[],
  workspaceId = 'all'
): DashboardTask[] {
  return entries.flatMap(({ workspace, storage }) =>
    storage.available && (workspaceId === 'all' || workspace.id === workspaceId)
      ? storage.board.tasks
          .filter((task) => !task.archivedAt)
          .map((task) => ({
            ...task,
            source: workspace,
            statusLabel:
              storage.board.columns.find((column) => column.id === task.status)
                ?.title ?? task.status,
          }))
      : []
  );
}

export function tasksForView(
  tasks: DashboardTask[],
  view: DashboardView,
  today: string
): DashboardTask[] {
  const end = addCalendarDays(today, 6);
  const priority = { high: 0, medium: 1, low: 2 };
  return tasks
    .filter((task) => {
      const done = task.status === 'done';
      const due = calendarDate(task.dueDate);
      if (view === 'done') return done;
      if (done) return false;
      if (view === 'open') return true;
      if (!due) return false;
      if (view === 'overdue') return due < today;
      if (view === 'today') return due === today;
      return due >= today && due <= end;
    })
    .sort(
      (a, b) =>
        (calendarDate(a.dueDate) ?? '9999-12-31').localeCompare(
          calendarDate(b.dueDate) ?? '9999-12-31'
        ) ||
        priority[a.priority] - priority[b.priority] ||
        a.title.localeCompare(b.title) ||
        a.source.id.localeCompare(b.source.id) ||
        a.id.localeCompare(b.id)
    );
}

export function dashboardCounts(tasks: DashboardTask[], today: string) {
  const counts = { open: 0, overdue: 0, today: 0, done: 0 };
  for (const task of tasks) {
    if (task.status === 'done') {
      counts.done += 1;
      continue;
    }
    counts.open += 1;
    const due = calendarDate(task.dueDate);
    if (due && due < today) counts.overdue += 1;
    if (due === today) counts.today += 1;
  }
  return counts;
}
