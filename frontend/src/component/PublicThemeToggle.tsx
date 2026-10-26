import type { ThemeProps } from './AuthLayout';

export function PublicThemeToggle({ theme, onToggleTheme }: ThemeProps) {
  return (
    <button
      className="website-theme"
      type="button"
      onClick={onToggleTheme}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {theme === 'light' ? (
          <path d="M20.8 13.2A8.7 8.7 0 0 1 10.8 3a9 9 0 1 0 10 10.2Z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        )}
      </svg>
    </button>
  );
}
