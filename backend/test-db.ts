import prisma from './src/config/db';

async function testConnection() {
  try {
    console.log('Testing database connection...');
    const result = await prisma.user.findFirst();
    console.log('✅ Database connection successful');
    console.log('Found user:', result?.name || 'No users found');
  } catch (error: any) {
    console.error('❌ Database connection failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();