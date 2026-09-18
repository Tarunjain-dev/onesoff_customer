import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcrypt";

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) throw new Error("DATABASE_URL is required");

let connectionString = rawUrl;
try {
  const parsed = new URL(rawUrl);
  for (const key of ["sslmode", "sslaccept", "ssl", "sslcert", "sslkey", "sslrootcert"]) {
    parsed.searchParams.delete(key);
  }
  connectionString = parsed.toString();
} catch {
  connectionString = rawUrl;
}

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const PASSWORD = "password123";

async function setPassword(userId: bigint, passwordHash: string) {
  await prisma.userPasswordAuth.upsert({
    where: { userId },
    create: { userId, passwordHash, lastChanged: new Date(), failedAttempts: 0 },
    update: {
      passwordHash,
      lastChanged: new Date(),
      failedAttempts: 0,
      lockedUntil: null,
    },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@onesoff.local" },
    create: {
      name: "Admin User",
      email: "admin@onesoff.local",
      phone: "+919244798885",
      role: "ADMIN",
      status: "ACTIVE",
      onboardingStatus: "APPROVED",
    },
    update: {
      name: "Admin User",
      phone: "+919244798885",
      role: "ADMIN",
      status: "ACTIVE",
      onboardingStatus: "APPROVED",
    },
  });
  await setPassword(admin.id, passwordHash);

  const vendorInputs = [
    {
      name: "Rohit Mehta",
      email: "vendor1@onesoff.local",
      phone: "+919302145499",
      shopName: "Fashion Hub - Indore",
      businessName: "Fashion Hub Pvt Ltd",
      city: "Indore",
      state: "Madhya Pradesh",
      pincode: "452001",
      address: "56 MG Road",
      gstNumber: "22AAAAA0000A1Z5",
      commissionPercentage: new Prisma.Decimal(10),
    },
    {
      name: "Ananya Gupta",
      email: "vendor2@onesoff.local",
      phone: "+919800000102",
      shopName: "Style Store - Delhi",
      businessName: null,
      city: "New Delhi",
      state: "Delhi",
      pincode: "110001",
      address: "12 Connaught Place",
      gstNumber: null,
      commissionPercentage: new Prisma.Decimal(15),
    },
    {
      name: "Vikram Singh",
      email: "vendor3@onesoff.local",
      phone: "+919800000103",
      shopName: "Regal Rentals - Mumbai",
      businessName: "Regal Rentals LLP",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400050",
      address: "221 Bandra West",
      gstNumber: "27AAAAA0000A1Z5",
      commissionPercentage: new Prisma.Decimal(12),
    },
  ] as const;

  for (const input of vendorInputs) {
    const vendorUser = await prisma.user.upsert({
      where: { email: input.email },
      create: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        role: "VENDOR",
        status: "ACTIVE",
        onboardingStatus: "APPROVED",
      },
      update: {
        name: input.name,
        phone: input.phone,
        role: "VENDOR",
        status: "ACTIVE",
        onboardingStatus: "APPROVED",
      },
    });
    await setPassword(vendorUser.id, passwordHash);

    const profile = await prisma.vendorProfile.upsert({
      where: { userId: vendorUser.id },
      create: {
        userId: vendorUser.id,
        shopName: input.shopName,
        ownerName: input.name,
        businessName: input.businessName,
        businessType: "Retail",
        gstNumber: input.gstNumber,
        address: input.address,
        city: input.city,
        state: input.state,
        pincode: input.pincode,
        phone: input.phone,
        commissionPercentage: input.commissionPercentage,
      },
      update: {
        shopName: input.shopName,
        ownerName: input.name,
        businessName: input.businessName,
        address: input.address,
        city: input.city,
        state: input.state,
        pincode: input.pincode,
        phone: input.phone,
        commissionPercentage: input.commissionPercentage,
      },
    });

    await prisma.vendorWallet.upsert({
      where: { vendorId: profile.id },
      create: { vendorId: profile.id },
      update: {},
    });
  }

  console.log("Minimal seed complete: 1 admin, 3 vendors, 0 products.");
  console.log(`Password for all accounts: ${PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("Minimal seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end().catch(() => undefined);
  });
