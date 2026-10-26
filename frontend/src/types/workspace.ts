export interface Workspace {
  id: string;
  name: string;
  kind: 'personal' | 'team';
  role: 'owner' | 'admin' | 'member';
}

export interface AccountWorkspaces {
  user: { id: string; email?: string };
  workspaces: Workspace[];
}
