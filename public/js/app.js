/**
 * app.js — Chatroom Frontend
 * Handles: routing (home / chat screens), Socket.IO events,
 * DOM rendering, URL-based room joining, and UI state.
 */

/* ─── Constants ────────────────────────────────────────────── */
const MAX_USERS = 10;

/* ─── State ─────────────────────────────────────────────────── */
const state = {
  socket: null,
  roomId: null,
  roomName: null,
  currentUser: null,
};

/* ─── DOM References ─────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);

const screens = {
  home:     $('screen-home'),
  chat:     $('screen-chat'),
  full:     $('screen-full'),
  notfound: $('screen-notfound'),
  join:     $('screen-join'),
};

/* ─── Screen Navigation ──────────────────────────────────────── */
function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove('active'));
  screens[name].classList.add('active');
}

/* ─── Toast Notification ─────────────────────────────────────── */
let toastTimer = null;
function showToast(message, duration = 3000) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

/* ─── Utility: Parse Room ID from URL or string ──────────────── */
function parseRoomId(input) {
  try {
    const url = new URL(input);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'room' && parts[1]) return parts[1];
  } catch {
    // Not a URL — treat as raw room ID
  }
  // UUID regex check
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidPattern.test(input.trim())) return input.trim();
  return null;
}

/* ─── Format timestamp ───────────────────────────────────────── */
function formatTime(ts) {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/* ─── DOM: Render User List ──────────────────────────────────── */
function renderUserList(users) {
  const list = $('user-list');
  const countEl = $('user-count');

  list.innerHTML = '';
  countEl.textContent = users.length;

  users.forEach((user) => {
    const isMe = state.currentUser && user.id === state.currentUser.id;
    const li = document.createElement('li');
    li.className = `user-list-item${isMe ? ' is-me' : ''}`;
    li.innerHTML = `
      <span class="user-dot"></span>
      <span class="user-name">${escapeHtml(user.username)}</span>
      ${isMe ? '<span class="user-tag">you</span>' : ''}
    `;
    list.appendChild(li);
  });
}

/* ─── DOM: Render a single message ──────────────────────────── */
function renderMessage(msg, prepend = false) {
  const area = $('messages-inner');

  if (msg.type === 'notification') {
    const el = document.createElement('div');
    el.className = 'msg-notification';
    el.textContent = msg.text;
    if (prepend) area.insertBefore(el, area.firstChild);
    else area.appendChild(el);
    return;
  }

  const isMe = state.currentUser && msg.userId === state.currentUser.id;
  const el = document.createElement('div');
  el.className = 'msg';
  el.dataset.msgId = msg.id;
  el.innerHTML = `
    <div class="msg-header">
      <span class="msg-username${isMe ? ' is-me' : ''}">${escapeHtml(msg.username)}</span>
      <span class="msg-time">${formatTime(msg.timestamp)}</span>
    </div>
    <div class="msg-text">${escapeHtml(msg.text)}</div>
  `;

  if (prepend) area.insertBefore(el, area.firstChild);
  else area.appendChild(el);
}

/* ─── DOM: Render history (batch) ────────────────────────────── */
function renderHistory(messages) {
  $('messages-inner').innerHTML = '';
  messages.forEach((msg) => renderMessage(msg));
}

/* ─── Scroll messages to bottom ──────────────────────────────── */
function scrollToBottom(smooth = true) {
  const area = $('messages-area');
  area.scrollTo({ top: area.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
}

/* ─── Escape HTML to prevent XSS ────────────────────────────── */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ─── Socket.IO Setup ─────────────────────────────────────────── */
function initSocket() {
  if (state.socket) {
    state.socket.disconnect();
    state.socket = null;
  }

  const socket = io({ autoConnect: true, reconnectionAttempts: 5 });
  state.socket = socket;

  // Connection status UI
  socket.on('connect', () => {
    setConnStatus(true);
  });

  socket.on('disconnect', () => {
    setConnStatus(false);
  });

  socket.on('connect_error', () => {
    setConnStatus(false);
  });

  // Successfully joined a room
  socket.on('join_success', ({ user, room, history, users }) => {
    state.currentUser = user;
    state.roomId      = room.id;
    state.roomName    = room.name;

    // Update URL without reload
    window.history.replaceState({}, '', `/room/${room.id}`);

    // Populate chat UI
    $('sidebar-room-name').textContent = room.name;
    $('chat-topbar-title').textContent = room.name;

    renderHistory(history);
    renderUserList(users);
    showScreen('chat');

    setTimeout(() => scrollToBottom(false), 50);
  });

  // Join rejected
  socket.on('join_error', ({ reason }) => {
    if (reason.toLowerCase().includes('full')) {
      showScreen('full');
    } else if (reason.toLowerCase().includes('not found')) {
      showScreen('notfound');
    } else {
      // Show error inline based on which flow was active
      const errEl = $('direct-join-error') || $('join-error');
      showError(errEl, reason);
    }
  });

  // Another user joined
  socket.on('user_joined', ({ notification, users }) => {
    renderMessage(notification);
    renderUserList(users);
    scrollToBottom();
  });

  // Another user left
  socket.on('user_left', ({ notification, users }) => {
    renderMessage(notification);
    renderUserList(users);
    scrollToBottom();
  });

  // New chat message
  socket.on('new_message', (msg) => {
    renderMessage(msg);
    scrollToBottom();
  });

  return socket;
}

function setConnStatus(connected) {
  const dot   = $('conn-indicator');
  const label = $('conn-label');
  if (!dot || !label) return;
  dot.className = `conn-indicator ${connected ? 'connected' : 'disconnected'}`;
  label.textContent = connected ? 'connected' : 'disconnected';
}

/* ─── Show inline error ───────────────────────────────────────── */
function showError(el, message) {
  if (!el) return;
  el.textContent = message;
  setTimeout(() => { el.textContent = ''; }, 4000);
}

/* ─── Validate username ───────────────────────────────────────── */
function validateUsername(username) {
  const trimmed = username.trim();
  if (!trimmed) return 'Please enter a username.';
  if (trimmed.length < 2) return 'Username must be at least 2 characters.';
  if (!/^[a-zA-Z0-9_\-. ]+$/.test(trimmed))
    return 'Username can only contain letters, numbers, spaces, and _ - .';
  return null;
}

/* ─── API: Create room ────────────────────────────────────────── */
async function apiCreateRoom(name) {
  const res = await fetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to create room.');
  }
  return res.json();
}

/* ─── API: Check room info ────────────────────────────────────── */
async function apiGetRoom(roomId) {
  const res = await fetch(`/api/rooms/${roomId}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Network error.');
  return res.json();
}

/* ─── Join flow via socket ────────────────────────────────────── */
function joinRoom(roomId, username) {
  const socket = state.socket || initSocket();
  socket.emit('join_room', { roomId, username: username.trim() });
}

/* ─── Leave room ─────────────────────────────────────────────── */
function leaveRoom() {
  if (state.socket && state.roomId) {
    state.socket.emit('leave_room', { roomId: state.roomId });
  }
  state.roomId      = null;
  state.roomName    = null;
  state.currentUser = null;
  window.history.replaceState({}, '', '/');
  showScreen('home');
  // Reset messages
  $('messages-inner').innerHTML = '';
}

/* ─── Copy room link to clipboard ────────────────────────────── */
function copyRoomLink() {
  const link = `${window.location.origin}/room/${state.roomId}`;
  navigator.clipboard.writeText(link).then(() => {
    showToast('Room link copied!');
  }).catch(() => {
    // Fallback for older browsers
    const el = document.createElement('input');
    el.value = link;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast('Room link copied!');
  });
}

/* ─── Send message ───────────────────────────────────────────── */
function sendMessage() {
  const input = $('message-input');
  const text  = input.value.trim();
  if (!text || !state.roomId || !state.socket) return;

  state.socket.emit('send_message', { roomId: state.roomId, text });
  input.value = '';
  input.focus();
}

/* ─── Event Listeners ─────────────────────────────────────────── */
function bindHomeEvents() {
  // Create room
  $('btn-create-room').addEventListener('click', async () => {
    const roomName = $('input-room-name').value.trim();
    const username = $('input-create-username').value.trim();
    const errEl    = $('create-error');

    if (!roomName) return showError(errEl, 'Please enter a room name.');
    const usernameErr = validateUsername(username);
    if (usernameErr) return showError(errEl, usernameErr);

    try {
      const { roomId } = await apiCreateRoom(roomName);
      initSocket();
      joinRoom(roomId, username);
    } catch (err) {
      showError(errEl, err.message);
    }
  });

  // Create room on Enter
  [$('input-room-name'), $('input-create-username')].forEach((input) => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('btn-create-room').click();
    });
  });

  // Join room from link
  $('btn-join-room').addEventListener('click', async () => {
    const rawInput = $('input-room-link').value.trim();
    const username = $('input-join-username').value.trim();
    const errEl    = $('join-error');

    if (!rawInput) return showError(errEl, 'Please enter a room link or ID.');
    const usernameErr = validateUsername(username);
    if (usernameErr) return showError(errEl, usernameErr);

    const roomId = parseRoomId(rawInput);
    if (!roomId) return showError(errEl, 'Invalid room link or ID.');

    // Check if room exists and has space
    try {
      const room = await apiGetRoom(roomId);
      if (!room) return showScreen('notfound');
      if (room.isFull) return showScreen('full');
      initSocket();
      joinRoom(roomId, username);
    } catch {
      showError(errEl, 'Could not reach the server. Please try again.');
    }
  });

  [$('input-room-link'), $('input-join-username')].forEach((input) => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('btn-join-room').click();
    });
  });
}

function bindChatEvents() {
  $('btn-send').addEventListener('click', sendMessage);

  $('message-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  $('btn-copy-link').addEventListener('click', copyRoomLink);

  $('btn-leave-room').addEventListener('click', () => {
    leaveRoom();
  });

  // Mobile sidebar toggle
  $('sidebar-toggle').addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('open');
  });

  // Close sidebar when clicking outside on mobile
  $('messages-area').addEventListener('click', () => {
    document.querySelector('.sidebar').classList.remove('open');
  });
}

function bindStatusScreenEvents() {
  $('btn-go-home').addEventListener('click', () => showScreen('home'));
  $('btn-notfound-home').addEventListener('click', () => showScreen('home'));
  $('btn-join-home').addEventListener('click', () => {
    window.history.replaceState({}, '', '/');
    showScreen('home');
  });

  // Direct join screen
  $('btn-direct-join').addEventListener('click', async () => {
    const username = $('input-direct-username').value.trim();
    const errEl    = $('direct-join-error');
    const usernameErr = validateUsername(username);
    if (usernameErr) return showError(errEl, usernameErr);

    const roomId = state.pendingRoomId;
    if (!roomId) return showScreen('home');

    initSocket();
    joinRoom(roomId, username);
  });

  $('input-direct-username').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('btn-direct-join').click();
  });
}

/* ─── URL-based routing: Handle /room/:id links ───────────────── */
async function handleInitialRoute() {
  const path  = window.location.pathname;
  const match = path.match(/^\/room\/([0-9a-f-]{36})$/i);

  if (!match) {
    showScreen('home');
    return;
  }

  const roomId = match[1];

  // Show the "join" screen while we check room status
  showScreen('join');

  try {
    const room = await apiGetRoom(roomId);
    if (!room) {
      showScreen('notfound');
      return;
    }
    if (room.isFull) {
      showScreen('full');
      return;
    }

    // Store pending room ID for when user submits username
    state.pendingRoomId = roomId;
    $('join-room-name').textContent = room.name;
    $('input-direct-username').focus();

  } catch {
    showScreen('home');
  }
}

/* ─── Init ───────────────────────────────────────────────────── */
function init() {
  initSocket();
  bindHomeEvents();
  bindChatEvents();
  bindStatusScreenEvents();
  handleInitialRoute();
}

document.addEventListener('DOMContentLoaded', init);
