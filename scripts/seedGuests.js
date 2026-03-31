/**
 * seedGuests.js — создаёт 50 тестовых гостей из реальных юзеров Ленты
 *
 * Использование:
 *   node scripts/seedGuests.js <ownerId>
 *
 * Пример:
 *   node scripts/seedGuests.js 69c126d94060f2661dc486d2
 */

const mongoose = require('mongoose');
const GuestView = require('../models/guestViewModel');
const User = require('../models/userModel');

const MONGO_URI = 'mongodb://localhost:27017/users';

const OWNER_ID = process.argv[2];

if (!OWNER_ID) {
  console.error('Укажи ownerId: node scripts/seedGuests.js <ownerId>');
  process.exit(1);
}

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB connected');

  // Берём всех юзеров с фото, кроме владельца
  const users = await User.find(
    {
      _id: { $ne: new mongoose.Types.ObjectId(OWNER_ID) },
      'userPhoto.0': { $exists: true },
    },
    { _id: 1, name: 1, userPhoto: 1 }
  ).lean();

  if (users.length === 0) {
    console.error('Нет юзеров с фото в базе. Сначала запусти seedFeed.');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Найдено ${users.length} юзеров с фото`);

  // Очищаем старые записи гостей для этого владельца
  const deleted = await GuestView.deleteMany({ profileOwnerId: OWNER_ID });
  console.log(`Удалено старых записей: ${deleted.deletedCount}`);

  const docs = [];
  for (let i = 0; i < 50; i++) {
    const user = users[i % users.length];

    // Берём первое approved фото, или просто первое
    const photo =
      user.userPhoto.find((p) => p.status === 'approved')?.url ||
      user.userPhoto[0]?.url ||
      null;

    const viewedAt = new Date(Date.now() - i * 2 * 60 * 1000); // каждые 2 минуты назад

    // Уникальный viewerId для каждой записи чтобы обойти unique-индекс
    // (используем новый ObjectId, сохраняем имя/фото реального юзера)
    docs.push({
      viewerId: new mongoose.Types.ObjectId(),
      profileOwnerId: new mongoose.Types.ObjectId(OWNER_ID),
      viewerName: user.name || 'Пользователь',
      viewerPhoto: photo,
      viewedAt,
    });
  }

  const result = await GuestView.insertMany(docs);
  console.log(`✓ Создано ${result.length} записей гостей для owner: ${OWNER_ID}`);

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
