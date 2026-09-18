import { Router } from 'express';
import { GeneralSettingsController } from '../controllers/GeneralSettingsController';

const router = Router();

router.get('/general', GeneralSettingsController.getPublicSettings);

export default router;
