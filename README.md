# Personal Kanban Desk

### A clear, focused workspace for turning daily work into visible progress.

Personal Kanban Desk is a full-stack task management application that helps people organise priorities, workflow stages, and deadlines in one focused workspace. This portfolio project demonstrates my ability to turn a practical product idea into a polished, maintainable web application.

[Live demo](https://kanban-desk-frontend.onrender.com/)

![Personal Kanban Desk screenshot](https://github.com/user-attachments/assets/59049656-088d-41fe-b4f0-c4ed5d0de4c5)

## The problem it solves

When work is spread across notes, messages, and disconnected lists, it becomes difficult to see what matters next. Personal Kanban Desk brings tasks, workflow stages, priorities, and dates into one readable workspace so users can plan, update, and review their work with less friction.

## What users can do

- Create an account, confirm an email address, sign in with email/password or Google, and recover account access.
- Work on a private personal board selected from the signed-in account.
- Organise work across up to seven workflow columns during the current board session.
- Create, edit, move, and archive tasks without leaving the board.
- Track priority, start date, due date, and expected finish date.
- Identify overdue work at a glance.
- Move tasks between workflow stages with drag-and-drop or a movement dropdown.
- Open task details in a focused, scrollable view that keeps long descriptions readable.
- Edit task titles and descriptions with explicit save, cancel, and discard choices.
- Switch between light and dark themes.
- Request an optional AI-generated description suggestion and decide whether to use it.

## Product decisions

- **Clarity over clutter:** the board keeps the most important information visible while details remain available when needed.
- **Flexible workflows:** users can create and rename columns instead of being forced into a fixed process; custom column definitions are currently held in the browser session.
- **Account separation:** authenticated API requests use the user's identity, with workspace access enforced in PostgreSQL.
- **Recoverable removal:** archive actions retain task records; restore is currently available through the backend API.
- **Safe editing:** unsaved changes are protected by clear confirmation flows.
- **Human review for AI:** AI suggestions remain drafts until the user applies and saves them.
- **Practical responsiveness:** the interface is designed to remain usable across different screen sizes.

## Project scope

This project demonstrates the delivery of a complete product slice: a responsive interface, task and workflow management, Supabase authentication, PostgreSQL-backed task persistence, validation, and an optional AI-assisted workflow. It is intentionally focused on a reliable core experience rather than a collection of disconnected features.

## Technical approach

The application uses a React frontend and an Express backend with Supabase Auth and PostgreSQL persistence. The codebase is written in TypeScript and separated into focused components and services so that features can be maintained and extended cleanly.

```text
project/
├── frontend/   React 19, TypeScript, Vite, Tailwind CSS v4
└── backend/    Node.js, Express, TypeScript, Supabase
```

AI requests are handled by the backend, keeping credentials away from the browser. Backend input is validated before persistence, and AI output stays a draft until the user applies and saves it. The API verifies Supabase access tokens and performs database operations under the signed-in identity. Row-level security and checked database functions enforce workspace permissions; task mutations and their activity records commit together. The API client handles failed requests and cancels stale work when accounts change.

## Technology

| Area | Technologies |
| --- | --- |
| Interface | React 19, TypeScript, Vite, Tailwind CSS v4 |
| API | Node.js, Express 5, TypeScript, Zod |
| Accounts and data | Supabase Auth, PostgreSQL, row-level security |
| Invitation email | Nodemailer with SMTP (backend capability) |
| Verification | Vitest, Testing Library, Node test runner, PGlite |
| Optional AI | Google Gemini through the Google Gen AI SDK |

## For technical reviewers

The repository includes separate setup documentation for developers who want to inspect or run the application:

- [`frontend/README.md`](./frontend/README.md) — frontend setup, commands, and environment guidance.
- [`frontend/`](./frontend/) — board interface, task editing, interactions, and themes.
- [`backend/README.md`](./backend/README.md) — database setup, API permissions, integrations, and verification boundaries.
- [`backend/`](./backend/) — authenticated API, database policies/functions, and integration tests.

## Current status

The source includes authenticated personal boards, task archiving, account recovery, and automated tests. The backend also implements team workspaces, role management, email invitations, archive restoration, and activity history. Frontend screens for those team and administrative features are still planned; emailed invitation links require a future acceptance screen.

Custom column definitions reset on refresh; tasks persist independently, so tasks assigned to custom stages can lose their visible column until persistence is implemented. The old SQLite database is not copied into Supabase automatically.

The Render link above points to the existing demo. Deployment of the latest account and database changes has not been verified. The checked-in Render configuration needs additional Supabase and origin settings before it can run this version. Remaining delivery work includes live authentication/email smoke tests, dependency review, persistent columns, and refreshed screenshots. The screenshot above illustrates the board and does not show the new account flows.

## Verification

Frontend tests cover account forms, session transitions, API failures, recovery, and stale responses after account changes. Backend tests cover request validation, invitation mail, workspace permissions, archiving, and activity transactions. Database tests run against an isolated PostgreSQL engine; live Supabase, Google, SMTP, and browser behavior require separate checks. See the component READMEs for commands and limitations.

## Why this matters to clients and teams

This project demonstrates how I approach independent software work:

- Translate a real workflow problem into a focused product experience.
- Build both the user interface and the supporting backend services.
- Make thoughtful decisions around usability, validation, persistence, and security.
- Deliver features with clear boundaries so the application can grow without becoming difficult to maintain.

## About the developer

I’m Jaylord Coronado, a full-stack developer who builds practical web applications with clear user experiences, maintainable architecture, and attention to product details.

[View my GitHub profile](https://github.com/Jlordcoronado)
