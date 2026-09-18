# ADMIN PANEL - QUICK START GUIDE

## 🚀 Get Started in 5 Minutes

### Step 1: Run Database Migration (2 min)

```bash
cd backend
npx prisma migrate dev --name add_admin_panel_tables
npx prisma generate
```

Expected output:
```
✔ Generated Prisma Client
✔ Applied migration: add_admin_panel_tables
```

---

### Step 2: Create Admin User (1 min)

Create file: `backend/scripts/create-admin.js`

```javascript
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createAdmin() {
  try {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const admin = await prisma.user.create({
      data: {
        name: 'Admin',
        email: 'admin@platform.com',
        phone: '9999999999',
        role: 'ADMIN',
        status: 'ACTIVE',
        onboardingStatus: 'ACTIVE',
        isEmailVerified: true,
        isPhoneVerified: true,
        passwordAuth: {
          create: {
            passwordHash: hashedPassword,
            failedAttempts: 0
          }
        }
      }
    });
    
    console.log('✅ Admin user created successfully!');
    console.log('Email:', admin.email);
    console.log('Password: admin123');
    console.log('ID:', admin.id);
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
```

Run it:
```bash
node scripts/create-admin.js
```

---

### Step 3: Start Server (30 sec)

```bash
npm run dev
```

Server should start on `http://localhost:3000`

---

### Step 4: Test Admin Login (1 min)

**Using Postman/Thunder Client:**

```
POST http://localhost:3000/auth/login
Content-Type: application/json

{
  "email": "admin@platform.com",
  "password": "admin123"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "...",
    "user": {
      "id": "1",
      "name": "Admin",
      "email": "admin@platform.com",
      "role": "ADMIN"
    }
  }
}
```

**Copy the accessToken!**

---

### Step 5: Test Admin Dashboard (30 sec)

```
GET http://localhost:3000/admin/dashboard
Authorization: Bearer <paste-your-token-here>
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalVendors": 0,
      "activeVendors": 0,
      "totalCustomers": 0,
      "activeOrders": 0,
      "pendingReturns": 0,
      "pendingRefundAmount": 0,
      "todayRevenue": 0,
      "escrowBalance": 0
    },
    "recentOrders": [],
    "pendingComplaints": [],
    "newVendorDocs": []
  }
}
```

✅ **If you see this, admin panel is working!**

---

## 🧪 Quick Test Suite

### Test All Endpoints (5 min)

Create Postman collection with these requests:

#### 1. Dashboard
```
GET http://localhost:3000/admin/dashboard
Authorization: Bearer <token>
```

#### 2. Vendors List
```
GET http://localhost:3000/admin/vendors
Authorization: Bearer <token>
```

#### 3. Orders List
```
GET http://localhost:3000/admin/orders
Authorization: Bearer <token>
```

#### 4. Refund Requests
```
GET http://localhost:3000/admin/refunds
Authorization: Bearer <token>
```

#### 5. Wallet Overview
```
GET http://localhost:3000/admin/wallet
Authorization: Bearer <token>
```

#### 6. Settlements
```
GET http://localhost:3000/admin/settlements
Authorization: Bearer <token>
```

#### 7. Complaints
```
GET http://localhost:3000/admin/complaints
Authorization: Bearer <token>
```

#### 8. Reviews
```
GET http://localhost:3000/admin/reviews
Authorization: Bearer <token>
```

#### 9. Badge Rules
```
GET http://localhost:3000/admin/badges/rules
Authorization: Bearer <token>
```

**All should return 200 OK with empty arrays (no data yet)**

---

## 📝 Create Test Data (Optional)

### Create Test Vendor

```javascript
// scripts/create-test-vendor.js
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestVendor() {
  const hashedPassword = await bcrypt.hash('vendor123', 10);
  
  const vendor = await prisma.user.create({
    data: {
      name: 'Test Vendor',
      email: 'vendor@test.com',
      phone: '9876543210',
      role: 'VENDOR',
      status: 'ACTIVE',
      onboardingStatus: 'PENDING_DOCS',
      isEmailVerified: true,
      isPhoneVerified: true,
      passwordAuth: {
        create: {
          passwordHash: hashedPassword,
          failedAttempts: 0
        }
      },
      vendorProfile: {
        create: {
          shopName: 'Test Shop',
          ownerName: 'Test Owner',
          address: '123 Test Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          commissionRate: 15
        }
      }
    }
  });
  
  console.log('✅ Test vendor created!');
  console.log('ID:', vendor.id);
}

createTestVendor();
```

Run: `node scripts/create-test-vendor.js`

---

### Test Vendor Activation

```
PATCH http://localhost:3000/admin/vendors/<vendor-id>/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "ACTIVE"
}
```

---

## 🎯 Common Issues & Solutions

### Issue 1: Migration Fails
**Error:** `Migration failed`

**Solution:**
```bash
# Reset database (development only!)
npx prisma migrate reset
npx prisma migrate dev --name add_admin_panel_tables
```

---

### Issue 2: Admin User Already Exists
**Error:** `Unique constraint failed on email`

**Solution:**
```bash
# Delete existing admin
npx prisma studio
# Find and delete admin user manually
# Or use SQL:
# DELETE FROM "User" WHERE email = 'admin@platform.com';
```

---

### Issue 3: 401 Unauthorized
**Error:** `Access token required`

**Solution:**
- Check Authorization header format: `Bearer <token>`
- Verify token is not expired
- Re-login to get new token

---

### Issue 4: 403 Forbidden
**Error:** `Admin access required`

**Solution:**
- Verify user role is 'ADMIN' in database
- Check JWT payload contains role: 'ADMIN'

---

### Issue 5: Prisma Client Not Found
**Error:** `Cannot find module '@prisma/client'`

**Solution:**
```bash
npm install @prisma/client
npx prisma generate
```

---

## 📦 Import Postman Collection

Save this as `admin-panel.postman_collection.json`:

```json
{
  "info": {
    "name": "Admin Panel API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    },
    {
      "key": "token",
      "value": ""
    }
  ],
  "item": [
    {
      "name": "Auth",
      "item": [
        {
          "name": "Admin Login",
          "request": {
            "method": "POST",
            "header": [],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"admin@platform.com\",\n  \"password\": \"admin123\"\n}",
              "options": {
                "raw": {
                  "language": "json"
                }
              }
            },
            "url": {
              "raw": "{{baseUrl}}/auth/login",
              "host": ["{{baseUrl}}"],
              "path": ["auth", "login"]
            }
          }
        }
      ]
    },
    {
      "name": "Admin",
      "item": [
        {
          "name": "Dashboard",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              }
            ],
            "url": {
              "raw": "{{baseUrl}}/admin/dashboard",
              "host": ["{{baseUrl}}"],
              "path": ["admin", "dashboard"]
            }
          }
        },
        {
          "name": "Get Vendors",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              }
            ],
            "url": {
              "raw": "{{baseUrl}}/admin/vendors",
              "host": ["{{baseUrl}}"],
              "path": ["admin", "vendors"]
            }
          }
        }
      ]
    }
  ]
}
```

Import in Postman: File → Import → Select file

---

## ✅ Success Checklist

- [ ] Database migration completed
- [ ] Admin user created
- [ ] Server running
- [ ] Admin login successful
- [ ] Dashboard endpoint working
- [ ] All GET endpoints return 200
- [ ] Token authentication working
- [ ] Admin authorization working

---

## 🎉 You're Ready!

**Next Steps:**
1. ✅ Backend is working
2. 📱 Build frontend UI
3. 🧪 Add more test data
4. 🚀 Deploy to production

**Need Help?**
- Check ADMIN_PANEL_IMPLEMENTATION.md for API docs
- Check ADMIN_PANEL_TESTING.md for full test suite
- Check ADMIN_PANEL_ARCHITECTURE.md for system design

---

**Happy Testing!** 🚀
