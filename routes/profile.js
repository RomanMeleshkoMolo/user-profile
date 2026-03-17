const express = require('express');
const router = express.Router();

const { auth } = require('../middlewares/auth');
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
} = require('../controllers/profileController');

// Все эндпоинты защищены
router.get('/profile', auth({ optional: false }), getProfile);
router.patch('/profile', auth({ optional: false }), updateProfile);
router.delete('/profile', auth({ optional: false }), deleteProfile);

router.get('/profile/avatar', auth({ optional: false }), getAvatar);
// Внимание: теперь PUT принимает JSON { key } — файл уже загружен в S3
router.put('/profile/avatar', auth({ optional: false }), updateAvatar);

router.get('/profile/photos', auth({ optional: false }), getPhotos);
// Получить presigned PUT URL для загрузки фото напрямую в S3
router.get('/profile/photos/upload-url', auth({ optional: false }), getPhotoUploadUrl);
// Принимаем метаданные уже загруженных фото: { photos: [{ key, filename, mimeType, size }] }
router.post('/profile/photos', auth({ optional: false }), addPhoto);

// Удаление по key
router.delete('/profile/photos/:photoId', auth({ optional: false }), removePhoto);

module.exports = router;
