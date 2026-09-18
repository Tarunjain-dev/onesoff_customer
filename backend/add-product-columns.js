import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function addColumns() {
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Product" 
      ADD COLUMN IF NOT EXISTS "productType" TEXT,
      ADD COLUMN IF NOT EXISTS "occasion" TEXT,
      ADD COLUMN IF NOT EXISTS "brand" TEXT,
      ADD COLUMN IF NOT EXISTS "gender" TEXT,
      ADD COLUMN IF NOT EXISTS "gst" DECIMAL(65,30);
    `);
    console.log('✅ Columns added successfully');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addColumns();
