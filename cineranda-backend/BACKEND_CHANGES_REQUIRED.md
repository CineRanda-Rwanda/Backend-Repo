# Cineranda Platform - Backend Changes Required

**Document Version:** 1.0  
**Date:** November 18, 2025  
**Purpose:** Complete specification of backend API changes needed to align with new platform requirements

---

## 📋 Table of Contents

1. [Overview of Changes](#overview-of-changes)
2. [Critical System-Wide Changes](#critical-system-wide-changes)
3. [Content & Pricing Changes](#content--pricing-changes)
4. [Wallet & Payment System Changes](#wallet--payment-system-changes)
5. [User Access & Permissions](#user-access--permissions)
6. [Admin Features & Capabilities](#admin-features--capabilities)
7. [Analytics & Reporting Enhancements](#analytics--reporting-enhancements)
8. [Notification System](#notification-system)
9. [New Endpoints Required](#new-endpoints-required)
10. [Updated Endpoints](#updated-endpoints)
11. [Removed/Deprecated Fields](#removeddeprecated-fields)

---

## Overview of Changes

### Key Platform Changes:
1. **Remove coin system** - Replace with single RWF wallet balance
2. **Unify pricing** - All content priced in RWF only
3. **Trailer access for unregistered users** - Allow preview without full authentication
4. **Enhanced admin controls** - Rating permissions, notifications, analytics
5. **Bonus system integration** - Bonuses added to main balance, not separate

### ✅ What's Being KEPT (DO NOT CHANGE):
- **All content metadata fields:** `title`, `description`, `duration`, `releaseYear`, `cast`, `genres`, `categories`
- **All media URLs:** `posterImageUrl`, `movieFileUrl`, `videoUrl`, `trailerYoutubeLink`
- **Content flags:** `isPublished`, `isFeatured`, `isFree`
- **Subtitles system:** Multi-language subtitle support (`en`, `fr`, `kin`)
- **Series structure:** `seasons`, `episodes`, `seriesDiscountPercent`
- **Episode metadata:** `episodeNumber`, `seasonNumber`, `description`, `duration`
- **All timestamps:** `createdAt`, `updatedAt`

### ❌ What's Being REMOVED:
- `priceInCoins` field (everywhere)
- `coinWallet` from User model
- All coin-related transaction fields
- Coin conversion logic

### 🔄 What's Being CHANGED:
- `priceInRwf` → Rename to `price` (RWF only)
- `coinWallet.balance` → `wallet.balance` (User model)
- Add `wallet.bonusBalance` (NEW)
- Add `ratingsEnabled` to content (NEW)
- Trailer access made public (NEW endpoints)
- Notification system (NEW)
- Enhanced analytics (NEW)

### User Type Definitions:

#### **Unregistered Users (Public)**
- Can browse all published content
- Can search, filter, and sort content
- Can view movie/series details
- Can watch trailers (NEW)
- Cannot stream full movies/episodes
- Cannot rate or review content

#### **Registered Users**
- Everything unregistered users can do, PLUS:
- Can stream full movies/episodes (if unlocked)
- Have a wallet with RWF balance
- Can purchase/unlock content
- Can rate content (if admin allows for that specific content)
- Can view watch history
- Can receive platform notifications
- Can view their unlocked content library

#### **Admins**
- Full content management (CRUD)
- User management (ban/unban, balance adjustment, etc.)
- Can enable/disable ratings per content
- Can send notifications (broadcast or targeted)
- Enhanced analytics dashboard
- Platform settings management

---

## Critical System-Wide Changes

### 1. Remove Coin System Entirely

**Current State:**
- Wallet has `coinWallet.balance` (RWF) and separate coin tracking
- Content has `priceInCoins` field
- Conversion logic between RWF and coins (1 RWF = 1 Coin)

**Required State:**
- Single `wallet.balance` field in RWF only
- Remove all coin-related fields
- All pricing in RWF only

#### Database Schema Changes:

**User Model - BEFORE:**
```json
{
  "coinWallet": {
    "balance": 5000,
    "transactions": []
  }
}
```

**User Model - AFTER:**
```json
{
  "wallet": {
    "balance": 5000,
    "bonusBalance": 500,
    "transactions": []
  }
}
```

**Content Model - BEFORE:**
```json
{
  "priceInRwf": 5000,
  "priceInCoins": 50
}
```

**Content Model - AFTER:**
```json
{
  "price": 5000
}
```

---

### 2. Bonus System Integration

**Current State:**
- Welcome bonus added as coins
- Bonuses tracked separately

**Required State:**
- Welcome bonus added to main wallet balance
- Optional: Track bonus separately for display/analytics, but usable as regular balance

**Implementation:**

```json
{
  "wallet": {
    "balance": 5500,
    "bonusBalance": 500,
    "totalBalance": 6000
  }
}
```

**Business Logic:**
- `totalBalance = balance + bonusBalance`
- When purchasing content, deduct from `bonusBalance` first, then `balance`
- Bonuses can be used exactly like regular balance
- Optional: Set expiry dates on bonuses

---

## Preserved Fields (DO NOT REMOVE)

### ✅ Fields That Must Be Kept

The following fields are **already implemented** in the current API and should be **preserved** during the migration:

#### **Movie Fields (Keep All):**
- `title` (string) - Movie title
- `description` (string) - Movie synopsis/description
- `contentType` (string) - Always "Movie"
- `duration` (number) - Duration in minutes
- `releaseYear` (number) - Year of release
- `cast` (array of strings) - List of actors/cast members
- `trailerYoutubeLink` (string, optional) - YouTube trailer URL
- `posterImageUrl` (string) - S3 URL for poster image
- `movieFileUrl` (string) - S3 URL for full movie file
- `genres` (array of ObjectIds) - Genre references
- `categories` (array of ObjectIds) - Category references
- `isPublished` (boolean) - Publish status
- `isFeatured` (boolean) - Featured on homepage
- `isFree` (boolean) - Free content flag
- `subtitles` (object) - Subtitle files
  - `en` (string, optional) - English subtitle URL
  - `fr` (string, optional) - French subtitle URL
  - `kin` (string, optional) - Kinyarwanda subtitle URL
- `createdAt` (date) - Creation timestamp
- `updatedAt` (date) - Last update timestamp

#### **Series Fields (Keep All):**
- `title` (string) - Series title
- `description` (string) - Series synopsis
- `contentType` (string) - Always "Series"
- `posterImageUrl` (string) - S3 URL for series poster
- `trailerYoutubeLink` (string, optional) - YouTube series trailer
- `releaseYear` (number) - Year of first release
- `cast` (array of strings) - Main cast members
- `seriesDiscountPercent` (number) - Discount for buying whole series
- `genres` (array of ObjectIds) - Genre references
- `categories` (array of ObjectIds) - Category references
- `isPublished` (boolean) - Publish status
- `isFeatured` (boolean) - Featured status
- `seasonCount` (number) - Total number of seasons
- `totalEpisodes` (number) - Total episode count
- `seasons` (array) - Season and episode data
- `createdAt` (date) - Creation timestamp
- `updatedAt` (date) - Last update timestamp

#### **Episode Fields (Keep All):**
- `episodeNumber` (number) - Episode number
- `title` (string) - Episode title
- `description` (string) - Episode synopsis
- `duration` (number) - Duration in minutes
- `trailerYoutubeLink` (string, optional) - YouTube episode trailer
- `videoUrl` (string) - S3 URL for full episode
- `isFree` (boolean) - Free episode flag
- `isPublished` (boolean) - Publish status
- `subtitles` (object) - Episode subtitle files
  - `en`, `fr`, `kin` - Language-specific subtitle URLs
- `createdAt` (date) - Creation timestamp
- `updatedAt` (date) - Last update timestamp

#### **Season Fields (Keep All):**
- `seasonNumber` (number) - Season number
- `seasonTitle` (string) - Season title (e.g., "Season 1")
- `episodeCount` (number) - Number of episodes in season
- `episodes` (array) - Array of episode objects

### ⚠️ Important Notes:

1. **Cast Field:** Already implemented and used - DO NOT REMOVE
2. **Trailer Field Name:** Use `trailerYoutubeLink` (not `trailerUrl`)
3. **Video URLs:** 
   - Movies use `movieFileUrl`
   - Episodes use `videoUrl`
   - Both are correct - don't standardize
4. **Poster URLs:** Use `posterImageUrl` (not `posterUrl`)
5. **Subtitles:** Keep object structure with language codes
6. **Series Discount:** `seriesDiscountPercent` already exists for bundle pricing

---

## Content & Pricing Changes

### 1. Unified Pricing Model

#### Updated Content Schema

**Movies:**
```json
{
  "_id": "68c9f123a45b67c8d90e1234",
  "title": "The Last Kingdom",
  "description": "An epic journey through medieval England",
  "contentType": "Movie",
  "price": 5000,
  "isFree": false,
  "ratingsEnabled": true,
  "trailerYoutubeLink": "https://youtube.com/watch?v=abc123",
  "movieFileUrl": "https://s3.amazonaws.com/videos/last-kingdom.mp4",
  "posterImageUrl": "https://s3.amazonaws.com/posters/last-kingdom.jpg",
  "duration": 120,
  "releaseYear": 2024,
  "isPublished": true,
  "isFeatured": false,
  "cast": ["Actor 1", "Actor 2"],
  "genres": ["68c9f456..."],
  "categories": ["68c9f789..."],
  "subtitles": {
    "en": "https://s3.amazonaws.com/subtitles/last-kingdom-en.srt",
    "fr": "https://s3.amazonaws.com/subtitles/last-kingdom-fr.srt",
    "kin": "https://s3.amazonaws.com/subtitles/last-kingdom-kin.srt"
  },
  "createdAt": "2025-10-16T10:36:04.718Z",
  "updatedAt": "2025-10-16T10:36:04.718Z"
}
```

**Series:**
```json
{
  "_id": "68c9f123a45b67c8d90e5678",
  "title": "Breaking Bad",
  "description": "A high school chemistry teacher turned meth manufacturer",
  "contentType": "Series",
  "posterImageUrl": "https://s3.amazonaws.com/posters/breaking-bad.jpg",
  "trailerYoutubeLink": "https://youtube.com/watch?v=series-trailer",
  "seriesDiscountPercent": 15,
  "ratingsEnabled": true,
  "isPublished": true,
  "isFeatured": false,
  "releaseYear": 2023,
  "cast": ["Bryan Cranston", "Aaron Paul"],
  "genres": ["68dd0663..."],
  "categories": ["68f0f254..."],
  "seasonCount": 1,
  "totalEpisodes": 7,
  "seasons": [
    {
      "_id": "68cbd890...",
      "seasonNumber": 1,
      "seasonTitle": "Season 1",
      "episodeCount": 7,
      "episodes": [
        {
          "_id": "68cbd890b77ec6b0adb95681",
          "episodeNumber": 1,
          "title": "Pilot",
          "description": "The first episode of the series",
          "price": 2000,
          "isFree": false,
          "trailerYoutubeLink": "https://youtube.com/watch?v=def456",
          "videoUrl": "https://s3.amazonaws.com/videos/bb-s01e01.mp4",
          "duration": 48,
          "isPublished": true,
          "subtitles": {
            "en": "https://s3.amazonaws.com/subtitles/bb-s01e01-en.srt"
          },
          "createdAt": "2025-10-16T10:46:36.672Z",
          "updatedAt": "2025-10-16T10:46:36.672Z"
        }
      ]
    }
  ],
  "createdAt": "2025-10-16T10:36:04.718Z",
  "updatedAt": "2025-10-16T10:36:04.718Z"
}
```

---

### 2. Trailer Access System (NEW)

**Requirement:** Unregistered users can watch trailers but not full content.

#### Enhanced Field: `trailerYoutubeLink`

**Current Implementation:** API already has `trailerYoutubeLink` field (optional)

**Keep As Is:** This field is already properly implemented

```typescript
interface Movie {
  trailerYoutubeLink?: string  // YouTube URL for trailer
  movieFileUrl: string         // Full movie file (protected)
}

interface Episode {
  trailerYoutubeLink?: string  // YouTube URL for episode trailer
  videoUrl: string             // Full episode file (protected)
}
```

**Note:** Field already exists and doesn't need migration
```

---

### 3. Content Rating Control (NEW)

**Requirement:** Admins can enable/disable ratings per content.

#### New Field: `ratingsEnabled`

Add to both Movies and Series:

```typescript
interface Content {
  ratingsEnabled: boolean  // Default: true
}
```

**Business Logic:**
- If `ratingsEnabled === false`, users cannot submit ratings
- Existing ratings remain visible
- Only admins can toggle this setting

---

## Wallet & Payment System Changes

### 1. Updated Wallet Structure

#### GET `/wallet/balance` - Get Wallet Balance

**CURRENT Response:**
```json
{
  "status": "success",
  "data": {
    "coinWallet": {
      "balance": 5000
    }
  }
}
```

**NEW Response:**
```json
{
  "status": "success",
  "data": {
    "wallet": {
      "balance": 5000,
      "bonusBalance": 500,
      "totalBalance": 5500
    },
    "currency": "RWF"
  }
}
```

---

### 2. Wallet Top-Up

#### POST `/wallet/topup` - Top Up Wallet

**Request Body:**
```json
{
  "amount": 10000,
  "phoneNumber": "250788888888",
  "paymentMethod": "momo"
}
```

**Success Response (200 OK):**
```json
{
  "status": "success",
  "message": "Wallet top-up initiated",
  "data": {
    "transactionId": "txn_1234567890",
    "amount": 10000,
    "currency": "RWF",
    "paymentUrl": "https://flutterwave.com/pay/...",
    "expiresAt": "2025-11-18T15:30:00.000Z"
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "status": "error",
  "message": "Invalid amount",
  "errors": {
    "amount": "Minimum top-up amount is 1000 RWF"
  }
}
```

---

### 3. Content Purchase (Updated)

#### POST `/purchases/unlock` - Purchase/Unlock Movie or Series

**CURRENT Request:**
```json
{
  "contentId": "68c9f123a45b67c8d90e1234",
  "paymentMethod": "wallet",
  "currency": "coins"
}
```

**NEW Request:**
```json
{
  "contentId": "68c9f123a45b67c8d90e1234",
  "paymentMethod": "wallet"
}
```

**Success Response (200 OK):**
```json
{
  "status": "success",
  "message": "Content unlocked successfully",
  "data": {
    "purchase": {
      "_id": "68cbd123b77ec6b0adb95678",
      "userId": "68cbd395b77ec6b0adb95640",
      "contentId": "68c9f123a45b67c8d90e1234",
      "contentType": "Movie",
      "contentTitle": "The Last Kingdom",
      "amountPaid": 5000,
      "currency": "RWF",
      "purchasedAt": "2025-11-18T10:30:00.000Z"
    },
    "remainingBalance": {
      "balance": 10000,
      "bonusBalance": 0,
      "totalBalance": 10000
    }
  }
}
```

**Error Response (402 Payment Required):**
```json
{
  "status": "error",
  "message": "Insufficient wallet balance",
  "data": {
    "requiredAmount": 5000,
    "currentBalance": 3000,
    "shortfall": 2000,
    "currency": "RWF"
  }
}
```

---

### 4. Episode Purchase (Updated)

#### POST `/purchases/unlock-episode` - Purchase Single Episode

**NEW Request:**
```json
{
  "contentId": "68c9f123a45b67c8d90e5678",
  "seasonNumber": 1,
  "episodeId": "68cbd890b77ec6b0adb95681",
  "paymentMethod": "wallet"
}
```

**Success Response (200 OK):**
```json
{
  "status": "success",
  "message": "Episode unlocked successfully",
  "data": {
    "purchase": {
      "_id": "68cbd123b77ec6b0adb95679",
      "userId": "68cbd395b77ec6b0adb95640",
      "contentId": "68c9f123a45b67c8d90e5678",
      "episodeId": "68cbd890b77ec6b0adb95681",
      "contentType": "Episode",
      "seriesTitle": "Breaking Bad",
      "seasonNumber": 1,
      "episodeNumber": 1,
      "episodeTitle": "Pilot",
      "amountPaid": 2000,
      "currency": "RWF",
      "purchasedAt": "2025-11-18T10:35:00.000Z"
    },
    "remainingBalance": {
      "balance": 8000,
      "bonusBalance": 0,
      "totalBalance": 8000
    }
  }
}
```

---

### 5. Season Purchase (Updated)

#### POST `/purchases/season` - Purchase Entire Season

**NEW Request:**
```json
{
  "contentId": "68c9f123a45b67c8d90e5678",
  "seasonNumber": 1,
  "paymentMethod": "wallet"
}
```

**Success Response (200 OK):**
```json
{
  "status": "success",
  "message": "Season unlocked successfully",
  "data": {
    "purchase": {
      "_id": "68cbd123b77ec6b0adb95680",
      "userId": "68cbd395b77ec6b0adb95640",
      "contentId": "68c9f123a45b67c8d90e5678",
      "contentType": "Season",
      "seriesTitle": "Breaking Bad",
      "seasonNumber": 1,
      "episodeCount": 7,
      "amountPaid": 11900,
      "originalPrice": 14000,
      "discountPercent": 15,
      "currency": "RWF",
      "purchasedAt": "2025-11-18T10:40:00.000Z"
    },
    "unlockedEpisodes": [
      "68cbd890b77ec6b0adb95681",
      "68cbd890b77ec6b0adb95682"
    ],
    "remainingBalance": {
      "balance": 8100,
      "bonusBalance": 0,
      "totalBalance": 8100
    }
  }
}
```

---

## User Access & Permissions

### 1. Trailer Access for Unregistered Users (NEW)

#### GET `/content/movies/{movieId}/trailer` - Get Movie Trailer

**Authentication:** ❌ Not Required (Public)

**Purpose:** Allow unregistered users to watch trailers

**Success Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "movie": {
      "_id": "68c9f123a45b67c8d90e1234",
      "title": "The Last Kingdom",
      "trailerYoutubeLink": "https://youtube.com/watch?v=abc123",
      "posterImageUrl": "https://s3.amazonaws.com/posters/last-kingdom.jpg",
      "duration": 120,
      "releaseYear": 2024
    }
  }
}
```

**Error Response (404 Not Found):**
```json
{
  "status": "error",
  "message": "Trailer not available for this content"
}
```

---

#### GET `/content/series/{seriesId}/seasons/{seasonNumber}/episodes/{episodeId}/trailer` - Get Episode Trailer

**Authentication:** ❌ Not Required (Public)

**Success Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "episode": {
      "_id": "68cbd890b77ec6b0adb95681",
      "seriesTitle": "Breaking Bad",
      "seasonNumber": 1,
      "episodeNumber": 1,
      "title": "Pilot",
      "trailerYoutubeLink": "https://youtube.com/watch?v=def456",
      "duration": 48
    }
  }
}
```

---

### 2. Updated Content Streaming Endpoints

#### GET `/content/movies/{movieId}/watch` - Stream Full Movie

**Authentication:** ✅ Required (`{{authToken}}`)

**Additional Check:** User must have unlocked this movie

**Success Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "movieFileUrl": "https://s3.amazonaws.com/videos/last-kingdom.mp4",
    "expiresAt": "2025-11-18T22:00:00.000Z",
    "duration": 120,
    "subtitles": {
      "en": "https://s3.amazonaws.com/subtitles/last-kingdom-en.srt",
      "fr": "https://s3.amazonaws.com/subtitles/last-kingdom-fr.srt",
      "kin": "https://s3.amazonaws.com/subtitles/last-kingdom-kin.srt"
    }
  }
}
```

**Error Response (403 Forbidden) - Content Not Unlocked:**
```json
{
  "status": "error",
  "message": "Content not unlocked",
  "data": {
    "contentId": "68c9f123a45b67c8d90e1234",
    "contentTitle": "The Last Kingdom",
    "price": 5000,
    "currency": "RWF",
    "userBalance": 3000,
    "canAfford": false
  }
}
```

---

## Admin Features & Capabilities

### 1. Content Rating Control (NEW)

#### PATCH `/admin/content/{contentId}/ratings` - Enable/Disable Ratings

**Authentication:** ✅ Required (`{{adminToken}}`)

**Request Body:**
```json
{
  "ratingsEnabled": false
}
```

**Success Response (200 OK):**
```json
{
  "status": "success",
  "message": "Ratings settings updated",
  "data": {
    "contentId": "68c9f123a45b67c8d90e1234",
    "contentTitle": "The Last Kingdom",
    "ratingsEnabled": false,
    "updatedBy": "admin@cineranda.com",
    "updatedAt": "2025-11-18T11:00:00.000Z"
  }
}
```

**Use Cases:**
- Disable ratings for controversial content
- Prevent rating manipulation for new releases
- Temporarily disable during content updates

---

### 2. Batch Rating Control (NEW)

#### PATCH `/admin/content/batch-ratings` - Bulk Enable/Disable Ratings

**Authentication:** ✅ Required (`{{adminToken}}`)

**Request Body:**
```json
{
  "contentIds": [
    "68c9f123a45b67c8d90e1234",
    "68c9f456a45b67c8d90e5678"
  ],
  "ratingsEnabled": false
}
```

**Success Response (200 OK):**
```json
{
  "status": "success",
  "message": "Ratings updated for 2 content items",
  "data": {
    "updatedCount": 2,
    "failedCount": 0,
    "updatedContent": [
      {
        "contentId": "68c9f123a45b67c8d90e1234",
        "title": "The Last Kingdom",
        "ratingsEnabled": false
      },
      {
        "contentId": "68c9f456a45b67c8d90e5678",
        "title": "Breaking Bad",
        "ratingsEnabled": false
      }
    ]
  }
}
```

---

### 3. Admin Notification System (NEW)

#### POST `/admin/notifications/send` - Send Notification to Users

**Authentication:** ✅ Required (`{{adminToken}}`)

**Request Body (Broadcast to All Users):**
```json
{
  "type": "broadcast",
  "title": "New Movie Released!",
  "message": "Check out 'The Last Kingdom' now available on Cineranda",
  "actionType": "content",
  "actionUrl": "/content/movies/68c9f123a45b67c8d90e1234",
  "priority": "high",
  "imageUrl": "https://s3.amazonaws.com/posters/last-kingdom.jpg"
}
```

**Request Body (Targeted Notification):**
```json
{
  "type": "targeted",
  "recipients": [
    "68cbd395b77ec6b0adb95640",
    "68cbd123b77ec6b0adb95555"
  ],
  "title": "Welcome Bonus Added!",
  "message": "We've added 500 RWF to your wallet as a thank you",
  "actionType": "wallet",
  "actionUrl": "/wallet",
  "priority": "medium"
}
```

**Success Response (200 OK):**
```json
{
  "status": "success",
  "message": "Notification sent successfully",
  "data": {
    "notificationId": "68cbd789b77ec6b0adb95690",
    "type": "broadcast",
    "recipientCount": 1547,
    "sentAt": "2025-11-18T12:00:00.000Z",
    "estimatedDelivery": "2025-11-18T12:05:00.000Z"
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "status": "error",
  "message": "Invalid notification data",
  "errors": {
    "title": "Title is required",
    "message": "Message cannot be empty"
  }
}
```

---

#### GET `/admin/notifications/history` - Get Notification History

**Authentication:** ✅ Required (`{{adminToken}}`)

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 20)
- `type` (optional): "broadcast" | "targeted"
- `startDate` (optional): ISO 8601 date
- `endDate` (optional): ISO 8601 date

**Example Request:**
```
GET /admin/notifications/history?page=1&limit=10&type=broadcast
```

**Success Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "notifications": [
      {
        "_id": "68cbd789b77ec6b0adb95690",
        "type": "broadcast",
        "title": "New Movie Released!",
        "message": "Check out 'The Last Kingdom' now available on Cineranda",
        "recipientCount": 1547,
        "deliveredCount": 1523,
        "readCount": 892,
        "clickedCount": 456,
        "sentBy": {
          "_id": "68cbd123b77ec6b0adb95650",
          "email": "admin@cineranda.com"
        },
        "sentAt": "2025-11-18T12:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 15,
      "totalNotifications": 148,
      "limit": 10
    }
  }
}
```

---

### 4. User Notifications Endpoints (NEW)

#### GET `/notifications` - Get User Notifications

**Authentication:** ✅ Required (`{{authToken}}`)

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 20)
- `unreadOnly` (optional): boolean

**Success Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "notifications": [
      {
        "_id": "68cbd890b77ec6b0adb95691",
        "title": "New Movie Released!",
        "message": "Check out 'The Last Kingdom' now available on Cineranda",
        "actionType": "content",
        "actionUrl": "/content/movies/68c9f123a45b67c8d90e1234",
        "imageUrl": "https://s3.amazonaws.com/posters/last-kingdom.jpg",
        "priority": "high",
        "isRead": false,
        "receivedAt": "2025-11-18T12:00:00.000Z"
      },
      {
        "_id": "68cbd890b77ec6b0adb95692",
        "title": "Welcome Bonus",
        "message": "500 RWF added to your wallet",
        "actionType": "wallet",
        "actionUrl": "/wallet",
        "isRead": true,
        "readAt": "2025-11-17T14:30:00.000Z",
        "receivedAt": "2025-11-17T10:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalNotifications": 28,
      "unreadCount": 5,
      "limit": 20
    }
  }
}
```

---

#### PUT `/notifications/{notificationId}/read` - Mark Notification as Read

**Authentication:** ✅ Required (`{{authToken}}`)

**Success Response (200 OK):**
```json
{
  "status": "success",
  "message": "Notification marked as read",
  "data": {
    "notificationId": "68cbd890b77ec6b0adb95691",
    "isRead": true,
    "readAt": "2025-11-18T14:30:00.000Z"
  }
}
```

---

#### PUT `/notifications/read-all` - Mark All Notifications as Read

**Authentication:** ✅ Required (`{{authToken}}`)

**Success Response (200 OK):**
```json
{
  "status": "success",
  "message": "All notifications marked as read",
  "data": {
    "markedCount": 5
  }
}
```

---

#### DELETE `/notifications/{notificationId}` - Delete Notification

**Authentication:** ✅ Required (`{{authToken}}`)

**Success Response (200 OK):**
```json
{
  "status": "success",
  "message": "Notification deleted"
}
```

---

## Analytics & Reporting Enhancements

### 1. Enhanced Dashboard Analytics

#### GET `/admin/analytics/dashboard` - Enhanced Dashboard Stats

**Authentication:** ✅ Required (`{{adminToken}}`)

**CURRENT Response:**
```json
{
  "status": "success",
  "data": {
    "totalUsers": 1547,
    "totalContent": 245,
    "totalRevenue": 45000000
  }
}
```

**NEW Response:**
```json
{
  "status": "success",
  "data": {
    "overview": {
      "totalUsers": 1547,
      "activeUsers": 892,
      "newUsersToday": 23,
      "newUsersThisWeek": 156,
      "newUsersThisMonth": 678
    },
    "content": {
      "totalContent": 245,
      "totalMovies": 178,
      "totalSeries": 67,
      "publishedContent": 223,
      "draftContent": 22,
      "ratingsEnabledCount": 210,
      "ratingsDisabledCount": 35
    },
    "revenue": {
      "totalRevenue": 45000000,
      "revenueToday": 234000,
      "revenueThisWeek": 1567000,
      "revenueThisMonth": 6789000,
      "currency": "RWF"
    },
    "transactions": {
      "totalTransactions": 5678,
      "transactionsToday": 45,
      "transactionsThisWeek": 312,
      "transactionsThisMonth": 1234,
      "averageTransactionValue": 7925
    },
    "topContent": [
      {
        "contentId": "68c9f123a45b67c8d90e1234",
        "title": "The Last Kingdom",
        "type": "Movie",
        "views": 2345,
        "purchases": 892,
        "revenue": 4460000,
        "rating": 4.5
      }
    ],
    "walletStats": {
      "totalWalletBalance": 23456000,
      "totalBonusBalance": 2345000,
      "averageUserBalance": 15167
    }
  }
}
```

---

### 2. Revenue Analytics (Enhanced)

#### GET `/admin/analytics/revenue` - Revenue Analytics

**Authentication:** ✅ Required (`{{adminToken}}`)

**Query Parameters:**
- `startDate` (optional): ISO 8601 date
- `endDate` (optional): ISO 8601 date
- `groupBy` (optional): "day" | "week" | "month" (default: "day")
- `contentType` (optional): "Movie" | "Series" | "Episode"

**Example Request:**
```
GET /admin/analytics/revenue?startDate=2025-11-01&endDate=2025-11-18&groupBy=day
```

**Success Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "summary": {
      "totalRevenue": 6789000,
      "transactionCount": 1234,
      "averageTransactionValue": 5501,
      "uniqueCustomers": 567,
      "period": {
        "startDate": "2025-11-01",
        "endDate": "2025-11-18"
      }
    },
    "byDate": [
      {
        "date": "2025-11-18",
        "revenue": 234000,
        "transactions": 45,
        "uniqueCustomers": 32
      },
      {
        "date": "2025-11-17",
        "revenue": 456000,
        "transactions": 67,
        "uniqueCustomers": 45
      }
    ],
    "byContentType": {
      "Movie": {
        "revenue": 4567000,
        "transactions": 892,
        "percentage": 67.3
      },
      "Episode": {
        "revenue": 1890000,
        "transactions": 234,
        "percentage": 27.8
      },
      "Season": {
        "revenue": 332000,
        "transactions": 108,
        "percentage": 4.9
      }
    },
    "topRevenueContent": [
      {
        "contentId": "68c9f123a45b67c8d90e1234",
        "title": "The Last Kingdom",
        "type": "Movie",
        "revenue": 4460000,
        "purchases": 892
      }
    ]
  }
}
```

---

### 3. User Growth Analytics (NEW)

#### GET `/admin/analytics/user-growth` - User Growth Metrics

**Authentication:** ✅ Required (`{{adminToken}}`)

**Query Parameters:**
- `startDate` (optional): ISO 8601 date
- `endDate` (optional): ISO 8601 date
- `groupBy` (optional): "day" | "week" | "month"

**Success Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "summary": {
      "totalUsers": 1547,
      "activeUsers": 892,
      "inactiveUsers": 655,
      "newUsers": 156,
      "churnRate": 3.2,
      "retentionRate": 96.8
    },
    "growthByDate": [
      {
        "date": "2025-11-18",
        "newUsers": 23,
        "activeUsers": 245,
        "inactiveUsers": 12
      }
    ],
    "userActivity": {
      "dailyActiveUsers": 245,
      "weeklyActiveUsers": 678,
      "monthlyActiveUsers": 892
    },
    "registrationSources": {
      "organic": 892,
      "referral": 234,
      "promotion": 421
    }
  }
}
```

---

### 4. Content Performance Analytics (Enhanced)

#### GET `/admin/analytics/content-performance` - Content Performance Metrics

**Authentication:** ✅ Required (`{{adminToken}}`)

**Query Parameters:**
- `contentType` (optional): "Movie" | "Series"
- `limit` (optional, default: 10): Top N content items
- `sortBy` (optional): "views" | "revenue" | "rating" | "purchases"
- `startDate` (optional): Filter by date range
- `endDate` (optional): Filter by date range

**Success Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "topPerformers": [
      {
        "contentId": "68c9f123a45b67c8d90e1234",
        "title": "The Last Kingdom",
        "type": "Movie",
        "metrics": {
          "views": 2345,
          "uniqueViewers": 892,
          "purchases": 892,
          "revenue": 4460000,
          "averageRating": 4.5,
          "totalRatings": 234,
          "watchTimeHours": 6234,
          "completionRate": 78.5
        },
        "trends": {
          "viewsGrowth": 12.3,
          "revenueGrowth": 8.9
        }
      }
    ],
    "contentByGenre": [
      {
        "genreId": "68c9f456a45b67c8d90e9999",
        "genreName": "Action",
        "contentCount": 45,
        "totalViews": 12345,
        "totalRevenue": 8900000
      }
    ],
    "ratingStatistics": {
      "averageRating": 4.2,
      "totalRatings": 5678,
      "ratingsDistribution": {
        "5": 2345,
        "4": 1890,
        "3": 892,
        "2": 345,
        "1": 206
      }
    }
  }
}
```

---

### 5. Wallet & Transaction Analytics (NEW)

#### GET `/admin/analytics/wallet-stats` - Wallet Statistics

**Authentication:** ✅ Required (`{{adminToken}}`)

**Success Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "totals": {
      "totalWalletBalance": 23456000,
      "totalBonusBalance": 2345000,
      "totalDistributedBonuses": 12345000,
      "averageUserBalance": 15167,
      "medianUserBalance": 8500
    },
    "topups": {
      "totalTopups": 12345,
      "totalTopupAmount": 67890000,
      "averageTopupAmount": 5500,
      "topupSuccessRate": 94.5
    },
    "balanceDistribution": [
      {
        "range": "0-1000",
        "userCount": 234,
        "percentage": 15.1
      },
      {
        "range": "1000-5000",
        "userCount": 567,
        "percentage": 36.7
      },
      {
        "range": "5000-10000",
        "userCount": 423,
        "percentage": 27.4
      },
      {
        "range": "10000+",
        "userCount": 323,
        "percentage": 20.8
      }
    ]
  }
}
```

---

### 6. Platform Health Metrics (NEW)

#### GET `/admin/analytics/platform-health` - Platform Health Overview

**Authentication:** ✅ Required (`{{adminToken}}`)

**Success Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "system": {
      "uptime": 2592000,
      "cpuUsage": 45.2,
      "memoryUsage": 67.8,
      "storageUsed": 456000000000,
      "storageTota": 1000000000000,
      "storagePercentage": 45.6
    },
    "database": {
      "size": 12345000000,
      "collections": 15,
      "totalDocuments": 234567,
      "avgQueryTime": 45
    },
    "api": {
      "totalRequests": 1234567,
      "requestsToday": 12345,
      "averageResponseTime": 120,
      "errorRate": 0.05
    },
    "contentDelivery": {
      "totalBandwidthUsed": 567000000000,
      "averageStreamQuality": "1080p",
      "bufferingRate": 2.1
    }
  }
}
```

---

## Updated Endpoints

### 1. User Balance Adjustment (Updated)

#### POST `/admin/users/{userId}/adjust-balance` - Adjust User Balance

**CURRENT Endpoint:** `/admin/users/{userId}/coins`

**NEW Endpoint:** `/admin/users/{userId}/adjust-balance`

**Request Body:**
```json
{
  "amount": 5000,
  "type": "credit",
  "category": "bonus",
  "description": "Promotional bonus for active user"
}
```

**Fields:**
- `amount` (number, required): Amount in RWF (positive number)
- `type` (string, required): "credit" | "debit"
- `category` (string, required): "bonus" | "refund" | "adjustment" | "compensation"
- `description` (string, optional): Reason for adjustment

**Success Response (200 OK):**
```json
{
  "status": "success",
  "message": "User balance adjusted successfully",
  "data": {
    "userId": "68cbd395b77ec6b0adb95640",
    "adjustment": {
      "amount": 5000,
      "type": "credit",
      "category": "bonus",
      "description": "Promotional bonus for active user",
      "performedBy": "admin@cineranda.com",
      "performedAt": "2025-11-18T15:00:00.000Z"
    },
    "balanceBefore": {
      "balance": 10000,
      "bonusBalance": 500,
      "totalBalance": 10500
    },
    "balanceAfter": {
      "balance": 10000,
      "bonusBalance": 5500,
      "totalBalance": 15500
    }
  }
}
```

---

### 2. Platform Settings (Updated)

#### GET `/admin/settings` - Get Platform Settings

**CURRENT Response:**
```json
{
  "status": "success",
  "data": {
    "welcomeBonusAmount": 50
  }
}
```

**NEW Response:**
```json
{
  "status": "success",
  "data": {
    "wallet": {
      "currency": "RWF",
      "welcomeBonusAmount": 500,
      "minimumTopup": 1000,
      "maximumTopup": 1000000,
      "bonusExpiryDays": 30
    },
    "content": {
      "defaultRatingsEnabled": true,
      "maxUploadSizeMB": 5120,
      "supportedVideoFormats": ["mp4", "mkv", "avi"],
      "supportedSubtitleFormats": ["srt", "vtt"]
    },
    "platform": {
      "platformName": "Cineranda",
      "maintenanceMode": false,
      "registrationEnabled": true
    }
  }
}
```

---

#### PATCH `/admin/settings/welcome-bonus` - Update Welcome Bonus

**NEW Request:**
```json
{
  "welcomeBonusAmount": 1000
}
```

**Success Response (200 OK):**
```json
{
  "status": "success",
  "message": "Welcome bonus updated successfully",
  "data": {
    "welcomeBonusAmount": 1000,
    "currency": "RWF",
    "updatedBy": "admin@cineranda.com",
    "updatedAt": "2025-11-18T16:00:00.000Z"
  }
}
```

---

### 3. User Registration (Updated)

#### POST `/auth/verify-registration` - Complete Registration

**CURRENT Response:**
```json
{
  "status": "success",
  "token": "eyJhbGciOi...",
  "data": {
    "user": {
      "_id": "68cbd395b77ec6b0adb95640",
      "username": "user03",
      "phoneNumber": "250799999999",
      "role": "user",
      "phoneVerified": true,
      "coinWallet": {
        "balance": 500
      }
    }
  }
}
```

**NEW Response:**
```json
{
  "status": "success",
  "token": "eyJhbGciOi...",
  "data": {
    "user": {
      "_id": "68cbd395b77ec6b0adb95640",
      "username": "user03",
      "phoneNumber": "250799999999",
      "role": "user",
      "phoneVerified": true,
      "wallet": {
        "balance": 0,
        "bonusBalance": 500,
        "totalBalance": 500,
        "currency": "RWF"
      }
    },
    "welcomeBonus": {
      "amount": 500,
      "currency": "RWF",
      "expiresAt": "2025-12-18T10:00:00.000Z"
    }
  }
}
```

---

### 4. Content Creation/Update (Updated)

#### POST `/admin/content` - Create Movie Content

**CURRENT Request (FormData):**
```
title: "The Last Kingdom"
description: "An epic journey through medieval England"
contentType: "Movie"
priceInRwf: 5000
priceInCoins: 50
duration: 120
releaseYear: 2024
trailerYoutubeLink: "https://youtube.com/watch?v=abc123"
genres: ["{{genre-id}}"]
categories: ["{{category-id}}"]
cast: ["Actor 1", "Actor 2"]
isFree: false
isPublished: false
isFeatured: false
movieFile: [File]
posterImage: [File]
subtitleEn: [File] (optional)
subtitleFr: [File] (optional)
subtitleKin: [File] (optional)
```

**NEW Request (FormData):**
```
title: "The Last Kingdom"
description: "An epic journey through medieval England"
contentType: "Movie"
price: 5000
duration: 120
releaseYear: 2024
trailerYoutubeLink: "https://youtube.com/watch?v=abc123"
genres: ["{{genre-id}}"]
categories: ["{{category-id}}"]
cast: ["Actor 1", "Actor 2"]
isFree: false
isPublished: false
isFeatured: false
ratingsEnabled: true
movieFile: [File]
posterImage: [File]
subtitleEn: [File] (optional)
subtitleFr: [File] (optional)
subtitleKin: [File] (optional)
```

**Changes:**
- ❌ Remove `priceInCoins` field
- ✅ Keep `priceInRwf` → Rename to `price`
- ✅ Add `ratingsEnabled` field (default: true)
- ✅ **Keep all existing fields:** `cast`, `description`, `duration`, `releaseYear`, `trailerYoutubeLink`, `subtitles`

**Success Response (201 Created):**
```json
{
  "status": "success",
  "message": "Movie created successfully",
  "data": {
    "content": {
      "_id": "68c9f123a45b67c8d90e1234",
      "title": "The Last Kingdom",
      "description": "An epic journey through medieval England",
      "contentType": "Movie",
      "price": 5000,
      "trailerYoutubeLink": "https://youtube.com/watch?v=abc123",
      "ratingsEnabled": true,
      "movieFileUrl": "https://s3.amazonaws.com/videos/last-kingdom.mp4",
      "posterImageUrl": "https://s3.amazonaws.com/posters/last-kingdom.jpg",
      "duration": 120,
      "releaseYear": 2024,
      "cast": ["Actor 1", "Actor 2"],
      "genres": ["68dd0663..."],
      "categories": ["68dd1253..."],
      "subtitles": {
        "en": "https://s3.amazonaws.com/subtitles/last-kingdom-en.srt"
      },
      "isPublished": false,
      "isFeatured": false,
      "isFree": false,
      "seasons": [],
      "createdAt": "2025-11-18T10:00:00.000Z",
      "updatedAt": "2025-11-18T10:00:00.000Z"
    }
  }
}
```

---

### 5. Episode Creation (Updated)

#### POST `/admin/content/{seriesId}/seasons/{seasonNumber}/episodes` - Add Episode

**CURRENT Request (FormData):**
```
episodeNumber: 1
title: "Pilot"
description: "The first episode of the series"
priceInRwf: 2000
priceInCoins: 20
duration: 48
trailerYoutubeLink: "https://youtube.com/watch?v=def456"
isFree: false
isPublished: true
episodeVideo: [File]
subtitleEn: [File] (optional)
subtitleFr: [File] (optional)
subtitleKin: [File] (optional)
```

**NEW Request (FormData):**
```
episodeNumber: 1
title: "Pilot"
description: "The first episode of the series"
price: 2000
duration: 48
trailerYoutubeLink: "https://youtube.com/watch?v=def456"
isFree: false
isPublished: true
episodeVideo: [File]
subtitleEn: [File] (optional)
subtitleFr: [File] (optional)
subtitleKin: [File] (optional)
```

**Changes:**
- ❌ Remove `priceInCoins` field
- ✅ Rename `priceInRwf` to `price`
- ✅ **Keep all existing fields:** `description`, `duration`, `trailerYoutubeLink`, `isPublished`, `subtitles`

**Success Response (201 Created):**
```json
{
  "status": "success",
  "message": "Episode added successfully",
  "data": {
    "episode": {
      "_id": "68cbd890b77ec6b0adb95681",
      "episodeNumber": 1,
      "title": "Pilot",
      "description": "The first episode of the series",
      "price": 2000,
      "trailerYoutubeLink": "https://youtube.com/watch?v=def456",
      "isFree": false,
      "isPublished": true,
      "videoUrl": "https://s3.amazonaws.com/videos/bb-s01e01.mp4",
      "duration": 48,
      "subtitles": {
        "en": "https://s3.amazonaws.com/subtitles/bb-s01e01-en.srt"
      },
      "createdAt": "2025-10-16T10:46:36.672Z",
      "updatedAt": "2025-10-16T10:46:36.672Z"
    },
    "seriesTitle": "Breaking Bad",
    "seasonNumber": 1
  }
}
```

---

## Removed/Deprecated Fields

### Fields to Remove from Database:

1. **User Model:**
   - ❌ `coinWallet.balance` → ✅ `wallet.balance`
   - ❌ Remove coin-specific transaction fields

2. **Content Model (Movies/Episodes):**
   - ❌ Remove `priceInCoins` field only
   - ✅ Rename `priceInRwf` → `price`
   - ✅ **Keep all existing fields:** `cast`, `description`, `duration`, `releaseYear`, `trailerYoutubeLink`, `subtitles`, `posterImageUrl`, `movieFileUrl`/`videoUrl`, `isFeatured`, `isPublished`, `genres`, `categories`

3. **Settings Model:**
   - ❌ `coinConversionRate`
   - ❌ `coinSettings`

4. **Transaction Model:**
   - ❌ `amountInCoins` → ✅ `amount` (RWF only)
   - ❌ `currency` field (always RWF now)

---

## Migration Strategy

### Phase 1: Database Migration

```javascript
// Migration script to run on existing database

// 1. Migrate user wallets
db.users.updateMany(
  { "coinWallet": { "$exists": true } },
  [{
    "$set": {
      "wallet.balance": "$coinWallet.balance",
      "wallet.bonusBalance": 0,
      "wallet.totalBalance": "$coinWallet.balance",
      "wallet.currency": "RWF"
    }
  },
  {
    "$unset": "coinWallet"
  }]
)

// 2. Migrate content pricing (Movies)
db.contents.updateMany(
  { "contentType": "Movie", "priceInCoins": { "$exists": true } },
  [{
    "$set": {
      "price": "$priceInRwf",
      "ratingsEnabled": true
    }
  },
  {
    "$unset": ["priceInCoins", "priceInRwf"]
  }]
)

// 2b. Migrate episode pricing within series
db.contents.updateMany(
  { "contentType": "Series" },
  [{
    "$set": {
      "ratingsEnabled": true,
      "seasons": {
        "$map": {
          "input": "$seasons",
          "as": "season",
          "in": {
            "$mergeObjects": [
              "$$season",
              {
                "episodes": {
                  "$map": {
                    "input": "$$season.episodes",
                    "as": "episode",
                    "in": {
                      "$mergeObjects": [
                        {
                          "$arrayToObject": {
                            "$filter": {
                              "input": { "$objectToArray": "$$episode" },
                              "cond": { "$not": { "$in": ["$$this.k", ["priceInCoins", "priceInRwf"]] } }
                            }
                          }
                        },
                        {
                          "price": "$$episode.priceInRwf"
                        }
                      ]
                    }
                  }
                }
              }
            ]
          }
        }
      }
    }
  }]
)

// 3. Migrate transactions
db.transactions.updateMany(
  { "amountInCoins": { "$exists": true } },
  [{
    "$set": {
      "amount": "$amountInRwf",
      "currency": "RWF"
    }
  },
  {
    "$unset": ["amountInCoins", "amountInRwf"]
  }]
)
```

### Phase 2: API Backwards Compatibility (Optional - 2 weeks)

For smooth transition, support both old and new formats for 2 weeks:

```javascript
// Accept both priceInRwf and price during transition
if (req.body.priceInRwf && !req.body.price) {
  req.body.price = req.body.priceInRwf
}

// Return both formats in responses during transition (deprecated)
response.data.price = content.price
response.data.priceInRwf = content.price  // Deprecated - will be removed after 2 weeks
```

### Phase 3: Complete Migration

After 2 weeks:
- Remove all coin-related code
- Update all documentation
- Remove backwards compatibility layer

---

## Testing Requirements

### 1. Unit Tests Needed:

#### Wallet Tests:
- ✅ Top-up with valid amount
- ✅ Top-up with insufficient amount (< minimum)
- ✅ Balance adjustment (credit/debit)
- ✅ Bonus balance application logic
- ✅ Purchase with sufficient balance
- ✅ Purchase with insufficient balance

#### Content Access Tests:
- ✅ Unregistered user can view trailer
- ✅ Unregistered user cannot stream full content
- ✅ Registered user can stream unlocked content
- ✅ Registered user cannot stream locked content
- ✅ Rating submission when enabled
- ✅ Rating submission when disabled

#### Notification Tests:
- ✅ Broadcast notification to all users
- ✅ Targeted notification to specific users
- ✅ Mark notification as read
- ✅ Delete notification

#### Analytics Tests:
- ✅ Dashboard stats calculation
- ✅ Revenue analytics grouping
- ✅ Content performance metrics
- ✅ User growth calculations

### 2. Integration Tests:

- ✅ Complete purchase flow
- ✅ Complete notification flow
- ✅ Wallet top-up via Flutterwave webhook
- ✅ Content unlock and streaming
- ✅ Rating submission and retrieval
- ✅ Watch progress save and resume
- ✅ Library add/remove operations
- ✅ Real-time notification delivery
- ✅ Token refresh flow

### 3. Performance Tests:

- ✅ Analytics queries with large datasets
- ✅ Notification delivery to 1000+ users
- ✅ Concurrent content streaming
- ✅ Database query optimization
- ✅ Search performance with complex filters
- ✅ SSE/WebSocket connection handling (1000+ concurrent)
- ✅ Watch progress bulk updates

---

## Priority Implementation Order

### High Priority (Week 1):
1. ✅ Remove coin system, implement RWF-only wallet
2. ✅ Update all pricing fields
3. ✅ Migrate existing data
4. ✅ Update purchase endpoints
5. ✅ Implement trailer access for public
6. ✅ Admin token refresh endpoint
7. ✅ User library/favorites endpoints

### Medium Priority (Week 2):
8. ✅ Rating control per content
9. ✅ Notification system (basic)
10. ✅ Enhanced analytics dashboard
11. ✅ Wallet bonus system
12. ✅ Watch progress tracking
13. ✅ Advanced search & filtering

### Low Priority (Week 3-4):
14. ✅ Advanced analytics endpoints
15. ✅ Platform health metrics
16. ✅ Batch operations for ratings
17. ✅ Notification history and tracking
18. ✅ Real-time notifications (SSE/WebSocket)

---

## Frontend Enablement Features

### 1. Admin Token Refresh (NEW)

#### POST `/admin/auth/refresh-token` - Refresh Admin Access Token

**Authentication:** ✅ Required (Valid refresh token)

**Purpose:** Allow admins to refresh their access token without re-authenticating

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 86400,
    "tokenType": "Bearer"
  }
}
```

**Error Response (401 Unauthorized):**
```json
{
  "status": "error",
  "message": "Invalid or expired refresh token",
  "code": "INVALID_REFRESH_TOKEN"
}
```

**Use Cases:**
- Maintain admin session without re-login
- Background token refresh in admin dashboard
- Seamless user experience during long admin sessions

---

### 2. User Library/Favorites Management (NEW)

#### POST `/library` - Add Content to User Library

**Authentication:** ✅ Required (`{{authToken}}`)

**Purpose:** Allow users to save content to their favorites/watchlist

**Request Body:**
```json
{
  "contentId": "68c9f123a45b67c8d90e1234",
  "contentType": "Movie"
}
```

**Success Response (200 OK):**
```json
{
  "status": "success",
  "message": "Content added to library",
  "data": {
    "libraryItem": {
      "_id": "68cbd999b77ec6b0adb95700",
      "userId": "68cbd395b77ec6b0adb95640",
      "contentId": "68c9f123a45b67c8d90e1234",
      "contentType": "Movie",
      "addedAt": "2025-11-18T15:00:00.000Z"
    }
  }
}
```

**Error Response (409 Conflict):**
```json
{
  "status": "error",
  "message": "Content already in library"
}
```

---

#### DELETE `/library/{contentId}` - Remove Content from Library

**Authentication:** ✅ Required (`{{authToken}}`)

**Success Response (200 OK):**
```json
{
  "status": "success",
  "message": "Content removed from library"
}
```

**Error Response (404 Not Found):**
```json
{
  "status": "error",
  "message": "Content not found in library"
}
```

---

#### GET `/library` - Get User's Library/Favorites

**Authentication:** ✅ Required (`{{authToken}}`)

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 20)
- `contentType` (optional): "Movie" | "Series"
- `sortBy` (optional): "addedAt" | "title" (default: "addedAt")
- `sortOrder` (optional): "asc" | "desc" (default: "desc")

**Success Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "library": [
      {
        "_id": "68cbd999b77ec6b0adb95700",
        "content": {
          "_id": "68c9f123a45b67c8d90e1234",
          "title": "The Last Kingdom",
          "contentType": "Movie",
          "posterImageUrl": "https://s3.amazonaws.com/posters/last-kingdom.jpg",
          "duration": 120,
          "releaseYear": 2024,
          "price": 5000,
          "isUnlocked": true,
          "averageRating": 4.5
        },
        "addedAt": "2025-11-18T15:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalItems": 45,
      "limit": 20
    }
  }
}
```

---

### 3. Watch Progress Tracking (NEW)

#### POST `/watch-progress` - Save/Update Watch Progress

**Authentication:** ✅ Required (`{{authToken}}`)

**Purpose:** Track user's viewing progress for resume functionality

**Request Body:**
```json
{
  "contentId": "68c9f123a45b67c8d90e1234",
  "contentType": "Movie",
  "progress": 85,
  "duration": 7200,
  "lastWatchedAt": "2025-11-18T16:30:00.000Z"
}
```

**For Episodes:**
```json
{
  "contentId": "68c9f123a45b67c8d90e5678",
  "contentType": "Episode",
  "episodeId": "68cbd890b77ec6b0adb95681",
  "seasonNumber": 1,
  "episodeNumber": 1,
  "progress": 45,
  "duration": 2880,
  "lastWatchedAt": "2025-11-18T16:30:00.000Z"
}
```

**Success Response (200 OK):**
```json
{
  "status": "success",
  "message": "Watch progress saved",
  "data": {
    "watchProgress": {
      "_id": "68cbd111b77ec6b0adb95710",
      "userId": "68cbd395b77ec6b0adb95640",
      "contentId": "68c9f123a45b67c8d90e1234",
      "contentType": "Movie",
      "progress": 85,
      "duration": 7200,
      "percentageWatched": 70.83,
      "lastWatchedAt": "2025-11-18T16:30:00.000Z",
      "isCompleted": false
    }
  }
}
```

**Business Logic:**
- Progress > 95% marks content as completed
- Automatically updates "Continue Watching" section
- Tracks watch count for analytics

---

#### GET `/watch-progress/{contentId}` - Get Watch Progress

**Authentication:** ✅ Required (`{{authToken}}`)

**Query Parameters:**
- `episodeId` (optional): For series episodes

**Success Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "watchProgress": {
      "contentId": "68c9f123a45b67c8d90e1234",
      "contentType": "Movie",
      "progress": 85,
      "duration": 7200,
      "percentageWatched": 70.83,
      "lastWatchedAt": "2025-11-18T16:30:00.000Z",
      "isCompleted": false
    }
  }
}
```

**Error Response (404 Not Found):**
```json
{
  "status": "error",
  "message": "No watch progress found for this content"
}
```

---

#### GET `/watch-progress` - Get All Watch Progress (Continue Watching)

**Authentication:** ✅ Required (`{{authToken}}`)

**Query Parameters:**
- `limit` (optional, default: 10): Number of items to return
- `excludeCompleted` (optional, default: true): Exclude completed content

**Success Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "continueWatching": [
      {
        "_id": "68cbd111b77ec6b0adb95710",
        "content": {
          "_id": "68c9f123a45b67c8d90e1234",
          "title": "The Last Kingdom",
          "contentType": "Movie",
          "posterImageUrl": "https://s3.amazonaws.com/posters/last-kingdom.jpg",
          "duration": 7200
        },
        "progress": 85,
        "percentageWatched": 70.83,
        "lastWatchedAt": "2025-11-18T16:30:00.000Z"
      }
    ]
  }
}
```

---

### 4. Real-Time Notifications (NEW)

#### GET `/notifications/stream` - Real-Time Notification Stream (SSE)

**Authentication:** ✅ Required (`{{authToken}}`)

**Purpose:** Server-Sent Events stream for real-time notifications

**Connection:**
```javascript
const eventSource = new EventSource('/api/v1/notifications/stream', {
  headers: {
    'Authorization': `Bearer ${authToken}`
  }
});

eventSource.addEventListener('notification', (event) => {
  const notification = JSON.parse(event.data);
  console.log('New notification:', notification);
});
```

**Event Format:**
```json
{
  "event": "notification",
  "data": {
    "_id": "68cbd890b77ec6b0adb95691",
    "title": "New Movie Released!",
    "message": "Check out 'The Last Kingdom' now available on Cineranda",
    "actionType": "content",
    "actionUrl": "/content/movies/68c9f123a45b67c8d90e1234",
    "imageUrl": "https://s3.amazonaws.com/posters/last-kingdom.jpg",
    "priority": "high",
    "timestamp": "2025-11-18T17:00:00.000Z"
  }
}
```

**Event Types:**
- `notification` - New notification received
- `notification:read` - Notification marked as read
- `heartbeat` - Keep-alive ping every 30 seconds

**Error Handling:**
```javascript
eventSource.onerror = (error) => {
  console.error('SSE connection error:', error);
  // Implement reconnection logic with exponential backoff
};
```

---

#### WebSocket Alternative: `/ws/notifications`

**Purpose:** WebSocket connection for bidirectional real-time updates

**Connection:**
```javascript
const ws = new WebSocket('ws://localhost:5000/api/v1/ws/notifications');

ws.onopen = () => {
  // Authenticate
  ws.send(JSON.stringify({
    type: 'auth',
    token: authToken
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch(message.type) {
    case 'notification':
      handleNotification(message.data);
      break;
    case 'notification:read':
      updateNotificationStatus(message.data);
      break;
  }
};
```

**Message Format:**
```json
{
  "type": "notification",
  "data": {
    "_id": "68cbd890b77ec6b0adb95691",
    "title": "New Movie Released!",
    "message": "Check out 'The Last Kingdom' now available on Cineranda",
    "actionType": "content",
    "actionUrl": "/content/movies/68c9f123a45b67c8d90e1234",
    "priority": "high",
    "timestamp": "2025-11-18T17:00:00.000Z"
  }
}
```

---

### 5. Enhanced Search & Filtering (NEW)

#### GET `/content/search` - Advanced Content Search

**Authentication:** ❌ Not Required (Public)

**Query Parameters:**
- `q` (required): Search query
- `type` (optional): "Movie" | "Series"
- `genres` (optional): Comma-separated genre IDs
- `categories` (optional): Comma-separated category IDs
- `minPrice` (optional): Minimum price filter
- `maxPrice` (optional): Maximum price filter
- `releaseYear` (optional): Specific year or range (e.g., "2020-2024")
- `rating` (optional): Minimum rating (1-5)
- `sortBy` (optional): "relevance" | "title" | "releaseYear" | "price" | "rating"
- `sortOrder` (optional): "asc" | "desc"
- `page` (optional, default: 1)
- `limit` (optional, default: 20)

**Example Request:**
```
GET /content/search?q=action&type=Movie&genres=68c9f456&minPrice=0&maxPrice=10000&sortBy=rating&sortOrder=desc&page=1&limit=20
```

**Success Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "results": [
      {
        "_id": "68c9f123a45b67c8d90e1234",
        "title": "The Last Kingdom",
        "description": "An epic journey through medieval England",
        "contentType": "Movie",
        "posterImageUrl": "https://s3.amazonaws.com/posters/last-kingdom.jpg",
        "trailerYoutubeLink": "https://youtube.com/watch?v=abc123",
        "price": 5000,
        "duration": 120,
        "releaseYear": 2024,
        "averageRating": 4.5,
        "totalRatings": 234,
        "genres": [
          {
            "_id": "68c9f456a45b67c8d90e9999",
            "name": "Action"
          }
        ],
        "cast": ["Actor 1", "Actor 2"],
        "isPublished": true,
        "isFeatured": false,
        "isFree": false
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalResults": 89,
      "limit": 20
    },
    "filters": {
      "appliedFilters": {
        "type": "Movie",
        "genres": ["68c9f456"],
        "priceRange": [0, 10000]
      },
      "availableGenres": [
        {"_id": "68c9f456", "name": "Action", "count": 45},
        {"_id": "68c9f789", "name": "Drama", "count": 32}
      ]
    }
  }
}
```

---

## API Endpoint Summary

### New Endpoints (Frontend Enablement):
14. `POST /admin/auth/refresh-token` - Refresh admin access token
15. `POST /library` - Add content to user library/favorites
16. `GET /library` - Get user's library/favorites
17. `DELETE /library/{contentId}` - Remove from library
18. `POST /watch-progress` - Save/update watch progress
19. `GET /watch-progress/{contentId}` - Get specific content progress
20. `GET /watch-progress` - Get continue watching list
21. `GET /notifications/stream` - Real-time notifications (SSE)
22. `WS /ws/notifications` - WebSocket notifications
23. `GET /content/search` - Advanced content search with filters

### New Endpoints (Core Features):
1. `GET /content/movies/{movieId}/trailer` - Get movie trailer
2. `GET /content/series/{seriesId}/seasons/{seasonNumber}/episodes/{episodeId}/trailer` - Get episode trailer
3. `PATCH /admin/content/{contentId}/ratings` - Enable/disable ratings
4. `PATCH /admin/content/batch-ratings` - Bulk rating control
5. `POST /admin/notifications/send` - Send notifications
6. `GET /admin/notifications/history` - Notification history
7. `GET /notifications` - User notifications
8. `PUT /notifications/{notificationId}/read` - Mark as read
9. `PUT /notifications/read-all` - Mark all as read
10. `DELETE /notifications/{notificationId}` - Delete notification
11. `GET /admin/analytics/user-growth` - User growth metrics
12. `GET /admin/analytics/wallet-stats` - Wallet statistics
13. `GET /admin/analytics/platform-health` - Platform health

### Updated Endpoints:
1. `GET /wallet/balance` - Updated response structure
2. `POST /wallet/topup` - Simplified request
3. `POST /purchases/unlock` - Remove coin references
4. `POST /purchases/unlock-episode` - Remove coin references
5. `POST /purchases/season` - Remove coin references
6. `POST /admin/users/{userId}/adjust-balance` - Renamed from /coins
7. `GET /admin/settings` - Enhanced settings structure
8. `POST /auth/verify-registration` - Updated wallet structure
9. `POST /admin/content` - Updated pricing fields
10. `POST /admin/content/{seriesId}/seasons/{seasonNumber}/episodes` - Updated pricing

### Removed Fields (All Endpoints):
- ❌ `priceInCoins`
- ❌ `coinWallet`
- ❌ `amountInCoins`
- ❌ `currency` (always RWF)

---

## Validation Rules

### Wallet:
- Minimum top-up: 1000 RWF
- Maximum top-up: 1,000,000 RWF
- Balance cannot be negative
- Bonus expiry: 30 days (configurable)

### Content:
- Minimum price: 0 RWF (free)
- Maximum price: 50,000 RWF per movie
- Maximum price: 10,000 RWF per episode
- Trailer URL must be valid YouTube URL or S3 URL

### Notifications:
- Title: 3-100 characters
- Message: 10-500 characters
- Maximum recipients per targeted notification: 1000 users

### Analytics:
- Date range maximum: 365 days
- Default page limit: 20 items
- Maximum page limit: 100 items

### Watch Progress:
- Progress: 0-100 (seconds watched)
- Duration: Must match actual content duration
- Auto-complete threshold: 95% watched
- Progress saved every 10 seconds minimum

### Library/Favorites:
- Maximum library items: 500 per user
- Duplicates not allowed
- Must be published content only

### Search:
- Query minimum length: 2 characters
- Query maximum length: 100 characters
- Results per page: 1-100
- Search index updates: Real-time

---

## Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `INSUFFICIENT_BALANCE` | Wallet balance too low | 402 |
| `CONTENT_NOT_UNLOCKED` | User hasn't purchased content | 403 |
| `RATINGS_DISABLED` | Ratings disabled for this content | 403 |
| `INVALID_AMOUNT` | Invalid wallet amount | 400 |
| `TRAILER_NOT_AVAILABLE` | No trailer for this content | 404 |
| `NOTIFICATION_SEND_FAILED` | Failed to send notification | 500 |
| `INVALID_RECIPIENT` | Invalid user ID in recipients | 400 |
| `INVALID_REFRESH_TOKEN` | Refresh token expired or invalid | 401 |
| `LIBRARY_LIMIT_EXCEEDED` | User library limit reached | 400 |
| `ALREADY_IN_LIBRARY` | Content already in user library | 409 |
| `INVALID_PROGRESS_DATA` | Invalid watch progress data | 400 |
| `SEARCH_QUERY_TOO_SHORT` | Search query minimum 2 characters | 400 |

---

## Support & Next Steps

### For Backend Developers:
1. Review this document completely
2. Ask questions about unclear requirements
3. Implement in priority order
4. Write comprehensive tests
5. Update API documentation
6. Coordinate with frontend team

### For Frontend Team:
- This document defines what the backend will provide
- Update frontend to match new response structures
- Remove all coin-related UI elements
- Implement notification UI
- Integrate new analytics displays
- **Implement watch progress tracking** for resume functionality
- **Add library/favorites feature** for user content organization
- **Integrate real-time notifications** (SSE recommended for simplicity)
- **Use token refresh** to maintain sessions without re-login
- **Implement advanced search** with filters for better content discovery

### Frontend Development Guidelines:

#### Pagination Standards:
- All list endpoints support pagination via `page` and `limit` query parameters
- Default page size: 20 items
- Maximum page size: 100 items
- Always include pagination metadata in responses

#### Error Handling:
- All error responses follow consistent format with `status`, `message`, and optional `code`
- Display user-friendly error messages
- Log detailed error codes for debugging

#### Real-Time Features:
- Use Server-Sent Events (SSE) for notifications (simpler, unidirectional)
- Use WebSocket for interactive features (if needed)
- Implement reconnection logic with exponential backoff

#### Performance Best Practices:
- Implement debouncing for search inputs (300ms minimum)
- Cache frequently accessed data (user profile, settings)
- Lazy load images and videos
- Implement infinite scroll for content lists
- Save watch progress every 10-30 seconds (not on every second)

---

## Additional Backend Recommendations

### 1. Response Consistency:
All endpoints should return responses in this format:
```json
{
  "status": "success" | "error",
  "message": "Human-readable message",
  "data": { ... },
  "pagination": { ... } // For list endpoints
}
```

### 2. Filtering & Sorting:
All list endpoints should support:
- `sortBy` - Field to sort by
- `sortOrder` - "asc" or "desc"
- `filter[field]` - Dynamic filtering by field
- `search` - Full-text search where applicable

### 3. Rate Limiting:
Implement rate limiting for:
- Search endpoints: 30 requests/minute
- Authentication endpoints: 5 requests/minute
- General API: 100 requests/minute
- WebSocket/SSE: Connection limits per user

### 4. Caching Strategy:
- Cache static content lists (15 minutes)
- Cache user library (5 minutes)
- Cache analytics data (30 minutes)
- Real-time invalidation for user-specific data

### 5. Security Headers:
All responses should include:
- `Content-Security-Policy`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security`

---

**End of Documentation**

*For questions or clarifications, contact the development team*
