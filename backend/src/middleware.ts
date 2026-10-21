import type { NextFunction, Request, Response } from 'express';
import {
  createClient,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn(
    'SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be configured before protected routes can be used.'
  );
}

export interface AuthContext {
  user: User;
  token: string;
  supabase: SupabaseClient;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

function getSupabaseClient(token: string): SupabaseClient {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('Supabase is not configured');
  }

  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }
  try {
    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }
    const supabase = getSupabaseClient(token);
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      const unavailable =
        error && (error.status === 0 || (error.status ?? 0) >= 500);
      res
        .status(unavailable ? 503 : 401)
        .json({
          message: unavailable
            ? 'Authentication service is unavailable'
            : 'Invalid or expired token',
        });
      return;
    }

    req.auth = { user: data.user, token, supabase };
    next();
  } catch (error) {
    console.error('Authentication verification failed:', error);
    res.status(503).json({ message: 'Authentication service is unavailable' });
  }
}

export function getAuth(req: Request): AuthContext {
  if (!req.auth) {
    throw new Error('Authenticated request context is missing');
  }
  return req.auth;
}
