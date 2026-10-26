import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { WorkspaceBoardEntry } from '../board/types';
import type { Task } from '../types/task';
import type { Workspace } from '../types/workspace';
import {
  calendarDate,
  dashboardCounts,
  displayCalendarDate,
  localCalendarDate,
  selectDashboardTasks,
  tasksForView,
  type DashboardTask,
  type DashboardView,
} from '../lib/dashboard';
import '../css/dashboard.css';

interface DashboardProps {
  entries: WorkspaceBoardEntry[];
  onOpenTask: (workspace: Workspace, task: Task) => void;
  onRefresh: () => Promise<void>;
}

const sourceName = (workspace: Workspace) =>
  workspace.kind === 'personal' ? 'Personal' : workspace.name;

function useCalendarToday() {
  const [today, setToday] = useState(localCalendarDate);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      const now = new Date();
      setToday(localCalendarDate(now));
      const nextDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1
      );
      timer = setTimeout(update, nextDay.getTime() - now.getTime() + 50);
    };
    update();
    window.addEventListener('focus', update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', update);
    };
  }, []);
  return today;
}

function TaskList({
  title,
  tasks,
  today,
  initialLimit = 5,
  empty,
  onOpenTask,
}: {
  title: string;
  tasks: DashboardTask[];
  today: string;
  initialLimit?: number;
  empty: string;
  onOpenTask: DashboardProps['onOpenTask'];
}) {
  const [limit, setLimit] = useState(initialLimit);
  return (
    <section className="dashboard-task-section" aria-label={title}>
      <div className="dashboard-section-heading">
        <h2>{title}</h2>
        <span
          className="dashboard-list-total"
          aria-label={`${tasks.length} tasks`}
        >
          {tasks.length}
        </span>
      </div>
      {tasks.length === 0 ? (
        <p className="dashboard-empty">{empty}</p>
      ) : (
        <ul className="dashboard-task-list">
          {tasks.slice(0, limit).map((task) => {
            const date = calendarDate(task.dueDate);
            const overdue =
              task.status !== 'done' && date !== null && date < today;
            return (
              <li key={`${task.source.id}:${task.id}`}>
                <button
                  className="dashboard-task"
                  type="button"
                  onClick={() => onOpenTask(task.source, task)}
                  aria-label={`Open ${task.title} from ${sourceName(task.source)}`}
                >
                  <span className="dashboard-task-main">
                    <span className="dashboard-task-title">{task.title}</span>
                    <span className="dashboard-task-meta">
                      <span className="dashboard-task-source">
                        {sourceName(task.source)}
                      </span>
                      <span className="dashboard-status">
                        {task.statusLabel}
                      </span>
                      <span
                        className={`dashboard-priority dashboard-priority-${task.priority}`}
                      >
                        {task.priority[0].toUpperCase() +
                          task.priority.slice(1)}{' '}
                        priority
                      </span>
                    </span>
                  </span>
                  <span
                    className={`dashboard-due${overdue ? ' dashboard-due-overdue' : ''}`}
                  >
                    {overdue && (
                      <span className="dashboard-overdue-label">Overdue</span>
                    )}
                    {date ? (
                      <time dateTime={date}>
                        {displayCalendarDate(task.dueDate, today)}
                      </time>
                    ) : (
                      <span>No due date</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {limit < tasks.length && (
        <button
          className="dashboard-more"
          type="button"
          aria-label={`Show more ${title.toLowerCase()} tasks`}
          onClick={() => setLimit((count) => count + initialLimit)}
        >
          Show more <span>({tasks.length - limit} remaining)</span>
        </button>
      )}
    </section>
  );
}

export default function Dashboard({
  entries,
  onOpenTask,
  onRefresh,
}: DashboardProps) {
  const [workspaceFilter, setWorkspaceFilter] = useState('all');
  const [view, setView] = useState<DashboardView | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const today = useCalendarToday();
  const filter = entries.some(
    ({ workspace }) => workspace.id === workspaceFilter
  )
    ? workspaceFilter
    : 'all';
  const relevant = entries.filter(
    ({ workspace }) => filter === 'all' || workspace.id === filter
  );
  const available = relevant.filter(({ storage }) => storage.available);
  const loading = relevant.some(({ storage }) => storage.loading);
  const incomplete = available.length < relevant.length;
  const noData = available.length === 0;
  const tasks = selectDashboardTasks(entries, filter);
  const counts = dashboardCounts(tasks, today);
  const metrics = [
    { key: 'open', label: 'Open', detail: 'Tasks still to finish' },
    { key: 'overdue', label: 'Overdue', detail: 'Past their due date' },
    { key: 'today', label: 'Due today', detail: 'For today' },
    { key: 'done', label: 'Done', detail: 'In the Done column' },
  ] as const;
  const lastUpdated = available
    .map(({ storage }) => storage.lastUpdated)
    .filter((value): value is number => value !== null);
  const oldestUpdate = lastUpdated.length ? Math.min(...lastUpdated) : null;
  const personal = entries.find(
    ({ workspace }) => workspace.kind === 'personal'
  )?.workspace;
  const runRefresh = async (action: () => Promise<void>) => {
    setRefreshing(true);
    setRefreshError('');
    try {
      await action();
    } catch {
      setRefreshError('Unable to refresh your work. Try again.');
    } finally {
      setRefreshing(false);
    }
  };
  const filteredTitle =
    metrics.find((metric) => metric.key === view)?.label ?? 'Tasks';

  return (
    <div className="dashboard-page">
      <header className="dashboard-heading">
        <div>
          <h1>Dashboard</h1>
          <p className="dashboard-date">
            {new Intl.DateTimeFormat(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            }).format(new Date())}
          </p>
        </div>
        <label className="dashboard-filter">
          <span>View work</span>
          <select
            value={filter}
            onChange={(event) => {
              setWorkspaceFilter(event.target.value);
              setView(null);
            }}
          >
            <option value="all">All work</option>
            {entries.map(({ workspace }) => (
              <option key={workspace.id} value={workspace.id}>
                {sourceName(workspace)}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="dashboard-refresh-line">
        <p>
          {oldestUpdate === null ? (
            'Your personal and team tasks'
          ) : (
            <>
              Updated{' '}
              <time dateTime={new Date(oldestUpdate).toISOString()}>
                {new Intl.DateTimeFormat(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                }).format(oldestUpdate)}
              </time>
            </>
          )}
        </p>
        <button
          type="button"
          disabled={refreshing || loading}
          onClick={() => void runRefresh(onRefresh)}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <path d="M20 7v5h-5M4 17v-5h5" />
            <path d="M6.1 7a7 7 0 0 1 11.6-2L20 8M4 16l2.3 3A7 7 0 0 0 17.9 17" />
          </svg>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {incomplete && (
        <p className="dashboard-notice" role="status">
          Totals are incomplete. Showing {available.length} of {relevant.length}{' '}
          boards.
          {loading
            ? ' Loading remaining work…'
            : ' Retry the unavailable boards below.'}
        </p>
      )}
      {relevant
        .filter(({ storage }) => !storage.available && storage.error)
        .map(({ workspace, storage }) => (
          <div
            key={workspace.id}
            className="dashboard-workspace-error"
            role="alert"
          >
            <div>
              <strong>{sourceName(workspace)} could not be loaded.</strong>
              <p>{storage.error}</p>
            </div>
            <button
              type="button"
              disabled={
                storage.loading || refreshing || Boolean(storage.pending)
              }
              onClick={() => void runRefresh(() => storage.refresh())}
            >
              Retry {sourceName(workspace)}
            </button>
          </div>
        ))}
      {refreshError && (
        <p className="dashboard-workspace-error" role="alert">
          {refreshError}
        </p>
      )}
      {entries
        .filter(({ storage }) => storage.pending)
        .map(({ workspace }) => (
          <p className="dashboard-notice" key={workspace.id}>
            Unsaved changes in {sourceName(workspace)}.{' '}
            <Link to={`/boards/${workspace.id}`}>Review pending save</Link>
          </p>
        ))}

      <div
        className="dashboard-metrics"
        aria-label="Task counts"
        aria-busy={noData && loading}
      >
        {metrics.map(({ key, label, detail }) => (
          <button
            type="button"
            key={key}
            className={`dashboard-metric${key === 'overdue' ? ' dashboard-metric-overdue' : ''}`}
            aria-pressed={view === key}
            aria-label={`${label}: ${noData ? 'unavailable' : counts[key]} tasks`}
            disabled={noData}
            onClick={() => setView((active) => (active === key ? null : key))}
          >
            <span className="dashboard-metric-label">{label}</span>
            <span
              className={`dashboard-metric-number${noData && loading ? ' dashboard-placeholder' : ''}`}
            >
              {noData ? '—' : counts[key]}
            </span>
            <span className="dashboard-metric-detail">{detail}</span>
          </button>
        ))}
      </div>

      {noData ? (
        <div className="dashboard-unavailable" role="status">
          <h2>{loading ? 'Loading your work…' : 'Your work is unavailable'}</h2>
          <p>
            {loading
              ? 'Your task counts and deadlines will appear here.'
              : 'Retry the workspaces above to see your tasks and deadlines.'}
          </p>
        </div>
      ) : view ? (
        <div className="dashboard-filtered">
          <button
            className="dashboard-back"
            type="button"
            onClick={() => setView(null)}
          >
            Back to overview
          </button>
          <TaskList
            key={`${filter}:${view}`}
            title={`${filteredTitle} tasks`}
            tasks={tasksForView(tasks, view, today)}
            today={today}
            initialLimit={20}
            empty={`No ${filteredTitle.toLowerCase()} tasks in this view.`}
            onOpenTask={onOpenTask}
          />
        </div>
      ) : (
        <div className="dashboard-attention" key={filter}>
          <TaskList
            title="Overdue"
            tasks={tasksForView(tasks, 'overdue', today)}
            today={today}
            empty="Nothing overdue. You're up to date here."
            onOpenTask={onOpenTask}
          />
          <TaskList
            title="Next 7 days"
            tasks={tasksForView(tasks, 'upcoming', today)}
            today={today}
            empty="No deadlines in the next seven days. Plan your next task from a board."
            onOpenTask={onOpenTask}
          />
        </div>
      )}

      {personal && (
        <footer className="dashboard-footer">
          <span>Create tasks and organize columns in your boards.</span>
          <Link to={`/boards/${personal.id}`}>Open personal board</Link>
        </footer>
      )}
    </div>
  );
}
