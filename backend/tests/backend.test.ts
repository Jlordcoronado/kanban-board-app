import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { taskSchema, updateTaskSchema } from '../src/taskValidation.js';

test('partial updates preserve omitted fields and reject invalid/privileged input', () => {
  assert.deepEqual(updateTaskSchema.parse({ title: 'Renamed' }), {
    title: 'Renamed',
  });
  assert.equal(taskSchema.parse({ title: 'New' }).priority, 'medium');
  for (const body of [
    {},
    { dueDate: 'yesterday' },
    { dueDate: '2026-02-30' },
    { archivedAt: null },
    { workspace_id: 'fake' },
    { title: ' ' },
  ]) {
    assert.equal(updateTaskSchema.safeParse(body).success, false);
  }
});

test('database permissions, archival, audit transactions and invitation acceptance', async (t) => {
  const db = new PGlite();
  const ids = {
    owner: '00000000-0000-4000-8000-000000000001',
    admin: '00000000-0000-4000-8000-000000000002',
    member: '00000000-0000-4000-8000-000000000003',
    stranger: '00000000-0000-4000-8000-000000000004',
    newcomer: '00000000-0000-4000-8000-000000000005',
    unverified: '00000000-0000-4000-8000-000000000006',
  };
  const query = async (sql: string, params: unknown[] = []) =>
    (await db.query<any>(sql, params)).rows;
  const as = async (user: string, sql: string, params: unknown[] = []) => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      user,
    ]);
    await db.exec('set role authenticated');
    try {
      return await query(sql, params);
    } finally {
      await db.exec('reset role');
    }
  };
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as
        $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth,public to authenticated,anon;
      grant execute on function auth.uid() to authenticated,anon;
    `);
    const schema = await readFile(
      new URL('../supabase/schema.sql', import.meta.url),
      'utf8'
    );
    await db.exec(
      schema.replace('create extension if not exists pgcrypto;', '')
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
    for (const [name, id] of Object.entries(ids)) {
      await query(
        'insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)',
        [
          id,
          `${name}@example.com`,
          name === 'unverified' ? null : new Date().toISOString(),
        ]
      );
    }
    const personal = (
      await query('select id from public.workspaces where owner_id=$1', [
        ids.owner,
      ])
    )[0].id;
    const team = (
      await as(ids.owner, "select (public.create_team('Test team')).id")
    )[0].id;
    // Fixture memberships are installed by the database owner, never by an application client.
    await query(
      "insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,'admin'),($1,$3,'member')",
      [team, ids.admin, ids.member]
    );
    let task: string;
    await t.test(
      'personal workspace stays private; team is created with owner membership',
      async () => {
        assert.equal(
          (
            await as(
              ids.stranger,
              'select * from public.workspaces where id=$1',
              [personal]
            )
          ).length,
          0
        );
        assert.equal(
          (
            await as(
              ids.owner,
              'select role from public.workspace_members where workspace_id=$1 and user_id=$2',
              [team, ids.owner]
            )
          )[0].role,
          'owner'
        );
        await assert.rejects(
          as(
            ids.owner,
            "select public.prepare_invitation($1,'stranger@example.com','member')",
            [personal]
          )
        );
      }
    );
    await t.test(
      'member creates task; edits preserve data and automatically set start time',
      async () => {
        task = (
          await as(
            ids.member,
            "insert into public.tasks(workspace_id,created_by,title,description,priority) values($1,$2,'Original','Keep me','high') returning id",
            [team, ids.member]
          )
        )[0].id;
        const row = (
          await as(
            ids.member,
            'select * from public.edit_task($1,$2,\'{"title":"Renamed"}\')',
            [team, task]
          )
        )[0];
        assert.equal(row.description, 'Keep me');
        assert.equal(row.priority, 'high');
        await as(
          ids.member,
          'select public.edit_task($1,$2,\'{"status":"in progress"}\')',
          [team, task]
        );
        assert.ok(
          (
            await query('select started_at from public.tasks where id=$1', [
              task,
            ])
          )[0].started_at
        );
        assert.equal(
          (
            await query('select * from public.task_activity where task_id=$1', [
              task,
            ])
          ).length,
          3
        );
      }
    );
    await t.test(
      'failed edits leave no audit event; direct update/delete and log tampering are denied',
      async () => {
        const count = (
          await query('select count(*) from public.task_activity')
        )[0].count;
        await assert.rejects(
          as(
            ids.stranger,
            'select public.edit_task($1,$2,\'{"title":"Intrusion"}\')',
            [team, task]
          )
        );
        await assert.rejects(
          as(
            ids.member,
            'select public.edit_task($1,$2,\'{"due_date":"invalid"}\')',
            [team, task]
          )
        );
        await assert.rejects(
          as(ids.member, 'delete from public.tasks where id=$1', [task])
        );
        await assert.rejects(
          as(
            ids.member,
            'update public.tasks set archived_at=now() where id=$1',
            [task]
          )
        );
        await assert.rejects(as(ids.owner, 'delete from public.task_activity'));
        assert.equal(
          (await query('select count(*) from public.task_activity'))[0].count,
          count
        );
      }
    );
    await t.test(
      'member archives; only managers read archive/history and restore',
      async () => {
        await as(ids.member, 'select public.archive_task($1,$2)', [team, task]);
        assert.equal(
          (
            await as(ids.member, 'select * from public.tasks where id=$1', [
              task,
            ])
          ).length,
          0
        );
        assert.equal(
          (await as(ids.member, 'select * from public.task_activity')).length,
          0
        );
        assert.equal(
          (
            await as(ids.admin, 'select * from public.tasks where id=$1', [
              task,
            ])
          ).length,
          1
        );
        await assert.rejects(
          as(ids.member, 'select public.archive_task($1,$2,true)', [team, task])
        );
        await as(ids.admin, 'select public.archive_task($1,$2,true)', [
          team,
          task,
        ]);
        const events = await query(
          'select action,actor_id from public.task_activity where task_id=$1 order by id',
          [task]
        );
        assert.deepEqual(
          events.slice(-2).map((e: any) => e.action),
          ['archived', 'restored']
        );
        assert.equal(events.at(-1).actor_id, ids.admin);
        await assert.rejects(
          as(ids.member, 'select public.archive_all_tasks($1)', [team])
        );
      }
    );
    await t.test(
      'admins cannot grant admin or remove owner/admin; owner can promote',
      async () => {
        await assert.rejects(
          as(ids.owner, 'select public.manage_member($1,$2)', [team, ids.owner])
        );
        await assert.rejects(
          as(ids.admin, "select public.manage_member($1,$2,'admin')", [
            team,
            ids.member,
          ])
        );
        await assert.rejects(
          as(ids.admin, 'select public.manage_member($1,$2)', [team, ids.owner])
        );
        await assert.rejects(
          as(
            ids.admin,
            "select public.prepare_invitation($1,'newcomer@example.com','admin')",
            [team]
          )
        );
        await as(ids.owner, "select public.manage_member($1,$2,'admin')", [
          team,
          ids.member,
        ]);
        await as(ids.owner, "select public.manage_member($1,$2,'member')", [
          team,
          ids.member,
        ]);
      }
    );
    await t.test(
      'invites reject duplicates, wrong email and unverified users; acceptance is single use',
      async () => {
        await as(
          ids.admin,
          "select public.prepare_invitation($1,'newcomer@example.com','member')",
          [team]
        );
        await assert.rejects(
          as(
            ids.admin,
            "select public.prepare_invitation($1,'NEWCOMER@example.com','member')",
            [team]
          )
        );
        await assert.rejects(
          as(ids.stranger, 'select public.accept_invitation($1)', [team])
        );
        await as(
          ids.owner,
          "select public.prepare_invitation($1,'unverified@example.com','member')",
          [team]
        );
        await assert.rejects(
          as(ids.unverified, 'select public.accept_invitation($1)', [team])
        );
        const accepted = (
          await as(ids.newcomer, 'select * from public.accept_invitation($1)', [
            team,
          ])
        )[0];
        assert.equal(accepted.role, 'member');
        await assert.rejects(
          as(ids.newcomer, 'select public.accept_invitation($1)', [team])
        );
      }
    );
    await t.test(
      'stale invitation cannot demote an existing owner',
      async () => {
        await query(
          "insert into public.workspace_invitations(workspace_id,email,role,invited_by,expires_at) values($1,'owner@example.com','member',$2,now()+interval '1 day')",
          [team, ids.admin]
        );
        const result = (
          await as(ids.owner, 'select * from public.accept_invitation($1)', [
            team,
          ])
        )[0];
        assert.equal(result.role, 'owner');
      }
    );
    await t.test(
      'expired invitations fail and unrelated users cannot inspect logs or tasks',
      async () => {
        await query(
          "update public.workspace_invitations set expires_at=now()-interval '1 day' where email='unverified@example.com'"
        );
        await query(
          'update auth.users set email_confirmed_at=now() where id=$1',
          [ids.unverified]
        );
        await assert.rejects(
          as(ids.unverified, 'select public.accept_invitation($1)', [team])
        );
        assert.equal(
          (
            await as(
              ids.stranger,
              'select * from public.tasks where workspace_id=$1',
              [team]
            )
          ).length,
          0
        );
        assert.equal(
          (await as(ids.stranger, 'select * from public.task_activity')).length,
          0
        );
      }
    );
    await t.test('audit-write failure rolls back the task change', async () => {
      const before = (
        await query('select title from public.tasks where id=$1', [task])
      )[0].title;
      const count = (
        await query('select count(*) from public.task_activity')
      )[0].count;
      await db.exec(`create function private.fail_audit() returns trigger language plpgsql as $$
        begin raise exception 'Simulated audit storage failure'; end $$;
        create trigger fail_audit before insert on public.task_activity for each row execute function private.fail_audit();`);
      await assert.rejects(
        as(
          ids.member,
          'select public.edit_task($1,$2,\'{"title":"Must roll back"}\')',
          [team, task]
        )
      );
      assert.equal(
        (await query('select title from public.tasks where id=$1', [task]))[0]
          .title,
        before
      );
      assert.equal(
        (await query('select count(*) from public.task_activity'))[0].count,
        count
      );
      await db.exec('drop trigger fail_audit on public.task_activity');
    });
    await t.test(
      'queued acceptance attempts have exactly one winner',
      async () => {
        await as(
          ids.owner,
          "select public.prepare_invitation($1,'stranger@example.com','member')",
          [team]
        );
        await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
          ids.stranger,
        ]);
        await db.exec('set role authenticated');
        // PGlite queues these requests on one connection. Separate-session contention
        // still needs a hosted/staging PostgreSQL check.
        const attempts = await Promise.allSettled([
          db.query('select public.accept_invitation($1)', [team]),
          db.query('select public.accept_invitation($1)', [team]),
        ]);
        await db.exec('reset role');
        assert.equal(
          attempts.filter((result) => result.status === 'fulfilled').length,
          1
        );
        assert.equal(
          (
            await query(
              'select * from public.workspace_members where workspace_id=$1 and user_id=$2',
              [team, ids.stranger]
            )
          ).length,
          1
        );
      }
    );
    await t.test(
      'admins remove regular members and removed users lose access',
      async () => {
        await as(ids.admin, 'select public.manage_member($1,$2)', [
          team,
          ids.stranger,
        ]);
        assert.equal(
          (
            await as(
              ids.stranger,
              'select * from public.tasks where workspace_id=$1',
              [team]
            )
          ).length,
          0
        );
        await assert.rejects(
          as(ids.admin, 'select public.manage_member($1,$2)', [team, ids.admin])
        );
      }
    );
  } finally {
    await db.close();
  }
});
