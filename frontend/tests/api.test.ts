import { beforeEach, describe, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('../src/auth/client', () => ({ supabase: { auth: sdk } }));
import { apiRequest, invalidateRequests } from '../src/lib/api';

beforeEach(() => {
  invalidateRequests();
  sdk.getSession.mockResolvedValue({
    data: { session: { access_token: 'fresh-token' } },
    error: null,
  });
});
describe('authenticated API client', () => {
  it.each([null, {}, { access_token: '' }, { access_token: '   ' }])(
    'expires a session without a usable token before sending a request: %j',
    async (session) => {
      sdk.getSession.mockResolvedValue({ data: { session }, error: null });
      const fetcher = vi.fn();
      const expired = vi.fn();
      vi.stubGlobal('fetch', fetcher);
      window.addEventListener('auth-expired', expired);
      try {
        await expect(apiRequest('/api/me')).rejects.toMatchObject({
          status: 401,
        });
        expect(expired).toHaveBeenCalledOnce();
        expect(fetcher).not.toHaveBeenCalled();
      } finally {
        window.removeEventListener('auth-expired', expired);
      }
    }
  );
  it('attaches a current token and workspace to task and AI requests', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ suggestedDescription: 'Draft' }));
    vi.stubGlobal('fetch', fetcher);
    await apiRequest('/api/ai/rewrite-task', {
      method: 'POST',
      workspaceId: 'personal',
      body: JSON.stringify({ title: 'Test' }),
    });
    const [, options] = fetcher.mock.calls[0];
    expect(options.headers.get('Authorization')).toBe('Bearer fresh-token');
    expect(options.headers.get('x-workspace-id')).toBe('personal');
    expect(options.headers.get('Content-Type')).toBe('application/json');
  });
  it('rejects failed mutations without pretending they succeeded', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ message: 'Forbidden' }, { status: 403 })
        )
    );
    await expect(
      apiRequest('/api/tasks/one', { method: 'DELETE' })
    ).rejects.toMatchObject({ status: 403 });
  });
  it('distinguishes expired sessions from backend outages', async () => {
    const expired = vi.fn();
    window.addEventListener('auth-expired', expired);
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(Response.json({}, { status: 503 }))
      );
      await expect(apiRequest('/api/me')).rejects.toMatchObject({
        status: 503,
      });
      expect(expired).not.toHaveBeenCalled();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(Response.json({}, { status: 401 }))
      );
      await expect(apiRequest('/api/me')).rejects.toMatchObject({
        status: 401,
      });
      expect(expired).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener('auth-expired', expired);
    }
  });
  it('rejects stale responses after an account change even if fetch ignores abort', async () => {
    let complete!: (response: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            complete = resolve;
          })
      )
    );
    const pending = apiRequest('/api/tasks');
    await vi.waitFor(() => expect(complete).toBeDefined());
    invalidateRequests();
    complete(Response.json([{ title: 'Old account data' }]));
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('treats session-refresh outages as temporary errors', async () => {
    sdk.getSession.mockResolvedValue({
      data: { session: null },
      error: { status: 503 },
    });
    await expect(apiRequest('/api/me')).rejects.toMatchObject({ status: 503 });
  });
});
