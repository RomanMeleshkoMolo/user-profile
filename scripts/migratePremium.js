/**
 * Одноразовая миграция премиума: булев premium → premiumUntil (дата).
 *
 * Что делает (идемпотентно, можно запускать повторно):
 *   1) premium:true без premiumUntil  → выдаёт grace-окно (GRACE_DAYS), чтобы
 *      действующие премиум-юзеры не потеряли доступ до подключения RevenueCat.
 *   2) premium:false, но premiumUntil заполнен → чистит premiumUntil (рассинхрон).
 *
 * Источник правды после миграции — premiumUntil. Булев premium остаётся как кэш
 * и пересчитывается на чтении в profileController.
 *
 * Использование:
 *   node scripts/migratePremium.js            # боевой прогон
 *   node scripts/migratePremium.js --dry-run  # только показать, ничего не менять
 *   GRACE_DAYS=14 node scripts/migratePremium.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { authConn } = require('../src/db');
const User = require('../models/userModel');

const GRACE_DAYS = Number(process.env.GRACE_DAYS || 30);
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  await authConn.asPromise();
  console.log(`✅ Connected to molo_auth${DRY_RUN ? '  (DRY-RUN)' : ''}`);

  const now = new Date();
  const graceUntil = new Date(now.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000);

  // 1) Действующие премиумы без даты → grace-окно
  const toGrant = { premium: true, $or: [{ premiumUntil: null }, { premiumUntil: { $exists: false } }] };
  const grantCount = await User.countDocuments(toGrant);

  // 2) premium:false с висящей датой → зачистка
  const toClear = { premium: false, premiumUntil: { $ne: null } };
  const clearCount = await User.countDocuments(toClear);

  console.log(`\nНайдено:`);
  console.log(`  • premium:true без даты  → выдать grace до ${graceUntil.toISOString()} (${GRACE_DAYS} дн): ${grantCount}`);
  console.log(`  • premium:false с датой  → очистить premiumUntil: ${clearCount}\n`);

  if (DRY_RUN) {
    console.log('DRY-RUN: изменения не применены.');
    await authConn.close();
    return;
  }

  const r1 = await User.updateMany(toGrant, {
    $set: { premiumUntil: graceUntil, premiumSource: 'manual', premiumProduct: 'legacy' },
  });
  const r2 = await User.updateMany(toClear, { $set: { premiumUntil: null } });

  console.log(`✅ Готово. grace выдан: ${r1.modifiedCount}, очищено: ${r2.modifiedCount}`);
  await authConn.close();
}

main().catch(async (e) => {
  console.error('❌ Migration error:', e);
  try { await authConn.close(); } catch (_) {}
  process.exit(1);
});