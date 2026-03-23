const mongoose = require('../src/db');

const guestViewSchema = new mongoose.Schema({
  viewerId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  profileOwnerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  viewerName:      { type: String, default: '' },
  viewerPhoto:     { type: String, default: null }, // первое фото/presigned URL
  viewedAt:        { type: Date, default: Date.now },
});

// Один гость — одна запись на владельца (upsert обновляет viewedAt)
guestViewSchema.index({ viewerId: 1, profileOwnerId: 1 }, { unique: true });
// Быстрый запрос гостей по владельцу профиля, сортировка по последнему визиту
guestViewSchema.index({ profileOwnerId: 1, viewedAt: -1 });

const GuestView = mongoose.models.GuestView || mongoose.model('GuestView', guestViewSchema);

module.exports = GuestView;
