/**
 * Seed script: заполняет GuestView и likes тестовыми данными за последние 7 дней.
 *
 * Использование:
 *   node scripts/seedActivityStats.js [profileOwnerId]
 *   node scripts/seedActivityStats.js [profileOwnerId] --clean
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
// Используем тот же инстанс mongoose что и модели (через src/db.js)
const mongoose = require('../src/db');
const GuestView = require('../models/guestViewModel');
const User      = require('../models/userModel');

// Посетители и лайки на каждый из 7 дней (сегодня последний)
const COUNTS_PER_DAY = [2, 7, 4, 11, 6, 13, 3];
const LIKES_PER_DAY  = [1, 3, 2,  5, 3,  6, 1];

const DAY_LABELS_RU = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const pad = n => String(n).padStart(2, '0');
const localDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

async function main() {
  // src/db.js уже вызывает mongoose.connect при require, ждём готовности
  await mongoose.connection.asPromise();
  console.log('✅ Connected to MongoDB\n');

  const args = process.argv.slice(2);
  const clean = args.includes('--clean');
  const ownerIdArg = args.find(a => !a.startsWith('--'));

  let ownerId;
  if (ownerIdArg) {
    ownerId = new mongoose.Types.ObjectId(ownerIdArg);
    console.log(`👤 Using profileOwnerId: ${ownerId}`);
  } else {
    const firstUser = await User.findOne().select('_id name').lean();
    if (!firstUser) {
      console.error('❌ No users found in DB. Provide profileOwnerId as argument.');
      process.exit(1);
    }
    ownerId = firstUser._id;
    console.log(`👤 Using first user: ${firstUser.name} (${ownerId})`);
  }

  const likesCol = mongoose.connection.db.collection('likes');

  if (clean) {
    const [del1, del2] = await Promise.all([
      GuestView.deleteMany({ profileOwnerId: ownerId }),
      likesCol.deleteMany({ toUser: ownerId, viewerName: /^TestUser_/ }),
    ]);
    console.log(`🗑  Removed ${del1.deletedCount} guest records, ${del2.deletedCount} like records\n`);
  }

  const now = new Date();
  let totalGuests = 0;
  let totalLikes  = 0;

  for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - dayOffset);
    dayStart.setHours(0, 0, 0, 0);

    const visitorCount = COUNTS_PER_DAY[6 - dayOffset];
    const likeCount    = LIKES_PER_DAY[6 - dayOffset];
    const dateStr = localDateStr(dayStart);
    const dayName = DAY_LABELS_RU[dayStart.getDay()];

    // Гости
    const guestOps = [];
    for (let j = 0; j < visitorCount; j++) {
      const viewerId = new mongoose.Types.ObjectId();
      const viewedAt = new Date(dayStart);
      viewedAt.setSeconds(Math.floor(Math.random() * 86400));
      guestOps.push({
        updateOne: {
          filter: { viewerId, profileOwnerId: ownerId },
          update: { $set: { viewedAt, viewerName: `TestUser_${j}`, viewerGender: j % 2 === 0 ? 'female' : 'male', viewerPhoto: null } },
          upsert: true,
        },
      });
    }
    await GuestView.bulkWrite(guestOps, { ordered: false });

    // Лайки
    const likeDocs = [];
    for (let j = 0; j < likeCount; j++) {
      const fromUser = new mongoose.Types.ObjectId();
      const createdAt = new Date(dayStart);
      createdAt.setSeconds(Math.floor(Math.random() * 86400));
      likeDocs.push({ fromUser, toUser: ownerId, status: 'pending', createdAt, updatedAt: createdAt });
    }
    await likesCol.insertMany(likeDocs);

    totalGuests += visitorCount;
    totalLikes  += likeCount;
    console.log(`📅 ${dateStr} (${dayName}) → ${visitorCount} посетителей, ${likeCount} лайков`);
  }

  console.log(`\n✅ Inserted ${totalGuests} guest records, ${totalLikes} like records`);

  // Preview endpoint response
  console.log('\n📊 Preview /profile/stats/views:');
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(start.getDate() - i);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const [count, likes] = await Promise.all([
      GuestView.countDocuments({ profileOwnerId: ownerId, viewedAt: { $gte: start, $lt: end } }),
      likesCol.countDocuments({ toUser: ownerId, createdAt: { $gte: start, $lt: end } }),
    ]);
    days.push({ date: localDateStr(start), label: DAY_LABELS_RU[start.getDay()], count, likes });
  }
  const total = await GuestView.countDocuments({ profileOwnerId: ownerId });

  const todayCount = days[days.length - 1].count;
  const status =
    todayCount >= 200 ? 'все звезды отдыхают!' :
    todayCount >= 50  ? 'популярен' :
    todayCount >= 20  ? 'высокая' :
    todayCount >= 5   ? 'средняя' : 'низкая';

  console.log(JSON.stringify({ days, total, status }, null, 2));

  await mongoose.connection.close();
  console.log('\n👋 Done');
}

main().catch(e => { console.error(e); process.exit(1); });
