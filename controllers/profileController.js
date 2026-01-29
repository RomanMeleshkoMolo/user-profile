// server/controllers/profileController.js
const mongoose = require('mongoose');
const User = require('../models/userModel');

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const REGION = process.env.AWS_REGION || 'eu-north-1';
const BUCKET = process.env.AWS_BUCKET || 'uploads-photo';
const PRESIGNED_TTL_SEC = Number(process.env.S3_GET_TTL_SEC || 3600); // 1 час по умолчанию

const s3 = new S3Client({
  region: REGION,
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

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

function toSafeUser(user) {
  return {
    _id: user._id,
    id: user._id,
    name: user.name,
    age: user.age,
    email: user.email,
    gender: user.gender,
    interests: user.interests || null,
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

    const allowed = ['name', 'gender', 'age', 'userBirthday', 'wishUser', 'userLocation', 'interests'];
    const updates = {};
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }

    if ('interests' in updates) {
      const it = updates.interests;
      if (!it || typeof it !== 'object' || !it.title || !String(it.title).trim()) {
        delete updates.interests;
      } else {
        updates.interests = { title: String(it.title).trim(), icon: it.icon || '' };
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
      photos.find((p) => p.status === 'approved') ||
      photos ||
      null;

    if (!avatar) {
      return res.json({ avatar: null });
    }

    const url = await getGetObjectUrl(avatar.key);
    return res.json({
      avatar: {
        ...avatar,
        presignedUrl: url,
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

// GET /profile/photos — вернуть список фото с presigned URL для каждого
async function getPhotos(req, res) {

  console.log("===== photos =======");

  try {
    const userId = getReqUserId(req);
    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Берём только approved-фото
    const approvedPhotos = (user.userPhoto || []).filter(
      (p) => p.status === 'approved'
    );

     const photos = await Promise.all(
      approvedPhotos.map(async (p) => ({
        ...p,
        bucket: p.bucket || BUCKET,
        presignedUrl: await getGetObjectUrl(p.key),
      }))
    );

    console.log( photos );

    return res.json({ photos });
  } catch (e) {
    console.error('[profile GET photos] error:', e);
    return res.status(500).json({ message: 'Server error' });
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
        url: undefined, // если бакет приватный — url можно не хранить
        status: 'approved', // или 'pending' если нужна модерация
        reason: undefined,
        moderation: [],
        faceCount: undefined,
        width: undefined,
        height: undefined,
        format: (p.mimeType || '').split('/') || undefined,
        createdAt: new Date(),
      }));

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.userPhoto = user.userPhoto || [];
    user.userPhoto.push(...normalized);

    await user.save();

    const enriched = await Promise.all(
      user.userPhoto.map(async (p) => ({
        ...p.toObject?.() || p,
        bucket: p.bucket || BUCKET,
        presignedUrl: await getGetObjectUrl(p.key),
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

module.exports = {
  getProfile,
  updateProfile,
  deleteProfile,
  getAvatar,
  updateAvatar,
  getPhotos,
  addPhoto,
  removePhoto,
};
