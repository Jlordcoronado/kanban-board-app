import { useState, useLayoutEffect, useRef, useId } from 'react';
import type { Task, Column } from '../types/task.ts';
import { TaskCard } from './TaskCard.tsx';
import { ActionMenu } from './ActionMenu';

interface KanbanColumnProps {
  status: Task['status'];
  title: string;
  tasks: Task[];
  columns?: Column[];
  moveTask: (id: string, newStatus: Task['status']) => void;
  onArchiveTask: (task: Task) => void;
  openTask: (task: Task, mode?: 'details' | 'edit') => void;
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
  onArchiveTask,
  openTask,
  dragOverColumn,
  setDragOverColumn,
  onRenameColumn,
  onDeleteColumn,
  onAddTask,
}: KanbanColumnProps) => {
  const titleId = useId();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(title);
  const editing = useRef(false);
  const titleInput = useRef<HTMLInputElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    if (isEditingTitle) {
      titleInput.current?.focus();
      titleInput.current?.select();
    }
  }, [isEditingTitle]);
  const finishRename = (save: boolean, restoreFocus = true) => {
    if (!editing.current) return;
    editing.current = false;
    setIsEditingTitle(false);
    const next = tempTitle.trim();
    if (save && next && next !== title) onRenameColumn?.(status, next);
    if (restoreFocus) menuTrigger.current?.focus();
  };
  const isDragOver = dragOverColumn === status;

  return (
    <section
      aria-labelledby={titleId}
      className={`board-column flex min-h-80 w-[19rem] shrink-0 flex-col overflow-hidden rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] ${isDragOver ? 'board-column-drag-over' : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDragOverColumn(status);
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDragOverColumn(status);
      }}
      onDragLeave={(event) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        )
          setDragOverColumn(null);
      }}
      onDrop={(event) => {
        event.preventDefault();
        const id = event.dataTransfer.getData('taskId');
        if (id && !tasks.some((task) => task.id === id)) moveTask(id, status);
        setDragOverColumn(null);
      }}
    >
      <div className="board-column-header">
        {isEditingTitle ? (
          <input
            ref={titleInput}
            className="board-column-name-input"
            aria-label={`Column name for ${title}`}
            value={tempTitle}
            maxLength={100}
            onChange={(event) => setTempTitle(event.target.value)}
            onBlur={() => finishRename(true, false)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === 'Enter' || event.key === 'Escape') {
                event.preventDefault();
                finishRename(event.key === 'Enter');
              }
            }}
          />
        ) : (
          <h2 id={titleId} title={title}>
            {title}
          </h2>
        )}
        {isEditingTitle && (
          <span className="sr-only" id={titleId}>
            {title}
          </span>
        )}
        <span
          className="board-column-count"
          aria-label={`${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`}
        >
          {tasks.length}
        </span>
        {onAddTask && (
          <button
            type="button"
            className="board-icon-button"
            aria-label={`Add task to ${title}`}
            title="Add task to this column"
            onClick={() => onAddTask(status)}
          >
            <span aria-hidden="true">+</span>
          </button>
        )}
        {(onRenameColumn || onDeleteColumn) && (
          <ActionMenu
            label={`Actions for column ${title}`}
            triggerRef={menuTrigger}
            items={[
              ...(onRenameColumn
                ? [
                    {
                      label: 'Rename column',
                      onSelect: () => {
                        setTempTitle(title);
                        editing.current = true;
                        setIsEditingTitle(true);
                      },
                    },
                  ]
                : []),
              ...(onDeleteColumn
                ? [
                    {
                      label: 'Delete column',
                      danger: true,
                      disabled: (columns?.length ?? 1) <= 1,
                      onSelect: () => onDeleteColumn(status),
                    },
                  ]
                : []),
            ]}
          />
        )}
      </div>
      <div className="board-column-tasks">
        {tasks.length === 0 ? (
          <div
            className={`board-column-empty${isDragOver ? ' board-column-empty-active' : ''}`}
          >
            <p>{isDragOver ? 'Drop task here' : `Nothing in ${title}`}</p>
            {!isDragOver && <p>Add the next piece of work here.</p>}
            {onAddTask && !isDragOver && (
              <button type="button" onClick={() => onAddTask(status)}>
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
              onArchiveTask={onArchiveTask}
              openTask={openTask}
              onDragEnd={() => setDragOverColumn(null)}
            />
          ))
        )}
      </div>
      {onAddTask && (
        <div className="board-column-footer">
          <button type="button" onClick={() => onAddTask(status)}>
            + Add task
          </button>
        </div>
      )}
    </section>
  );
};
