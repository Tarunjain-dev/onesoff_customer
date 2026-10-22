# ONESOFF RENTAL MARKETPLACE - BACKEND

## 🎯 Platform Type
**Escrow-Based Rental Marketplace** (NOT E-commerce)

Platform Role: **Financial Mediator + Trust Authority**

---

## 🏗️ Architecture

```
Customer Payment → Platform Escrow → Admin Decision → Vendor Payout
                                    ↓
                              Customer Refund
```

### Core Principle
- Money NEVER goes directly to vendor
- Vendor NEVER controls refunds
- Admin is financial authority

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── controllers/          # Request handlers
│   │   ├── OrderController.ts       # Escrow order management
│   │   ├── ReturnController.ts      # Return & refund handling
│   │   ├── VendorController.ts      # Vendor earnings & settlements
│   │   └── KycController.ts         # Vendor onboarding
│   │
│   ├── services/             # Business logic
│   │   ├── OrderService.ts          # Core escrow logic
│   │   ├── ReturnService.ts         # Admin refund decisions
│   │   ├── VendorEarningService.ts  # Earnings & settlements
│   │   ├── KycService.ts            # KYC verification
│   │   ├── PaymentService.ts        # Payment gateway
│   │   └── NotificationService.ts   # Notifications
│   │
│   ├── routes/               # API routes
│   │   ├── orders/
│   │   ├── returns/
│   │   ├── vendors/
│   │   └── kyc/
│   │
│   ├── middlewares/          # Auth, validation, error handling
│   ├── jobs/                 # Cron jobs
│   │   └── orderExpiry.job.ts
│   ├── utils/                # Utilities
│   └── validators/           # Input validation
│
├── prisma/
│   └── schema.prisma         # Database schema
│
├── BUSINESS_LOGIC.md         # Complete business flow
├── API_DOCUMENTATION.md      # API endpoints
└── IMPLEMENTATION_CHECKLIST.md
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Environment
```bash
cp .env .env
```

Edit `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/onesoff"
JWT_SECRET="your-secret-key"
RAZORPAY_KEY_ID="your-razorpay-key"
RAZORPAY_KEY_SECRET="your-razorpay-secret"
```

### 3. Database Setup
```bash
npx prisma generate
npx prisma migrate dev
npx prisma db seed
```

### 4. Run Development Server
```bash
npm run dev
```

Server runs on: `http://localhost:3000`

---

## 🔑 Key Features Implemented

### ✅ Phase 1: Core Escrow System

#### 1. Vendor Onboarding (KYC-Based)
- Vendor uploads Aadhaar
- Admin reviews and approves
- `onboardingStatus = ACTIVE` → can receive orders
- **Rule**: Vendor CANNOT receive orders until ACTIVE

#### 2. Order Placement (Escrow Creation)
- Customer pays → money goes to PLATFORM
- Order created with `depositStatus = HELD`
- Platform wallet ledger entry: `CUSTOMER_PAYMENT`
- Vendor notified with 24-hour acceptance deadline

#### 3. Vendor Acceptance Window
- Vendor can ACCEPT or REJECT
- If REJECT → auto-refund to customer
- Vendor NEVER touches money during rejection

#### 4. Delivery Phase
- Vendor dispatches → `DISPATCHED`
- Customer receives → `DELIVERED`
- Rental period starts

#### 5. Return & Inspection
- Customer initiates return
- Vendor inspects and submits findings
- **Vendor decision is NOT final**

#### 6. Admin Refund Decision (CRITICAL)
- Admin reviews vendor inspection
- Admin calculates: `refund = deposit - lateFee - damageCharge`
- Admin approves refund
- Customer receives money
- **Vendor earning created ONLY after admin approval**

#### 7. Vendor Earnings
- Vendor earns ONLY rent portion (NOT deposit)
- `earning = rent - commission`
- Credit added to vendor balance

#### 8. Vendor Settlement (Batch Payment)
- Admin creates settlement batch
- Admin approves settlement
- Money transferred to vendor
- **Platform controls payout timing**

---

## 🔐 Role-Based Access Control

| Role | Permissions |
|------|-------------|
| **CUSTOMER** | Create orders, initiate returns, view own orders |
| **VENDOR** | Accept/reject orders, submit inspection, view earnings |
| **ADMIN** | Approve KYC, decide refunds, create settlements |

---

## 💰 Financial Control Model

| Money Type | Owner | When |
|------------|-------|------|
| Customer Payment | Platform | After payment captured |
| Deposit | Platform (temporary) | Held until admin decision |
| Rent | Vendor earning | After admin approves return |
| Penalty | Platform | From deposit deductions |
| Refund | Customer | After admin decision |
| Payout | Vendor | After admin approves settlement |

---

## 🔄 Complete Flow Example

```
1. Vendor Onboarding
   └─> Register → Upload KYC → Admin Approves → ACTIVE

2. Order Placement
   └─> Customer Pays → Platform Holds Money → Vendor Notified

3. Vendor Acceptance
   └─> Accept (24hrs) → Order Confirmed
   └─> Reject/Timeout → Auto Refund

4. Delivery
   └─> Dispatch → Deliver → Rental Period

5. Return
   └─> Customer Returns → Vendor Inspects → Admin Decides

6. Refund Decision
   └─> Admin Calculates → Refund Customer → Create Vendor Earning

7. Settlement
   └─> Admin Creates Batch → Admin Approves → Vendor Receives Money
```

---

## 📊 API Endpoints

### KYC & Onboarding
- `POST /kyc/upload` - Upload KYC documents
- `POST /kyc/review` - Admin reviews KYC
- `GET /kyc/status` - Get KYC status

### Orders (Escrow)
- `POST /orders/create` - Create escrow order
- `POST /orders/vendor/response` - Accept/reject order
- `GET /orders/vendor` - Get vendor orders
- `GET /orders/customer` - Get customer orders
- `PUT /orders/vendor/status` - Update order status

### Returns & Refunds
- `POST /returns/initiate` - Customer initiates return
- `POST /returns/vendor/inspection` - Vendor submits inspection
- `POST /returns/admin/decision` - Admin refund decision (CRITICAL)
- `GET /returns/vendor` - Get vendor returns
- `GET /returns/admin` - Get admin returns

### Vendor Earnings
- `GET /vendors/balance` - Get vendor balance
- `GET /vendors/transactions` - Get transactions
- `GET /vendors/settlements` - Get settlements
- `POST /vendors/admin/settlement/create` - Create settlement
- `POST /vendors/admin/settlement/approve` - Approve settlement

Full API documentation: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

---

## ⚠️ CRITICAL RULES FOR DEVELOPERS

### 1. Vendor Status Validation
```typescript
// ALWAYS check before order creation
if (vendor.user.onboardingStatus !== 'ACTIVE') {
  throw new Error('Vendor not activated');
}
```

### 2. Escrow Creation Order
```typescript
// CORRECT order:
1. Capture payment
2. Create order
3. Create platform ledger entry
4. Notify vendor
```

### 3. Admin Authority
```typescript
// NEVER let vendor control refunds
// ONLY admin can approve refunds
if (userRole !== 'ADMIN') {
  throw new Error('Unauthorized');
}
```

### 4. Vendor Earnings
```typescript
// Vendor earns ONLY rent, NOT deposit
const earning = rentPrice - commission;
// NOT: rentPrice + deposit
```

### 5. Settlement Control
```typescript
// NO instant payouts
// Admin must approve settlement
await createSettlement(vendorId);
await approveSettlement(settlementId); // Admin only
```

---

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

---

## 📚 Documentation

- [BUSINESS_LOGIC.md](./BUSINESS_LOGIC.md) - Complete business flow
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - API endpoints
- [IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md) - Development tasks

---

## 🛠️ Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL + Prisma ORM
- **Authentication**: JWT
- **Payment**: Razorpay (to be integrated)
- **File Upload**: AWS S3 (to be integrated)
- **Notifications**: Firebase/OneSignal (to be integrated)

---

## 🚨 Why This Architecture?

### Problem: Cloth Renting Has High Fraud Risk
- Customer damages dress
- Vendor lies about damage
- Vendor runs away with deposit
- Customer keeps dress

### Solution: Platform as Financial Mediator
- ✅ Admin is judge (not customer, not vendor)
- ✅ Platform holds all money until verified
- ✅ Vendor cannot receive orders until KYC approved
- ✅ Vendor decision is NOT final
- ✅ Admin controls all refunds and payouts

---

## 📞 Support

For questions about business logic or implementation:
- Read: [BUSINESS_LOGIC.md](./BUSINESS_LOGIC.md)
- Check: [IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md)

---

**Remember: Platform is Financial Mediator, NOT just marketplace!**
