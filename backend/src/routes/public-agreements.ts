import { Router } from 'express';
import { AgreementController } from '../controllers/AgreementController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.get('/', AgreementController.getPublicAgreements);
router.post('/:agreementId/accept', authenticate, AgreementController.acceptAgreement);

export default router;
