import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/context';
import { AuthLayout, type ThemeProps } from '../component/AuthLayout';
import { apiRequest, requestError } from '../lib/api';
import type { AccountWorkspaces } from '../types/workspace';
import { WorkspaceBoardsProvider } from './WorkspaceBoardsProvider';

// Mount once per account. Public routes never start workspace loading, while an
// already-opened app keeps its in-memory boards and pending saves across routes.
export function AccountWorkspaceSession({
  active,
  children,
  ...theme
}: ThemeProps & { active: boolean; children: ReactNode }) {
  const { session, signOut } = useAuth();
  const [me, setMe] = useState<AccountWorkspaces | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!active || me) return;
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
  }, [active, attempt, me]);
  if (active && error)
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
  if (active && !me)
    return (
      <AuthLayout {...theme} title="Opening your workspace">
        <p role="status">Loading your workspaces…</p>
      </AuthLayout>
    );
  return me && session ? (
    <WorkspaceBoardsProvider
      userId={session.user.id}
      workspaces={me.workspaces}
    >
      {children}
    </WorkspaceBoardsProvider>
  ) : (
    children
  );
}
