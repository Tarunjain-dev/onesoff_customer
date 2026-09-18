import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixPermissions() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Fixing database permissions...');
    
    await client.query('ALTER DATABASE onesoff OWNER TO postgres;');
    console.log('✅ Database owner set');
    
    await client.query('ALTER SCHEMA public OWNER TO postgres;');
    console.log('✅ Schema owner set');
    
    await client.query('GRANT ALL PRIVILEGES ON DATABASE onesoff TO postgres;');
    console.log('✅ Database privileges granted');
    
    await client.query('GRANT ALL ON SCHEMA public TO postgres;');
    console.log('✅ Schema privileges granted');
    
    await client.query('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;');
    console.log('✅ Table privileges granted');
    
    await client.query('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;');
    console.log('✅ Sequence privileges granted');
    
    await client.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres;');
    console.log('✅ Default table privileges set');
    
    await client.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;');
    console.log('✅ Default sequence privileges set');
    
    console.log('\n🎉 All permissions fixed!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixPermissions();
