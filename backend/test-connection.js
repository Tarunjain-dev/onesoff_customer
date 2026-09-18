import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testConnection() {
  try {
    console.log('Testing PostgreSQL connection...');
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL!');
    
    const result = await client.query('SELECT current_database(), current_user;');
    console.log('Database:', result.rows[0].current_database);
    console.log('User:', result.rows[0].current_user);
    
    const tables = await client.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename;
    `);
    
    console.log('\n📊 Tables in database:');
    tables.rows.forEach(row => console.log(`  - ${row.tablename}`));
    
    client.release();
  } catch (error) {
    console.error('❌ Connection Error:', error.message);
    console.error('\n🔧 Fix: Update AWS RDS Security Group to allow your IP (106.222.213.162)');
  } finally {
    await pool.end();
  }
}

testConnection();
