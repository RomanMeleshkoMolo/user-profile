const mongoose = require('mongoose');
const { profileConn } = require('../src/db');

const guestViewSchema = new mongoose.Schema({
  viewerId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  profileOwnerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  viewerName:      { type: String, default: '' },
  // Внешний URL фото (для не-S3 источников) или legacy-значение.
  viewerPhoto:     { type: String, default: null },
  // S3-ключ фото гостя. presigned URL генерируется заново при чтении (getGuests) —
  // хранить готовый presigned URL нельзя: TTL 1 час, а гостей смотрят позже → 403.
  viewerPhotoKey:  { type: String, default: null },
  viewerGender:    { type: String, default: '' },
  viewedAt:        { type: Date, default: Date.now },
});

// Один гость — одна запись на владельца (upsert обновляет viewedAt)
guestViewSchema.index({ viewerId: 1, profileOwnerId: 1 }, { unique: true });
// Быстрый запрос гостей по владельцу профиля, сортировка по последнему визиту
guestViewSchema.index({ profileOwnerId: 1, viewedAt: -1 });

const GuestView = profileConn.models.GuestView || profileConn.model('GuestView', guestViewSchema);

module.exports = GuestView;
