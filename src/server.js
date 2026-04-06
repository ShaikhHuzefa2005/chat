/**
 * server.js
 * Entry point. Sets up Express, Socket.IO, and starts the HTTP server.
 */

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const routes = require('./routes');
const { registerSocketHandlers } = require('./socketHandlers');

// ─── App Setup ────────────────────────────────────────────────────────────────

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS permissive for all origins (adjust in production if needed)
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  // Graceful connection handling
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from /public
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── API Routes ───────────────────────────────────────────────────────────────

app.use('/api', routes);

// ─── Frontend Catch-All ───────────────────────────────────────────────────────
// For any non-API route, serve the SPA index.html so client-side routing works.

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ─── Socket.IO ────────────────────────────────────────────────────────────────

registerSocketHandlers(io);

// ─── Start Server ─────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`✅ Chatroom server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});
