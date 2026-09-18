import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const rawDatabaseUrl = process.env.DATABASE_URL;
if (!rawDatabaseUrl) throw new Error("DATABASE_URL is required");

let connectionString = rawDatabaseUrl;
try {
  const parsed = new URL(rawDatabaseUrl);
  ["sslmode", "sslaccept", "ssl", "sslcert", "sslkey", "sslrootcert"].forEach(
    (key) => parsed.searchParams.delete(key)
  );
  connectionString = parsed.toString();
} catch {
  connectionString = rawDatabaseUrl;
}

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const PHONE = "+919800000001";

async function main() {
  console.log("🔧 Setting up 9800000001 as VENDOR user...\n");

  const vendorUser = await prisma.user.upsert({
    where: { phone: PHONE },
    create: {
      name: "Vendor 9800000001",
      phone: PHONE,
      role: "VENDOR",
      status: "ACTIVE",
      onboardingStatus: "APPROVED",
    },
    update: {
      role: "VENDOR",
      status: "ACTIVE",
      onboardingStatus: "APPROVED",
    },
  });

  const profile = await prisma.vendorProfile.upsert({
    where: { userId: vendorUser.id },
    create: {
      userId: vendorUser.id,
      shopName: "Shop 9800000001",
      ownerName: "Vendor 9800000001",
      phone: PHONE,
    },
    update: {},
  });

  await prisma.vendorWallet.upsert({
    where: { vendorId: profile.id },
    create: { vendorId: profile.id },
    update: {},
  });

  await prisma.otpVerification.upsert({
    where: { phone: PHONE },
    create: {
      phone: PHONE,
      otp: "123456",
      expiresAt: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
    },
    update: {
      otp: "123456",
      expiresAt: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
    },
  });

  console.log("✅ Vendor setup complete!");
  console.log("📱 Phone: 9800000001");
  console.log("🔐 OTP: 123456");
  console.log("👤 Role: VENDOR → /vendor/dashboard");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end().catch(() => undefined);
  });
