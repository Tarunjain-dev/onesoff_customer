"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const AdminDashboardController_1 = require("../controllers/AdminDashboardController");
const AdminProfileController_1 = require("../controllers/AdminProfileController");
const AdminVendorController_1 = require("../controllers/AdminVendorController");
const AdminOrderController_1 = require("../controllers/AdminOrderController");
const AdminCustomerController_1 = require("../controllers/AdminCustomerController");
const AdminReportController_1 = require("../controllers/AdminReportController");
const AdminRefundController_1 = require("../controllers/AdminRefundController");
const AdminFinanceController_1 = require("../controllers/AdminFinanceController");
const AdminSettlementController_1 = require("../controllers/AdminSettlementController");
const AdminCommissionSettingsController_1 = require("../controllers/AdminCommissionSettingsController");
const AdminGeneralSettingsController_1 = require("../controllers/AdminGeneralSettingsController");
const ComplaintController_1 = require("../controllers/ComplaintController");
const ReviewModerationController_1 = require("../controllers/ReviewModerationController");
const BadgeController_1 = require("../controllers/BadgeController");
const KycController_1 = require("../controllers/KycController");
const RentalAvailabilityController_1 = require("../controllers/RentalAvailabilityController");
const AdminProductController_1 = require("../controllers/AdminProductController");
const AdminOperationsController_1 = require("../controllers/AdminOperationsController");
const UploadController_1 = require("../controllers/UploadController");
const TrialRequestController_1 = require("../controllers/TrialRequestController");
const CategoryController_1 = require("../controllers/CategoryController");
const multer_1 = require("../config/multer");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// Dashboard
router.get('/dashboard', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminDashboardController_1.AdminDashboardController.getDashboard);
router.get('/finance/overview', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminFinanceController_1.AdminFinanceController.getOverview);
router.get('/finance/transactions', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminFinanceController_1.AdminFinanceController.getTransactionHistory);
router.get('/profile', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), AdminProfileController_1.AdminProfileController.getProfile);
router.patch('/profile', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), AdminProfileController_1.AdminProfileController.updateProfile);
router.get('/general-settings', auth_1.authorizeAdmin, AdminGeneralSettingsController_1.AdminGeneralSettingsController.getSettings);
router.post('/general-settings', auth_1.authorizeAdmin, AdminGeneralSettingsController_1.AdminGeneralSettingsController.createSettings);
router.put('/general-settings', auth_1.authorizeAdmin, AdminGeneralSettingsController_1.AdminGeneralSettingsController.updateSettings);
router.delete('/general-settings', auth_1.authorizeAdmin, AdminGeneralSettingsController_1.AdminGeneralSettingsController.deleteSettings);
router.get('/settings/commission', auth_1.authorizeAdmin, AdminCommissionSettingsController_1.AdminCommissionSettingsController.getSettings);
router.patch('/settings/commission', auth_1.authorizeAdmin, AdminCommissionSettingsController_1.AdminCommissionSettingsController.updateSettings);
// Vendors
router.get('/vendors', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminVendorController_1.AdminVendorController.getVendors);
router.get('/vendors/:vendorId', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminVendorController_1.AdminVendorController.getVendorDetail);
router.get('/rental-availability/products', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, RentalAvailabilityController_1.RentalAvailabilityController.getProductsByAdmin);
router.get('/rental-availability/calendar', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, RentalAvailabilityController_1.RentalAvailabilityController.getCalendarByAdmin);
router.post('/rental-availability/date', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, RentalAvailabilityController_1.RentalAvailabilityController.upsertDateByAdmin);
router.post('/rental-availability/clear-month', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, RentalAvailabilityController_1.RentalAvailabilityController.clearMonthByAdmin);
router.get('/vendors/:vendorId/kyc', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, KycController_1.KycController.getVendorKycByAdmin);
router.patch('/vendors/:vendorId/status', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminVendorController_1.AdminVendorController.updateStatus);
router.post('/vendors/:vendorId/document-resubmission', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminVendorController_1.AdminVendorController.requestDocumentResubmission);
router.patch('/vendors/:vendorId/commission', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminVendorController_1.AdminVendorController.updateCommission);
router.delete('/vendors/:vendorId', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminVendorController_1.AdminVendorController.deleteVendor);
// Products
router.get('/categories', auth_1.authorizeAdmin, CategoryController_1.CategoryController.listCategories);
router.post('/categories', auth_1.authorizeAdmin, CategoryController_1.CategoryController.createCategory);
router.patch('/categories/:categoryId', auth_1.authorizeAdmin, CategoryController_1.CategoryController.updateCategory);
router.delete('/categories/:categoryId', auth_1.authorizeAdmin, CategoryController_1.CategoryController.deleteCategory);
router.patch('/products/:id', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminProductController_1.AdminProductController.updateProduct);
router.post('/products/:id/approval-stage-1', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminProductController_1.AdminProductController.approveStageOne);
router.post('/products/:id/approval-stage-2', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminProductController_1.AdminProductController.approveStageTwo);
router.post('/products/:id/reject-approval', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminProductController_1.AdminProductController.rejectApproval);
router.post('/products/:id/approve-withdrawal', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminProductController_1.AdminProductController.approveWithdrawal);
router.delete('/products/:id', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminProductController_1.AdminProductController.deleteProduct);
router.post('/products/:id/variants', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminProductController_1.AdminProductController.addVariant);
router.delete('/products/:id/variants/:variantId', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminProductController_1.AdminProductController.deleteVariant);
router.post('/products/upload', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), multer_1.upload.array('images', 5), UploadController_1.UploadController.uploadProductImages);
// Orders
router.get('/orders', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminOrderController_1.AdminOrderController.getOrders);
router.get('/orders/:orderId', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminOrderController_1.AdminOrderController.getOrderDetail);
router.post('/orders/:orderId/cancel', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminOrderController_1.AdminOrderController.cancelOrder);
router.patch('/orders/:orderId/status', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminOrderController_1.AdminOrderController.overrideStatus);
// Customers
router.get('/customers', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminCustomerController_1.AdminCustomerController.getCustomers);
// Reports
router.get('/reports/overview', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminReportController_1.AdminReportController.getOverview);
// Trial Requests
router.get('/trial-requests', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, TrialRequestController_1.TrialRequestController.getAdminScopedRequests);
router.post('/trial-requests/response', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, TrialRequestController_1.TrialRequestController.adminScopedRespond);
router.post('/trial-requests/start', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, TrialRequestController_1.TrialRequestController.adminScopedStart);
router.post('/trial-requests/complete', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, TrialRequestController_1.TrialRequestController.adminScopedFinalize);
// Operations
router.get('/operations/quality-check', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminOperationsController_1.AdminOperationsController.getQualityChecks);
router.post('/operations/quality-check/:orderItemId/inspect', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminOperationsController_1.AdminOperationsController.inspectQualityCheck);
router.get('/operations/damage-claims', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminOperationsController_1.AdminOperationsController.getDamageClaims);
router.post('/operations/damage-claims/:claimId/review', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminOperationsController_1.AdminOperationsController.reviewDamageClaim);
router.get('/operations/maintenance', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminOperationsController_1.AdminOperationsController.getMaintenanceTasks);
router.patch('/operations/maintenance/:taskId/status', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminOperationsController_1.AdminOperationsController.updateMaintenanceTaskStatus);
router.get('/operations/repairs', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminOperationsController_1.AdminOperationsController.getRepairTasks);
router.patch('/operations/repairs/:repairId', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminOperationsController_1.AdminOperationsController.updateRepairTask);
router.patch('/operations/issues/:orderItemId', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminOperationsController_1.AdminOperationsController.updateIssueTask);
// Refunds
router.get('/refunds', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminRefundController_1.AdminRefundController.getRefundRequests);
router.post('/refunds/:returnId/process', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminRefundController_1.AdminRefundController.processRefund);
router.post('/refunds/:returnId/remind', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminRefundController_1.AdminRefundController.remindRefund);
// Settlements
router.get('/owner-payouts', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminSettlementController_1.AdminSettlementController.getOwnerPayoutSummaries);
router.get('/owner-payouts/:vendorId', (0, auth_1.authorize)(['ADMIN', 'ADMIN_AS_VENDOR']), auth_1.vendorFilter, AdminSettlementController_1.AdminSettlementController.getOwnerPayoutDetail);
router.get('/settlements', auth_1.authorizeAdmin, AdminSettlementController_1.AdminSettlementController.getSettlements);
router.post('/settlements/:vendorId/mark-paid', auth_1.authorizeAdmin, AdminSettlementController_1.AdminSettlementController.markPaid);
router.post('/settlements/:vendorId/reject', auth_1.authorizeAdmin, AdminSettlementController_1.AdminSettlementController.reject);
// Complaints
router.get('/complaints', auth_1.authorizeAdmin, ComplaintController_1.ComplaintController.getComplaints);
router.get('/complaints/:complaintId', auth_1.authorizeAdmin, ComplaintController_1.ComplaintController.getComplaintDetail);
router.post('/complaints/:complaintId/resolve', auth_1.authorizeAdmin, ComplaintController_1.ComplaintController.resolveComplaint);
router.post('/complaints/:complaintId/messages', auth_1.authorizeAdmin, multer_1.upload.array('images', 5), ComplaintController_1.ComplaintController.addMessageToTicket);
// Reviews
router.get('/reviews', auth_1.authorizeAdmin, ReviewModerationController_1.ReviewModerationController.getReviews);
router.post('/reviews/:reviewId/moderate', auth_1.authorizeAdmin, ReviewModerationController_1.ReviewModerationController.moderateReview);
router.delete('/reviews/:reviewId', auth_1.authorizeAdmin, ReviewModerationController_1.ReviewModerationController.deleteReview);
// Badges
router.get('/badges/rules', auth_1.authorizeAdmin, BadgeController_1.BadgeController.getBadgeRules);
router.post('/badges/rules', auth_1.authorizeAdmin, BadgeController_1.BadgeController.createBadgeRule);
router.patch('/badges/rules/:badgeId', auth_1.authorizeAdmin, BadgeController_1.BadgeController.updateBadgeRule);
router.delete('/badges/rules/:badgeId', auth_1.authorizeAdmin, BadgeController_1.BadgeController.deleteBadgeRule);
router.get('/badges/history', auth_1.authorizeAdmin, BadgeController_1.BadgeController.getVendorBadgeHistory);
router.post('/badges/assign', auth_1.authorizeAdmin, BadgeController_1.BadgeController.assignBadge);
router.delete('/badges/assign/:vendorId', auth_1.authorizeAdmin, BadgeController_1.BadgeController.unassignBadge);
router.post('/badges/:vendorId/auto-assign', auth_1.authorizeAdmin, BadgeController_1.BadgeController.autoAssignVendorBadge);
router.post('/badges/process-all', auth_1.authorizeAdmin, BadgeController_1.BadgeController.processAllVendorBadges);
exports.default = router;
