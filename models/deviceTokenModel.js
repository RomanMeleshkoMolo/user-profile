const mongoose = require('mongoose');
const { authConn } = require('../src/db');

/**
 * DeviceToken - Модель FCM токенов устройств.
 * Коллекция общая для всех сервисов, живёт в molo_auth (authConn).
 */
const deviceTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  fcmToken: {
    type: String,
    required: true,
  },

  platform: {
    type: String,
    enum: ['android', 'ios'],
    default: 'android',
  },

  deviceId: {
    type: String,
    default: null,
  },

  isActive: {
    type: Boolean,
    default: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

deviceTokenSchema.index({ userId: 1, isActive: 1 });
deviceTokenSchema.index({ fcmToken: 1 }, { unique: true });

const DeviceToken = authConn.models.DeviceToken || authConn.model('DeviceToken', deviceTokenSchema);

module.exports = DeviceToken;
