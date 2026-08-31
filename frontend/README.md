# Kanban Desk Frontend

The React 19 and TypeScript client for Kanban Desk. It provides the board interface, task and column modals, drag-and-drop interactions, and light/dark theme.

## Run locally

```bash
npm install
npm run dev
```

Vite serves the application at `http://localhost:5173` by default. The frontend uses `http://localhost:5000` for the API when `VITE_API_URL` is not set.

## Environment variables

Use `VITE_API_URL` only for the public backend base URL, for example:

```env
VITE_API_URL=https://your-api.example.com
```

Never put `GEMINI_API_KEY` or another secret in this frontend directory or in a `VITE_*` variable. The backend owns all Gemini requests.

## Task editing

Existing tasks open in a readable task-details view. Click the Title or Description area to edit that value; long descriptions wrap normally and the modal scrolls on smaller screens. Status, priority, started date, due date, and expected finish remain visible form controls.

Selecting **Save changes** opens a confirmation before the frontend sends an update. **Cancel** returns to the unsaved edits, while **Disregard changes** closes without saving. Cancel, Close, Escape, and backdrop actions also protect unsaved changes.

## Gemini suggestions

The task editor always shows a basic title-based description placeholder. Selecting **Rewrite with Gemini** sends the current title to the backend, which can replace that placeholder with an AI-generated suggestion. **Apply** copies the current suggestion into the Description field; it does not save the task.

For deployed environments, set `VITE_API_URL` to the public backend URL and rebuild the frontend. Configure `GEMINI_API_KEY` only on the backend service. If the backend is unavailable, rate-limited, or missing its Gemini configuration, the editor shows a retry-later message and keeps the local placeholder.

## Commands

```bash
npm run dev      # Start the Vite development server
npm run build    # Type-check and create a production build
npm run lint     # Run ESLint
npm run preview  # Preview the production build locally
```

For the complete product overview and backend API reference, see the [project README](../README.md).
