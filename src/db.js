const mongoose = require('mongoose');
require('dotenv').config();

const AUTH_MONGO_URI = process.env.AUTH_MONGO_URI || 'mongodb://localhost:27017/molo_auth';
const PROFILE_MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/molo_profile';
const LIKES_MONGO_URI = process.env.LIKES_MONGO_URI || 'mongodb://localhost:27017/molo_likes';
const CHAT_MONGO_URI = process.env.CHAT_MONGO_URI || 'mongodb://localhost:27017/molo_chat';

const authConn = mongoose.createConnection(AUTH_MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});

const profileConn = mongoose.createConnection(PROFILE_MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});

const likesConn = mongoose.createConnection(LIKES_MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});

const chatConn = mongoose.createConnection(CHAT_MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});

authConn.on('connected', () => console.log('[user-profile] authConn connected → molo_auth'));
authConn.on('error', (err) => console.error('[user-profile] authConn error:', err));

profileConn.on('connected', () => console.log('[user-profile] profileConn connected → molo_profile'));
profileConn.on('error', (err) => console.error('[user-profile] profileConn error:', err));

likesConn.on('connected', () => console.log('[user-profile] likesConn connected → molo_likes'));
likesConn.on('error', (err) => console.error('[user-profile] likesConn error:', err));

chatConn.on('connected', () => console.log('[user-profile] chatConn connected → molo_chat'));
chatConn.on('error', (err) => console.error('[user-profile] chatConn error:', err));

module.exports = { authConn, profileConn, likesConn, chatConn };
