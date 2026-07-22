export interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: 'low' | 'medium' | 'high';
  startedAt: string | null;
  dueDate: string | null;
  expectedFinishAt: string | null;
}

export interface Column {
  id: string;
  title: string;
}

