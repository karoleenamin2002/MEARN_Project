import { Router } from 'express';
import { getNotifications, markAsRead, markAllAsRead, createNotification } from '../controllers/notificationController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect);
router.get('/', getNotifications);
router.put('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);
router.post('/', authorize('admin'), createNotification);

export default router;
