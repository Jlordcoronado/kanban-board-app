import type { Task, Column } from '../types/task.ts';

const boardLoadedAt = Date.now();

export interface TaskCardProps {
  task: Task;
  status: Task['status'];
  columns?: Column[];
  moveTask: (id: string, newStatus: Task['status']) => void;
  deleteTask: (id: string) => void;
  openTask: (task: Task) => void;
}

const actionBtn =
  'cursor-pointer rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--surface-raised)] hover:text-[var(--accent)]';

const priorityBadge: Record<Task['priority'], string> = {
  low: 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]',
  medium: 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]',
  high: 'border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)]',
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

export const TaskCard = ({
  task,
  status,
  columns,
  moveTask,
  deleteTask,
  openTask,
}: TaskCardProps) => {
  const isOverdue =
    task.dueDate !== null &&
    new Date(task.dueDate).getTime() < boardLoadedAt &&
    status !== 'done';

  return (
    <div
      className={`cursor-grab rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3.5 py-3.5 text-left shadow-[var(--shadow-sm)] transition-[box-shadow,transform,border-color] active:cursor-grabbing hover:border-[var(--border)] hover:shadow-[var(--shadow-md)] ${isOverdue ? 'border-[var(--danger-border)] shadow-[inset_0_0_0_1px_var(--danger-border)]' : ''}`}
      draggable="true"
      onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
      onClick={() => openTask(task)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') openTask(task);
      }}
      role="button"
      tabIndex={0}
    >
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <h3 className="m-0 min-w-0 flex-1 break-words text-[0.95rem] leading-snug font-semibold text-[var(--text)]">
          {task.title}
        </h3>
        <div
          className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[0.65rem] font-medium capitalize ${priorityBadge[task.priority]}`}
        >
          {task.priority}
        </div>
      </div>
      {task.description && (
        <p className="m-0 text-[0.82rem] leading-snug text-[var(--text-muted)] break-words">
          {task.description}
        </p>
      )}
      {(task.startedAt || task.dueDate || task.expectedFinishAt) && (
        <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs text-[var(--text-muted)]">
          {task.startedAt && <span>Started {formatDate(task.startedAt)}</span>}
          {task.dueDate && (
            <span className={isOverdue ? 'font-medium text-[var(--danger)]' : ''}>
              {isOverdue ? 'Overdue' : `Due ${formatDate(task.dueDate)}`}
            </span>
          )}
          {task.expectedFinishAt && <span>Est. {formatDate(task.expectedFinishAt)}</span>}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-1.5 border-t border-[var(--border-subtle)] pt-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className={actionBtn}
            onClick={(e) => {
              e.stopPropagation();
              openTask(task);
            }}
          >
            Edit
          </button>
          {columns
            ? columns
                .filter((col) => col.id !== status)
                .map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    className={actionBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveTask(task.id, col.id);
                    }}
                  >
                    {col.title}
                  </button>
                ))
            : null}
        </div>
        <button
          type="button"
          className={`${actionBtn} border-[var(--danger-border)] text-[var(--danger)] hover:border-[var(--danger)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger)]`}
          onClick={(e) => {
            e.stopPropagation();
            deleteTask(task.id);
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
};

