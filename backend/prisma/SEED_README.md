# Database Seeding Instructions

## Run the seed script to populate dummy data:

```bash
npm run prisma:seed
```

## What data will be created:

- **10 Users**: 1 Admin, 3 Vendors, 6 Customers
- **3 Vendor Profiles**: 1 per vendor
- **6 Customer Profiles**: 1 per customer
- **3 Addresses**
- **10+ Categories**: Men/Women/Accessories + children
- **10 Products**
- **20 Product Variants**: 2 per product (S/M)
- **20 Product Images**: 2 per product
- **5 Coupons**
- **10 Orders**
- **20 Order Items**: 2 per order
- **10 Payments**
- **Coupon Usage**: for some orders
- **3 Vendor Wallets**
- **Vendor Transactions**: credits per order item
- **Vendor Settlements**: pending settlements per vendor
- **2 Auth Sessions**
- **10 User Password Auth**: one per seeded user
- **1 OTP Verification**: Sample OTP
- **Wishlist + Cart**: seeded for customers
- **Trial Requests + Reviews**: seeded examples
- **User Devices + Notification Logs**: seeded examples

## Test Credentials:

- Seeded password for all users: `password123`
- Admin: admin@onesoff.local / +919800000001
- Vendor: vendor1@onesoff.local / +919800000101
- Customer: customer1@onesoff.local / +919800001001
