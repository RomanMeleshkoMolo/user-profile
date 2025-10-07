// controllers/userProfileController.js
const { getUserProfileById, updateUserProfileById } = require('../services/userProfileService');

// GET /user-profile/me
async function getMe(req, res) {

  console.log("ggggggg");

  try {
    // Предполагаем, что аутентификация проставляет req.user.id
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const profile = await getUserProfileById(userId);
    if (!profile) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(profile);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.message || 'Internal Server Error' });
  }
}

// PATCH /user-profile/me
async function updateMe(req, res) {

  console.log("vvvvvvvv");

  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const data = req.body;
    if (!isNonEmptyObject(data)) {
      return res.status(400).json({ message: 'No data to update' });
    }
    const updated = await updateUserProfileById(userId, data);
    if (!updated) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.message || 'Internal Server Error' });
  }
}

// Вспомогательная функция (можно перенести в общий файл утилит)
function isNonEmptyObject(data) {
  return typeof data === 'object' && data !== null && !Array.isArray(data) && Object.keys(data).length > 0;
}

module.exports = {
  getMe,
  updateMe,
};














//------------------------------------------------------

// server/controllers/userProfileController.js
const { getUserById } = require('../services/userService');
const mongoose = require("mongoose");

async function getUserProfile(req, res) {

  try {
    const userId =
      req.user?._id ||
      req.user?.id ||
      req.auth?.userId ||
      req.regUserId ||
      req.userId;


    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(401).json({ message: 'Unauthorized: user id not found in request context' });
    }

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Не возвращаем чувствительные поля
    const safeUser = {
      _id: user._id,
      id: user._id, // для совместимости на клиенте
      name: user.name,
      age: user.age,
      email: user.email,
      gender: user.gender,
      photo: user.userPhoto,
      interests: user.interests[0],
      onboardingComplete: user.onboardingComplete,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      // добавьте нужные поля из вашей схемы
    };

    return res.json({ user: safeUser });
  } catch (e) {
    console.error('[user-profile] error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = { getUserProfile };
