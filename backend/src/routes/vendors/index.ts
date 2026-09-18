import { Router } from 'express';
import { VendorController } from '../../controllers/VendorController';
import { VendorDashboardController } from '../../controllers/VendorDashboardController';
import { VendorEarningsController } from '../../controllers/VendorEarningsController';
import { RentalAvailabilityController } from '../../controllers/RentalAvailabilityController';
import { ComplaintController } from '../../controllers/ComplaintController';
import { NotificationController } from '../../controllers/NotificationController';
import { upload } from '../../config/multer';
import { authenticate, authorize } from '../../middlewares/auth';
import { vendorFilter } from '../../middlewares/auth';
import { AdminOperationsController } from '../../controllers/AdminOperationsController';

const router = Router();
router.use(authenticate);

// Vendor routes
router.get('/dashboard/summary', authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), VendorDashboardController.getSummary);
router.get('/earnings/summary', authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), VendorEarningsController.getSummary);
router.get('/badges/rules', authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), VendorController.getBadgeRules);
router.get('/badges/me', authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), VendorController.getMyBadge);
router.get(
  '/notifications',
  authorize(['INDIVIDUAL_VENDOR']),
  NotificationController.listIndividualVendorNotifications
);
router.post(
  '/notifications/read',
  authorize(['INDIVIDUAL_VENDOR']),
  NotificationController.markIndividualVendorRead
);
router.get('/support/tickets', authorize(['INDIVIDUAL_VENDOR']), ComplaintController.getIndividualVendorTickets);
router.get('/support/tickets/:ticketId', authorize(['INDIVIDUAL_VENDOR']), ComplaintController.getIndividualVendorTicketDetail);
router.post(
  '/support/tickets',
  authorize(['INDIVIDUAL_VENDOR']),
  upload.array('images', 5),
  ComplaintController.createIndividualVendorTicket
);
router.get('/rental-availability/products', authorize(['VENDOR']), RentalAvailabilityController.getProducts);
router.get('/rental-availability/calendar', authorize(['VENDOR']), RentalAvailabilityController.getCalendar);
router.post('/rental-availability/date', authorize(['VENDOR']), RentalAvailabilityController.upsertDate);
router.post('/rental-availability/range', authorize(['VENDOR']), RentalAvailabilityController.upsertRange);
router.post('/rental-availability/clear-month', authorize(['VENDOR']), RentalAvailabilityController.clearMonth);
router.get('/customers', authorize(['VENDOR']), VendorController.getCustomers);
router.get('/balance', authorize(['VENDOR']), VendorController.getBalance);
router.get('/transactions', authorize(['VENDOR']), VendorController.getTransactions);
router.get('/settlements', authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), VendorController.getSettlements);
router.patch('/account/deactivate', authorize(['VENDOR']), VendorController.deactivateAccount);
router.delete('/account', authorize(['VENDOR']), VendorController.deleteAccount);

// Admin routes (settlement control)
router.post('/admin/settlement/create', authorize(['ADMIN']), VendorController.createSettlement);
router.post('/admin/settlement/approve', authorize(['ADMIN']), VendorController.approveSettlement);
router.get('/admin/settlements/pending', authorize(['ADMIN']), VendorController.getPendingSettlements);

// Operations routes
router.get('/operations/quality-check', authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), vendorFilter, AdminOperationsController.getQualityChecks);
router.post('/operations/quality-check/:orderItemId/inspect', authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), vendorFilter, AdminOperationsController.inspectQualityCheck);
router.get('/operations/damage-claims', authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), vendorFilter, AdminOperationsController.getDamageClaims);
router.post('/operations/damage-claims/:claimId/review', authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), vendorFilter, AdminOperationsController.reviewDamageClaim);
router.get('/operations/maintenance', authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), vendorFilter, AdminOperationsController.getMaintenanceTasks);
router.patch('/operations/maintenance/:taskId/status', authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), vendorFilter, AdminOperationsController.updateMaintenanceTaskStatus);
router.get('/operations/repairs', authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), vendorFilter, AdminOperationsController.getRepairTasks);
router.patch('/operations/repairs/:repairId', authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), vendorFilter, AdminOperationsController.updateRepairTask);
router.patch('/operations/issues/:orderItemId', authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), vendorFilter, AdminOperationsController.updateIssueTask);

export default router;
