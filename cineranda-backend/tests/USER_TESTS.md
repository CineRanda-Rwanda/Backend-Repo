# User Management Endpoints Test Documentation

## Overview
Tests for user profile management, admin user operations, and wallet management.

**Test File**: `tests/integration/user-endpoints.test.ts`  
**Total Tests**: 21  
**Status**: ✅ All Passing

---

## Test Setup

### Before All Tests
```typescript
- Create admin user for admin-protected endpoints
```

### Before Each Test
```typescript
- Create test user with 10,000 RWF balance
```

---

## Endpoint Tests

### 1. GET `/api/v1/auth/profile`

#### Description
Retrieve authenticated user's profile information.

#### Tests (3)

##### ✅ Should get authenticated user profile
```typescript
Request:
  GET /api/v1/auth/profile
  Headers: { Authorization: "Bearer {user_token}" }

Expected Response:
  Status: 200
  Body: {
    status: "success",
    data: {
      user: {
        _id: "user_id",
        username: "testuser",
        phoneNumber: "+250794976833",
        role: "user",
        isActive: true,
        location: "international",
        wallet: {
          balance: 10000,
          bonusBalance: 0,
          totalBalance: 10000
        },
        coinWallet: {
          balance: 500
        }
        // No PIN or password fields
      }
    }
  }

Validates:
  - JWT authentication
  - User data retrieval
  - Sensitive fields excluded (pin, password)
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

##### ✅ Should sanitize sensitive fields
```typescript
Response should NOT include:
  - pin (hashed PIN)
  - password (if exists)
  - verificationCode
  - emailVerificationToken
  - resetPasswordToken

Validates:
  - Field exclusion in queries
  - Data privacy
```

---

### 2. PATCH `/api/v1/auth/profile`

#### Description
Update authenticated user's profile information.

#### Tests (3)

##### ✅ Should update profile successfully
```typescript
Request:
  PATCH /api/v1/auth/profile
  Headers: { Authorization: "Bearer {user_token}" }
  Body: {
    username: "newusername",
    preferredLanguage: "fr"
  }

Expected Response:
  Status: 200
  Body: {
    status: "success",
    data: {
      user: {
        username: "newusername",
        preferredLanguage: "fr",
        ...
      }
    }
  }

Validates:
  - Field updates applied
  - Username uniqueness check
  - Language validation
  - Updated data returned
```

##### ✅ Should reject invalid language preference
```typescript
Request:
  PATCH /api/v1/auth/profile
  Body: {
    preferredLanguage: "invalid_lang"
  }

Expected Response:
  Status: 400
  Body: {
    status: "fail",
    message: "Invalid language preference. Must be one of: en, fr, rw"
  }

Validates:
  - Language enum validation
  - Clear error message
  - Allowed values: ['en', 'fr', 'rw']
```

##### ✅ Should reject unauthenticated update
```typescript
Request:
  PATCH /api/v1/auth/profile
  Body: { username: "newname" }

Expected Response:
  Status: 401

Validates:
  - Authentication requirement
```

---

### 3. GET `/api/v1/payments/wallet/balance`

#### Description
Get authenticated user's wallet balance.

#### Tests (2)

##### ✅ Should get wallet balance
```typescript
Request:
  GET /api/v1/payments/wallet/balance
  Headers: { Authorization: "Bearer {user_token}" }

Expected Response:
  Status: 200
  Body: {
    status: "success",
    data: {
      balance: 10000,
      bonusBalance: 0,
      totalBalance: 10000,
      currency: "RWF"
    }
  }

Validates:
  - Balance retrieval
  - Bonus balance included
  - Total calculation correct
  - Currency specified
```

##### ✅ Should reject unauthenticated access
```typescript
Request:
  GET /api/v1/payments/wallet/balance

Expected Response:
  Status: 401
```

---

### 4. POST `/api/v1/users/:userId/adjust-balance`

#### Description
Admin endpoint to adjust user's wallet balance (credit or debit).

#### Tests (4)

##### ✅ Should adjust user balance (credit)
```typescript
Request:
  POST /api/v1/users/{userId}/adjust-balance
  Headers: { Authorization: "Bearer {admin_token}" }
  Body: {
    type: "credit",
    amount: 5000,
    category: "admin-adjustment",
    description: "Promotional credit"
  }

Expected Response:
  Status: 200
  Body: {
    status: "success",
    message: "Balance adjusted successfully",
    data: {
      newBalance: 15000,
      bonusBalance: 0,
      totalBalance: 15000
    }
  }

Validates:
  - Balance increased
  - Transaction logged
  - Admin authorization
  - Description recorded
```

##### ✅ Should deduct from balance (debit)
```typescript
Request:
  POST /api/v1/users/{userId}/adjust-balance
  Headers: { Authorization: "Bearer {admin_token}" }
  Body: {
    type: "debit",
    amount: 2000,
    category: "admin-adjustment",
    description: "Refund processed"
  }

Expected Response:
  Status: 200
  Body: {
    data: {
      newBalance: 8000
    }
  }

Validates:
  - Balance decreased
  - Negative balance prevention
  - Transaction logged
```

##### ✅ Should validate transaction type
```typescript
Request:
  POST /api/v1/users/{userId}/adjust-balance
  Body: {
    type: "credit",
    amount: 1000,
    category: "invalid-type"
  }

Expected Response:
  Status: 400
  Body: {
    message: "Invalid category. Must be one of: welcome-bonus, admin-adjustment, purchase, refund, topup, bonus"
  }

Validates:
  - Transaction category validation
  - Allowed values enforced
  - 'adjustment' mapped to 'admin-adjustment'
```

##### ✅ Should reject non-admin access
```typescript
Request:
  POST /api/v1/users/{userId}/adjust-balance
  Headers: { Authorization: "Bearer {user_token}" }

Expected Response:
  Status: 403
  Body: {
    status: "fail",
    message: "Access denied. Admin privileges required"
  }

Validates:
  - Admin role check
  - Authorization middleware
```

---

### 5. GET `/api/v1/users`

#### Description
Admin endpoint to list all users with pagination.

#### Tests (3)

##### ✅ Should fetch all users (admin)
```typescript
Request:
  GET /api/v1/users
  Headers: { Authorization: "Bearer {admin_token}" }

Expected Response:
  Status: 200
  Body: {
    status: "success",
    data: {
      users: [
        {
          _id: "...",
          username: "user1",
          phoneNumber: "+250...",
          role: "user",
          isActive: true,
          wallet: { ... }
        },
        ...
      ],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalUsers: 2,
        limit: 10
      }
    }
  }

Validates:
  - All users returned
  - Pagination metadata
  - No sensitive fields
  - Admin-only access
```

##### ✅ Should paginate user results
```typescript
Request:
  GET /api/v1/users?page=1&limit=5

Expected Response:
  Status: 200
  Body: {
    data: {
      users: [...],  // Max 5 users
      pagination: {
        currentPage: 1,
        limit: 5,
        totalUsers: 10,
        totalPages: 2
      }
    }
  }

Validates:
  - Pagination parameters
  - Correct page calculation
  - Limit enforcement
```

##### ✅ Should reject non-admin access
```typescript
Request:
  GET /api/v1/users
  Headers: { Authorization: "Bearer {user_token}" }

Expected Response:
  Status: 403
```

---

### 6. GET `/api/v1/users/:userId`

#### Description
Admin endpoint to get specific user details by ID.

#### Tests (3)

##### ✅ Should fetch user by ID (admin)
```typescript
Request:
  GET /api/v1/users/{userId}
  Headers: { Authorization: "Bearer {admin_token}" }

Expected Response:
  Status: 200
  Body: {
    status: "success",
    data: {
      user: {
        _id: "userId",
        username: "testuser",
        phoneNumber: "+250...",
        wallet: { ... },
        purchasedContent: [...],
        createdAt: "...",
        updatedAt: "..."
      }
    }
  }

Validates:
  - User detail retrieval
  - Purchase history included
  - Complete user data
```

##### ✅ Should return 404 for non-existent user
```typescript
Request:
  GET /api/v1/users/507f1f77bcf86cd799439011

Expected Response:
  Status: 404
  Body: {
    status: "fail",
    message: "User not found"
  }

Validates:
  - ID validation
  - 404 error handling
```

##### ✅ Should reject non-admin access
```typescript
Request:
  GET /api/v1/users/{userId}
  Headers: { Authorization: "Bearer {user_token}" }

Expected Response:
  Status: 403
```

---

### 7. PUT `/api/v1/users/:userId`

#### Description
Admin endpoint to update user information.

#### Tests (2)

##### ✅ Should update user (admin)
```typescript
Request:
  PUT /api/v1/users/{userId}
  Headers: { Authorization: "Bearer {admin_token}" }
  Body: {
    username: "updatedname",
    isActive: false,
    role: "admin"
  }

Expected Response:
  Status: 200
  Body: {
    status: "success",
    message: "User updated successfully",
    data: {
      user: {
        username: "updatedname",
        isActive: false,
        role: "admin",
        ...
      }
    }
  }

Validates:
  - Field updates applied
  - Role changes allowed
  - Status changes allowed
  - Admin-only operation
```

##### ✅ Should reject non-admin access
```typescript
Request:
  PUT /api/v1/users/{userId}
  Headers: { Authorization: "Bearer {user_token}" }

Expected Response:
  Status: 403
```

---

### 8. DELETE `/api/v1/users/:userId`

#### Description
Admin endpoint to soft delete (deactivate) a user.

#### Tests (2)

##### ✅ Should soft delete user (admin)
```typescript
Request:
  DELETE /api/v1/users/{userId}
  Headers: { Authorization: "Bearer {admin_token}" }

Expected Response:
  Status: 204
  Body: (empty)

After Deletion:
  User still exists in database
  isActive: false
  Can be reactivated later

Validates:
  - Soft deletion (not permanent)
  - User deactivated
  - isActive set to false
  - Data preserved
```

##### ✅ Should reject non-admin access
```typescript
Request:
  DELETE /api/v1/users/{userId}
  Headers: { Authorization: "Bearer {user_token}" }

Expected Response:
  Status: 403
```

---

## User Profile Fields

### Updatable Fields (User)
- `username` - Unique username
- `email` - Email address
- `preferredLanguage` - UI language (en, fr, rw)
- `location` - User location
- `profileImageUrl` - Profile picture

### Read-Only Fields
- `phoneNumber` - Set during registration
- `role` - Admin-only update
- `isActive` - Admin-only update
- `wallet` - Updated via transactions
- `purchasedContent` - Updated via purchases

### Restricted Fields
- `pin` - Never returned, changed separately
- `password` - Never returned, changed separately
- `verificationCode` - Internal only
- `tokens` - Internal only

---

## Wallet Transaction Categories

### Valid Categories
1. **welcome-bonus** - Initial signup bonus
2. **admin-adjustment** - Manual admin changes
3. **purchase** - Content purchases
4. **refund** - Purchase refunds
5. **topup** - Wallet top-ups
6. **bonus** - Promotional credits

### Category Mapping
```typescript
// 'adjustment' automatically mapped to 'admin-adjustment'
if (category === 'adjustment') {
  category = 'admin-adjustment';
}
```

---

## Balance Adjustment Flow

```
1. Admin sends adjustment request
2. Validate admin role
3. Validate user exists
4. Validate transaction category
5. Update wallet balance
6. Create transaction record
7. Return new balance
```

### Credit Transaction
```typescript
user.wallet.balance += amount;
user.wallet.transactions.push({
  type: category,
  amount: amount,
  description: description,
  timestamp: new Date(),
  balanceAfter: user.wallet.balance
});
```

### Debit Transaction
```typescript
if (user.wallet.balance < amount) {
  throw new Error('Insufficient balance');
}
user.wallet.balance -= amount;
user.wallet.transactions.push({
  type: category,
  amount: -amount,
  description: description,
  timestamp: new Date(),
  balanceAfter: user.wallet.balance
});
```

---

## Authorization Levels

### Public Endpoints
- None in this suite

### User Endpoints (JWT Required)
- `GET /api/v1/auth/profile`
- `PATCH /api/v1/auth/profile`
- `GET /api/v1/payments/wallet/balance`

### Admin Endpoints (Admin Role Required)
- `POST /api/v1/users/:userId/adjust-balance`
- `GET /api/v1/users`
- `GET /api/v1/users/:userId`
- `PUT /api/v1/users/:userId`
- `DELETE /api/v1/users/:userId`

---

## Error Handling

### Common Errors

#### Unauthorized (401)
```json
{
  "status": "fail",
  "message": "Authentication required"
}
```

#### Forbidden (403)
```json
{
  "status": "fail",
  "message": "Access denied. Admin privileges required"
}
```

#### Not Found (404)
```json
{
  "status": "fail",
  "message": "User not found"
}
```

#### Bad Request (400)
```json
{
  "status": "fail",
  "message": "Invalid language preference. Must be one of: en, fr, rw"
}
```

---

## Security Validations

- ✅ JWT authentication for all protected routes
- ✅ Role-based access control (RBAC)
- ✅ Sensitive field exclusion in responses
- ✅ Input validation for all updates
- ✅ Username uniqueness enforcement
- ✅ Audit trail via transaction logs
- ✅ Soft delete (data preservation)

---

## Database Schema Validations

### User Model
```typescript
{
  username: { type: String, unique: true, required: true },
  phoneNumber: { type: String, unique: true, required: true },
  pin: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isActive: { type: Boolean, default: true },
  preferredLanguage: { type: String, enum: ['en', 'fr', 'rw'], default: 'en' },
  wallet: {
    balance: { type: Number, default: 0 },
    bonusBalance: { type: Number, default: 0 },
    transactions: [TransactionSchema]
  }
}
```

---

## Performance Considerations

- Pagination to limit response size
- Index on userId for fast lookups
- Transaction logging without blocking
- Wallet updates in single query
- Field projection to exclude sensitive data

---

## Future Enhancements

- [ ] Email verification flow
- [ ] 2FA management
- [ ] User activity logs
- [ ] Balance transfer between users
- [ ] Export user data (GDPR)
- [ ] Account suspension reasons
- [ ] User roles and permissions matrix
