const mongoose = require('mongoose');
const { authConn } = require('../src/db');

const UserPhotoSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    bucket: { type: String },
    url: { type: String },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reason: { type: String },
    moderation: { type: Array },
    faceCount: { type: Number },
    width: { type: Number },
    height: { type: Number },
    format: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema({
  deviceId: { type: String, index: true, unique: true, sparse: true },
  chatId: { type: String, index: true, unique: true, sparse: true },
  confirmationCode: { type: String, index: true },
  name: { type: String, index: true },
  email: { type: String, index: true, unique: true, sparse: true },
  interests: { type: [String], default: [] },
  education: { type: String, default: '' },
  lookingFor: {
    type: new mongoose.Schema(
      {
        id: { type: String },
        title: { type: String },
        icon: { type: String, default: '' },
      },
      { _id: false }
    ),
    required: false,
    default: undefined,
  },
  about: { type: String, default: '' },
  work: { type: String, default: '' },
  googleId: { type: String, index: true, unique: true, sparse: true },
  age: { type: Number },
  userBirthday: { type: String },
  gender: {
    id: { type: String, enum: ['male', 'female', 'other'], required: false },
    title: { type: String },
  },
  wishUser: { type: String, enum: ['male', 'female', 'all'] },
  userPhoto: { type: [UserPhotoSchema], default: [] },
  userPhotoUrls: [{ type: String }],
  tabIconUserProfile: { type: String },
  userLocation: { type: String, index: true },
  // Нормализованные (lowercase) части локации для indexed-фильтрации ленты/анкет
  city: { type: String, default: null },
  region: { type: String, default: null },
  country: { type: String, default: null },
  // GPS-координаты для поиска «Кто рядом» (GeoJSON Point, порядок: [lng, lat])
  geo: {
    type: { type: String, enum: ['Point'] },
    coordinates: { type: [Number], default: undefined },
  },
  geoUpdatedAt: { type: Date, default: null },
  userSex: { type: String, enum: ['heterosexual', 'gay', 'lesbian', 'bisexual', 'asexual'] },
  zodiac: { type: String, default: '' },
  languages: { type: [String], default: [] },
  children: { type: String, default: '' },
  pets: { type: [String], default: [] },
  smoking: { type: String, default: '' },
  alcohol: { type: String, default: '' },
  relationship: { type: String, default: '' },
  onboardingComplete: { type: Boolean, default: false },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: null },
  premium: { type: Boolean, default: false },      // кэш; пересчитывается из premiumUntil при чтении
  premiumUntil: { type: Date, default: null },     // источник правды: премиум активен пока premiumUntil > now
  premiumSource: { type: String, default: null },  // 'apple' | 'google' | 'revenuecat' | 'manual'
  premiumProduct: { type: String, default: null }, // 'monthly' | 'yearly' | 'legacy' | ...
  // Заблокированные пользователи (жалобы/блокировка — требование сторов)
  blockedUsers: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  forceIncognito: { type: Boolean, default: false },
  boostUntil: { type: Date, default: null },
  lastBoostAt: { type: Date, default: null },
  questionAnswers: { type: Map, of: String, default: new Map() },
  activityScore: { type: Number, default: 0 },
  activityUpdatedAt: { type: Date, default: null },
});

// 2dsphere-индекс для geo-запросов «Кто рядом» ($geoNear в user-meets)
userSchema.index({ geo: '2dsphere' });

const User = authConn.models.User || authConn.model('User', userSchema);

module.exports = User;
