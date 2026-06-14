// src/profileNotify.js — уведомление основного сервера user-profile о событиях,
// требующих push через Socket.IO (используется воркером пересчёта активности)
const PROFILE_SERVICE_URL = process.env.PROFILE_SERVICE_URL || 'http://localhost:4000';

async function notify(userIds, event) {
  try {
    await fetch(`${PROFILE_SERVICE_URL}/internal/notify-top-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds, event }),
    });
  } catch (e) {
    console.warn(`[profileNotify] notify(${event}) failed:`, e.message);
  }
}

function notifyTopStatusEarned(userIds) {
  return notify(userIds, 'top_status_earned');
}

function notifyTopStatusLost(userIds) {
  return notify(userIds, 'top_status_lost');
}

module.exports = { notifyTopStatusEarned, notifyTopStatusLost };
