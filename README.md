# Kanban Desk

A full-stack Kanban board application built with React, TypeScript, Express, and SQLite. Organize your tasks with drag-and-drop columns, custom modals, and a clean dark/light theme.

## Features

- **Dynamic Columns** — Add, rename, and delete columns (up to 7 max)
- **Drag & Drop + Move Dropdown** — Drag tasks between columns or use the quick "Move to..." dropdown on each card
- **In-Column Task Creation** — Add tasks directly inside any column via a modal
- **Edit Task Modal** — Update title, description, priority, dates, and move tasks between columns
- **Priority Levels** — Tag tasks as Low, Medium, or High
- **Date Tracking** — Set Started, Due Date, and Expected Finish timestamps
- **Dark / Light Theme** — Toggle between themes with a single click
- **Delete All Tasks** — Clear your board with a confirmation modal
- **Input Validation** — Length limits, duplicate checks, and sanitized inputs
- **Custom Modals** — No native browser alerts or prompts; all interactions use custom UI
- **Responsive Design** — Works on desktop and tablet screen sizes
- **AI Task Rewriting API** — Optionally rewrite task text with Gemini before saving it

## Tech Stack

| Layer | Technology |
|:---|:---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| Backend | Node.js, Express, TypeScript, Google Gen AI SDK |
| Database | SQLite (via `sqlite` and `sqlite3`) |
| Validation | Zod |

## Project Structure

```
kanban-board-app/
├── backend/          # Express API server
│   └── src/
│       └── index.ts        # API routes, SQLite setup, and server entry
├── frontend/         # React client
│   └── src/
│       ├── pages/
│       │   └── Home.tsx          # Main Kanban board page
│       ├── component/
│       │   ├── KanbanColumn.tsx      # Column with drag-drop & inline rename
│       │   ├── TaskCard.tsx          # Individual task card
│       │   ├── TaskModal.tsx         # Create & edit task modal
│       │   ├── AddColumnModal.tsx    # Add new column modal
│       │   └── ConfirmDeleteModal.tsx # Delete confirmation modal
│       └── types/
│           └── task.ts           # Task & Column type definitions
└── README.md
```

## Run Locally

### Prerequisites

- Node.js 18+
- npm

### Backend

```bash
cd backend
npm install
npm run dev
```

The API server starts at `http://localhost:5000`.

### Gemini configuration (optional)

To enable task rewriting, create `backend/.env` with your Gemini API key:

```env
GEMINI_API_KEY=your_key_here
# Optional; this is the default model.
GEMINI_MODEL=gemini-3.1-flash-lite
```

Keep `.env` private. The API key is used only by the backend and must never be added to frontend variables, source code, screenshots, or commits.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app opens at `http://localhost:5173`.

## API Endpoints

| Method | Endpoint | Description |
|:---|:---|:---|
| `GET` | `/api/tasks` | Get all tasks |
| `POST` | `/api/tasks` | Create a new task |
| `PUT` | `/api/tasks/:id` | Update a task |
| `DELETE` | `/api/tasks/:id` | Delete a task |
| `DELETE` | `/api/tasks` | Delete all tasks |
| `POST` | `/api/ai/rewrite-task` | Rewrite task text with Gemini without saving it |

### Rewrite a task with Gemini

Send a JSON body containing up to 3,000 characters of task text:

```bash
curl -sS -X POST http://localhost:5000/api/ai/rewrite-task \
  -H 'Content-Type: application/json' \
  -d '{"text":"fix the login screen bug where the submit button overlaps the error message on phones"}'
```

Successful responses contain a reviewed-but-not-persisted result:

```json
{"rewrittenText":"Fix the mobile login screen so the submit button does not overlap the error message."}
```

The endpoint is limited to three requests per IP address per 10-minute window. It returns `400` for invalid input, `429` when the limit is reached, `503` when Gemini is not configured, and `502` if Gemini cannot provide a rewrite.

## Deployment

`render.yaml` defines a Docker-based backend and a static frontend service. In the Render dashboard, set `GEMINI_API_KEY` on the backend service before using the rewrite endpoint. Keep it secret; do not set it on the frontend service.

## Roadmap

- [ ] User authentication (JWT)
- [x] Gemini-powered task rewriting API
- [ ] Client-side review flow for AI rewrites
- [x] Cloud deployment with live demo
- [ ] Drag-and-drop column reordering
- [x] Task card "Move to..." dropdown & 7-column board limit

## Author

**Jaylord Coronado** — [GitHub](https://github.com/Jlordcoronado)
