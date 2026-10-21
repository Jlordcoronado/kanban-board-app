import type { ReactNode } from 'react';

export interface ThemeProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}
export function ThemeButton({ theme, onToggleTheme }: ThemeProps) {
  return (
    <button
      className="auth-theme"
      type="button"
      onClick={onToggleTheme}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? 'Dark mode' : 'Light mode'}
    </button>
  );
}
export function AuthLayout({
  children,
  title,
  subtitle,
  ...theme
}: ThemeProps & { children: ReactNode; title: string; subtitle?: string }) {
  return (
    <main className="auth-shell">
      <div className="auth-toolbar">
        <ThemeButton {...theme} />
      </div>
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-brand">
          <svg
            className="auth-logo"
            role="img"
            aria-label="Kanban board"
            viewBox="0 0 64 64"
            fill="none"
          >
            <rect
              x="5"
              y="7"
              width="54"
              height="50"
              rx="10"
              stroke="currentColor"
              strokeWidth="2"
            />
            <rect
              x="14"
              y="18"
              width="9"
              height="25"
              rx="2"
              fill="currentColor"
              opacity=".4"
            />
            <rect
              x="28"
              y="18"
              width="9"
              height="34"
              rx="2"
              fill="currentColor"
              opacity=".7"
            />
            <rect
              x="42"
              y="18"
              width="9"
              height="17"
              rx="2"
              fill="currentColor"
            />
          </svg>
          <p className="auth-brand-name">jlord.dev</p>
        </div>
        <h1 id="auth-title">{title}</h1>
        {subtitle && <p className="auth-subtitle">{subtitle}</p>}
        {children}
      </section>
    </main>
  );
}
