import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { boardSchema } from '../src/board.js';

test('board migration, revisions, import retries, permissions and atomic column moves', async () => {
  const db = new PGlite();
  const owner = '00000000-0000-4000-8000-000000000001';
  const other = '00000000-0000-4000-8000-000000000002';
  const source = '00000000-0000-4000-8000-000000000003';
  const taskId = '00000000-0000-4000-8000-000000000004';
  const guestId = '00000000-0000-4000-8000-000000000005';
  const query = async (sql: string, args: unknown[] = []) =>
    (await db.query<any>(sql, args)).rows;
  const as = async (user: string, sql: string, args: unknown[] = []) => {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      user,
    ]);
    await db.exec('set role authenticated');
    try {
      return await query(sql, args);
    } finally {
      await db.exec('reset role');
    }
  };
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
    await db.exec(
      (
        await readFile(
          new URL('../supabase/schema.sql', import.meta.url),
          'utf8'
        )
      ).replace('create extension if not exists pgcrypto;', '')
    );
    await db.exec(
      await readFile(
        new URL(
          '../supabase/migrations/003_backend_readiness.sql',
          import.meta.url
        ),
        'utf8'
      )
    );
    await query('insert into auth.users(id,email) values($1,$2),($3,$4)', [
      owner,
      'owner@example.com',
      other,
      'other@example.com',
    ]);
    const w = (
      await query('select id from public.workspaces where owner_id=$1', [owner])
    )[0].id;
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      owner,
    ]);
    await query(
      "insert into public.tasks(id,workspace_id,created_by,title,status) values($1,$2,$3,'Existing custom task','review')",
      [taskId, w, owner]
    );
    await db.exec(
      await readFile(
        new URL(
          '../supabase/migrations/20261021152755_guest_cloud_board.sql',
          import.meta.url
        ),
        'utf8'
      )
    );
    const load = async () =>
      (await as(owner, 'select public.load_board($1) as board', [w]))[0].board;
    const save = async (b: unknown) =>
      (
        await as(owner, 'select public.save_board($1,$2) as board', [
          w,
          JSON.stringify(b),
        ])
      )[0].board;
    let board = await load();
    assert.ok(board.columns.some((c: any) => c.id === 'review'));
    assert.equal(board.tasks[0].title, 'Existing custom task');
    assert.equal(boardSchema.safeParse(board).success, true);
    const stale = structuredClone(board);
    board = await save({
      ...board,
      columns: board.columns.map((c: any) =>
        c.id === 'review' ? { ...c, title: 'Quality' } : c
      ),
    });
    assert.ok(board.revision > stale.revision);
    await assert.rejects(save(stale), /revision conflict/);
    await assert.rejects(
      as(other, 'select public.load_board($1)', [w]),
      /access denied/
    );
    await assert.rejects(
      as(other, 'select public.save_board($1,$2)', [w, JSON.stringify(board)]),
      /access denied/
    );
    await assert.rejects(
      as(
        owner,
        'update public.board_state set revision=0 where workspace_id=$1',
        [w]
      ),
      /permission denied/
    );
    await db.exec('set role anon');
    await assert.rejects(
      query('select public.load_board($1)', [w]),
      /permission denied/
    );
    await db.exec('reset role');
    const beforeInvalid = structuredClone(board);
    await assert.rejects(
      save({
        ...board,
        columns: [{ id: 'todo', title: 'Changed' }],
        tasks: [{ ...board.tasks[0], status: 'missing' }],
      }),
      /Invalid task/
    );
    assert.deepEqual(await load(), beforeInvalid);
    board = await save({
      ...board,
      columns: board.columns.filter((c: any) => c.id !== 'review'),
      tasks: board.tasks.map((t: any) => ({ ...t, status: 'todo' })),
    });
    assert.equal(board.tasks[0].status, 'todo');
    assert.ok(!board.columns.some((c: any) => c.id === 'review'));
    const importedTask = {
      ...board.tasks[0],
      id: guestId,
      title: 'Device task',
      status: 'local',
    };
    const payload = {
      revision: board.revision,
      deviceId: source,
      columns: [{ id: 'local', title: 'Review' }],
      tasks: [importedTask],
      mapping: { local: 'new-review' },
    };
    const copy = async (p: unknown) =>
      (
        await as(owner, 'select public.import_board($1,$2) as board', [
          w,
          JSON.stringify(p),
        ])
      )[0].board;
    await assert.rejects(
      copy({ ...payload, tasks: [importedTask, importedTask] }),
      /Duplicate guest task/
    );
    assert.deepEqual(await load(), board);
    board = await copy(payload);
    assert.equal(board.tasks.length, 2);
    assert.ok(board.tasks.some((t: any) => t.title === 'Existing custom task'));
    assert.ok(board.columns.some((c: any) => c.id === 'new-review'));
    await assert.rejects(copy(payload), /revision conflict/);
    board = await copy({
      ...payload,
      revision: board.revision,
      tasks: [{ ...importedTask, title: 'Changed locally later' }],
    });
    assert.equal(board.tasks.length, 2);
    assert.equal(
      board.tasks.find((t: any) => t.status === 'new-review').title,
      'Device task'
    );
    const archivedGuest = {
      ...importedTask,
      id: '00000000-0000-4000-8000-000000000006',
      archivedAt: new Date().toISOString(),
    };
    board = await copy({
      ...payload,
      revision: board.revision,
      tasks: [archivedGuest],
    });
    assert.equal(board.tasks.length, 2);
    const badImport = {
      ...payload,
      revision: board.revision,
      tasks: [
        {
          ...importedTask,
          id: '00000000-0000-4000-8000-000000000007',
          title: '',
        },
      ],
      columns: [{ id: 'local', title: 'New stage' }],
      mapping: { local: 'invalid-new' },
    };
    await assert.rejects(copy(badImport), /Invalid task/);
    assert.deepEqual(await load(), board);
    assert.equal(
      (await query('select count(*)::int as n from public.guest_imports'))[0].n,
      1
    );
    const old = structuredClone(board);
    await as(
      owner,
      'select public.edit_task($1,$2,\'{"title":"Legacy edit"}\'::jsonb)',
      [w, taskId]
    );
    assert.ok((await load()).revision > old.revision);
    await assert.rejects(save(old), /revision conflict/);
    board = await load();
    const oldTasks = board.tasks;
    board = await save({ ...board, tasks: [] });
    assert.equal(board.tasks.length, 0);
    assert.equal(
      (
        await query(
          'select count(*)::int as n from public.tasks where workspace_id=$1 and archived_at is not null',
          [w]
        )
      )[0].n,
      oldTasks.length
    );
    const policies = await query(
      "select relname,relrowsecurity from pg_class where relname in ('board_state','guest_imports')"
    );
    assert.ok(policies.every((r: any) => r.relrowsecurity));
    assert.equal(
      (
        await query(
          "select has_function_privilege('anon','public.save_board(uuid,jsonb)','execute') as allowed"
        )
      )[0].allowed,
      false
    );
  } finally {
    await db.close();
  }
});
