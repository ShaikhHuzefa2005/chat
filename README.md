https://chat-u3tq.onrender.com/room/f2b4fcb7-cc0d-4e61-86c8-85b452b68b51

# Chatroom — Real-Time Chat Rooms

A production-ready real-time chatroom app built with Node.js, Express, and Socket.IO.

**Features:**
- Create rooms with unique shareable links
- Up to 10 users per room
- Real-time messaging with instant updates
- Live user list with join/leave notifications
- No authentication required — just pick a username
- Graceful disconnection handling
- Rooms auto-delete when empty (no memory leaks)

---

## Project Structure

```
chatroom/
├── src/
│   ├── server.js          # Express + Socket.IO entry point
│   ├── routes.js          # REST API routes (create/check rooms)
│   ├── roomManager.js     # In-memory room state manager
│   └── socketHandlers.js  # All Socket.IO event handlers
├── public/
│   ├── index.html         # Single-page app shell
│   ├── css/
│   │   └── style.css      # Full responsive stylesheet
│   └── js/
│       └── app.js         # Frontend logic & Socket.IO client
├── package.json
├── .gitignore
└── README.md
```

---

## Run Locally

### Prerequisites
- Node.js v18 or higher
- npm

### Steps

```bash
# 1. Clone or unzip the project
cd chatroom

# 2. Install dependencies
npm install

# 3. Start the server
npm start
# or for development with auto-reload:
npm run dev

# 4. Open your browser
# http://localhost:3000
```

The app runs on `http://localhost:3000` by default.  
You can change the port by setting the `PORT` environment variable:

```bash
PORT=8080 npm start
```

---

## Deploy on Render

### Step 1 — Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/chatroom.git
git push -u origin main
```

### Step 2 — Create a Web Service on Render
1. Go to [https://render.com](https://render.com) and log in
2. Click **New → Web Service**
3. Connect your GitHub repository
4. Configure:

| Setting         | Value                          |
|----------------|-------------------------------|
| Runtime         | Node                          |
| Build Command   | `npm install`                 |
| Start Command   | `npm start`                   |
| Instance Type   | Free (or Starter for better performance) |

5. Click **Deploy Web Service**

Render automatically sets `process.env.PORT` — no manual configuration needed.

### Step 3 — Test your deployment
- Visit your Render URL (e.g., `https://chatroom-xxxx.onrender.com`)
- Create a room and share the link with anyone in the world

---

## Environment Variables

| Variable | Default | Description               |
|----------|---------|---------------------------|
| `PORT`   | `3000`  | Port for the HTTP server  |

No other environment variables are required.

---

## Technical Notes

- **Room persistence:** Rooms live in memory only. If the server restarts, all rooms and messages are cleared. For persistence, add Redis or a database.
- **Max users:** Hard-capped at 10 per room, enforced both on the API and Socket.IO layers.
- **Message history:** Last 200 messages are kept per room. Joining users receive the last 50.
- **Security:** HTML is escaped client-side to prevent XSS. Input is validated and trimmed on both ends.
- **Scalability:** Single-server in-memory state. For multi-instance deployments, replace `roomManager.js` with a Redis adapter and use `socket.io-redis`.
