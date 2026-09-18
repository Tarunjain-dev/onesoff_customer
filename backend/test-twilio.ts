import "dotenv/config";
import twilio from "twilio";

async function testTwilio() {
  console.log("🔍 Testing Twilio Configuration...\n");

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  console.log("📋 Configuration Check:");
  console.log(`✓ TWILIO_ACCOUNT_SID: ${accountSid ? "✅ Set" : "❌ Missing"}`);
  console.log(`✓ TWILIO_AUTH_TOKEN: ${authToken ? "✅ Set" : "❌ Missing"}`);
  console.log(`✓ TWILIO_MESSAGING_SERVICE_SID: ${messagingServiceSid ? "✅ Set" : "❌ Missing"}`);
  console.log(`✓ TWILIO_PHONE_NUMBER: ${fromNumber ? "✅ Set" : "❌ Missing"}`);

  if (!accountSid || !authToken) {
    console.error("\n❌ Missing Twilio credentials!");
    process.exit(1);
  }

  try {
    console.log("\n🔐 Initializing Twilio client...");
    const client = twilio(accountSid, authToken);

    console.log("✅ Twilio client initialized successfully");

    // Test account info
    console.log("\n📞 Fetching account info...");
    const account = await client.api.accounts(accountSid).fetch();
    console.log(`✅ Account Status: ${account.status}`);
    console.log(`✅ Account Type: ${account.type}`);

    // List available phone numbers
    console.log("\n📱 Available Incoming Phone Numbers:");
    const incomingPhoneNumbers = await client.incomingPhoneNumbers.list({ limit: 5 });
    if (incomingPhoneNumbers.length > 0) {
      incomingPhoneNumbers.forEach((num) => {
        console.log(`  - ${num.phoneNumber} (${num.friendlyName})`);
      });
    } else {
      console.log("  ⚠️  No incoming phone numbers found");
    }

    // Check messaging service
    if (messagingServiceSid) {
      console.log("\n📨 Checking Messaging Service...");
      try {
        const service = await client.messaging.services(messagingServiceSid).fetch();
        console.log(`✅ Service Name: ${service.friendlyName}`);
      } catch (error: any) {
        console.error(`❌ Messaging Service Error: ${error.message}`);
      }
    }

    console.log("\n✅ Twilio configuration is valid!");
    console.log("\n💡 To send an OTP, use:");
    console.log("   POST /auth/vendor/register/send-otp");
    console.log("   Body: { phone: '9302145499' }");

  } catch (error: any) {
    console.error("\n❌ Twilio Error:", error.message);
    console.error("\nPossible issues:");
    console.error("1. Invalid Account SID or Auth Token");
    console.error("2. Account suspended or trial expired");
    console.error("3. Messaging Service SID is invalid");
    process.exit(1);
  }
}

testTwilio();
