import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Task, Column } from '../types/task.ts';
import { apiRequest, requestError } from '../lib/api';
import { Dialog } from './Dialog';

type Changes = Pick<
  Task,
  | 'title'
  | 'description'
  | 'priority'
  | 'status'
  | 'startedAt'
  | 'dueDate'
  | 'expectedFinishAt'
>;

interface TaskModalProps {
  workspaceId?: string;
  onSignIn?: () => void;
  onDraft?: (draft: Task) => void;
  onEditorEnd?: () => void;
  task: Task;
  initialMode?: 'details' | 'edit';
  initialDraft?: Task;
  columns?: Column[];
  onSave: (changes: Changes) => Promise<void>;
  onClose: () => void;
}

function dateInput(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function editableValues(task: Task): Changes {
  return {
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    startedAt: dateInput(task.startedAt) || null,
    dueDate: dateInput(task.dueDate) || null,
    expectedFinishAt: dateInput(task.expectedFinishAt) || null,
  };
}

function scheduleDate(value: string | null): string {
  const day = dateInput(value);
  if (!day) return 'Not set';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
    new Date(`${day}T12:00:00`)
  );
}

// A different task always starts a fresh dialog and cancels outstanding AI work.
export function TaskModal(props: TaskModalProps) {
  return <TaskDialog key={props.task.id} {...props} />;
}

function TaskDialog({
  task,
  columns = [],
  onSave,
  onClose,
  workspaceId,
  onSignIn,
  onDraft,
  onEditorEnd,
  initialMode = 'details',
  initialDraft,
}: TaskModalProps) {
  const isNew = !task.id;
  const [editor, setEditor] = useState(() =>
    isNew || initialMode === 'edit'
      ? {
          base: editableValues(
            isNew
              ? {
                  ...task,
                  title: '',
                  description: '',
                  priority: 'medium',
                  startedAt: null,
                  dueDate: null,
                  expectedFinishAt: null,
                }
              : task
          ),
          draft: editableValues(initialDraft ?? task),
        }
      : null
  );
  const [discardTo, setDiscardTo] = useState<'details' | 'close' | null>(null);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const saving = useRef(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [aiError, setAiError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const aiRequest = useRef<AbortController | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const helpId = 'task-description-help';
  const isEditing = editor !== null;
  const hasChanges =
    editor !== null &&
    JSON.stringify(editor.draft) !== JSON.stringify(editor.base);

  useEffect(() => {
    if (isEditing) titleRef.current?.focus();
    else editRef.current?.focus();
  }, [isEditing]);

  useEffect(() => {
    if (editor) onDraft?.({ ...task, ...editor.draft });
  }, [editor, onDraft, task]);

  useEffect(() => {
    if (!hasChanges) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasChanges]);

  useEffect(() => () => aiRequest.current?.abort(), []);

  const resetHelp = () => {
    aiRequest.current?.abort();
    aiRequest.current = null;
    setHelpOpen(false);
    setSuggestion('');
    setAiError('');
    setIsGenerating(false);
  };
  const endEditor = () => {
    resetHelp();
    setEditor(null);
    setError('');
    onEditorEnd?.();
  };
  const leave = (destination: 'details' | 'close') => {
    if (saving.current) return;
    if (hasChanges) {
      setDiscardTo(destination);
    } else if (destination === 'close') {
      onClose();
    } else {
      endEditor();
    }
  };
  const change = <K extends keyof Changes>(key: K, value: Changes[K]) => {
    setEditor(
      (current) =>
        current && {
          ...current,
          draft: { ...current.draft, [key]: value },
        }
    );
  };
  const generate = async () => {
    if (!editor || isGenerating) return;
    if (!workspaceId) {
      setAiError(
        'Sign in to use Gemini, then generate a suggestion when you are ready.'
      );
      onSignIn?.();
      return;
    }
    const title = editor.draft.title.trim();
    if (!title) {
      setAiError('Add a task title before using Gemini.');
      return;
    }
    const controller = new AbortController();
    aiRequest.current?.abort();
    aiRequest.current = controller;
    setAiError('');
    setIsGenerating(true);
    try {
      const data = await apiRequest<{ suggestedDescription?: unknown }>(
        '/api/ai/rewrite-task',
        {
          method: 'POST',
          workspaceId,
          signal: controller.signal,
          body: JSON.stringify({ title }),
        }
      );
      if (controller.signal.aborted) return;
      const text =
        typeof data?.suggestedDescription === 'string'
          ? data.suggestedDescription.trim()
          : '';
      if (!text)
        throw new Error('Gemini returned an empty suggestion. Try again.');
      if (text.length > 2000)
        throw new Error('The suggestion is too long. Try generating again.');
      setSuggestion(text);
    } catch (cause) {
      if (!controller.signal.aborted) setAiError(requestError(cause));
    } finally {
      if (!controller.signal.aborted) setIsGenerating(false);
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor || saving.current) return;
    const changes = { ...editor.draft, title: editor.draft.title.trim() };
    if (!changes.title) {
      setError('Title is required.');
      titleRef.current?.focus();
      return;
    }
    setError('');
    saving.current = true;
    setIsSaving(true);
    try {
      await onSave(changes);
      if (!isNew) endEditor();
    } catch {
      setError(
        'Unable to save this task. Your edits are still here. Try saving again.'
      );
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      title={isEditing ? (isNew ? 'New task' : 'Edit task') : 'Task details'}
      className="task-dialog"
      hideClose
      dismissOnBackdrop
      onClose={() => leave('close')}
    >
      <header className="task-dialog-header">
        <h2>
          {isEditing ? (isNew ? 'New task' : 'Edit task') : 'Task details'}
        </h2>
        <button
          type="button"
          className="task-close"
          aria-label="Close task dialog"
          onClick={() => leave('close')}
          disabled={isSaving}
        >
          ×
        </button>
      </header>
      {editor ? (
        <form className="task-form" onSubmit={submit}>
          <div className="task-dialog-body">
            <fieldset disabled={isSaving} className="task-fields">
              <label className="task-field">
                Title
                <input
                  ref={titleRef}
                  type="text"
                  value={editor.draft.title}
                  onChange={(e) => change('title', e.target.value)}
                  maxLength={200}
                  required
                />
              </label>
              <div>
                <label className="task-field">
                  Description
                  <textarea
                    value={editor.draft.description}
                    onChange={(e) => change('description', e.target.value)}
                    placeholder="Describe the work and what done looks like."
                    rows={5}
                    maxLength={2000}
                  />
                </label>
                <button
                  className="task-help-toggle"
                  type="button"
                  aria-expanded={helpOpen}
                  aria-controls={helpId}
                  onClick={() => setHelpOpen((open) => !open)}
                >
                  <span aria-hidden="true">{helpOpen ? '−' : '+'}</span> Help
                  write description
                </button>
                {helpOpen && (
                  <div className="task-help" id={helpId}>
                    <p>
                      Use Gemini to suggest a description from your title.
                      Review it before applying.
                    </p>
                    <button
                      className="task-button task-secondary"
                      type="button"
                      onClick={() => void generate()}
                      disabled={isGenerating}
                    >
                      {isGenerating
                        ? 'Generating…'
                        : workspaceId
                          ? 'Generate with Gemini'
                          : 'Sign in to use Gemini'}
                    </button>
                    {isGenerating && (
                      <p role="status">Generating a suggestion…</p>
                    )}
                    {aiError && (
                      <p className="task-error" role="alert">
                        {aiError}
                      </p>
                    )}
                    {suggestion && (
                      <div className="task-suggestion">
                        <h3>Suggested description</h3>
                        <p>{suggestion}</p>
                        <button
                          className="task-button task-secondary"
                          type="button"
                          disabled={isGenerating}
                          onClick={() => change('description', suggestion)}
                        >
                          Apply suggestion
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="task-metadata-fields">
                <label className="task-field">
                  Status
                  <select
                    value={editor.draft.status}
                    onChange={(e) => change('status', e.target.value)}
                  >
                    {!columns.some((col) => col.id === editor.draft.status) && (
                      <option value={editor.draft.status}>
                        {editor.draft.status || 'Not set'}
                      </option>
                    )}
                    {columns.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="task-field">
                  Priority
                  <select
                    value={editor.draft.priority}
                    onChange={(e) =>
                      change('priority', e.target.value as Task['priority'])
                    }
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>
              </div>
              <div className="task-date-fields">
                {(
                  [
                    ['startedAt', 'Start date'],
                    ['dueDate', 'Due date'],
                    ['expectedFinishAt', 'Target finish'],
                  ] as const
                ).map(([key, label]) => (
                  <label className="task-field" key={key}>
                    {label}
                    <input
                      type="date"
                      value={editor.draft[key] || ''}
                      onChange={(e) => change(key, e.target.value || null)}
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <footer className="task-dialog-footer">
            {error && (
              <p className="task-error" role="alert">
                {error}
              </p>
            )}
            <div className="task-actions">
              {!workspaceId && onSignIn && (
                <button
                  type="button"
                  className="task-cloud"
                  onClick={onSignIn}
                  disabled={isSaving}
                >
                  Save to cloud
                </button>
              )}
              <button
                className="task-button task-secondary"
                type="button"
                onClick={() => leave(isNew ? 'close' : 'details')}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                className="task-button task-primary"
                type="submit"
                disabled={isSaving}
              >
                {isSaving ? 'Saving…' : isNew ? 'Create task' : 'Save changes'}
              </button>
            </div>
          </footer>
        </form>
      ) : (
        <>
          <div className="task-dialog-body task-details">
            <h3 className="task-details-title">{task.title}</h3>
            <div className="task-badges">
              <span>
                <span className="sr-only">Status: </span>
                {columns.find((col) => col.id === task.status)?.title ||
                  task.status ||
                  'Not set'}
              </span>
              <span className={`task-priority-${task.priority}`}>
                <span className="sr-only">Priority: </span>
                {task.priority} priority
              </span>
            </div>
            <section className="task-description" aria-label="Description">
              <h4>Description</h4>
              <p className={task.description.trim() ? '' : 'task-empty'}>
                {task.description.trim() ? task.description : 'No description'}
              </p>
            </section>
            <dl className="task-schedule">
              {(
                [
                  ['startedAt', 'Start date'],
                  ['dueDate', 'Due date'],
                  ['expectedFinishAt', 'Target finish'],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{scheduleDate(task[key])}</dd>
                </div>
              ))}
            </dl>
          </div>
          <footer className="task-dialog-footer task-actions">
            <button
              className="task-button task-secondary"
              type="button"
              onClick={() => leave('close')}
            >
              Close
            </button>
            <button
              ref={editRef}
              className="task-button task-primary"
              type="button"
              onClick={() => {
                setEditor({
                  base: editableValues(task),
                  draft: editableValues(task),
                });
              }}
            >
              Edit task
            </button>
          </footer>
        </>
      )}
      {discardTo && (
        <Dialog
          title="Discard changes?"
          className="task-discard"
          hideClose
          onClose={() => setDiscardTo(null)}
        >
          <h2>Discard changes?</h2>
          <p>Your edits have not been saved.</p>
          <div className="task-actions">
            <button
              className="task-button task-secondary"
              type="button"
              onClick={() => setDiscardTo(null)}
            >
              Keep editing
            </button>
            <button
              className="task-button task-danger"
              type="button"
              onClick={() => {
                const destination = discardTo;
                setDiscardTo(null);
                if (destination === 'close') onClose();
                else endEditor();
              }}
            >
              Discard changes
            </button>
          </div>
        </Dialog>
      )}
    </Dialog>
  );
}
