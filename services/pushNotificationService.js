/**
 * Push Notification Service (user-profile) — отправка push через Firebase Cloud Messaging.
 * Используется для уведомлений о новых гостях профиля.
 */

const admin = require('firebase-admin');
const DeviceToken = require('../models/deviceTokenModel');

let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) return;

  try {
    if (!process.env.FIREBASE_PROJECT_ID) {
      console.warn('[FCM-profile] Firebase credentials not configured. Push notifications disabled.');
      return;
    }

    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    firebaseInitialized = true;
    console.log('[FCM-profile] Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('[FCM-profile] Failed to initialize Firebase:', error);
  }
}

initializeFirebase();

/**
 * Отправить push-уведомление пользователю на все его активные устройства.
 */
async function sendPushToUser(userId, notification) {
  if (!firebaseInitialized) {
    console.log('[FCM-profile] Firebase not initialized, skipping push notification');
    return { success: false, reason: 'firebase_not_initialized' };
  }

  try {
    const tokens = await DeviceToken.find({
      userId: userId,
      isActive: true,
    }).lean();

    if (tokens.length === 0) {
      console.log(`[FCM-profile] No active tokens for user ${userId}`);
      return { success: false, reason: 'no_tokens' };
    }

    const fcmTokens = tokens.map((t) => t.fcmToken);

    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data || {},
      android: {
        priority: 'high',
        notification: {
          channelId: 'molo_messages',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: notification.title,
              body: notification.body,
            },
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast({
      tokens: fcmTokens,
      ...message,
    });

    console.log(`[FCM-profile] Sent to user ${userId}: ${response.successCount}/${fcmTokens.length} successful`);

    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            failedTokens.push(fcmTokens[idx]);
          }
          console.log(`[FCM-profile] Failed token: ${errorCode}`);
        }
      });

      if (failedTokens.length > 0) {
        await DeviceToken.updateMany(
          { fcmToken: { $in: failedTokens } },
          { isActive: false, updatedAt: new Date() }
        );
        console.log(`[FCM-profile] Deactivated ${failedTokens.length} invalid tokens`);
      }
    }

    return { success: true, successCount: response.successCount };
  } catch (error) {
    console.error('[FCM-profile] Error sending push notification:', error);
    return { success: false, reason: 'error', error: error.message };
  }
}

/**
 * Push о новом госте профиля (первый визит).
 */
async function sendNewGuestNotification(ownerId, viewer) {
  const notification = {
    title: 'Новый гость 👀',
    body: `${viewer?.name || 'Кто-то'} посмотрел(а) твою анкету`,
    data: {
      type: 'new_guest',
      viewerId: viewer?._id ? String(viewer._id) : '',
      viewerName: viewer?.name || '',
    },
  };

  return sendPushToUser(ownerId, notification);
}

module.exports = {
  sendPushToUser,
  sendNewGuestNotification,
};
