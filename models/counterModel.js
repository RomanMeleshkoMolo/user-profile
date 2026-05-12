const mongoose = require('mongoose');
const { authConn } = require('../src/db');

const counterSchema = new mongoose.Schema({
  name: String,
  seq: Number,
});

const Counter = authConn.models.Counter || authConn.model('Counter', counterSchema);

module.exports = Counter;
