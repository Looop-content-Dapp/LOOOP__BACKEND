import { notificationService } from '../services/notification.service.js';

export const getUserNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await notificationService.getUserNotifications(userId, req.query);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const markNotificationsAsRead = async (req, res) => {
  try {
    const { userId } = req.params;
    const { notificationIds } = req.body;

    await notificationService.markAsRead(userId, notificationIds);

    res.json({
      success: true,
      message: 'Notifications marked as read'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const { userId } = req.params;
    const count = await notificationService.getUnreadCount(userId);

    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
