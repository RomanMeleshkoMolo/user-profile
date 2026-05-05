const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

let io = null;

function initSocketIO(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
    path: '/socket/profile',
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const userId = payload.sub || payload.userId || payload.id;
      if (!userId) return next(new Error('Invalid token'));
      socket.userId = String(userId);
      next();
    } catch (e) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`[socket-profile] User connected: ${socket.userId}`);
    socket.join(`user:${socket.userId}`);

    // Обновляем статус онлайн и рассылаем всем подключённым пользователям
    try {
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: true,
        lastSeen: new Date(),
      });
      socket.broadcast.emit('user_status', {
        userId: socket.userId,
        isOnline: true,
        lastSeen: null,
      });
    } catch (e) {
      console.error('[socket-profile] set online error:', e.message);
    }

    socket.on('disconnect', async () => {
      console.log(`[socket-profile] User disconnected: ${socket.userId}`);
      const lastSeen = new Date();
      try {
        await User.findByIdAndUpdate(socket.userId, {
          isOnline: false,
          lastSeen,
        });
        socket.broadcast.emit('user_status', {
          userId: socket.userId,
          isOnline: false,
          lastSeen,
        });
      } catch (e) {
        console.error('[socket-profile] set offline error:', e.message);
      }
    });
  });

  return io;
}

function getIO() {
  return io;
}

function emitToUser(userId, event, data) {
  if (!io) return;
  io.to(`user:${String(userId)}`).emit(event, data);
}

module.exports = { initSocketIO, getIO, emitToUser };
