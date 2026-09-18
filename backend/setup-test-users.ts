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
    const passwordHash = await bcrypt.hash("password123", 10);

    // Create Admin User
    const admin = await prisma.user.upsert({
      where: { phone: "+919244798885" },
      update: {},
      create: {
        name: "Admin User",
        email: "admin@onesoff.local",
        phone: "+919244798885",
        role: "ADMIN",
        status: "ACTIVE",
        onboardingStatus: "APPROVED",
        passwordAuth: {
          create: {
            passwordHash,
            lastChanged: new Date(),
            failedAttempts: 0,
          },
        },
      },
    });

    console.log("✅ Admin created:", admin);

    // Create Vendor User
    const vendor = await prisma.user.upsert({
      where: { phone: "+919302145499" },
      update: {},
      create: {
        name: "Vendor User",
        email: "vendor@onesoff.local",
        phone: "+919302145499",
        role: "VENDOR",
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
            shopName: "Test Shop",
            ownerName: "Vendor User",
            phone: "+919302145499",
          },
        },
      },
    });

    console.log("✅ Vendor created:", vendor);

    // Create OTP records for static OTP testing
    await prisma.otpVerification.upsert({
      where: { phone: "+919244798885" },
      update: {
        otp: "123456",
        expiresAt: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
      },
      create: {
        phone: "+919244798885",
        otp: "123456",
        expiresAt: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
      },
    });

    console.log("✅ Admin OTP record created");

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

    console.log("✅ Vendor OTP record created");

    console.log("\n✅ Setup complete!");
    console.log("Admin phone: 9244798885");
    console.log("Admin OTP: 123456");
    console.log("Vendor phone: 9302145499");
    console.log("Vendor OTP: 123456");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end().catch(() => undefined);
  }
}

main();
