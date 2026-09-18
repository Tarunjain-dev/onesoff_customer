# ADMIN PANEL - FRONTEND UI REFERENCE

## Page Structure & API Mapping

### 1. LOGIN PAGE
**Route:** `/admin/login`

**API:**
```javascript
POST /auth/login
{
  "email": "admin@platform.com",
  "password": "admin123"
}
```

---

### 2. DASHBOARD
**Route:** `/admin/dashboard`

**API:**
```javascript
GET /admin/dashboard
```

**UI Components:**
- Stats Cards (8 cards):
  - Total Vendors
  - Active Vendors
  - Total Customers
  - Active Orders
  - Pending Returns
  - Pending Refund Amount
  - Today Revenue
  - Escrow Balance

- Tables (3 preview tables):
  - Recent Orders (5 rows)
  - Pending Complaints (5 rows)
  - New Vendor Documents (5 rows)

---

### 3. VENDOR MANAGEMENT

#### Vendor List Page
**Route:** `/admin/vendors`

**API:**
```javascript
GET /admin/vendors?status=ACTIVE&city=Mumbai&badge=Gold&dateFrom=2024-01-01
```

**Filters:**
- Status dropdown (Active/Suspended/Pending Docs)
- City input
- Badge dropdown
- Date range picker

**Table Columns:**
- Vendor Name
- Shop Name
- Phone
- City
- Completed Orders
- Badge
- KYC Status
- Account Status
- Actions (View button)

#### Vendor Detail Page
**Route:** `/admin/vendors/:vendorId`

**API:**
```javascript
GET /admin/vendors/:vendorId
```

**Sections:**
1. Profile Info
   - Shop Name, Owner Name, Address, Phone
   
2. KYC Documents
   - Aadhaar Number
   - Front Image (preview)
   - Back Image (preview)
   - Verification Status
   
3. Performance Metrics
   - Total Orders
   - Completed Orders
   - Late Returns
   - Damage Cases
   - Current Badge

**Actions:**
```javascript
// Activate/Suspend
PATCH /admin/vendors/:vendorId/status
{ "status": "ACTIVE" }

// Change Commission
PATCH /admin/vendors/:vendorId/commission
{ "commission": 15 }
```

---

### 4. PRODUCT MANAGEMENT

#### Product List Page
**Route:** `/admin/products`

**API:**
```javascript
GET /products?vendorId=123&category=Ethnic&status=ACTIVE
```

**Filters:**
- Vendor dropdown
- Category dropdown
- Status dropdown

**Table Columns:**
- Image
- Product Name
- Vendor
- Rental Price
- Deposit
- Status
- Actions (View/Disable)

---

### 5. ORDER MANAGEMENT

#### Order List Page
**Route:** `/admin/orders`

**API:**
```javascript
GET /admin/orders?dateFrom=2024-01-01&dateTo=2024-01-31&vendorId=123&status=DELIVERED
```

**Filters:**
- Date Range
- Vendor dropdown
- Status dropdown
- Payment Status dropdown

**Table Columns:**
- Order ID
- Customer
- Vendor
- Rental Period
- Rent Amount
- Deposit
- Order Status
- Actions (View)

#### Order Detail Page
**Route:** `/admin/orders/:orderId`

**API:**
```javascript
GET /admin/orders/:orderId
```

**Sections:**
1. Customer Info (Name, Phone, Address)
2. Product Info (Product, Variant, Vendor)
3. Timeline (Placed → Accepted → Delivered → Returned)
4. Financial (Rent, Deposit, Late Fee, Damage Charge, Refund)

**Actions:**
```javascript
// Cancel Order
POST /admin/orders/:orderId/cancel
{ "reason": "Admin cancellation" }

// Override Status
PATCH /admin/orders/:orderId/status
{ "status": "DELIVERED" }
```

---

### 6. RETURN & REFUND MANAGEMENT

#### Refund Requests Page
**Route:** `/admin/refunds`

**API:**
```javascript
GET /admin/refunds
```

**Table Columns:**
- Order ID
- Customer
- Vendor
- Deposit
- Late Fee
- Damage Charge
- Vendor Notes
- Status
- Actions (Process)

#### Refund Decision Modal
**Actions:**
```javascript
POST /admin/refunds/:returnId/process
{
  "decision": "FULL" | "PARTIAL" | "FORFEIT",
  "refundAmount": 3500  // Only for PARTIAL
}
```

**UI:**
- Radio buttons: Full Refund / Partial Refund / Forfeit Deposit
- Input field for partial amount (shown only if Partial selected)
- Confirm button

---

### 7. PLATFORM WALLET

#### Wallet Overview Page
**Route:** `/admin/wallet`

**API:**
```javascript
GET /admin/wallet
```

**Cards:**
- Total Held Deposits
- Pending Refunds
- Vendor Payables
- Platform Earnings

#### Transactions Page
**Route:** `/admin/wallet/transactions`

**API:**
```javascript
GET /admin/wallet/transactions?limit=50
```

**Table Columns:**
- Date
- Order ID
- Type (Payment/Refund/Payout)
- Amount
- Running Balance

---

### 8. VENDOR SETTLEMENTS

#### Settlement List Page
**Route:** `/admin/settlements`

**API:**
```javascript
GET /admin/settlements
```

**Table Columns:**
- Vendor Name
- Period
- Orders Count
- Total Earnings
- Commission
- Payable Amount
- Status
- Actions (Mark Paid)

**Action:**
```javascript
POST /admin/settlements/:vendorId/mark-paid
{
  "from": "2024-01-01T00:00:00Z",
  "to": "2024-01-31T23:59:59Z"
}
```

---

### 9. COMPLAINT MANAGEMENT

#### Complaint List Page
**Route:** `/admin/complaints`

**API:**
```javascript
GET /admin/complaints?status=PENDING
```

**Filters:**
- Status dropdown (Pending/Resolved)

**Table Columns:**
- Order ID
- Raised By
- Against
- Type
- Status
- Actions (View)

#### Complaint Detail Page
**Route:** `/admin/complaints/:complaintId`

**API:**
```javascript
GET /admin/complaints/:complaintId
```

**Sections:**
- Description
- Evidence (images/documents)
- Order Info

**Actions:**
```javascript
POST /admin/complaints/:complaintId/resolve
{
  "resolution": "REFUND_CUSTOMER" | "PENALIZE_VENDOR" | "REJECT",
  "notes": "Resolution explanation"
}
```

---

### 10. REVIEW MODERATION

#### Review List Page
**Route:** `/admin/reviews`

**API:**
```javascript
GET /admin/reviews?status=PENDING
```

**Filters:**
- Status dropdown (Pending/Approved/Rejected)

**Table Columns:**
- Customer
- Product
- Vendor
- Rating (stars)
- Comment
- Status
- Actions (Approve/Reject)

**Actions:**
```javascript
POST /admin/reviews/:reviewId/moderate
{
  "action": "APPROVE" | "REJECT",
  "reason": "Optional reason"
}
```

---

### 11. BADGE SYSTEM

#### Badge Rules Page
**Route:** `/admin/badges/rules`

**API:**
```javascript
// Get rules
GET /admin/badges/rules

// Create rule
POST /admin/badges/rules
{
  "name": "Platinum Vendor",
  "minOrders": 500,
  "maxLatePercent": 2,
  "maxDamagePercent": 1
}
```

**Table Columns:**
- Badge Name
- Min Orders
- Max Late %
- Max Damage %
- Actions (Edit/Delete)

#### Badge History Page
**Route:** `/admin/badges/history`

**API:**
```javascript
GET /admin/badges/history?vendorId=123
```

**Table Columns:**
- Vendor
- Badge
- Assigned Date
- Removed Date

**Manual Assignment:**
```javascript
POST /admin/badges/assign
{
  "vendorId": "123",
  "badgeId": "1"
}
```

---

## UI/UX Recommendations

### Color Coding
- **Green:** Active, Approved, Completed
- **Yellow:** Pending, In Progress
- **Red:** Suspended, Rejected, Cancelled
- **Blue:** Info, View actions

### Icons
- Dashboard: 📊
- Vendors: 👥
- Products: 📦
- Orders: 🛒
- Returns: ↩️
- Wallet: 💰
- Settlements: 💳
- Complaints: ⚠️
- Reviews: ⭐
- Badges: 🏆

### Responsive Design
- Desktop: Full sidebar + content
- Tablet: Collapsible sidebar
- Mobile: Bottom navigation

### Notifications
- Toast notifications for actions
- Badge counts on sidebar items
- Real-time updates (optional WebSocket)

---

## Sample Tech Stack

**Frontend:**
- React/Next.js
- TailwindCSS or Material-UI
- React Query for API calls
- React Router for navigation
- Chart.js for dashboard graphs

**State Management:**
- Context API or Redux
- JWT token in localStorage/cookies

**API Client:**
```javascript
// Example API client setup
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use(config => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

---

**Ready for frontend development!** 🎨
