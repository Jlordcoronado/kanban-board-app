import { beforeEach, expect, it, vi } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
const sdk = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithOAuth: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  resend: vi.fn(),
  updateUser: vi.fn(),
}));
vi.mock('../src/auth/client', () => ({
  supabase: { auth: sdk },
  authRedirect: () => 'http://localhost/auth/callback',
  recoveryRedirect: () => 'http://localhost/reset-password',
}));
import { AuthContext, type AuthState } from '../src/auth/context';
import {
  AuthCallback,
  AuthForm,
  CheckEmail,
  ForgotPassword,
  ResetPassword,
} from '../src/pages/AuthPages';
const theme = { theme: 'light' as const, onToggleTheme: vi.fn() };
function mount(page: React.ReactNode, state: Partial<AuthState> = {}) {
  return render(
    <AuthContext.Provider
      value={{
        session: null,
        loading: false,
        recovery: false,
        error: '',
        signOut: vi.fn(),
        finishRecovery: vi.fn(),
        ...state,
      }}
    >
      <MemoryRouter initialEntries={['/form']}>
        <Routes>
          <Route path="/form" element={page} />
          <Route path="/check-email" element={<CheckEmail {...theme} />} />
          <Route path="/dashboard" element={<p>Dashboard</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}
beforeEach(() => {
  for (const handler of Object.values(sdk))
    handler.mockResolvedValue({ data: { session: null }, error: null });
});
it('shows the board symbol above jlord.dev and collects a signup display name', async () => {
  const user = userEvent.setup();
  mount(<AuthForm mode="signup" {...theme} />);
  expect(screen.getByRole('img', { name: 'Kanban board' })).toBeInTheDocument();
  expect(screen.getByText('jlord.dev')).toBeInTheDocument();
  await user.type(screen.getByLabelText('Display name'), 'Jordan');
  await user.type(screen.getByLabelText('Email'), 'jordan@example.com');
  await user.type(screen.getByLabelText('Password'), 'secure-password');
  await user.click(screen.getByRole('button', { name: 'Create account' }));
  expect(sdk.signUp).toHaveBeenCalledWith(
    expect.objectContaining({
      email: 'jordan@example.com',
      options: expect.objectContaining({ data: { full_name: 'Jordan' } }),
    })
  );
  expect(
    await screen.findByRole('heading', { name: 'Check your email' })
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Resend in 60s' })).toBeDisabled();
});
it('shows login failures and lets users reveal the password', async () => {
  sdk.signInWithPassword.mockResolvedValue({
    error: { code: 'invalid_credentials' },
  });
  const user = userEvent.setup();
  mount(<AuthForm mode="signin" {...theme} />);
  const password = screen.getByLabelText('Password');
  await user.click(screen.getByRole('button', { name: 'Show password' }));
  expect(password).toHaveAttribute('type', 'text');
  await user.type(screen.getByLabelText('Email'), 'jordan@example.com');
  await user.type(password, 'wrong-password');
  await user.click(screen.getByRole('button', { name: 'Log in' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Check your email and password'
  );
});

it('signs in with email and opens the dashboard on success', async () => {
  sdk.signInWithPassword.mockResolvedValue({
    data: { session: { user: { id: 'user-a' } } },
    error: null,
  });
  const user = userEvent.setup();
  mount(<AuthForm mode="signin" {...theme} />);
  await user.type(screen.getByLabelText('Email'), 'jordan@example.com');
  await user.type(screen.getByLabelText('Password'), 'valid-password');
  await user.click(screen.getByRole('button', { name: 'Log in' }));
  expect(await screen.findByText('Dashboard')).toBeInTheDocument();
  expect(sdk.signInWithPassword).toHaveBeenCalledWith({
    email: 'jordan@example.com',
    password: 'valid-password',
  });
});
it('uses Google OAuth and explains failures', async () => {
  sdk.signInWithOAuth.mockResolvedValue({
    error: { message: 'Provider disabled' },
  });
  const user = userEvent.setup();
  mount(<AuthForm mode="signin" {...theme} />);
  await user.click(
    screen.getByRole('button', { name: 'Continue with Google' })
  );
  expect(sdk.signInWithOAuth).toHaveBeenCalledWith({
    provider: 'google',
    options: { redirectTo: 'http://localhost/auth/callback' },
  });
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Google sign-in could not start'
  );
});
it('shows a useful error for canceled or expired callbacks', () => {
  mount(<AuthCallback {...theme} />);
  expect(screen.getByRole('alert')).toHaveTextContent('expired');
});

it('sends a successful callback to the dashboard', async () => {
  mount(<AuthCallback {...theme} />, {
    session: { user: { id: 'user-a' } } as Session,
  });
  expect(await screen.findByText('Dashboard')).toBeInTheDocument();
});

it('preserves the failed-callback message even when a session exists', () => {
  mount(<AuthCallback {...theme} />, {
    session: { user: { id: 'user-a' } } as Session,
    error: 'The sign-in link could not be used.',
  });
  expect(screen.getByRole('alert')).toHaveTextContent(
    'The sign-in link could not be used.'
  );
  expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
});
it('requests password recovery without exposing account existence', async () => {
  const user = userEvent.setup();
  mount(<ForgotPassword {...theme} />);
  await user.type(screen.getByLabelText('Email'), 'unknown@example.com');
  await user.click(screen.getByRole('button', { name: 'Send reset link' }));
  expect(await screen.findByText(/If an account exists/)).toBeInTheDocument();
  expect(sdk.resetPasswordForEmail).toHaveBeenCalledWith(
    'unknown@example.com',
    { redirectTo: 'http://localhost/reset-password' }
  );
});
it('requires a recovery session before displaying password update controls', () => {
  mount(<ResetPassword {...theme} />);
  expect(screen.getByRole('alert')).toHaveTextContent('missing or expired');
  expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
});
it('saves a new password and finishes the recovery flow', async () => {
  const finishRecovery = vi.fn();
  const user = userEvent.setup();
  mount(<ResetPassword {...theme} />, {
    session: { user: { id: 'user-a' } } as Session,
    recovery: true,
    finishRecovery,
  });
  await user.type(screen.getByLabelText('New password'), 'new-password-value');
  await user.click(screen.getByRole('button', { name: 'Save new password' }));
  await waitFor(() => expect(finishRecovery).toHaveBeenCalledOnce());
  expect(sdk.updateUser).toHaveBeenCalledWith({
    password: 'new-password-value',
  });
  expect(await screen.findByText('Dashboard')).toBeInTheDocument();
});
it('resends confirmation with a cooldown', async () => {
  vi.useFakeTimers();
  try {
    mount(<CheckEmail {...theme} />);
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'jordan@example.com' },
    });
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Resend email' }))
    );
    expect(sdk.resend).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'signup', email: 'jordan@example.com' })
    );
    expect(
      screen.getByRole('button', { name: 'Resend in 60s' })
    ).toBeDisabled();
    await act(async () => vi.advanceTimersByTime(60000));
    expect(
      screen.getByRole('button', { name: 'Resend email' })
    ).not.toBeDisabled();
  } finally {
    vi.useRealTimers();
  }
});

it('keeps password-recovery email and resend mode inside the account modal', async () => {
  const { AccountModal } = await import('../src/component/AccountModal');
  mount(<AccountModal {...theme} onClose={vi.fn()} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('link', { name: 'Forgot password?' }));
  await user.type(screen.getByLabelText('Email'), 'recovery@example.com');
  await user.click(screen.getByRole('button', { name: 'Send reset link' }));
  expect(
    await screen.findByRole('heading', { name: 'Check your email' })
  ).toBeInTheDocument();
  expect(
    screen.getByText(/you’ll receive a password reset link/)
  ).toBeInTheDocument();
  expect(screen.getByLabelText('Email')).toHaveValue('recovery@example.com');
  expect(screen.getByRole('button', { name: 'Resend in 60s' })).toBeDisabled();
});
