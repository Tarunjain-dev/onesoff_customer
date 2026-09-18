const { Client } = require('pg');

const connectionString = 'postgresql://postgres:AyushiOnesoff@ones-off.cdy8iwmiunuw.ap-south-1.rds.amazonaws.com:5432/onesoff';

async function setupDatabase() {
  const client = new Client({ 
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('Connected to database');

    // Grant permissions
    await client.query('GRANT ALL PRIVILEGES ON SCHEMA public TO postgres;');
    await client.query('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;');
    await client.query('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;');
    await client.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres;');
    await client.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;');
    
    console.log('Permissions granted successfully');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

setupDatabase();
