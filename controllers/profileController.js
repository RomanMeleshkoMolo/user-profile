// server/controllers/profileController.js
const mongoose = require('mongoose');
const User = require('../models/userModel');
const GuestView = require('../models/guestViewModel');
const { emitToUser } = require('../src/socketManager');

const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { RekognitionClient, DetectModerationLabelsCommand } = require('@aws-sdk/client-rekognition');

const REGION = process.env.AWS_REGION || 'eu-north-1';
const BUCKET = process.env.S3_BUCKET || process.env.AWS_BUCKET || 'molo-user-photos';
const PRESIGNED_TTL_SEC = Number(process.env.S3_GET_TTL_SEC || 3600); // 1 час по умолчанию

const credentials = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
  ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY }
  : undefined;

const s3 = new S3Client({ region: REGION, credentials });

const REKOGNITION_REGION = process.env.AWS_REKOGNITION_REGION || REGION;
const MODERATION_THRESHOLD = Number(process.env.MODERATION_THRESHOLD || 80);
const BLOCKED_CATEGORIES = new Set([
  'Violence', 'Graphic Violence', 'Weapons', 'Hate Symbols',
  'Explicit Nudity', 'Sexual Activity', 'Sexual Content',
  'Visually Disturbing', 'Self-Harm', 'Drugs', 'Alcohol', 'Tobacco',
]);
const rekognition = new RekognitionClient({ region: REKOGNITION_REGION, credentials });

function getReqUserId(req) {
  return (
    req.user?._id ||
    req.user?.id ||
    req.auth?.userId ||
    req.regUserId ||
    req.userId
  );
}

async function getGetObjectUrl(key, expiresInSec = PRESIGNED_TTL_SEC) {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: expiresInSec });
}

const PRESIGNED_UPLOAD_TTL_SEC = Number(process.env.S3_PUT_TTL_SEC || 300); // 5 минут

async function getPutObjectUrl(key, contentType, expiresInSec = PRESIGNED_UPLOAD_TTL_SEC) {
  const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
  return getSignedUrl(s3, cmd, { expiresIn: expiresInSec });
}

// GET /profile/photos/upload-url — вернуть presigned PUT URL для загрузки фото в S3
async function getPhotoUploadUrl(req, res) {
  try {
    const userId = getReqUserId(req);
    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { filename, mimeType } = req.query;
    const ext = (filename || 'photo.jpg').split('.').pop().toLowerCase() || 'jpg';
    const key = `tmp/${String(userId)}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const contentType = mimeType || 'image/jpeg';

    const url = await getPutObjectUrl(key, contentType);
    return res.json({ url, key, bucket: BUCKET });
  } catch (e) {
    console.error('[profile GET upload-url] error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
}

function toSafeUser(user) {
  return {
    _id: user._id,
    id: user._id,
    name: user.name,
    age: user.age,
    email: user.email,
    gender: user.gender,
    interests: user.interests || [],
    education: user.education || '',
    lookingFor: user.lookingFor || '',
    about: user.about || '',
    work: user.work || '',
    wishUser: user.wishUser || null,
    userBirthday: user.userBirthday || null,
    userLocation: user.userLocation || null,
    userSex: user.userSex || null,
    zodiac: user.zodiac || '',
    languages: user.languages || [],
    children: user.children || '',
    pets: user.pets || [],
    smoking: user.smoking || '',
    alcohol: user.alcohol || '',
    relationship: user.relationship || '',
    onboardingComplete: user.onboardingComplete,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    photo: user.userPhoto || [],
  };
}

// GET /profile
async function getProfile(req, res) {
  try {

    // console.log("====profile====");

    const userId = getReqUserId(req);
    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(401).json({ message: 'Unauthorized: user id not found in request context' });
    }

    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    // console.log( user );
    // return res.json({ user: toSafeUser(user) });
    return res.json({ user: user });
  } catch (e) {
    console.error('[profile GET] error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
}

// PATCH /profile
async function updateProfile(req, res) {
  try {
    const userId = getReqUserId(req);
    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(401).json({ message: 'Unauthorized: user id not found in request context' });
    }

    const allowed = ['name', 'gender', 'age', 'userBirthday', 'wishUser', 'userLocation', 'interests', 'education', 'lookingFor', 'about', 'work', 'userSex', 'zodiac', 'languages', 'children', 'pets', 'smoking', 'alcohol', 'relationship'];
    const updates = {};
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }

    // interests — массив строк
    if ('interests' in updates) {
      const it = updates.interests;
      if (Array.isArray(it)) {
        updates.interests = it.map(v => String(v).trim()).filter(Boolean);
      } else {
        delete updates.interests;
      }
    }

    // languages — массив строк
    if ('languages' in updates) {
      const langs = updates.languages;
      if (Array.isArray(langs)) {
        updates.languages = langs.map(v => String(v).trim()).filter(Boolean);
      } else {
        delete updates.languages;
      }
    }

    // pets — массив строк
    if ('pets' in updates) {
      const p = updates.pets;
      if (Array.isArray(p)) {
        updates.pets = p.map(v => String(v).trim()).filter(Boolean);
      } else {
        delete updates.pets;
      }
    }

    // lookingFor — объект { id, title, icon } или null
    if ('lookingFor' in updates) {
      const lf = updates.lookingFor;
      if (lf && typeof lf === 'object' && lf.id && lf.title) {
        updates.lookingFor = {
          id: String(lf.id).trim(),
          title: String(lf.title).trim(),
          icon: lf.icon ? String(lf.icon).trim() : '',
        };
      } else if (lf === null || lf === '') {
        updates.lookingFor = null;
      } else {
        delete updates.lookingFor;
      }
    }

    const user = await User.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true,
    }).lean();

    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({ user: toSafeUser(user) });
  } catch (e) {
    console.error('[profile PATCH] error:', e);
    if (e && e.name === 'ValidationError') {
      return res.status(400).json({ message: e.message });
    }
    return res.status(500).json({ message: 'Server error' });
  }
}

// GET /profile/avatar — вернёт presigned URL для текущего аватара (берём первый в массиве либо первый approved)
async function getAvatar(req, res) {

  try {
    const userId = getReqUserId(req);
    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const photos = user.userPhoto || [];
    const avatar =
      photos.find((p) => p.status === 'approved' && p.key) ||
      photos.find((p) => p.key) ||
      null;

    if (!avatar) {
      return res.json({ avatar: null });
    }

    let url = avatar.url || null;
    if (avatar.key) {
      try { url = await getGetObjectUrl(avatar.key); } catch (_) {}
    }
    return res.json({
      avatar: {
        ...avatar,
        presignedUrl: url,
        url,
        bucket: avatar.bucket || BUCKET,
      },
    });
  } catch (e) {
    console.error('[profile GET avatar] error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
}

// PUT /profile/avatar — установить аватар по key (файл уже в S3). Опционально — поднять фото в начало массива.
async function updateAvatar(req, res) {
  try {
    const userId = getReqUserId(req);
    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { key } = req.body || {};
    if (!key || typeof key !== 'string') {
      return res.status(400).json({ message: 'key is required' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const idx = (user.userPhoto || []).findIndex((p) => p.key === key);
    if (idx === -1) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // Поднимем выбранное фото в начало массива как текущий аватар
    const [picked] = user.userPhoto.splice(idx, 1);
    user.userPhoto.unshift(picked);
    await user.save();

    const url = await getGetObjectUrl(picked.key);
    return res.json({
      avatar: { ...picked.toObject?.() || picked, presignedUrl: url, bucket: picked.bucket || BUCKET },
      photos: user.userPhoto,
    });
  } catch (e) {
    console.error('[profile PUT avatar] error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
}

// GET /profile/photos — вернуть approved + pending фото с presigned URL
async function getPhotos(req, res) {
  try {
    const userId = getReqUserId(req);
    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Возвращаем approved и pending — юзер видит свои фото сразу после загрузки
    const visiblePhotos = (user.userPhoto || []).filter(
      (p) => p.status === 'approved' || p.status === 'pending'
    );

    const photos = await Promise.all(
      visiblePhotos.map(async (p) => {
        let url = p.url || null;
        if (p.key) {
          try { url = await getGetObjectUrl(p.key); } catch (_) {}
        }
        return { ...p, bucket: p.bucket || BUCKET, url };
      })
    );

    return res.json({ photos });
  } catch (e) {
    console.error('[profile GET photos] error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
}

// Фоновая верификация фото (запускается после загрузки)
async function schedulePhotoVerification(userId, photoKeys) {
  // Даём 2 минуты перед проверкой — можно уменьшить/увеличить
  setTimeout(async () => {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      let changed = false;

      for (const key of photoKeys) {
        const photo = user.userPhoto.find((p) => p.key === key);
        if (!photo || photo.status !== 'pending') continue;

        // TODO: подключить реальную верификацию (AWS Rekognition, Azure Content Moderator и т.д.)
        // Пример: const passed = await rekognitionCheck(key);
        const passed = await verifyPhoto(key);

        if (passed) {
          photo.status = 'approved';
        } else {
          // Фото не прошло — тихо удаляем
          user.userPhoto = user.userPhoto.filter((p) => p.key !== key);
        }
        changed = true;
      }

      if (changed) await user.save();
    } catch (e) {
      console.error('[photoVerification] error:', e);
    }
  }, 2 * 60 * 1000); // 2 минуты
}

// Верификация фото через AWS Rekognition (те же credentials, что в user-service)
async function verifyPhoto(photoKey) {
  try {
    const resp = await rekognition.send(new DetectModerationLabelsCommand({
      Image: { S3Object: { Bucket: BUCKET, Name: photoKey } },
      MinConfidence: MODERATION_THRESHOLD,
    }));

    const labels = Array.isArray(resp?.ModerationLabels) ? resp.ModerationLabels : [];
    const blocked = labels.filter(l => {
      const name = l.Name || '';
      const parent = l.ParentName || '';
      return (l.Confidence || 0) >= MODERATION_THRESHOLD &&
        (BLOCKED_CATEGORIES.has(name) || BLOCKED_CATEGORIES.has(parent));
    });

    if (blocked.length > 0) {
      console.warn('[verifyPhoto] blocked labels for key:', photoKey, blocked.map(l => l.Name));
    }

    return blocked.length === 0; // true = прошло, false = нарушение
  } catch (e) {
    console.error('[verifyPhoto] Rekognition error:', e?.message || e);
    return true; // при ошибке сети/AWS — не удаляем фото
  }
}

// POST /profile/photos — принять метаданные уже загруженных в S3 фото и сохранить их в БД
// body: { photos: [{ key, filename, mimeType, size }] }
async function addPhoto(req, res) {
  try {
    const userId = getReqUserId(req);
    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { photos } = req.body || {};
    if (!Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({ message: 'photos array is required' });
    }

    const normalized = photos
      .filter(Boolean)
      .map((p) => ({
        key: String(p.key),
        bucket: p.bucket || BUCKET,
        url: undefined,
        status: 'pending', // ждёт верификации, станет 'approved' после проверки
        reason: undefined,
        moderation: [],
        faceCount: undefined,
        width: undefined,
        height: undefined,
        format: p.mimeType ? p.mimeType.split('/')[1] : undefined,
        createdAt: new Date(),
      }));

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.userPhoto = user.userPhoto || [];
    user.userPhoto.push(...normalized);

    await user.save();

    // Запускаем фоновую верификацию (не блокирует ответ)
    const newKeys = normalized.map((p) => p.key);
    schedulePhotoVerification(userId, newKeys);

    const enriched = await Promise.all(
      user.userPhoto
        .filter((p) => p.status === 'approved' || p.status === 'pending')
        .map(async (p) => ({
          ...p.toObject?.() || p,
          bucket: p.bucket || BUCKET,
          url: await getGetObjectUrl(p.key),
        }))
    );

    return res.status(201).json({ photos: enriched, user: toSafeUser(user.toObject?.() || user) });
  } catch (e) {
    console.error('[profile POST photos] error:', e);
    if (e && e.name === 'ValidationError') {
      return res.status(400).json({ message: e.message });
    }
    return res.status(500).json({ message: 'Server error' });
  }
}

// DELETE /profile — удаление аккаунта пользователя
async function deleteProfile(req, res) {
  try {
    const userId = getReqUserId(req);
    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(401).json({ message: 'Unauthorized: user id not found' });
    }

    console.log('[profile DELETE] удаляем пользователя с ID:', userId);

    const deletedUser = await User.findByIdAndDelete(userId);

    if (!deletedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('[profile DELETE] пользователь успешно удален:', deletedUser._id);

    return res.json({ success: true, message: 'Account deleted successfully' });
  } catch (e) {
    console.error('[profile DELETE] error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
}

// DELETE /profile/photos/:photoId — photoId = key в S3
async function removePhoto(req, res) {
  try {
    const userId = getReqUserId(req);
    const { photoId } = req.params;
    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!photoId) {
      return res.status(400).json({ message: 'photoId is required' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const before = user.userPhoto?.length || 0;
    user.userPhoto = (user.userPhoto || []).filter((p) => p.key !== photoId);
    const after = user.userPhoto.length;

    if (before === after) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    await user.save();

    const photos = await Promise.all(
      user.userPhoto.map(async (p) => ({
        ...p.toObject?.() || p,
        bucket: p.bucket || BUCKET,
        presignedUrl: await getGetObjectUrl(p.key),
      }))
    );

    return res.json({ success: true, photos });
  } catch (e) {
    console.error('[profile DELETE photo] error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
}

/**
 * POST /profile/view/:ownerId
 * Записывает просмотр профиля. Не считает самопросмотры.
 */
async function recordProfileView(req, res) {
  try {
    const viewerId = String(getReqUserId(req));
    const { ownerId } = req.params;

    if (!ownerId || !mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({ message: 'Invalid ownerId' });
    }

    // Самопросмотр не считаем
    if (viewerId === ownerId) {
      return res.json({ ok: true });
    }

    // Получаем данные смотрящего (имя + пол + первое фото)
    const viewer = await User.findById(viewerId).select('name gender userPhoto').lean();
    const rawPhoto = viewer?.userPhoto?.[0];
    let viewerPhoto = null;

    if (rawPhoto) {
      if (rawPhoto.key) {
        // S3 presigned URL
        try {
          const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: rawPhoto.key });
          viewerPhoto = await getSignedUrl(s3, cmd, { expiresIn: PRESIGNED_TTL_SEC });
        } catch (_) {}
      } else if (rawPhoto.url) {
        viewerPhoto = rawPhoto.url;
      }
    }

    const viewerGender = viewer?.gender?.id || '';

    // Проверяем был ли этот юзер уже гостем раньше
    const existingGuest = await GuestView.findOne({
      viewerId: new mongoose.Types.ObjectId(viewerId),
      profileOwnerId: new mongoose.Types.ObjectId(ownerId),
    }).lean();
    const isFirstVisit = !existingGuest;

    // Upsert: один гость → одна запись, обновляем viewedAt и фото
    await GuestView.findOneAndUpdate(
      { viewerId: new mongoose.Types.ObjectId(viewerId), profileOwnerId: new mongoose.Types.ObjectId(ownerId) },
      { viewedAt: new Date(), viewerName: viewer?.name || '', viewerPhoto, viewerGender },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Уведомляем владельца профиля только при первом визите
    if (isFirstVisit) {
      emitToUser(ownerId, 'new_guest', {
        viewerId,
        viewerName: viewer?.name || '',
        viewerPhoto,
        viewerGender,
      });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error('[profile] recordProfileView error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
}

/**
 * GET /profile/guests
 * Возвращает список гостей для текущего пользователя (макс. 100, по убыванию даты).
 */
async function getGuests(req, res) {
  try {
    const userId = getReqUserId(req);

    const guests = await GuestView.find({ profileOwnerId: new mongoose.Types.ObjectId(String(userId)) })
      .sort({ viewedAt: -1 })
      .limit(100)
      .lean();

    return res.json({
      count: guests.length,
      guests: guests.map(g => ({
        _id:          g._id,
        viewerId:     g.viewerId,
        viewerName:   g.viewerName,
        viewerPhoto:  g.viewerPhoto,
        viewerGender: g.viewerGender || '',
        viewedAt:     g.viewedAt,
      })),
    });
  } catch (e) {
    console.error('[profile] getGuests error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
}

// GET /profile/user/:userId — публичный профиль другого пользователя
async function getPublicProfile(req, res) {
  try {
    const requesterId = getReqUserId(req);
    if (!requesterId) return res.status(401).json({ message: 'Unauthorized' });

    const { userId } = req.params;
    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const approvedPhotos = (user.userPhoto || []).filter(p => p.status === 'approved');
    const photoUrls = await Promise.all(
      approvedPhotos.map(p => getGetObjectUrl(p.key))
    );

    return res.json({
      _id: user._id,
      id: user._id,
      name: user.name,
      age: user.age,
      gender: user.gender,
      userSex: user.userSex || null,
      userLocation: user.userLocation || null,
      about: user.about || '',
      work: user.work || '',
      interests: user.interests || [],
      education: user.education || '',
      lookingFor: user.lookingFor || '',
      wishUser: user.wishUser || null,
      zodiac: user.zodiac || '',
      languages: user.languages || [],
      children: user.children || '',
      pets: user.pets || [],
      smoking: user.smoking || '',
      alcohol: user.alcohol || '',
      relationship: user.relationship || '',
      isOnline: user.isOnline || false,
      photoUrls,
    });
  } catch (e) {
    console.error('[profile GET public] error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
}

const DAY_LABELS_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

// Локальная дата в формате YYYY-MM-DD (без конвертации в UTC)
const localDateStr = (d) => {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * GET /profile/stats/views
 * Уникальные посетители за каждый из последних 7 дней + статус активности.
 */
async function getActivityStats(req, res) {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const ownerId = new mongoose.Types.ObjectId(String(userId));
    const now = new Date();

    // Формируем 7 дневных бакетов: сегодня и 6 дней назад
    const buckets = [];
    for (let i = 6; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(start.getDate() - i);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      buckets.push({ start, end });
    }

    const likesCol = mongoose.connection.db.collection('likes');

    const [dayCounts, dayLikes, total] = await Promise.all([
      Promise.all(
        buckets.map(({ start, end }) =>
          GuestView.countDocuments({ profileOwnerId: ownerId, viewedAt: { $gte: start, $lt: end } })
        )
      ),
      Promise.all(
        buckets.map(({ start, end }) =>
          likesCol.countDocuments({ toUser: ownerId, createdAt: { $gte: start, $lt: end } })
        )
      ),
      GuestView.countDocuments({ profileOwnerId: ownerId }),
    ]);

    const days = buckets.map(({ start }, i) => ({
      date:  localDateStr(start),  // локальная дата, не UTC
      label: DAY_LABELS_RU[start.getDay()],
      count: dayCounts[i],
      likes: dayLikes[i],
    }));

    const todayCount = dayCounts[dayCounts.length - 1];
    let status;
    if (todayCount >= 200)     status = 'все звезды отдыхают!';
    else if (todayCount >= 50) status = 'популярен';
    else if (todayCount >= 20) status = 'высокая';
    else if (todayCount >= 5)  status = 'средняя';
    else                       status = 'низкая';

    return res.json({ days, total, status });
  } catch (e) {
    console.error('[profile] getActivityStats error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  getProfile,
  updateProfile,
  deleteProfile,
  getAvatar,
  updateAvatar,
  getPhotos,
  addPhoto,
  removePhoto,
  getPhotoUploadUrl,
  recordProfileView,
  getGuests,
  getPublicProfile,
  getActivityStats,
};
