/**
 * RoomManager
 * Manages all in-memory state for chat rooms: creation, joining, leaving,
 * messaging, and cleanup. No database required.
 */

const MAX_USERS_PER_ROOM = 10;

class RoomManager {
  constructor() {
    // rooms: Map<roomId, { id, name, createdAt, users: Map<socketId, user>, messages: [] }>
    this.rooms = new Map();
  }

  /**
   * Create a new chat room.
   * @param {string} roomId - Unique room ID (UUID)
   * @param {string} roomName - Display name for the room
   * @returns {object} The created room object
   */
  createRoom(roomId, roomName) {
    const room = {
      id: roomId,
      name: roomName.trim(),
      createdAt: Date.now(),
      users: new Map(), // socketId -> { id, username, joinedAt }
      messages: [],     // [{ id, username, text, timestamp, type }]
    };
    this.rooms.set(roomId, room);
    return room;
  }

  /**
   * Get a room by ID.
   * @param {string} roomId
   * @returns {object|null}
   */
  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  /**
   * Check if a room exists.
   */
  roomExists(roomId) {
    return this.rooms.has(roomId);
  }

  /**
   * Check if a room is full (at max capacity).
   */
  isRoomFull(roomId) {
    const room = this.getRoom(roomId);
    if (!room) return false;
    return room.users.size >= MAX_USERS_PER_ROOM;
  }

  /**
   * Add a user to a room.
   * @returns {{ success: boolean, reason?: string, user?: object }}
   */
  joinRoom(roomId, socketId, username) {
    const room = this.getRoom(roomId);

    if (!room) {
      return { success: false, reason: 'Room not found.' };
    }

    if (room.users.size >= MAX_USERS_PER_ROOM) {
      return { success: false, reason: 'Room is full. Maximum 10 users allowed.' };
    }

    // Check if username is already taken in this room
    const nameTaken = [...room.users.values()].some(
      (u) => u.username.toLowerCase() === username.toLowerCase()
    );
    if (nameTaken) {
      return { success: false, reason: 'Username is already taken in this room.' };
    }

    const user = {
      id: socketId,
      username: username.trim(),
      joinedAt: Date.now(),
    };

    room.users.set(socketId, user);
    return { success: true, user };
  }

  /**
   * Remove a user from a room.
   * If the room is empty after removal, delete the room.
   * @returns {{ user: object|null, roomDeleted: boolean }}
   */
  leaveRoom(roomId, socketId) {
    const room = this.getRoom(roomId);
    if (!room) return { user: null, roomDeleted: false };

    const user = room.users.get(socketId) || null;
    room.users.delete(socketId);

    // Cleanup empty rooms to prevent memory leaks
    if (room.users.size === 0) {
      this.rooms.delete(roomId);
      return { user, roomDeleted: true };
    }

    return { user, roomDeleted: false };
  }

  /**
   * Find which room a socket belongs to (for disconnect handling).
   * @returns {string|null} roomId
   */
  findRoomBySocket(socketId) {
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.users.has(socketId)) {
        return roomId;
      }
    }
    return null;
  }

  /**
   * Add a message to a room's history (cap at 200 messages).
   */
  addMessage(roomId, message) {
    const room = this.getRoom(roomId);
    if (!room) return null;

    room.messages.push(message);

    // Prevent unbounded memory growth
    if (room.messages.length > 200) {
      room.messages.shift();
    }

    return message;
  }

  /**
   * Get a serializable list of users in a room.
   */
  getUserList(roomId) {
    const room = this.getRoom(roomId);
    if (!room) return [];
    return [...room.users.values()].map(({ id, username, joinedAt }) => ({
      id,
      username,
      joinedAt,
    }));
  }

  /**
   * Get recent message history for a room (last 50 messages).
   */
  getMessageHistory(roomId) {
    const room = this.getRoom(roomId);
    if (!room) return [];
    return room.messages.slice(-50);
  }
}

module.exports = new RoomManager();
