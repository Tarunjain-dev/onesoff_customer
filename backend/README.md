# OnesOff Backend API

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Database
```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate
```

### 3. Configure Environment Variables
Check `.env` or `.env.example` and configure at least:
- `DATABASE_URL` - PostgreSQL connection
- `JWT_SECRET` - JWT signing secret
- `ACCESS_TOKEN_TTL` - Access token lifetime, for example `15m`
- `REFRESH_TOKEN_TTL_DAYS` - Refresh session lifetime in days
- `CORS_ALLOWED_ORIGINS` - Comma-separated list of allowed frontend origins
- `FRONTEND_URL` - Optional single frontend origin
- `MSG91_*` / Twilio credentials - SMS provider configuration

### 4. Start Server
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## API Endpoints

### Customer Registration
```
POST /auth/register
Body: {
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "password": "Password123"
}
```

### Vendor Registration
```
POST /auth/vendor/register
Body: {
  "name": "Shop Owner",
  "email": "vendor@example.com",
  "phone": "9876543210",
  "password": "Password123",
  "shopName": "My Shop",
  "ownerName": "Owner Name"
}
```

### Login (Customer/Vendor/Admin)
```
POST /auth/login
Body: {
  "emailOrPhone": "john@example.com",
  "password": "Password123",
  "role": "CUSTOMER"
}
```

### Vendor OTP Login - Send OTP
```
POST /auth/vendor/send-otp
Body: {
  "phone": "9876543210"
}
```

### Vendor OTP Login - Verify OTP
```
POST /auth/vendor/verify-otp
Body: {
  "phone": "9876543210",
  "otp": "123456"
}
```

### Refresh Token
```
POST /auth/refresh
Body: {
  "refreshToken": "your-refresh-token"
}
```

### Logout
```
POST /auth/logout
Body: {
  "refreshToken": "your-refresh-token"
}
```

## Security Features

- **Password Security**
  - Minimum 8 characters
  - Must contain uppercase, lowercase, and number
  - Bcrypt hashing with salt rounds

- **Failed Login Protection**
  - Tracks failed login attempts
  - Auto-blocks account after 5 failed attempts

- **Rate Limiting**
  - OTP requests limited to 3 per 5 minutes per phone/IP pair
  - Uses in-memory throttling for the current single-instance deployment model

- **JWT + Session Authentication**
  - Access token: 15 minutes expiry by default
  - Refresh session: 7 days expiry by default
  - Server-side session revocation through `AuthSession`

- **CORS Protection**
  - Browser origins are restricted by environment
  - Use `CORS_ALLOWED_ORIGINS` or `FRONTEND_URL` in deployed environments

## Error Handling

All errors return consistent format:
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

## Validation

- Phone numbers: Indian format (10 digits starting with 6-9)
- Email: Standard email validation
- Password: Strong password requirements
- All inputs validated using Zod schemas

## Technologies Used

- **Express.js** - Web framework
- **Prisma** - ORM
- **PostgreSQL** - Database
- **JWT** - Authentication
- **Bcrypt** - Password hashing
- **Zod** - Input validation
- **Pino** - Logging
- **Helmet** - Security headers
- **Socket.IO** - Realtime updates
