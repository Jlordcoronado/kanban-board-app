import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const callback = new URLSearchParams(window.location.hash.slice(1));
export const initialRecovery = callback.get('type') === 'recovery';
export const callbackError =
  callback.get('error_description') ||
  new URLSearchParams(window.location.search).get('error_description');

// This browser client must only receive the publishable key.
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'implicit',
        },
      })
    : null;

export const authRedirect = () => `${window.location.origin}/auth/callback`;
export const recoveryRedirect = () =>
  `${window.location.origin}/reset-password`;
