// Admin-эндпоинты для ручного управления премиумом (служба поддержки).
//
// Аутентификация — секрет в заголовке x-admin-secret (сверяется с ADMIN_API_SECRET).
// НЕ используем пользовательский JWT: это операции «от лица администратора».
//
// Типичный кейс: юзер написал «оплатил месяц, премиум слетел, осталось 2 недели» →
// поддержка находит его по email и выдаёт премиум на нужный срок:
//   POST /profile/admin/premium { "email": "u@x.com", "days": 14 }
//
// ENV:
//   ADMIN_API_SECRET — общий секрет для админ-операций
//
// ВАЖНО: этот роут доступен через nginx (/profile/*). Секрет должен быть длинным и
// секретным; при желании дополнительно ограничь путь /profile/admin/* на уровне nginx.

const mongoose = require('mongoose');
const User = require('../models/userModel');
const { grantPremium, revokePremium, isPremiumActive } = require('../utils/premium');

const DAY_MS = 24 * 60 * 60 * 1000;

function checkAdmin(req) {
  const secret = process.env.ADMIN_API_SECRET;
  return Boolean(secret) && req.get('x-admin-secret') === secret;
}

// Поиск юзера по _id или email (из body или query)
async function findUser(src) {
  if (src?.userId && mongoose.Types.ObjectId.isValid(String(src.userId))) {
    return User.findById(src.userId).select('_id email premiumUntil premiumSource premiumProduct').lean();
  }
  if (src?.email) {
    return User.findOne({ email: String(src.email).toLowerCase().trim() })
      .select('_id email premiumUntil premiumSource premiumProduct').lean();
  }
  return null;
}

function statusOf(user) {
  return {
    userId: user._id,
    email: user.email || null,
    active: isPremiumActive(user),
    premiumUntil: user.premiumUntil || null,
    premiumSource: user.premiumSource || null,
    premiumProduct: user.premiumProduct || null,
  };
}

// GET /profile/admin/premium?userId=... | ?email=...  — проверить статус
async function getPremiumStatus(req, res) {
  if (!checkAdmin(req)) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const user = await findUser(req.query);
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json(statusOf(user));
  } catch (e) {
    console.error('[admin] getPremiumStatus error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
}

// POST /profile/admin/premium — выдать/продлить/отозвать премиум
// body: { userId? | email?, days? | until?, revoke?, source?, product? }
async function setPremium(req, res) {
  if (!checkAdmin(req)) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const { revoke, days, until, source = 'manual', product = 'support' } = req.body || {};
    const user = await findUser(req.body);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (revoke) {
      await revokePremium(User, user._id);
      console.log(`[admin] premium revoked user=${user._id}`);
      return res.json({ ok: true, ...statusOf({ ...user, premiumUntil: null }) });
    }

    let untilDate;
    if (until != null) {
      // Точная дата окончания
      untilDate = new Date(until);
      if (isNaN(untilDate.getTime())) {
        return res.status(400).json({ message: 'Invalid "until" date' });
      }
    } else if (days != null) {
      // Продление на N дней: если премиум ещё активен — от текущей даты окончания,
      // иначе — от сейчас (корректная семантика «добавить N дней»).
      const n = Number(days);
      if (!Number.isFinite(n) || n <= 0) {
        return res.status(400).json({ message: 'Invalid "days"' });
      }
      const base = isPremiumActive(user) ? new Date(user.premiumUntil) : new Date();
      untilDate = new Date(base.getTime() + n * DAY_MS);
    } else {
      return res.status(400).json({ message: 'Provide "days", "until" or "revoke"' });
    }

    const updated = await grantPremium(User, user._id, { until: untilDate, source, product });
    console.log(`[admin] premium granted user=${user._id} until=${untilDate.toISOString()} (${source})`);
    return res.json({ ok: true, ...statusOf(updated) });
  } catch (e) {
    console.error('[admin] setPremium error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = { getPremiumStatus, setPremium };
