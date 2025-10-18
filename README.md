# � Trading Platform - Zoi Trade

A modern trading platform similar to Quotex, built with React Native for mobile and Node.js for the backend.

## Quick Start Instructions

### 1. Backend Server Setup

```bash
cd server
npm install
npm run dev
```

The server will start on `http://localhost:5000`

### 2. Mobile App Setup

```bash
cd mobile-app
npm install
# For iOS
npx react-native run-ios
# For Android
npx react-native run-android
```

### 3. Environment Variables

Create a `.env` file in the server directory:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/tradingplatform
JWT_SECRET=your_jwt_secret_here
COMMISSION_RATE=0.1
PLATFORM_PAYOUT_RATIO=0.7
```

### 4. Test the Application

1. Register a new user account through the mobile app
2. Login with your credentials
3. Fund your account (demo mode available)
4. Start trading with various assets
5. Monitor your positions and portfolio in real-time

## Features Implemented ✅

### Trading Core Features

- **User Authentication & Authorization** - JWT-based secure login/signup
- **Real-time Price Feeds** - Live market data via Socket.io
- **Trade Execution** - Buy/Sell orders with commission calculations
- **Portfolio Management** - Track positions, balance, and equity
- **Risk Management** - Platform payout ratios and commission structures

### Account Management

- User registration and profile management
- Account balance and equity tracking
- Transaction history and trade logs
- Admin panel for user management

### Real-time Features

- Live price updates via WebSockets
- Real-time portfolio updates
- Instant trade execution notifications
- Connection state monitoring

### Security & Compliance

- JWT authentication middleware
- Input validation with Zod
- Password hashing with bcryptjs
- Role-based access control (Admin/User)
- OTP verification for enhanced security

## How It Works

1. **User Registration**: New users sign up with email/phone verification
2. **Account Funding**: Users deposit funds to their trading account
3. **Market Analysis**: Real-time price feeds help users analyze market trends
4. **Trade Execution**: Users place buy/sell orders on various assets
5. **Position Management**: System tracks open positions and calculates P&L
6. **Settlement**: Completed trades update user balance with commission deductions

## Technical Architecture

```
Mobile App (React Native + TypeScript)
├── NativeWind (Tailwind CSS for React Native)
├── Redux Toolkit (State Management)
├── AsyncStorage (Local Data Persistence)
├── Socket.io Client (Real-time Updates)
└── Secure Authentication

Backend (Node.js + Express + TypeScript)
├── Socket.io Server (Real-time Price Feeds)
├── MongoDB (User Data & Trades)
├── JWT Authentication
├── Trading Engine (Order Processing)
├── Commission Calculator
└── Admin Management Panel
```

## API Endpoints

### Authentication Routes

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/verify-otp` - OTP verification
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### Trading Routes

- `POST /api/trades/buy` - Execute buy order
- `POST /api/trades/sell` - Execute sell order
- `GET /api/trades/positions` - Get user positions
- `GET /api/trades/history` - Get trade history
- `DELETE /api/trades/:id` - Close position

### Admin Routes

- `GET /api/admin/users` - Get all users
- `PUT /api/admin/users/:id` - Update user status
- `GET /api/admin/trades` - Get all trades
- `GET /api/admin/analytics` - Platform analytics

## Database Models

### User Model

```typescript
interface IUser {
  name: string;
  email: string;
  password?: string;
  role: "Admin" | "User";
  balance: number;
  equity: number;
  phone?: string;
  isActive: boolean;
}
```

### Trade Model (To be implemented)

```typescript
interface ITrade {
  userId: string;
  asset: string;
  type: "buy" | "sell";
  amount: number;
  price: number;
  commission: number;
  status: "open" | "closed";
  pnl?: number;
}
```

## Mobile App Tech Stack

- **React Native** - Cross-platform mobile development
- **NativeWind** - Tailwind CSS for React Native styling
- **Redux Toolkit (RTK)** - State management with async actions
- **AsyncStorage** - Local storage for user preferences and offline data
- **Socket.io Client** - Real-time price updates and notifications
- **React Navigation** - Navigation between screens
- **React Hook Form** - Form handling and validation

## Development Notes

- Commission rate is configurable via environment variables (default: 10%)
- Platform payout ratio ensures house edge (default: 70%)
- Real-time price feeds via Socket.io for instant market updates
- JWT tokens for secure API authentication
- MongoDB for scalable data storage
- TypeScript for type safety across the entire stack

## Next Steps for Production

### Backend Enhancements

1. Complete implementation of Trade and Position models
2. Add real-time market data integration (Alpha Vantage, Yahoo Finance, etc.)
3. Implement advanced order types (limit orders, stop-loss, take-profit)
4. Add trading analytics and reporting features
5. Implement KYC (Know Your Customer) verification
6. Add payment gateway integration for deposits/withdrawals

### Mobile App Development

1. Build authentication screens with OTP verification
2. Create trading dashboard with charts and indicators
3. Implement real-time portfolio tracking
4. Add push notifications for trade alerts
5. Build settings and profile management screens
6. Implement biometric authentication for enhanced security

### Infrastructure & Security

1. Set up production environment with load balancing
2. Implement comprehensive logging and monitoring
3. Add rate limiting and DDoS protection
4. Set up automated testing and CI/CD pipelines
5. Implement data encryption for sensitive information
6. Add backup and disaster recovery procedures

### Health Check

// Health check endpoint
app.get("/health", (req, res) => {
const activeConnections = Object.keys(binanceConnections).length;
const cachedSymbols = priceCache.getCachedSymbols();
const rateLimiterStats = rateLimiter.getStats();

    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        server: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
        },
        websockets: {
            active: activeConnections,
            symbols: cachedSymbols
        },
        rateLimiter: rateLimiterStats,
        config: {
            minStake: TRADING_CONFIG.STAKE.MIN,
            maxStake: TRADING_CONFIG.STAKE.MAX,
            payoutRatio: TRADING_CONFIG.PAYOUT.RATIO,
            supportedAssets: TRADING_CONFIG.SUPPORTED_ASSETS.length
        }
    });

});

// Metrics endpoint (optional - for monitoring)
app.get("/metrics", (req, res) => {
res.json({
timestamp: new Date().toISOString(),
priceCache: {
symbols: priceCache.getCachedSymbols().length,
cached: priceCache.getCachedSymbols()
},
rateLimiter: rateLimiter.getStats(),
websockets: {
connections: Object.keys(binanceConnections).length,
subscribers: Object.keys(subscriberCount).reduce((sum, key) => sum + subscriberCount[key], 0)
}
});
});

Happy trading! 📈💰
