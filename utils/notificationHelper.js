// notificationHelper.js - ES6 Module Version
import Notification from '../models/notification.model.js';

/**
 * Create a new notification for a user
 * @param {String} userId - User's MongoDB _id
 * @param {String} title - Notification title
 * @param {String} message - Notification message
 * @param {String} type - Notification type (sos, friend, etc.)
 * @param {String} icon - Emoji icon (optional)
 * @param {Object} data - Extra data (optional)
 */
export const createNotification = async (userId, title, message, type = 'general', icon = '🔔', data = null) => {
  try {
    const notification = await Notification.create({
      userId,
      title,
      message,
      type,
      icon,
      data,
      read: false,
    });

    console.log(`✅ Notification created for user ${userId}: ${title}`);
    return notification;
  } catch (error) {
    console.error('❌ Error creating notification:', error);
    throw error;
  }
};

/**
 * Create multiple notifications at once
 * @param {Array} notifications - Array of notification objects
 */
export const createBulkNotifications = async (notifications) => {
  try {
    const result = await Notification.insertMany(notifications);
    console.log(`✅ Created ${result.length} notifications`);
    return result;
  } catch (error) {
    console.error('❌ Error creating bulk notifications:', error);
    throw error;
  }
};

/**
 * Notification type presets with icons
 */
export const NotificationTypes = {
  SOS: { type: 'sos', icon: '🆘' },
  FRIEND: { type: 'friend', icon: '👥' },
  COMMUNITY: { type: 'community', icon: '🌐' },
  LOCATION: { type: 'location', icon: '📍' },
  FEEDBACK: { type: 'feedback', icon: '💬' },
  REPORT: { type: 'report', icon: '⚠️' },
  AUDIO: { type: 'audio', icon: '🎵' },
  HELPLINE: { type: 'helpline', icon: '📞' },
  GENERAL: { type: 'general', icon: '🔔' },
};
