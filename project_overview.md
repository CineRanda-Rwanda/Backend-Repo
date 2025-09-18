# 🎬 CinéRanda – Rwandan Movie Streaming Platform

## 📌 Project Overview
**CinéRanda** is a comprehensive movie streaming platform specifically designed for **Rwandan self-produced movies**, featuring a sophisticated **pay-per-content model** with **4-tier regional pricing**. The platform empowers local filmmakers to showcase their work globally while providing audiences across Rwanda, East Africa, Other Africa, and International markets with an accessible, premium streaming experience.

The platform launches as a **web application** (React + Node.js) with seamless extension capability to a **mobile app** (React Native). The system follows **software engineering best practices** using the **V-Model** for structured development, ensuring testability, reliability, security, and future enhancements.

### **Core Innovation: Location-Aware Pay-Per-Content System**
- **4-Tier Regional Pricing**: Rwanda → East Africa → Other Africa → International  
- **Automatic Location Detection**: System detects user location and displays appropriate pricing
- **Dual Payment Ecosystem**: Traditional payments + Future coin-based system
- **Admin-Controlled Access**: Complete platform management with manual override capabilities
- **Series & Episode Management**: Progressive release scheduling with bundle pricing

---

## 🎨 Branding & Design
- **Name:** CinéRanda  
- **Primary Colors:** Red (#DC2626) & Black (#000000)  
- **Secondary Colors:** Yellow (#FCD34D) & White (#FFFFFF)  
- **Themes:**  
  - Light Mode (default)  
  - Dark Mode (toggle option for users)  
- **UX Goals:**  
  - Netflix-inspired, clean, modern UI  
  - Mobile-first responsive design for all devices
  - Easy content discovery (browsing, categories, search)
  - Cultural sensitivity and Rwandan representation

---

## 🌍 Languages
The platform supports **multilingual navigation** for inclusivity:  
- **Kinyarwanda** (Ikinyarwanda)
- **English**  
- **French** (Français)

Users can switch languages anytime through the interface.

---

## 🛠 Tech Stack
- **Frontend:** React 18+ with TypeScript + TailwindCSS (web), React Native (mobile)  
- **Backend:** Node.js 18+ + Express.js 4.x
- **Database:** MongoDB Atlas (Cloud) + Mongoose ODM
- **Authentication:** JWT (JSON Web Tokens) with refresh token rotation
- **File Storage:** AWS S3 (Free Tier) + YouTube embedding
- **Payment Processing:** Multi-gateway integration (MTN MoMo, Airtel Money, PayPal, Stripe)
- **Deployment:** Railway/Render/Heroku (backend), Netlify/Vercel (frontend)

---

## 🔑 Core Features

### 👩‍💻 Admin Dashboard
**Complete Platform Control with Advanced Management:**
- **Content Management:**
  - Upload movies/series with comprehensive metadata (title, description, category, poster, actors, language, release date)
  - Dual upload options: YouTube link, AWS S3 file upload, or both
  - Upload trailers separately for free preview access
  - Series hierarchy management (seasons, episodes, release scheduling)
  - Set individual pricing for each content across 4 regional tiers
- **User Management:**
  - Comprehensive user oversight and profile management
  - Manual content access grants for payment difficulties
  - User activation/deactivation controls
  - Purchase history tracking and refund processing
- **Business Intelligence Dashboard:**
  - Revenue analytics by region and payment method
  - User engagement metrics (views, purchases, ratings, comments)
  - Content performance tracking across all regions
  - Conversion analysis (trailer views → purchases)
  - Regional market insights and trends
  - Payment method effectiveness by location

---

### 🎥 User Experience

#### **Public Access (All Users):**
- Browse complete movie catalog with advanced filtering
- Search functionality with category and genre filters
- View detailed movie/series information pages
- Watch trailers for free (no registration required)
- Location-based pricing display (automatic detection)
- Responsive design across all devices

#### **Registered Users:**
- **Personal Library:** Access to all purchased content
- **Watchlist & Favorites:** Curated personal collections
- **Watch History:** Track viewing progress and completion
- **User Profiles:** Personalized settings and preferences
- **Social Features:** Rate, comment, and share movies
- **Coin Wallet:** Manage coin balance and transactions (future feature)

#### **Content Access Model:**
- **Free Trailers:** Available to all users without restrictions
- **Pay-Per-Content:** Individual movie/episode purchases required for full access
- **Series Bundles:** Discounted complete series packages
- **Progressive Releases:** Episodes released on schedule (2 per week default)

---

### 💳 Payment System & Pricing

#### **4-Tier Regional Pricing Structure:**
- **Rwanda:** Local pricing in RWF, optimized for local market
- **East Africa:** Regional pricing in USD, competitive for neighboring countries  
- **Other Africa:** Continental pricing in USD, accessible across Africa
- **International:** Diaspora pricing in USD, premium international rates

#### **Pay-Per-Content Model**
- **Individual Pricing:** Each movie/episode has its own price set by admin
- **Dual Pricing Structure:**
  - **Local/African Pricing:** For MTN MoMo, Airtel Money users (in RWF)
  - **International Pricing:** For PayPal, Stripe users (in USD)
- **Series Pricing:**
  - Individual episodes available as they're released (2 per week)
  - Complete series purchase option unlocked when production is finished
  - Series bundle pricing (admin-set discount for buying complete series)

#### **Coin-Based Payment System (Future Feature)**
- **Coin Packages:** Users can pre-purchase coin bundles
  - **Local Coin Packages:** MTN MoMo, Airtel Money (RWF pricing)
  - **International Coin Packages:** PayPal, Stripe (USD pricing)
- **Coin Usage:** Spend coins to unlock movies/episodes
- **Coin Wallet:** Track balance, transaction history, refill options
- **Benefits:** Smoother user experience, potential discounts for bulk coin purchases

#### **Payment Methods by Region**
- **Rwanda/East Africa:**  
  - MTN Mobile Money (MoMo)
  - Airtel Money
  - Bank cards (Visa, Mastercard)
- **International (Diaspora):**  
  - PayPal
  - Stripe (Credit/Debit cards)
  - Bank transfers

#### **Transaction Management:**
- Comprehensive purchase history and receipts
- Multi-currency support with automatic conversion
- Secure payment processing with fraud protection
- Refund and dispute resolution system

---

## 🏗 Development Roadmap

### 1. **Backend Setup**
- Express server setup  
- MongoDB models:  
  - User (profile, purchase history, coin wallet, location detection)
  - Movie/Series (details, episodes, channels, trailer, 4-tier pricing structure)
  - Episode (series reference, individual pricing, release schedule)
  - Purchase (user, content, payment method, transaction details)
  - Comment, Rating, Like  
  - CoinTransaction (purchase, usage, balance tracking)
- JWT Authentication (register, login, logout).  
- **Admin routes:** 
  - CRUD movies/series/episodes
  - Upload to YouTube/AWS
  - Set individual pricing across 4 tiers (Rwanda/East Africa/Other Africa/International)
  - Analytics APIs with regional breakdown
  - Coin system management
  - User management and manual access grants
- **User routes:** 
  - Browse, search, filter content
  - Purchase individual movies/episodes with location-based pricing
  - Coin wallet management
  - My library (purchased content)
  - Comment, like, rate
- **Payment APIs:** 
  - Direct purchase processing with regional routing
  - Coin purchase and usage
  - Transaction logging with regional analytics
  - Payment method routing (local vs international)

---

### 2. **Frontend Setup**
- React + Tailwind project scaffold.  
- Implement global theming (light/dark mode).  
- Implement i18n for multilingual support (Kinyarwanda, English, French).  
- **Components:**  
  - Navbar with language + theme switcher
  - MovieCard, SeriesCard with regional pricing display
  - MoviePlayer, TrailerPlayer
  - SearchBar, CategoryFilter, RatingStars
  - **PurchaseButton** (location-aware pricing: shows only user's regional price)
  - **CoinWallet** component
  - **PricingModal** (choose payment method or coins)
  - **LocationDetector** (automatic user location identification)
- **Pages:**  
  - Home (featured, trending, categories)
  - Content Details (with location-based pricing, purchase options, trailer access)
  - Series Page (episodes list, individual/bundle pricing)
  - Login/Register  
  - **My Library** (purchased content access)
  - **Coin Wallet** (balance, purchase coins, transaction history)
  - Profile (purchase history, watchlist, account settings)
  - Admin Dashboard (analytics with regional breakdown, upload panel, 4-tier pricing management)

---

### 3. **Integration**
- Connect frontend with backend APIs.  
- Enable content upload options (YouTube link + AWS).  
- Implement **4-tier regional pay-per-content system** with automatic location detection.
- **Coin system integration** (purchase, balance, usage).
- Restrict full content access to purchased items only.
- Ensure trailers remain free for all users.
- **Payment gateway integration** with regional routing (mock locally → real integration later).
- **Admin access grant system** for manual content access provision.

---

### 4. **Testing & Deployment**
- Local development testing with mock payments across all pricing tiers.
- Test location detection and appropriate pricing display.
- Test coin purchase and usage flow.
- Test admin manual access grant functionality.
- Deploy backend (Render, Railway).  
- Deploy frontend (Netlify, Vercel).  
- Connect MongoDB Atlas for production database.  
- Optimize responsiveness for mobile web across all regions.

---

### 5. **Future Enhancements**
- **Mobile App:** React Native version with offline purchased content.
- **Full Payment Integration:** MTN MoMo, Airtel Money, PayPal, Stripe APIs.
- **Advanced Coin Features:** 
  - Coin rewards for referrals
  - Seasonal coin bonuses
  - Loyalty program with coin multipliers
- **Content Features:**
  - Season passes for series
  - Bundle deals (multiple movies at discount)
  - Gift purchases (send movie access to friends)
- **Analytics Enhancement:** 
  - Revenue optimization recommendations by region
  - Price testing A/B framework across pricing tiers
  - User purchase behavior analysis by location
- **Recommendation Engine:** Suggest content based on purchase history and regional preferences.
- **Content Moderation:** Advanced community management tools.
- **Download Feature:** Offline viewing for purchased content (mobile app).

---

## 🎯 Key Features Summary

### **Location-Based Pricing System:**
- **Automatic Detection:** System detects user location and shows appropriate pricing
- **4-Tier Regional Pricing:** Rwanda → East Africa → Other Africa → International
- **Single Price Display:** Users see only their regional price (no choice confusion)
- **Currency Optimization:** RWF for local markets, USD for international

### **Comprehensive Admin Control:**
- **Complete Platform Control:** Admin manages every aspect of the platform
- **Manual Access Grants:** Handle payment difficulties by giving direct access
- **Series Organization:** Hierarchical content management for episodes and seasons  
- **Advanced Analytics:** Deep insights into user behavior and business performance by region
- **4-Tier Pricing Management:** Set and adjust pricing across all regional markets

### **Enhanced Content Management:**
- **Series Hierarchy:** Episodes automatically organized under parent series
- **Progressive Releases:** Structured episode release scheduling (2 per week default)
- **Quality Control:** Admin preview and approval system
- **Dual Channel Support:** YouTube and AWS S3 hosting options

### **Business Intelligence:**
- **Regional Analytics:** Performance tracking across all 4 pricing tiers
- **Conversion Analysis:** Trailer viewers vs paying customers by region
- **Payment Method Effectiveness:** Success rates by region and payment type
- **User Lifecycle Management:** Active/inactive user management and re-engagement
- **Revenue Optimization:** Insights for pricing strategy across different markets

### **Cultural & Accessibility Features:**
- **Local Content Focus:** Exclusively Rwandan self-produced movies
- **Cultural Representation:** Respectful and accurate portrayal of Rwandan stories
- **Language Preservation:** Support for Kinyarwanda content and interface
- **Economic Accessibility:** Region-appropriate pricing ensures affordability
- **Diaspora Connection:** Bridge homeland culture with international communities

This comprehensive platform positions CinéRanda as the definitive destination for Rwandan cinema, combining cultural authenticity with technical innovation and economic accessibility to serve audiences across the global Rwandan community while supporting local content creators and maximizing revenue potential across diverse markets.