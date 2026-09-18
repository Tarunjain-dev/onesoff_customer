# OTP Verification Troubleshooting Guide

## Issue: OTP Verification Not Working

### Changes Made:
1. **Increased OTP expiry time** from 2 minutes to 10 minutes
2. **Added detailed logging** to track OTP generation and verification
3. **Improved error messages** to identify exact failure point
4. **Added string trimming** to handle whitespace issues

### How to Test:

#### Step 1: Register a Vendor (if not already registered)
```bash
POST http://localhost:3000/auth/vendor/register
Content-Type: application/json

{
  "name": "Test Vendor",
  "phone": "9876543211",
  "password": "password123",
  "shopName": "Test Shop",
  "ownerName": "Owner Name"
}
```

#### Step 2: Send OTP
```bash
POST http://localhost:3000/auth/vendor/send-otp
Content-Type: application/json

{
  "phone": "9876543211"
}
```

**Check your server console** - You should see:
```
Generated OTP for 9876543211: 123456
Sending OTP 123456 to 9876543211
```

#### Step 3: Verify OTP
```bash
POST http://localhost:3000/auth/vendor/verify-otp
Content-Type: application/json

{
  "phone": "9876543211",
  "otp": "123456"
}
```

Replace `123456` with the actual OTP from your console.

### Common Issues & Solutions:

#### Issue 1: "Vendor not found"
**Solution:** Make sure you registered the vendor first using `/auth/vendor/register`

#### Issue 2: "No OTP found for this phone number"
**Solution:** 
- Check if OTP was sent successfully
- Verify phone number format is exactly the same (no spaces, country code, etc.)
- Check database: `SELECT * FROM "OtpVerification" WHERE phone = '9876543211';`

#### Issue 3: "OTP has expired"
**Solution:** 
- OTP is now valid for 10 minutes
- Send a new OTP if expired

#### Issue 4: "Invalid OTP"
**Solution:**
- Check server console for the actual OTP
- Make sure you're copying the OTP correctly (no extra spaces)
- Phone number must match exactly

### Debug Commands:

#### Check if OTP exists in database:
```bash
npm run ts-node test-otp.ts
```

#### Check database directly:
```sql
SELECT * FROM "OtpVerification";
```

#### Check vendor exists:
```sql
SELECT * FROM "User" WHERE phone = '9876543211' AND role = 'VENDOR';
```

### Testing Flow:

1. **Start your server**
   ```bash
   npm run dev
   ```

2. **Open Postman** and import the collection

3. **Test the flow:**
   - Register Vendor → Send OTP → Check Console → Verify OTP

4. **Check server logs** for detailed information

### Expected Server Logs:

```
Generated OTP for 9876543211: 654321
Sending OTP 654321 to 9876543211
SMS credentials not configured, OTP only logged
Verifying OTP for 9876543211: 654321
OTP Record: { phone: '9876543211', otp: '654321', expiresAt: 2024-02-18T... }
```

### If Still Not Working:

1. **Restart your server** to apply the changes
2. **Clear old OTP records:**
   ```sql
   DELETE FROM "OtpVerification";
   ```
3. **Try with a fresh phone number**
4. **Check the exact error message** in the response

### Success Response:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "1",
      "name": "Test Vendor",
      "phone": "9876543211",
      "role": "VENDOR"
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

### Notes:
- OTP is logged in console for development
- In production, OTP will be sent via SMS
- Phone number format must be consistent (e.g., "9876543211" without +91)
