import type { Task } from '../types/task.ts';
import { TaskCard } from './TaskCard.tsx';

interface KanbanColumnProps {
  status: Task['status'];
  title: string;
  tasks: Task[];
  moveTask: (id: string, newStatus: Task['status']) => void;
  deleteTask: (id: string) => void;
  dragOverColumn: Task['status'] | null;
  setDragOverColumn: (status: Task['status'] | null) => void;
}

const accentBorder: Record<Task['status'], string> = {
  todo: 'border-l-[var(--todo)]',
  'in progress': 'border-l-[var(--progress)]',
  done: 'border-l-[var(--done)]',
};

const dragOverStyles: Record<Task['status'], string> = {
  todo: 'border-[var(--todo)] bg-[var(--surface-raised)] shadow-[inset_0_0_0_1px_var(--todo)]',
  'in progress':
    'border-[var(--progress)] bg-[var(--surface-raised)] shadow-[inset_0_0_0_1px_var(--progress)]',
  done: 'border-[var(--done)] bg-[var(--surface-raised)] shadow-[inset_0_0_0_1px_var(--done)]',
};

export const KanbanColumn = ({
  status,
  title,
  tasks,
  moveTask,
  deleteTask,
  dragOverColumn,
  setDragOverColumn,
}: KanbanColumnProps) => {
  const isDragOver = dragOverColumn === status;

  return (
    <div
      className={`flex max-h-[calc(100vh-16rem)] min-h-80 flex-col overflow-hidden rounded-[10px] border border-[var(--border-subtle)] border-l-[3px] bg-[var(--surface)] transition-[border-color,box-shadow,background-color] ${accentBorder[status]} ${isDragOver ? dragOverStyles[status] : ''}`}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={() => setDragOverColumn(status)}
      onDragLeave={() => setDragOverColumn(null)}
      onDrop={(e) => {
        const id = e.dataTransfer.getData('taskId');
        moveTask(id, status);
        setDragOverColumn(null);
      }}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-4 py-3.5">
        <h2 className="m-0 text-[0.8rem] font-semibold tracking-wider text-[var(--text)] uppercase">
          {title}
        </h2>
        <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-0.5 font-mono text-xs font-medium text-[var(--text-muted)]">
          {tasks.length}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-3">
        {tasks.length === 0 ? (
          <p className="m-0 px-2 py-6 text-center text-[0.85rem] text-[var(--text-muted)] italic">
            No tasks here yet
          </p>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              status={status}
              moveTask={moveTask}
              deleteTask={deleteTask}
            />
          ))
        )}
      </div>
    </div>
  );
};
