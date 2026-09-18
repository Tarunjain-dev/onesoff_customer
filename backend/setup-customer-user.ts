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
    console.log("🔧 Setting up customer user...\n");

    // Create Customer User
    const customer = await prisma.user.upsert({
      where: { phone: "+919302145499" },
      update: {
        name: "Test Customer",
        email: "customer@onesoff.local",
        role: "CUSTOMER",
        status: "ACTIVE",
        onboardingStatus: "APPROVED"
      },
      create: {
        name: "Test Customer",
        email: "customer@onesoff.local",
        phone: "+919302145499",
        role: "CUSTOMER",
        status: "ACTIVE",
        onboardingStatus: "APPROVED"
      },
    });

    console.log("✅ Customer created:", customer);

    // Create OTP record for static OTP testing
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

    console.log("✅ Customer OTP record created");

    // Create customer profile
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

    console.log("\n✅ Setup complete!");
    console.log("\n📱 Customer Login Credentials:");
    console.log("   Phone: 9302145499");
    console.log("   OTP: 123456");
    console.log("\n🔗 Login Flow:");
    console.log("   1. POST /auth/send-otp");
    console.log("      Body: { phone: '9302145499' }");
    console.log("   2. POST /auth/verify-otp");
    console.log("      Body: { phone: '9302145499', otp: '123456', name: 'Test Customer' }");
    console.log("\n✅ After login, redirect to: /");

  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end().catch(() => undefined);
  }
}

main();
