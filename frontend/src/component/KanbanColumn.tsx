import { useState, useEffect } from 'react';
import type { Task, Column } from '../types/task.ts';
import { TaskCard } from './TaskCard.tsx';

interface KanbanColumnProps {
  status: Task['status'];
  title: string;
  tasks: Task[];
  columns?: Column[];
  moveTask: (id: string, newStatus: Task['status']) => void;
  deleteTask: (id: string) => void;
  openTask: (task: Task) => void;
  dragOverColumn: Task['status'] | null;
  setDragOverColumn: (status: Task['status'] | null) => void;
  onRenameColumn?: (id: string, newTitle: string) => void;
  onDeleteColumn?: (id: string) => void;
  onAddTask?: (status: Task['status']) => void;
}

export const KanbanColumn = ({
  status,
  title,
  tasks,
  columns,
  moveTask,
  deleteTask,
  openTask,
  dragOverColumn,
  setDragOverColumn,
  onRenameColumn,
  onDeleteColumn,
  onAddTask,
}: KanbanColumnProps) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(title);

  useEffect(() => {
    setTempTitle(title);
  }, [title]);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (tempTitle.trim() && tempTitle.trim() !== title && onRenameColumn) {
      onRenameColumn(status, tempTitle.trim());
    } else {
      setTempTitle(title);
    }
  };

  const isDragOver = dragOverColumn === status;

  return (
    <div
      className={`flex max-h-[calc(100vh-16rem)] min-h-80 flex-col overflow-hidden rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] transition-[border-color,box-shadow,background-color] ${isDragOver ? 'border-[var(--accent)] bg-[var(--surface-raised)] shadow-[inset_0_0_0_1px_var(--accent)]' : ''}`}
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
        <div className="flex flex-1 items-center gap-2">
          {isEditingTitle ? (
            <input
              type="text"
              className="w-full rounded border border-[var(--accent)] bg-[var(--surface-raised)] px-2 py-1 text-sm font-semibold text-[var(--text)] focus:outline-none"
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSubmit();
                if (e.key === 'Escape') {
                  setTempTitle(title);
                  setIsEditingTitle(false);
                }
              }}
              autoFocus
            />
          ) : (
            <div className="group flex items-center gap-1.5 cursor-pointer" onClick={() => setIsEditingTitle(true)}>
              <h2 className="m-0 text-sm font-semibold text-[var(--text)] hover:text-[var(--accent)]" title="Click to rename column">
                {title}
              </h2>
              <button
                type="button"
                className="opacity-0 transition-opacity group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--accent)]"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingTitle(true);
                }}
                aria-label="Rename column"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-0.5 text-xs font-medium text-[var(--text-muted)]">
            {tasks.length}
          </span>
          {onAddTask && (
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--accent)]"
              onClick={() => onAddTask(status)}
              title="Add task to this column"
              aria-label="Add task to column"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
          {onDeleteColumn && (
            <button
              type="button"
              className="text-[var(--text-muted)] hover:text-[var(--danger)]"
              onClick={() => onDeleteColumn(status)}
              title="Delete column"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-3">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <p className="m-0 text-[0.85rem] text-[var(--text-muted)] italic">
              No tasks here yet
            </p>
            {onAddTask && (
              <button
                type="button"
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline cursor-pointer"
                onClick={() => onAddTask(status)}
              >
                + Add task
              </button>
            )}
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              status={status}
              columns={columns}
              moveTask={moveTask}
              deleteTask={deleteTask}
              openTask={openTask}
            />
          ))
        )}
      </div>

      {onAddTask && (
        <div className="border-t border-[var(--border-subtle)] p-2">
          <button
            type="button"
            className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--accent)]"
            onClick={() => onAddTask(status)}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Add Task
          </button>
        </div>
      )}
    </div>
  );
};
