import { supabase } from '../auth/client';

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
let generation = 0;
const active = new Set<AbortController>();
export function invalidateRequests() {
  generation += 1;
  for (const controller of active) controller.abort();
  active.clear();
}
export interface RequestOptions extends RequestInit {
  workspaceId?: string;
}
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const started = generation;
  const controller = new AbortController();
  active.add(controller);
  const { workspaceId, signal, ...init } = options;
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const ensureCurrent = () => {
    if (controller.signal.aborted || generation !== started)
      throw new DOMException('Request canceled', 'AbortError');
  };
  try {
    if (!supabase)
      throw new ApiError('Sign-in is temporarily unavailable.', 503);
    const { data, error } = await supabase.auth.getSession();
    ensureCurrent();
    if (error && (error.status === 0 || (error.status ?? 0) >= 500))
      throw new ApiError(
        'Unable to refresh your session. Check your connection and try again.',
        503
      );
    if (error || !data.session) {
      invalidateRequests();
      window.dispatchEvent(new Event('auth-expired'));
      throw new ApiError('Please sign in to continue.', 401);
    }
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${data.session.access_token}`);
    if (workspaceId) headers.set('x-workspace-id', workspaceId);
    if (init.body) headers.set('Content-Type', 'application/json');
    let response: Response;
    try {
      response = await fetch(
        `${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')}${path}`,
        {
          ...init,
          headers,
          signal: controller.signal,
        }
      );
    } catch (error) {
      ensureCurrent();
      if (error instanceof DOMException && error.name === 'AbortError')
        throw error;
      throw new ApiError(
        'Unable to reach the server. Check your connection and try again.',
        0
      );
    }
    ensureCurrent();
    if (!response.ok) {
      if (response.status === 401) {
        invalidateRequests();
        window.dispatchEvent(new Event('auth-expired'));
      }
      const payload = await response.json().catch(() => null);
      throw new ApiError(
        response.status === 401
          ? 'Your session expired. Please sign in again.'
          : response.status === 403
            ? 'You do not have permission to do that.'
            : typeof payload?.message === 'string'
              ? payload.message
              : 'Unable to complete the request. Try again.',
        response.status
      );
    }
    if (response.status === 204) return undefined as T;
    const result: unknown = await response.json();
    ensureCurrent();
    return result as T;
  } finally {
    active.delete(controller);
    signal?.removeEventListener('abort', abort);
  }
}
export function requestError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Unable to complete the request. Try again.';
}
