import { useId, useRef, useState } from 'react';
import { ActionMenu } from './ActionMenu';
import type { Task } from '../types/task.ts';

export interface TaskCardProps {
  task: Task;
  status: Task['status'];
  onArchiveTask: (task: Task) => void;
  onDragEnd: () => void;
  openTask: (task: Task, mode?: 'details' | 'edit') => void;
}

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
  onArchiveTask,
  onDragEnd,
  openTask,
}: TaskCardProps) => {
  const titleId = useId();
  const suppressClick = useRef(false);
  const blockDrag = useRef(false);
  const primary = useRef<HTMLButtonElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loadedAt] = useState(() => Date.now());
  const isOverdue =
    task.dueDate !== null &&
    new Date(task.dueDate).getTime() < loadedAt &&
    status !== 'done';

  return (
    <article
      className={`board-task-card${isOverdue ? ' board-task-overdue' : ''}${dragging ? ' board-task-dragging' : ''}`}
      draggable="true"
      onPointerDownCapture={(event) => {
        suppressClick.current = false;
        blockDrag.current =
          event.target instanceof Element &&
          Boolean(event.target.closest('[data-card-actions]'));
      }}
      onClick={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest('[data-card-actions]')
        )
          return;
        if (suppressClick.current) return;
        primary.current?.focus();
        openTask(task);
      }}
      onDragStart={(event) => {
        if (blockDrag.current) {
          event.preventDefault();
          return;
        }
        suppressClick.current = true;
        setDragging(true);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('taskId', task.id);
      }}
      onDragEnd={() => {
        setDragging(false);
        onDragEnd();
      }}
    >
      <div
        className={`board-priority-rail ${priorityRail[task.priority]}`}
        aria-hidden="true"
      />
      <div className="board-task-heading">
        <h3 id={titleId}>
          <button
            ref={primary}
            type="button"
            className="board-task-open"
            aria-haspopup="dialog"
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ')
                suppressClick.current = false;
            }}
          >
            {task.title}
          </button>
        </h3>
        <ActionMenu
          label={`Actions for ${task.title}`}
          items={[
            { label: 'Edit task', onSelect: () => openTask(task, 'edit') },
            {
              label: 'Archive task',
              danger: true,
              onSelect: () => onArchiveTask(task),
            },
          ]}
        />
      </div>
      {task.description.trim() && (
        <p className="board-task-description">{task.description}</p>
      )}
      <div className="board-task-metadata">
        <span
          className={`board-priority-badge board-priority-${task.priority}`}
        >
          {task.priority}
        </span>
        {task.dueDate && (
          <span className={isOverdue ? 'board-date-overdue' : 'board-due-date'}>
            {isOverdue ? 'Overdue · ' : ''}
            {formatDueDate(task.dueDate, isOverdue)}
          </span>
        )}
        {task.startedAt && <span>Started {formatDate(task.startedAt)}</span>}
        {task.expectedFinishAt && (
          <span>Target {formatDate(task.expectedFinishAt)}</span>
        )}
      </div>
    </article>
  );
};
