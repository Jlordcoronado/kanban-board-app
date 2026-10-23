import { useState, type RefObject } from 'react';
import type { NavigateOptions } from 'react-router-dom';
import { AuthForm, ForgotPassword, CheckEmail } from '../pages/AuthPages';
import { Dialog } from './Dialog';
import type { ThemeProps } from './AuthLayout';
export function AccountModal({
  onClose,
  welcome = false,
  onChoice,
  returnFocusRef,
  ...theme
}: ThemeProps & {
  onClose: () => void;
  welcome?: boolean;
  onChoice?: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const [page, setPage] = useState(welcome ? '/welcome' : '/signin');
  const [details, setDetails] = useState<{ email?: string; kind?: string }>();
  const navigate = (path: string, options?: NavigateOptions) => {
    setPage(path);
    setDetails(options?.state);
  };
  return (
    <Dialog
      title={
        page === '/welcome'
          ? 'Welcome to jlord.dev'
          : page === '/signup'
            ? 'Create your account'
            : page === '/forgot-password'
              ? 'Reset your password'
              : page === '/check-email'
                ? 'Check your email'
                : 'Log in'
      }
      onClose={onClose}
      returnFocusRef={returnFocusRef}
    >
      <div
        className="account-dialog"
        onClickCapture={(e) => {
          const link = (e.target as HTMLElement).closest('a');
          const path = link?.getAttribute('href');
          if (path?.startsWith('/')) {
            e.preventDefault();
            e.stopPropagation();
            setPage(path);
          }
        }}
      >
        {page === '/welcome' ? (
          <div className="account-welcome">
            <h1>Welcome to jlord.dev</h1>
            <p>
              Log in to access your cloud board, or try the board on this
              device.
            </p>
            <button
              className="auth-primary"
              onClick={() => {
                onChoice?.();
                setPage('/signin');
              }}
            >
              Log in
            </button>
            <button className="auth-secondary" onClick={onClose}>
              Continue as guest
            </button>
            <p className="auth-note">Guest work saves in this browser.</p>
          </div>
        ) : page === '/forgot-password' ? (
          <ForgotPassword {...theme} onNavigate={navigate} />
        ) : page === '/check-email' ? (
          <CheckEmail {...theme} details={details} />
        ) : (
          <AuthForm
            key={page}
            {...theme}
            mode={page === '/signup' ? 'signup' : 'signin'}
            onNavigate={navigate}
          />
        )}
      </div>
    </Dialog>
  );
}
