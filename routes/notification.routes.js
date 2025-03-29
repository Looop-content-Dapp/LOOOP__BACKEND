import { Router } from 'express';
import { getUserNotifications, markNotificationsAsRead, getUnreadCount } from '../controller/notification.controller.js';
import { isUser } from '../middlewares/isvaliduser.middleware.js';

const router = Router();

router.get('/user/:userId', isUser, getUserNotifications);
router.get('/user/:userId/unread', isUser, getUnreadCount);
router.post('/user/:userId/read', isUser, markNotificationsAsRead);

export default router;
