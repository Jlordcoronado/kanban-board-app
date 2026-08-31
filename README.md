# Personal Kanban Desk

A polished, full-stack Kanban board for organising work, deadlines, and priorities. It is designed as a portfolio project with a clear, business-friendly experience for individual professionals and small teams.

## What it does

- Create, edit, move, and delete tasks across custom board columns.
- Set priority, started date, due date, and expected finish date.
- Highlight overdue work and switch between light and dark themes.
- Open a task to read its full description safely; long text wraps and scrolls inside the modal.
- Click a task title or description to edit it, with clear save and discard confirmations.
- Generate an optional description suggestion from a task title with Google Gemini, then choose whether to apply it.

## Built with

React, TypeScript, Tailwind CSS, Node.js, Express, SQLite, and Google Gemini.

## Project structure

- `frontend/` — React user interface.
- `backend/` — Express API and SQLite data storage.

## Run locally

Start the backend in one terminal:

```bash
cd backend
npm install
npm run dev
```

Then start the frontend in another:

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173` and the backend at `http://localhost:5000`.

## Optional Gemini suggestions

Add `GEMINI_API_KEY` to `backend/.env` to enable AI-generated description suggestions. Keep this key on the backend only—never put it in the frontend or commit it to Git.
Screenshot sample
<img width="1425" height="883" alt="image" src="https://github.com/user-attachments/assets/59049656-088d-41fe-b4f0-c4ed5d0de4c5" />


## Author

Jaylord Coronado — Full-Stack Developer

[GitHub](https://github.com/Jlordcoronado)
