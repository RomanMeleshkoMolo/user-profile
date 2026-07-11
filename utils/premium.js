// Единый источник истины по премиуму: активен, пока premiumUntil в будущем.
// Булев premium в БД — лишь кэш для обратной совместимости и быстрых фильтров.

function isPremiumActive(user) {
  return Boolean(user?.premiumUntil && new Date(user.premiumUntil) > new Date());
}

// Выдача/продление премиума. Сюда приходят и покупки (webhook), и ручные кейсы поддержки.
// until — Date, до которой действует премиум.
async function grantPremium(User, userId, { until, source = 'manual', product = null } = {}) {
  return User.findByIdAndUpdate(
    userId,
    { premiumUntil: until, premium: true, premiumSource: source, premiumProduct: product },
    { new: true }
  );
}

// Немедленный отзыв премиума (истёк / возврат средств).
async function revokePremium(User, userId) {
  return User.findByIdAndUpdate(
    userId,
    { premiumUntil: null, premium: false },
    { new: true }
  );
}

module.exports = { isPremiumActive, grantPremium, revokePremium };
