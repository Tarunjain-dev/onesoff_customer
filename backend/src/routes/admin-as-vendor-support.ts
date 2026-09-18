import { Router } from 'express';
import { upload } from '../config/multer';
import { ComplaintController } from '../controllers/ComplaintController';
import { authenticate, authorize, vendorFilter } from '../middlewares/auth';

const router = Router();

router.use(authenticate);
router.use(authorize(['ADMIN_AS_VENDOR']));
router.use(vendorFilter);

router.get('/tickets', ComplaintController.getAdminAsVendorTickets);
router.get('/tickets/:ticketId', ComplaintController.getAdminAsVendorTicketDetail);
router.post('/tickets/:ticketId/resolve', ComplaintController.resolveAdminAsVendorTicket);
router.post(
  '/tickets/:ticketId/messages',
  upload.array('images', 5),
  ComplaintController.addMessageToTicket
);
router.post(
  '/tickets',
  upload.array('images', 5),
  ComplaintController.createAdminAsVendorTicket
);

export default router;
