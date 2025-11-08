// notification.routes.js - ES6 Module Version
import express from 'express';
import Notification from '../models/notification.model.js';
import authMiddleware from '../Middleware/authMiddleware.js';

const router = express.Router();

// ✅ GET - Fetch all notifications for logged-in user
router.get('/', authMiddleware, async (req, res) => {
  try {
    console.log("\n" + "=".repeat(50));
    console.log("📬 BACKEND: Fetching notifications");
    console.log("=".repeat(50));
    
    // ✅ Try multiple user ID formats
    const userId = req.user._id || req.user.id;
    console.log("👤 User Object:", req.user);
    console.log("🆔 User ID:", userId);
    console.log("🆔 User ID Type:", typeof userId);
    console.log("🆔 User ID String:", userId.toString());

    const notifications = await Notification.find({ userId: userId })
      .sort({ createdAt: -1 }) // Latest first
      .lean();
    
    console.log(`📋 Query: { userId: '${userId}' }`);
    console.log(`📦 Found ${notifications.length} notifications`);

    const unreadCount = notifications.filter(n => !n.read).length;

    console.log(`✅ Found ${notifications.length} notifications (${unreadCount} unread)`);
    console.log("=".repeat(50) + "\n");

    return res.status(200).json({
      success: true,
      count: notifications.length,
      unreadCount: unreadCount,
      data: notifications,
    });
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message,
    });
  }
});

// ✅ PATCH - Mark single notification as read
router.patch('/:id/read', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📖 Marking notification ${id} as read`);

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { read: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    console.log('✅ Notification marked as read');

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification,
    });
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message,
    });
  }
});

// ✅ PATCH - Mark all notifications as read
router.patch('/read-all', authMiddleware, async (req, res) => {
  try {
    console.log('📖 Marking all notifications as read for user:', req.user.id);

    const result = await Notification.updateMany(
      { userId: req.user.id, read: false },
      { read: true, readAt: new Date() }
    );

    console.log(`✅ Marked ${result.modifiedCount} notifications as read`);

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('❌ Error marking all as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark all as read',
      error: error.message,
    });
  }
});

// ✅ DELETE - Delete single notification (DATABASE SE PERMANENTLY)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    console.log(`\n${"🗑️".repeat(20)}`);
    console.log('🗑️ DELETE SINGLE Notification Request');
    console.log('🆔 Notification ID:', req.params.id);
    console.log('👤 User ID:', req.user.id);

    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!notification) {
      console.log('❌ Notification not found or unauthorized');
      return res.status(404).json({
        success: false,
        message: 'Notification not found or you are not authorized'
      });
    }

    console.log('✅ DATABASE se permanently DELETE ho gaya!');
    console.log('🗑️ Deleted notification:', {
      id: notification._id,
      title: notification.title,
      type: notification.type
    });
    console.log(`${"🗑️".repeat(20)}\n`);

    res.json({
      success: true,
      message: 'Notification deleted permanently from database',
      deletedNotification: notification
    });
  } catch (error) {
    console.error('❌ Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: error.message
    });
  }
});

// ✅ DELETE - Delete ALL notifications (DATABASE SE PERMANENTLY)
router.delete('/', authMiddleware, async (req, res) => {
  try {
    console.log(`\n${"🗑️".repeat(20)}`);
    console.log('🗑️ DELETE ALL Notifications Request');
    console.log('👤 User ID:', req.user.id);

    const result = await Notification.deleteMany({
      userId: req.user.id
    });

    console.log(`✅ DATABASE se ${result.deletedCount} notifications permanently DELETE ho gayi!`);
    console.log(`${"🗑️".repeat(20)}\n`);

    res.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `${result.deletedCount} notifications deleted permanently from database`
    });
  } catch (error) {
    console.error('❌ Clear all notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear notifications',
      error: error.message
    });
  }
});

export default router;