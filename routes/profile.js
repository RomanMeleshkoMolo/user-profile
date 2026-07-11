const express = require('express');
const router = express.Router();

const { auth } = require('../middlewares/auth');
const { validate, schemas } = require('../middlewares/validate');
const { emitToUser } = require('../src/socketManager');
const {
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
  updateForceIncognito,
  activateBoost,
  updateGeoLocation,
} = require('../controllers/profileController');

const { getDailyPhrase } = require('../controllers/motivationController');
const { reportUser, blockUser, unblockUser } = require('../controllers/safetyController');
const { revenuecatWebhook } = require('../controllers/revenuecatController');
const { getPremiumStatus, setPremium } = require('../controllers/adminController');

// Webhook RevenueCat — БЕЗ JWT-auth: аутентификация по секрету в заголовке
// Authorization (проверяется внутри контроллера через REVENUECAT_WEBHOOK_SECRET).
router.post('/profile/webhooks/revenuecat', revenuecatWebhook);

// Admin: ручное управление премиумом поддержкой — БЕЗ JWT-auth,
// аутентификация по x-admin-secret (ADMIN_API_SECRET) внутри контроллера.
router.get('/profile/admin/premium', getPremiumStatus);
router.post('/profile/admin/premium', setPremium);

// Все эндпоинты защищены
router.get('/profile', auth({ optional: false }), getProfile);
router.patch('/profile', auth({ optional: false }), validate(schemas.updateProfile), updateProfile);
router.delete('/profile', auth({ optional: false }), deleteProfile);

router.get('/profile/avatar', auth({ optional: false }), getAvatar);
// Внимание: теперь PUT принимает JSON { key } — файл уже загружен в S3
router.put('/profile/avatar', auth({ optional: false }), updateAvatar);

router.get('/profile/photos', auth({ optional: false }), getPhotos);
// Получить presigned PUT URL для загрузки фото напрямую в S3
router.get('/profile/photos/upload-url', auth({ optional: false }), getPhotoUploadUrl);
// Принимаем метаданные уже загруженных фото: { photos: [{ key, filename, mimeType, size }] }
router.post('/profile/photos', auth({ optional: false }), validate(schemas.addPhoto), addPhoto);

// Удаление по key
router.delete('/profile/photos/:photoId', auth({ optional: false }), removePhoto);

// Гости: запись просмотра и получение списка
router.post('/profile/view/:ownerId', auth({ optional: false }), recordProfileView);
router.get('/profile/guests', auth({ optional: false }), getGuests);
router.get('/profile/user/:userId', auth({ optional: false }), getPublicProfile);

// Мотивационная фраза дня
router.get('/profile/motivation/daily', auth({ optional: false }), getDailyPhrase);

// Статистика просмотров анкеты
router.get('/profile/stats/views', auth({ optional: false }), getActivityStats);

// GPS-координаты для поиска «Кто рядом»
router.put('/profile/location', auth({ optional: false }), validate(schemas.updateLocation), updateGeoLocation);

// Форс-инкогнито
router.patch('/profile/force-incognito', auth({ optional: false }), updateForceIncognito);

// Буст анкеты — поднять в топ ленты на ограниченное время (Premium)
router.post('/profile/boost', auth({ optional: false }), activateBoost);

// Жалобы и блокировка (требование Google Play / App Store для dating)
router.post('/profile/report', auth({ optional: false }), reportUser);
router.post('/profile/block', auth({ optional: false }), blockUser);
router.delete('/profile/block/:userId', auth({ optional: false }), unblockUser);

// Внутренний эндпоинт: воркер пересчёта активности уведомляет об изменении статуса "Топ"
// event: 'top_status_earned' | 'top_status_lost'
router.post('/internal/notify-top-status', (req, res) => {
  const { userIds, event } = req.body || {};
  if (Array.isArray(userIds) && event) {
    userIds.forEach((userId) => emitToUser(userId, event, {}));
  }
  res.json({ ok: true });
});

module.exports = router;
