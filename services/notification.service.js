import { Notification } from '../models/notification.model.js';
import { websocketService } from '../utils/websocket/websocketServer.js';

class NotificationService {
  async createNotification(data) {
    try {
      const notification = new Notification(data);
      await notification.save();

      // Send real-time notification via WebSocket
      websocketService.sendToUser(data.userId, 'newNotification', notification);

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  async getUserNotifications(userId, query = {}) {
    const { page = 1, limit = 20, isRead } = query;
    const skip = (page - 1) * limit;

    const filter = { userId };
    if (typeof isRead === 'boolean') {
      filter.isRead = isRead;
    }

    try {
      const [notifications, total] = await Promise.all([
        Notification.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Notification.countDocuments(filter)
      ]);

      return {
        notifications,
        pagination: {
          current: page,
          total: Math.ceil(total / limit),
          hasMore: total > skip + notifications.length
        }
      };
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  }

  async markAsRead(userId, notificationIds) {
    try {
      const result = await Notification.updateMany(
        {
          userId,
          _id: { $in: notificationIds }
        },
        {
          $set: { isRead: true }
        }
      );

      return result;
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      throw error;
    }
  }

  async getUnreadCount(userId) {
    try {
      return await Notification.countDocuments({
        userId,
        isRead: false
      });
    } catch (error) {
      console.error('Error counting unread notifications:', error);
      throw error;
    }
  }
}

export const notificationService = new NotificationService();
