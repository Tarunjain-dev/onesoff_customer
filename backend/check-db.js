import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkDatabase() {
  try {
    console.log('Checking database connection...');
    
    // Try to count users
    const userCount = await prisma.user.count();
    console.log(`✅ Connected! Users in database: ${userCount}`);
    
    // List all tables by trying to query them
    const tables = [
      'user', 'vendorProfile', 'customerProfile', 'product', 
      'category', 'order', 'orderItem'
    ];
    
    console.log('\n📊 Table Status:');
    for (const table of tables) {
      try {
        const count = await prisma[table].count();
        console.log(`  ✓ ${table}: ${count} records`);
      } catch (e) {
        console.log(`  ✗ ${table}: Error - ${e.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Database Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
