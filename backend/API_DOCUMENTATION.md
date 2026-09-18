# ONESOFF RENTAL MARKETPLACE - API DOCUMENTATION

## Base URL
```
http://localhost:3000
```

---

## 🔐 AUTHENTICATION
All protected routes require JWT token in header:
```
Authorization: Bearer <token>
```

---

## 1️⃣ VENDOR KYC & ONBOARDING

### Upload KYC Documents (Vendor)
```http
POST /kyc/upload
Authorization: Bearer <vendor_token>

Body:
{
  "aadhaarNumber": "1234-5678-9012",
  "aadhaarFrontUrl": "https://...",
  "aadhaarBackUrl": "https://...",
  "panNumber": "ABCDE1234F",
  "panUrl": "https://..."
}

Response:
{
  "success": true,
  "message": "KYC documents uploaded successfully",
  "data": {
    "id": "kyc_id",
    "status": "PENDING",
    "vendorId": "vendor_id"
  }
}
```

### Get KYC Status (Vendor)
```http
GET /kyc/status
Authorization: Bearer <vendor_token>

Response:
{
  "success": true,
  "data": {
    "status": "PENDING",
    "onboardingStatus": "PENDING_DOCS",
    "canReceiveOrders": false
  }
}
```

### Review KYC (Admin)
```http
POST /kyc/review
Authorization: Bearer <admin_token>

Body:
{
  "vendorId": "vendor_id",
  "status": "APPROVED", // or "REJECTED"
  "remarks": "All documents verified"
}

Response:
{
  "success": true,
  "message": "KYC approved successfully"
}
```

### Get Pending KYC (Admin)
```http
GET /kyc/pending?page=1&limit=10
Authorization: Bearer <admin_token>
```

---

## 2️⃣ ORDER MANAGEMENT (ESCROW)

### Create Order (Customer) - CRITICAL ESCROW CREATION
```http
POST /orders/create
Authorization: Bearer <customer_token>

Body:
{
  "items": [
    {
      "productId": "prod_id",
      "variantId": "variant_id",
      "vendorId": "vendor_id",
      "quantity": 1
    }
  ],
  "startDate": "2024-03-01",
  "endDate": "2024-03-05",
  "paymentDetails": {
    "paymentId": "razorpay_payment_id",
    "signature": "signature"
  }
}

Response:
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "id": "order_id",
    "orderNo": "ORD123456",
    "totalRent": 2000,
    "totalDeposit": 5000,
    "finalPayable": 7000,
    "paymentStatus": "PAID"
  }
}

CRITICAL: Money now belongs to PLATFORM, not vendor
```

### Vendor Accept/Reject Order
```http
POST /orders/vendor/response
Authorization: Bearer <vendor_token>

Body:
{
  "orderItemId": "item_id",
  "action": "ACCEPT" // or "REJECT"
}

Response:
{
  "success": true,
  "message": "Order accepted successfully"
}

Note: If REJECT, full refund processed automatically
```

### Get Vendor Orders
```http
GET /orders/vendor?status=PLACED&page=1&limit=10
Authorization: Bearer <vendor_token>
```

### Get Customer Orders
```http
GET /orders/customer?page=1&limit=10
Authorization: Bearer <customer_token>
```

### Update Order Status (Vendor)
```http
PUT /orders/vendor/status
Authorization: Bearer <vendor_token>

Body:
{
  "orderItemId": "item_id",
  "status": "DISPATCHED" // or "DELIVERED"
}
```

---

## 3️⃣ RETURN & REFUND MANAGEMENT

### Initiate Return (Customer)
```http
POST /returns/initiate
Authorization: Bearer <customer_token>

Body:
{
  "orderItemId": "item_id",
  "returnReason": "Rental period completed"
}

Response:
{
  "success": true,
  "message": "Return initiated successfully",
  "data": {
    "id": "return_id",
    "inspectionStatus": "PENDING_PICKUP"
  }
}
```

### Vendor Inspection (Vendor) - NOT FINAL DECISION
```http
POST /returns/vendor/inspection
Authorization: Bearer <vendor_token>

Body:
{
  "returnId": "return_id",
  "inspectionData": {
    "vendorAccepted": true,
    "lateFee": 0,
    "damageCharge": 0,
    "vendorNotes": "Item in perfect condition"
  }
}

Response:
{
  "success": true,
  "message": "Inspection submitted for admin review"
}

Note: Vendor decision is NOT final. Admin decides refund.
```

### Admin Refund Decision (Admin) - MOST CRITICAL
```http
POST /returns/admin/decision
Authorization: Bearer <admin_token>

Body:
{
  "returnId": "return_id",
  "refundDecision": {
    "approved": true,
    "finalLateFee": 0,
    "finalDamageCharge": 0,
    "adminNotes": "Approved full refund"
  }
}

Response:
{
  "success": true,
  "message": "Refund decision processed",
  "data": {
    "finalRefund": 5000,
    "depositStatus": "REFUNDED"
  }
}

CRITICAL: 
- Admin is final authority
- Refund = deposit - lateFee - damageCharge
- Vendor earning created ONLY after admin approval
```

### Get Vendor Returns
```http
GET /returns/vendor?status=PENDING_ADMIN&page=1&limit=10
Authorization: Bearer <vendor_token>
```

### Get Admin Returns
```http
GET /returns/admin?status=PENDING_ADMIN&page=1&limit=10
Authorization: Bearer <admin_token>
```

### Get Customer Returns
```http
GET /returns/customer?page=1&limit=10
Authorization: Bearer <customer_token>
```

---

## 4️⃣ VENDOR EARNINGS & SETTLEMENT

### Get Vendor Balance
```http
GET /vendors/balance
Authorization: Bearer <vendor_token>

Response:
{
  "success": true,
  "data": {
    "totalCredits": 15000,
    "totalDebits": 500,
    "availableBalance": 14500
  }
}
```

### Get Vendor Transactions
```http
GET /vendors/transactions?page=1&limit=10
Authorization: Bearer <vendor_token>
```

### Get Vendor Settlements
```http
GET /vendors/settlements?page=1&limit=10
Authorization: Bearer <vendor_token>
```

### Create Settlement (Admin)
```http
POST /vendors/admin/settlement/create
Authorization: Bearer <admin_token>

Body:
{
  "vendorId": "vendor_id"
}

Response:
{
  "success": true,
  "message": "Settlement created",
  "data": {
    "id": "settlement_id",
    "totalAmount": 15000,
    "commission": 1500,
    "payableAmount": 13500,
    "status": "PENDING"
  }
}
```

### Approve Settlement (Admin) - Transfers Money
```http
POST /vendors/admin/settlement/approve
Authorization: Bearer <admin_token>

Body:
{
  "settlementId": "settlement_id"
}

Response:
{
  "success": true,
  "message": "Settlement approved and paid",
  "data": {
    "status": "COMPLETED",
    "settlementDate": "2024-02-16T10:30:00Z"
  }
}

CRITICAL: This is when vendor actually receives money
```

### Get Pending Settlements (Admin)
```http
GET /vendors/admin/settlements/pending?page=1&limit=10
Authorization: Bearer <admin_token>
```

---

## 🔄 COMPLETE FLOW EXAMPLE

### 1. Vendor Onboarding
```
1. Vendor registers → onboardingStatus = PENDING_DOCS
2. POST /kyc/upload → uploads Aadhaar
3. Admin: POST /kyc/review → APPROVED
4. Vendor: onboardingStatus = ACTIVE
5. ✅ Vendor can now receive orders
```

### 2. Order Placement (Escrow)
```
1. Customer selects product, dates
2. Platform calculates: rent + deposit
3. Customer pays via payment gateway
4. POST /orders/create → Order created
5. ✅ Money now belongs to PLATFORM
6. Vendor notified
```

### 3. Vendor Acceptance
```
1. Vendor has 24 hours
2. POST /orders/vendor/response → ACCEPT
3. If REJECT → auto refund to customer
```

### 4. Delivery
```
1. PUT /orders/vendor/status → DISPATCHED
2. PUT /orders/vendor/status → DELIVERED
3. Rental period starts
```

### 5. Return & Refund
```
1. POST /returns/initiate → Customer returns
2. POST /returns/vendor/inspection → Vendor inspects
3. POST /returns/admin/decision → Admin decides refund
4. ✅ Customer receives refund
5. ✅ Vendor earning created (rent only)
```

### 6. Settlement
```
1. POST /vendors/admin/settlement/create → Admin creates batch
2. POST /vendors/admin/settlement/approve → Admin pays vendor
3. ✅ Vendor receives money
```

---

## 💰 FINANCIAL CONTROL MODEL

| Money Type | Owner | When |
|------------|-------|------|
| Customer Payment | Platform | After payment captured |
| Deposit | Platform | Held until admin decision |
| Rent | Vendor earning | After admin approves return |
| Penalty | Platform | From deposit deductions |
| Refund | Customer | After admin decision |
| Payout | Vendor | After admin approves settlement |

---

## ⚠️ CRITICAL RULES

1. **Vendor cannot receive orders until onboardingStatus = ACTIVE**
2. **Money ALWAYS goes to platform first, never directly to vendor**
3. **Vendor decision on return is NOT final - Admin decides**
4. **Vendor earns ONLY rent portion, NOT deposit**
5. **Platform controls settlement timing - no instant payouts**
6. **Admin is financial authority for all disputes**

---

## 🔒 ROLE-BASED ACCESS

| Endpoint | Customer | Vendor | Admin |
|----------|----------|--------|-------|
| Create Order | ✅ | ❌ | ❌ |
| Accept Order | ❌ | ✅ | ❌ |
| Initiate Return | ✅ | ❌ | ❌ |
| Vendor Inspection | ❌ | ✅ | ❌ |
| Admin Refund Decision | ❌ | ❌ | ✅ |
| Create Settlement | ❌ | ❌ | ✅ |
| Approve Settlement | ❌ | ❌ | ✅ |
| Review KYC | ❌ | ❌ | ✅ |

---

**Platform = Financial Mediator + Trust Authority**
