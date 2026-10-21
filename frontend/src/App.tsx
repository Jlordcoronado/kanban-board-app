import { useEffect, useState } from 'react';
import Home from './pages/Home.tsx';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { useAuth } from './auth/context';
import { apiRequest, requestError } from './lib/api';
import { AuthLayout, type ThemeProps } from './component/AuthLayout';
import {
  AuthCallback,
  AuthForm,
  CheckEmail,
  ForgotPassword,
  ResetPassword,
} from './pages/AuthPages';

interface Me {
  user: { id: string; email?: string };
  workspaces: {
    id: string;
    name: string;
    kind: 'personal' | 'team';
    role: 'owner' | 'admin' | 'member';
  }[];
}
function PersonalBoard(theme: ThemeProps) {
  const { session, signOut, error: authError } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<Me>('/api/me', { signal: controller.signal })
      .then((value) => {
        if (
          !value.workspaces?.some((workspace) => workspace.kind === 'personal')
        )
          throw new Error(
            'Your personal workspace is not available yet. Please try again.'
          );
        setMe(value);
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
  if (!me)
    return (
      <AuthLayout {...theme} title="Opening your workspace">
        <p role="status">Loading your personal board…</p>
      </AuthLayout>
    );
  const workspace = me.workspaces.find(
    (workspace) => workspace.kind === 'personal'
  )!;
  return (
    <>
      <div role={authError ? 'alert' : undefined}>{authError}</div>
      <Home
        {...theme}
        workspaceId={workspace.id}
        accountEmail={session?.user.email ?? ''}
        onSignOut={signOut}
      />
    </>
  );
}
function ProtectedBoard(theme: ThemeProps) {
  const { loading, session, recovery } = useAuth();
  if (loading)
    return (
      <AuthLayout {...theme} title="Opening your workspace">
        <p role="status">Checking your session…</p>
      </AuthLayout>
    );
  if (!session) return <Navigate to="/signin" replace />;
  if (recovery) return <Navigate to="/reset-password" replace />;
  return <PersonalBoard key={session.user.id} {...theme} />;
}

const THEME_KEY = 'kanban-theme';

function getInitialTheme(): 'light' | 'dark' {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const props = { theme, onToggleTheme: toggleTheme };
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<ProtectedBoard {...props} />} />
          <Route
            path="/signin"
            element={<AuthForm key="signin" mode="signin" {...props} />}
          />
          <Route
            path="/signup"
            element={<AuthForm key="signup" mode="signup" {...props} />}
          />
          <Route path="/check-email" element={<CheckEmail {...props} />} />
          <Route
            path="/forgot-password"
            element={<ForgotPassword {...props} />}
          />
          <Route
            path="/reset-password"
            element={<ResetPassword {...props} />}
          />
          <Route path="/auth/callback" element={<AuthCallback {...props} />} />
          <Route
            path="*"
            element={
              <AuthLayout {...props} title="Page not found">
                <p className="auth-footer">
                  <Link to="/">Go to your workspace</Link>
                </p>
              </AuthLayout>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
