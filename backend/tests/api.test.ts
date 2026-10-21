import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';

test('HTTP auth, task validation, archival errors and invitation configuration', async () => {
  process.env.NODE_ENV = 'test';
  process.env.SUPABASE_URL = 'https://backend-test.supabase.invalid';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'test-publishable';
  // Avoid any local email configuration during tests.
  delete process.env.SMTP_HOST;
  const { app } = await import('../src/index.js');
  const actualFetch = globalThis.fetch;
  const calls: { url: string; method: string; body: string }[] = [];
  const user = '00000000-0000-4000-8000-000000000001';
  const workspace = '00000000-0000-4000-8000-000000000002';
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (!url.startsWith(process.env.SUPABASE_URL!))
      return actualFetch(input, init);
    calls.push({
      url,
      method: init?.method ?? 'GET',
      body: String(init?.body ?? ''),
    });
    if (url.includes('/auth/v1/user'))
      return Response.json({ id: user, email: 'test@example.com' });
    if (url.includes('/workspace_members'))
      return Response.json({ workspace_id: workspace, role: 'member' });
    if (url.includes('/rpc/load_board'))
      return Response.json({
        revision: 0,
        columns: [{ id: 'todo', title: 'To Do' }],
        tasks: [],
      });
    if (url.includes('/rpc/save_board') || url.includes('/rpc/import_board'))
      return Response.json(
        { code: '40001', message: 'Board revision conflict' },
        { status: 409 }
      );
    if (url.includes('/rpc/archive_task'))
      return Response.json(
        { code: '42501', message: 'Manager access required' },
        { status: 403 }
      );
    if (url.includes('/tasks')) return Response.json([]);
    throw new Error('Unexpected Supabase request');
  };
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const headers = {
    Authorization: 'Bearer test-token',
    'x-workspace-id': workspace,
    'Content-Type': 'application/json',
  };
  try {
    assert.equal((await fetch(base + '/api/board')).status, 401);
    assert.equal((await fetch(base + '/api/tasks')).status, 401);
    assert.equal(calls.length, 0);
    assert.equal(
      (
        await fetch(base + '/api/tasks', {
          headers: { Authorization: 'Bearer ' },
        })
      ).status,
      401
    );
    assert.equal((await fetch(base + '/api/tasks', { headers })).status, 200);
    assert.equal((await fetch(base + '/api/board', { headers })).status, 200);
    const boardBody = {
      revision: 0,
      columns: [{ id: 'todo', title: 'To Do' }],
      tasks: [],
    };
    assert.equal(
      (
        await fetch(base + '/api/board', {
          method: 'PUT',
          headers,
          body: JSON.stringify(boardBody),
        })
      ).status,
      409
    );
    assert.equal(
      (
        await fetch(base + '/api/board', {
          method: 'PUT',
          headers,
          body: JSON.stringify({ ...boardBody, columns: [] }),
        })
      ).status,
      400
    );
    assert.equal(
      (
        await fetch(base + '/api/board/import', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ...boardBody,
            deviceId: user,
            mapping: { todo: 'todo' },
          }),
        })
      ).status,
      409
    );
    assert.ok(
      calls.some(
        (c) =>
          c.url.includes('archived_at=is.null') &&
          c.url.includes('workspace_id=eq.')
      )
    );
    assert.equal(
      (
        await fetch(base + '/api/tasks', {
          method: 'POST',
          headers,
          body: JSON.stringify({ title: 'Test', dueDate: 'invalid' }),
        })
      ).status,
      400
    );
    assert.equal(
      (
        await fetch(base + '/api/tasks/' + user, {
          method: 'PUT',
          headers,
          body: '{}',
        })
      ).status,
      400
    );
    assert.equal(
      (
        await fetch(base + '/api/tasks/' + user + '/restore', {
          method: 'POST',
          headers,
        })
      ).status,
      403
    );
    assert.ok(
      calls.some(
        (c) =>
          c.url.includes('/rpc/archive_task') &&
          JSON.parse(c.body).restore === true
      )
    );
    assert.equal(
      (await fetch(base + '/api/tasks?archived=true', { headers })).status,
      403
    );
    assert.equal(
      (
        await fetch(base + '/api/workspaces/' + workspace + '/invitations', {
          method: 'POST',
          headers,
          body: JSON.stringify({ email: 'recipient@example.com' }),
        })
      ).status,
      503
    );
    assert.ok(!calls.some((c) => c.url.includes('prepare_invitation')));
  } finally {
    globalThis.fetch = actualFetch;
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
});
