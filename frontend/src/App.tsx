import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import Home from './pages/Home.tsx';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { AccountModal } from './component/AccountModal';
import { AuthProvider } from './auth/AuthProvider';
import { useAuth } from './auth/context';
import SignedInApp from './pages/SignedInApp';
import { AuthLayout, type ThemeProps } from './component/AuthLayout';
import {
  AuthCallback,
  AuthForm,
  CheckEmail,
  ForgotPassword,
  ResetPassword,
} from './pages/AuthPages';

interface AccountChoiceProps {
  welcomeSeen: boolean;
  rememberChoice: () => void;
}
function GuestBoard({
  welcomeSeen,
  rememberChoice,
  ...theme
}: ThemeProps & AccountChoiceProps) {
  const { error } = useAuth();
  const [initialWelcome] = useState(!welcomeSeen && !error);
  const [authOpen, setAuthOpen] = useState(initialWelcome);
  const [welcome, setWelcome] = useState(initialWelcome);
  const addTaskRef = useRef<HTMLButtonElement>(null);
  const [initialDismissal, setInitialDismissal] = useState(initialWelcome);
  return (
    <>
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      <Home
        {...theme}
        addTaskRef={addTaskRef}
        accountEmail=""
        onSignOut={async () => {}}
        onSignIn={() => {
          setWelcome(false);
          setAuthOpen(true);
        }}
      />
      {authOpen && (
        <AccountModal
          {...theme}
          welcome={welcome}
          onChoice={rememberChoice}
          returnFocusRef={initialDismissal ? addTaskRef : undefined}
          onClose={() => {
            rememberChoice();
            setAuthOpen(false);
            setInitialDismissal(false);
          }}
        />
      )}
    </>
  );
}
function ProtectedBoard({
  welcomeSeen,
  rememberChoice,
  ...theme
}: ThemeProps & AccountChoiceProps) {
  const { loading, session, recovery, error } = useAuth();
  const location = useLocation();
  useEffect(() => {
    if (!loading && (session || recovery || error)) rememberChoice();
  }, [loading, session, recovery, error, rememberChoice]);
  if (loading)
    return (
      <AuthLayout {...theme} title="Opening your workspace">
        <p role="status">Checking your session…</p>
      </AuthLayout>
    );
  if (recovery) return <Navigate to="/reset-password" replace />;
  if (!session && location.pathname !== '/') return <Navigate to="/" replace />;
  return session ? (
    <SignedInApp key={session.user.id} {...theme} />
  ) : (
    <GuestBoard
      {...theme}
      welcomeSeen={welcomeSeen}
      rememberChoice={rememberChoice}
    />
  );
}

const ACCOUNT_CHOICE_KEY = 'kanban-account-choice-v1';
function hasAccountChoice() {
  if (window.location.pathname !== '/') return true;
  try {
    return localStorage.getItem(ACCOUNT_CHOICE_KEY) === 'seen';
  } catch {
    return false;
  }
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

function Application() {
  const [welcomeSeen, setWelcomeSeen] = useState(hasAccountChoice);
  const rememberChoice = useCallback(() => {
    setWelcomeSeen(true);
    try {
      localStorage.setItem(ACCOUNT_CHOICE_KEY, 'seen');
    } catch {
      /* Keep the choice for this app session when storage is unavailable. */
    }
  }, []);
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
      <Routes>
        <Route
          path="/*"
          element={
            <ProtectedBoard
              {...props}
              welcomeSeen={welcomeSeen}
              rememberChoice={rememberChoice}
            />
          }
        />
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
        <Route path="/reset-password" element={<ResetPassword {...props} />} />
        <Route path="/auth/callback" element={<AuthCallback {...props} />} />
      </Routes>
    </AuthProvider>
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
