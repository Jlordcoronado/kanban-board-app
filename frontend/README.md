# Kanban Desk Frontend

The React 19 and TypeScript client for Kanban Desk. It provides account access, a private personal board, task and column modals, drag-and-drop interactions, and light/dark themes. The app opens on a guest board without requiring authentication configuration or backend requests. Guest tasks, columns, and archives use versioned browser storage; signed-in boards load and save through the backend.

The frontend is a public client application. Keep backend secrets and private configuration outside this directory.

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
- `/`: guest board, or the signed-in personal cloud board selected through `/api/me`. **Save to cloud** opens account forms in a native modal over the board. The dialog contains keyboard focus, supports Escape/Close, restores focus, and scrolls on mobile.

The Supabase browser SDK manages persistence, refresh, and callback processing. Its default browser flow is explicitly configured; no custom password storage or token storage is added. Authentication callback parameters are cleared after processing. Expired recovery links offer a new reset request. A successful reset opens the authenticated board.

All task and Gemini requests use one API client, which attaches the current access token and personal workspace ID. It checks errors before updating UI state. Sign-out and account changes cancel pending requests and discard stale responses. The board is keyed by user identity, so modals, tasks, and column state reset between accounts. Cloud request failures retain a pending proposal and never save account work into guest storage. Signing out restores the separate guest board.

The current frontend supports account access and personal boards. Team invitations, team management, archive browsing, and activity-history screens are later work. Task actions now say **Archive**, and **Archive all** moves active tasks into the backend archive. Owners/admins will restore them through the future archive UI.

## Board persistence and limits

The board supports up to seven columns. Guest changes save to versioned local storage; clearing browser data removes them. Storage failure retains the current board in memory, shows **Not saved—retry**, and provides Retry. Guest editor drafts use browser storage so authentication redirects and email callbacks can return to them; opening or dismissing authentication does not submit tasks or request Gemini output. Cloud drafts stay in memory and are cleared on sign-out/account changes.

Cloud saves persist tasks and columns together, including column removal and its task moves. **Saving…**, **Saved to cloud**, and **Not saved—retry** report request state. An outdated revision opens a comparison of the latest cloud values and the proposed change. Choose **Keep cloud value** or explicitly apply the draft against the latest revision; unrelated newer cloud work is retained. Explicitly reapplying edits to a task archived elsewhere creates a new active task and preserves the archived record. Connection failures preserve the proposal and require an explicit retry. The browser warns before unloading unsaved changes; drafts are not an offline queue. Other-device changes load when opening or refreshing, without live subscriptions or automatic reconnect sync.

After sign-in, a changed guest board prompts for **Copy to cloud** or **Keep on this device**. The preview matches column names without regard to case and allows mapping unmatched stages to existing columns or creating stages within the seven-column limit. Only active tasks copy. Import tracking prevents duplicate task copies per workspace, device, and guest task identity; subsequent guest edits do not overwrite imported tasks. The original guest board and its archives remain local. An unchanged dismissed board does not prompt again, and **Copy device work to cloud** remains available. **Resume device task draft** opens preserved guest editor contents for explicit review and saving on the cloud board.

The additive migration restores visible columns for existing custom-stage tasks, including legacy boards with more than seven stages. Such boards can retain or reduce their stages, and can add new ones after dropping below seven.

Task drag-and-drop and the movement dropdown change workflow stages; there is no saved manual ordering within a column. Archiving retains the backend record and activity history. The UI currently has no archive browser or restore control.

## Task editing

Existing tasks open in a readable task-details view. Click the Title or Description area to edit that value; long descriptions wrap normally and the modal scrolls on smaller screens. Status, priority, started date, due date, and expected finish remain visible form controls.

Selecting **Save changes** opens a confirmation before the frontend sends an update. **Cancel** returns to the unsaved edits, while **Disregard changes** closes without saving. Cancel, Close, Escape, and backdrop actions also protect unsaved changes.

## Gemini suggestions

The task editor always shows a basic title-based description placeholder. Guests see **Sign in to use Gemini**. Completing authentication does not request a rewrite. Signed-in users selecting **Rewrite with Gemini** send the current title to the backend, which can replace that placeholder with an AI-generated suggestion. **Apply** copies the current suggestion into the Description field; it does not save the task.

For deployed environments, set `VITE_API_URL` to the public backend URL and rebuild the frontend. Configure `GEMINI_API_KEY` only on the backend service; the current Render service configuration does not enable Gemini automatically. If the backend is unavailable, rate-limited, or missing its Gemini configuration, the editor shows a retry-later message and keeps the local placeholder. The AI suggestion remains a user-reviewed draft until it is applied and saved.

## Commands

```bash
npm run dev      # Start the Vite development server
npm run build    # Type-check and create a production build
npm run lint     # Run ESLint
npm test         # Run board persistence, conflict, authentication, session, and API tests
npm run preview  # Preview the production build locally
```

Tests mock Supabase and HTTP transport; they do not create live accounts or send real email. Verify the configured project with two accounts: signup → confirmation → personal board, Google login, refresh, password reset, sign-out, then sign in to the second account and confirm the first account's tasks are absent. Check keyboard navigation, mobile widths, both themes, callback failures, and offline API errors in real browsers.

This source includes authentication integration; it does not establish that the public demo has been deployed with it. For the portfolio overview, see the [project README](../README.md).
