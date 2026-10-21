create extension if not exists pgcrypto;

create type public.workspace_role as enum ('owner', 'admin', 'member');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role public.workspace_role not null check (role in ('admin', 'member')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  invited_user_id uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null,
  description text not null default '',
  status text not null default 'todo',
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  started_at timestamptz,
  due_date timestamptz,
  expected_finish_at timestamptz,
  comment text,
  created_at timestamptz not null default now()
);

create index workspace_members_user_id_idx on public.workspace_members(user_id);
create index tasks_workspace_id_idx on public.tasks(workspace_id);
create index workspace_invitations_lookup_idx
  on public.workspace_invitations(workspace_id, email, expires_at)
  where accepted_at is null;

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace_id and user_id = auth.uid()
  );
$$;

create or replace function public.create_personal_workspace()
returns trigger language plpgsql security definer set search_path = public
as $$
declare new_workspace_id uuid;
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email));

  insert into public.workspaces (name, owner_id)
  values ('Personal workspace', new.id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_personal_workspace();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.tasks enable row level security;

create policy "Users can view their profile" on public.profiles
  for select using (id = auth.uid());

create policy "Members can view workspaces" on public.workspaces
  for select using (public.is_workspace_member(id));

create policy "Members can view membership" on public.workspace_members
  for select using (user_id = auth.uid() or public.is_workspace_member(workspace_id));

create policy "Members can view workspace invitations" on public.workspace_invitations
  for select using (public.is_workspace_member(workspace_id));

create policy "Members can view tasks" on public.tasks
  for select using (public.is_workspace_member(workspace_id));

create policy "Members can create tasks" on public.tasks
  for insert with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

create policy "Members can update tasks" on public.tasks
  for update using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "Admins can delete tasks" on public.tasks
  for delete using (
    exists (
      select 1 from public.workspace_members
      where workspace_id = tasks.workspace_id
        and user_id = auth.uid()
        and role in ('owner', 'admin')
    )
  );
