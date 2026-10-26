import { Link } from 'react-router-dom';
import type { ThemeProps } from '../component/AuthLayout';

export function AccountSettings({
  accountEmail,
  theme,
  onToggleTheme,
  onBeforePasswordReset,
}: ThemeProps & {
  accountEmail: string;
  onBeforePasswordReset?: () => boolean;
}) {
  return (
    <div className="account-settings">
      <header className="account-settings-heading">
        <h1>Account settings</h1>
        <p>Manage your account and how your workspace looks.</p>
      </header>
      <section
        className="account-settings-section"
        aria-labelledby="account-identity-title"
      >
        <div>
          <h2 id="account-identity-title">Account</h2>
          <p>Your signed-in email.</p>
        </div>
        <div className="account-settings-value">
          <span className="account-settings-label">Email address</span>
          <p>{accountEmail}</p>
        </div>
      </section>
      <section
        className="account-settings-section"
        aria-labelledby="account-appearance-title"
      >
        <div>
          <h2 id="account-appearance-title">Appearance</h2>
          <p>Choose a theme for the app.</p>
        </div>
        <div
          className="account-theme-options"
          role="group"
          aria-label="Appearance"
        >
          <button
            type="button"
            aria-pressed={theme === 'light'}
            onClick={() => {
              if (theme !== 'light') onToggleTheme();
            }}
          >
            <span
              className="account-theme-swatch account-theme-swatch-light"
              aria-hidden="true"
            >
              <i />
              <i />
              <i />
            </span>
            Light
          </button>
          <button
            type="button"
            aria-pressed={theme === 'dark'}
            onClick={() => {
              if (theme !== 'dark') onToggleTheme();
            }}
          >
            <span
              className="account-theme-swatch account-theme-swatch-dark"
              aria-hidden="true"
            >
              <i />
              <i />
              <i />
            </span>
            Dark
          </button>
        </div>
      </section>
      <section
        className="account-settings-section"
        aria-labelledby="account-password-title"
      >
        <div>
          <h2 id="account-password-title">Password</h2>
          <p>Use an email link to reset your password.</p>
        </div>
        <Link
          className="account-settings-reset"
          to="/forgot-password"
          onClick={(event) => {
            if (onBeforePasswordReset && !onBeforePasswordReset())
              event.preventDefault();
          }}
        >
          Reset password
        </Link>
      </section>
    </div>
  );
}
