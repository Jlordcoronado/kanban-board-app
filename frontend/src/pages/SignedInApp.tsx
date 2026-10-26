import { useState } from 'react';
import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useAuth } from '../auth/context';
import type { Workspace } from '../types/workspace';
import type { Task } from '../types/task';
import type { ThemeProps } from '../component/AuthLayout';
import { useWorkspaceBoards } from '../board/useWorkspaceBoards';
import { DashboardShell } from '../component/DashboardShell';
import { WorkspaceTaskDialog } from '../component/WorkspaceTaskDialog';
import { AccountSettings } from './AccountSettings';
import Dashboard from './Dashboard';
import Home from './Home';

export default function SignedInApp(theme: ThemeProps) {
  const { session, signOut, error } = useAuth();
  const { entries, refresh, hasPending } = useWorkspaceBoards();
  const workspaces = entries.map(({ workspace }) => workspace);
  const [selection, setSelection] = useState<{
    workspace: Workspace;
    taskId: string;
  } | null>(null);
  const accountEmail = session?.user.email ?? '';
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
      workspaces={workspaces}
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
              workspaces={workspaces}
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
