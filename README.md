# 📋 Personal Kanban Desk

> A modern, full-stack workflow management web application built with **React 19**, **TypeScript**, **Tailwind CSS v4**, **Node.js/Express**, and **SQLite**. 

---

## 🎯 Executive Summary & Purpose

**Personal Kanban Desk** is an intuitive visual task management platform designed to help professionals, teams, and freelancers organize work, track deadlines, and maintain focus.

Built from the ground up to showcase **production-grade engineering practices**, this application combines a sleek, responsive user interface with reliable backend data persistence and enterprise-level AI capabilities.

### 🌟 Why This Project Stands Out

- 👔 **Business Value First**: Clear, intuitive UI designed for non-technical users to manage complex workflows effortlessly.
- ⚡ **Modern Full-Stack Architecture**: Strictly typed TypeScript frontend and backend for high code reliability and zero runtime type errors.
- 🤖 **Integrated AI Assistance**: Built-in Google Gemini AI can generate a suggested task description from a task title, while the user remains in control of whether to apply it.
- 🛡️ **Production-Ready Security**: Backend API key isolation, client-side input sanitization, rate-limiting, and CORS control.

---

## ✨ Key Features & User Capabilities

### 📌 Core Task & Board Management
- **Dynamic Columns (Max 7)**: Add, rename, or remove custom status columns (e.g. *Backlog*, *In Progress*, *Testing*, *Production*) to fit any project workflow.
- **Dual Column Move Options**: Move tasks across columns using **intuitive Drag & Drop** or a quick **"Move to..." dropdown selector** on each card.
- **Simplified Date Tracking**: Set clean **Started**, **Due Date**, and **Expected Finish** dates (`YYYY-MM-DD`) without dealing with tedious time pickers.
- **Priority Categorization**: Color-coded badges for **Low**, **Medium**, and **High** priority items.
- **Overdue Badges**: Visual warnings automatically highlight tasks that pass their due date.

### 🎨 User Experience & Design
- **Dark & Light Themes**: Instant 1-click theme switching using custom CSS tokens tailored for low eye strain.
- **Zero Browser Alert Artifacts**: 100% custom modal dialogs for task creation, column editing, and destructive actions.
- **Responsive Layout**: Designed for seamless use across desktop monitors, laptops, and tablet devices.

### 🤖 Smart AI Enhancement
- **Title-Based Description Suggestion**: Gemini generates a concise, professional description from the current task title.
- **User-Controlled Apply Step**: A suggestion appears in the description placeholder and is copied into the field only when the user selects **Apply**. It never saves or overwrites a task automatically.
- **Graceful Fallback**: A basic local suggestion remains available when Gemini is not configured, rate-limited, or temporarily unavailable.

---

## 🛠️ Technology Stack & System Architecture

```
kanban-board-app/
├── backend/                  # Express REST API Server
│   └── src/
│       ├── index.ts          # API routes, SQLite migrations & GenAI SDK
├── frontend/                 # React 19 Client SPA
│   └── src/
│       ├── pages/Home.tsx    # Main Kanban board interactive canvas
│       ├── component/        # Modular UI components (TaskCard, TaskModal, etc.)
│       └── types/task.ts     # Shared TypeScript interfaces
└── README.md
```

| Layer | Technology | Engineering Highlights |
|:---|:---|:---|
| **Frontend** | React 19, TypeScript, Vite | CSS-first Tailwind CSS v4, custom state hooks, accessible modal dialogs |
| **Backend API** | Node.js, Express, TypeScript | RESTful route architecture, centralized error handling |
| **Database** | SQLite3, `sqlite` | Persistent local file storage, automated table migrations |
| **Validation & AI** | Zod, `@google/genai` | Strict payload schema validation, rate-limited AI endpoints |

---

## 🔒 Security & Best Practices

1. **API Key Security**: The Google Gemini API key remains strictly on the Node.js backend. It is never exposed to client browsers or source code repositories.
2. **Rate Limiting**: AI rewrite endpoints enforce IP-based rate limiting (max 3 requests per 10 minutes) to prevent service misuse and API quota exhaustion.
3. **Database Integrity**: Automated SQLite migrations safely handle schema updates (such as column additions) without data loss or downtime.

---

## 🔌 API Reference Summary

| Method | Endpoint | Description | Status Code |
|:---|:---|:---|:---|
| `GET` | `/api/tasks` | Retrieve all board tasks | `200 OK` |
| `POST` | `/api/tasks` | Create a new task | `201 Created` |
| `PUT` | `/api/tasks/:id` | Update task details or move status | `200 OK` |
| `DELETE` | `/api/tasks/:id` | Remove a single task | `204 No Content` |
| `DELETE` | `/api/tasks` | Clear all tasks from the board | `204 No Content` |
| `POST` | `/api/ai/rewrite-task` | Generate a description suggestion from `{ "title": "..." }` | `200 OK` / `429 Too Many Requests` / `503 Service Unavailable` |

---

## 🚀 Quick Start (Running Locally)

### 1. Prerequisites
- Node.js 18+ installed

### 2. Backend Setup
```bash
cd backend
npm install
npm run dev
```
*The API server will launch at `http://localhost:5000`.*

#### *(Optional)* Enable Gemini Suggestions
Create a `.env` file in the `backend/` directory:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

For Render or another host, add `GEMINI_API_KEY` to the backend service's environment variables instead of uploading or committing the `.env` file. The feature will show an unavailable message if the key is missing, the service is rate-limited, or Gemini cannot respond.

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*The web client will launch at `http://localhost:5173`.*

For a deployed frontend, configure `VITE_API_URL` with the public backend URL and rebuild the frontend:
```env
VITE_API_URL=https://your-backend-service.onrender.com
```

---

## 👨‍💻 Developer & Author

**Jaylord Coronado**  
*Full-Stack Developer specializing in React, TypeScript, Node.js, and Modern Web Architecture.*

- **GitHub**: [github.com/Jlordcoronado](https://github.com/Jlordcoronado)
- **Portfolio / Live Demo**: Available upon request / Render Cloud Deployment
