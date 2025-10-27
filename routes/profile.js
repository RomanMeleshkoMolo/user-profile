const express = require('express');
const router = express.Router();

const { auth } = require('../middlewares/auth');
const {
  getProfile,
  updateProfile,
  getAvatar,
  updateAvatar,
  getPhotos,
  addPhoto,
  removePhoto,
} = require('../controllers/profileController');

// Все эндпоинты защищены
router.get('/profile', auth({ optional: false }), getProfile);
router.patch('/profile', auth({ optional: false }), updateProfile);

router.get('/profile/avatar', auth({ optional: false }), getAvatar);
// Внимание: теперь PUT принимает JSON { key } — файл уже загружен в S3
router.put('/profile/avatar', auth({ optional: false }), updateAvatar);

router.get('/profile/photos', auth({ optional: false }), getPhotos);
// Принимаем метаданные уже загруженных фото: { photos: [{ key, filename, mimeType, size }] }
router.post('/profile/photos', auth({ optional: false }), addPhoto);

// Удаление по key
router.delete('/profile/photos/:photoId', auth({ optional: false }), removePhoto);

module.exports = router;
