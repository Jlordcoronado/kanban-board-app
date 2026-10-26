# Kanban Desk Frontend

The React 19 and TypeScript frontend for Jaylord Coronado's personal website and Kanban Desk. The public homepage opens at `/`; **Explore Kanban Desk** opens the guest board at `/try`, or continues to `/dashboard` for signed-in visitors. The application provides account access, a signed-in task dashboard, private personal and existing team boards, task and column modals, drag-and-drop interactions, and light/dark themes. The homepage and guest board work without cloud configuration. Guest tasks, columns, and archives use versioned browser storage; signed-in boards load and save through the backend.

The frontend is a public client application. Keep backend secrets and private configuration outside this directory.

## Personal website

`src/pages/PersonalWebsite.tsx` renders the hero and real dashboard preview, followed by Services and About. Four stacked services link to supporting work. About contains the professional introduction, an independent-project paragraph, six shared skill groups, and an anonymous reconciliation example. The main action remains **Contact me**, which opens an email draft. Profile links and app-entry destinations remain available alongside it.

Public copy lives in the `services`, `introduction`, and `skillGroups` constants in that component. Scoped layout and typography live in `src/css/personal-website.css`. Archivo 600 headings and IBM Plex Sans 400/500 body text are served from `public/fonts/`, with OFL licenses. Application screens retain Inter and the existing theme tokens.

The inspected light/dark dashboard captures are in `public/images/`, with paths, dimensions, and alternative text in `src/lib/projectPreview.ts`. They contain example tasks. **View full size** opens the native preview dialog; Escape closes it and restores focus. Services and About links move focus to their headings. The homepage does not initiate workspace or board reads.

Projects, a full contact/footer section, and the separate `/kanban` product introduction remain planned.

## Run locally

From this directory, install dependencies and start the Vite development server:

```bash
npm install
npm run dev
```

Vite serves the application at `http://localhost:5173` by default. Start the backend separately from `../backend`; the frontend uses `http://localhost:5000` for the API when `VITE_API_URL` is not set.

## Environment variables

Guest mode works without environment configuration. To enable cloud accounts, copy `.env.example` to `.env.local` and replace the placeholder URL and publishable key with your Supabase project's values. These frontend settings are separate from the backend `.env` file:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_API_URL=http://localhost:5000
```

Never put `GEMINI_API_KEY` or another secret in this frontend directory or in any `VITE_*` variable. Values exposed through `VITE_*` are bundled into browser code. The backend owns all Gemini requests.

Restart Vite after changing these values. In production, use the HTTPS backend URL for `VITE_API_URL` and configure the frontend environment before building. Supabase's publishable key is intended for browser use; its secret/service-role key must remain on the backend.

## Authentication setup and behavior

The sign-in and signup pages display a Kanban symbol above `jlord.dev`. Email signup collects a display name, email, and password. The name is saved as `full_name` metadata for the existing backend profile trigger. Google login uses the Google profile name. The forms include visible labels, password visibility controls, keyboard focus styles, and the existing theme preference.

Before live testing, follow the [backend database setup](../backend/README.md#database-setup) for a fresh or existing Supabase project, including migrations `003_backend_readiness.sql` and `20261021152755_guest_cloud_board.sql`, and configure the backend's environment variables. Enable email/password authentication with email confirmation. Supabase Auth handles confirmation and password-reset email delivery; this is separate from the backend SMTP settings for team invitations.

In Supabase **Authentication → URL Configuration**, set the local Site URL to `http://localhost:5173` and allow `http://localhost:5173/**` during development. For production, set the deployed Site URL and explicitly allow the frontend's `/auth/callback` and `/reset-password` URLs. See Supabase's [redirect URL guidance](https://supabase.com/docs/guides/auth/redirect-urls).

For Google login, enable Google's provider in Supabase. Create Google OAuth web credentials using the callback URL shown in that provider's settings as the Google authorized redirect URI. Add the frontend origin as the authorized JavaScript origin. Put the Google client ID and secret in Supabase's provider configuration. The Google secret does not belong in frontend variables. See the official [Google setup guide](https://supabase.com/docs/guides/auth/social-login/auth-google).

Routes:

- `/signin` and `/signup`: email/password and Google account access.
- `/check-email`: confirmation or recovery instructions, email change, and resend with a cooldown.
- `/forgot-password` and `/reset-password`: request a reset email and save a password from a recovery session.
- `/auth/callback`: process the Supabase browser callback and explain failed/canceled links.
- `/`: public personal website, including for signed-in visitors.
- `/try`: guest board for signed-out visitors; signed-in visitors continue to `/dashboard`. **Log in** opens account forms in a native modal over the guest board. The dialog contains keyboard focus, supports Escape/Close, restores focus, and scrolls on mobile.

The Supabase browser SDK manages persistence, refresh, and callback processing. Its default browser flow is explicitly configured; no custom password storage or token storage is added. Authentication callback parameters are cleared after processing. Expired recovery links offer a new reset request. A successful reset opens the authenticated dashboard.

All task and Gemini requests use one API client, which attaches the current access token and the relevant workspace ID. It checks errors before updating UI state. Sign-out and account changes cancel pending requests and discard stale responses. The board is keyed by user identity, so modals, tasks, and column state reset between accounts. Cloud request failures retain a pending proposal and never save account work into guest storage. Signing out returns to the public homepage; opening `/try` restores the separate guest board.

The frontend supports personal boards and boards for teams the account already belongs to. Personal tasks remain private; the dashboard shows a combined view without moving or sharing them. Team creation, invitations, role management, archive browsing, and activity-history screens remain later work. Task actions say **Archive**; **Archive all** is shown to owners/admins. Backend permissions remain authoritative.

## Signed-in dashboard

- `/dashboard`: combined task overview, with **All work**, **Personal**, and individual team filters. Source labels distinguish private tasks from each team's tasks.
- `/boards/:workspaceId`: the selected personal or team Kanban board. Only memberships returned by `/api/me` are available in navigation.
- `/account`: signed-in email, light/dark appearance, and a link to the existing password-reset flow.

The collapsible sidebar opens these pages; mobile uses a keyboard-contained navigation drawer. Guests keep the local board and need to register or sign in for cloud saving and the dashboard.

The four counts are clickable filters. **Open** excludes tasks whose status ID is `done`; **Done** counts tasks with that ID, even if the column is renamed. **Overdue** means an open task due before the current local calendar day, and **Due today** means an open task due today. Archived tasks are excluded. The default lists show overdue work and deadlines from today through the following six calendar days, sorted by due date, priority, and title. Tasks without dates remain available in the Open filter. Click a task to view details or edit it; create tasks inside boards.

Cloud boards share session-scoped state between the dashboard and board pages. Loading is limited to three concurrent board reads. Unavailable workspaces are omitted from totals and lists with an explicit incomplete-totals notice and a retry. **Refresh** only reads clean boards; it never submits or replaces pending edits. Saving and explicit conflict resolution update the overview. Failed proposals survive page navigation within the app, but are cleared on sign-out/account changes; they are never written into guest storage. Another device's changes require Refresh; realtime updates and offline sync are outside this phase.

## Board persistence and limits

The board supports up to seven columns. Guest changes save to versioned local storage; clearing browser data removes them. Storage failure retains the current board in memory, shows **Not saved—retry**, and provides Retry. Guest editor drafts use browser storage so authentication redirects and email callbacks can return to them; opening or dismissing authentication does not submit tasks or request Gemini output. Cloud drafts stay in memory and are cleared on sign-out/account changes.

Cloud saves persist tasks and columns together, including column removal and its task moves. **Saving…**, **Saved to cloud**, and **Not saved—retry** report request state. An outdated revision opens a comparison of the latest cloud values and the proposed change. Choose **Keep cloud value** or explicitly apply the draft against the latest revision; unrelated newer cloud work is retained. Explicitly reapplying edits to a task archived elsewhere creates a new active task and preserves the archived record. Connection failures preserve the proposal and require an explicit retry. The browser warns before unloading unsaved changes; drafts are not an offline queue. Other-device changes load when opening or refreshing, without live subscriptions or automatic reconnect sync.

After sign-in, a changed guest board prompts for **Copy to cloud** or **Keep on this device**. The preview matches column names without regard to case and allows mapping unmatched stages to existing columns or creating stages within the seven-column limit. Only active tasks copy. Import tracking prevents duplicate task copies per workspace, device, and guest task identity; subsequent guest edits do not overwrite imported tasks. The original guest board and its archives remain local. An unchanged dismissed board does not prompt again, and **Copy device work to cloud** remains available. **Resume device task draft** opens preserved guest editor contents for explicit review and saving on the cloud board.

The additive migration restores visible columns for existing custom-stage tasks, including legacy boards with more than seven stages. Such boards can retain or reduce their stages, and can add new ones after dropping below seven.

Task drag-and-drop and the movement dropdown change workflow stages; there is no saved manual ordering within a column. Archiving retains the backend record and activity history. The UI currently has no archive browser or restore control.

## Task editing

Existing tasks open in read-only **Task details**. **Edit task** opens labelled title, description, status, priority, and date fields. **Save changes** validates and saves immediately, then returns to the latest details. Failures retain edits for retry. Cancel returns to details; closing or cancelling a changed draft asks whether to keep editing or discard changes. New tasks open directly in the form and close after successful creation.

## Gemini suggestions

Expand **Help write description** below Description in create/edit mode. Expansion sends no request. Guests must sign in, and signed-in users must explicitly choose **Generate with Gemini**. The editor displays a preview; **Apply suggestion** replaces only the draft description. Saving the task remains explicit. Failed generation preserves the draft, and responses from a closed editor are ignored.

For deployed environments, set `VITE_API_URL` to the public backend URL and rebuild the frontend. Configure `GEMINI_API_KEY` only on the backend service; the current Render service configuration does not enable Gemini automatically. Failed AI requests show an error without changing task text.

## Commands

```bash
npm run dev      # Start the Vite development server
npm run build    # Type-check and create a production build
npm run lint     # Run ESLint
npm test         # Run website, dashboard, board, authentication, session, and API tests
npm run preview  # Preview the production build locally
```

Tests mock Supabase and HTTP transport; they do not create live accounts or send real email. Verify the configured project with two accounts: signup → confirmation → personal board, Google login, refresh, password reset, sign-out, then sign in to the second account and confirm the first account's tasks are absent. Check keyboard navigation, mobile widths, both themes, callback failures, and offline API errors in real browsers.

The website changes passed all 146 frontend tests, lint, and the production build. Sixteen isolated Chromium scenarios covered both themes at desktop, tablet, mobile, and landscape sizes, plus 200% text at an 800px viewport. Checks included horizontal overflow, actual font loading, text contrast, section/evidence links, direct section URLs, native preview controls, contact href, theme persistence, and guest entry without application-data requests. The isolated browser run used blank cloud configuration; it does not verify signed-in or hosted behavior. The existing production bundle-size advisory remains.

This source includes authentication integration; it does not establish that the public demo has been deployed with it. For the portfolio overview, see the [project README](../README.md).
