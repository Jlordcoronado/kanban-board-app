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

## Commands

```bash
npm run dev      # Start the Vite development server
npm run build    # Type-check and create a production build
npm run lint     # Run ESLint
npm run preview  # Preview the production build locally
```

For the complete product overview and backend API reference, see the [project README](../README.md).
