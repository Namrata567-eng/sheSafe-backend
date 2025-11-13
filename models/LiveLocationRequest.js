// models/LiveLocationRequest.js
import mongoose from 'mongoose';

const liveLocationRequestSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  senderName: String,
  senderEmail: String,
  recipientId: { type: mongoose.Schema.Types.ObjectId, required: true },
  recipientEmail: String,
  recipientName: String,
  senderLocation: {
    latitude: Number,
    longitude: Number,
    accuracy: Number
  },
  senderAddress: String,
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('LiveLocationRequest', liveLocationRequestSchema);


