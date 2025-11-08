import mongoose from 'mongoose';

const trackingSessionSchema = new mongoose.Schema({
  sessionId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  userPhone: { type: String, required: true },
  userEmail: { type: String, required: true },
  currentLocation: {
    lat: { type: Number, required: true, default: 0 },
    lng: { type: Number, required: true, default: 0 }
  },
  currentAddress: { type: String, default: 'Fetching address...' },
  duration: { type: Number, default: -1 }, // in minutes, -1 = unlimited
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  isActive: { type: Boolean, default: true },
  lastUpdate: { type: Date, default: Date.now }
}, { timestamps: true });

// Auto-expire inactive sessions after duration
trackingSessionSchema.methods.checkExpiry = function() {
  if (this.duration && this.duration !== -1) {
    const expiryTime = new Date(this.startTime.getTime() + this.duration * 60 * 1000);
    if (new Date() > expiryTime) {
      this.isActive = false;
      return true;
    }
  }
  return false;
};

const TrackingSession = mongoose.model('TrackingSession', trackingSessionSchema);

export default TrackingSession;
