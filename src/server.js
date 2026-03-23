const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const { initSocketIO } = require('./socketManager');

// Connect routers
const profile = require('../routes/profile');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: '*' }));
app.use(bodyParser.json());

// Use routes
app.use(profile);

const server = http.createServer(app);
initSocketIO(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
