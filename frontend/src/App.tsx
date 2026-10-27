import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Home from './pages/Home.tsx';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Route,
  Routes,
  ScrollRestoration,
  useLocation,
  useNavigationType,
  matchPath,
} from 'react-router-dom';
import { AccountModal } from './component/AccountModal';
import { AuthProvider } from './auth/AuthProvider';
import { useAuth } from './auth/context';
import SignedInApp from './pages/SignedInApp';
import { AccountWorkspaceSession } from './board/AccountWorkspaceSession';
import PersonalWebsite from './pages/PersonalWebsite';
import KanbanIntroduction from './pages/KanbanIntroduction';
import { AuthLayout, type ThemeProps } from './component/AuthLayout';
import {
  AuthCallback,
  AuthForm,
  CheckEmail,
  ForgotPassword,
  ResetPassword,
} from './pages/AuthPages';

function GuestBoard(theme: ThemeProps) {
  const { error } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  return (
    <>
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      <Home
        {...theme}
        accountEmail=""
        onSignOut={async () => {}}
        onSignIn={() => setAuthOpen(true)}
      />
      {authOpen && (
        <AccountModal {...theme} onClose={() => setAuthOpen(false)} />
      )}
    </>
  );
}
function AppEntry({
  guest = false,
  ...theme
}: ThemeProps & { guest?: boolean }) {
  const { loading, session, recovery } = useAuth();
  if (loading)
    return (
      <AuthLayout {...theme} title="Opening your workspace">
        <p role="status">Checking your session…</p>
      </AuthLayout>
    );
  if (recovery) return <Navigate to="/reset-password" replace />;
  if (guest)
    return session ? (
      <Navigate to="/dashboard" replace />
    ) : (
      <GuestBoard {...theme} />
    );
  return session ? <SignedInApp {...theme} /> : <Navigate to="/" replace />;
}

const THEME_KEY = 'kanban-theme';

function getInitialTheme(): 'light' | 'dark' {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(THEME_KEY);
  } catch {
    /* theme still works */
  }
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function PublicPageFocus() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();
  const previousPathname = useRef(pathname);

  useLayoutEffect(() => {
    const changedPathname = previousPathname.current !== pathname;
    previousPathname.current = pathname;
    if (!changedPathname || hash || navigationType === 'POP') return;

    const headingId =
      pathname === '/'
        ? 'website-headline'
        : pathname === '/kanban'
          ? 'kanban-headline'
          : null;
    if (headingId)
      document.getElementById(headingId)?.focus({ preventScroll: true });
  }, [pathname, hash, navigationType]);

  return null;
}

function Application() {
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* optional preference */
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const props = { theme, onToggleTheme: toggleTheme };
  return (
    <AuthProvider>
      <ApplicationRoutes {...props} />
      <ScrollRestoration />
      <PublicPageFocus />
    </AuthProvider>
  );
}

function ApplicationRoutes(theme: ThemeProps) {
  const { session, loading, recovery } = useAuth();
  const { pathname } = useLocation();
  const appRoute = ['/dashboard', '/account', '/boards/:workspaceId'].some(
    (path) => matchPath(path, pathname)
  );
  useEffect(() => {
    const product = Boolean(matchPath('/kanban', pathname));
    document.title =
      pathname === '/'
        ? 'Jaylord Coronado | Full-Stack Software Engineer'
        : product
          ? 'Kanban Desk | Tasks, boards, and deadlines'
          : 'Kanban Desk';
    let description = document.head.querySelector<HTMLMetaElement>(
      'meta[name="description"]'
    );
    if (!description) {
      description = document.createElement('meta');
      description.name = 'description';
      document.head.append(description);
    }
    description.content = product
      ? 'Explore Kanban Desk with example screens. Organize tasks, priorities, and deadlines in a guest board, with optional cloud accounts when configured.'
      : pathname === '/'
        ? 'I build full-stack applications, integrate AI, and automate business workflows. Explore my work or contact me about a project or developer role.'
        : 'Kanban Desk task boards and account access.';
  }, [pathname]);
  if (
    recovery &&
    pathname !== '/reset-password' &&
    pathname !== '/auth/callback'
  )
    return <Navigate to="/reset-password" replace />;
  const routes = (
    <Routes>
      <Route path="/" element={<PersonalWebsite {...theme} />} />
      <Route path="/kanban" element={<KanbanIntroduction {...theme} />} />
      <Route path="/try" element={<AppEntry {...theme} guest />} />
      <Route
        path="/signin"
        element={<AuthForm key="signin" mode="signin" {...theme} />}
      />
      <Route
        path="/signup"
        element={<AuthForm key="signup" mode="signup" {...theme} />}
      />
      <Route path="/check-email" element={<CheckEmail {...theme} />} />
      <Route path="/forgot-password" element={<ForgotPassword {...theme} />} />
      <Route path="/reset-password" element={<ResetPassword {...theme} />} />
      <Route path="/auth/callback" element={<AuthCallback {...theme} />} />
      <Route
        path="/*"
        element={
          appRoute ? <AppEntry {...theme} /> : <Navigate to="/" replace />
        }
      />
    </Routes>
  );
  return session ? (
    <AccountWorkspaceSession
      key={session.user.id}
      {...theme}
      active={appRoute && !loading && !recovery}
    >
      {routes}
    </AccountWorkspaceSession>
  ) : (
    routes
  );
}

export default function App() {
  const [router] = useState(() => {
    const instance = createBrowserRouter([
      { path: '*', element: <Application /> },
    ]);
    // Attach history listeners at commit, including Strict Mode's remount.
    instance.dispose();
    return instance;
  });
  useLayoutEffect(() => {
    router.initialize();
    return () => router.dispose();
  }, [router]);
  return <RouterProvider router={router} />;
}
