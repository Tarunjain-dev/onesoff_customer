# Admin Staff Routes

## Overview
This directory contains the routes for the Admin Staff (ADMIN_AS_VENDOR) API endpoints.

## Endpoints

### POST /admin-staff/register
Register a new admin staff member.

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "password": "SecurePassword123"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Admin staff registered successfully",
  "data": {
    "id": "1",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+919876543210",
    "role": "ADMIN",
    "status": "ACTIVE"
  }
}
```

### POST /admin-staff/login
Login with admin staff credentials.

**Request:**
```json
{
  "emailOrPhone": "john@example.com",
  "password": "SecurePassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "1",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+919876543210",
      "role": "ADMIN"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### GET /admin-staff/profile
Get current logged-in admin staff profile (protected).

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "userId": "1",
    "role": "ADMIN"
  }
}
```

## Files

- `index.ts` - Route definitions and handlers

## Related Files

- `src/services/AdminStaffService.ts` - Business logic
- `src/controllers/AdminStaffController.ts` - HTTP handlers
- `src/app.ts` - App integration

## Documentation

See the following files for complete documentation:
- `ADMIN_STAFF_API_DOCUMENTATION.md` - Complete API reference
- `ADMIN_STAFF_FRONTEND_INTEGRATION.md` - Frontend integration guide
- `ADMIN_STAFF_QUICK_START.md` - Quick start guide
