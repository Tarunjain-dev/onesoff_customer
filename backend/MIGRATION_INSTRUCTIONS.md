# DATABASE MIGRATION INSTRUCTIONS

## Schema Changes Made

Added 4 new models to support Admin Panel:
1. **Complaint** - Customer/vendor complaints and disputes
2. **Review** - Product reviews with moderation
3. **BadgeRule** - Vendor badge criteria
4. **VendorBadge** - Vendor badge assignments

Updated existing models with new relations:
- User: Added relations for complaints, reviews, badges, and vendor orders
- Product: Added reviews relation
- Order: Added complaints relation
- OrderItem: Added vendorUser relation for tracking

## Run Migration

Execute these commands in order:

### 1. Generate Migration
```bash
cd backend
npx prisma migrate dev --name add_admin_panel_tables
```

This will:
- Create migration SQL file
- Apply migration to database
- Generate Prisma Client with new models

### 2. Verify Migration
```bash
npx prisma studio
```

Check that these tables exist:
- Complaint
- Review
- BadgeRule
- VendorBadge

### 3. Seed Admin User (Optional)

Create a seed script or manually insert admin user:

```sql
-- Insert admin user
INSERT INTO "User" (name, email, phone, role, status, "onboardingStatus", "isEmailVerified", "isPhoneVerified")
VALUES ('Admin', 'admin@platform.com', '9999999999', 'ADMIN', 'ACTIVE', 'ACTIVE', true, true);

-- Insert password (hash 'admin123' with bcrypt)
INSERT INTO "UserPasswordAuth" ("userId", "passwordHash", "failedAttempts")
VALUES (
  (SELECT id FROM "User" WHERE email = 'admin@platform.com'),
  '$2b$10$YourHashedPasswordHere',
  0
);
```

Or use Node.js script:
```javascript
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedAdmin() {
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
  
  console.log('Admin user created:', admin);
}

seedAdmin();
```

## Troubleshooting

### Migration Fails
If migration fails due to existing data:
1. Backup your database
2. Check for conflicting constraints
3. Manually adjust migration SQL if needed

### Prisma Client Not Updated
```bash
npx prisma generate
```

### Reset Database (Development Only)
```bash
npx prisma migrate reset
```
⚠️ This will delete all data!

## Verify Installation

Test admin endpoints:
```bash
# Login as admin
POST http://localhost:3000/auth/login
{
  "email": "admin@platform.com",
  "password": "admin123"
}

# Get dashboard (use token from login)
GET http://localhost:3000/admin/dashboard
Authorization: Bearer <your-token>
```

## Production Deployment

For production:
```bash
npx prisma migrate deploy
```

This runs pending migrations without prompts.

---

**Status:** Ready to migrate! Run the commands above to complete setup.
