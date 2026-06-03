# Career Networking Assistant

A full-stack AI-powered web app to manage your job search networking — track conversations, get coached on what to say next, and generate personalised LinkedIn connection notes.

Built with **React + Node.js/Express + Google Gemini AI**.

---

## What it does

### 1. Individual Contact Chats
Each person you are networking with gets their own conversation thread. You can:
- Add a contact with their name, job title, company, and relationship type (recruiter, engineer, hiring manager)
- Paste existing conversation history from LinkedIn, email, or Slack
- Get a first message written for you when starting fresh — just describe why you want to reach out
- Log messages you sent and paste replies you received
- Mark "no reply" when someone goes silent
- Track status automatically: New → Message Sent → Awaiting Reply → Reply Received → Follow Up Due → Closed
- Contacts are auto-flagged as **Follow Up Due** after 7 days with no reply

### 2. AI Coach (per contact)
Every contact has a dedicated AI coach chat panel visible alongside the conversation thread. The coach has full context — the contact's profile, your entire conversation history, and relationship type. Ask anything:
- *"Is this conversation going well?"* → honest read of the actual messages
- *"Write a follow-up message for me"* → exact text, no placeholders
- *"Should I give up on this contact?"* → direct answer with reasoning
- *"What should I say next?"* → one clear recommendation with timing

### 3. LinkedIn Connection Note Generator
Paste a person's LinkedIn headline, job title, company, and your reason for reaching out. The AI generates a connection note under 300 characters:
- Direct and honest — no "I just wanted to connect" filler
- Recruiter: states your job search intent clearly
- Engineer/manager: opens a conversation without making an immediate ask
- Uses the person's name and references your specific reason

### 4. Dashboard
All contacts in one view, sorted by urgency — Follow Up Due contacts always appear first so you never miss a follow-up.

---

## Screenshots

**Dashboard - all contacts sorted by urgency**
![Dashboard](screenshots/Demo_1.png)

**Individual contact chat with AI Coach side by side**
![Contact Chat](screenshots/SP_1.png)

**AI Coach giving direct advice and writing the exact message**
![AI Coach](screenshots/SP_2.png)

**LinkedIn Note Generator**
![Note Generator](screenshots/NG.png)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router v6, Vite |
| Backend | Node.js, Express |
| AI | Google Gemini 2.5 Flash (`@google/generative-ai`) |
| State management | React Context API |
| Database | PostgreSQL with JSONB column (`pg` driver) |
| Styling | Plain CSS with CSS custom properties |

---

## Project Structure

```
networking-agent/
├── server.js              # Express backend — AI proxy + contacts storage
├── vite.config.js         # Vite config — proxies /api to Express in dev
├── .env                   # Your secrets (never committed — see .env.example)
├── .env.example           # Template showing required environment variables
├── data/
│   └── contacts.json      # Your contacts data (never committed)
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── index.css
    ├── context/
    │   └── AppContext.jsx      # Global state, contacts CRUD, auto-save to server
    ├── services/
    │   └── ai.js               # All AI API calls (fetch wrappers over /api/suggest)
    ├── components/
    │   ├── ContactChat.jsx     # Chat thread + AI Coach panel + first-message card
    │   ├── AddContactModal.jsx
    │   ├── StatusBadge.jsx
    │   └── Sidebar.jsx
    └── pages/
        ├── Dashboard.jsx
        ├── Contacts.jsx
        └── NoteGenerator.jsx
```

---

## Setup

### Prerequisites
- Node.js 18+
- A free Gemini API key — get one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

### Install

```bash
git clone https://github.com/YOUR_USERNAME/networking-agent.git
cd networking-agent
npm install
```

### Configure

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```env
GEMINI_API_KEY=your_gemini_key_here
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/networking_agent
PORT=3001
```

### Set up PostgreSQL

**Option A - Local PostgreSQL:**
1. Install PostgreSQL from https://postgresql.org/download
2. Open psql and run:
   ```sql
   CREATE DATABASE networking_agent;
   ```
3. Use `postgresql://postgres:yourpassword@localhost:5432/networking_agent` as your `DATABASE_URL`

**Option B - Free cloud PostgreSQL (no install needed):**
1. Go to https://neon.tech and create a free account
2. Create a new project
3. Copy the connection string it gives you into `DATABASE_URL`

The app creates the `contacts` table automatically on first run. No manual SQL needed.

### Run

```bash
npm run dev
```

This starts both servers at once:
- **Frontend** → `http://localhost:5173`
- **Backend** → `http://localhost:3001`

The `predev` script automatically kills any stale process on port 3001 before starting, so you will never get a port conflict.

---

## Architecture

```
Browser (React)
    │
    │  All /api/* requests
    ▼
Vite Dev Server :5173
    │  proxied to
    ▼
Express Server :3001
    ├── GET  /api/contacts   → SELECT from PostgreSQL
    ├── PUT  /api/contacts   → UPSERT + DELETE into PostgreSQL
    └── POST /api/suggest    → forward prompt to Gemini, return result
                │
                ▼
        Google Gemini 2.5 Flash
```

The frontend never calls the Gemini API directly — the key stays server-side inside the Express backend.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Your Google Gemini API key |
| `PORT` | No | Express server port (default: 3001) |

Never commit `.env`. It is listed in `.gitignore`. Use `.env.example` as the template.

---

## Planned Improvements

- [x] PostgreSQL database
- [ ] Deploy to Railway (backend + DB) and Vercel (frontend)
- [ ] User authentication with JWT
- [ ] Dockerfile + docker-compose
- [ ] GitHub Actions CI/CD pipeline
- [ ] Rate limiting on AI endpoints

---

## What This Project Covers (Portfolio)

| Concept | Implementation |
|---------|---------------|
| Full-stack architecture | React SPA + Express REST API |
| AI / LLM integration | Gemini API with prompt engineering, JSON parsing, error handling |
| REST API design | GET/PUT/POST endpoints, HTTP status codes |
| React patterns | Context API, custom hooks, component composition |
| State management | Centralised store with auto-save and server sync |
| Relational database | PostgreSQL with JSONB, transactions, upsert |
| Secrets management | `.env`, `.gitignore`, `.env.example` pattern |
| Developer tooling | Vite, dev proxy, pre-scripts, hot reload |
| Data persistence | Server-side storage decoupled from browser |
