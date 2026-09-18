import { Router } from 'express';
import { AgreementController } from '../controllers/AgreementController';
import { authenticate, authorizeAdmin } from '../middlewares/auth';

const router = Router();

router.use(authenticate);
router.use(authorizeAdmin);

router.get('/', AgreementController.getAdminAgreements);
router.get('/:agreementId', AgreementController.getAdminAgreementDetail);
router.get('/:agreementId/history', AgreementController.getAgreementHistory);
router.post('/', AgreementController.createAgreement);
router.put('/:agreementId', AgreementController.updateAgreement);
router.delete('/:agreementId', AgreementController.deleteAgreement);

export default router;
