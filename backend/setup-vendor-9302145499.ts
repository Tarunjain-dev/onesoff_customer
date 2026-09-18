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
    console.log("🔧 Setting up 9302145499 as VENDOR user...\n");

    // Update existing customer to vendor
    const vendor = await prisma.user.update({
      where: { phone: "+919302145499" },
      data: {
        name: "Test Vendor",
        role: "VENDOR",
        vendorProfile: {
          create: {
            shopName: "Test Shop",
            ownerName: "Test Vendor",
            phone: "+919302145499",
          },
        },
      },
      include: {
        vendorProfile: true
      }
    });

    console.log("✅ User updated to VENDOR:", vendor);

    // Ensure OTP record exists
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

    console.log("✅ OTP record created/updated");

    console.log("\n" + "=".repeat(60));
    console.log("\n✅ Setup complete!\n");

    console.log("📱 Phone Number: 9302145499");
    console.log("🔐 OTP: 123456\n");

    console.log("👥 User Role: VENDOR");
    console.log("   Redirect: /vendor/dashboard\n");

    console.log("🔗 Login Flow:");
    console.log("  1. Go to /login");
    console.log("  2. Click 'I am a Customer' toggle to switch to vendor mode");
    console.log("  3. Enter phone: 9302145499");
    console.log("  4. Click 'Send OTP'");
    console.log("  5. Enter OTP: 123456");
    console.log("  6. Click Login");
    console.log("  7. Auto-redirect to /vendor/dashboard\n");

    console.log("ℹ️  Note: This phone is now a VENDOR user");
    console.log("   To test as customer, use a different phone number");

  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end().catch(() => undefined);
  }
}

main();
