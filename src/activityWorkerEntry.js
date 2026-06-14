// src/activityWorkerEntry.js — точка входа воркера пересчёта activityScore
require('dotenv').config();
const { authConn, profileConn, likesConn, chatConn } = require('./db');
const { startActivityWorker } = require('./activityWorker');

const INTERVAL_MS = 30 * 60 * 1000; // 30 минут

// Ждём подключения ко всем БД, иначе первый пересчёт сразу после старта упадёт
Promise.all([
  authConn.asPromise(),
  profileConn.asPromise(),
  likesConn.asPromise(),
  chatConn.asPromise(),
])
  .then(() => startActivityWorker(INTERVAL_MS))
  .catch((e) => console.error('[ActivityWorker] DB connection error:', e.message));