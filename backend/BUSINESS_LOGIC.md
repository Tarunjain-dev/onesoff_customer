# ONESOFF RENTAL MARKETPLACE - BUSINESS LOGIC GUIDE

## PLATFORM TYPE: Escrow-Based Rental Marketplace
**NOT E-commerce | Platform = Financial Mediator + Trust Authority**

---

## CORE PRINCIPLE
```
Money Flow: Customer → Platform → Vendor (after admin approval)
Control: Admin holds all money until return verified
Trust: Platform is judge, not customer or vendor
```

---

## ACTOR RESPONSIBILITIES

| Actor    | Role                                    |
|----------|-----------------------------------------|
| Customer | Books & pays rent + deposit             |
| Vendor   | Provides cloth & verifies return        |
| Admin    | Holds money, decides refund, pays vendor|

---

## COMPLETE BUSINESS FLOW

### 1️⃣ VENDOR ONBOARDING (KYC-Based Activation)

**Objective:** Prevent fake vendors before they receive orders

**Flow:**
```
1. Vendor registers → user.onboardingStatus = PENDING_DOCS
2. Vendor uploads Aadhaar (VendorKyc table)
3. Admin reviews KYC
4. Admin approves → user.onboardingStatus = ACTIVE
5. Vendor can now receive orders
```

**Rules:**
- ✅ Vendor CAN add products while PENDING_DOCS
- ❌ Vendor CANNOT receive orders until ACTIVE
- ❌ Checkout blocked if vendor.onboardingStatus != ACTIVE

**Implementation:**
```typescript
// Order validation
if (vendor.user.onboardingStatus !== 'ACTIVE') {
  throw new Error('Vendor not activated yet');
}
```

---

### 2️⃣ PRODUCT PUBLISHING

**Flow:**
```
1. Vendor creates product → visible to customers
2. Customer can browse
3. Checkout validates vendor status
```

**Checkout Validation:**
```typescript
// Before order creation
if (vendor.user.status !== 'ACTIVE' || 
    vendor.user.onboardingStatus !== 'ACTIVE') {
  throw new Error('Vendor cannot accept orders');
}
```

---

### 3️⃣ ORDER PLACEMENT (Escrow Creation) ⚠️ CRITICAL

**Customer Action:**
```
1. Select dates
2. Calculate:
   - Rent = daily_price × days
   - Deposit = security_deposit
   - Final Payable = Rent + Deposit
3. Pay via payment gateway
```

**System Action (IMMEDIATELY after payment):**
```typescript
// 1. Create Order
const order = await prisma.order.create({
  data: {
    customerId,
    orderNo: generateOrderNo(),
    startDate,
    endDate,
    totalRent,
    totalDeposit,
    finalPayable: totalRent + totalDeposit,
    paymentStatus: 'PAID'
  }
});

// 2. Create OrderItems
await prisma.orderItem.createMany({
  data: items.map(item => ({
    orderId: order.id,
    productId: item.productId,
    variantId: item.variantId,
    vendorId: item.vendorId,
    quantity: item.quantity,
    rentPrice: item.rentPrice,
    deposit: item.deposit,
    depositStatus: 'HELD',
    status: 'PLACED',
    acceptDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  }))
});

// 3. Platform Wallet Entry (MONEY NOW BELONGS TO PLATFORM)
await prisma.platformWalletLedger.create({
  data: {
    orderId: order.id,
    entryType: 'CUSTOMER_PAYMENT',
    amount: finalPayable
  }
});

// 4. Notify vendor
await notifyVendor(vendorId, order.id);
```

**CRITICAL RULE:**
```
Money is now PLATFORM property
NOT vendor property
NOT customer property
```

---

### 4️⃣ VENDOR ACCEPTANCE WINDOW

**Flow:**
```
1. Vendor has acceptDeadline (24 hours)
2. Vendor can ACCEPT or REJECT
```

**If ACCEPT:**
```typescript
await prisma.orderItem.update({
  where: { id: orderItemId },
  data: { status: 'ACCEPTED' }
});
```

**If REJECT or TIMEOUT:**
```typescript
// Auto-cancel and refund
await prisma.orderItem.update({
  where: { id: orderItemId },
  data: { 
    status: 'CANCELLED',
    depositStatus: 'REFUNDED'
  }
});

// Ledger entry
await prisma.platformWalletLedger.create({
  data: {
    orderId,
    entryType: 'REFUND',
    amount: orderItem.rentPrice + orderItem.deposit
  }
});

// Process refund to customer
await processRefund(customerId, amount);
```

**RULE:** Vendor never touches money during rejection

---

### 5️⃣ DELIVERY PHASE

**Flow:**
```
1. Vendor dispatches → status = DISPATCHED
2. Customer receives → status = DELIVERED
3. Rental period starts
```

```typescript
// Dispatch
await prisma.orderItem.update({
  where: { id },
  data: { status: 'DISPATCHED' }
});

await prisma.logistics.create({
  data: {
    orderItemId: id,
    dispatchDate: new Date()
  }
});

// Delivery
await prisma.orderItem.update({
  where: { id },
  data: { status: 'DELIVERED' }
});

await prisma.logistics.update({
  where: { orderItemId: id },
  data: { deliveredDate: new Date() }
});
```

---

### 6️⃣ RETURN PHASE (Risk Handling)

**Customer returns item**

**Vendor inspects and submits:**

| Condition | Vendor Action           |
|-----------|-------------------------|
| Perfect   | vendorAccepted = true   |
| Late      | lateFee = amount        |
| Damaged   | damageCharge = amount   |
| Lost      | damageCharge = full deposit |

```typescript
await prisma.orderItem.update({
  where: { id },
  data: { status: 'RETURN_RECEIVED' }
});

await prisma.return.create({
  data: {
    orderItemId: id,
    inspectionStatus: 'PENDING_ADMIN',
    lateFee: vendorSubmittedLateFee,
    damageCharge: vendorSubmittedDamage,
    vendorNotes: notes,
    vendorAccepted: isClean
  }
});
```

**RULE:** Vendor decision is NOT final. Admin decides.

---

### 7️⃣ ADMIN REFUND DECISION ⚠️ MOST IMPORTANT

**Admin reviews return and decides:**

```typescript
// Admin calculates refund
const refund = deposit - lateFee - damageCharge;

// Update return
await prisma.return.update({
  where: { id },
  data: {
    adminApproved: true,
    finalRefund: refund
  }
});

// Update deposit status
await prisma.orderItem.update({
  where: { id: orderItemId },
  data: {
    depositStatus: refund > 0 ? 'REFUNDED' : 'FORFEITED',
    status: 'COMPLETED'
  }
});

// Ledger entry
if (refund > 0) {
  await prisma.platformWalletLedger.create({
    data: {
      orderId,
      entryType: 'REFUND',
      amount: refund
    }
  });
  
  // Process refund to customer
  await processRefund(customerId, refund);
}
```

**Refund Cases:**

| Case          | Calculation                    | Result         |
|---------------|--------------------------------|----------------|
| Clean return  | deposit - 0 - 0                | Full refund    |
| Late return   | deposit - lateFee - 0          | Partial refund |
| Damaged       | deposit - 0 - damageCharge     | Small refund   |
| Lost          | deposit - 0 - deposit          | No refund      |

---

### 8️⃣ VENDOR EARNINGS CREATION

**After admin approves return:**

```typescript
// Calculate vendor earning (ONLY rent, NOT deposit)
const commission = (rentPrice * vendor.commissionRate) / 100;
const vendorEarning = rentPrice - commission;

// Create vendor transaction
await prisma.vendorTransaction.create({
  data: {
    vendorId,
    orderItemId,
    type: 'CREDIT',
    source: 'RENTAL_EARNING',
    amount: vendorEarning
  }
});

// Platform ledger
await prisma.platformWalletLedger.create({
  data: {
    orderId,
    entryType: 'VENDOR_PAYOUT',
    amount: vendorEarning
  }
});
```

**RULE:** Vendor earns ONLY rent portion, NOT deposit

---

### 9️⃣ VENDOR SETTLEMENT (Batch Payment)

**Platform does NOT pay instantly**

**Admin runs settlement:**

```typescript
// Calculate total vendor earnings
const totalCredits = await prisma.vendorTransaction.aggregate({
  where: {
    vendorId,
    type: 'CREDIT',
    // Not yet settled
  },
  _sum: { amount: true }
});

const totalDebits = await prisma.vendorTransaction.aggregate({
  where: {
    vendorId,
    type: 'DEBIT' // Penalties
  },
  _sum: { amount: true }
});

const payableAmount = totalCredits._sum.amount - totalDebits._sum.amount;
const commission = calculateCommission(totalCredits._sum.amount);

// Create settlement
await prisma.vendorSettlement.create({
  data: {
    vendorId,
    totalAmount: totalCredits._sum.amount,
    commission,
    payableAmount,
    status: 'PENDING'
  }
});

// Admin approves → transfer money
await processVendorPayout(vendorId, payableAmount);

await prisma.vendorSettlement.update({
  where: { id },
  data: {
    status: 'COMPLETED',
    settlementDate: new Date()
  }
});
```

---

## FINANCIAL CONTROL MODEL

| Money Type        | Owner                  |
|-------------------|------------------------|
| Customer Payment  | Platform               |
| Deposit           | Platform (temporary)   |
| Rent              | Vendor earning         |
| Penalty           | Platform               |
| Refund            | Customer               |
| Payout            | Vendor                 |

---

## WHY THIS MODEL EXISTS

**Cloth renting has HIGH FRAUD RISK:**

❌ Customer damages dress
❌ Vendor lies about damage
❌ Vendor runs away with deposit
❌ Customer keeps dress

**Platform solves this:**

✅ Admin is judge
✅ Not customer
✅ Not vendor
✅ Platform holds money until verified

---

## CRITICAL VALIDATION RULES

### Before Order Creation:
```typescript
// 1. Vendor must be active
if (vendor.user.status !== 'ACTIVE') throw Error('Vendor blocked');
if (vendor.user.onboardingStatus !== 'ACTIVE') throw Error('Vendor not KYC approved');

// 2. Product must be available
if (product.status !== 'ACTIVE') throw Error('Product not available');

// 3. Dates must be valid
if (startDate <= new Date()) throw Error('Invalid start date');
if (endDate <= startDate) throw Error('Invalid end date');

// 4. Variant must have stock
if (variant.stock < quantity) throw Error('Insufficient stock');
```

### During Payment Processing:
```typescript
// 1. Payment must be captured before order creation
if (paymentStatus !== 'CAPTURED') throw Error('Payment not captured');

// 2. Amount must match calculation
const calculatedAmount = (rentPrice * days) + deposit;
if (paidAmount !== calculatedAmount) throw Error('Amount mismatch');
```

### During Return Processing:
```typescript
// 1. Only admin can finalize refunds
if (userRole !== 'ADMIN') throw Error('Unauthorized refund decision');

// 2. Refund cannot exceed deposit
if (refundAmount > originalDeposit) throw Error('Refund exceeds deposit');

// 3. Vendor earning only after admin approval
if (!return.adminApproved) throw Error('Cannot create vendor earning before admin approval');
```

---

## KEY SUCCESS METRICS

- **Trust Score**: Admin dispute resolution rate
- **Vendor Quality**: Return acceptance rate
- **Customer Satisfaction**: Refund processing time
- **Platform Revenue**: Commission + penalty collection

---

## IMPLEMENTATION PRIORITY

1. **Phase 1**: Basic escrow (payment → platform → vendor)
2. **Phase 2**: KYC validation system
3. **Phase 3**: Return inspection workflow
4. **Phase 4**: Admin dashboard for dispute resolution
5. **Phase 5**: Automated settlement system

---

**Remember: Platform is the FINANCIAL MEDIATOR, not just a marketplace!**

---

*Last Updated: [Current Date]*
*Version: 1.0*rror('Vendor not verified');

// 2. Product must be available
if (variant.quantity < requestedQty) throw Error('Out of stock');

// 3. Dates must be valid
if (startDate < new Date()) throw Error('Invalid dates');
```

### Before Vendor Payout:
```typescript
// 1. Return must be completed
if (orderItem.status !== 'COMPLETED') throw Error('Return not completed');

// 2. Admin must approve
if (!return.adminApproved) throw Error('Admin approval pending');

// 3. Deposit must be processed
if (orderItem.depositStatus === 'HELD') throw Error('Deposit not processed');
```

---

## IMPLEMENTATION CHECKLIST

- [ ] Vendor KYC upload & approval flow
- [ ] Order creation with escrow logic
- [ ] Vendor acceptance/rejection with auto-cancel
- [ ] Delivery tracking
- [ ] Return inspection by vendor
- [ ] Admin refund decision panel
- [ ] Vendor earnings calculation
- [ ] Batch settlement system
- [ ] Platform wallet ledger tracking
- [ ] Refund processing
- [ ] Vendor payout processing

---

**REMEMBER: Platform is NOT a marketplace. Platform is a TRUST LAYER.**
