# Kanban Desk

A full-stack Kanban board built with React, TypeScript, Express, and SQLite.

## What It Does

- Create tasks
- Move tasks between `To Do`, `In Progress`, and `Done`
- Delete individual tasks
- Clear all tasks
- Save tasks in SQLite
- Toggle light and dark mode

## Tech Stack

- Frontend: React, TypeScript, Vite
- Backend: Node.js, Express, TypeScript
- Database: SQLite

## Project Structure

- `frontend/` - React client
- `backend/` - Express API server

## Run Locally

Start the backend:

```bash
cd backend
npm install
npm run dev
```

Start the frontend:

```bash
cd frontend
npm install
npm run dev
```

## Notes

- The frontend currently connects to the backend at `http://localhost:5000`.
- The database is stored locally in `kanban.db`.

## Next Goals

- Add user authentication
- Add AI-powered features
- Prepare the app for deployment
