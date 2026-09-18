import dotenv from 'dotenv';
dotenv.config();

import prisma from './src/config/db';
import { UserRole, UserStatus } from '@prisma/client';

async function setupAdminAsVendor() {
  try {
    console.log('Setting up ADMIN_AS_VENDOR user with phone 9039032040...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Loaded' : 'NOT LOADED');

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        phone: '+919039032040'
      }
    });

    if (existingUser) {
      console.log('User already exists with phone 9039032040');
      console.log('Current role:', existingUser.role);
      console.log('Updating role to ADMIN_AS_VENDOR...');
      
      const updated = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          role: UserRole.ADMIN_AS_VENDOR,
          status: UserStatus.ACTIVE
        }
      });
      
      console.log('✓ User updated successfully');
      console.log('  ID:', updated.id);
      console.log('  Name:', updated.name);
      console.log('  Phone:', updated.phone);
      console.log('  Role:', updated.role);
      console.log('  Status:', updated.status);
    } else {
      console.log('Creating new ADMIN_AS_VENDOR user...');
      
      const newUser = await prisma.user.create({
        data: {
          name: 'Admin as Vendor',
          phone: '+919039032040',
          role: UserRole.ADMIN_AS_VENDOR,
          status: UserStatus.ACTIVE
        }
      });
      
      console.log('✓ User created successfully');
      console.log('  ID:', newUser.id);
      console.log('  Name:', newUser.name);
      console.log('  Phone:', newUser.phone);
      console.log('  Role:', newUser.role);
      console.log('  Status:', newUser.status);
    }

    console.log('\n✓ Setup completed successfully!');
    console.log('\nLogin Credentials:');
    console.log('  Phone: 9039032040');
    console.log('  Role: ADMIN_AS_VENDOR');
    console.log('  OTP: 123456');
    console.log('  Dashboard: /admin-as-vendor/dashboard');
  } catch (error) {
    console.error('\n✗ Error setting up admin-as-vendor user:');
    if (error instanceof Error) {
      console.error('  Message:', error.message);
      console.error('  Stack:', error.stack);
    } else {
      console.error('  Error:', error);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupAdminAsVendor();
