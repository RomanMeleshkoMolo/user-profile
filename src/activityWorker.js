// src/activityWorker.js — пересчитывает activityScore (0-100) для всех пользователей
// на основе активности за последние 7 дней: просмотры анкеты, отправленные сообщения, полученные лайки
const { likesConn, chatConn } = require('./db');
const User = require('../models/userModel');
const GuestView = require('../models/guestViewModel');
const { invalidateAllFeeds } = require('./feedCache');
const { notifyTopStatusEarned, notifyTopStatusLost } = require('./profileNotify');

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Порог activityScore, после которого анкета считается "в топе" (см. user-feed/feedController.js)
const ACTIVITY_TOP_THRESHOLD = 70;

// Веса: просмотры анкеты (до 50/нед → 40 баллов), сообщения (до 50/нед → 40 баллов), лайки (до 20/нед → 20 баллов)
const VIEWS_CAP = 50;
const VIEWS_WEIGHT = 40;
const MESSAGES_CAP = 50;
const MESSAGES_WEIGHT = 40;
const LIKES_CAP = 20;
const LIKES_WEIGHT = 20;

function computeActivityScore(views, messages, likes) {
  const viewsScore = Math.min(VIEWS_WEIGHT, (views / VIEWS_CAP) * VIEWS_WEIGHT);
  const messagesScore = Math.min(MESSAGES_WEIGHT, (messages / MESSAGES_CAP) * MESSAGES_WEIGHT);
  const likesScore = Math.min(LIKES_WEIGHT, (likes / LIKES_CAP) * LIKES_WEIGHT);
  return Math.round(viewsScore + messagesScore + likesScore);
}

function toCountMap(rows) {
  const map = new Map();
  rows.forEach((r) => map.set(String(r._id), r.count));
  return map;
}

async function recomputeActivityScores() {
  const since = new Date(Date.now() - SEVEN_DAYS_MS);
  const now = new Date();

  const [viewsAgg, messagesAgg, likesAgg, users] = await Promise.all([
    GuestView.aggregate([
      { $match: { viewedAt: { $gte: since } } },
      { $group: { _id: '$profileOwnerId', count: { $sum: 1 } } },
    ]),
    chatConn.db.collection('messages').aggregate([
      { $match: { createdAt: { $gte: since }, deletedForAll: { $ne: true } } },
      { $group: { _id: '$senderId', count: { $sum: 1 } } },
    ]).toArray(),
    likesConn.db.collection('likes').aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$toUser', count: { $sum: 1 } } },
    ]).toArray(),
    User.find({}, { _id: 1, activityScore: 1, boostUntil: 1 }).lean(),
  ]);

  const viewsMap = toCountMap(viewsAgg);
  const messagesMap = toCountMap(messagesAgg);
  const likesMap = toCountMap(likesAgg);

  const newlyTopUserIds = [];
  const lostTopUserIds = [];

  const ops = users.map((u) => {
    const id = String(u._id);
    const score = computeActivityScore(
      viewsMap.get(id) || 0,
      messagesMap.get(id) || 0,
      likesMap.get(id) || 0
    );
    const oldScore = u.activityScore || 0;
    const boosted = Boolean(u.boostUntil && new Date(u.boostUntil) > now);
    if (oldScore < ACTIVITY_TOP_THRESHOLD && score >= ACTIVITY_TOP_THRESHOLD) {
      newlyTopUserIds.push(id);
    } else if (oldScore >= ACTIVITY_TOP_THRESHOLD && score < ACTIVITY_TOP_THRESHOLD && !boosted) {
      // Если буст всё ещё активен — бейдж "Топ" остаётся, уведомлять о потере рано
      lostTopUserIds.push(id);
    }
    return {
      updateOne: {
        filter: { _id: u._id },
        update: { $set: { activityScore: score, activityUpdatedAt: now } },
      },
    };
  });

  if (ops.length) {
    await User.bulkWrite(ops, { ordered: false });
  }

  await invalidateAllFeeds();

  if (newlyTopUserIds.length) {
    await notifyTopStatusEarned(newlyTopUserIds);
  }
  if (lostTopUserIds.length) {
    await notifyTopStatusLost(lostTopUserIds);
  }

  console.log(`[ActivityWorker] Recomputed activityScore for ${ops.length} users`);
}

function startActivityWorker(intervalMs) {
  recomputeActivityScores().catch((e) => console.error('[ActivityWorker] error:', e.message));
  setInterval(() => {
    recomputeActivityScores().catch((e) => console.error('[ActivityWorker] error:', e.message));
  }, intervalMs);
}

module.exports = { startActivityWorker, recomputeActivityScores, computeActivityScore };