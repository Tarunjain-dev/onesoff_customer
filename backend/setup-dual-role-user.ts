import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const rawDatabaseUrl = process.env.DATABASE_URL;
if (!rawDatabaseUrl) {
  throw new Error("DATABASE_URL is required");
}

let connectionString = rawDatabaseUrl;
try {
  const parsed = new URL(rawDatabaseUrl);
  [
    "sslmode",
    "sslaccept",
    "ssl",
    "sslcert",
    "sslkey",
    "sslrootcert"
  ].forEach((key) => parsed.searchParams.delete(key));
  connectionString = parsed.toString();
} catch {
  connectionString = rawDatabaseUrl;
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    console.log("🔧 Setting up 9302145499 for both Customer and Vendor...\n");

    // Check existing users with this phone
    const existingUsers = await prisma.user.findMany({
      where: {
        phone: "+919302145499"
      }
    });

    console.log(`Found ${existingUsers.length} existing user(s) with phone +919302145499`);
    existingUsers.forEach(u => {
      console.log(`  - ID: ${u.id}, Role: ${u.role}, Name: ${u.name}`);
    });

    // Delete existing users with this phone to avoid conflicts
    if (existingUsers.length > 0) {
      console.log("\n🗑️  Deleting existing users with this phone...");
      for (const user of existingUsers) {
        // Delete related records first
        await prisma.userPasswordAuth.deleteMany({
          where: { userId: user.id }
        });
        await prisma.customerProfile.deleteMany({
          where: { userId: user.id }
        });
        await prisma.vendorProfile.deleteMany({
          where: { userId: user.id }
        });
        
        // Then delete the user
        await prisma.user.delete({
          where: { id: user.id }
        });
        console.log(`  ✓ Deleted user ${user.id} (${user.role})`);
      }
    }

    // Create Customer User
    console.log("\n📱 Creating Customer user...");
    const customer = await prisma.user.create({
      data: {
        name: "Test Customer",
        email: "customer@onesoff.local",
        phone: "+919302145499",
        role: "CUSTOMER",
        status: "ACTIVE",
        onboardingStatus: "APPROVED"
      }
    });
    console.log("✅ Customer created:", customer);

    // Create Vendor User with different email
    console.log("\n🏪 Creating Vendor user...");
    const vendor = await prisma.user.create({
      data: {
        name: "Test Vendor",
        email: "vendor@onesoff.local",
        phone: "+919302145499",
        role: "VENDOR",
        status: "ACTIVE",
        onboardingStatus: "APPROVED",
        vendorProfile: {
          create: {
            shopName: "Test Shop",
            ownerName: "Test Vendor",
            phone: "+919302145499",
          },
        },
      },
    });
    console.log("✅ Vendor created:", vendor);

    // Create OTP records for both
    console.log("\n🔐 Creating OTP records...");
    await prisma.otpVerification.upsert({
      where: { phone: "+919302145499" },
      update: {
        otp: "123456",
        expiresAt: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
      },
      create: {
        phone: "+919302145499",
        otp: "123456",
        expiresAt: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
      },
    });
    console.log("✅ OTP record created");

    // Create customer profile
    console.log("\n👤 Creating Customer profile...");
    await prisma.customerProfile.upsert({
      where: { userId: customer.id },
      update: {},
      create: {
        userId: customer.id,
        gender: "Not specified",
        aadharNumber: "123456789012"
      }
    });
    console.log("✅ Customer profile created");

    console.log("\n" + "=".repeat(60));
    console.log("\n✅ Setup complete!\n");

    console.log("📱 Phone Number: 9302145499");
    console.log("🔐 OTP: 123456\n");

    console.log("👥 User Roles:");
    console.log("  1. CUSTOMER - Login via /login or toggle to Customer mode");
    console.log("     Redirect: / (Home page)\n");
    console.log("  2. VENDOR - Login via /vendor or toggle to Customer mode");
    console.log("     Redirect: /vendor/dashboard\n");

    console.log("🔗 Login Flow:");
    console.log("  1. Go to /login");
    console.log("  2. Enter phone: 9302145499");
    console.log("  3. Click 'Send OTP'");
    console.log("  4. Enter OTP: 123456");
    console.log("  5. For new customer: Enter name and Aadhar");
    console.log("  6. Click Login");
    console.log("  7. Auto-redirect based on role\n");

    console.log("⚠️  Note: Same phone number has both CUSTOMER and VENDOR roles");
    console.log("   The system will use the role from the JWT token to redirect");

  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end().catch(() => undefined);
  }
}

main();
