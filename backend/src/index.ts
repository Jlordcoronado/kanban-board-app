import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import {
  taskSchema,
  updateTaskSchema,
  databaseFields,
} from './taskValidation.js';
import { invitationMailer } from './mail.js';
import { z } from 'zod';
import { boardSchema, importSchema } from './board.js';
import { getAuth, requireAuth } from './middleware.js';

export const app = express();
const PORT = Number(process.env.PORT ?? 5000);
const AI_REWRITE_LIMIT = 3;
const AI_REWRITE_WINDOW_MS = 10 * 60 * 1000;
const aiRewriteRequests = new Map<string, number[]>();
const invitationSchema = z.object({
  email: z.string().email().max(255),
  role: z.enum(['admin', 'member']).default('member'),
});

app.set('trust proxy', 1);
app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }));
app.use(express.json({ limit: '8mb' }));

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (
      err instanceof SyntaxError &&
      'status' in err &&
      (err as { status?: number }).status === 400
    ) {
      res.status(400).json({ message: 'Invalid JSON payload' });
      return;
    }
    next(err);
  }
);

const rewriteTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

type TaskRow = {
  id: string;
  workspace_id: string;
  created_by: string;
  title: string;
  description: string | null;
  status: string;
  priority: 'low' | 'medium' | 'high';
  started_at: string | null;
  due_date: string | null;
  expected_finish_at: string | null;
  comment: string | null;
  archived_at: string | null;
  archived_by: string | null;
};

function mapTask(row: TaskRow) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    description: row.description ?? '',
    status: row.status,
    priority: row.priority ?? 'medium',
    startedAt: row.started_at,
    dueDate: row.due_date,
    expectedFinishAt: row.expected_finish_at,
    comment: row.comment,
    archivedAt: row.archived_at,
    archivedBy: row.archived_by,
  };
}

function getAiRateLimit(userId: string): number | null {
  const now = Date.now();
  const recentRequests = (aiRewriteRequests.get(userId) ?? []).filter(
    (requestedAt) => now - requestedAt < AI_REWRITE_WINDOW_MS
  );
  if (recentRequests.length >= AI_REWRITE_LIMIT) {
    aiRewriteRequests.set(userId, recentRequests);
    return Math.ceil(
      (AI_REWRITE_WINDOW_MS - (now - recentRequests[0]!)) / 1000
    );
  }
  recentRequests.push(now);
  aiRewriteRequests.set(userId, recentRequests);
  return null;
}

async function getWorkspaceId(req: express.Request): Promise<string | null> {
  const { user, supabase } = getAuth(req);
  const requestedWorkspaceId = req.header('x-workspace-id');
  if (requestedWorkspaceId) z.string().uuid().parse(requestedWorkspaceId);
  if (!requestedWorkspaceId) {
    const { data, error } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', user.id)
      .eq('kind', 'personal')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data?.id ?? null;
  }

  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('workspace_id', requestedWorkspaceId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data?.workspace_id ?? null;
}

async function getWorkspaceRole(
  req: express.Request,
  workspaceId: string
): Promise<'owner' | 'admin' | 'member' | null> {
  const { user, supabase } = getAuth(req);
  const { data, error } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data?.role ?? null;
}

function getServiceClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey)
    throw new Error('Supabase service role is not configured');
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const uuid = z.string().uuid();
function workspaceParam(req: express.Request): string {
  return uuid.parse(req.params.workspaceId);
}
function fail(res: express.Response, error: unknown): void {
  const code = (error as { code?: string })?.code;
  const status =
    error instanceof z.ZodError ||
    code === '22023' ||
    code === '22P02' ||
    code === '22007' ||
    code === '22008'
      ? 400
      : code === '42501'
        ? 403
        : code === 'P0002'
          ? 404
          : code === '23505'
            ? 409
            : 500;
  const message =
    status === 500
      ? 'Unable to complete request'
      : error instanceof Error
        ? error.message
        : ((error as { message?: string })?.message ?? 'Request rejected');
  res.status(status).json({ message });
}

app.post('/api/workspaces', requireAuth, async (req, res) => {
  try {
    const { name } = z
      .object({ name: z.string().trim().min(1).max(100) })
      .strict()
      .parse(req.body);
    const { data, error } = await getAuth(req)
      .supabase.rpc('create_team', {
        team_name: name,
      })
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    fail(res, error);
  }
});

app.get(
  '/api/workspaces/:workspaceId/members',
  requireAuth,
  async (req, res) => {
    try {
      const w = workspaceParam(req);
      if (!(await getWorkspaceRole(req, w)))
        return res.status(403).json({ message: 'Workspace access denied' });
      const { data, error } = await getAuth(req)
        .supabase.from('workspace_members')
        .select(
          'user_id, role, created_at, profiles!workspace_member_profile(display_name)'
        )
        .eq('workspace_id', w)
        .order('created_at');
      if (error) throw error;
      res.json(data);
    } catch (error) {
      fail(res, error);
    }
  }
);

app.patch(
  '/api/workspaces/:workspaceId/members/:userId',
  requireAuth,
  async (req, res) => {
    try {
      const { role } = z
        .object({ role: z.enum(['admin', 'member']) })
        .strict()
        .parse(req.body);
      const { error } = await getAuth(req).supabase.rpc('manage_member', {
        w: workspaceParam(req),
        target: uuid.parse(req.params.userId),
        new_role: role,
      });
      if (error) throw error;
      res.status(204).send();
    } catch (error) {
      fail(res, error);
    }
  }
);
app.delete(
  '/api/workspaces/:workspaceId/members/:userId',
  requireAuth,
  async (req, res) => {
    try {
      const { error } = await getAuth(req).supabase.rpc('manage_member', {
        w: workspaceParam(req),
        target: uuid.parse(req.params.userId),
      });
      if (error) throw error;
      res.status(204).send();
    } catch (error) {
      fail(res, error);
    }
  }
);

app.post(
  '/api/workspaces/:workspaceId/invitations',
  requireAuth,
  async (req, res) => {
    let send: ReturnType<typeof invitationMailer>;
    let service: ReturnType<typeof getServiceClient>;
    try {
      send = invitationMailer();
      service = getServiceClient();
    } catch {
      return res
        .status(503)
        .json({ message: 'Invitation email is not configured' });
    }
    try {
      const body = invitationSchema.strict().parse(req.body);
      const w = workspaceParam(req);
      const { data, error } = await getAuth(req)
        .supabase.rpc('prepare_invitation', {
          w,
          invite_email: normalizeEmail(body.email),
          invite_role: body.role,
        })
        .single<{
          id: string;
          email: string;
          role: string;
          expires_at: string;
        }>();
      if (error) throw error;
      try {
        await send(data.email, w);
      } catch {
        // Revoke after a failed/uncertain SMTP delivery, allowing a safe retry.
        const { error: revokeError } = await service
          .from('workspace_invitations')
          .update({ revoked_at: new Date().toISOString() })
          .eq('id', data.id)
          .is('accepted_at', null);
        return res.status(503).json({
          message: revokeError
            ? 'Email delivery failed; invitation cleanup requires administrator attention'
            : 'Email delivery failed. Please retry the invitation.',
        });
      }
      res.status(201).json({
        id: data.id,
        email: data.email,
        role: data.role,
        expires_at: data.expires_at,
        delivery: 'accepted_by_mail_server',
      });
    } catch (error) {
      fail(res, error);
    }
  }
);

app.post(
  '/api/workspaces/:workspaceId/invitations/accept',
  requireAuth,
  async (req, res) => {
    try {
      const { data, error } = await getAuth(req)
        .supabase.rpc('accept_invitation', { w: workspaceParam(req) })
        .single<{ workspace_id: string; role: string }>();
      if (error) throw error;
      res.json({ workspaceId: data.workspace_id, role: data.role });
    } catch (error) {
      fail(res, error);
    }
  }
);

app.get(
  '/api/workspaces/:workspaceId/activity',
  requireAuth,
  async (req, res) => {
    try {
      const w = workspaceParam(req);
      const role = await getWorkspaceRole(req, w);
      if (role !== 'owner' && role !== 'admin')
        return res.status(403).json({ message: 'Manager access required' });
      const before = z.coerce
        .number()
        .int()
        .positive()
        .optional()
        .parse(req.query.before);
      let query = getAuth(req)
        .supabase.from('task_activity')
        .select('*')
        .eq('workspace_id', w)
        .order('id', { ascending: false })
        .limit(100);
      if (before) query = query.lt('id', before);
      const { data, error } = await query;
      if (error) throw error;
      res.json({
        events: data,
        nextBefore: data?.length === 100 ? data[99].id : null,
      });
    } catch (error) {
      fail(res, error);
    }
  }
);

app.get('/api/me', requireAuth, async (req, res) => {
  const { user, supabase } = getAuth(req);
  const { data: memberships, error } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id);

  if (error) {
    res.status(500).json({ message: 'Unable to load workspaces' });
    return;
  }

  const workspaces = await Promise.all(
    (memberships ?? []).map(async (membership) => {
      const result = await supabase
        .from('workspaces')
        .select('id, name, owner_id, kind')
        .eq('id', membership.workspace_id)
        .single();
      if (result.error) throw result.error;
      return { ...result.data, role: membership.role };
    })
  );

  res.json({
    user: { id: user.id, email: user.email },
    workspaces: workspaces.filter(Boolean),
  });
});

// Board RPCs return one consistent snapshot and serialize writes in PostgreSQL.
for (const method of ['get', 'put', 'post'] as const) {
  app[method](
    method === 'post' ? '/api/board/import' : '/api/board',
    requireAuth,
    async (req, res) => {
      try {
        const w = await getWorkspaceId(req);
        if (!w)
          return res.status(403).json({ message: 'Workspace access denied' });
        const body =
          method === 'put'
            ? boardSchema.parse(req.body)
            : method === 'post'
              ? importSchema.parse(req.body)
              : null;
        const { data, error } = await getAuth(req).supabase.rpc(
          method === 'get'
            ? 'load_board'
            : method === 'put'
              ? 'save_board'
              : 'import_board',
          body ? { w, payload: body } : { w }
        );
        if (error?.code === '40001')
          return res
            .status(409)
            .json({
              message:
                'Your cloud board changed. Review the latest board before applying your draft.',
            });
        if (error) throw error;
        res.json(data);
      } catch (error) {
        fail(res, error);
      }
    }
  );
}

app.get('/api/tasks', requireAuth, async (req, res) => {
  try {
    const { supabase } = getAuth(req);
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId)
      return res
        .status(403)
        .json({ message: 'You are not a member of this workspace' });

    const archived =
      z.enum(['true', 'false']).default('false').parse(req.query.archived) ===
      'true';
    if (archived) {
      const role = await getWorkspaceRole(req, workspaceId);
      if (role !== 'owner' && role !== 'admin')
        return res.status(403).json({ message: 'Manager access required' });
    }
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('workspace_id', workspaceId);
    query = archived
      ? query.not('archived_at', 'is', null)
      : query.is('archived_at', null);
    const { data, error } = await query.order('created_at', {
      ascending: true,
    });
    if (error) throw error;
    res.json((data as TaskRow[]).map(mapTask));
  } catch (error) {
    fail(res, error);
  }
});

app.post('/api/tasks', requireAuth, async (req, res) => {
  const parsed = taskSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ message: parsed.error.issues[0]?.message ?? 'Invalid task' });

  try {
    const { user, supabase } = getAuth(req);
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId)
      return res
        .status(403)
        .json({ message: 'You are not a member of this workspace' });

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        workspace_id: workspaceId,
        created_by: user.id,
        title: parsed.data.title,
        description: parsed.data.description,
        status: parsed.data.status,
        priority: parsed.data.priority,
        started_at: parsed.data.startedAt ?? null,
        due_date: parsed.data.dueDate ?? null,
        expected_finish_at: parsed.data.expectedFinishAt ?? null,
        comment: parsed.data.comment ?? null,
      })
      .select('*')
      .single();
    if (error) throw error;
    res.status(201).json(mapTask(data as TaskRow));
  } catch (error) {
    fail(res, error);
  }
});

app.put('/api/tasks/:id', requireAuth, async (req, res) => {
  const parsed = updateTaskSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      message: parsed.error.issues[0]?.message ?? 'Invalid task update',
    });

  try {
    const { supabase } = getAuth(req);
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId)
      return res
        .status(403)
        .json({ message: 'You are not a member of this workspace' });

    const { data, error } = await supabase
      .rpc('edit_task', {
        w: workspaceId,
        t: uuid.parse(req.params.id),
        patch: databaseFields(parsed.data),
      })
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ message: 'Task not found' });
    res.json(mapTask(data as TaskRow));
  } catch (error) {
    fail(res, error);
  }
});

app.delete('/api/tasks/:id', requireAuth, async (req, res) => {
  try {
    const { supabase } = getAuth(req);
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId)
      return res
        .status(403)
        .json({ message: 'You are not a member of this workspace' });
    const { error } = await supabase.rpc('archive_task', {
      w: workspaceId,
      t: uuid.parse(req.params.id),
    });
    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    fail(res, error);
  }
});

app.delete('/api/tasks', requireAuth, async (req, res) => {
  try {
    const { supabase } = getAuth(req);
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId)
      return res
        .status(403)
        .json({ message: 'You are not a member of this workspace' });
    const { error } = await supabase.rpc('archive_all_tasks', {
      w: workspaceId,
    });
    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    fail(res, error);
  }
});

app.post('/api/tasks/:id/restore', requireAuth, async (req, res) => {
  try {
    const w = await getWorkspaceId(req);
    if (!w) return res.status(403).json({ message: 'Workspace access denied' });
    const { data, error } = await getAuth(req)
      .supabase.rpc('archive_task', {
        w,
        t: uuid.parse(req.params.id),
        restore: true,
      })
      .single();
    if (error) throw error;
    res.json(mapTask(data as TaskRow));
  } catch (error) {
    fail(res, error);
  }
});

app.post('/api/ai/rewrite-task', requireAuth, async (req, res) => {
  const parsed = rewriteTaskSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ message: 'Task title is required' });
  const { user } = getAuth(req);
  const retryAfterSeconds = getAiRateLimit(user.id);
  if (retryAfterSeconds !== null) {
    res.set('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      message: `AI rewrite limit reached. Try again in ${retryAfterSeconds} seconds.`,
    });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey)
    return res
      .status(503)
      .json({ message: 'AI rewriting is not configured on this server.' });

  try {
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model: process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite',
      contents: parsed.data.title,
      config: {
        systemInstruction:
          'Create a concise, clear, professional Kanban task description from the provided task title. State the intended outcome and general next steps, but do not invent names, deadlines, requirements, technical facts, or details not implied by the title. Return plain text only: no title, labels, bullets, quotation marks, or explanation.',
        temperature: 0.2,
      },
    });
    const suggestedDescription = response.text?.trim() ?? '';
    if (!suggestedDescription)
      return res
        .status(502)
        .json({ message: 'AI did not return a suggestion. Please try again.' });
    res.json({ suggestedDescription });
  } catch (error) {
    console.error('AI task rewrite failed:', error);
    res.status(502).json({
      message: 'Unable to rewrite the task right now. Please try again later.',
    });
  }
});

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    fail(res, error);
  }
);
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () =>
    console.log(`Server is running on port ${PORT}`)
  );
}
