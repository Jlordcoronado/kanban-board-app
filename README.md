# Personal Kanban Desk

### A clear, focused workspace for turning daily work into visible progress.

Personal Kanban Desk is a full-stack task management application that helps people organise priorities, workflow stages, and deadlines in one focused workspace. This portfolio project demonstrates my ability to turn a practical product idea into a polished, maintainable web application.

![Personal Kanban Desk screenshot](https://github.com/user-attachments/assets/59049656-088d-41fe-b4f0-c4ed5d0de4c5)

## The problem it solves

When work is spread across notes, messages, and disconnected lists, it becomes difficult to see what matters next. Personal Kanban Desk brings tasks, workflow stages, priorities, and dates into one readable workspace so users can plan, update, and review their work with less friction.

## What users can do

- Organise work across workflow columns that match the way they operate.
- Create, edit, move, and delete tasks without leaving the board.
- Track priority, start date, due date, and expected finish date.
- Identify overdue work at a glance.
- Reorder work with drag-and-drop interactions or clear movement controls.
- Open task details in a focused, scrollable view that keeps long descriptions readable.
- Edit task titles and descriptions with explicit save, cancel, and discard choices.
- Switch between light and dark themes.
- Request an optional AI-generated description suggestion and decide whether to use it.

## Product decisions

- **Clarity over clutter:** the board keeps the most important information visible while details remain available when needed.
- **Flexible workflows:** users can create and rename columns instead of being forced into a fixed process.
- **Safe editing:** unsaved changes are protected by clear confirmation flows.
- **Human review for AI:** AI suggestions remain drafts until the user applies and saves them.
- **Practical responsiveness:** the interface is designed to remain usable across different screen sizes.

## Project scope

This project demonstrates the delivery of a complete product slice: a responsive interface, task and workflow management, persistent data, validation, and an optional AI-assisted workflow. It is intentionally focused on a reliable core experience rather than a collection of disconnected features.

## Technical approach

The application uses a React frontend and an Express backend with SQLite persistence. The codebase is written in TypeScript and separated into focused components and services so that features can be maintained and extended cleanly.

```text
project/
├── frontend/   React 19, TypeScript, Vite, Tailwind CSS v4
└── backend/    Node.js, Express, TypeScript, SQLite
```

AI requests are handled by the backend, keeping credentials away from the browser. Backend input is validated before persistence, and the frontend treats AI output as user-reviewed content rather than automatically saved data.

## Technology

| Area | Technologies |
| --- | --- |
| Interface | React 19, TypeScript, Vite, Tailwind CSS v4 |
| API | Node.js, Express 5, TypeScript, Zod |
| Data | SQLite3 |
| Optional AI | Google Gemini through the Google Gen AI SDK |

## For technical reviewers

The repository includes separate setup documentation for developers who want to inspect or run the application:

- [`frontend/README.md`](./frontend/README.md) — frontend setup, commands, and environment guidance.
- [`frontend/`](./frontend/) — board interface, task editing, interactions, and themes.
- [`backend/`](./backend/) — API, validation, persistence, and optional Gemini integration.

## Current status

The core Kanban experience is implemented. Planned product work includes authentication, multi-user data isolation, deployment, and further portfolio polish.

## Why this matters to clients and teams

This project demonstrates how I approach independent software work:

- Translate a real workflow problem into a focused product experience.
- Build both the user interface and the supporting backend services.
- Make thoughtful decisions around usability, validation, persistence, and security.
- Deliver features with clear boundaries so the application can grow without becoming difficult to maintain.

## About the developer

I’m Jaylord Coronado, a full-stack developer who builds practical web applications with clear user experiences, maintainable architecture, and attention to product details.

[View my GitHub profile](https://github.com/Jlordcoronado)
