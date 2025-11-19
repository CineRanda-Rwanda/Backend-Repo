# Authentication Endpoints Test Documentation

## Overview
Tests for user registration, login, verification, and session management.

**Test File**: `tests/integration/auth-endpoints.test.ts`  
**Total Tests**: 14  
**Status**: ✅ All Passing

---

## Test Setup

### Before All Tests
```typescript
- Create admin user for protected endpoints
- Create Settings document with welcomeBonusAmount: 500 RWF
```

### After All Tests
```typescript
- Clean up users collection
- Clean up settings collection
```

---

## Endpoint Tests

### 1. POST `/api/v1/auth/request-verification`

#### Description
Initiates user registration by sending a verification code to the phone number.

#### Tests (2)

##### ✅ Should send verification code to valid phone number
```typescript
Request:
  POST /api/v1/auth/request-verification
  Body: { phoneNumber: "+250794976833" }

Expected Response:
  Status: 200
  Body: {
    status: "success",
    message: "Verification code sent to your phone"
  }

Validates:
  - Phone number format validation
  - User creation with pendingVerification: true
  - Verification code generation
  - SMS/WhatsApp notification sent
  - Code expiration set (10 minutes)
```

##### ✅ Should reject invalid phone number format
```typescript
Request:
  POST /api/v1/auth/request-verification
  Body: { phoneNumber: "invalid" }

Expected Response:
  Status: 400
  Body: {
    status: "fail",
    message: "Invalid phone number format"
  }

Validates:
  - Phone number validation rules
  - Error message clarity
```

---

### 2. POST `/api/v1/auth/verify-registration`

#### Description
Completes user registration by verifying the code and setting username/PIN.

#### Tests (3)

##### ✅ Should complete registration with valid verification code
```typescript
Request:
  POST /api/v1/auth/verify-registration
  Body: {
    phoneNumber: "+250794976833",
    verificationCode: "123456",
    username: "testuser",
    pin: "1234"
  }

Expected Response:
  Status: 200
  Body: {
    status: "success",
    token: "jwt_token_here",
    data: {
      user: {
        username: "testuser",
        phoneNumber: "+250794976833",
        phoneVerified: true,
        wallet: {
          balance: 0,
          bonusBalance: 500,  // Welcome bonus applied
          totalBalance: 500
        }
      },
      welcomeBonus: 500
    }
  }

Validates:
  - Verification code matches
  - Code not expired
  - Username is unique
  - PIN is hashed (bcrypt)
  - Welcome bonus applied (500 RWF)
  - JWT token generated
  - pendingVerification set to false
  - phoneVerified set to true
```

##### ✅ Should reject invalid verification code
```typescript
Request:
  POST /api/v1/auth/verify-registration
  Body: {
    phoneNumber: "+250794976833",
    verificationCode: "wrong_code",
    username: "testuser",
    pin: "1234"
  }

Expected Response:
  Status: 400
  Body: {
    status: "fail",
    message: "Invalid or expired verification code"
  }

Validates:
  - Code validation logic
  - No user created on failure
```

##### ✅ Should reject missing required fields
```typescript
Request:
  POST /api/v1/auth/verify-registration
  Body: {
    phoneNumber: "+250794976833",
    verificationCode: "123456"
    // Missing username and pin
  }

Expected Response:
  Status: 400
  Body: {
    status: "fail",
    message: "Username and PIN are required"
  }

Validates:
  - Required field validation
  - Clear error messages
```

---

### 3. POST `/api/v1/auth/login`

#### Description
Authenticates user with phone number and PIN.

#### Tests (3)

##### ✅ Should login with valid credentials
```typescript
Request:
  POST /api/v1/auth/login
  Body: {
    phoneNumber: "+250794976833",
    pin: "1234"
  }

Expected Response:
  Status: 200
  Body: {
    status: "success",
    token: "jwt_token",
    data: {
      user: {
        userId: "user_id",
        username: "testuser",
        phoneNumber: "+250794976833",
        role: "user"
      }
    }
  }

Validates:
  - Phone number lookup
  - PIN comparison (bcrypt)
  - User active status
  - JWT token generation
  - No sensitive data in response
```

##### ✅ Should reject invalid PIN
```typescript
Request:
  POST /api/v1/auth/login
  Body: {
    phoneNumber: "+250794976833",
    pin: "wrong_pin"
  }

Expected Response:
  Status: 401
  Body: {
    status: "fail",
    message: "Invalid credentials"
  }

Validates:
  - PIN verification logic
  - Generic error message (security)
  - No user enumeration
```

##### ✅ Should reject non-existent user
```typescript
Request:
  POST /api/v1/auth/login
  Body: {
    phoneNumber: "+250790000000",
    pin: "1234"
  }

Expected Response:
  Status: 401
  Body: {
    status: "fail",
    message: "Invalid credentials"
  }

Validates:
  - User existence check
  - Generic error message
```

---

### 4. POST `/api/v1/auth/admin/refresh-token`

#### Description
Refreshes JWT access token using refresh token or access token.

#### Tests (3)

##### ✅ Should refresh admin access token
```typescript
Request:
  POST /api/v1/auth/admin/refresh-token
  Headers: {
    Authorization: "Bearer {admin_token}"
  }

Expected Response:
  Status: 200
  Body: {
    status: "success",
    data: {
      token: "new_access_token",
      refreshToken: "new_refresh_token",
      expiresIn: 86400,
      tokenType: "Bearer"
    }
  }

Validates:
  - Token verification (refresh or access secret)
  - User still active
  - New token generation
  - Token expiration set
```

##### ✅ Should reject invalid token
```typescript
Request:
  POST /api/v1/auth/admin/refresh-token
  Headers: {
    Authorization: "Bearer invalid_token"
  }

Expected Response:
  Status: 401
  Body: {
    status: "fail",
    message: "Invalid refresh token"
  }

Validates:
  - JWT verification
  - Token signature validation
```

##### ✅ Should reject missing token
```typescript
Request:
  POST /api/v1/auth/admin/refresh-token

Expected Response:
  Status: 401
  Body: {
    status: "fail",
    message: "Refresh token is required"
  }

Validates:
  - Token presence check
  - Clear error message
```

---

### 5. GET `/api/v1/auth/profile`

#### Description
Retrieves authenticated user's profile information.

#### Tests (2)

##### ✅ Should get user profile
```typescript
Request:
  GET /api/v1/auth/profile
  Headers: {
    Authorization: "Bearer {user_token}"
  }

Expected Response:
  Status: 200
  Body: {
    status: "success",
    data: {
      user: {
        userId: "user_id",
        username: "testuser",
        phoneNumber: "+250794976833",
        role: "user",
        isActive: true,
        wallet: { ... }
        // No PIN or password fields
      }
    }
  }

Validates:
  - JWT authentication
  - User data retrieval
  - Sensitive field exclusion
  - Wallet information included
```

##### ✅ Should reject unauthenticated access
```typescript
Request:
  GET /api/v1/auth/profile

Expected Response:
  Status: 401
  Body: {
    status: "fail",
    message: "Authentication required"
  }

Validates:
  - Auth middleware enforcement
  - Protected route security
```

---

## Security Validations

### Password/PIN Hashing
- All PINs hashed with bcrypt
- Salt rounds: 10 (production), 1 (tests)
- Never return hashed values in responses

### JWT Tokens
- Access tokens: 24 hour expiration
- Refresh tokens: Longer expiration
- Signed with secure secrets
- Include userId, role, username

### Verification Codes
- 6-digit random codes
- 10 minute expiration
- Single use only
- Cleared after successful verification

### Phone Number Validation
- International format required (+250...)
- Validated against regex pattern
- Unique constraint in database

---

## Data Flow

### Registration Flow
```
1. User sends phone number
2. System creates pending user
3. System sends verification code (SMS/WhatsApp)
4. User submits code + username + PIN
5. System verifies code
6. System completes registration
7. System applies welcome bonus
8. System returns JWT token
```

### Login Flow
```
1. User sends phone + PIN
2. System finds user by phone
3. System verifies PIN (bcrypt.compare)
4. System checks user.isActive
5. System generates JWT token
6. System returns token + user data
```

---

## Error Handling

### Common Errors
- `400`: Invalid input, missing fields
- `401`: Invalid credentials, expired token
- `409`: Duplicate username/phone
- `500`: Server error

### Error Response Format
```json
{
  "status": "fail",
  "message": "Human-readable error message"
}
```

---

## Dependencies

- `jsonwebtoken`: Token generation/verification
- `bcrypt`: PIN hashing
- `twilio` / `africas-talking`: SMS/WhatsApp
- `mongoose`: User persistence

---

## Environment Variables Required

```env
JWT_SECRET=your_secret_key
JWT_REFRESH_SECRET=your_refresh_secret
JWT_EXPIRES_IN=24h
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
AFRICAS_TALKING_API_KEY=...
```

---

## Notes

- Welcome bonus sourced from Settings collection
- Verification codes expire after 10 minutes
- Users can resend verification code
- PIN changes require old PIN verification
- Admin login uses email+password, not phone+PIN
