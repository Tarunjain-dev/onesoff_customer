// Test OTP Verification
// Run this to check if OTP is being stored and retrieved correctly

import prisma from './src/config/db';

async function testOTP() {
  const phone = '9876543211';
  
  // Check if OTP exists
  const otpRecord = await prisma.otpVerification.findUnique({
    where: { phone }
  });
  
  console.log('OTP Record:', otpRecord);
  
  if (otpRecord) {
    console.log('OTP:', otpRecord.otp);
    console.log('Expires At:', otpRecord.expiresAt);
    console.log('Current Time:', new Date());
    console.log('Is Expired:', otpRecord.expiresAt < new Date());
  } else {
    console.log('No OTP found for this phone');
  }
  
  await prisma.$disconnect();
}

testOTP();
