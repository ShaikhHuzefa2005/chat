/**
 * socketHandlers.js
 * Registers all Socket.IO event listeners for real-time communication.
 * Each handler is responsible for a specific action: join, message, leave, etc.
 */

const { v4: uuidv4 } = require('uuid');
const roomManager = require('./roomManager');

/**
 * Attach socket event handlers to the Socket.IO server instance.
 * @param {import('socket.io').Server} io
 */
function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // ─── JOIN ROOM ───────────────────────────────────────────────────────────
    /**
     * Client emits 'join_room' with { roomId, username }
     * Server responds with 'join_success' or 'join_error'
     */
    socket.on('join_room', ({ roomId, username }) => {
      // Basic validation
      if (!roomId || !username || typeof username !== 'string') {
        return socket.emit('join_error', { reason: 'Invalid room or username.' });
      }

      const cleanUsername = username.trim().slice(0, 24); // max 24 chars

      if (!cleanUsername) {
        return socket.emit('join_error', { reason: 'Username cannot be empty.' });
      }

      if (!roomManager.roomExists(roomId)) {
        return socket.emit('join_error', { reason: 'Room not found.' });
      }

      const result = roomManager.joinRoom(roomId, socket.id, cleanUsername);

      if (!result.success) {
        return socket.emit('join_error', { reason: result.reason });
      }

      // Join the Socket.IO room channel
      socket.join(roomId);

      const room = roomManager.getRoom(roomId);

      // Send success to the joining user along with history
      socket.emit('join_success', {
        user: result.user,
        room: { id: room.id, name: room.name },
        history: roomManager.getMessageHistory(roomId),
        users: roomManager.getUserList(roomId),
      });

      // Build a system notification message
      const notification = {
        id: uuidv4(),
        type: 'notification',
        text: `${cleanUsername} joined the room`,
        timestamp: Date.now(),
      };
      roomManager.addMessage(roomId, notification);

      // Broadcast join notification to everyone else in the room
      socket.to(roomId).emit('user_joined', {
        user: result.user,
        notification,
        users: roomManager.getUserList(roomId),
      });

      console.log(`[Room ${roomId}] ${cleanUsername} joined (${room.users.size}/10 users)`);
    });

    // ─── SEND MESSAGE ─────────────────────────────────────────────────────────
    /**
     * Client emits 'send_message' with { roomId, text }
     */
    socket.on('send_message', ({ roomId, text }) => {
      if (!roomId || !text || typeof text !== 'string') return;

      const room = roomManager.getRoom(roomId);
      if (!room) return;

      const sender = room.users.get(socket.id);
      if (!sender) return; // User not in room, ignore

      const cleanText = text.trim().slice(0, 1000); // max 1000 chars
      if (!cleanText) return;

      const message = {
        id: uuidv4(),
        type: 'message',
        userId: sender.id,
        username: sender.username,
        text: cleanText,
        timestamp: Date.now(),
      };

      roomManager.addMessage(roomId, message);

      // Broadcast to everyone in the room (including sender)
      io.to(roomId).emit('new_message', message);
    });

    // ─── DISCONNECT ───────────────────────────────────────────────────────────
    /**
     * Fired automatically by Socket.IO when a client disconnects.
     * We look up which room the socket was in and clean up.
     */
    socket.on('disconnect', () => {
      const roomId = roomManager.findRoomBySocket(socket.id);

      if (!roomId) {
        console.log(`[Socket] Disconnected (not in a room): ${socket.id}`);
        return;
      }

      const { user, roomDeleted } = roomManager.leaveRoom(roomId, socket.id);

      if (user) {
        console.log(`[Room ${roomId}] ${user.username} disconnected`);

        if (!roomDeleted) {
          const notification = {
            id: uuidv4(),
            type: 'notification',
            text: `${user.username} left the room`,
            timestamp: Date.now(),
          };
          roomManager.addMessage(roomId, notification);

          // Notify remaining users
          io.to(roomId).emit('user_left', {
            userId: user.id,
            username: user.username,
            notification,
            users: roomManager.getUserList(roomId),
          });
        }
      }
    });

    // ─── EXPLICIT LEAVE ───────────────────────────────────────────────────────
    /**
     * Client emits 'leave_room' when navigating away intentionally.
     */
    socket.on('leave_room', ({ roomId }) => {
      if (!roomId) return;

      const { user, roomDeleted } = roomManager.leaveRoom(roomId, socket.id);
      socket.leave(roomId);

      if (user && !roomDeleted) {
        const notification = {
          id: uuidv4(),
          type: 'notification',
          text: `${user.username} left the room`,
          timestamp: Date.now(),
        };
        roomManager.addMessage(roomId, notification);

        socket.to(roomId).emit('user_left', {
          userId: user.id,
          username: user.username,
          notification,
          users: roomManager.getUserList(roomId),
        });
      }
    });
  });
}

module.exports = { registerSocketHandlers };
