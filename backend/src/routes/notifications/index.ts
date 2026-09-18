import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { NotificationController } from '../../controllers/NotificationController';

const router = Router();

router.get('/', authenticate, NotificationController.listMyNotifications);
router.post('/devices/fcm', authenticate, NotificationController.registerFcmToken);
router.post('/devices/fcm/remove', authenticate, NotificationController.unregisterFcmToken);
router.post('/read', authenticate, NotificationController.markRead);

export default router;

