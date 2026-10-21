begin;
create table public.board_state (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  revision bigint not null default 0,
  columns jsonb not null default '[{"id":"todo","title":"To Do"},{"id":"in progress","title":"In Progress"},{"id":"done","title":"Done"}]'
);
create table public.guest_imports (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  device_id uuid not null,
  guest_task_id uuid not null,
  cloud_task_id uuid not null references public.tasks(id) on delete restrict,
  primary key (workspace_id, device_id, guest_task_id)
);
alter table public.board_state enable row level security;
alter table public.guest_imports enable row level security;
revoke all on public.board_state, public.guest_imports from public, anon, authenticated;
grant select on public.board_state, public.guest_imports to authenticated;
create policy member_board on public.board_state for select to authenticated using (public.is_workspace_member(workspace_id));
create policy member_import on public.guest_imports for select to authenticated using (public.is_workspace_member(workspace_id));

-- Preserve every historical custom stage, even if an old workspace exceeds seven.
insert into public.board_state(workspace_id) select id from public.workspaces;
update public.board_state b set columns=b.columns || coalesce((
  select jsonb_agg(jsonb_build_object('id',s.status,'title',s.status) order by s.status)
  from (select distinct status from public.tasks where workspace_id=b.workspace_id
    and status not in ('todo','in progress','done')) s
), '[]'::jsonb);

create function private.initialize_board() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.board_state(workspace_id) values(new.id); return new; end $$;
create trigger initialize_board after insert on public.workspaces for each row execute function private.initialize_board();

-- All old task APIs also advance the board revision. Unknown legacy stages remain visible.
create function private.revise_board() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.board_state set revision=revision+1,
    columns=case when exists(select 1 from jsonb_array_elements(columns) c where c->>'id'=new.status)
      then columns else columns || jsonb_build_array(jsonb_build_object('id',new.status,'title',new.status)) end
    where workspace_id=new.workspace_id;
  return new;
end $$;
create trigger revise_board before insert or update on public.tasks for each row execute function private.revise_board();

create function private.board_snapshot(w uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.board_state; items jsonb;
begin
  if auth.uid() is null or private.role_in(w) is null then raise exception 'Workspace access denied' using errcode='42501'; end if;
  select * into b from public.board_state where workspace_id=w for update;
  if not found then raise exception 'Board not found' using errcode='P0002'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',t.id,'title',t.title,'description',t.description,'status',t.status,'priority',t.priority,
    'startedAt',t.started_at,'dueDate',t.due_date,'expectedFinishAt',t.expected_finish_at
  ) order by t.created_at,t.id),'[]') into items from public.tasks t where workspace_id=w and archived_at is null;
  return jsonb_build_object('revision',b.revision,'columns',b.columns,'tasks',items);
end $$;
create function public.load_board(w uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.board_snapshot(w) $$;

create function private.write_board(w uuid, payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.board_state; item jsonb; column_value jsonb; row public.tasks; ids uuid[] := '{}'; task_id uuid;
begin
  if auth.uid() is null or private.role_in(w) is null then raise exception 'Workspace access denied' using errcode='42501'; end if;
  select * into b from public.board_state where workspace_id=w for update;
  if not found then raise exception 'Board not found' using errcode='P0002'; end if;
  if (payload->>'revision')::bigint is distinct from b.revision then raise exception 'Board revision conflict' using errcode='40001'; end if;
  if jsonb_typeof(payload->'columns') is distinct from 'array' or jsonb_typeof(payload->'tasks') is distinct from 'array'
    or jsonb_array_length(payload->'columns') not between 1 and greatest(7,jsonb_array_length(b.columns)) then
    raise exception 'Invalid board columns' using errcode='22023'; end if;
  if (select count(distinct c->>'id') from jsonb_array_elements(payload->'columns') c) <> jsonb_array_length(payload->'columns') then
    raise exception 'Duplicate columns' using errcode='22023'; end if;
  for column_value in select value from jsonb_array_elements(payload->'columns') loop
    if column_value->>'id' is null or length(trim(column_value->>'id')) not between 1 and 100 or column_value->>'title' is null or length(trim(column_value->>'title')) not between 1 and 100 then
      raise exception 'Invalid column' using errcode='22023'; end if;
  end loop;
  for item in select value from jsonb_array_elements(payload->'tasks') loop
    task_id := (item->>'id')::uuid;
    if task_id is null or task_id=any(ids) then raise exception 'Invalid task identity' using errcode='22023'; end if;
    ids := array_append(ids,task_id);
    if item->>'title' is null or length(trim(item->>'title')) not between 1 and 200
      or item->>'description' is null or length(item->>'description')>2000
      or item->>'priority' is null or item->>'priority' not in ('low','medium','high')
      or not exists(select 1 from jsonb_array_elements(payload->'columns') c where c->>'id'=item->>'status') then
      raise exception 'Invalid task' using errcode='22023'; end if;
    select * into row from public.tasks where id=task_id;
    if found then
      if row.workspace_id<>w or row.archived_at is not null then raise exception 'Task identity unavailable' using errcode='42501'; end if;
      update public.tasks set title=item->>'title',description=item->>'description',status=item->>'status',priority=item->>'priority',
        started_at=(item->>'startedAt')::timestamptz,due_date=(item->>'dueDate')::timestamptz,expected_finish_at=(item->>'expectedFinishAt')::timestamptz
        where id=task_id and (title,description,status,priority,started_at,due_date,expected_finish_at) is distinct from
        (item->>'title',item->>'description',item->>'status',item->>'priority',(item->>'startedAt')::timestamptz,(item->>'dueDate')::timestamptz,(item->>'expectedFinishAt')::timestamptz);
    else
      insert into public.tasks(id,workspace_id,created_by,title,description,status,priority,started_at,due_date,expected_finish_at)
        values(task_id,w,auth.uid(),item->>'title',item->>'description',item->>'status',item->>'priority',
          (item->>'startedAt')::timestamptz,(item->>'dueDate')::timestamptz,(item->>'expectedFinishAt')::timestamptz);
    end if;
  end loop;
  -- Omitting active tasks means archive, never hard deletion.
  if exists(select 1 from public.tasks where workspace_id=w and archived_at is null and not(id=any(ids)))
    and cardinality(ids)=0 and not private.manager(w) then raise exception 'Manager access required' using errcode='42501'; end if;
  update public.tasks set archived_at=now(),archived_by=auth.uid() where workspace_id=w and archived_at is null and not(id=any(ids));
  update public.board_state set columns=payload->'columns',revision=revision+1 where workspace_id=w;
  return private.board_snapshot(w);
end $$;
create function public.save_board(w uuid,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.write_board(w,payload) $$;

create function private.copy_guest_board(w uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare b jsonb; item jsonb; col jsonb; mapped text; cloud_id uuid; additions jsonb := '[]'; source uuid;
begin
  b := private.board_snapshot(w); -- Permission check and workspace lock.
  if (payload->>'revision')::bigint is distinct from (b->>'revision')::bigint then raise exception 'Board revision conflict' using errcode='40001'; end if;
  source := (payload->>'deviceId')::uuid;
  if source is null or jsonb_typeof(payload->'tasks') is distinct from 'array' or jsonb_typeof(payload->'columns') is distinct from 'array'
    or jsonb_typeof(payload->'mapping') is distinct from 'object' then raise exception 'Invalid import' using errcode='22023'; end if;
  if (select count(distinct t->>'id') from jsonb_array_elements(payload->'tasks') t) <> jsonb_array_length(payload->'tasks') then
    raise exception 'Duplicate guest task identities' using errcode='22023'; end if;
  for col in select value from jsonb_array_elements(payload->'columns') loop
    mapped := payload->'mapping'->>(col->>'id');
    if mapped is null then raise exception 'Missing column mapping' using errcode='22023'; end if;
    if not exists(select 1 from jsonb_array_elements(b->'columns') c where c->>'id'=mapped) then
      b := jsonb_set(b,'{columns}',(b->'columns') || jsonb_build_array(jsonb_build_object('id',mapped,'title',col->>'title')));
    end if;
  end loop;
  if jsonb_array_length(b->'columns')>greatest(7,(select jsonb_array_length(columns) from public.board_state where workspace_id=w)) then
    raise exception 'Maximum seven columns' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(payload->'tasks') loop
    if item->>'archivedAt' is not null then continue; end if;
    if exists(select 1 from public.guest_imports where workspace_id=w and device_id=source and guest_task_id=(item->>'id')::uuid) then continue; end if;
    mapped := payload->'mapping'->>(item->>'status');
    if mapped is null then raise exception 'Missing task mapping' using errcode='22023'; end if;
    cloud_id := gen_random_uuid();
    additions := additions || jsonb_build_array(jsonb_set(jsonb_set(item,'{id}',to_jsonb(cloud_id::text)),'{status}',to_jsonb(mapped)));
    -- FK is checked after inserting tasks below.
  end loop;
  b := private.write_board(w,jsonb_set(b,'{tasks}',(b->'tasks') || additions));
  -- Pair only newly copied source identities with the generated IDs, in order.
  declare i integer := 0;
  begin
    for item in select value from jsonb_array_elements(payload->'tasks') loop
      if item->>'archivedAt' is not null or exists(select 1 from public.guest_imports where workspace_id=w and device_id=source and guest_task_id=(item->>'id')::uuid) then continue; end if;
      insert into public.guest_imports values(w,source,(item->>'id')::uuid,(additions->i->>'id')::uuid);
      i := i+1;
    end loop;
  end;
  return b;
end $$;
create function public.import_board(w uuid,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.copy_guest_board(w,payload) $$;

revoke all on function private.initialize_board(),private.revise_board(),private.board_snapshot(uuid),private.write_board(uuid,jsonb),private.copy_guest_board(uuid,jsonb),
  public.load_board(uuid),public.save_board(uuid,jsonb),public.import_board(uuid,jsonb) from public,anon;
grant execute on function private.board_snapshot(uuid),private.write_board(uuid,jsonb),private.copy_guest_board(uuid,jsonb),
  public.load_board(uuid),public.save_board(uuid,jsonb),public.import_board(uuid,jsonb) to authenticated;
commit;
