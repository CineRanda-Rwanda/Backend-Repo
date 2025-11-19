# Test Suite Documentation Index

## Quick Reference

This directory contains comprehensive documentation for all test suites in the Cineranda Backend.

---

## 📚 Documentation Files

### Main Documentation
- **[README.md](./README.md)** - Complete test suite overview, setup, and coverage report

### Detailed Test Documentation

1. **[AUTHENTICATION_TESTS.md](./AUTHENTICATION_TESTS.md)**
   - User registration and verification
   - Login and session management
   - Token refresh
   - Profile access
   - **14 tests**

2. **[PAYMENT_TESTS.md](./PAYMENT_TESTS.md)**
   - Movie purchases
   - Season purchases
   - Episode purchases
   - Wallet transactions
   - **23 tests**

3. **[USER_TESTS.md](./USER_TESTS.md)**
   - Profile management
   - Admin user operations
   - Balance adjustments
   - User listing and updates
   - **21 tests**

4. **[CONTENT_TESTS.md](./CONTENT_TESTS.md)** *(Coming Soon)*
   - Content browsing
   - Search and filtering
   - Series and episodes
   - Access control
   - **20 tests**

5. **[ANALYTICS_TESTS.md](./ANALYTICS_TESTS.md)** *(Coming Soon)*
   - Dashboard analytics
   - Revenue reports
   - User growth
   - Content performance
   - **15 tests**

6. **[NOTIFICATION_TESTS.md](./NOTIFICATION_TESTS.md)** *(Coming Soon)*
   - Broadcast notifications
   - User messages
   - Read/unread management
   - **22 tests**

7. **[LIBRARY_TESTS.md](./LIBRARY_TESTS.md)** *(Coming Soon)*
   - Library management
   - Watch progress tracking
   - **15 tests**

8. **[RATING_TESTS.md](./RATING_TESTS.md)** *(Coming Soon)*
   - Content ratings
   - Reviews
   - Rating management
   - **21 tests**

---

## 🎯 Test Coverage

| Category | Tests | Status |
|----------|-------|--------|
| **Authentication** | 14 | ✅ 100% |
| **Payments** | 23 | ✅ 100% |
| **User Management** | 21 | ✅ 100% |
| **Content** | 20 | ✅ 100% |
| **Analytics** | 15 | ✅ 100% |
| **Notifications** | 22 | ✅ 100% |
| **Library & Progress** | 15 | ✅ 100% |
| **Ratings** | 21 | ✅ 100% |
| **Unit Tests** | 2 | ✅ 100% |
| **TOTAL** | **154** | **✅ 100%** |

---

## 🚀 Quick Start

### Run All Tests
```bash
npm test
```

### Run Specific Suite
```bash
npm test -- auth-endpoints.test.ts
npm test -- payment-endpoints.test.ts
npm test -- user-endpoints.test.ts
```

### Run Tests in Watch Mode
```bash
npm test -- --watch
```

### Run with Coverage
```bash
npm test -- --coverage
```

---

## 📖 Documentation Structure

Each test documentation file follows this structure:

1. **Overview** - Purpose and test count
2. **Test Setup** - Before/after hooks
3. **Endpoint Tests** - Detailed test cases
4. **Data Flow** - Process diagrams
5. **Error Handling** - Error scenarios
6. **Security** - Validation checks
7. **Future Enhancements** - Planned features

---

## 🔍 Finding Tests

### By Feature
- **User Registration**: See [AUTHENTICATION_TESTS.md](./AUTHENTICATION_TESTS.md#verify-registration)
- **Content Purchase**: See [PAYMENT_TESTS.md](./PAYMENT_TESTS.md#movie-purchase)
- **Admin Operations**: See [USER_TESTS.md](./USER_TESTS.md#admin-user-management)

### By HTTP Method
- **GET**: Profile, listings, analytics
- **POST**: Creation, purchases, login
- **PUT/PATCH**: Updates
- **DELETE**: Soft deletion

### By Status Code
- **200**: Success responses
- **400**: Bad request validation
- **401**: Authentication failures
- **403**: Authorization failures
- **404**: Not found errors

---

## 🛠️ Test Helpers

Located in `tests/helpers/testHelpers.ts`

```typescript
// Create test data
await TestHelpers.createTestUser({ balance: 5000 });
await TestHelpers.createAdminUser();
await TestHelpers.createTestMovie({ price: 1000 });
await TestHelpers.createTestSeries(5); // 5 episodes

// Simulate purchases
await TestHelpers.purchaseContent(userId, movieId);
await TestHelpers.purchaseEpisode(userId, seriesId, episodeId);
```

See [README.md#test-helpers](./README.md#test-helpers) for full API.

---

## ⚙️ Environment Setup

### Required Environment Variables
```env
# Database
MONGODB_URI=mongodb://localhost:27017/cineranda-test

# JWT
JWT_SECRET=your_secret_key
JWT_REFRESH_SECRET=your_refresh_secret
JWT_EXPIRES_IN=24h

# Payment (if needed)
FLUTTERWAVE_PUBLIC_KEY=...
FLUTTERWAVE_SECRET_KEY=...

# Notifications
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
```

### Test Database
- Uses MongoDB Memory Server
- Isolated from production
- Auto-cleanup after each test
- Launch timeout: 120s

---

## 📊 Test Execution Flow

```
┌─────────────────────────────────────┐
│  Global Setup (tests/setup.ts)     │
│  - Start MongoDB Memory Server      │
│  - Connect to test database         │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  Test Suite Setup (beforeAll)      │
│  - Create admin user                │
│  - Create settings                  │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  Individual Test (beforeEach)       │
│  - Create test user                 │
│  - Create test content              │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  Execute Test                       │
│  - Make HTTP request                │
│  - Validate response                │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  Cleanup (afterEach)                │
│  - Clear all collections            │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  Global Cleanup (afterAll)          │
│  - Disconnect from database         │
│  - Stop MongoDB Memory Server       │
└─────────────────────────────────────┘
```

---

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection Timeout**
   - Increase `launchTimeout` in `tests/setup.ts`
   - Check system resources

2. **Test Data Conflicts**
   - Ensure `afterEach` cleanup runs
   - Check for database connection issues

3. **Authentication Failures**
   - Recreate user if needed in test
   - Check token expiration

4. **Settings Not Found**
   - Create Settings in test's `beforeAll` or test body

See [README.md#troubleshooting](./README.md#troubleshooting) for more details.

---

## 📝 Contributing

When adding new tests:

1. ✅ Follow existing test structure
2. ✅ Use descriptive test names
3. ✅ Test both success and error cases
4. ✅ Update documentation
5. ✅ Maintain 100% coverage
6. ✅ Use TestHelpers for data creation

---

## 📞 Support

For questions or issues:
- Check documentation first
- Review similar tests
- Contact: dev@cineranda.com

---

## 📄 License

Copyright © 2025 Cineranda. All rights reserved.
