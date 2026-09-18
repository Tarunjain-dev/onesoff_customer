import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcrypt";

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
    console.log("🔧 Setting up Individual Vendor and Admin-as-Vendor users...\n");

    const passwordHash = await bcrypt.hash("password123", 10);

    // Create Individual Vendor User
    const individualVendor = await prisma.user.upsert({
      where: { phone: "+917509783882" },
      update: {
        name: "Individual Vendor",
        email: "individual-vendor@onesoff.local",
        role: "INDIVIDUAL_VENDOR",
        status: "ACTIVE",
        onboardingStatus: "APPROVED"
      },
      create: {
        name: "Individual Vendor",
        email: "individual-vendor@onesoff.local",
        phone: "+917509783882",
        role: "INDIVIDUAL_VENDOR",
        status: "ACTIVE",
        onboardingStatus: "APPROVED",
        passwordAuth: {
          create: {
            passwordHash,
            lastChanged: new Date(),
            failedAttempts: 0,
          },
        },
        vendorProfile: {
          create: {
            shopName: "Individual Vendor Shop",
            ownerName: "Individual Vendor",
            phone: "+917509783882",
          },
        },
      },
    });

    console.log("✅ Individual Vendor created:", individualVendor);

    // Create OTP record for Individual Vendor
    await prisma.otpVerification.upsert({
      where: { phone: "+917509783882" },
      update: {
        otp: "123456",
        expiresAt: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
      },
      create: {
        phone: "+917509783882",
        otp: "123456",
        expiresAt: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
      },
    });

    console.log("✅ Individual Vendor OTP record created");

    // Create Admin-as-Vendor User
    const adminAsVendor = await prisma.user.upsert({
      where: { phone: "+919039032040" },
      update: {
        name: "Admin as Vendor",
        email: "admin-vendor@onesoff.local",
        role: "ADMIN_AS_VENDOR",
        status: "ACTIVE",
        onboardingStatus: "APPROVED"
      },
      create: {
        name: "Admin as Vendor",
        email: "admin-vendor@onesoff.local",
        phone: "+919039032040",
        role: "ADMIN_AS_VENDOR",
        status: "ACTIVE",
        onboardingStatus: "APPROVED",
      },
    });

    console.log("✅ Admin-as-Vendor created:", adminAsVendor);

    // Create OTP record for Admin-as-Vendor
    await prisma.otpVerification.upsert({
      where: { phone: "+919039032040" },
      update: {
        otp: "123456",
        expiresAt: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
      },
      create: {
        phone: "+919039032040",
        otp: "123456",
        expiresAt: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
      },
    });

    console.log("✅ Admin-as-Vendor OTP record created");

    console.log("\n✅ Setup complete!\n");

    console.log("📱 Individual Vendor Login Credentials:");
    console.log("   Phone: 7509783882");
    console.log("   OTP: 123456");
    console.log("   Role: INDIVIDUAL_VENDOR");
    console.log("   Dashboard: /individual-vendor/dashboard");
    console.log("\n🔗 Login Flow:");
    console.log("   1. POST /auth/vendor/send-otp");
    console.log("      Body: { phone: '7509783882' }");
    console.log("   2. POST /auth/vendor/verify-otp");
    console.log("      Body: { phone: '7509783882', otp: '123456' }");

    console.log("\n" + "=".repeat(60));

    console.log("\n📱 Admin-as-Vendor Login Credentials:");
    console.log("   Phone: 9039032040");
    console.log("   OTP: 123456");
    console.log("   Role: ADMIN_AS_VENDOR");
    console.log("   Dashboard: /admin-as-vendor/dashboard");
    console.log("\n🔗 Login Flow (OTP-based):");
    console.log("   1. POST /auth/admin/send-otp");
    console.log("      Body: { emailOrPhone: '9039032040' }");
    console.log("   2. POST /auth/admin/verify-otp");
    console.log("      Body: { emailOrPhone: '9039032040', otp: '123456' }");

  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end().catch(() => undefined);
  }
}

main();
