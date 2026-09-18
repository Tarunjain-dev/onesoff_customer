import "dotenv/config";
import {
  PrismaClient,
  Prisma,
  NotificationType,
  NotificationChannel,
  NotificationDeliveryStatus,
  OrderItemStatus,
  PaymentStatus,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcrypt";

const PASSWORD_PLAINTEXT = "password123";
const BCRYPT_ROUNDS = 10;
const SEED_TAG = "SEED_V2";

function truthyEnv(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "y", "on", "require"].includes(value.toLowerCase());
}

function createPool() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("DATABASE_URL is required to run the seed script");

  let connectionString = rawUrl;
  try {
    const parsed = new URL(rawUrl);
    ["sslmode", "sslaccept", "ssl", "sslcert", "sslkey", "sslrootcert"].forEach((k) =>
      parsed.searchParams.delete(k)
    );
    connectionString = parsed.toString();
  } catch {
    connectionString = rawUrl;
  }

  return new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
}

const pool = createPool();
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const longText =
  "This is a deliberately long string for UI boundary testing. " +
  "It should render correctly across mobile/desktop, wrap gracefully, and not break layouts. ".repeat(
    20
  );

type SeedUserInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  role: "ADMIN" | "VENDOR" | "CUSTOMER";
  status?: "ACTIVE" | "BLOCKED";
  onboardingStatus?: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
};

async function upsertUser(input: SeedUserInput) {
  const create = {
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    role: input.role,
    status: input.status ?? "ACTIVE",
    onboardingStatus: input.onboardingStatus ?? "APPROVED",
  } as const;

  const update = {
    name: input.name,
    phone: input.phone ?? null,
    status: input.status ?? "ACTIVE",
    onboardingStatus: input.onboardingStatus ?? "APPROVED",
  } as const;

  if (input.email) {
    return prisma.user.upsert({ where: { email: input.email }, create, update });
  }

  if (input.phone) {
    return prisma.user.upsert({ where: { phone: input.phone }, create, update });
  }

  throw new Error(`Seed user "${input.name}" must have an email or phone`);
}

async function upsertPasswordAuth(userId: bigint, passwordHash: string) {
  return prisma.userPasswordAuth.upsert({
    where: { userId },
    create: {
      userId,
      passwordHash,
      lastChanged: new Date(),
      failedAttempts: 0,
    },
    update: {
      passwordHash,
      lastChanged: new Date(),
      failedAttempts: 0,
      lockedUntil: null,
    },
  });
}

async function ensureAddress(args: {
  userId: bigint;
  name: string;
  phone: string;
  city: string;
  state: string;
  pincode: string;
  addressLine: string;
}) {
  const existing = await prisma.address.findFirst({
    where: { userId: args.userId, name: args.name, phone: args.phone },
  });

  if (existing) {
    return prisma.address.update({
      where: { id: existing.id },
      data: {
        city: args.city,
        state: args.state,
        pincode: args.pincode,
        addressLine: args.addressLine,
      },
    });
  }

  return prisma.address.create({ data: args });
}

async function getOrCreateCategory(name: string, parentId?: bigint | null) {
  const existing = await prisma.category.findFirst({
    where: { name, parentId: parentId ?? null },
  });
  if (existing) return existing;
  return prisma.category.create({ data: { name, parentId: parentId ?? null } });
}

async function getOrCreateProduct(args: {
  vendorId: bigint;
  categoryId: bigint;
  name: string;
  description?: string | null;
  productType?: string | null;
  occasion?: string | null;
  brand?: string | null;
  gender?: string | null;
  rentalPrice: Prisma.Decimal;
  securityDeposit: Prisma.Decimal;
  gst?: Prisma.Decimal | null;
  status: string;
}) {
  const existing = await prisma.product.findFirst({
    where: { vendorId: args.vendorId, name: args.name },
  });

  if (existing) {
    return prisma.product.update({
      where: { id: existing.id },
      data: {
        categoryId: args.categoryId,
        description: args.description ?? null,
        productType: args.productType ?? null,
        occasion: args.occasion ?? null,
        brand: args.brand ?? null,
        gender: args.gender ?? null,
        rentalPrice: args.rentalPrice,
        securityDeposit: args.securityDeposit,
        gst: args.gst ?? null,
        status: args.status,
      },
    });
  }

  return prisma.product.create({
    data: {
      vendorId: args.vendorId,
      categoryId: args.categoryId,
      name: args.name,
      description: args.description ?? null,
      productType: args.productType ?? null,
      occasion: args.occasion ?? null,
      brand: args.brand ?? null,
      gender: args.gender ?? null,
      rentalPrice: args.rentalPrice,
      securityDeposit: args.securityDeposit,
      gst: args.gst ?? null,
      status: args.status,
    },
  });
}

async function ensureProductImage(productId: bigint, imageUrl: string, isCover: boolean) {
  const existing = await prisma.productImage.findFirst({ where: { productId, imageUrl } });
  if (existing) {
    return prisma.productImage.update({ where: { id: existing.id }, data: { isCover } });
  }
  return prisma.productImage.create({ data: { productId, imageUrl, isCover } });
}

async function ensureNotificationLog(args: {
  userId: bigint;
  type: NotificationType;
  status: NotificationDeliveryStatus;
  channel: NotificationChannel;
  message: string;
  title?: string | null;
}) {
  const existing = await prisma.notificationLog.findFirst({
    where: { userId: args.userId, type: args.type, provider: SEED_TAG },
  });
  if (existing) return existing;
  return prisma.notificationLog.create({
    data: {
      userId: args.userId,
      type: args.type,
      channel: args.channel,
      status: args.status,
      title: args.title ?? null,
      message: args.message,
      provider: SEED_TAG,
      sentAt: new Date(),
      metadata: { source: "seed", tag: SEED_TAG },
    },
  });
}

async function ensureOrderItem(args: {
  orderId: bigint;
  productId: bigint;
  variantId: bigint;
  vendorId: bigint;
  quantity: number;
  rentPrice: Prisma.Decimal;
  deposit: Prisma.Decimal;
  status?: OrderItemStatus;
}) {
  const existing = await prisma.orderItem.findFirst({
    where: { orderId: args.orderId, productId: args.productId, variantId: args.variantId },
  });

  if (existing) {
    return prisma.orderItem.update({
      where: { id: existing.id },
      data: {
        vendorId: args.vendorId,
        quantity: args.quantity,
        rentPrice: args.rentPrice,
        deposit: args.deposit,
        status: args.status ?? "PLACED",
      },
    });
  }

  return prisma.orderItem.create({
    data: {
      orderId: args.orderId,
      productId: args.productId,
      variantId: args.variantId,
      vendorId: args.vendorId,
      quantity: args.quantity,
      rentPrice: args.rentPrice,
      deposit: args.deposit,
      status: args.status ?? "PLACED",
    },
  });
}

async function tableExists(tableName: string): Promise<boolean> {
  const fullName = `public."${tableName}"`;
  const rows = await prisma.$queryRaw<Array<{ name: string | null }>>`
    SELECT to_regclass(${fullName})::text AS name
  `;
  return Boolean(rows[0]?.name);
}

async function assertTablesExist(tableNames: string[]) {
  const missing: string[] = [];
  for (const tableName of tableNames) {
    if (!(await tableExists(tableName))) missing.push(tableName);
  }

  if (missing.length === 0) return;

  const notificationTablesMissing =
    missing.includes("UserDevice") || missing.includes("NotificationLog");

  throw new Error(
    [
      `Database schema is missing table(s): ${missing.join(", ")}.`,
      "Run Prisma migrations first, then re-run seeding.",
      ...(notificationTablesMissing
        ? [
            'Hint: `UserDevice`/`NotificationLog` are created by migration `20260323121000_add_notification_tables`.',
          ]
        : []),
      'Suggested: `npx prisma migrate deploy` (apply existing migrations)',
      'Or: `npm run prisma:migrate` (dev migrations)',
      "Also verify your DATABASE_URL points to the correct database.",
    ].join("\n")
  );
}

async function main() {
  await assertTablesExist([
    "User",
    "UserPasswordAuth",
    "AuthSession",
    "OtpVerification",
    "VendorProfile",
    "CustomerProfile",
    "Address",
    "Category",
    "Product",
    "ProductVariant",
    "ProductImage",
    "Coupon",
    "Order",
    "OrderItem",
    "Payment",
    "CouponUsage",
    "VendorWallet",
    "VendorTransaction",
    "VendorSettlement",
    "Wishlist",
    "Cart",
    "TrialRequest",
    "Review",
    "UserDevice",
    "NotificationLog",
  ]);

  const passwordHash = await bcrypt.hash(PASSWORD_PLAINTEXT, BCRYPT_ROUNDS);

  const admin = await upsertUser({
    name: "Admin User",
    email: "admin@onesoff.local",
    phone: "+919244798885",
    role: "ADMIN",
    onboardingStatus: "APPROVED",
  });

  const vendors = await Promise.all([
    upsertUser({
      name: "Rohit Mehta",
      email: "vendor1@onesoff.local",
      phone: "+919302145499",
      role: "VENDOR",
      onboardingStatus: "APPROVED",
    }),
    upsertUser({
      name: "Ananya Gupta",
      email: "vendor2@onesoff.local",
      phone: "+919800000102",
      role: "VENDOR",
      onboardingStatus: "PENDING",
    }),
    upsertUser({
      name: "Vikram Singh",
      email: "vendor3@onesoff.local",
      phone: "+919800000103",
      role: "VENDOR",
      onboardingStatus: "APPROVED",
    }),
  ]);

  const customers = await Promise.all([
    upsertUser({
      name: "Aarav Sharma",
      email: "customer1@onesoff.local",
      phone: "+919800001001",
      role: "CUSTOMER",
      onboardingStatus: "APPROVED",
    }),
    upsertUser({
      name: "Diya Patel",
      email: "customer2@onesoff.local",
      phone: "+919800001002",
      role: "CUSTOMER",
      onboardingStatus: "APPROVED",
    }),
    upsertUser({
      name: "Ishaan Verma",
      email: "customer3@onesoff.local",
      phone: "+919800001003",
      role: "CUSTOMER",
      onboardingStatus: "APPROVED",
    }),
    upsertUser({
      name: "Meera Iyer",
      email: "customer4@onesoff.local",
      phone: "+919800001004",
      role: "CUSTOMER",
      onboardingStatus: "APPROVED",
    }),
    upsertUser({
      name: "Kabir Khan",
      email: null,
      phone: "+919800001005",
      role: "CUSTOMER",
      onboardingStatus: "APPROVED",
    }),
    upsertUser({
      name: "Sara Ali",
      email: "customer6@onesoff.local",
      phone: "+919800001006",
      role: "CUSTOMER",
      onboardingStatus: "APPROVED",
    }),
  ]);

  await Promise.all([
    upsertPasswordAuth(admin.id, passwordHash),
    ...vendors.map((u) => upsertPasswordAuth(u.id, passwordHash)),
    ...customers.map((u) => upsertPasswordAuth(u.id, passwordHash)),
  ]);

  await prisma.authSession.upsert({
    where: { refreshToken: "seed_refresh_admin" },
    create: {
      userId: admin.id,
      refreshToken: "seed_refresh_admin",
      deviceInfo: "Chrome/Windows",
      ipAddress: "192.168.1.10",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    update: {
      userId: admin.id,
      deviceInfo: "Chrome/Windows",
      ipAddress: "192.168.1.10",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.authSession.upsert({
    where: { refreshToken: "seed_refresh_customer1" },
    create: {
      userId: customers[0].id,
      refreshToken: "seed_refresh_customer1",
      deviceInfo: "Safari/iOS",
      ipAddress: "192.168.1.11",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    update: {
      userId: customers[0].id,
      deviceInfo: "Safari/iOS",
      ipAddress: "192.168.1.11",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.otpVerification.upsert({
    where: { phone: "+919999999999" },
    create: {
      phone: "+919999999999",
      otp: "123456",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
    update: {
      otp: "123456",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  await prisma.userDevice.upsert({
    where: { fcmToken: "seed_fcm_customer1" },
    create: {
      userId: customers[0].id,
      fcmToken: "seed_fcm_customer1",
      platform: "android",
      isActive: true,
      lastUsedAt: new Date(),
    },
    update: {
      userId: customers[0].id,
      platform: "android",
      isActive: true,
      lastUsedAt: new Date(),
    },
  });

  const vendorProfiles = await Promise.all([
    prisma.vendorProfile.upsert({
      where: { userId: vendors[0].id },
      create: {
        userId: vendors[0].id,
        shopName: "Fashion Hub - Indore",
        ownerName: vendors[0].name,
        businessName: "Fashion Hub Pvt Ltd",
        businessType: "Retail",
        gstNumber: "22AAAAA0000A1Z5",
        address: "56 MG Road",
        city: "Indore",
        state: "Madhya Pradesh",
        pincode: "452001",
        phone: vendors[0].phone ?? undefined,
        commissionRate: new Prisma.Decimal(100),
        commissionPercentage: new Prisma.Decimal(10),
      },
      update: {
        shopName: "Fashion Hub - Indore",
        ownerName: vendors[0].name,
        businessName: "Fashion Hub Pvt Ltd",
        businessType: "Retail",
        gstNumber: "22AAAAA0000A1Z5",
        address: "56 MG Road",
        city: "Indore",
        state: "Madhya Pradesh",
        pincode: "452001",
        phone: vendors[0].phone ?? undefined,
        commissionRate: new Prisma.Decimal(100),
        commissionPercentage: new Prisma.Decimal(10),
      },
    }),
    prisma.vendorProfile.upsert({
      where: { userId: vendors[1].id },
      create: {
        userId: vendors[1].id,
        shopName: "Style Store - Delhi",
        ownerName: vendors[1].name,
        businessName: null,
        businessType: "Wholesale",
        gstNumber: null,
        address: "12 Connaught Place",
        city: "New Delhi",
        state: "Delhi",
        pincode: "110001",
        phone: vendors[1].phone ?? undefined,
        commissionRate: new Prisma.Decimal(150),
        commissionPercentage: new Prisma.Decimal(15),
      },
      update: {
        shopName: "Style Store - Delhi",
        ownerName: vendors[1].name,
        businessName: null,
        businessType: "Wholesale",
        gstNumber: null,
        address: "12 Connaught Place",
        city: "New Delhi",
        state: "Delhi",
        pincode: "110001",
        phone: vendors[1].phone ?? undefined,
        commissionRate: new Prisma.Decimal(150),
        commissionPercentage: new Prisma.Decimal(15),
      },
    }),
    prisma.vendorProfile.upsert({
      where: { userId: vendors[2].id },
      create: {
        userId: vendors[2].id,
        shopName: "Regal Rentals - Mumbai",
        ownerName: vendors[2].name,
        businessName: "Regal Rentals LLP",
        businessType: "Retail",
        gstNumber: "27AAAAA0000A1Z5",
        address: "221 Bandra West",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400050",
        phone: vendors[2].phone ?? undefined,
        commissionRate: new Prisma.Decimal(120),
        commissionPercentage: new Prisma.Decimal(12),
      },
      update: {
        shopName: "Regal Rentals - Mumbai",
        ownerName: vendors[2].name,
        businessName: "Regal Rentals LLP",
        businessType: "Retail",
        gstNumber: "27AAAAA0000A1Z5",
        address: "221 Bandra West",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400050",
        phone: vendors[2].phone ?? undefined,
        commissionRate: new Prisma.Decimal(120),
        commissionPercentage: new Prisma.Decimal(12),
      },
    }),
  ]);

  await Promise.all(
    vendorProfiles.map((vp) =>
      prisma.vendorWallet.upsert({
        where: { vendorId: vp.id },
        create: { vendorId: vp.id },
        update: { vendorId: vp.id },
      })
    )
  );

  await Promise.all([
    prisma.customerProfile.upsert({
      where: { userId: customers[0].id },
      create: {
        userId: customers[0].id,
        gender: "Male",
        dob: new Date("1992-04-18"),
        aadharNumber: "1234-5678-9012",
      },
      update: {
        gender: "Male",
        dob: new Date("1992-04-18"),
        aadharNumber: "1234-5678-9012",
      },
    }),
    prisma.customerProfile.upsert({
      where: { userId: customers[1].id },
      create: {
        userId: customers[1].id,
        gender: "Female",
        dob: new Date("1996-09-03"),
        aadharNumber: null,
      },
      update: {
        gender: "Female",
        dob: new Date("1996-09-03"),
        aadharNumber: null,
      },
    }),
    prisma.customerProfile.upsert({
      where: { userId: customers[2].id },
      create: { userId: customers[2].id, gender: "Male", dob: new Date("1994-01-11") },
      update: { gender: "Male", dob: new Date("1994-01-11") },
    }),
    prisma.customerProfile.upsert({
      where: { userId: customers[3].id },
      create: { userId: customers[3].id, gender: "Female", dob: new Date("1998-12-22") },
      update: { gender: "Female", dob: new Date("1998-12-22") },
    }),
    prisma.customerProfile.upsert({
      where: { userId: customers[4].id },
      create: { userId: customers[4].id, gender: null, dob: null },
      update: { gender: null, dob: null },
    }),
    prisma.customerProfile.upsert({
      where: { userId: customers[5].id },
      create: { userId: customers[5].id, gender: "Female", dob: new Date("1991-06-09") },
      update: { gender: "Female", dob: new Date("1991-06-09") },
    }),
  ]);

  await ensureAddress({
    userId: customers[0].id,
    name: "Home",
    phone: customers[0].phone ?? "+910000000000",
    city: "Indore",
    state: "Madhya Pradesh",
    pincode: "452001",
    addressLine: "Flat 12B, Vijay Nagar",
  });

  await ensureAddress({
    userId: customers[1].id,
    name: "Office",
    phone: customers[1].phone ?? "+910000000000",
    city: "Pune",
    state: "Maharashtra",
    pincode: "411001",
    addressLine: "Business Bay, Bund Garden Road",
  });

  await ensureAddress({
    userId: customers[2].id,
    name: "Home",
    phone: customers[2].phone ?? "+910000000000",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560001",
    addressLine: "11 MG Road",
  });

  const men = await getOrCreateCategory("Men");
  const women = await getOrCreateCategory("Women");
  const accessories = await getOrCreateCategory("Accessories");

  const sherwani = await getOrCreateCategory("Sherwani", men.id);
  const suit = await getOrCreateCategory("Suit", men.id);
  const lehenga = await getOrCreateCategory("Lehenga", women.id);
  const gown = await getOrCreateCategory("Gown", women.id);
  const jewellery = await getOrCreateCategory("Jewellery", accessories.id);
  const footwear = await getOrCreateCategory("Footwear", accessories.id);

  const productInputs = [
    {
      vendor: vendorProfiles[0],
      category: sherwani,
      name: "Royal Sherwani Set",
      description: null,
      productType: "Ethnic",
      occasion: "Wedding",
      brand: "Manyavar",
      gender: "Male",
      rentalPrice: new Prisma.Decimal(5500),
      securityDeposit: new Prisma.Decimal(12000),
      gst: new Prisma.Decimal(18),
      status: "ACTIVE",
    },
    {
      vendor: vendorProfiles[0],
      category: suit,
      name: "Classic Navy Suit",
      description: "Tailored navy suit with premium fabric and modern fit.",
      productType: "Formal",
      occasion: "Party",
      brand: "Raymond",
      gender: "Male",
      rentalPrice: new Prisma.Decimal(3200),
      securityDeposit: new Prisma.Decimal(7000),
      gst: new Prisma.Decimal(18),
      status: "ACTIVE",
    },
    {
      vendor: vendorProfiles[1],
      category: lehenga,
      name: "Bridal Lehenga - Rose Gold",
      description: longText,
      productType: "Ethnic",
      occasion: "Wedding",
      brand: "Sabyasachi",
      gender: "Female",
      rentalPrice: new Prisma.Decimal(9500),
      securityDeposit: new Prisma.Decimal(18000),
      gst: new Prisma.Decimal(18),
      status: "ACTIVE",
    },
    {
      vendor: vendorProfiles[1],
      category: gown,
      name: "Evening Gown - Sapphire",
      description: "Elegant evening gown with subtle shimmer finish.",
      productType: "Western",
      occasion: "Reception",
      brand: "Veromoda",
      gender: "Female",
      rentalPrice: new Prisma.Decimal(4200),
      securityDeposit: new Prisma.Decimal(9000),
      gst: new Prisma.Decimal(18),
      status: "ACTIVE",
    },
    {
      vendor: vendorProfiles[2],
      category: sherwani,
      name: "Ivory Embroidered Sherwani",
      description: "Ivory sherwani with intricate embroidery for premium occasions.",
      productType: "Ethnic",
      occasion: "Wedding",
      brand: "Frontier",
      gender: "Male",
      rentalPrice: new Prisma.Decimal(6100),
      securityDeposit: new Prisma.Decimal(14000),
      gst: new Prisma.Decimal(18),
      status: "ACTIVE",
    },
    {
      vendor: vendorProfiles[2],
      category: lehenga,
      name: "Lehenga - Midnight Maroon",
      description: "Deep maroon lehenga with zari detailing and comfortable lining.",
      productType: "Ethnic",
      occasion: "Sangeet",
      brand: "Frontier",
      gender: "Female",
      rentalPrice: new Prisma.Decimal(7800),
      securityDeposit: new Prisma.Decimal(15000),
      gst: new Prisma.Decimal(18),
      status: "ACTIVE",
    },
    {
      vendor: vendorProfiles[0],
      category: footwear,
      name: "Men's Mojari - Tan",
      description: "Traditional mojari with cushioned insole.",
      productType: "Accessory",
      occasion: "Wedding",
      brand: "Bata",
      gender: "Male",
      rentalPrice: new Prisma.Decimal(800),
      securityDeposit: new Prisma.Decimal(2000),
      gst: new Prisma.Decimal(18),
      status: "ACTIVE",
    },
    {
      vendor: vendorProfiles[1],
      category: jewellery,
      name: "Kundan Necklace Set",
      description: "Kundan necklace set with matching earrings.",
      productType: "Accessory",
      occasion: "Wedding",
      brand: "Tanishq",
      gender: "Female",
      rentalPrice: new Prisma.Decimal(1200),
      securityDeposit: new Prisma.Decimal(3000),
      gst: new Prisma.Decimal(18),
      status: "ACTIVE",
    },
    {
      vendor: vendorProfiles[2],
      category: suit,
      name: "Black Tuxedo Set",
      description: "Black tuxedo with satin lapel and classic silhouette.",
      productType: "Formal",
      occasion: "Reception",
      brand: "Louis Philippe",
      gender: "Male",
      rentalPrice: new Prisma.Decimal(5200),
      securityDeposit: new Prisma.Decimal(11000),
      gst: new Prisma.Decimal(18),
      status: "ACTIVE",
    },
    {
      vendor: vendorProfiles[0],
      category: gown,
      name: "Cocktail Dress - Emerald",
      description: "Minimal cocktail dress with flattering fit.",
      productType: "Western",
      occasion: "Party",
      brand: "Zara",
      gender: "Female",
      rentalPrice: new Prisma.Decimal(2600),
      securityDeposit: new Prisma.Decimal(6000),
      gst: new Prisma.Decimal(18),
      status: "ACTIVE",
    },
  ] as const;

  const products = await Promise.all(
    productInputs.map((p) =>
      getOrCreateProduct({
        vendorId: p.vendor.id,
        categoryId: p.category.id,
        name: p.name,
        description: p.description,
        productType: p.productType,
        occasion: p.occasion,
        brand: p.brand,
        gender: p.gender,
        rentalPrice: p.rentalPrice,
        securityDeposit: p.securityDeposit,
        gst: p.gst,
        status: p.status,
      })
    )
  );

  const allVariants: Array<{ productIndex: number; variant: any }> = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const skuBase = `SEED-${String(i + 1).padStart(2, "0")}`;
    for (const size of ["S", "M"] as const) {
      const variant = await prisma.productVariant.upsert({
        where: { sku: `${skuBase}-${size}` },
        create: { productId: product.id, size, sku: `${skuBase}-${size}`, quantity: 5 },
        update: { productId: product.id, size, quantity: 5 },
      });
      allVariants.push({ productIndex: i, variant });
    }

    await ensureProductImage(
      product.id,
      `https://picsum.photos/seed/onesoff-${skuBase}-1/800/800`,
      true
    );
    await ensureProductImage(
      product.id,
      `https://picsum.photos/seed/onesoff-${skuBase}-2/800/800`,
      false
    );
  }

  const coupons = await Promise.all([
    prisma.coupon.upsert({
      where: { code: "WELCOME100" },
      create: {
        code: "WELCOME100",
        discountType: "FLAT",
        discountValue: new Prisma.Decimal(100),
        isActive: true,
      },
      update: { discountType: "FLAT", discountValue: new Prisma.Decimal(100), isActive: true },
    }),
    prisma.coupon.upsert({
      where: { code: "SAVE20" },
      create: {
        code: "SAVE20",
        discountType: "PERCENT",
        discountValue: new Prisma.Decimal(20),
        isActive: true,
      },
      update: { discountType: "PERCENT", discountValue: new Prisma.Decimal(20), isActive: true },
    }),
    prisma.coupon.upsert({
      where: { code: "FESTIVE15" },
      create: {
        code: "FESTIVE15",
        discountType: "PERCENT",
        discountValue: new Prisma.Decimal(15),
        isActive: true,
      },
      update: { discountType: "PERCENT", discountValue: new Prisma.Decimal(15), isActive: true },
    }),
    prisma.coupon.upsert({
      where: { code: "FLAT250" },
      create: {
        code: "FLAT250",
        discountType: "FLAT",
        discountValue: new Prisma.Decimal(250),
        isActive: true,
      },
      update: { discountType: "FLAT", discountValue: new Prisma.Decimal(250), isActive: true },
    }),
    prisma.coupon.upsert({
      where: { code: "SHIPFREE" },
      create: {
        code: "SHIPFREE",
        discountType: "FLAT",
        discountValue: new Prisma.Decimal(0),
        isActive: true,
      },
      update: { discountType: "FLAT", discountValue: new Prisma.Decimal(0), isActive: true },
    }),
  ]);

  const seededOrderItems: any[] = [];

  for (let i = 1; i <= 10; i++) {
    const customer = customers[(i - 1) % customers.length];
    const coupon = i % 2 === 0 ? coupons[(i / 2) % coupons.length] : null;
    const paymentStatus: PaymentStatus = i % 3 === 0 ? "UNPAID" : "PAID";

    const orderNo = `ORD-SEED-${String(i).padStart(4, "0")}`;
    const order = await prisma.order.upsert({
      where: { orderNo },
      create: {
        orderNo,
        customerId: customer.id,
        couponId: coupon?.id ?? null,
        finalPayable: new Prisma.Decimal(0),
        paymentStatus,
      },
      update: { customerId: customer.id, couponId: coupon?.id ?? null, paymentStatus },
    });

    const v1 = allVariants[(i * 2 - 2) % allVariants.length];
    const v2 = allVariants[(i * 2 - 1) % allVariants.length];
    const p1 = products[v1.productIndex];
    const p2 = products[v2.productIndex];

    const item1 = await ensureOrderItem({
      orderId: order.id,
      productId: p1.id,
      variantId: v1.variant.id,
      vendorId: p1.vendorId,
      quantity: 1,
      rentPrice: p1.rentalPrice,
      deposit: p1.securityDeposit,
      status: "PLACED",
    });
    const item2 = await ensureOrderItem({
      orderId: order.id,
      productId: p2.id,
      variantId: v2.variant.id,
      vendorId: p2.vendorId,
      quantity: 1,
      rentPrice: p2.rentalPrice,
      deposit: p2.securityDeposit,
      status: "PLACED",
    });

    seededOrderItems.push(item1, item2);

    const discount = coupon ? new Prisma.Decimal(100) : new Prisma.Decimal(0);
    const finalPayable = p1.rentalPrice.add(p2.rentalPrice).sub(discount);
    await prisma.order.update({ where: { id: order.id }, data: { finalPayable } });

    const paymentAmount = paymentStatus === "PAID" ? finalPayable : new Prisma.Decimal(0);
    const existingPayment = await prisma.payment.findFirst({ where: { orderId: order.id } });
    if (existingPayment) {
      await prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          customerId: customer.id,
          amount: paymentAmount,
          status: paymentStatus === "PAID" ? "SUCCESS" : "PENDING",
          paidAt: paymentStatus === "PAID" ? new Date() : null,
        },
      });
    } else {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          customerId: customer.id,
          amount: paymentAmount,
          status: paymentStatus === "PAID" ? "SUCCESS" : "PENDING",
          paidAt: paymentStatus === "PAID" ? new Date() : null,
        },
      });
    }

    if (coupon) {
      const existingUsage = await prisma.couponUsage.findFirst({
        where: { couponId: coupon.id, userId: customer.id, orderId: order.id },
      });
      if (!existingUsage) {
        await prisma.couponUsage.create({ data: { couponId: coupon.id, userId: customer.id, orderId: order.id } });
      }
    }
  }

  for (const item of seededOrderItems) {
    const existingTx = await prisma.vendorTransaction.findFirst({
      where: { orderItemId: item.id, type: "CREDIT" },
    });
    if (existingTx) continue;

    const wallet = await prisma.vendorWallet.findUnique({ where: { vendorId: item.vendorId } });
    await prisma.vendorTransaction.create({
      data: {
        vendorId: item.vendorId,
        orderItemId: item.id,
        type: "CREDIT",
        amount: item.rentPrice,
        vendorWalletId: wallet?.id ?? null,
      },
    });
  }

  for (const vp of vendorProfiles) {
    const existingSettlement = await prisma.vendorSettlement.findFirst({
      where: { vendorId: vp.id, status: "PENDING" },
    });
    if (existingSettlement) continue;
    await prisma.vendorSettlement.create({
      data: { vendorId: vp.id, amount: new Prisma.Decimal(5000), status: "PENDING" },
    });
  }

  for (let i = 0; i < customers.length; i++) {
    const customer = customers[i];
    const product = products[i % products.length];
    const variant = allVariants[(i * 2) % allVariants.length].variant;

    await prisma.wishlist.upsert({
      where: { userId_productId: { userId: customer.id, productId: product.id } },
      create: { userId: customer.id, productId: product.id },
      update: {},
    });

    await prisma.cart.upsert({
      where: {
        userId_productId_variantId_issueDate_returnDate_size_color_alterationRequired: {
          userId: customer.id,
          productId: product.id,
          variantId: variant.id,
          issueDate: "2026-03-27",
          returnDate: "2026-03-30",
          size: variant.size,
          color: i % 2 === 0 ? "Maroon" : "Black",
          alterationRequired: false,
        },
      },
      create: {
        userId: customer.id,
        productId: product.id,
        variantId: variant.id,
        quantity: 1,
        rentalPeriod: i === 0 ? longText.slice(0, 180) : "3 days",
        issueDate: "2026-03-27",
        returnDate: "2026-03-30",
        size: variant.size,
        color: i % 2 === 0 ? "Maroon" : "Black",
        imageUrl: `https://picsum.photos/seed/cart-${i + 1}/400/400`,
      },
      update: {
        quantity: 1,
        rentalPeriod: i === 0 ? longText.slice(0, 180) : "3 days",
        issueDate: "2026-03-27",
        returnDate: "2026-03-30",
        size: variant.size,
        color: i % 2 === 0 ? "Maroon" : "Black",
      },
    });
  }

  for (let i = 1; i <= 5; i++) {
    const customer = customers[(i - 1) % customers.length];
    const product = products[(i - 1) % products.length];
    const vendorId = product.vendorId;
    const variant = allVariants[((i - 1) * 2) % allVariants.length].variant;
    const trialCode = `TRL-SEED-${String(i).padStart(4, "0")}`;

    await prisma.trialRequest.upsert({
      where: { trialCode },
      create: {
        customerId: customer.id,
        vendorId,
        productId: product.id,
        variantId: variant.id,
        preferredDate: new Date(Date.now() + i * 24 * 60 * 60 * 1000),
        status: "PENDING",
        trialCode,
      },
      update: {
        customerId: customer.id,
        vendorId,
        productId: product.id,
        variantId: variant.id,
        preferredDate: new Date(Date.now() + i * 24 * 60 * 60 * 1000),
        status: "PENDING",
      },
    });

    const existingReview = await prisma.review.findFirst({
      where: { customerId: customer.id, productId: product.id, vendorId },
    });
    if (!existingReview) {
      await prisma.review.create({
        data: {
          customerId: customer.id,
          vendorId,
          productId: product.id,
          rating: 4,
          comment: i === 5 ? longText.slice(0, 600) : "Great fit and clean condition. Would rent again!",
          images: [],
          status: "PENDING",
        },
      });
    }
  }

  await ensureNotificationLog({
    userId: customers[0].id,
    type: "REVIEW_SUBMITTED",
    channel: "FCM",
    status: "SENT",
    title: "Review submitted",
    message: "Thanks! Your review has been submitted and is pending moderation.",
  });

  await ensureNotificationLog({
    userId: customers[1].id,
    type: "TRIAL_BOOKED",
    channel: "FCM",
    status: "SENT",
    title: "Trial request placed",
    message: "Your trial request has been placed successfully.",
  });

  console.log("✅ Seed complete (idempotent).");
  console.log(`Seeded users password: ${PASSWORD_PLAINTEXT}`);
  console.log(`Admin: ${admin.email} / ${admin.phone}`);
  console.log(`Vendors: ${vendors.map((v) => v.email).join(", ")}`);
  console.log(`Customers: ${customers.map((c) => c.email ?? c.phone).join(", ")}`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end().catch(() => undefined);
  });
