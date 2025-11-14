// notification.model.js - ES6 Module Version
import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true, // For faster queries
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['sos', 'friend', 'community', 'location', 'feedback', 'report', 'audio', 'helpline', 'general'],
      default: 'general',
    },
    icon: {
      type: String,
      default: '🔔',
    },
    read: {
      type: Boolean,
      default: false,
      index: true, // For faster unread queries
    },
    readAt: {
      type: Date,
      default: null,
    },
    // Extra metadata (optional)
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// Index for efficient querying
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
