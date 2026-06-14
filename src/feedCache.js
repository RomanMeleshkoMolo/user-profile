// src/feedCache.js — инвалидация кеша ленты в user-feed
const FEED_SERVICE_URL = process.env.FEED_SERVICE_URL || 'http://localhost:5001';

// Сбрасывает весь кеш ленты/анкет в user-feed после массового
// пересчёта activityScore, который влияет на ранжирование всех пользователей
async function invalidateAllFeeds() {
  try {
    await fetch(`${FEED_SERVICE_URL}/internal/invalidate-all`, { method: 'POST' });
  } catch (e) {
    console.warn('[feedCache] invalidateAllFeeds failed:', e.message);
  }
}

module.exports = { invalidateAllFeeds };
