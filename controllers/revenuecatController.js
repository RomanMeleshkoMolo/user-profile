// RevenueCat webhook — источник правды по подпискам.
// RevenueCat шлёт сюда события покупок/продлений/истечений. Мы зеркалим их в
// premiumUntil через grantPremium/revokePremium.
//
// ВАЖНО про идентификацию: на клиенте при логине вызывается Purchases.logIn(userId),
// где userId — это Mongo _id пользователя. Поэтому event.app_user_id === user._id.
//
// Настройка в дашборде RevenueCat → Integrations → Webhooks:
//   URL:            https://<домен>/profile/webhooks/revenuecat
//   Authorization:  значение из REVENUECAT_WEBHOOK_SECRET (шлётся как заголовок Authorization)
//
// ENV:
//   REVENUECAT_WEBHOOK_SECRET   — общий секрет для проверки заголовка Authorization
//   REVENUECAT_ENTITLEMENT_ID   — id entitlement премиума (по умолчанию 'premium')

const mongoose = require('mongoose');
const User = require('../models/userModel');
const { grantPremium, revokePremium } = require('../utils/premium');

const ENTITLEMENT_ID = process.env.REVENUECAT_ENTITLEMENT_ID || 'premium';

// События, которые выдают/продлевают доступ (у всех есть expiration_at_ms в будущем)
const GRANT_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'SUBSCRIPTION_EXTENDED',
  'NON_RENEWING_PURCHASE',
]);

// Событие фактического истечения → отзыв
const REVOKE_TYPES = new Set(['EXPIRATION']);
// CANCELLATION (выключил автопродление) и BILLING_ISSUE НЕ отзывают доступ:
// он действует до уже сохранённого premiumUntil. Их пропускаем.

// «Навсегда» (lifetime / разовая покупка) не имеет даты окончания —
// ставим premiumUntil в далёкое будущее.
const LIFETIME_UNTIL = new Date('9999-01-01T00:00:00.000Z');

function storeToSource(store) {
  if (store === 'APP_STORE' || store === 'MAC_APP_STORE') return 'apple';
  if (store === 'PLAY_STORE') return 'google';
  return 'revenuecat';
}

// Относится ли событие к нашему premium-entitlement (если RevenueCat прислал список)
function matchesEntitlement(event) {
  const ids = event.entitlement_ids
    || (event.entitlement_id ? [event.entitlement_id] : null);
  if (!ids || ids.length === 0) return true; // нет данных — не фильтруем
  return ids.includes(ENTITLEMENT_ID);
}

async function revenuecatWebhook(req, res) {
  try {
    // 1) Проверка секрета (RevenueCat шлёт его в заголовке Authorization как есть)
    const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
    if (!secret || req.get('authorization') !== secret) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const event = req.body?.event;
    if (!event || !event.type) {
      return res.status(400).json({ message: 'Bad payload' });
    }

    const type = event.type;
    const appUserId = event.app_user_id;

    // Не наш entitlement — игнорируем, но подтверждаем (иначе RC будет ретраить)
    if (!matchesEntitlement(event)) {
      return res.status(200).json({ ok: true, ignored: 'entitlement' });
    }

    // app_user_id должен быть валидным Mongo _id (мы логинимся в RC под _id)
    if (!appUserId || !mongoose.Types.ObjectId.isValid(String(appUserId))) {
      console.warn('[revenuecat] non-mongo app_user_id, skip:', appUserId, type);
      return res.status(200).json({ ok: true, ignored: 'app_user_id' });
    }

    if (GRANT_TYPES.has(type)) {
      const expMs = event.expiration_at_ms;
      let until;
      if (expMs) {
        until = new Date(expMs);
      } else if (type === 'NON_RENEWING_PURCHASE') {
        // Lifetime / разовая покупка — нет даты окончания
        until = LIFETIME_UNTIL;
      } else {
        console.warn('[revenuecat] grant event without expiration_at_ms:', type, appUserId);
        return res.status(200).json({ ok: true, ignored: 'no_expiration' });
      }
      const updated = await grantPremium(User, appUserId, {
        until,
        source: storeToSource(event.store),
        product: event.product_id || null,
      });
      if (!updated) {
        console.warn('[revenuecat] user not found for grant:', appUserId);
        return res.status(200).json({ ok: true, ignored: 'user_not_found' });
      }
      console.log(`[revenuecat] ${type} → premium до ${until.toISOString()} user=${appUserId}`);
      return res.status(200).json({ ok: true });
    }

    if (REVOKE_TYPES.has(type)) {
      await revokePremium(User, appUserId);
      console.log(`[revenuecat] ${type} → premium отозван user=${appUserId}`);
      return res.status(200).json({ ok: true });
    }

    // CANCELLATION / BILLING_ISSUE / TRANSFER / TEST и прочее — просто подтверждаем
    return res.status(200).json({ ok: true, ignored: type });
  } catch (e) {
    console.error('[revenuecat] webhook error:', e);
    // 500 → RevenueCat повторит доставку (события идемпотентны)
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = { revenuecatWebhook };
