# Project Architecture and Design

## What This App Is

A full-stack AI-powered career networking assistant. It helps a job seeker track every person they are networking with, get AI coaching on what to say, and generate personalised LinkedIn connection notes.

---

## The Three Layers

Every web application has three layers. This project follows the same pattern.

```
Layer 1 - Frontend (React)
    What the user sees and interacts with.
    Runs inside the browser.
    Written in JavaScript using React.

Layer 2 - Backend (Node.js + Express)
    The brain. Handles all logic.
    Runs on a server (your machine in dev, Railway in production).
    The only layer that talks to the database and AI.

Layer 3 - Database (PostgreSQL on Neon)
    The memory. Stores all contacts permanently.
    Lives in the cloud (Neon).
    Never touched directly by the browser.
```

---

## Full System Diagram

```
+------------------+
|     Browser      |
|   (React App)    |
+--------+---------+
         |
         | HTTP requests (/api/*)
         |
+--------+---------+
|   Vite Dev       |
|   Server :5173   |  <-- only exists in development
|   (proxy layer)  |
+--------+---------+
         |
         | forwards /api/* to port 3001
         |
+--------+---------+
|  Express Server  |
|     :3001        |
|   (server.js)    |
+---+----------+---+
    |          |
    |          | AI requests
    |          |
    |    +-----+--------+
    |    | Google Gemini |
    |    | 2.5 Flash API |
    |    +--------------+
    |
    | SQL queries
    |
+---+----------+
|  PostgreSQL  |
|  (Neon.tech) |
|  cloud DB    |
+--------------+
```

---

## How a Request Works - Step by Step

### Loading contacts when you open the app

```
1. You open localhost:5173
2. React loads in the browser
3. React immediately sends: GET /api/contacts
4. Vite sees /api and forwards it to Express on port 3001
5. Express runs: SELECT data FROM contacts ORDER BY created_at
6. Neon PostgreSQL returns all contact rows
7. Express sends them back as JSON
8. React stores them in Context (global state)
9. The screen updates with your contacts
```

### Asking the AI coach a question

```
1. You type "what should I say next?" and press Enter
2. React sends: POST /api/suggest
   Body includes:
   - contact profile (name, company, relationship type)
   - full conversation history
   - all previous coach messages
   - your question
3. Express receives this and builds a detailed prompt
4. Express sends the prompt to Google Gemini API
   (API key stays on the server, never touches browser)
5. Gemini reads the prompt and generates a response
6. Express parses the response and sends it back as JSON
7. React displays the coach reply in the chat panel
```

### Saving a contact after you make changes

```
1. You add a message or update a status
2. React updates the local state immediately (screen updates instantly)
3. 400ms later, React sends: PUT /api/contacts
   Body includes the full updated contacts array
4. Express runs UPSERT for each contact (insert if new, update if exists)
5. Express deletes any contacts that were removed
6. All of this happens inside a database transaction
   (if anything fails, nothing is saved - all or nothing)
7. Your data is now safely in Neon
```

---

## File Structure Explained

```
networking-agent/
|
+-- server.js
|   The Express backend. Two jobs:
|   1. Serve the contacts API (GET and PUT /api/contacts)
|   2. Handle all AI requests (POST /api/suggest)
|   All Gemini API calls happen here. API key never leaves this file.
|
+-- db.js
|   All database logic lives here. Separated from server.js on purpose.
|   - initDB()        creates the contacts table if it does not exist
|   - getAllContacts() reads all contacts from PostgreSQL
|   - saveContacts()  upserts new/changed contacts, deletes removed ones
|   One-time migration: moves contacts.json into PostgreSQL on first run.
|
+-- vite.config.js
|   Two jobs:
|   1. Tells Vite how to build the React app
|   2. Proxy rule: forward /api/* to localhost:3001 during development
|
+-- .env
|   Secret credentials. Never committed to Git.
|   Contains: GEMINI_API_KEY, DATABASE_URL, PORT
|
+-- .env.example
|   A template showing what variables are needed.
|   Safe to commit. Has no real values.
|
+-- src/
|   |
|   +-- main.jsx
|   |   Entry point. Wraps the app in BrowserRouter for routing.
|   |
|   +-- App.jsx
|   |   Sets up routes. Maps URLs to page components.
|   |   / = Dashboard
|   |   /contacts = Contacts page
|   |   /contacts/:id = Contacts page with a specific contact open
|   |   /note-generator = Note Generator page
|   |
|   +-- index.css
|   |   All styling in one file. Uses CSS custom properties (variables)
|   |   for colours, spacing, and radius so the design is consistent.
|   |
|   +-- context/
|   |   +-- AppContext.jsx
|   |       Global state. Holds the contacts array in memory.
|   |       Any component can read or update contacts without passing
|   |       props through every level.
|   |       Auto-saves to the server 400ms after any change (debounced).
|   |       On load: fetches from server, falls back to localStorage.
|   |       Auto-flags contacts as Follow Up Due after 7 days.
|   |
|   +-- services/
|   |   +-- ai.js
|   |       Thin wrappers over fetch. Each function calls POST /api/suggest
|   |       with a different request type.
|   |       Functions: analyzeHistory, suggestAfterSent, suggestAfterReply,
|   |       suggestNoReply, manualSuggest, generateNote, coachChat, firstMessage
|   |
|   +-- components/
|   |   +-- ContactChat.jsx
|   |   |   The main contact view. Two panels side by side:
|   |   |   Left: conversation thread + action buttons
|   |   |   Right: AI coach chat (always visible)
|   |   |   Shows first-message card when contact has no history.
|   |   |
|   |   +-- AddContactModal.jsx
|   |   |   Form for creating a new contact.
|   |   |   Fields: name, job title, company, relationship type,
|   |   |   optional conversation history paste.
|   |   |
|   |   +-- StatusBadge.jsx
|   |   |   Coloured pill that shows contact status.
|   |   |   Each status has its own colour.
|   |   |
|   |   +-- Sidebar.jsx
|   |       Left navigation. Shows contact count and urgent flag count.
|   |
|   +-- pages/
|       +-- Dashboard.jsx
|       |   Stats row + contacts table sorted by urgency.
|       |   Clicking a row navigates to that contact's chat.
|       |
|       +-- Contacts.jsx
|       |   Split layout: contact list on left, chat panel on right.
|       |   Handles add contact modal and URL-based contact selection.
|       |
|       +-- NoteGenerator.jsx
|           Form for generating LinkedIn connection notes.
|           Takes: name, headline, job title, company, reason, relationship type.
|           Calls AI and displays the generated note with character count.
```

---

## Database Schema

One table. Simple by design.

```sql
CREATE TABLE contacts (
  id          TEXT        PRIMARY KEY,
  data        JSONB       NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

- `id` is a UUID generated on the frontend when a contact is created
- `data` stores the entire contact object as JSON
- `updated_at` tracks when it was last changed

The contact object inside `data` looks like this:

```
{
  id:               unique identifier
  name:             contact's full name
  jobTitle:         their job title
  company:          their company
  relationshipType: recruiter / engineer / hiring_manager / other
  status:           New / Message Sent / Awaiting Reply / etc.
  messages:         array of conversation messages
  coachChat:        array of AI coach messages
  lastContactDate:  when you last sent or received a message
  createdAt:        when you added this contact
}
```

---

## API Endpoints

```
GET  /api/contacts
     Returns all contacts from PostgreSQL as a JSON array.

PUT  /api/contacts
     Receives the full contacts array.
     Upserts all contacts and deletes any that were removed.
     Uses a database transaction for safety.

POST /api/suggest
     Receives: type, contact profile, context
     Builds a prompt and sends it to Gemini.
     Returns: AI-generated suggestion as JSON.

     Types handled:
     - analyze-history   : analyses pasted conversation, suggests next message
     - after-sent        : suggests follow-up plan after a message is sent
     - after-reply       : suggests response after receiving a reply
     - no-reply          : advises whether to follow up or stop
     - manual-suggest    : general next step suggestion
     - coach-chat        : conversational AI coaching
     - first-message     : generates first outreach message from context
     - note-generator    : generates LinkedIn connection note under 300 chars
```

---

## Status System

Contacts move through these statuses:

```
New
 |
 | (you send a message)
 v
Message Sent / Awaiting Reply
 |
 | (they reply)          | (7 days pass, no reply)
 v                       v
Reply Received      Follow Up Due
 |
 | (conversation ends)
 v
Closed
```

Follow Up Due is set automatically. Every time contacts are loaded from the server, the app checks the `lastContactDate` of every contact with status `Awaiting Reply`. If 7 or more days have passed, the status is changed to `Follow Up Due`.

---

## AI Design

Every AI request sends:
- The contact's full profile (name, relationship type, company, job title)
- The complete conversation history between user and contact
- The specific question or context for this request

The system prompt instructs Gemini to act as a direct career coach:
- No filler phrases like "I hope this finds you well"
- Recruiters get a direct ask
- Engineers and managers get a conversation opener
- Always includes timing advice
- Tells the user when to stop messaging someone
- Gives exact messages ready to copy, no brackets or placeholders

---

## Key Design Decisions

**Why JSONB instead of separate columns for each contact field**

Contact objects are complex and nested with arrays inside arrays (messages, coach chat). Defining a fixed table column for every field would require joining multiple tables for every read. JSONB stores the whole object in one column, making reads fast and schema changes easy.

**Why the frontend auto-saves instead of a Save button**

Better user experience. Every change is saved 400ms after it happens without the user having to think about it. The 400ms delay (debounce) prevents a database write on every single keystroke.

**Why the API key stays on the server**

If the React app called Gemini directly, the API key would be visible in the browser. Anyone could open developer tools and steal it. Routing through the Express backend keeps the key hidden from the browser entirely.

**Why contacts are sorted by urgency on the dashboard**

Follow Up Due contacts appear first because they need action. The sorting order is: Follow Up Due, Awaiting Reply, Reply Received, Message Sent, New, Closed. This means you always see who needs attention without having to scan the whole list.

---

## Development vs Production

```
Development (your laptop)           Production (deployed)

Two servers running:                One server handles everything:
- Vite on port 5173                 - Express serves the built React files
- Express on port 3001              - Express handles the API
                                    - No Vite, no proxy needed

Vite proxies /api to 3001           React calls /api directly on same domain

Data in Neon (same)                 Data in Neon (same)
Gemini API (same)                   Gemini API (same)
```

---

## Security Checklist

- `.env` is in `.gitignore` - credentials never reach GitHub
- `data/` is in `.gitignore` - personal contacts never reach GitHub
- Gemini API key only exists in server.js context - never sent to browser
- Database credentials only in `.env` - never in source code
- `.env.example` shows structure with placeholder values only
