import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { apiRequest, requestError } from '../lib/api';
import type { AccountWorkspaces, Workspace } from '../types/workspace';
import type { Task } from '../types/task';
import type { ThemeProps } from '../component/AuthLayout';
import { AuthLayout } from '../component/AuthLayout';
import { WorkspaceBoardsProvider } from '../board/WorkspaceBoardsProvider';
import { useWorkspaceBoards } from '../board/useWorkspaceBoards';
import { DashboardShell } from '../component/DashboardShell';
import { WorkspaceTaskDialog } from '../component/WorkspaceTaskDialog';
import { AccountSettings } from './AccountSettings';
import Dashboard from './Dashboard';
import Home from './Home';

export default function SignedInApp(theme: ThemeProps) {
  const { session, signOut } = useAuth();
  const [me, setMe] = useState<AccountWorkspaces | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<AccountWorkspaces>('/api/me', { signal: controller.signal })
      .then((value) => {
        if (
          !value.workspaces?.some((workspace) => workspace.kind === 'personal')
        )
          throw new Error(
            'Your personal workspace is not available yet. Please try again.'
          );
        if (!controller.signal.aborted) setMe(value);
      })
      .catch((cause) => {
        if (!controller.signal.aborted && cause?.name !== 'AbortError')
          setError(requestError(cause));
      });
    return () => controller.abort();
  }, [attempt]);
  if (error)
    return (
      <AuthLayout {...theme} title="Unable to open your workspace">
        <p className="auth-error" role="alert">
          {error}
        </p>
        <button
          className="auth-primary"
          onClick={() => {
            setError('');
            setAttempt((value) => value + 1);
          }}
        >
          Try again
        </button>
        <button
          className="auth-secondary"
          onClick={() =>
            void signOut().catch((cause) => setError(requestError(cause)))
          }
        >
          Sign out
        </button>
      </AuthLayout>
    );
  if (!me || !session)
    return (
      <AuthLayout {...theme} title="Opening your workspace">
        <p role="status">Loading your workspaces…</p>
      </AuthLayout>
    );
  return (
    <WorkspaceBoardsProvider
      userId={session.user.id}
      workspaces={me.workspaces}
    >
      <SignedInViews {...theme} me={me} />
    </WorkspaceBoardsProvider>
  );
}

function SignedInViews({
  me,
  ...theme
}: ThemeProps & { me: AccountWorkspaces }) {
  const { session, signOut, error } = useAuth();
  const { entries, refresh, hasPending } = useWorkspaceBoards();
  const [selection, setSelection] = useState<{
    workspace: Workspace;
    taskId: string;
  } | null>(null);
  const accountEmail = session?.user.email ?? me.user.email ?? '';
  const guardedSignOut = async () => {
    if (entries.some(({ storage }) => storage.saving))
      throw new Error('Wait for the current save before signing out.');
    if (
      hasPending &&
      !window.confirm(
        'There are unsaved cloud changes. Sign out and discard them?'
      )
    )
      return;
    await signOut();
  };
  return (
    <DashboardShell
      {...theme}
      workspaces={me.workspaces}
      accountEmail={accountEmail}
      onSignOut={guardedSignOut}
    >
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
          element={
            <Dashboard
              entries={entries}
              onRefresh={refresh}
              onOpenTask={(workspace: Workspace, task: Task) =>
                setSelection({ workspace, taskId: task.id })
              }
            />
          }
        />
        <Route
          path="/boards/:workspaceId"
          element={
            <WorkspaceBoardRoute
              {...theme}
              workspaces={me.workspaces}
              accountEmail={accountEmail}
              onSignOut={guardedSignOut}
            />
          }
        />
        <Route
          path="/account"
          element={
            <AccountSettings
              {...theme}
              accountEmail={accountEmail}
              onBeforePasswordReset={() => {
                if (entries.some(({ storage }) => storage.saving)) return false;
                return (
                  !hasPending ||
                  window.confirm(
                    'There are unsaved cloud changes. Leave the dashboard and discard them?'
                  )
                );
              }}
            />
          }
        />
        <Route
          path="*"
          element={
            <div className="workspace-unavailable">
              <h1>Page not found</h1>
              <Link to="/dashboard">Go to dashboard</Link>
            </div>
          }
        />
      </Routes>
      {selection && (
        <WorkspaceTaskDialog
          key={`${selection.workspace.id}:${selection.taskId}`}
          {...selection}
          onClose={() => setSelection(null)}
        />
      )}
    </DashboardShell>
  );
}

function WorkspaceBoardRoute({
  workspaces,
  ...props
}: ThemeProps & {
  workspaces: Workspace[];
  accountEmail: string;
  onSignOut: () => Promise<void>;
}) {
  const { workspaceId } = useParams();
  const workspace = workspaces.find(
    (workspace) => workspace.id === workspaceId
  );
  if (!workspace)
    return (
      <div className="workspace-unavailable" role="alert">
        <h1>Board unavailable</h1>
        <p>You do not have access to this board.</p>
        <Link to="/dashboard">Go to dashboard</Link>
      </div>
    );
  return (
    <Home
      key={workspace.id}
      {...props}
      workspaceId={workspace.id}
      embedded
      boardTitle={
        workspace.kind === 'personal' ? 'Personal board' : workspace.name
      }
      workspaceRole={workspace.role}
      allowDeviceImport={workspace.kind === 'personal'}
    />
  );
}
