// const mongoose = require('mongoose');
// const User = require('../models/userModel');
//
// function isNonEmptyObject(data) {
//   return typeof data === 'object' && data !== null && !Array.isArray(data) && Object.keys(data).length > 0;
// }
//
// async function updateUserById(userId, data) {
//   if (!isNonEmptyObject(data)) return null;
//
//   let objectId = userId;
//   if (!(userId instanceof mongoose.Types.ObjectId)) {
//     try {
//       objectId = new mongoose.Types.ObjectId(userId);
//     } catch {
//       return null;
//     }
//   }
//
//   return User.findByIdAndUpdate(objectId, { $set: data }, { new: true }).lean();
// }
//
// // Находим по уникальному ключу или создаем атомарно (upsert)
// async function findOrCreateUserByUnique(unique = {}, extraOnInsert = {}) {
//   const query = {};
//   if (unique.email) query.email = unique.email;
//   if (unique.phone) query.phone = unique.phone;
//   if (unique.chatId) query.chatId = unique.chatId;
//
//   // Если нет ни одного идентификатора — не создаём пустых записей
//   if (Object.keys(query).length === 0) {
//     throw new Error('NO_UNIQUE_IDENTIFIER');
//   }
//
//   const update = {
//     $setOnInsert: {
//       onboardingComplete: false,
//       ...unique,
//       ...extraOnInsert,
//     },
//   };
//
//   try {
//     const doc = await User.findOneAndUpdate(query, update, {
//       new: true,
//       upsert: true,
//       setDefaultsOnInsert: true,
//     });
//     return doc;
//   } catch (e) {
//     // Гонка/дубликат: E11000 — повторим без upsert и вернем найденного
//     if (e && e.code === 11000) {
//       return User.findOne(query);
//     }
//     throw e;
//   }
// }
//
//
// module.exports = {
//   // онбординг
//   updateUserById,
//   findOrCreateUserByUnique,
// };




// server/services/userServices.js
const mongoose = require('mongoose');
const User = require('../models/userModel');

function isNonEmptyObject(data) {
  return typeof data === 'object' && data !== null && !Array.isArray(data) && Object.keys(data).length > 0;
}

async function getUserById(userId) {
  let objectId = userId;
  if (!(userId instanceof mongoose.Types.ObjectId)) {
    try {
      objectId = new mongoose.Types.ObjectId(userId);
    } catch {
      return null;
    }
  }
  // Возвращаем lean() для чистого объекта
  return User.findById(objectId).lean();
}

async function updateUserById(userId, data) {
  if (!isNonEmptyObject(data)) return null;

  let objectId = userId;
  if (!(userId instanceof mongoose.Types.ObjectId)) {
    try {
      objectId = new mongoose.Types.ObjectId(userId);
    } catch {
      return null;
    }
  }

  return User.findByIdAndUpdate(objectId, { $set: data }, { new: true }).lean();
}

// Находим по уникальному ключу или создаем атомарно (upsert)
async function findOrCreateUserByUnique(unique = {}, extraOnInsert = {}) {
  const query = {};
  if (unique.email) query.email = unique.email;
  if (unique.phone) query.phone = unique.phone;
  if (unique.chatId) query.chatId = unique.chatId;

  if (Object.keys(query).length === 0) {
    throw new Error('NO_UNIQUE_IDENTIFIER');
  }

  const update = {
    $setOnInsert: {
      onboardingComplete: false,
      ...unique,
      ...extraOnInsert,
    },
  };

  try {
    const doc = await User.findOneAndUpdate(query, update, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    });
    return doc;
  } catch (e) {
    if (e && e.code === 11000) {
      return User.findOne(query);
    }
    throw e;
  }
}

module.exports = {
  getUserById,
  updateUserById,
  findOrCreateUserByUnique,
};
