import type { Task } from '../types/task.ts';

export interface TaskCardProps {
  task: Task;
  status: Task['status'];
  moveTask: (id: string, newStatus: Task['status']) => void;
  deleteTask: (id: string) => void;
}

const accentBorder: Record<Task['status'], string> = {
  todo: 'border-l-[var(--todo)]',
  'in progress': 'border-l-[var(--progress)]',
  done: 'border-l-[var(--done)]',
};

const actionBtn =
  'cursor-pointer rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 font-mono text-[0.68rem] text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--surface-raised)] hover:text-[var(--accent)]';

export const TaskCard = ({ task, status, moveTask, deleteTask }: TaskCardProps) => {
  return (
    <div
      className={`cursor-grab rounded-md border border-[var(--border-subtle)] border-l-[3px] bg-[var(--surface-raised)] px-3.5 py-3.5 text-left shadow-[var(--shadow-sm)] transition-[box-shadow,transform,border-color] active:cursor-grabbing hover:border-[var(--border)] hover:shadow-[var(--shadow-md)] ${accentBorder[status]}`}
      draggable="true"
      onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
    >
      <h3 className="m-0 mb-1.5 text-[0.95rem] leading-snug font-semibold text-[var(--text)]">
        {task.title}
      </h3>
      {task.description && (
        <p className="m-0 text-[0.82rem] leading-snug text-[var(--text-muted)]">
          {task.description}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[var(--border-subtle)] pt-2.5">
        {status !== 'todo' && (
          <button type="button" className={actionBtn} onClick={() => moveTask(task.id, 'todo')}>
            To Do
          </button>
        )}
        {status !== 'in progress' && (
          <button
            type="button"
            className={actionBtn}
            onClick={() => moveTask(task.id, 'in progress')}
          >
            In Progress
          </button>
        )}
        {status !== 'done' && (
          <button type="button" className={actionBtn} onClick={() => moveTask(task.id, 'done')}>
            Done
          </button>
        )}
        <button
          type="button"
          className={`${actionBtn} ml-auto border-[var(--danger-border)] text-[var(--danger)] hover:border-[var(--danger)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger)]`}
          onClick={() => deleteTask(task.id)}
        >
          Delete
        </button>
      </div>
    </div>
  );
};
