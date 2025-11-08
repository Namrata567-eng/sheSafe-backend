// models/LiveLocationSession.js
import mongoose from 'mongoose';

const liveLocationSessionSchema = new mongoose.Schema({
  user1Id: mongoose.Schema.Types.ObjectId,
  user1Email: String,
  user1Name: String,
  user2Id: mongoose.Schema.Types.ObjectId,
  user2Email: String,
  user2Name: String,
  user1Location: {
    latitude: Number,
    longitude: Number,
    accuracy: Number
  },
  user1Address: String,
  user2Location: {
    latitude: Number,
    longitude: Number,
    accuracy: Number
  },
  user2Address: String,
  status: { type: String, default: 'active' },
  createdAt: { type: Date, default: Date.now },
  endTime: Date,
  lastUpdate: { type: Date, default: Date.now }
});

export default mongoose.model('LiveLocationSession', liveLocationSessionSchema);