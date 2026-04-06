/**
 * routes.js
 * Express API routes for room management.
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const roomManager = require('./roomManager');

const router = express.Router();

/**
 * POST /api/rooms
 * Create a new chat room.
 * Body: { name: string }
 */
router.post('/rooms', (req, res) => {
  const { name } = req.body;

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Room name is required.' });
  }

  const cleanName = name.trim().slice(0, 50);
  if (!cleanName) {
    return res.status(400).json({ error: 'Room name cannot be empty.' });
  }

  const roomId = uuidv4();
  const room = roomManager.createRoom(roomId, cleanName);

  return res.status(201).json({
    roomId: room.id,
    roomName: room.name,
  });
});

/**
 * GET /api/rooms/:roomId
 * Check if a room exists and return its basic info.
 */
router.get('/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = roomManager.getRoom(roomId);

  if (!room) {
    return res.status(404).json({ error: 'Room not found.' });
  }

  const isFull = room.users.size >= 10;

  return res.json({
    id: room.id,
    name: room.name,
    userCount: room.users.size,
    isFull,
    maxUsers: 10,
  });
});

module.exports = router;
