import { useState } from 'react';
import type { NavigateOptions } from 'react-router-dom';
import { AuthForm, ForgotPassword, CheckEmail } from '../pages/AuthPages';
import { Dialog } from './Dialog';
import type { ThemeProps } from './AuthLayout';
export function AccountModal({
  onClose,
  ...theme
}: ThemeProps & { onClose: () => void }) {
  const [page, setPage] = useState('/signin');
  const [details, setDetails] = useState<{ email?: string; kind?: string }>();
  const navigate = (path: string, options?: NavigateOptions) => {
    setPage(path);
    setDetails(options?.state);
  };
  return (
    <Dialog title="Save to cloud" onClose={onClose}>
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
        {page === '/forgot-password' ? (
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
