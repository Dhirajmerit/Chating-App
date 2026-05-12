const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  user: String,
  receiver: String,
  room: String,
  message: String,
  time: String
});

module.exports = mongoose.model(
  'Message',
  messageSchema
);