import { Router } from 'express';
import { authenticate, authorize, authorizeAdmin, vendorFilter } from '../middlewares/auth';
import { AdminDashboardController } from '../controllers/AdminDashboardController';
import { AdminProfileController } from '../controllers/AdminProfileController';
import { AdminVendorController } from '../controllers/AdminVendorController';
import { AdminOrderController } from '../controllers/AdminOrderController';
import { AdminCustomerController } from '../controllers/AdminCustomerController';
import { AdminReportController } from '../controllers/AdminReportController';
import { AdminRefundController } from '../controllers/AdminRefundController';
import { AdminFinanceController } from '../controllers/AdminFinanceController';
import { AdminSettlementController } from '../controllers/AdminSettlementController';
import { AdminCommissionSettingsController } from '../controllers/AdminCommissionSettingsController';
import { AdminGeneralSettingsController } from '../controllers/AdminGeneralSettingsController';
import { ComplaintController } from '../controllers/ComplaintController';
import { ReviewModerationController } from '../controllers/ReviewModerationController';
import { BadgeController } from '../controllers/BadgeController';
import { KycController } from '../controllers/KycController';
import { RentalAvailabilityController } from '../controllers/RentalAvailabilityController';
import { AdminProductController } from '../controllers/AdminProductController';
import { AdminOperationsController } from '../controllers/AdminOperationsController';
import { UploadController } from '../controllers/UploadController';
import { TrialRequestController } from '../controllers/TrialRequestController';
import { CategoryController } from '../controllers/CategoryController';
import { upload } from '../config/multer';

const router = Router();

router.use(authenticate);

// Dashboard
router.get('/dashboard', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminDashboardController.getDashboard);
router.get('/finance/overview', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminFinanceController.getOverview);
router.get('/finance/transactions', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminFinanceController.getTransactionHistory);
router.get('/profile', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), AdminProfileController.getProfile);
router.patch('/profile', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), AdminProfileController.updateProfile);
router.get('/general-settings', authorizeAdmin, AdminGeneralSettingsController.getSettings);
router.post('/general-settings', authorizeAdmin, AdminGeneralSettingsController.createSettings);
router.put('/general-settings', authorizeAdmin, AdminGeneralSettingsController.updateSettings);
router.delete('/general-settings', authorizeAdmin, AdminGeneralSettingsController.deleteSettings);
router.get('/settings/commission', authorizeAdmin, AdminCommissionSettingsController.getSettings);
router.patch('/settings/commission', authorizeAdmin, AdminCommissionSettingsController.updateSettings);

// Vendors

router.get('/vendors', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminVendorController.getVendors);
router.get('/vendors/:vendorId', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminVendorController.getVendorDetail);
router.get('/rental-availability/products', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, RentalAvailabilityController.getProductsByAdmin);
router.get('/rental-availability/calendar', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, RentalAvailabilityController.getCalendarByAdmin);
router.post('/rental-availability/date', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, RentalAvailabilityController.upsertDateByAdmin);
router.post('/rental-availability/clear-month', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, RentalAvailabilityController.clearMonthByAdmin);
router.get('/vendors/:vendorId/kyc', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, KycController.getVendorKycByAdmin);
router.patch('/vendors/:vendorId/status', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminVendorController.updateStatus);
router.post('/vendors/:vendorId/document-resubmission', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminVendorController.requestDocumentResubmission);
router.patch('/vendors/:vendorId/commission', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminVendorController.updateCommission);
router.delete('/vendors/:vendorId', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminVendorController.deleteVendor);

// Products
router.get('/categories', authorizeAdmin, CategoryController.listCategories);
router.post('/categories', authorizeAdmin, CategoryController.createCategory);
router.patch('/categories/:categoryId', authorizeAdmin, CategoryController.updateCategory);
router.delete('/categories/:categoryId', authorizeAdmin, CategoryController.deleteCategory);
router.patch('/products/:id', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminProductController.updateProduct);
router.post('/products/:id/approval-stage-1', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminProductController.approveStageOne);
router.post('/products/:id/approval-stage-2', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminProductController.approveStageTwo);
router.post('/products/:id/reject-approval', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminProductController.rejectApproval);
router.post('/products/:id/approve-withdrawal', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminProductController.approveWithdrawal);
router.delete('/products/:id', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminProductController.deleteProduct);
router.post('/products/:id/variants', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminProductController.addVariant);
router.delete('/products/:id/variants/:variantId', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminProductController.deleteVariant);
router.post('/products/upload', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), upload.array('images', 5), UploadController.uploadProductImages);

// Orders
router.get('/orders', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminOrderController.getOrders);
router.get('/orders/:orderId', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminOrderController.getOrderDetail);
router.post('/orders/:orderId/cancel', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminOrderController.cancelOrder);
router.patch('/orders/:orderId/status', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminOrderController.overrideStatus);

// Customers
router.get('/customers', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminCustomerController.getCustomers);

// Reports
router.get('/reports/overview', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminReportController.getOverview);

// Trial Requests
router.get('/trial-requests', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, TrialRequestController.getAdminScopedRequests);
router.post('/trial-requests/response', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, TrialRequestController.adminScopedRespond);
router.post('/trial-requests/start', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, TrialRequestController.adminScopedStart);
router.post('/trial-requests/complete', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, TrialRequestController.adminScopedFinalize);

// Operations
router.get('/operations/quality-check', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminOperationsController.getQualityChecks);
router.post('/operations/quality-check/:orderItemId/inspect', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminOperationsController.inspectQualityCheck);
router.get('/operations/damage-claims', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminOperationsController.getDamageClaims);
router.post('/operations/damage-claims/:claimId/review', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminOperationsController.reviewDamageClaim);
router.get('/operations/maintenance', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminOperationsController.getMaintenanceTasks);
router.patch('/operations/maintenance/:taskId/status', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminOperationsController.updateMaintenanceTaskStatus);
router.get('/operations/repairs', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminOperationsController.getRepairTasks);
router.patch('/operations/repairs/:repairId', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminOperationsController.updateRepairTask);
router.patch('/operations/issues/:orderItemId', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminOperationsController.updateIssueTask);

// Refunds
router.get('/refunds', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminRefundController.getRefundRequests);
router.post('/refunds/:returnId/process', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminRefundController.processRefund);
router.post('/refunds/:returnId/remind', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminRefundController.remindRefund);

// Settlements
router.get('/owner-payouts', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminSettlementController.getOwnerPayoutSummaries);
router.get('/owner-payouts/:vendorId', authorize(['ADMIN', 'ADMIN_AS_VENDOR']), vendorFilter, AdminSettlementController.getOwnerPayoutDetail);
router.get('/settlements', authorizeAdmin, AdminSettlementController.getSettlements);
router.post('/settlements/:vendorId/mark-paid', authorizeAdmin, AdminSettlementController.markPaid);
router.post('/settlements/:vendorId/reject', authorizeAdmin, AdminSettlementController.reject);

// Complaints
router.get('/complaints', authorizeAdmin, ComplaintController.getComplaints);
router.get('/complaints/:complaintId', authorizeAdmin, ComplaintController.getComplaintDetail);
router.post('/complaints/:complaintId/resolve', authorizeAdmin, ComplaintController.resolveComplaint);
router.post(
  '/complaints/:complaintId/messages',
  authorizeAdmin,
  upload.array('images', 5),
  ComplaintController.addMessageToTicket
);

// Reviews
router.get('/reviews', authorizeAdmin, ReviewModerationController.getReviews);
router.post('/reviews/:reviewId/moderate', authorizeAdmin, ReviewModerationController.moderateReview);
router.delete('/reviews/:reviewId', authorizeAdmin, ReviewModerationController.deleteReview);

// Badges
router.get('/badges/rules', authorizeAdmin, BadgeController.getBadgeRules);
router.post('/badges/rules', authorizeAdmin, BadgeController.createBadgeRule);
router.patch('/badges/rules/:badgeId', authorizeAdmin, BadgeController.updateBadgeRule);
router.delete('/badges/rules/:badgeId', authorizeAdmin, BadgeController.deleteBadgeRule);
router.get('/badges/history', authorizeAdmin, BadgeController.getVendorBadgeHistory);
router.post('/badges/assign', authorizeAdmin, BadgeController.assignBadge);
router.delete('/badges/assign/:vendorId', authorizeAdmin, BadgeController.unassignBadge);
router.post('/badges/:vendorId/auto-assign', authorizeAdmin, BadgeController.autoAssignVendorBadge);
router.post('/badges/process-all', authorizeAdmin, BadgeController.processAllVendorBadges);

export default router;
