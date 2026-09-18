# ADMIN PANEL - TESTING CHECKLIST

## Pre-Testing Setup

### 1. Database Migration
- [ ] Run `npx prisma migrate dev --name add_admin_panel_tables`
- [ ] Run `npx prisma generate`
- [ ] Verify new tables exist in database

### 2. Create Admin User
- [ ] Create admin user with role='ADMIN'
- [ ] Set password for admin user
- [ ] Verify admin can login

### 3. Seed Test Data (Optional)
- [ ] Create 5-10 test vendors
- [ ] Create 20-30 test products
- [ ] Create 10-15 test orders
- [ ] Create 3-5 pending returns
- [ ] Create 2-3 complaints
- [ ] Create 5-10 reviews

---

## Authentication Tests

### Admin Login
- [ ] POST `/auth/login` with admin credentials
- [ ] Verify JWT token received
- [ ] Verify token contains role='ADMIN'
- [ ] Test wrong password (should fail)
- [ ] Test non-admin user accessing admin routes (should fail 403)

---

## Dashboard Tests

### GET /admin/dashboard
- [ ] Returns all 8 stats correctly
- [ ] Returns recent orders (max 5)
- [ ] Returns pending complaints (max 5)
- [ ] Returns new vendor docs (max 5)
- [ ] Stats match actual database counts
- [ ] Response time < 2 seconds

---

## Vendor Management Tests

### GET /admin/vendors
- [ ] Returns all vendors without filters
- [ ] Filter by status=ACTIVE works
- [ ] Filter by status=SUSPENDED works
- [ ] Filter by city works
- [ ] Filter by dateFrom works
- [ ] Multiple filters work together
- [ ] Returns vendor profile data
- [ ] Returns order counts

### GET /admin/vendors/:vendorId
- [ ] Returns complete vendor details
- [ ] Returns KYC information
- [ ] Returns performance metrics
- [ ] Returns completed/total orders count
- [ ] Invalid vendorId returns 404

### PATCH /admin/vendors/:vendorId/status
- [ ] Can activate vendor (PENDING_DOCS → ACTIVE)
- [ ] Can suspend vendor (ACTIVE → SUSPENDED)
- [ ] Invalid status returns error
- [ ] Status change persists in database

### PATCH /admin/vendors/:vendorId/commission
- [ ] Can update commission percentage
- [ ] Commission value validates (0-100)
- [ ] Change persists in database
- [ ] Negative values rejected

---

## Order Management Tests

### GET /admin/orders
- [ ] Returns all orders without filters
- [ ] Filter by dateFrom works
- [ ] Filter by dateTo works
- [ ] Filter by vendorId works
- [ ] Filter by status works
- [ ] Filter by paymentStatus works
- [ ] Returns customer, vendor, product details
- [ ] Pagination works (if implemented)

### GET /admin/orders/:orderId
- [ ] Returns complete order details
- [ ] Returns customer information
- [ ] Returns product information
- [ ] Returns timeline data
- [ ] Returns financial breakdown
- [ ] Returns platform ledger entries
- [ ] Invalid orderId returns 404

### POST /admin/orders/:orderId/cancel
- [ ] Can cancel PLACED order
- [ ] Can cancel ACCEPTED order
- [ ] Cannot cancel COMPLETED order
- [ ] Cannot cancel already CANCELLED order
- [ ] Refund ledger entry created
- [ ] Order status updated to CANCELLED
- [ ] Reason saved in database

### PATCH /admin/orders/:orderId/status
- [ ] Can override order status
- [ ] Status change persists
- [ ] Invalid status rejected
- [ ] Cannot set invalid state transitions (optional validation)

---

## Refund Management Tests

### GET /admin/refunds
- [ ] Returns all pending refund requests
- [ ] Returns inspection details
- [ ] Returns vendor notes
- [ ] Returns late fees and damage charges
- [ ] Returns order and customer details
- [ ] Empty array if no pending refunds

### POST /admin/refunds/:returnId/process
- [ ] FULL refund works (refunds full deposit)
- [ ] PARTIAL refund works (refunds specified amount)
- [ ] FORFEIT works (no refund)
- [ ] Partial requires refundAmount
- [ ] Return status updated to REFUND_APPROVED
- [ ] Order status updated to COMPLETED
- [ ] Platform ledger entry created
- [ ] Cannot process already processed return
- [ ] Invalid returnId returns 404

---

## Wallet Tests

### GET /admin/wallet
- [ ] Returns totalHeldDeposits correctly
- [ ] Returns pendingRefunds correctly
- [ ] Returns vendorPayables correctly
- [ ] Returns platformEarnings correctly
- [ ] All amounts match database aggregations

### GET /admin/wallet/transactions
- [ ] Returns transaction history
- [ ] Default limit is 50
- [ ] Custom limit works
- [ ] Returns order details
- [ ] Sorted by date (newest first)
- [ ] Running balance calculated correctly

---

## Settlement Tests

### GET /admin/settlements
- [ ] Returns pending settlements grouped by vendor
- [ ] Returns sum of rentAmount
- [ ] Returns sum of commissionAmount
- [ ] Returns sum of netEarnings
- [ ] Returns count of orders
- [ ] Empty array if no pending settlements

### POST /admin/settlements/:vendorId/mark-paid
- [ ] Marks all pending settlements as SETTLED
- [ ] Sets settledAt timestamp
- [ ] Date range filter works (from/to)
- [ ] Without date range, settles all pending
- [ ] Invalid vendorId returns error

---

## Complaint Tests

### GET /admin/complaints
- [ ] Returns all complaints without filter
- [ ] Filter by status=PENDING works
- [ ] Filter by status=RESOLVED works
- [ ] Returns order details
- [ ] Returns raisedBy user details
- [ ] Returns against user details

### GET /admin/complaints/:complaintId
- [ ] Returns complete complaint details
- [ ] Returns evidence
- [ ] Returns order information
- [ ] Invalid complaintId returns 404

### POST /admin/complaints/:complaintId/resolve
- [ ] REFUND_CUSTOMER resolution works
- [ ] PENALIZE_VENDOR resolution works
- [ ] REJECT resolution works
- [ ] Status updated to RESOLVED
- [ ] Resolution and notes saved
- [ ] resolvedAt timestamp set
- [ ] Cannot resolve already resolved complaint

---

## Review Moderation Tests

### GET /admin/reviews
- [ ] Returns all reviews without filter
- [ ] Filter by status=PENDING works
- [ ] Filter by status=APPROVED works
- [ ] Filter by status=REJECTED works
- [ ] Returns customer details
- [ ] Returns product details
- [ ] Returns vendor details (through product)

### POST /admin/reviews/:reviewId/moderate
- [ ] APPROVE action works
- [ ] REJECT action works
- [ ] Status updated correctly
- [ ] Moderation reason saved (if provided)
- [ ] Invalid reviewId returns 404
- [ ] Invalid action rejected

---

## Badge System Tests

### GET /admin/badges/rules
- [ ] Returns all badge rules
- [ ] Sorted by minOrders ascending
- [ ] Empty array if no rules

### POST /admin/badges/rules
- [ ] Can create new badge rule
- [ ] Name must be unique
- [ ] All fields required
- [ ] Duplicate name rejected
- [ ] Negative values rejected

### GET /admin/badges/history
- [ ] Returns all badge assignments without filter
- [ ] Filter by vendorId works
- [ ] Returns vendor details
- [ ] Returns badge details
- [ ] Shows assignedAt and removedAt dates

### POST /admin/badges/assign
- [ ] Can assign badge to vendor
- [ ] Previous badge removed (removedAt set)
- [ ] New badge assigned
- [ ] assignedAt timestamp set
- [ ] Invalid vendorId rejected
- [ ] Invalid badgeId rejected

---

## Authorization Tests

### All Admin Routes
- [ ] Require authentication (401 without token)
- [ ] Require admin role (403 for non-admin)
- [ ] Valid admin token allows access
- [ ] Expired token rejected
- [ ] Invalid token rejected

---

## Error Handling Tests

### General
- [ ] Invalid JSON returns 400
- [ ] Missing required fields return 400
- [ ] Invalid IDs return 404
- [ ] Database errors return 500
- [ ] Error messages are descriptive
- [ ] No sensitive data in error responses

---

## Performance Tests

### Response Times
- [ ] Dashboard loads < 2 seconds
- [ ] List endpoints < 1 second
- [ ] Detail endpoints < 500ms
- [ ] Update operations < 500ms

### Database Queries
- [ ] No N+1 query problems
- [ ] Proper use of includes/joins
- [ ] Indexes on foreign keys
- [ ] Aggregations optimized

---

## Data Integrity Tests

### Refund Processing
- [ ] Platform ledger balance correct after refund
- [ ] Deposit status updated correctly
- [ ] Order status transitions valid
- [ ] No duplicate refunds possible

### Settlement Processing
- [ ] Vendor earnings calculated correctly
- [ ] Commission deducted properly
- [ ] Cannot settle already settled earnings
- [ ] Settlement totals match individual earnings

### Order Cancellation
- [ ] Refund amount correct (rent + deposit)
- [ ] Platform ledger updated
- [ ] Order status updated
- [ ] Cannot cancel twice

---

## Integration Tests

### Complete Flows
- [ ] **Vendor Onboarding Flow:**
  - Create vendor → Upload KYC → Admin activates → Vendor can create products

- [ ] **Order to Refund Flow:**
  - Customer orders → Vendor delivers → Customer returns → Vendor inspects → Admin decides refund

- [ ] **Settlement Flow:**
  - Orders completed → Vendor earnings created → Admin marks paid → Status updated

- [ ] **Complaint Flow:**
  - User raises complaint → Admin reviews → Admin resolves → Status updated

- [ ] **Review Flow:**
  - Customer submits review → Admin moderates → Review approved/rejected

---

## Testing Tools

### Recommended Tools
- **Postman/Thunder Client:** API testing
- **Prisma Studio:** Database inspection
- **Jest/Supertest:** Automated testing (optional)

### Sample Postman Collection Structure
```
Admin Panel Tests
├── Auth
│   └── Admin Login
├── Dashboard
│   └── Get Dashboard
├── Vendors
│   ├── List Vendors
│   ├── Get Vendor Detail
│   ├── Update Status
│   └── Update Commission
├── Orders
│   ├── List Orders
│   ├── Get Order Detail
│   ├── Cancel Order
│   └── Override Status
├── Refunds
│   ├── List Refund Requests
│   └── Process Refund
├── Wallet
│   ├── Get Overview
│   └── Get Transactions
├── Settlements
│   ├── List Settlements
│   └── Mark Paid
├── Complaints
│   ├── List Complaints
│   ├── Get Detail
│   └── Resolve
├── Reviews
│   ├── List Reviews
│   └── Moderate
└── Badges
    ├── List Rules
    ├── Create Rule
    ├── Get History
    └── Assign Badge
```

---

## Test Data Cleanup

After testing:
- [ ] Remove test data from database
- [ ] Reset sequences if needed
- [ ] Verify production data not affected

---

## Sign-Off

- [ ] All critical tests passed
- [ ] All endpoints documented
- [ ] Error handling verified
- [ ] Performance acceptable
- [ ] Security validated
- [ ] Ready for production deployment

**Tested By:** _______________
**Date:** _______________
**Status:** ⬜ PASS | ⬜ FAIL

---

**Happy Testing!** 🧪
