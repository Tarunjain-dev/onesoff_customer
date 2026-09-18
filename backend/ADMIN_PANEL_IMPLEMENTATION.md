# ADMIN PANEL - BACKEND IMPLEMENTATION

## Overview
Complete admin control panel backend for cloth renting platform with escrow authority and platform control.

## Authentication
All admin routes require:
- Bearer token in Authorization header
- User role must be ADMIN

Base URL: `/admin`

---

## 1. DASHBOARD

### GET /admin/dashboard
Get complete dashboard overview with stats and preview data.

**Response:**
```json
{
  "stats": {
    "totalVendors": 150,
    "activeVendors": 120,
    "totalCustomers": 5000,
    "activeOrders": 45,
    "pendingReturns": 12,
    "pendingRefundAmount": 125000,
    "todayRevenue": 45000,
    "escrowBalance": 2500000
  },
  "recentOrders": [...],
  "pendingComplaints": [...],
  "newVendorDocs": [...]
}
```

---

## 2. VENDOR MANAGEMENT

### GET /admin/vendors
Get vendor list with filters.

**Query Params:**
- `status`: PENDING_DOCS | ACTIVE | SUSPENDED
- `city`: string
- `badge`: string
- `dateFrom`: ISO date

**Response:** Array of vendors with profile, KYC status, and order counts.

### GET /admin/vendors/:vendorId
Get detailed vendor information.

**Response:**
```json
{
  "id": "123",
  "name": "Vendor Name",
  "email": "vendor@example.com",
  "phone": "9876543210",
  "onboardingStatus": "ACTIVE",
  "vendorProfile": {
    "shopName": "Shop Name",
    "ownerName": "Owner Name",
    "address": "Address",
    "city": "City",
    "commissionRate": 15,
    "kyc": {
      "aadhaarNumber": "1234-5678-9012",
      "aadhaarFront": "url",
      "aadhaarBack": "url",
      "verificationStatus": "VERIFIED"
    }
  },
  "completedOrders": 50,
  "totalOrders": 75
}
```

### PATCH /admin/vendors/:vendorId/status
Update vendor onboarding status.

**Body:**
```json
{
  "status": "ACTIVE" | "SUSPENDED" | "PENDING_DOCS"
}
```

### PATCH /admin/vendors/:vendorId/commission
Update vendor commission percentage.

**Body:**
```json
{
  "commission": 15
}
```

---

## 3. ORDER MANAGEMENT

### GET /admin/orders
Get order list with filters.

**Query Params:**
- `dateFrom`: ISO date
- `dateTo`: ISO date
- `vendorId`: string
- `status`: OrderItemStatus enum
- `paymentStatus`: PaymentStatus enum

**Response:** Array of orders with customer, vendor, and product details.

### GET /admin/orders/:orderId
Get detailed order information including timeline and financials.

### POST /admin/orders/:orderId/cancel
Admin cancels order and processes refund.

**Body:**
```json
{
  "reason": "Admin cancellation reason"
}
```

### PATCH /admin/orders/:orderId/status
Override order status manually.

**Body:**
```json
{
  "status": "DELIVERED" | "COMPLETED" | etc.
}
```

---

## 4. RETURN & REFUND MANAGEMENT

### GET /admin/refunds
Get all pending refund requests with inspection details.

**Response:**
```json
[
  {
    "id": "return123",
    "order": {
      "orderNo": "ORD-001",
      "customer": {...},
      "vendor": {...},
      "product": {...}
    },
    "depositAmount": 5000,
    "lateFee": 500,
    "damageCharge": 1000,
    "vendorNotes": "Minor damage on sleeve",
    "status": "INSPECTION_PENDING"
  }
]
```

### POST /admin/refunds/:returnId/process
Admin makes final refund decision.

**Body:**
```json
{
  "decision": "FULL" | "PARTIAL" | "FORFEIT",
  "refundAmount": 3500  // Required only for PARTIAL
}
```

**Decision Logic:**
- `FULL`: Refund full deposit amount
- `PARTIAL`: Refund specified amount (deduct damage/late fees)
- `FORFEIT`: No refund (deposit forfeited)

---

## 5. PLATFORM WALLET (ESCROW)

### GET /admin/wallet
Get wallet overview with all financial metrics.

**Response:**
```json
{
  "totalHeldDeposits": 500000,
  "pendingRefunds": 125000,
  "vendorPayables": 250000,
  "platformEarnings": 1500000
}
```

### GET /admin/wallet/transactions
Get platform ledger transactions.

**Query Params:**
- `limit`: number (default: 50)

**Response:** Array of transactions with order details and running balance.

---

## 6. VENDOR SETTLEMENTS

### GET /admin/settlements
Get pending settlements grouped by vendor.

**Response:**
```json
[
  {
    "vendorId": "123",
    "_sum": {
      "rentAmount": 50000,
      "commissionAmount": 7500,
      "netEarnings": 42500
    },
    "_count": {
      "orderId": 25
    }
  }
]
```

### POST /admin/settlements/:vendorId/mark-paid
Mark vendor settlement as paid.

**Body (optional):**
```json
{
  "from": "2024-01-01T00:00:00Z",
  "to": "2024-01-31T23:59:59Z"
}
```

---

## 7. COMPLAINT MANAGEMENT

### GET /admin/complaints
Get complaints list.

**Query Params:**
- `status`: PENDING | RESOLVED

**Response:** Array of complaints with order and user details.

### GET /admin/complaints/:complaintId
Get detailed complaint information.

### POST /admin/complaints/:complaintId/resolve
Resolve complaint with action.

**Body:**
```json
{
  "resolution": "REFUND_CUSTOMER" | "PENALIZE_VENDOR" | "REJECT",
  "notes": "Resolution explanation"
}
```

---

## 8. REVIEW MODERATION

### GET /admin/reviews
Get reviews for moderation.

**Query Params:**
- `status`: PENDING | APPROVED | REJECTED

**Response:** Array of reviews with customer, product, and vendor details.

### POST /admin/reviews/:reviewId/moderate
Approve or reject review.

**Body:**
```json
{
  "action": "APPROVE" | "REJECT",
  "reason": "Optional moderation reason"
}
```

---

## 9. BADGE SYSTEM

### GET /admin/badges/rules
Get all badge rules.

**Response:**
```json
[
  {
    "id": "1",
    "name": "Gold Vendor",
    "minOrders": 100,
    "maxLatePercent": 5,
    "maxDamagePercent": 2
  }
]
```

### POST /admin/badges/rules
Create new badge rule.

**Body:**
```json
{
  "name": "Platinum Vendor",
  "minOrders": 500,
  "maxLatePercent": 2,
  "maxDamagePercent": 1
}
```

### GET /admin/badges/history
Get vendor badge assignment history.

**Query Params:**
- `vendorId`: string (optional)

### POST /admin/badges/assign
Manually assign badge to vendor.

**Body:**
```json
{
  "vendorId": "123",
  "badgeId": "1"
}
```

---

## DATABASE SCHEMA UPDATES

### New Tables Added:

#### Complaint
```prisma
model Complaint {
  id              BigInt
  orderId         BigInt
  raisedById      BigInt
  againstId       BigInt
  type            String
  description     String
  evidence        String?
  status          String (PENDING/RESOLVED)
  resolution      String?
  resolutionNotes String?
  resolvedAt      DateTime?
  createdAt       DateTime
}
```

#### Review
```prisma
model Review {
  id               BigInt
  customerId       BigInt
  productId        BigInt
  orderId          BigInt?
  rating           Int
  comment          String?
  status           String (PENDING/APPROVED/REJECTED)
  moderationReason String?
  createdAt        DateTime
}
```

#### BadgeRule
```prisma
model BadgeRule {
  id               BigInt
  name             String (unique)
  minOrders        Int
  maxLatePercent   Decimal
  maxDamagePercent Decimal
  createdAt        DateTime
}
```

#### VendorBadge
```prisma
model VendorBadge {
  id         BigInt
  vendorId   BigInt
  badgeId    BigInt
  assignedAt DateTime
  removedAt  DateTime?
}
```

---

## ADMIN DECISION FLOW

### Refund Decision Process:
1. Customer returns item
2. Vendor inspects and records findings (late days, damage)
3. Admin reviews inspection
4. Admin makes final decision:
   - Good return → Full refund
   - Minor damage → Partial refund
   - Major damage → Deduct from deposit
   - Lost item → Forfeit deposit

### Complaint Resolution:
1. User raises complaint
2. Admin reviews evidence
3. Admin takes action:
   - Refund customer
   - Penalize vendor
   - Reject complaint

### Vendor Status Control:
- PENDING_DOCS: Cannot receive orders
- ACTIVE: Can receive orders
- SUSPENDED: Temporarily blocked

---

## MIGRATION COMMAND

After schema updates, run:
```bash
npx prisma migrate dev --name add_admin_panel_tables
npx prisma generate
```

---

## IMPLEMENTATION CHECKLIST

✅ Services Created:
- AdminDashboardService
- AdminVendorService
- AdminOrderService
- AdminRefundService
- AdminWalletService
- AdminSettlementService
- ComplaintService
- ReviewModerationService
- BadgeService

✅ Controllers Created:
- AdminDashboardController
- AdminVendorController
- AdminOrderController
- AdminRefundController
- AdminWalletController
- AdminSettlementController
- ComplaintController
- ReviewModerationController
- BadgeController

✅ Routes:
- /admin/* routes registered in app.ts
- All routes protected with authenticate + authorizeAdmin middleware

✅ Database:
- Schema updated with 4 new models
- Relations added to existing models

---

## NEXT STEPS

1. Run Prisma migration to create new tables
2. Test all admin endpoints
3. Implement frontend admin panel UI
4. Add admin user seeding script
5. Configure admin notification system
6. Add audit logging for admin actions
