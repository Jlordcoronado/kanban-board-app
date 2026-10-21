create table if not exists public.workspace_invitations (
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

create index if not exists workspace_invitations_lookup_idx
  on public.workspace_invitations(workspace_id, email, expires_at)
  where accepted_at is null;

alter table public.workspace_invitations enable row level security;

drop policy if exists "Members can view workspace invitations" on public.workspace_invitations;
create policy "Members can view workspace invitations"
  on public.workspace_invitations
  for select
  using (public.is_workspace_member(workspace_id));
