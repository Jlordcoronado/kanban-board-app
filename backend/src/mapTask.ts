import type { TaskRow } from './db.js';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  startedAt: string | null;
  dueDate: string | null;
  expectedFinishAt: string | null;
  comment: string | null;
}

export function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    status: row.status as Task['status'],
    priority: (row.priority ?? 'medium') as Task['priority'],
    startedAt: row.started_at,
    dueDate: row.due_date,
    expectedFinishAt: row.expected_finish_at,
    comment: row.comment,
  };
}
