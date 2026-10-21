import { useState } from 'react';
import type { Task, Column } from '../types/task.ts';

export interface TaskCardProps {
  task: Task;
  status: Task['status'];
  columns?: Column[];
  moveTask: (id: string, newStatus: Task['status']) => void;
  deleteTask: (id: string) => void;
  openTask: (task: Task) => void;
}

const priorityBadge: Record<Task['priority'], string> = {
  low: 'bg-[var(--surface)] text-[var(--text-muted)]',
  medium: 'bg-[var(--priority-medium-bg)] text-[var(--priority-medium)]',
  high: 'bg-[var(--danger-bg)] text-[var(--danger)]',
};

const priorityRail: Record<Task['priority'], string> = {
  low: 'bg-[var(--todo)]',
  medium: 'bg-[var(--progress)]',
  high: 'bg-[var(--danger)]',
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatDueDate(value: string, overdue: boolean): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  ).getTime();
  const startOfDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ).getTime();
  const dayDifference = Math.round((startOfDate - startOfToday) / 86_400_000);

  if (overdue) {
    const daysLate = Math.max(1, Math.abs(dayDifference));
    return `${daysLate} day${daysLate === 1 ? '' : 's'} late`;
  }
  if (dayDifference === 0) return 'Due today';
  if (dayDifference === 1) return 'Due tomorrow';
  return `Due ${formatDate(value)}`;
}

export const TaskCard = ({
  task,
  status,
  columns,
  moveTask,
  deleteTask,
  openTask,
}: TaskCardProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [loadedAt] = useState(() => Date.now());
  const isOverdue =
    task.dueDate !== null &&
    new Date(task.dueDate).getTime() < loadedAt &&
    status !== 'done';

  return (
    <article
      className={`relative cursor-grab overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-left shadow-[var(--shadow-sm)] transition-[box-shadow,border-color,background-color] active:cursor-grabbing hover:border-[var(--border)] hover:shadow-[var(--shadow-md)] ${isOverdue ? 'border-[var(--danger-border)] shadow-[inset_0_0_0_1px_var(--danger-border)]' : ''}`}
      draggable="true"
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('taskId', task.id);
      }}
    >
      <div
        className={`absolute inset-y-0 left-0 w-1 ${priorityRail[task.priority]}`}
        aria-hidden="true"
      />
      <div className="p-3.5 pl-4">
        <div className="mb-1.5 flex items-start gap-2">
          <span
            className="mt-1.5 shrink-0 text-[var(--border)]"
            title="Drag task"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 12 16"
              fill="currentColor"
              aria-hidden="true"
            >
              <circle cx="3" cy="3" r="1.2" />
              <circle cx="9" cy="3" r="1.2" />
              <circle cx="3" cy="8" r="1.2" />
              <circle cx="9" cy="8" r="1.2" />
              <circle cx="3" cy="13" r="1.2" />
              <circle cx="9" cy="13" r="1.2" />
            </svg>
          </span>
          <button
            type="button"
            className="min-w-0 flex-1 cursor-pointer break-words text-left text-[0.95rem] leading-snug font-semibold text-[var(--text)] underline-offset-2 hover:text-[var(--accent)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            onClick={() => openTask(task)}
          >
            {task.title}
          </button>
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[0.65rem] font-semibold capitalize ${priorityBadge[task.priority]}`}
          >
            {task.priority}
          </span>
          <button
            type="button"
            className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            aria-label={`Actions for ${task.title}`}
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            <span aria-hidden="true" className="text-lg leading-none">
              ⋮
            </span>
          </button>
        </div>

        {task.description && (
          <p className="m-0 line-clamp-2 break-words text-[0.82rem] leading-snug text-[var(--text-muted)]">
            {task.description}
          </p>
        )}

        {(task.startedAt || task.dueDate || task.expectedFinishAt) && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
            {task.dueDate && (
              <span
                className={`font-medium ${isOverdue ? 'text-[var(--danger)]' : 'text-[var(--text)]'}`}
              >
                {isOverdue ? 'Overdue · ' : ''}
                {formatDueDate(task.dueDate, isOverdue)}
              </span>
            )}
            {task.startedAt && (
              <span>Started {formatDate(task.startedAt)}</span>
            )}
            {task.expectedFinishAt && (
              <span>Target {formatDate(task.expectedFinishAt)}</span>
            )}
          </div>
        )}
      </div>

      {isMenuOpen && (
        <div
          className="absolute right-3 top-11 z-10 min-w-32 rounded-md border border-[var(--border)] bg-[var(--surface-raised)] p-1 shadow-[var(--shadow-md)]"
          role="menu"
        >
          <button
            type="button"
            className="block w-full cursor-pointer rounded px-2.5 py-1.5 text-left text-xs font-medium text-[var(--text)] hover:bg-[var(--surface)]"
            onClick={() => {
              setIsMenuOpen(false);
              openTask(task);
            }}
            role="menuitem"
          >
            Edit task
          </button>
          {columns &&
            columns.length > 1 &&
            columns
              .filter((col) => col.id !== status)
              .map((col) => (
                <button
                  key={col.id}
                  type="button"
                  className="block w-full cursor-pointer rounded px-2.5 py-1.5 text-left text-xs font-medium text-[var(--text)] hover:bg-[var(--surface)]"
                  onClick={() => {
                    setIsMenuOpen(false);
                    moveTask(task.id, col.id);
                  }}
                  role="menuitem"
                >
                  Move to {col.title}
                </button>
              ))}
          <button
            type="button"
            className="block w-full cursor-pointer rounded px-2.5 py-1.5 text-left text-xs font-medium text-[var(--danger)] hover:bg-[var(--danger-bg)]"
            onClick={() => {
              setIsMenuOpen(false);
              deleteTask(task.id);
            }}
            role="menuitem"
          >
            Archive task
          </button>
        </div>
      )}
    </article>
  );
};
