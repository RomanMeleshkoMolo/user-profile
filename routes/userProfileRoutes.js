// routes/userProfileRoutes.js
// const express = require('express');
// const router = express.Router();
// const {auth} = require('../middlewares/auth'); // предполагаем, что есть middleware аутентификации
// const { getMe, updateMe } = require('../controllers/userProfileController');

// // Все роуты требуют аутентификации
// // router.use(auth({ optional: false }));
//
// // Получить граф профиля текущего пользователя
// router.get('/user-profile/me', auth({ optional: false }), getMe);
//
// // Обновить профиль текущего пользователя
// router.patch('/user-profile/me', auth({ optional: false }), updateMe);
//
// // Опционально: получить профиль по id (для админов/сервисов)
// router.get('/:id', async (req, res) => {
//   try {
//     // Включи здесь доступ к API по id, если нужно
//     const { id } = req.params;
//     // Можно вызвать существующий сервис аналогично
//     const profile = await require('../services/userProfileService').getUserProfileById(id);
//     if (!profile) return res.status(404).json({ message: 'User not found' });
//     res.json(profile);
//   } catch (e) {
//     console.error(e);
//     res.status(500).json({ message: e.message || 'Internal Server Error' });
//   }
// });
//
// module.exports = router;


















//--------------------------------------------------

// server/routes/userProfile.js
const express = require('express');
const router = express.Router();

const { auth } = require('../middlewares/auth');
const { getUserProfile } = require('../controllers/userProfileController');

// GET /user-profile — защищенный эндпоинт
router.get('/user-profile', auth({ optional: false }), getUserProfile);

module.exports = router;
