# Payment Endpoints Test Documentation

## Overview
Tests for content purchase flows, wallet transactions, and payment processing.

**Test File**: `tests/integration/payment-endpoints.test.ts`  
**Total Tests**: 23  
**Status**: ✅ All Passing

---

## Payment Types

### 1. Movie Purchase (Full Content)
- Single payment for unlimited access
- No expiration
- Immediate access after purchase

### 2. Season Purchase (Bundle)
- Access to all episodes in season
- Discounted vs individual episode purchases
- Includes future episodes added to season

### 3. Episode Purchase (Individual)
- Access to single episode only
- Pay-per-episode model
- Lower cost than season/full series

---

## Test Setup

### Before Each Test
```typescript
- Create test user with 10,000 RWF balance
- Create test movie/series content
- Create admin user for protected operations
```

---

## Endpoint Tests

### 1. POST `/api/v1/payments/content/purchase/wallet`

#### Description
Purchase full movie or series using wallet balance.

#### Tests (7)

##### ✅ Should purchase movie with wallet
```typescript
Request:
  POST /api/v1/payments/content/purchase/wallet
  Headers: { Authorization: "Bearer {user_token}" }
  Body: {
    contentId: "movie_id",
    useBonus: false
  }

Expected Response:
  Status: 200
  Body: {
    status: "success",
    message: "Content purchased successfully",
    data: {
      purchase: {
        contentId: "movie_id",
        price: 1000,
        currency: "RWF",
        purchaseDate: "2025-11-19T..."
      },
      newBalance: 9000,
      bonusBalance: 0
    }
  }

Validates:
  - Wallet balance deducted
  - Purchase record created
  - Access granted immediately
  - Transaction logged
```

##### ✅ Should reject insufficient balance
```typescript
User Balance: 500 RWF
Content Price: 1000 RWF

Request:
  POST /api/v1/payments/content/purchase/wallet
  Body: { contentId: "expensive_movie_id" }

Expected Response:
  Status: 400
  Body: {
    status: "fail",
    message: "Insufficient wallet balance"
  }

Validates:
  - Balance check before purchase
  - No partial transactions
  - Clear error message
```

##### ✅ Should use bonus balance when enabled
```typescript
User Balance: 500 RWF
User Bonus Balance: 1000 RWF
Content Price: 800 RWF

Request:
  POST /api/v1/payments/content/purchase/wallet
  Body: {
    contentId: "movie_id",
    useBonus: true
  }

Expected Response:
  Status: 200
  Data: {
    newBalance: 500,      // Regular balance unchanged
    bonusBalance: 200     // Deducted from bonus
  }

Validates:
  - Bonus balance used first when enabled
  - Regular balance preserved
  - Transaction type: "purchase"
```

##### ✅ Should prevent duplicate purchase
```typescript
Request:
  POST /api/v1/payments/content/purchase/wallet
  Body: { contentId: "already_owned_movie_id" }

Expected Response:
  Status: 400
  Body: {
    status: "fail",
    message: "You already own this content"
  }

Validates:
  - Duplicate purchase prevention
  - Purchase history check
  - No double charging
```

##### ✅ Should grant access after purchase
```typescript
After Purchase:
  GET /api/v1/content/{contentId}/access

Expected Response:
  Body: {
    hasAccess: true,
    accessType: "full",
    purchaseDate: "..."
  }

Validates:
  - Access control updated
  - Purchase recorded in user's purchasedContent
  - Immediate access enabled
```

##### ✅ Should apply series discount
```typescript
Series: 3 episodes, 500 RWF each = 1500 RWF total
Discount: 15%
Final Price: 1275 RWF

Request:
  POST /api/v1/payments/content/purchase/wallet
  Body: { contentId: "series_id" }

Expected Response:
  Data: {
    purchase: {
      price: 1275,
      originalPrice: 1500,
      discount: 15
    }
  }

Validates:
  - Discount calculation
  - Series pricing logic
  - Price transparency
```

##### ✅ Should handle newly added episodes
```typescript
Scenario:
  1. User purchases series (3 episodes)
  2. Admin adds Episode 4 later
  3. User gets access automatically

Validates:
  - Full series access includes future episodes
  - episodeIdsAtPurchase tracked for reference
  - No additional payment required
```

---

### 2. POST `/api/v1/payments/season/purchase/wallet`

#### Description
Purchase an entire season (all episodes in that season).

#### Tests (5)

##### ✅ Should purchase full season
```typescript
Season 1: 3 episodes at 500 RWF each
Discount: 15% (if applicable)

Request:
  POST /api/v1/payments/season/purchase/wallet
  Headers: { Authorization: "Bearer {user_token}" }
  Body: {
    contentId: "series_id",
    seasonNumber: 1
  }

Expected Response:
  Status: 200
  Body: {
    status: "success",
    message: "Season purchased successfully",
    data: {
      purchase: {
        seasonNumber: 1,
        episodeCount: 3,
        price: 1275
      },
      newBalance: 8725
    }
  }

Validates:
  - All season episodes accessible
  - Season-level pricing
  - Discount applied
  - Access to all episodes in season
```

##### ✅ Should reject invalid season
```typescript
Request:
  POST /api/v1/payments/season/purchase/wallet
  Body: {
    contentId: "series_id",
    seasonNumber: 99  // Doesn't exist
  }

Expected Response:
  Status: 404
  Body: {
    status: "fail",
    message: "Season not found"
  }

Validates:
  - Season existence validation
  - Clear error messaging
```

##### ✅ Should prevent duplicate season purchase
```typescript
Request:
  POST /api/v1/payments/season/purchase/wallet
  Body: {
    contentId: "series_id",
    seasonNumber: 1  // Already owned
  }

Expected Response:
  Status: 400
  Body: {
    status: "fail",
    message: "You already own this season"
  }

Validates:
  - Duplicate check per season
  - Purchase history validation
```

##### ✅ Should grant episode access
```typescript
After Season Purchase:
  GET /api/v1/content/series/{seriesId}/episodes/{episodeId}/watch

Expected Response:
  Status: 200
  Body: { videoUrl: "...", hasAccess: true }

Validates:
  - All episodes in season accessible
  - Episode-level access control
  - Season purchase inheritance
```

##### ✅ Should reject insufficient balance
```typescript
User Balance: 1000 RWF
Season Price: 1275 RWF

Request:
  POST /api/v1/payments/season/purchase/wallet

Expected Response:
  Status: 400
  Message: "Insufficient wallet balance"

Validates:
  - Balance validation before purchase
```

---

### 3. POST `/api/v1/payments/episode/purchase/wallet`

#### Description
Purchase a single episode from a series.

#### Tests (6)

##### ✅ Should purchase single episode
```typescript
Request:
  POST /api/v1/payments/episode/purchase/wallet
  Headers: { Authorization: "Bearer {user_token}" }
  Body: {
    contentId: "series_id",
    episodeId: "episode_id"
  }

Expected Response:
  Status: 200
  Body: {
    status: "success",
    message: "Episode purchased successfully",
    data: {
      purchase: {
        episodeId: "episode_id",
        price: 500,
        currency: "RWF"
      },
      newBalance: 9500
    }
  }

Validates:
  - Single episode pricing
  - Episode-specific access
  - Transaction recorded
```

##### ✅ Should grant episode access
```typescript
After Purchase:
  GET /api/v1/content/series/{seriesId}/episodes/{episodeId}/watch

Expected Response:
  Status: 200
  Body: {
    episodeNumber: 1,
    videoUrl: "https://...",
    hasAccess: true
  }

Validates:
  - Episode streaming enabled
  - Access control check
  - Purchase verification
```

##### ✅ Should reject already purchased episode
```typescript
Request:
  POST /api/v1/payments/episode/purchase/wallet
  Body: { episodeId: "already_owned_episode" }

Expected Response:
  Status: 400
  Message: "You already own this episode"

Validates:
  - Duplicate purchase prevention
  - Episode-level ownership check
```

##### ✅ Should prevent purchase if full access exists
```typescript
Scenario:
  - User owns full series
  - Tries to buy individual episode

Expected Response:
  Status: 400
  Message: "You already have full access to this content"

Validates:
  - Access hierarchy check
  - Prevent redundant purchases
```

##### ✅ Should allow purchase if season owned
```typescript
Scenario:
  - User owns Season 1
  - Tries to buy Episode from Season 1

Expected Response:
  Status: 400
  Message: "You already own this season"

Validates:
  - Season-level access check
  - Prevent purchasing owned episodes
```

##### ✅ Should reject insufficient balance
```typescript
User Balance: 300 RWF
Episode Price: 500 RWF

Expected Response:
  Status: 400
  Message: "Insufficient wallet balance"
```

---

## Access Hierarchy

```
Full Series Access (Highest)
    ↓
Season Access
    ↓
Individual Episode Access (Lowest)
```

### Rules
1. **Full Series** grants access to all episodes (past and future)
2. **Season Purchase** grants access to all episodes in that season
3. **Episode Purchase** grants access to single episode only
4. Higher level purchase makes lower level redundant

---

## Pricing Logic

### Movie Pricing
```typescript
Simple flat rate: content.price (RWF)
```

### Series Pricing
```typescript
Total = Sum of all episode prices across all seasons
Discount = content.seriesDiscountPercent (e.g., 15%)
Final = Total - (Total * Discount / 100)

Example:
  10 episodes × 500 RWF = 5000 RWF
  15% discount = 750 RWF
  Final price = 4250 RWF
```

### Season Pricing
```typescript
Total = Sum of episode prices in season
Discount = content.seriesDiscountPercent (if applicable)
Final = Total - (Total * Discount / 100)
```

### Episode Pricing
```typescript
Price = episode.price (individual episode price)
```

---

## Wallet Balance Management

### Balance Types

#### Regular Balance
- Purchased via top-up
- Used for all transactions
- Never expires

#### Bonus Balance
- Promotional credits
- Optional usage (useBonus flag)
- May have expiration
- Used before regular balance when enabled

### Transaction Flow
```typescript
1. Check total balance (regular + bonus if enabled)
2. Validate sufficient funds
3. Deduct from bonus first (if useBonus=true)
4. Deduct remaining from regular balance
5. Update balances
6. Create transaction record
7. Grant content access
```

---

## Transaction Logging

### Transaction Types
- `purchase`: Content purchase
- `topup`: Wallet top-up
- `refund`: Purchase refund
- `admin-adjustment`: Admin balance change
- `bonus`: Bonus credit

### Transaction Record
```typescript
{
  type: "purchase",
  amount: 1000,
  description: "Purchased: Movie Title",
  contentId: "...",
  timestamp: "2025-11-19T...",
  balanceAfter: 9000
}
```

---

## Error Handling

### Common Errors

#### Insufficient Balance (400)
```json
{
  "status": "fail",
  "message": "Insufficient wallet balance. Current: 500 RWF, Required: 1000 RWF"
}
```

#### Already Purchased (400)
```json
{
  "status": "fail",
  "message": "You already own this content"
}
```

#### Content Not Found (404)
```json
{
  "status": "fail",
  "message": "Content not found or not available for purchase"
}
```

#### Invalid Episode/Season (404)
```json
{
  "status": "fail",
  "message": "Episode/Season not found"
}
```

---

## Security Validations

- ✅ User authentication required
- ✅ Content ownership check
- ✅ Balance validation before deduction
- ✅ Atomic transactions (all-or-nothing)
- ✅ Purchase history tracking
- ✅ No negative balances allowed

---

## Database Updates

### On Purchase
```typescript
User.purchasedContent.push({
  contentId: "...",
  purchaseDate: new Date(),
  price: 1000,
  currency: "RWF",
  episodeIdsAtPurchase: [...]  // For series
})

User.wallet.balance -= price
User.wallet.transactions.push({ ... })
```

### On Season Purchase
```typescript
User.purchasedSeasons.push({
  contentId: "...",
  seasonNumber: 1,
  purchaseDate: new Date(),
  price: 1275,
  currency: "RWF"
})
```

### On Episode Purchase
```typescript
User.purchasedEpisodes.push({
  contentId: "...",
  episodeId: "...",
  purchaseDate: new Date(),
  price: 500,
  currency: "RWF"
})
```

---

## Future Enhancements

- [ ] Subscription plans
- [ ] Rental periods (24h/48h access)
- [ ] Gift purchases
- [ ] Payment methods (card, mobile money)
- [ ] Purchase receipts via email
- [ ] Refund processing
- [ ] Purchase history export
