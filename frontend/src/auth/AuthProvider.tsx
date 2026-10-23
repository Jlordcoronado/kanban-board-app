import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthContext } from './context';
import { callbackError, initialRecovery, supabase } from './client';
import { invalidateRequests } from '../lib/api';

const RECOVERY_KEY = 'kanban-recovery-user';
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState(
    callbackError
      ? 'The sign-in link could not be used. Please request a new link or sign in again.'
      : ''
  );
  const userId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!supabase) return;
    let live = true;
    let events = 0;
    const apply = (next: Session | null, isRecovery: boolean) => {
      if (!live) return;
      if (!next?.access_token?.trim()) next = null;
      if (userId.current !== next?.user.id) invalidateRequests();
      userId.current = next?.user.id;
      setSession(next);
      const recovering = Boolean(
        next &&
        (isRecovery || sessionStorage.getItem(RECOVERY_KEY) === next.user.id)
      );
      if (isRecovery && next)
        sessionStorage.setItem(RECOVERY_KEY, next.user.id);
      if (!next) sessionStorage.removeItem(RECOVERY_KEY);
      setRecovery(recovering);
      setLoading(false);
    };
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      events += 1;
      if (event === 'SIGNED_IN') setError('');
      apply(
        next,
        event === 'PASSWORD_RECOVERY' ||
          (event === 'INITIAL_SESSION' && initialRecovery)
      );
    });
    const revision = events;
    void supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!live || events !== revision) return;
        if (sessionError)
          setError('Unable to restore your session. Please sign in again.');
        apply(data.session, initialRecovery);
      })
      .catch(() => {
        if (live && events === revision) {
          setLoading(false);
          setError('Unable to restore your session. Please sign in again.');
        }
      });
    const expired = () => {
      apply(null, false);
      setError('Your session expired. Please sign in again.');
      void supabase?.auth.signOut({ scope: 'local' });
    };
    window.addEventListener('auth-expired', expired);
    return () => {
      live = false;
      subscription.unsubscribe();
      invalidateRequests();
      window.removeEventListener('auth-expired', expired);
    };
  }, []);

  const signOut = async () => {
    invalidateRequests();
    setLoading(true);
    try {
      const result = await supabase?.auth.signOut({ scope: 'local' });
      if (result?.error) throw result.error;
      setSession(null);
      userId.current = undefined;
      sessionStorage.removeItem(RECOVERY_KEY);
      setRecovery(false);
      setError('');
    } catch {
      setError('Unable to sign out. Check your connection and try again.');
      throw new Error('Unable to sign out. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  const finishRecovery = () => {
    sessionStorage.removeItem(RECOVERY_KEY);
    setRecovery(false);
  };
  return (
    <AuthContext.Provider
      value={{ session, loading, recovery, error, signOut, finishRecovery }}
    >
      {children}
    </AuthContext.Provider>
  );
}
