const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const { sanitize } = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { initSocketIO } = require('./socketManager');

// Connect routers
const profile = require('../routes/profile');

const app = express();
const PORT = process.env.PORT || 4000;

app.set('trust proxy', 1);
app.use(helmet({
  frameguard: false,
  xContentTypeOptions: false,
  referrerPolicy: false,
}));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const allowed = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);
    // Пустой список = НЕ пропускаем чужие Origin (RN идёт без Origin — см. выше)
    if (allowed.includes(origin)) return cb(null, true);
    cb(new Error('CORS not allowed'));
  },
}));
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));
app.use((req, res, next) => {
  if (req.body) sanitize(req.body);
  if (req.params) sanitize(req.params);
  if (req.query) sanitize(req.query);
  next();
});

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please slow down' },
}));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Use routes
app.use(profile);

const server = http.createServer(app);
initSocketIO(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
