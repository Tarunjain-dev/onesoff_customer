# ONESOFF - VISUAL FLOW DIAGRAMS

## 🔄 COMPLETE MONEY FLOW

```
┌─────────────┐
│  CUSTOMER   │
│   Pays ₹    │
└──────┬──────┘
       │
       │ Payment Captured
       ↓
┌─────────────────────────────────────┐
│      PLATFORM ESCROW WALLET         │
│  (Money belongs to PLATFORM now)    │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ PlatformWalletLedger        │   │
│  │ - CUSTOMER_PAYMENT          │   │
│  │ - REFUND                    │   │
│  │ - VENDOR_PAYOUT             │   │
│  └─────────────────────────────┘   │
└──────┬──────────────────┬───────────┘
       │                  │
       │ Admin Decision   │ Admin Decision
       ↓                  ↓
┌─────────────┐    ┌─────────────┐
│  CUSTOMER   │    │   VENDOR    │
│  (Refund)   │    │  (Payout)   │
└─────────────┘    └─────────────┘
```

---

## 📋 ORDER LIFECYCLE

```
1. ORDER PLACEMENT
   ┌──────────────────────────────────────────┐
   │ Customer selects product + dates         │
   │ Platform calculates: Rent + Deposit      │
   │ Customer pays via Razorpay               │
   └──────────────────┬───────────────────────┘
                      │
                      ↓
   ┌──────────────────────────────────────────┐
   │ ✅ Payment Captured                      │
   │ ✅ Order Created                         │
   │ ✅ OrderItems Created                    │
   │ ✅ PlatformWalletLedger → CUSTOMER_PAYMENT│
   │ ✅ depositStatus = HELD                  │
   │ ✅ Vendor Notified                       │
   └──────────────────┬───────────────────────┘
                      │
                      ↓

2. VENDOR ACCEPTANCE (24 hours)
   ┌──────────────────────────────────────────┐
   │ Vendor Reviews Order                     │
   └──────────┬───────────────────────────────┘
              │
        ┌─────┴─────┐
        │           │
        ↓           ↓
   ┌────────┐  ┌────────┐
   │ ACCEPT │  │ REJECT │
   └───┬────┘  └───┬────┘
       │           │
       │           ↓
       │      ┌──────────────────────┐
       │      │ Auto-cancel          │
       │      │ Full refund          │
       │      │ Restore stock        │
       │      │ Ledger → REFUND      │
       │      └──────────────────────┘
       │
       ↓

3. DELIVERY PHASE
   ┌──────────────────────────────────────────┐
   │ status = DISPATCHED                      │
   │ Logistics tracking created               │
   └──────────────────┬───────────────────────┘
                      │
                      ↓
   ┌──────────────────────────────────────────┐
   │ status = DELIVERED                       │
   │ Rental period starts                     │
   └──────────────────┬───────────────────────┘
                      │
                      ↓

4. RETURN PHASE
   ┌──────────────────────────────────────────┐
   │ Customer initiates return                │
   │ status = RETURN_INITIATED                │
   └──────────────────┬───────────────────────┘
                      │
                      ↓
   ┌──────────────────────────────────────────┐
   │ Vendor inspects item                     │
   │ Submits: lateFee, damageCharge, notes    │
   │ inspectionStatus = PENDING_ADMIN         │
   └──────────────────┬───────────────────────┘
                      │
                      ↓

5. ADMIN DECISION (CRITICAL)
   ┌──────────────────────────────────────────┐
   │ Admin reviews vendor inspection          │
   │ Admin calculates:                        │
   │   refund = deposit - lateFee - damage    │
   └──────────────────┬───────────────────────┘
                      │
                      ↓
   ┌──────────────────────────────────────────┐
   │ ✅ depositStatus = REFUNDED/FORFEITED    │
   │ ✅ Ledger → REFUND (if > 0)              │
   │ ✅ Customer receives refund              │
   │ ✅ VendorTransaction → CREDIT (rent only)│
   │ ✅ Ledger → VENDOR_PAYOUT                │
   │ ✅ status = COMPLETED                    │
   └──────────────────────────────────────────┘
```

---

## 👤 VENDOR ONBOARDING FLOW

```
┌─────────────────────────────────────────────┐
│ Vendor Registers                            │
│ user.onboardingStatus = PENDING_DOCS        │
└──────────────────┬──────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────┐
│ Vendor Uploads KYC Documents                │
│ - Aadhaar Front & Back                      │
│ - PAN Card                                  │
│ VendorKyc.status = PENDING                  │
└──────────────────┬──────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────┐
│ Admin Reviews KYC                           │
└──────────┬──────────────────────────────────┘
           │
     ┌─────┴─────┐
     │           │
     ↓           ↓
┌─────────┐  ┌─────────┐
│APPROVED │  │REJECTED │
└────┬────┘  └────┬────┘
     │            │
     ↓            ↓
┌─────────────────────────────────────────────┐
│ user.onboardingStatus = ACTIVE / REJECTED   │
└──────────────────┬──────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────┐
│ ✅ ACTIVE → Can receive orders              │
│ ❌ REJECTED → Cannot receive orders         │
└─────────────────────────────────────────────┘

IMPORTANT RULES:
✅ Vendor CAN add products while PENDING_DOCS
❌ Vendor CANNOT receive orders until ACTIVE
❌ Checkout blocked if onboardingStatus != ACTIVE
```

---

## 💰 VENDOR SETTLEMENT FLOW

```
┌─────────────────────────────────────────────┐
│ Multiple orders completed                   │
│ Vendor has earnings in balance              │
└──────────────────┬──────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────┐
│ Admin Creates Settlement Batch              │
│                                             │
│ Calculate:                                  │
│ - Total Credits (all earnings)              │
│ - Total Debits (penalties)                  │
│ - Commission                                │
│ - Payable Amount                            │
│                                             │
│ VendorSettlement.status = PENDING           │
└──────────────────┬──────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────┐
│ Admin Reviews Settlement                    │
│ Verifies bank details                       │
└──────────────────┬──────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────┐
│ Admin Approves Settlement                   │
│                                             │
│ ✅ Transfer money to vendor bank            │
│ ✅ VendorSettlement.status = COMPLETED      │
│ ✅ settlementDate = now                     │
│ ✅ All transactions marked as settled       │
└─────────────────────────────────────────────┘

CRITICAL RULES:
❌ NO instant payouts to vendors
✅ Platform controls settlement timing
✅ Admin must approve every settlement
✅ Batch payment system (not per-order)
```

---

## 🔐 ROLE-BASED ACCESS MATRIX

```
┌──────────────────────┬──────────┬────────┬───────┐
│ Action               │ Customer │ Vendor │ Admin │
├──────────────────────┼──────────┼────────┼───────┤
│ Create Order         │    ✅    │   ❌   │  ❌   │
│ Accept/Reject Order  │    ❌    │   ✅   │  ❌   │
│ Initiate Return      │    ✅    │   ❌   │  ❌   │
│ Submit Inspection    │    ❌    │   ✅   │  ❌   │
│ Decide Refund        │    ❌    │   ❌   │  ✅   │
│ Create Settlement    │    ❌    │   ❌   │  ✅   │
│ Approve Settlement   │    ❌    │   ❌   │  ✅   │
│ Review KYC           │    ❌    │   ❌   │  ✅   │
│ Upload KYC           │    ❌    │   ✅   │  ❌   │
│ View Own Orders      │    ✅    │   ✅   │  ✅   │
│ View All Orders      │    ❌    │   ❌   │  ✅   │
└──────────────────────┴──────────┴────────┴───────┘
```

---

## 💸 DEPOSIT LIFECYCLE

```
Order Created
     │
     ↓
┌─────────────┐
│ HELD        │ ← Money held by platform
└──────┬──────┘
       │
       │ After return & admin decision
       │
   ┌───┴────┐
   │        │
   ↓        ↓
┌─────────────┐  ┌─────────────┐
│ REFUNDED    │  │ FORFEITED   │
│             │  │             │
│ Customer    │  │ Platform    │
│ gets money  │  │ keeps money │
└─────────────┘  └─────────────┘

Refund Calculation:
refund = deposit - lateFee - damageCharge

Examples:
┌──────────────┬─────────┬─────────┬────────┬────────┐
│ Scenario     │ Deposit │ LateFee │ Damage │ Refund │
├──────────────┼─────────┼─────────┼────────┼────────┤
│ Clean Return │  5000   │    0    │   0    │  5000  │
│ Late Return  │  5000   │   500   │   0    │  4500  │
│ Damaged      │  5000   │    0    │  2000  │  3000  │
│ Lost         │  5000   │    0    │  5000  │    0   │
└──────────────┴─────────┴─────────┴────────┴────────┘
```

---

## 🎯 CRITICAL VALIDATION POINTS

```
1. BEFORE ORDER CREATION
   ┌─────────────────────────────────────┐
   │ ✓ Vendor.user.status = ACTIVE       │
   │ ✓ Vendor.user.onboardingStatus      │
   │   = ACTIVE                          │
   │ ✓ Product.status = ACTIVE           │
   │ ✓ Variant.stock >= quantity         │
   │ ✓ startDate > now                   │
   │ ✓ endDate > startDate               │
   └─────────────────────────────────────┘

2. DURING PAYMENT
   ┌─────────────────────────────────────┐
   │ ✓ Payment captured BEFORE order     │
   │ ✓ Amount matches calculation        │
   │ ✓ Payment signature verified        │
   └─────────────────────────────────────┘

3. DURING REFUND
   ┌─────────────────────────────────────┐
   │ ✓ Only ADMIN can approve            │
   │ ✓ Refund <= original deposit        │
   │ ✓ Return status = PENDING_ADMIN     │
   └─────────────────────────────────────┘

4. DURING SETTLEMENT
   ┌─────────────────────────────────────┐
   │ ✓ Only ADMIN can approve            │
   │ ✓ Vendor bank details verified      │
   │ ✓ Balance > 0                       │
   └─────────────────────────────────────┘
```

---

## 📊 PLATFORM WALLET LEDGER

```
Every money movement is tracked:

┌────────────────────┬──────────┬─────────────────┐
│ Entry Type         │ Amount   │ Description     │
├────────────────────┼──────────┼─────────────────┤
│ CUSTOMER_PAYMENT   │ +7000    │ Order created   │
│ REFUND             │ -5000    │ Deposit refund  │
│ VENDOR_PAYOUT      │ -1800    │ Vendor earning  │
│ COMMISSION         │ +200     │ Platform fee    │
└────────────────────┴──────────┴─────────────────┘

Platform Balance = 
  Σ(CUSTOMER_PAYMENT) 
  - Σ(REFUND) 
  - Σ(VENDOR_PAYOUT)
```

---

## 🚨 FRAUD PREVENTION

```
┌─────────────────────────────────────────────┐
│ PROBLEM: Cloth Renting Fraud Risks         │
├─────────────────────────────────────────────┤
│ ❌ Customer damages dress                   │
│ ❌ Vendor lies about damage                 │
│ ❌ Vendor runs with deposit                 │
│ ❌ Customer keeps dress                     │
└─────────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────┐
│ SOLUTION: Platform as Mediator             │
├─────────────────────────────────────────────┤
│ ✅ KYC prevents fake vendors                │
│ ✅ Escrow prevents vendor fraud             │
│ ✅ Admin mediation prevents disputes        │
│ ✅ Deposit forfeiture handles damage        │
│ ✅ Platform holds all money                 │
└─────────────────────────────────────────────┘
```

---

**Platform = Financial Mediator + Trust Authority**
