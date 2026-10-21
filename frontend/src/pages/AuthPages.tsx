import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout, type ThemeProps } from '../component/AuthLayout';
import { authRedirect, recoveryRedirect, supabase } from '../auth/client';
import { useAuth } from '../auth/context';

export function PasswordField({
  label = 'Password',
  autoComplete = 'current-password',
  minimum = 1,
}: {
  label?: string;
  autoComplete?: string;
  minimum?: number;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <span className="auth-password">
        <input
          id={id}
          name="password"
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          minLength={minimum}
          maxLength={128}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </span>
    </div>
  );
}
export function AuthForm({
  mode,
  ...theme
}: ThemeProps & { mode: 'signin' | 'signup' }) {
  const signup = mode === 'signup';
  const { session, loading, recovery, error: sessionError } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  if (!loading && session)
    return <Navigate to={recovery ? '/reset-password' : '/'} replace />;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    const values = new FormData(event.currentTarget);
    const email = String(values.get('email')).trim();
    const password = String(values.get('password'));
    try {
      if (!supabase) throw new Error('Sign-in is temporarily unavailable.');
      const result = signup
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: String(values.get('name')).trim() },
              emailRedirectTo: authRedirect(),
            },
          })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) {
        if (result.error.code === 'email_not_confirmed') {
          navigate('/check-email', { state: { email, kind: 'signup' } });
          return;
        }
        throw new Error(
          signup
            ? result.error.message
            : 'Unable to sign in. Check your email and password, then try again.'
        );
      }
      if (signup && !result.data.session)
        navigate('/check-email', { state: { email, kind: 'signup' } });
      else navigate('/', { replace: true });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to continue. Try again.'
      );
    } finally {
      setBusy(false);
    }
  };
  const google = async () => {
    setBusy(true);
    setError('');
    try {
      if (!supabase) throw new Error('Sign-in is temporarily unavailable.');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: authRedirect() },
      });
      if (error)
        throw new Error(
          'Google sign-in could not start. Try again or use your email.'
        );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Google sign-in could not start.'
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthLayout
      {...theme}
      title={signup ? 'Create your account' : 'Sign in'}
      subtitle={
        signup
          ? 'A private space to organize your work.'
          : 'Your workspace is ready when you are.'
      }
    >
      {!supabase && (
        <p role="alert" className="auth-error">
          Sign-in is temporarily unavailable.
        </p>
      )}
      {(error || sessionError) && (
        <p role="alert" className="auth-error">
          {error || sessionError}
        </p>
      )}
      <button
        className="auth-google"
        type="button"
        onClick={() => void google()}
        disabled={busy || !supabase || loading}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
          <path
            fill="#4285F4"
            d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.8 2.9-4.3 2.9-7.4Z"
          />
          <path
            fill="#34A853"
            d="M12 22c2.7 0 5-1 6.7-2.4l-3.3-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.2H3v2.6A10 10 0 0 0 12 22Z"
          />
          <path
            fill="#FBBC05"
            d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3a10 10 0 0 0 0 9l3.4-2.6Z"
          />
          <path
            fill="#EA4335"
            d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.6 9.6 0 0 0 12 2a10 10 0 0 0-9 5.5l3.4 2.6C7.2 7.7 9.4 5.9 12 5.9Z"
          />
        </svg>
        Continue with Google
      </button>
      <div className="auth-divider">
        <span>or</span>
      </div>
      <form className="auth-form" onSubmit={(event) => void submit(event)}>
        <fieldset disabled={busy || !supabase || loading}>
          {signup && (
            <label className="auth-field">
              Display name
              <input
                name="name"
                autoComplete="name"
                required
                maxLength={100}
                pattern=".*\S.*"
              />
            </label>
          )}
          <label className="auth-field">
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={255}
            />
          </label>
          <PasswordField
            autoComplete={signup ? 'new-password' : 'current-password'}
            minimum={signup ? 8 : 1}
          />
          {signup ? (
            <p className="auth-hint">Use at least 8 characters.</p>
          ) : (
            <Link className="auth-forgot" to="/forgot-password">
              Forgot password?
            </Link>
          )}
          <button className="auth-primary" type="submit">
            {busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}
          </button>
        </fieldset>
      </form>
      <p className="auth-footer">
        {signup ? 'Already have an account?' : 'New to jlord.dev?'}{' '}
        <Link to={signup ? '/signin' : '/signup'}>
          {signup ? 'Sign in' : 'Create an account'}
        </Link>
      </p>
    </AuthLayout>
  );
}

export function ForgotPassword(theme: ThemeProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email')).trim();
    setBusy(true);
    setError('');
    try {
      if (!supabase)
        throw new Error('Password recovery is temporarily unavailable.');
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: recoveryRedirect(),
      });
      if (error)
        throw new Error(
          'Unable to send a reset link. Wait a moment and try again.'
        );
      navigate('/check-email', { state: { email, kind: 'recovery' } });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Unable to send a reset link.'
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthLayout
      {...theme}
      title="Reset your password"
      subtitle="Enter your email and we’ll send a reset link."
    >
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      <form className="auth-form" onSubmit={(event) => void submit(event)}>
        <fieldset disabled={busy || !supabase}>
          <label className="auth-field">
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={255}
            />
          </label>
          <button className="auth-primary" type="submit">
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
        </fieldset>
      </form>
      <p className="auth-footer">
        <Link to="/signin">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}

export function CheckEmail(theme: ThemeProps) {
  const location = useLocation();
  const [email, setEmail] = useState<string>(location.state?.email ?? '');
  const kind = location.state?.kind === 'recovery' ? 'recovery' : 'signup';
  const [cooldown, setCooldown] = useState(location.state?.email ? 60 : 0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000
    );
    return () => window.clearInterval(timer);
  }, [cooldown]);
  const resend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (cooldown || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (!supabase)
        throw new Error('Email delivery is temporarily unavailable.');
      const result =
        kind === 'recovery'
          ? await supabase.auth.resetPasswordForEmail(email.trim(), {
              redirectTo: recoveryRedirect(),
            })
          : await supabase.auth.resend({
              type: 'signup',
              email: email.trim(),
              options: { emailRedirectTo: authRedirect() },
            });
      if (result.error)
        throw new Error(
          'Unable to resend the email. Wait a moment and try again.'
        );
      setCooldown(60);
      setMessage('If this address is eligible, a new link is on its way.');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Unable to resend the email.'
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthLayout
      {...theme}
      title="Check your email"
      subtitle={
        kind === 'recovery'
          ? 'If an account exists for this address, you’ll receive a password reset link.'
          : 'If your signup is eligible, you’ll receive a link to confirm your email.'
      }
    >
      <p className="auth-note">
        Open the link in your inbox to continue. Check your spam folder if it
        hasn’t arrived.
      </p>
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="auth-note">
          {message}
        </p>
      )}
      <form className="auth-form" onSubmit={(event) => void resend(event)}>
        <label className="auth-field">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <button
          className="auth-secondary"
          disabled={busy || cooldown > 0 || !supabase}
          type="submit"
        >
          {busy
            ? 'Sending…'
            : cooldown
              ? `Resend in ${cooldown}s`
              : 'Resend email'}
        </button>
      </form>
      <p className="auth-footer">
        <Link to={kind === 'recovery' ? '/forgot-password' : '/signup'}>
          Use a different email
        </Link>
        <br />
        <Link to="/signin">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}

export function ResetPassword(theme: ThemeProps) {
  const { session, loading, recovery, finishRecovery } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get('password'));
    setBusy(true);
    setError('');
    try {
      if (!supabase || !session || !recovery)
        throw new Error('Request a new password reset link.');
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(error.message);
      finishRecovery();
      navigate('/', { replace: true });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to update your password.'
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthLayout
      {...theme}
      title="Choose a new password"
      subtitle="Use a password you don’t use elsewhere."
    >
      {loading ? (
        <p role="status">Checking your reset link…</p>
      ) : !session || !recovery ? (
        <p role="alert" className="auth-error">
          This reset link is missing or expired.{' '}
          <Link to="/forgot-password">Request a new link</Link>.
        </p>
      ) : (
        <>
          {error && (
            <p role="alert" className="auth-error">
              {error}
            </p>
          )}
          <form className="auth-form" onSubmit={(event) => void submit(event)}>
            <fieldset disabled={busy}>
              <PasswordField
                label="New password"
                autoComplete="new-password"
                minimum={8}
              />
              <p className="auth-hint">Use at least 8 characters.</p>
              <button className="auth-primary" type="submit">
                {busy ? 'Saving…' : 'Save new password'}
              </button>
            </fieldset>
          </form>
        </>
      )}
    </AuthLayout>
  );
}

export function AuthCallback(theme: ThemeProps) {
  const { loading, session, recovery, error } = useAuth();
  useEffect(() => {
    if (!loading)
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname
      );
  }, [loading]);
  if (loading)
    return (
      <AuthLayout {...theme} title="Finishing sign-in">
        <p role="status">Checking your session…</p>
      </AuthLayout>
    );
  if (session && !error)
    return <Navigate to={recovery ? '/reset-password' : '/'} replace />;
  return (
    <AuthLayout {...theme} title="Unable to finish sign-in">
      <p role="alert" className="auth-error">
        {error || 'This link may have expired, or sign-in was canceled.'}
      </p>
      <p className="auth-footer">
        <Link to="/signin">Return to sign in</Link>
        <br />
        <Link to="/forgot-password">Request a password reset</Link>
      </p>
    </AuthLayout>
  );
}
