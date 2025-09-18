# 🎬 CinéRanda – Complete Project Specification

## 📌 Executive Summary

**CinéRanda** is a comprehensive movie streaming platform specifically designed for **Rwandan self-produced movies**, featuring a sophisticated **pay-per-content model** with **4-tier regional pricing**. The platform empowers local filmmakers to showcase their work globally while providing audiences across Rwanda, East Africa, Other Africa, and International markets with an accessible, premium streaming experience.

### **Core Innovation: Location-Aware Pay-Per-Content System**
- **4-Tier Regional Pricing**: Rwanda → East Africa → Other Africa → International
- **Dual Payment Ecosystem**: Traditional payments + Future coin-based system
- **Admin-Controlled Access**: Complete platform management with manual override capabilities
- **Series & Episode Management**: Progressive release scheduling with bundle pricing

---

## 🏗️ Technical Architecture

### **Backend Framework**
- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.x
- **Database**: MongoDB Atlas (Cloud) + Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens) with refresh token rotation
- **File Storage**: AWS S3 (Free Tier) + YouTube embedding
- **Payment Processing**: Multi-gateway integration (MTN MoMo, Airtel Money, PayPal, Stripe)

### **Frontend Framework**
- **Web App**: React 18+ with TypeScript
- **Styling**: TailwindCSS with custom theme system
- **State Management**: Context API + React Query for server state
- **Internationalization**: React-i18next (Kinyarwanda, English, French)
- **UI Components**: Custom components with dark/light theme support

### **Database Schema Overview**
```
Users → Purchases → Movies/Series → Episodes
  ↓         ↓           ↓             ↓
Profiles  Payments    Analytics   Release_Schedule
```

---

## 🗄️ Detailed Database Models

### **1. User Model**
```javascript
{
  // Basic Information
  username: String (unique, 3-30 chars),
  email: String (unique, validated),
  password: String (bcrypt hashed),
  firstName: String,
  lastName: String,
  
  // Location & Pricing
  location: Enum ['rwanda', 'east-africa', 'other-africa', 'international'],
  detectedCountry: String, // Auto-detected via IP
  ipAddress: String,
  
  // Authentication & Security
  role: Enum ['user', 'admin'],
  isActive: Boolean,
  isEmailVerified: Boolean,
  emailVerificationToken: String,
  passwordResetToken: String,
  passwordResetExpires: Date,
  
  // User Preferences
  preferredLanguage: Enum ['kinyarwanda', 'english', 'french'],
  theme: Enum ['light', 'dark'],
  
  // Pay-Per-Content System
  purchasedContent: [{
    contentId: ObjectId (ref: Movie),
    contentType: Enum ['movie', 'episode', 'series-bundle'],
    purchaseDate: Date,
    price: Number,
    currency: Enum ['RWF', 'USD'],
    paymentMethod: Enum ['mtn-momo', 'airtel-money', 'bank-card', 'paypal', 'stripe', 'admin-grant'],
    transactionId: String,
    expiresAt: Date // For rental content (future)
  }],
  
  // Coin Wallet (Future Feature)
  coinWallet: {
    balance: Number (min: 0),
    totalEarned: Number,
    totalSpent: Number,
    lastTransaction: Date
  },
  
  // User Engagement
  watchHistory: [{
    contentId: ObjectId (ref: Movie),
    watchedAt: Date,
    progress: Number (0-100),
    completed: Boolean,
    watchTime: Number // seconds
  }],
  
  favorites: [ObjectId] (ref: Movie),
  watchlist: [{
    addedAt: Date,
    contentId: ObjectId (ref: Movie)
  }],
  
  // Analytics
  totalSpent: Number,
  lastActive: Date,
  loginCount: Number,
  
  // Legacy Support (Backward Compatibility)
  subscriptionStatus: Enum ['active', 'inactive', 'expired'],
  subscriptionEndDate: Date,
  
  timestamps: true
}
```

### **2. Movie/Series Model**
```javascript
{
  // Basic Content Information
  title: String (required, max: 200),
  description: String (required, max: 2000),
  director: String (required),
  actors: [String],
  genre: Enum ['action', 'comedy', 'drama', 'horror', 'romance', 'thriller', 'documentary', 'animation', 'sci-fi', 'fantasy', 'crime', 'adventure', 'family', 'musical', 'war', 'western', 'biography', 'sport', 'historical'],
  language: Enum ['kinyarwanda', 'english', 'french', 'swahili'],
  duration: Number (minutes),
  releaseDate: Date,
  
  // Content Type System
  type: Enum ['movie', 'series', 'episode'],
  
  // Series Information (for parent series)
  seriesInfo: {
    seriesTitle: String,
    totalSeasons: Number (min: 1),
    totalEpisodes: Number,
    isComplete: Boolean,
    releaseSchedule: {
      episodesPerWeek: Number (default: 2),
      releaseDay: Enum ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }
  },
  
  // Episode Information (for individual episodes)
  episodeInfo: {
    parentSeries: ObjectId (ref: Movie),
    seasonNumber: Number (min: 1),
    episodeNumber: Number (min: 1),
    releaseSchedule: Date
  },
  
  // Media Assets
  poster: {
    url: String,
    key: String, // S3 key
    bucket: String,
    thumbnails: {
      small: String,
      medium: String,
      large: String
    }
  },
  
  // Dual Channel Support
  trailer: {
    youtubeUrl: String,
    youtubeId: String,
    awsUrl: String,
    awsKey: String,
    bucket: String,
    availableOn: [Enum ['youtube', 'aws']],
    defaultChannel: Enum ['youtube', 'aws']
  },
  
  movie: {
    youtubeUrl: String,
    youtubeId: String,
    awsUrl: String,
    awsKey: String,
    bucket: String,
    availableOn: [Enum ['youtube', 'aws']],
    defaultChannel: Enum ['youtube', 'aws']
  },
  
  // 4-Tier Regional Pricing System
  pricing: {
    rwanda: {
      price: Number (min: 0),
      currency: String (default: 'RWF'),
      isActive: Boolean
    },
    eastAfrica: {
      price: Number (min: 0),
      currency: String (default: 'USD'),
      isActive: Boolean
    },
    otherAfrica: {
      price: Number (min: 0),
      currency: String (default: 'USD'),
      isActive: Boolean
    },
    international: {
      price: Number (min: 0),
      currency: String (default: 'USD'),
      isActive: Boolean
    }
  },
  
  // Series Bundle Pricing
  seriesBundlePricing: {
    rwanda: {
      price: Number,
      currency: String,
      discount: Number (0-100),
      isActive: Boolean
    },
    eastAfrica: {
      price: Number,
      currency: String,
      discount: Number (0-100),
      isActive: Boolean
    },
    otherAfrica: {
      price: Number,
      currency: String,
      discount: Number (0-100),
      isActive: Boolean
    },
    international: {
      price: Number,
      currency: String,
      discount: Number (0-100),
      isActive: Boolean
    }
  },
  
  // Coin Pricing (Future Feature)
  coinPricing: {
    coins: Number (min: 0),
    isActive: Boolean
  },
  
  // Content Status
  isActive: Boolean,
  isFeatured: Boolean,
  isPublished: Boolean,
  
  // Analytics
  views: Number,
  trailerViews: Number,
  purchases: Number,
  rating: Number (0-5),
  totalRatings: Number,
  likes: Number,
  
  // Regional Analytics
  viewsBreakdown: {
    rwanda: Number,
    eastAfrica: Number,
    otherAfrica: Number,
    international: Number
  },
  
  revenue: {
    rwanda: Number,
    eastAfrica: Number,
    otherAfrica: Number,
    international: Number,
    total: Number
  },
  
  // Admin
  uploadedBy: ObjectId (ref: User),
  
  timestamps: true
}
```

### **3. Purchase Model**
```javascript
{
  // Purchase Details
  user: ObjectId (ref: User, required),
  content: ObjectId (ref: Movie, required),
  contentType: Enum ['movie', 'episode', 'series-bundle'],
  
  // Pricing Information
  price: Number (required, min: 0),
  currency: Enum ['RWF', 'USD', 'COINS'],
  pricingTier: Enum ['rwanda', 'east-africa', 'other-africa', 'international'],
  
  // Payment Information
  paymentMethod: Enum ['mtn-momo', 'airtel-money', 'bank-card', 'paypal', 'stripe', 'coins', 'admin-grant'],
  paymentStatus: Enum ['pending', 'completed', 'failed', 'refunded'],
  transactionId: String (unique),
  externalTransactionId: String, // From payment gateway
  
  // Access Control
  accessGrantedAt: Date,
  expiresAt: Date, // For rental content
  isActive: Boolean,
  
  // Metadata
  userLocation: String,
  userIpAddress: String,
  deviceInfo: String,
  conversionSource: Enum ['trailer', 'search', 'featured', 'recommendation', 'direct'],
  
  // Admin Actions
  grantedByAdmin: ObjectId (ref: User),
  adminNotes: String,
  
  // Refund Information
  refundReason: String,
  refundedAt: Date,
  refundedBy: ObjectId (ref: User),
  
  timestamps: true
}
```

### **4. Additional Models**

#### **Comment Model**
```javascript
{
  user: ObjectId (ref: User),
  movie: ObjectId (ref: Movie),
  content: String (required, max: 1000),
  isApproved: Boolean (default: false),
  parentComment: ObjectId (ref: Comment), // For replies
  likes: Number (default: 0),
  reports: Number (default: 0),
  timestamps: true
}
```

#### **Rating Model**
```javascript
{
  user: ObjectId (ref: User),
  movie: ObjectId (ref: Movie),
  rating: Number (1-5, required),
  review: String (max: 500),
  isVerifiedPurchase: Boolean,
  timestamps: true
}
```

#### **CoinTransaction Model (Future)**
```javascript
{
  user: ObjectId (ref: User),
  type: Enum ['purchase', 'spend', 'refund', 'bonus'],
  amount: Number,
  currency: Enum ['RWF', 'USD'],
  coins: Number,
  description: String,
  relatedPurchase: ObjectId (ref: Purchase),
  paymentMethod: String,
  status: Enum ['pending', 'completed', 'failed'],
  timestamps: true
}
```

---

## 🔌 API Endpoints Specification

### **Authentication Routes (`/api/auth`)**
```
POST   /register          - User registration with location detection
POST   /login             - User login with JWT token
POST   /logout            - User logout (token blacklist)
POST   /refresh           - Refresh JWT token
POST   /forgot-password   - Password reset request
POST   /reset-password    - Password reset confirmation
POST   /verify-email      - Email verification
GET    /me                - Get current user profile
PUT    /profile           - Update user profile
PUT    /change-password   - Change password
```

### **Movie/Content Routes (`/api/movies`)**
```
GET    /                  - Get movies (pagination, filters, search)
GET    /:id               - Get single movie details
GET    /:id/trailer       - Get trailer access (public)
GET    /:id/stream        - Get movie stream (requires purchase/subscription)
POST   /:id/like          - Like/unlike movie
POST   /:id/comment       - Add comment
GET    /:id/comments      - Get movie comments
POST   /:id/rate          - Rate movie
GET    /featured          - Get featured movies
GET    /trending          - Get trending movies
GET    /categories        - Get movies by category
GET    /search            - Search movies
```

### **Payment Routes (`/api/payment`)**
```
GET    /pricing/:contentId        - Get content pricing for user location
POST   /purchase                  - Initiate content purchase
POST   /complete                  - Complete purchase (webhook)
GET    /my-library               - Get user's purchased content
GET    /access/:contentId        - Check user access to content
GET    /health                   - Payment system health check
```

### **User Routes (`/api/users`)**
```
GET    /watchlist         - Get user watchlist
POST   /watchlist         - Add to watchlist
DELETE /watchlist/:id     - Remove from watchlist
GET    /favorites         - Get user favorites
POST   /favorites         - Add to favorites
DELETE /favorites/:id     - Remove from favorites
GET    /history           - Get watch history
POST   /history           - Update watch progress
GET    /profile           - Get user profile
PUT    /profile           - Update profile settings
```

### **Admin Routes (`/api/admin`)**
```
// Content Management
POST   /movies            - Upload new movie/series
PUT    /movies/:id        - Update movie details
DELETE /movies/:id        - Delete movie
GET    /movies            - Get all movies (admin view)
POST   /movies/:id/toggle-featured    - Toggle featured status
POST   /movies/:id/toggle-published   - Toggle published status

// User Management
GET    /users             - Get all users
PUT    /users/:id         - Update user details
POST   /users/:id/toggle-status       - Activate/deactivate user
POST   /grant-access      - Manually grant content access
GET    /purchases         - Get all purchases
GET    /purchases/analytics           - Purchase analytics

// Platform Analytics
GET    /analytics/overview            - Platform overview stats
GET    /analytics/revenue             - Revenue analytics
GET    /analytics/users               - User analytics
GET    /analytics/content             - Content performance
GET    /analytics/regional            - Regional performance
```

### **Coin System Routes (`/api/coins`) - Future Feature**
```
GET    /balance           - Get user coin balance
POST   /purchase          - Purchase coin packages
POST   /spend             - Spend coins for content
GET    /transactions      - Get coin transaction history
GET    /packages          - Get available coin packages
```

---

## 🎨 Frontend Component Architecture

### **Page Components**
```
src/
├── pages/
│   ├── Home.jsx                 - Landing page with featured content
│   ├── MovieDetails.jsx         - Individual movie/episode page
│   ├── SeriesDetails.jsx        - Series overview with episodes
│   ├── MyLibrary.jsx           - User's purchased content
│   ├── Search.jsx              - Search and filter interface
│   ├── Profile.jsx             - User profile and settings
│   ├── Auth/
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   └── ForgotPassword.jsx
│   └── Admin/
│       ├── Dashboard.jsx
│       ├── ContentManager.jsx
│       ├── UserManager.jsx
│       ├── Analytics.jsx
│       └── UploadContent.jsx
```

### **Core Components**
```
src/components/
├── Layout/
│   ├── Navbar.jsx              - Navigation with language/theme switcher
│   ├── Footer.jsx
│   ├── Sidebar.jsx
│   └── Layout.jsx
├── Content/
│   ├── MovieCard.jsx           - Movie/episode preview card
│   ├── SeriesCard.jsx          - Series overview card
│   ├── VideoPlayer.jsx         - Custom video player component
│   ├── TrailerPlayer.jsx       - Trailer-specific player
│   ├── ContentGrid.jsx         - Responsive content grid
│   └── ContentCarousel.jsx     - Horizontal scrolling carousel
├── Payment/
│   ├── PurchaseButton.jsx      - Smart purchase button
│   ├── PricingModal.jsx        - Payment method selection
│   ├── CoinWallet.jsx          - Coin balance and management
│   └── PaymentForm.jsx         - Payment processing form
├── User/
│   ├── UserProfile.jsx
│   ├── WatchHistory.jsx
│   ├── Favorites.jsx
│   └── Watchlist.jsx
├── Common/
│   ├── SearchBar.jsx
│   ├── FilterDropdown.jsx
│   ├── LanguageSwitcher.jsx
│   ├── ThemeToggle.jsx
│   ├── LoadingSpinner.jsx
│   ├── ErrorBoundary.jsx
│   └── ProtectedRoute.jsx
```

### **Hooks & Context**
```
src/hooks/
├── useAuth.js                  - Authentication state management
├── usePayment.js              - Payment processing logic
├── useLocalStorage.js         - Persistent local storage
├── useLocationDetection.js    - IP-based location detection
├── useInfiniteScroll.js       - Pagination handling
└── useVideoPlayer.js          - Video player controls

src/context/
├── AuthContext.js             - User authentication state
├── ThemeContext.js            - Dark/light theme management
├── LanguageContext.js         - Internationalization
├── PaymentContext.js          - Payment state management
└── NotificationContext.js     - Toast notifications
```

---

## 💳 Payment Integration Specifications

### **Payment Method Configuration**
```javascript
const PAYMENT_METHODS = {
  'rwanda': {
    methods: ['mtn-momo', 'airtel-money', 'bank-card'],
    currency: 'RWF',
    localGateways: {
      'mtn-momo': {
        apiEndpoint: 'https://api.mtn.com/collection',
        subscriptionKey: 'MTN_SUBSCRIPTION_KEY'
      },
      'airtel-money': {
        apiEndpoint: 'https://api.airtel.africa/merchant',
        clientId: 'AIRTEL_CLIENT_ID'
      }
    }
  },
  'east-africa': {
    methods: ['mtn-momo', 'airtel-money', 'bank-card', 'paypal'],
    currency: 'USD',
    conversionRate: 'auto' // Fetch from exchange API
  },
  'other-africa': {
    methods: ['paypal', 'stripe', 'bank-card'],
    currency: 'USD'
  },
  'international': {
    methods: ['paypal', 'stripe', 'bank-card'],
    currency: 'USD'
  }
}
```

### **Payment Processing Flow**
1. **Price Discovery**: User location → Regional pricing tier
2. **Payment Method Selection**: Available methods for user's region
3. **Transaction Initiation**: Create purchase record with unique transaction ID
4. **Payment Gateway Integration**: Route to appropriate payment processor
5. **Webhook Processing**: Handle payment completion/failure callbacks
6. **Access Granting**: Update user's purchased content and grant access
7. **Analytics Update**: Record revenue and purchase analytics

---

## 🔒 Security & Authentication

### **JWT Token Strategy**
```javascript
// Token Structure
{
  accessToken: {
    payload: { userId, role, location, iat, exp },
    expiresIn: '15m'
  },
  refreshToken: {
    payload: { userId, tokenVersion, iat, exp },
    expiresIn: '7d'
  }
}
```

### **Security Middleware**
- **Rate Limiting**: Express-rate-limit for API protection
- **Input Validation**: Express-validator for all user inputs
- **CORS Configuration**: Restricted to allowed origins
- **Helmet.js**: Security headers configuration
- **Data Sanitization**: Mongoose sanitization for NoSQL injection prevention
- **File Upload Security**: File type and size validation for AWS S3 uploads

### **Access Control Levels**
1. **Public**: Trailers, movie browsing, pricing info
2. **Authenticated**: Purchasing, library access, profile management
3. **Purchased Content**: Individual movie/episode streaming
4. **Admin**: All content management, user management, analytics

---

## 🌍 Internationalization (i18n)

### **Language Configuration**
```javascript
// Supported Languages
const LANGUAGES = {
  en: {
    name: 'English',
    nativeName: 'English',
    rtl: false
  },
  rw: {
    name: 'Kinyarwanda',
    nativeName: 'Ikinyarwanda',
    rtl: false
  },
  fr: {
    name: 'French',
    nativeName: 'Français',
    rtl: false
  }
}
```

### **Translation Structure**
```
src/locales/
├── en/
│   ├── common.json          - Common UI elements
│   ├── auth.json           - Authentication related
│   ├── movies.json         - Movie-related content
│   ├── payment.json        - Payment interface
│   └── admin.json          - Admin interface
├── rw/
│   └── [same structure]
└── fr/
    └── [same structure]
```

---

## 📊 Analytics & Reporting

### **User Analytics**
- Registration and activation rates by region
- User engagement metrics (session duration, content views)
- Purchase conversion rates (trailer view → purchase)
- User retention and churn analysis
- Geographic distribution and preferences

### **Content Analytics**
- View counts and engagement by content
- Purchase rates and revenue per content
- Regional performance comparison
- Trending content identification
- Content lifecycle analysis (release → peak → decline)

### **Business Analytics**
- Revenue analytics by region and payment method
- Subscription vs. pay-per-content performance comparison
- Payment method effectiveness by region
- Seasonal trends and pattern recognition
- ROI analysis for content investments

### **Admin Dashboard Widgets**
```javascript
const DASHBOARD_WIDGETS = [
  'totalRevenue',           // Current month revenue
  'totalUsers',            // Active user count
  'totalPurchases',        // Monthly purchases
  'popularContent',        // Top 10 performing content
  'regionalBreakdown',     // Revenue by region chart
  'recentTransactions',    // Latest 10 transactions
  'userGrowth',           // User registration trend
  'contentLibrary',       // Total content statistics
  'paymentMethods',       // Payment method usage
  'topPerformers'         // Highest revenue content
]
```

---

## 🚀 Development Setup & Deployment

### **Environment Configuration**
```bash
# Development Environment (.env.development)
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb://localhost:27017/cine-randa-dev

# Authentication
JWT_SECRET=development-secret-key
JWT_REFRESH_SECRET=development-refresh-secret
JWT_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d

# AWS S3 (Development)
AWS_ACCESS_KEY_ID=dev_access_key
AWS_SECRET_ACCESS_KEY=dev_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=cine-randa-dev

# Payment Gateways (Test Keys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYPAL_CLIENT_ID=test_client_id
PAYPAL_CLIENT_SECRET=test_client_secret
MTN_MOMO_API_KEY=test_mtn_key
AIRTEL_MONEY_API_KEY=test_airtel_key

# Admin Credentials
ADMIN_EMAIL=admin@cineranda.com
ADMIN_PASSWORD=SecurePassword123!
```

### **Production Environment**
```bash
# Production Environment (.env.production)
NODE_ENV=production
PORT=5000
CLIENT_URL=https://cineranda.com

# Database (MongoDB Atlas)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/cine-randa-prod

# Authentication (Strong secrets)
JWT_SECRET=ultra-secure-production-secret
JWT_REFRESH_SECRET=ultra-secure-refresh-secret

# AWS S3 (Production)
AWS_ACCESS_KEY_ID=prod_access_key
AWS_SECRET_ACCESS_KEY=prod_secret_key
AWS_S3_BUCKET=cine-randa-production

# Payment Gateways (Live Keys)
STRIPE_SECRET_KEY=sk_live_...
PAYPAL_CLIENT_ID=live_client_id
MTN_MOMO_API_KEY=live_mtn_key
AIRTEL_MONEY_API_KEY=live_airtel_key
```

### **Deployment Architecture**
```
Frontend (React)
├── Hosting: Netlify/Vercel
├── Domain: cineranda.com
├── CDN: Cloudflare
└── SSL: Let's Encrypt

Backend (Node.js)
├── Hosting: Railway/Render/Heroku
├── API Domain: api.cineranda.com
├── Load Balancer: Platform-managed
└── SSL: Platform-managed

Database
├── MongoDB Atlas (Cloud)
├── Backup: Daily automated
├── Monitoring: Atlas monitoring
└── Scaling: Auto-scaling enabled

File Storage
├── AWS S3 (Media files)
├── CloudFront CDN
├── Backup: Cross-region replication
└── Access: Signed URLs for security
```

---

## 🧪 Testing Strategy

### **Backend Testing**
```javascript
// Test Structure
tests/
├── unit/
│   ├── models/
│   │   ├── User.test.js
│   │   ├── Movie.test.js
│   │   └── Purchase.test.js
│   ├── controllers/
│   │   ├── authController.test.js
│   │   ├── movieController.test.js
│   │   └── paymentController.test.js
│   └── middleware/
│       ├── auth.test.js
│       └── validation.test.js
├── integration/
│   ├── auth.test.js
│   ├── movies.test.js
│   ├── payment.test.js
│   └── admin.test.js
└── e2e/
    ├── userJourney.test.js
    ├── purchaseFlow.test.js
    └── adminWorkflow.test.js
```

### **Frontend Testing**
```javascript
// Test Structure
src/__tests__/
├── components/
│   ├── MovieCard.test.jsx
│   ├── PurchaseButton.test.jsx
│   └── VideoPlayer.test.jsx
├── pages/
│   ├── Home.test.jsx
│   ├── MovieDetails.test.jsx
│   └── MyLibrary.test.jsx
├── hooks/
│   ├── useAuth.test.js
│   └── usePayment.test.js
└── utils/
    ├── api.test.js
    └── helpers.test.js
```

---

## 📋 Implementation Phases

### **Phase 1: Core Foundation (Weeks 1-2)**
- [ ] Project setup and environment configuration
- [ ] Database schema implementation
- [ ] User authentication system
- [ ] Basic movie CRUD operations
- [ ] JWT token management
- [ ] Input validation and security middleware

### **Phase 2: Content Management (Weeks 3-4)**
- [ ] Movie upload system (YouTube + AWS S3)
- [ ] Series and episode relationship management
- [ ] Admin dashboard basic functionality
- [ ] File upload handling and validation
- [ ] Content categorization and tagging
- [ ] Search and filtering capabilities

### **Phase 3: Payment System (Weeks 5-6)**
- [ ] Regional pricing tier implementation
- [ ] Purchase model and transaction handling
- [ ] Payment gateway integration (mock)
- [ ] User library and access control
- [ ] Purchase analytics and reporting
- [ ] Admin access granting system

### **Phase 4: Frontend Development (Weeks 7-10)**
- [ ] React application setup with routing
- [ ] Authentication pages and flows
- [ ] Movie browsing and detail pages
- [ ] User dashboard and library
- [ ] Purchase flow and payment forms
- [ ] Admin dashboard implementation
- [ ] Responsive design and theming
- [ ] Internationalization setup

### **Phase 5: Integration & Testing (Weeks 11-12)**
- [ ] Frontend-backend integration
- [ ] Payment flow testing
- [ ] User journey testing
- [ ] Performance optimization
- [ ] Security testing and validation
- [ ] Cross-browser compatibility

### **Phase 6: Deployment & Go-Live (Weeks 13-14)**
- [ ] Production environment setup
- [ ] Database migration and seeding
- [ ] Domain configuration and SSL
- [ ] Payment gateway activation (live keys)
- [ ] Monitoring and logging setup
- [ ] User acceptance testing
- [ ] Launch preparation and documentation

---

## 🎯 Success Metrics & KPIs

### **Technical Metrics**
- **System Uptime**: 99.9% availability
- **API Response Time**: <200ms average
- **Page Load Speed**: <3 seconds initial load
- **Mobile Responsiveness**: 100% functionality on mobile devices
- **Security Score**: Zero critical vulnerabilities

### **Business Metrics**
- **User Registration**: Track monthly new user signups
- **Purchase Conversion**: Trailer view to purchase ratio
- **Regional Revenue Distribution**: Revenue breakdown by pricing tier
- **Average Revenue Per User (ARPU)**: Monthly revenue per active user
- **Content Performance**: Views and purchases per movie/series

### **User Experience Metrics**
- **User Retention**: Monthly and weekly active users
- **Session Duration**: Average time spent on platform
- **Content Discovery**: Search success rate and browsing patterns
- **Payment Success Rate**: Completed purchases vs. abandoned carts
- **User Satisfaction**: Rating and feedback collection

---

## 🔮 Future Roadmap

### **Phase 2 Features (3-6 months)**
- **Mobile App**: React Native iOS/Android application
- **Live Payment Integration**: Full MTN MoMo, Airtel Money, PayPal, Stripe
- **Advanced Analytics**: AI-powered insights and recommendations
- **Content Creator Portal**: Direct filmmaker upload and revenue sharing
- **Community Features**: User reviews, discussions, filmmaker Q&A

### **Phase 3 Features (6-12 months)**
- **Coin Economy**: Full implementation with gamification
- **Offline Downloads**: Purchased content offline viewing
- **Live Streaming**: Real-time events and premieres
- **Recommendation Engine**: Personalized content suggestions
- **Multi-language Content**: Subtitle and dubbing support

### **Phase 4 Features (12+ months)**
- **Global Expansion**: Additional African markets
- **Content Production Tools**: Filmmaker support and funding platform
- **Educational Content**: Film school and tutorials section
- **B2B Solutions**: White-label platform for other markets
- **Blockchain Integration**: NFT collectibles and creator economy

---

## 📚 Technical Documentation Requirements

### **API Documentation**
- Complete OpenAPI/Swagger specification
- Interactive API testing interface
- Request/response examples for all endpoints
- Authentication and authorization guides
- Error code reference and troubleshooting

### **Developer Documentation**
- Setup and installation guides
- Database schema documentation
- Deployment procedures and environment configuration
- Code style guidelines and contribution standards
- Testing procedures and coverage requirements

### **User Documentation**
- User manual for platform features
- Admin dashboard guide
- Payment and billing documentation
- Troubleshooting and FAQ section
- Video tutorials for key features

---

## 🎨 Branding & Design Guidelines

### **Visual Identity**
- **Brand Name**: CinéRanda
- **Primary Colors**: 
  - Red: #DC2626 (Primary action color)
  - Black: #000000 (Text and backgrounds)
- **Secondary Colors**:
  - Yellow: #FCD34D (Accent and highlights)
  - White: #FFFFFF (Backgrounds and contrast)
- **Typography**: 
  - Primary: Inter (clean, modern)
  - Display: Poppins (headings and branding)

### **Theme System**
```css
/* Light Theme */
:root {
  --bg-primary: #FFFFFF;
  --bg-secondary: #F9FAFB;
  --text-primary: #111827;
  --text-secondary: #6B7280;
  --accent-red: #DC2626;
  --accent-yellow: #FCD34D;
}

/* Dark Theme */
[data-theme="dark"] {
  --bg-primary: #111827;
  --bg-secondary: #1F2937;
  --text-primary: #F9FAFB;
  --text-secondary: #D1D5DB;
  --accent-red: #EF4444;
  --accent-yellow: #FBBF24;
}
```

### **UI/UX Principles**
- **Netflix-Inspired Design**: Clean, content-focused layout
- **Mobile-First Approach**: Responsive design prioritizing mobile experience
- **Accessibility**: WCAG 2.1 AA compliance
- **Performance**: Optimized for slow internet connections
- **Cultural Sensitivity**: Respectful representation of Rwandan culture

---

This comprehensive specification provides a complete blueprint for building CinéRanda as a world-class movie streaming platform. The pay-per-content model with regional pricing ensures accessibility across different markets while the sophisticated admin controls provide complete platform management capabilities.

The architecture supports both immediate launch requirements and future scalability, with clear implementation phases that can be tackled by development teams of various sizes. The emphasis on security, user experience, and business analytics ensures the platform can compete effectively in the global streaming market while serving the specific needs of Rwandan content creators and their audiences.