# Kanban Desk backend

Express verifies Supabase access tokens and sends database queries using the user's identity. PostgreSQL policies and checked database functions enforce workspace permissions, including direct calls to Supabase. Task changes and their activity records commit together.

## Database setup

For a new Supabase project, run `supabase/schema.sql`, then `supabase/migrations/003_backend_readiness.sql` in the SQL editor. The base schema already includes invitation tables; migration 002 is unnecessary for a fresh installation.

For an existing installation with the invitation table, run only migration 003 once. If the original installation predates invitations, first run migration 002. Preserve a database backup before applying migrations. Migration 003 retains existing tasks and stops without changing data if an existing workspace already has other members; those workspaces require explicit classification first. Do not rerun the base schema on an existing database.

The migration does not copy or delete the old SQLite database. Existing PostgreSQL tasks remain active. Activity history begins with changes made after migration; historical events are not fabricated.

## Local configuration

Use Node.js 22.x. Install dependencies with `npm install` from this directory.

Copy `.env.example` to `.env` and fill in the Supabase project URL and publishable key. Keep the secret key and SMTP credentials on the backend. Existing legacy `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` variable names remain supported as fallbacks. Never commit `.env`.

Set `FRONTEND_URL` to the local frontend origin during development and the HTTPS frontend origin in production. Configure the corresponding redirect URLs in Supabase Auth. Google login also requires enabling the Google provider in Supabase and configuring Google OAuth credentials; that browser flow is part of the frontend integration.

Invitations require `SUPABASE_SECRET_KEY` and all SMTP variables. Use an email provider's SMTP host, port, username, password, and verified sender address. SMTP on port 465 uses TLS immediately; other ports require STARTTLS. Without email configuration the invitation endpoint returns 503 before creating an invitation. The rest of the application still works.

The application sends its own team email to both existing and new users. It creates no Auth account on their behalf. Recipients sign up or sign in with the invited email and then accept the invitation. Acceptance checks the verified email in Supabase Auth. Delivery success means the mail server accepted the recipient, not a guarantee of inbox delivery. Failed delivery revokes the invitation; cleanup failures are reported explicitly.

```bash
npm run dev    # Development server (default port 5000)
npm run build  # Compile TypeScript
npm start      # Run the compiled server
npm test       # API, mail, and isolated PostgreSQL authorization tests
```

Optional AI rewriting uses `GEMINI_API_KEY` and `GEMINI_MODEL` (default `gemini-3.1-flash-lite`). Secrets stay on the server. The active entry point does not use the legacy SQLite database or custom JWT secret.

## API and permissions

All routes require `Authorization: Bearer <access_token>`. Task routes accept `x-workspace-id`; without it, the personal workspace is selected. `GET /api/me` returns memberships including workspace `kind` (`personal` or `team`). Personal workspaces cannot accept invitations.

| Route                                                  | Behavior                                                                                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `GET /api/me` | Signed-in user and workspace memberships, including kind and role. |
| `POST /api/ai/rewrite-task` | Suggest a description from `{ "title": "Task title" }`; returns `suggestedDescription` without saving. |
| `POST /api/workspaces`                                 | Create a team with `{ "name": "Team name" }` and owner membership atomically.                                          |
| `GET /api/workspaces/:workspaceId/members`             | Members can see teammate display names and roles.                                                                      |
| `PATCH /api/workspaces/:workspaceId/members/:userId`   | Owner sets `{ "role": "admin" }` or `member`.                                                                          |
| `DELETE /api/workspaces/:workspaceId/members/:userId`  | Owner removes non-owners; admins remove regular members only.                                                          |
| `POST /api/workspaces/:workspaceId/invitations`        | Owner invites admins/members; admin invites members only. Body: `{ "email": "person@example.com", "role": "member" }`. |
| `POST /api/workspaces/:workspaceId/invitations/accept` | Verified recipient accepts a seven-day invitation; existing roles are preserved.                                       |
| `GET /api/tasks`                                       | Active tasks in the selected workspace.                                                                                |
| `GET /api/tasks?archived=true`                         | Owner/admin archive view.                                                                                              |
| `POST /api/tasks` / `PUT /api/tasks/:id`               | Members create/edit active tasks. Omitted update fields remain unchanged.                                              |
| `DELETE /api/tasks/:id`                                | Any member archives an active task. No permanent deletion.                                                             |
| `DELETE /api/tasks`                                    | Owner/admin archives all active tasks in the selected workspace.                                                       |
| `POST /api/tasks/:id/restore`                          | Owner/admin restores an archived task.                                                                                 |
| `GET /api/workspaces/:workspaceId/activity`            | Owner/admin reads activity, newest first; up to 100 events. Pass returned `nextBefore` as `before` for the next page.  |

Gemini rewriting is authenticated and limited to three requests per user per ten minutes in each API process. Excess requests return 429 with `Retry-After`; missing configuration returns 503 and upstream failures return 502. The limiter is in memory and is not shared across service instances.

Activity includes actor UUID, display name at the time of the action, timestamp, task, action, and changed fields with before/after values. The name snapshot keeps events understandable after a teammate leaves. Actor UUIDs correspond to the member-list `user_id` values. Members cannot inspect archived tasks or activity. Removed members lose workspace access. Activity and archives have no expiration or client deletion API. Ownership transfer and workspace deletion are not exposed in this version.

Validation failures return 400, missing/invalid sessions 401, denied permissions 403, missing tasks/invitations 404, duplicate invitations 409, and email configuration/delivery failures 503. Unexpected errors return a generic 500.

## Verification boundaries

Review current dependency advisories before deployment with `npm audit --omit=dev`. Audit counts change with registry data; no fresh audit result is asserted here. Dependency upgrades require a separate code change.

Database tests apply the base schema and migration to PGlite, an isolated PostgreSQL engine, with Supabase Auth tables/identity helpers represented by test fixtures. They exercise actual grants, RLS, functions, and transactional triggers. API tests use a fake Supabase transport. Neither sends real email or changes a hosted project.

Before production use, apply the migration to a staging Supabase project and verify email/password login, Google login, SMTP delivery, API responses, and simultaneous invitation acceptance from separate database sessions. SMTP email links require the upcoming frontend `/accept-invite` screen. React account access and personal boards are implemented in the frontend. Team management, invitation acceptance, archive browsing/restoration, and activity screens remain planned. See the [frontend README](../frontend/README.md) for the implemented account flows.

## Deployment configuration

The existing Render blueprint supplies the API URL to the frontend and enables SPA fallback routing. It does not configure this version's Supabase variables or backend `FRONTEND_URL`; set those before deploying. Frontend Supabase values must be present at build time. Configure SMTP/secret-key settings for invitations and Gemini settings if those integrations are enabled. The generated `JWT_SECRET` in the blueprint is not used by the current Supabase authentication middleware.

Source and isolated tests do not confirm that migrations or the latest application version are deployed. For the application overview, see the [project README](../README.md).
