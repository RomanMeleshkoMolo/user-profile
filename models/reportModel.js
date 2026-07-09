const mongoose = require('mongoose');
const { authConn } = require('../src/db');

// Жалобы пользователей — обязательный механизм для ревью Google Play / App Store.
// Просмотр: коллекция reports в molo_auth (админки пока нет).
const reportSchema = new mongoose.Schema({
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reportedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reason: { type: String, required: true },       // fake | offensive | underage | scam | spam | abuse
  subReason: { type: String, default: null },
  status: { type: String, enum: ['new', 'reviewed', 'actioned'], default: 'new', index: true },
  createdAt: { type: Date, default: Date.now },
});

// Один юзер может пожаловаться на другого несколько раз (разные причины) — не уникалим.
module.exports = authConn.model('Report', reportSchema);
