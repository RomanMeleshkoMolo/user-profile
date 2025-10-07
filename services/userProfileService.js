// services/userProfileService.js
const mongoose = require('mongoose');
const User = require('../models/userModel');
const { findOrCreateUserByUnique, updateUserById } = require('./userService'); // если у тебя уже есть файл с update/find, адаптируй импорт

function isNonEmptyObject(data) {
  return typeof data === 'object' && data !== null && !Array.isArray(data) && Object.keys(data).length > 0;
}

// Получить полный профиль пользователя по id
async function getUserProfileById(userId) {
  if (!userId) return null;

  let objectId = userId;
  if (!(userId instanceof mongoose.Types.ObjectId)) {
    try {
      objectId = new mongoose.Types.ObjectId(userId);
    } catch {
      return null;
    }
  }

  // Предположим, что мы хотим вернуть всю запись пользователя и ее поля
  const user = await User.findById(objectId).lean();
  if (!user) return null;

  // При необходимости можно привести данные, скрыть чувствительные поля
  const { password, __v, createdAt, updatedAt, ...rest } = user;
  return rest;
}

// Обновить данные пользователя (пользовательская функция уже есть в твоем файле)
// Здесь можно обернуть твою существующую логику обновления
async function updateUserProfileById(userId, data) {
  return updateUserById(userId, data); // используй уже существующий метод
}

module.exports = {
  getUserProfileById,
  updateUserProfileById,
};
