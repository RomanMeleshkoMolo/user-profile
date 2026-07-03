const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

// Сбрасываем isOnline у юзеров, чей lastSeen > STALE_THRESHOLD_MS.
// Первый запуск — только через STARTUP_DELAY (даём всем телефонам время переподключиться).
const STALE_CLEANUP_INTERVAL = 10 * 60 * 1000; // каждые 10 минут
const STALE_THRESHOLD_MS     = 15 * 60 * 1000; // порог: 15 минут без активности
const STARTUP_DELAY          = 15 * 60 * 1000; // первый cleanup не раньше 15 мин после старта

function startStaleOnlineCleanup(ioRef) {
  const runCleanup = async () => {
    try {
      const threshold = new Date(Date.now() - STALE_THRESHOLD_MS);
      const staleUsers = await User.find(
        { isOnline: true, lastSeen: { $lt: threshold } },
        { _id: 1 }
      ).lean();
      if (staleUsers.length === 0) return;

      const ids = staleUsers.map(u => u._id);
      await User.updateMany({ _id: { $in: ids } }, { isOnline: false });

      // Уведомляем подключённых клиентов
      if (ioRef()) {
        staleUsers.forEach(u => {
          ioRef().emit('user_status', { userId: String(u._id), isOnline: false, lastSeen: threshold });
        });
      }
      console.log(`[socket-profile] Stale cleanup: reset ${staleUsers.length} users`);
    } catch (e) {
      console.error('[socket-profile] stale cleanup error:', e.message);
    }
  };

  // Первый запуск через 15 минут, затем каждые 10 минут
  setTimeout(() => {
    runCleanup();
    setInterval(runCleanup, STALE_CLEANUP_INTERVAL);
  }, STARTUP_DELAY);
}

let io = null;

function initSocketIO(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        const allowed = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);
        if (allowed.length === 0 || allowed.includes(origin)) return cb(null, true);
        cb(new Error('CORS not allowed'));
      },
    },
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

    // ВАЖНО: присутствием (isOnline) теперь владеет ТОЛЬКО chat-сокет (user-sms)
    // через Redis-счётчик соединений. Здесь больше не пишем isOnline и не делаем
    // socket.broadcast.emit('user_status') — раньше это был fan-out ВСЕМ онлайн-
    // пользователям на каждый connect/disconnect (O(online) эмитов, шторм при 10k).
    // Клиент получает user_status от chat-сокета (адресно собеседникам), а лента
    // подмешивает свежий isOnline при загрузке (overlayOnlineStatus).

    // Heartbeat от клиента — обновляем lastSeen, чтобы активный, но «тихий»
    // пользователь не попал в stale-cleanup (сброс isOnline по старому lastSeen).
    socket.on('heartbeat', async () => {
      try {
        await User.findByIdAndUpdate(socket.userId, { lastSeen: new Date() });
      } catch (e) { /* игнорируем */ }
    });

    socket.on('disconnect', () => {
      console.log(`[socket-profile] User disconnected: ${socket.userId}`);
    });
  });

  startStaleOnlineCleanup(() => io);

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
