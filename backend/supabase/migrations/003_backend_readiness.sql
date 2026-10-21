begin;

-- Never silently reclassify or remove memberships in an already shared workspace.
do $$ begin
  if exists(select 1 from public.workspaces w join public.workspace_members m on m.workspace_id=w.id
    where m.user_id<>w.owner_id) then
    raise exception 'Existing shared workspaces require classification before this migration. No changes applied.';
  end if;
end $$;

-- Existing workspaces were personal workspaces. Preserve them and their tasks.
alter table public.workspaces add column kind text not null default 'personal'
  check (kind in ('personal', 'team'));
create unique index one_personal_workspace_per_owner on public.workspaces(owner_id) where kind = 'personal';
alter table public.tasks add column archived_at timestamptz;
alter table public.tasks add column archived_by uuid references auth.users(id);
alter table public.workspace_members add constraint workspace_member_profile
  foreign key (user_id) references public.profiles(id);
alter table public.workspace_invitations add column revoked_at timestamptz;
grant select, update (revoked_at) on public.workspace_invitations to service_role;
alter table public.tasks add constraint task_text_limits check (
  length(trim(title)) between 1 and 200 and length(description)<=2000
  and length(trim(status)) between 1 and 100 and length(comment)<=1000
);

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create function private.role_in(w uuid) returns public.workspace_role
language sql stable security definer set search_path = '' as $$
  select role from public.workspace_members where workspace_id = w and user_id = auth.uid()
$$;
create function private.manager(w uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.role_in(w) in ('owner','admin'), false)
$$;

create table public.task_activity (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  task_id uuid not null references public.tasks(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  actor_display_name text not null,
  action text not null check (action in ('created','edited','archived','restored')),
  changes jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
create index task_activity_workspace on public.task_activity(workspace_id, id desc);
alter table public.task_activity enable row level security;
create policy manager_activity on public.task_activity for select to authenticated
  using (private.manager(workspace_id));

-- Restrict browser/API table privileges explicitly; RLS also restricts reads.
revoke all on public.profiles, public.workspaces, public.workspace_members,
  public.workspace_invitations, public.tasks, public.task_activity from anon, authenticated;
grant select on public.profiles, public.workspaces, public.workspace_members,
  public.tasks, public.task_activity to authenticated;
-- Mutations use checked database functions; no direct updates or hard deletes.
grant insert (workspace_id, created_by, title, description, status, priority,
  started_at, due_date, expected_finish_at, comment) on public.tasks to authenticated;

drop policy "Members can view tasks" on public.tasks;
create policy active_or_manager on public.tasks for select to authenticated using (
  public.is_workspace_member(workspace_id) and (archived_at is null or private.manager(workspace_id))
);
drop policy "Members can update tasks" on public.tasks;
drop policy "Admins can delete tasks" on public.tasks;
drop policy "Users can view their profile" on public.profiles;
create policy teammate_profiles on public.profiles for select to authenticated using (
  id = auth.uid() or exists (
    select 1 from public.workspace_members m where m.user_id = profiles.id
      and public.is_workspace_member(m.workspace_id)
  )
);

create function private.audit_task() returns trigger
language plpgsql security definer set search_path = '' as $$
declare event text; diff jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if tg_op = 'INSERT' then
    event := 'created';
    select jsonb_object_agg(key, jsonb_build_object('before', null, 'after', value)) into diff
      from jsonb_each(to_jsonb(new)) where key not in ('id','workspace_id','created_by','created_at');
  else
    if new.id <> old.id or new.workspace_id <> old.workspace_id or new.created_by <> old.created_by then
      raise exception 'Task identity is immutable' using errcode = '42501';
    end if;
    if new.archived_at is distinct from old.archived_at then
      event := case when new.archived_at is null then 'restored' else 'archived' end;
    else event := 'edited'; end if;
    select jsonb_object_agg(n.key, jsonb_build_object('before', o.value, 'after', n.value)) into diff
      from jsonb_each(to_jsonb(new)) n join jsonb_each(to_jsonb(old)) o using (key)
      where n.value is distinct from o.value;
    if diff is null then return new; end if;
  end if;
  insert into public.task_activity(workspace_id,task_id,actor_id,actor_display_name,action,changes)
    values(new.workspace_id,new.id,auth.uid(),
      coalesce((select display_name from public.profiles where id=auth.uid()),auth.uid()::text),event,diff);
  return new;
end $$;
create trigger task_activity_trigger after insert or update on public.tasks
  for each row execute function private.audit_task();

create function public.create_team(team_name text) returns public.workspaces
language plpgsql security definer set search_path = '' as $$
declare w public.workspaces;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if length(trim(team_name)) not between 1 and 100 then raise exception 'Invalid team name' using errcode='22023'; end if;
  insert into public.workspaces(name,owner_id,kind) values(trim(team_name),auth.uid(),'team') returning * into w;
  insert into public.workspace_members values(w.id,auth.uid(),'owner',now());
  return w;
end $$;

create function public.edit_task(w uuid, t uuid, patch jsonb) returns public.tasks
language plpgsql security definer set search_path = '' as $$
declare original public.tasks; result public.tasks;
begin
  if private.role_in(w) is null then raise exception 'Workspace access denied' using errcode='42501'; end if;
  select * into original from public.tasks where id=t and workspace_id=w and archived_at is null for update;
  if not found then raise exception 'Task not found' using errcode='P0002'; end if;
  if patch = '{}'::jsonb or exists(select 1 from jsonb_object_keys(patch) k where k not in
    ('title','description','status','priority','started_at','due_date','expected_finish_at','comment')) then
    raise exception 'Invalid task fields' using errcode='22023';
  end if;
  result := jsonb_populate_record(original, patch);
  if result.title is null or length(trim(result.title)) not between 1 and 200
    or result.description is null or length(result.description)>2000
    or result.status is null or length(trim(result.status)) not between 1 and 100
    or result.priority is null or result.priority not in ('low','medium','high')
    or length(result.comment)>1000 then raise exception 'Invalid task' using errcode='22023'; end if;
  if result.status='in progress' and original.status<>'in progress' and result.started_at is null then
    result.started_at := now();
  end if;
  update public.tasks set title=result.title,description=result.description,status=result.status,
    priority=result.priority,started_at=result.started_at,due_date=result.due_date,
    expected_finish_at=result.expected_finish_at,comment=result.comment where id=t returning * into result;
  return result;
end $$;

create function public.archive_task(w uuid, t uuid, restore boolean default false) returns public.tasks
language plpgsql security definer set search_path = '' as $$
declare result public.tasks;
begin
  if private.role_in(w) is null or (restore and not private.manager(w)) then
    raise exception 'Workspace access denied' using errcode='42501'; end if;
  update public.tasks set archived_at=case when restore then null else now() end,
    archived_by=case when restore then null else auth.uid() end
    where id=t and workspace_id=w and ((restore and archived_at is not null) or (not restore and archived_at is null))
    returning * into result;
  if not found then raise exception 'Task not found' using errcode='P0002'; end if;
  return result;
end $$;
create function public.archive_all_tasks(w uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.manager(w) then raise exception 'Manager access required' using errcode='42501'; end if;
  update public.tasks set archived_at=now(),archived_by=auth.uid() where workspace_id=w and archived_at is null;
end $$;

create function public.manage_member(w uuid, target uuid, new_role public.workspace_role default null) returns void
language plpgsql security definer set search_path = '' as $$
declare caller public.workspace_role; member_role public.workspace_role;
begin
  -- Serialize member and invitation changes within a workspace.
  perform 1 from public.workspaces where id=w and kind='team' for update;
  if not found then raise exception 'Team not found' using errcode='P0002'; end if;
  caller := private.role_in(w);
  select role into member_role from public.workspace_members where workspace_id=w and user_id=target;
  if caller is null or caller='member' or member_role='owner' or new_role='owner'
    or (caller='admin' and (member_role<>'member' or new_role is not null)) then
    raise exception 'Role change forbidden' using errcode='42501'; end if;
  if member_role is null then raise exception 'Member not found' using errcode='P0002'; end if;
  if new_role is null then delete from public.workspace_members where workspace_id=w and user_id=target;
  else update public.workspace_members set role=new_role where workspace_id=w and user_id=target; end if;
end $$;

create function public.prepare_invitation(w uuid, invite_email text, invite_role public.workspace_role) returns public.workspace_invitations
language plpgsql security definer set search_path = '' as $$
declare result public.workspace_invitations; caller public.workspace_role;
begin
  perform 1 from public.workspaces where id=w and kind='team' for update;
  if not found then raise exception 'Invitations require a team workspace' using errcode='22023'; end if;
  caller := private.role_in(w);
  if caller is null or caller='member' or invite_role is null or invite_role='owner'
    or (invite_role='admin' and caller<>'owner') then raise exception 'Invitation forbidden' using errcode='42501'; end if;
  if invite_email is null or length(invite_email)>255 or position('@' in invite_email)<2 then
    raise exception 'Invalid email' using errcode='22023'; end if;
  invite_email := lower(trim(invite_email));
  if exists(select 1 from public.workspace_members m join auth.users u on u.id=m.user_id
    where m.workspace_id=w and lower(u.email)=invite_email) then
    raise exception 'Already a member' using errcode='23505'; end if;
  if exists(select 1 from public.workspace_invitations where workspace_id=w and email=invite_email
    and accepted_at is null and revoked_at is null and expires_at>now()) then
    raise exception 'Active invitation already exists' using errcode='23505'; end if;
  insert into public.workspace_invitations(workspace_id,email,role,invited_by,expires_at)
    values(w,invite_email,invite_role,auth.uid(),now()+interval '7 days') returning * into result;
  return result;
end $$;

create function public.accept_invitation(w uuid) returns public.workspace_members
language plpgsql security definer set search_path = '' as $$
declare invitation public.workspace_invitations; result public.workspace_members; verified_email text;
begin
  perform 1 from public.workspaces where id=w and kind='team' for update;
  if not found then raise exception 'Team not found' using errcode='P0002'; end if;
  select lower(email) into verified_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
  if verified_email is null then raise exception 'Verified email required' using errcode='42501'; end if;
  select * into invitation from public.workspace_invitations where workspace_id=w and email=verified_email
    and accepted_at is null and revoked_at is null and expires_at>now() for update;
  if not found then raise exception 'No active invitation' using errcode='P0002'; end if;
  -- A removed or demoted inviter cannot grant stale privileges.
  if not exists(select 1 from public.workspace_members where workspace_id=w and user_id=invitation.invited_by
    and (role='owner' or (role='admin' and invitation.role='member'))) then
    raise exception 'Inviter no longer authorized' using errcode='42501'; end if;
  insert into public.workspace_members(workspace_id,user_id,role)
    values(w,auth.uid(),invitation.role) on conflict do nothing;
  select * into result from public.workspace_members where workspace_id=w and user_id=auth.uid();
  update public.workspace_invitations set accepted_at=now(),accepted_by=auth.uid() where id=invitation.id;
  return result;
end $$;

-- Only explicitly listed RPCs are callable by signed-in clients.
revoke all on function public.create_team(text),public.edit_task(uuid,uuid,jsonb),
  public.archive_task(uuid,uuid,boolean),public.archive_all_tasks(uuid),
  public.manage_member(uuid,uuid,public.workspace_role),
  public.prepare_invitation(uuid,text,public.workspace_role),public.accept_invitation(uuid) from public, anon;
grant execute on function public.create_team(text),public.edit_task(uuid,uuid,jsonb),
  public.archive_task(uuid,uuid,boolean),public.archive_all_tasks(uuid),
  public.manage_member(uuid,uuid,public.workspace_role),
  public.prepare_invitation(uuid,text,public.workspace_role),public.accept_invitation(uuid) to authenticated;
revoke all on function private.audit_task() from public;
revoke all on function private.role_in(uuid),private.manager(uuid) from public;
grant execute on function private.role_in(uuid),private.manager(uuid) to authenticated;
commit;
