const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Store active rooms and users (in-memory for this demo)
const rooms = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // User joins a room
    socket.on('join_room', (data) => {
        const { roomId, username } = data;
        
        socket.join(roomId);
        
        // Store user info
        socket.username = username;
        socket.roomId = roomId;

        // Create room if it doesn't exist
        if (!rooms[roomId]) {
            rooms[roomId] = { users: [] };
        }
        rooms[roomId].users.push({ id: socket.id, username: username });

        // Notify others in the room
        socket.to(roomId).emit('user_joined', { username, id: socket.id });
        
        // Send current users list to the new joiner
        socket.emit('room_users', rooms[roomId].users);
        
        console.log(`User ${username} joined room ${roomId}`);
    });

    // Handle Chat Messages
    socket.on('send_message', (data) => {
        const { roomId, message, username, time } = data;
        io.to(roomId).emit('receive_message', { message, username, time, id: socket.id });
    });

    // Handle Disconnect
    socket.on('disconnect', () => {
        if (socket.roomId && rooms[socket.roomId]) {
            const room = rooms[socket.roomId];
            // Remove user from list
            rooms[socket.roomId].users = room.users.filter(u => u.id !== socket.id);
            
            // Notify others
            socket.to(socket.roomId).emit('user_left', { username: socket.username, id: socket.id });
            
            // Clean up empty rooms
            if (rooms[socket.roomId].users.length === 0) {
                delete rooms[socket.roomId];
            }
        }
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});