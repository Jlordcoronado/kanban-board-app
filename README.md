# Kanban Desk

A full-stack Kanban board application built with React, TypeScript, Express, and SQLite. Organize your tasks with drag-and-drop columns, custom modals, and a clean dark/light theme.

## Features

- **Dynamic Columns** — Add, rename, and delete columns (not limited to To Do / In Progress / Done)
- **Drag & Drop** — Move tasks between columns by dragging
- **In-Column Task Creation** — Add tasks directly inside any column via a modal
- **Edit Task Modal** — Update title, description, priority, dates, and move tasks between columns
- **Priority Levels** — Tag tasks as Low, Medium, or High
- **Date Tracking** — Set Started, Due Date, and Expected Finish timestamps
- **Dark / Light Theme** — Toggle between themes with a single click
- **Delete All Tasks** — Clear your board with a confirmation modal
- **Input Validation** — Length limits, duplicate checks, and sanitized inputs
- **Custom Modals** — No native browser alerts or prompts; all interactions use custom UI
- **Responsive Design** — Works on desktop and tablet screen sizes

## Tech Stack

| Layer | Technology |
|:---|:---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| Backend | Node.js, Express, TypeScript |
| Database | SQLite (via better-sqlite3) |
| Validation | Zod |

## Project Structure

```
kanban-board-app/
├── backend/          # Express API server
│   └── src/
│       ├── index.ts        # Routes & server entry
│       ├── db.ts           # SQLite setup & queries
│       ├── schemas.ts      # Zod validation schemas
│       ├── mapTask.ts      # Row-to-Task mapper
│       └── middleware.ts   # CORS & security middleware
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

## Roadmap

- [ ] User authentication (JWT)
- [ ] AI-powered task suggestions
- [ ] Cloud deployment with live demo
- [ ] Drag-and-drop column reordering

## Author

**Jaylord Coronado** — [GitHub](https://github.com/Jlordcoronado)
