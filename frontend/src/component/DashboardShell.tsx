import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import type { Workspace } from '../types/workspace';
import { Dialog } from './Dialog';
import '../css/dashboard-shell.css';

interface DashboardShellProps {
  workspaces: Workspace[];
  accountEmail: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onSignOut: () => Promise<void>;
  children: ReactNode;
}

type IconName =
  | 'dashboard'
  | 'board'
  | 'team'
  | 'settings'
  | 'sun'
  | 'moon'
  | 'signout'
  | 'collapse'
  | 'expand'
  | 'menu'
  | 'close';

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    board: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 4v16M15 4v16M5.5 8h1M11.5 8h1M17.5 8h1M5.5 12h1M11.5 12h1" />
      </>
    ),
    team: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M21 20v-2a6 6 0 0 0-3-5.2" />
      </>
    ),
    settings: (
      <>
        <path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ),
    moon: <path d="M20.8 13.2A8.7 8.7 0 0 1 10.8 3a9 9 0 1 0 10 10.2Z" />,
    signout: (
      <>
        <path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M9 12h12M17 8l4 4-4 4" />
      </>
    ),
    collapse: (
      <>
        <path d="M14 7l-5 5 5 5" />
        <path d="M20 4v16" />
      </>
    ),
    expand: (
      <>
        <path d="m10 7 5 5-5 5" />
        <path d="M4 4v16" />
      </>
    ),
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function BrandMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 28 28" fill="none">
      <rect x="1" y="1" width="26" height="26" rx="7" fill="currentColor" />
      <path
        d="M8 8v8M14 8v12M20 8v5"
        stroke="var(--accent-ink)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

const SIDEBAR_KEY = 'kanban-sidebar-collapsed-v1';
function initialCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === 'true';
  } catch {
    return false;
  }
}

export function DashboardShell({
  workspaces,
  accountEmail,
  theme,
  onToggleTheme,
  onSignOut,
  children,
}: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [drawerRoute, setDrawerRoute] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const location = useLocation();
  const menuRef = useRef<HTMLButtonElement>(null);
  const drawerOpen = drawerRoute === location.key;
  const personal = workspaces.find(
    (workspace) => workspace.kind === 'personal'
  );
  const teams = workspaces.filter((workspace) => workspace.kind === 'team');

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const resize = () => {
      if (!media.matches) setDrawerRoute(null);
    };
    const close = () => setDrawerRoute(null);
    media.addEventListener?.('change', resize);
    window.addEventListener('popstate', close);
    return () => {
      media.removeEventListener?.('change', resize);
      window.removeEventListener('popstate', close);
    };
  }, []);

  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(SIDEBAR_KEY, String(next));
    } catch {
      // The sidebar remains usable when preference storage is unavailable.
    }
  };
  const signOut = async () => {
    if (signingOut) return;
    setSignOutError('');
    setSigningOut(true);
    try {
      await onSignOut();
    } catch {
      setSignOutError(
        'Unable to sign out. Check your connection and try again.'
      );
    } finally {
      setSigningOut(false);
    }
  };
  const closeDrawer = () => setDrawerRoute(null);
  const sidebarContent = (mobile: boolean) => (
    <>
      <div className="shell-brand-row">
        <Link
          className="shell-brand"
          to="/dashboard"
          aria-label="jlord.dev dashboard"
          title="jlord.dev"
          onClick={closeDrawer}
        >
          <BrandMark />
          <span className="shell-label">jlord.dev</span>
        </Link>
        <button
          type="button"
          className="shell-icon-button shell-collapse"
          aria-label={
            mobile
              ? 'Close navigation'
              : collapsed
                ? 'Expand sidebar'
                : 'Collapse sidebar'
          }
          title={
            mobile
              ? 'Close navigation'
              : collapsed
                ? 'Expand sidebar'
                : 'Collapse sidebar'
          }
          onClick={mobile ? closeDrawer : toggleSidebar}
        >
          <Icon name={mobile ? 'close' : collapsed ? 'expand' : 'collapse'} />
        </button>
      </div>
      <nav
        className="shell-navigation"
        aria-label={mobile ? 'Mobile navigation' : 'Main navigation'}
      >
        <NavLink
          className="shell-nav-link"
          to="/dashboard"
          title="Dashboard"
          onClick={closeDrawer}
        >
          <Icon name="dashboard" />
          <span className="shell-label">Dashboard</span>
        </NavLink>
        {personal && (
          <NavLink
            className="shell-nav-link"
            to={`/boards/${personal.id}`}
            title="Personal board"
            onClick={closeDrawer}
          >
            <Icon name="board" />
            <span className="shell-label">Personal board</span>
          </NavLink>
        )}
        <div className="shell-team-section">
          <p className="shell-section-label shell-label">Teams</p>
          {teams.length === 0 ? (
            <p className="shell-no-teams shell-label">No teams yet</p>
          ) : (
            teams.map((workspace) => (
              <NavLink
                key={workspace.id}
                className="shell-nav-link shell-team-link"
                to={`/boards/${workspace.id}`}
                aria-label={`${workspace.name}, ${workspace.role}`}
                title={`${workspace.name} · ${workspace.role}`}
                onClick={closeDrawer}
              >
                <Icon name="team" />
                <span className="shell-team-copy shell-label">
                  <span className="shell-team-name">{workspace.name}</span>
                  <span className="shell-role">{workspace.role}</span>
                </span>
              </NavLink>
            ))
          )}
        </div>
      </nav>
      <div className="shell-account-actions">
        <NavLink
          className="shell-nav-link"
          to="/account"
          title="Account settings"
          onClick={closeDrawer}
        >
          <Icon name="settings" />
          <span className="shell-label">Account settings</span>
        </NavLink>
        <button
          className="shell-nav-link"
          type="button"
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          onClick={onToggleTheme}
        >
          <Icon name={theme === 'light' ? 'moon' : 'sun'} />
          <span className="shell-label">
            {theme === 'light' ? 'Dark mode' : 'Light mode'}
          </span>
        </button>
        <button
          className="shell-nav-link"
          type="button"
          title="Sign out"
          aria-label={signingOut ? 'Signing out…' : 'Sign out'}
          disabled={signingOut}
          onClick={() => void signOut()}
        >
          <Icon name="signout" />
          <span className="shell-label">
            {signingOut ? 'Signing out…' : 'Sign out'}
          </span>
        </button>
        <div className="shell-account" title={accountEmail}>
          <span className="shell-avatar" aria-hidden="true">
            {accountEmail.charAt(0).toUpperCase() || 'A'}
          </span>
          <span className="shell-label shell-account-email">
            {accountEmail}
          </span>
        </div>
      </div>
    </>
  );

  return (
    <div className={`workspace-shell${collapsed ? ' shell-collapsed' : ''}`}>
      <a className="shell-skip-link" href="#dashboard-main">
        Skip to content
      </a>
      <aside className="shell-sidebar" aria-label="Sidebar">
        {sidebarContent(false)}
      </aside>
      <header className="shell-mobile-header">
        <Link
          className="shell-brand"
          to="/dashboard"
          aria-label="jlord.dev dashboard"
        >
          <BrandMark />
          <span>jlord.dev</span>
        </Link>
        <button
          ref={menuRef}
          className="shell-icon-button"
          type="button"
          aria-label="Open navigation"
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerRoute(location.key)}
        >
          <Icon name="menu" />
        </button>
      </header>
      <main id="dashboard-main" className="shell-main" tabIndex={-1}>
        {signOutError && (
          <div className="shell-signout-error" role="alert">
            <p>{signOutError}</p>
            <button
              type="button"
              disabled={signingOut}
              onClick={() => void signOut()}
            >
              Retry sign out
            </button>
          </div>
        )}
        {children}
      </main>
      {drawerOpen && (
        <Dialog
          title="Navigation"
          className="shell-drawer"
          hideClose
          dismissOnBackdrop
          onClose={closeDrawer}
          returnFocusRef={menuRef}
        >
          <div className="shell-drawer-content">
            {sidebarContent(true)}
            {signOutError && (
              <p className="shell-drawer-error" role="alert">
                {signOutError}
              </p>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}
