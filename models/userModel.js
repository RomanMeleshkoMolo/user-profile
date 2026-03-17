const mongoose = require('../src/db');

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
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;
