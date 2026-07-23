// Единый источник истины по премиуму: активен, пока premiumUntil в будущем.
// Булев premium в БД — лишь кэш для обратной совместимости и быстрых фильтров.

function isPremiumActive(user) {
  return Boolean(user?.premiumUntil && new Date(user.premiumUntil) > new Date());
}

// Инкогнито — премиум-фича: тумблер forceIncognito работает, только пока премиум активен.
// Читать флаг напрямую нельзя — после истечения премиума он ещё висит в БД до синка.
function isIncognitoActive(user) {
  return Boolean(user?.forceIncognito) && isPremiumActive(user);
}

// Ленивый сброс премиум-состояния на чтении: премиум истёк → возвращаем юзера
// в допремиумный статус (снимаем кэш premium и все премиум-онли тумблеры).
// Мутирует переданный объект (lean/документ), чтобы вызывающий код сразу видел
// свежие значения, и в фоне гасит их в БД. Возвращает true, если что-то менялось.
async function syncPremiumExpiry(User, user) {
  if (!user || isPremiumActive(user)) return false;
  if (!user.premium && !user.forceIncognito) return false;

  user.premium = false;
  user.forceIncognito = false;
  try {
    await User.updateOne({ _id: user._id }, { $set: { premium: false, forceIncognito: false } });
  } catch (e) {
    console.error('[premium] syncPremiumExpiry error:', e);
  }
  return true;
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
// Вместе с премиумом снимаем и премиум-онли тумблеры — юзер возвращается
// в то же состояние, в котором был до покупки.
async function revokePremium(User, userId) {
  return User.findByIdAndUpdate(
    userId,
    { premiumUntil: null, premium: false, forceIncognito: false },
    { new: true }
  );
}

module.exports = { isPremiumActive, isIncognitoActive, syncPremiumExpiry, grantPremium, revokePremium };
