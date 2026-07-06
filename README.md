# Real-Time Collaborative Platform

A full-stack app where multiple logged-in users can open the same document
and edit it together, seeing each other's changes live — like a mini Google Docs.

Stack: **React + Tailwind** (frontend) · **Node/Express + Socket.io** (backend)
· **MongoDB** (database) · **JWT** (auth) — matching the task sheet exactly.

---

## 1. How to run it

### Prerequisites
- Node.js installed (v18+ recommended)
- MongoDB running locally, OR a free MongoDB Atlas connection string

### Backend
```bash
cd backend
npm install
cp .env.example .env
# edit .env: set MONGO_URI and a random JWT_SECRET
npm run dev
```
Runs on http://localhost:5000

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Runs on http://localhost:5173

### Try it
1. Open http://localhost:5173 in two different browser windows (or one normal +
   one incognito, so they're logged in as two different users).
2. Register two different accounts.
3. In window 1, create a document, then copy its URL into window 2 (or invite
   the second user via the `/invite` endpoint — see below).
4. Type in one window and watch the text appear in the other, live.

---

## 2. Project structure

```
backend/
  server.js            → starts Express + Socket.io together
  config/db.js         → connects to MongoDB
  models/User.js        → user schema, password hashing
  models/Document.js    → document schema, version + activity log
  middleware/auth.js    → verifies JWT on protected REST routes
  routes/auth.js        → register / login
  routes/documents.js   → create / list / fetch / invite
  sockets/collabHandler.js → ALL the real-time + conflict-handling logic

frontend/
  src/context/AuthContext.jsx → shares logged-in user across pages
  src/pages/Login.jsx, Register.jsx
  src/pages/Dashboard.jsx     → list + create documents
  src/pages/Editor.jsx        → the live collaborative editor (core feature)
  src/components/ActiveUsers.jsx → shows who's online
```

---

## 3. How each poster requirement maps to the code (for your viva)

| Requirement | Where it lives | How to explain it |
|---|---|---|
| **User Authentication** | `models/User.js`, `routes/auth.js`, `middleware/auth.js` | Passwords are hashed with bcrypt before saving (never stored as plain text). Login returns a JWT, which the frontend stores and sends on every request. `middleware/auth.js` checks that JWT on protected routes. |
| **Real-Time Collaboration** | `sockets/collabHandler.js`, `Editor.jsx` | Uses Socket.io. Each document is a "room" — only people viewing that document receive its updates. Typing triggers a debounced `edit-document` event; the server broadcasts the accepted change to everyone else in the room via `document-updated`. |
| **Multi-User Sync** | `edit-document` / `document-updated` events | Every accepted edit is saved to MongoDB immediately and pushed to all connected clients, so everyone always converges on the same content. |
| **Conflict Handling** | `version` field in `models/Document.js` + logic in `collabHandler.js` | Each doc has a version number. A client can only save if their `baseVersion` still matches the database. If someone else saved first, the server rejects the save and sends back the latest content instead of silently overwriting it — this is "optimistic concurrency control," the same underlying idea Google Docs and Git use. |
| **Activity Tracking** | `activityLog` array in `Document.js`, `activity` socket event, activity feed in `Editor.jsx` | Every join, leave, and edit is appended to the document's activity log and broadcast live, so you can see "Priya edited the document at 3:04 PM" etc. |
| **Data Persistence** | MongoDB via Mongoose (`models/`) | Every accepted edit calls `doc.save()`, so refreshing the page or reconnecting always loads the latest saved content from the database, not just memory. |

### Bonus features now included

| Feature | Where it lives | How to explain it |
|---|---|---|
| **Live cursor tracking** | `cursor-move`/`cursor-update` events in `collabHandler.js`, `RemoteCursors.jsx`, `utils/caretPosition.js` | The frontend measures where a text index lands in pixels using an invisible "mirror" div styled identically to the textarea, then overlays a colored flag at that position for every other collaborator. |
| **Version history** | `models/Revision.js`, `/revisions` routes, `VersionHistory.jsx` | Every accepted edit snapshots the *previous* content into a separate `Revision` collection before overwriting. The history panel lists these; restoring one creates a NEW version rather than rewriting the past (like `git revert`). |
| **Role-based access** | `collaboratorSchema` + `getRoleFor()` in `Document.js`, role checks in routes and `collabHandler.js`, `InviteModal.jsx` | Each collaborator has a role: `editor` or `viewer`. The owner picks the role when inviting. Both the backend (routes AND socket handler) and frontend enforce it — viewers get a read-only textarea and their edit attempts are rejected server-side too, since you should never trust the frontend alone for permissions. |
| **Document rename / delete** | `PATCH /:id/title`, `DELETE /:id` in `routes/documents.js`, inline editing in `Dashboard.jsx`/`Editor.jsx` | Only the owner can delete; owner + editors can rename. Delete also cleans up that document's revision history. |

---

## 4. Things you should genuinely understand before the viva

Be ready to explain, in your own words:
1. **Why passwords are hashed, not encrypted** — hashing is one-way; even if
   the database leaks, no one can reverse a hash back into the password.
2. **What a JWT actually is** — a signed token containing your user id/name;
   the server trusts it because only the server knows the secret used to sign it.
3. **Why Socket.io "rooms" matter** — without them, every edit would broadcast
   to every user on the entire platform, not just people viewing that document.
4. **The conflict-handling flow, step by step** — walk through: user A and B both
   open v3 of a doc → A saves first → server bumps it to v4 → B's save (still says
   v3) gets rejected → B receives the latest content and redoes their change.
5. **Debouncing** — why we wait 500ms after typing stops before sending an edit,
   instead of sending on every keystroke (performance + fewer false "conflicts").
6. **The mirror-div trick for cursor tracking** — a `<textarea>` has no API for
   "give me the pixel position of character 47," so we build an invisible,
   identically-styled copy of it, wrap a marker span around that character,
   and read its position off the DOM.
7. **Why permissions are checked on the server, not just the frontend** — the
   frontend disables typing for viewers, but a technical user could bypass
   that by calling the API directly, so `collabHandler.js` and the routes
   check the role independently every time.

## 5. Still not built (only if you want to push further)
- **Notifications** — a toast/pop-up when someone joins or edits, instead of
  just the activity feed at the bottom.
- **Export data** — a button to download the document as `.txt` or `.pdf`.
