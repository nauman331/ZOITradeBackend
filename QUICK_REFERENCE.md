# Quick Reference - Production Trading Backend

## 🚀 Quick Start

### Start Server

```bash
npm run dev     # Development
npm run build   # Build for production
npm start       # Production
```

### Environment Setup

```env
JWT_SECRET=your-secret-here
MONGO_URI=mongodb://localhost:27017/trading
PLATFORM_PAYOUT_RATIO=0.85
LOG_LEVEL=info
```

## 📡 Socket.IO Events

### Client → Server

#### `subscribeCandle`

Subscribe to real-time price updates

```javascript
socket.emit("subscribeCandle", "btcusdt");
```

#### `unsubscribeCandle`

Unsubscribe from price updates

```javascript
socket.emit("unsubscribeCandle", "btcusdt");
```

#### `placeTrade`

Place a binary options trade

```javascript
socket.emit("placeTrade", {
  asset: "btcusdt", // Required: 'btcusdt', 'ethusdt', etc.
  side: "call", // Required: 'call' or 'put'
  stakeAmount: 10, // Required: 1-10000
  expiryDuration: 60000, // Required: 60000, 120000, 300000, etc.
});
```

### Server → Client

#### `candleUpdate`

Real-time candle data

```javascript
socket.on("candleUpdate", (candle) => {
  console.log(candle);
  // {
  //     symbol: 'BTCUSDT',
  //     time: 1705579200,
  //     open: 42000.50,
  //     high: 42100.00,
  //     low: 41950.25,
  //     close: 42050.75,
  //     isFinal: false,
  //     currentprice: 42050.75
  // }
});
```

#### `tradePlaced`

Trade placement response

```javascript
socket.on("tradePlaced", (response) => {
  if (response.isOk) {
    // Success
    console.log("Trade ID:", response.trade._id);
    console.log("Entry Price:", response.entryPrice);
    console.log("Expiry Time:", response.expiryTime);
    console.log("Potential Payout:", response.potentialPayout);
    console.log("New Balance:", response.balance);
  } else {
    // Error
    console.error("Error:", response.message);
  }
});
```

#### `balanceUpdate`

Balance changed (e.g., trade settled)

```javascript
socket.on("balanceUpdate", (data) => {
  console.log("New Balance:", data.balance);
});
```

#### `error`

Error message

```javascript
socket.on("error", (error) => {
  console.error("Error:", error.message);
});
```

#### `connect_error`

Connection/authentication failed

```javascript
socket.on("connect_error", (error) => {
  console.error("Connection failed:", error.message);
});
```

## 🔧 API Endpoints

### `GET /`

Basic route test

```bash
curl http://localhost:5000/
```

Response:

```json
{
  "msg": "Routes Working Perfectly"
}
```

### `GET /health`

System health check

```bash
curl http://localhost:5000/health
```

Response:

```json
{
  "status": "ok",
  "timestamp": "2025-01-18T10:00:00.000Z",
  "server": {
    "uptime": 3600,
    "memory": { "rss": 123456, "heapTotal": 78910, "heapUsed": 45678 }
  },
  "websockets": {
    "active": 5,
    "symbols": ["btcusdt", "ethusdt", "bnbusdt"]
  },
  "rateLimiter": {
    "activeMinuteLimits": 10,
    "activeHourLimits": 25,
    "activeSubscriptions": 15,
    "totalSubscriptions": 30
  },
  "config": {
    "minStake": 1,
    "maxStake": 10000,
    "payoutRatio": 0.85,
    "supportedAssets": 13
  }
}
```

### `GET /metrics`

Performance metrics

```bash
curl http://localhost:5000/metrics
```

Response:

```json
{
  "timestamp": "2025-01-18T10:00:00.000Z",
  "priceCache": {
    "symbols": 5,
    "cached": ["btcusdt", "ethusdt", "bnbusdt", "xrpusdt", "adausdt"]
  },
  "rateLimiter": {
    /* ... */
  },
  "websockets": {
    "connections": 5,
    "subscribers": 12
  }
}
```

## 🎯 Trading Rules

### Supported Assets

```
btcusdt, ethusdt, bnbusdt, xrpusdt, adausdt,
dogeusdt, solusdt, dotusdt, maticusdt, ltcusdt,
linkusdt, uniusdt, avaxusdt
```

### Stake Limits

- **Minimum**: $1
- **Maximum**: $10,000
- **Max per trade**: 20% of balance

### Expiry Durations (milliseconds)

```javascript
60000; // 1 minute
120000; // 2 minutes
300000; // 5 minutes
900000; // 15 minutes
1800000; // 30 minutes
3600000; // 1 hour
```

### Rate Limits (per user)

- **Per minute**: 10 trades
- **Per hour**: 100 trades
- **Concurrent**: 20 active trades
- **Subscriptions**: 10 symbols

### Payout

- **Ratio**: 85% (configurable)
- **Win**: Stake + (Stake × 0.85)
- **Loss**: $0

## 🔐 Authentication

### Socket Connection

```javascript
const socket = io("http://localhost:5000", {
  auth: {
    token: "your-jwt-token",
  },
});
```

### Token Format

Standard JWT with payload:

```json
{
  "userId": "user-id-here",
  "role": "User",
  "iat": 1705579200,
  "exp": 1706184000
}
```

## ⚠️ Error Messages

### Trade Errors

| Message                            | Reason           | Solution                  |
| ---------------------------------- | ---------------- | ------------------------- |
| "Missing required fields"          | Invalid request  | Check all fields provided |
| "Side must be 'call' or 'put'"     | Invalid side     | Use 'call' or 'put'       |
| "Asset 'xxx' is not supported"     | Invalid asset    | Use supported asset       |
| "Expiry must be between..."        | Invalid duration | Use allowed duration      |
| "Too many trades per minute"       | Rate limited     | Wait 1 minute             |
| "Hourly trade limit reached"       | Rate limited     | Wait 1 hour               |
| "Maximum 20 active trades allowed" | Too many pending | Wait for settlement       |
| "User not found"                   | Invalid userId   | Check authentication      |
| "Account is not active"            | Inactive account | Contact admin             |
| "Insufficient balance"             | Low balance      | Deposit funds             |
| "Minimum stake is $1"              | Stake too low    | Increase stake            |
| "Maximum stake is $10000"          | Stake too high   | Decrease stake            |
| "Cannot risk more than 20%"        | Risk too high    | Decrease stake            |
| "Failed to fetch asset price"      | Price API down   | Try again later           |
| "Price data is stale"              | Old price        | Try again                 |

### Connection Errors

| Message                         | Reason             |
| ------------------------------- | ------------------ |
| "Authentication token required" | No token provided  |
| "Invalid or expired token"      | Bad/expired JWT    |
| "User not found"                | User doesn't exist |
| "Account is not active"         | User inactive      |

## 📊 Log Events

All logs are JSON format:

```json
{
  "timestamp": "2025-01-18T10:00:00.000Z",
  "level": "INFO",
  "message": "Trade placed",
  "event": "trade_placed",
  "tradeId": "...",
  "userId": "...",
  "asset": "btcusdt",
  "side": "call",
  "stakeAmount": 10,
  "entryPrice": 42000
}
```

### Event Types

- `trade_placed` - Trade created
- `trade_settled` - Trade completed
- `price_update` - Price changed
- `ws_connection` - WebSocket event
- `security_*` - Security event
- `performance` - Performance metric

## 🧪 Testing Commands

### Test Health

```bash
curl http://localhost:5000/health | jq
```

### Test Metrics

```bash
curl http://localhost:5000/metrics | jq
```

### Watch Logs

```bash
# If using PM2
pm2 logs trading-backend

# Filter by level
pm2 logs trading-backend | grep ERROR
pm2 logs trading-backend | grep trade_placed
```

### Monitor Performance

```bash
# Check response time
time curl http://localhost:5000/health

# Monitor price cache
watch -n 5 'curl -s http://localhost:5000/metrics | jq .priceCache'

# Monitor WebSocket connections
watch -n 5 'curl -s http://localhost:5000/health | jq .websockets'
```

## 🔥 Common Tasks

### Check Active Trades

```javascript
const activeTrades = await Trade.find({
  userId: "user-id",
  status: "pending",
});
```

### Check User Balance

```javascript
const user = await User.findById("user-id");
console.log("Balance:", user.balance);
```

### Get Trade History

```javascript
const trades = await Trade.find({
  userId: "user-id",
  status: { $in: ["win", "loss"] },
})
  .sort({ createdAt: -1 })
  .limit(10);
```

### Calculate Win Rate

```javascript
const trades = await Trade.find({
  userId: "user-id",
  status: { $ne: "pending" },
});
const wins = trades.filter((t) => t.status === "win").length;
const winRate = (wins / trades.length) * 100;
console.log("Win Rate:", winRate + "%");
```

### Force Settle Trade (Emergency)

```javascript
const trade = await Trade.findById("trade-id");
trade.status = "loss"; // or 'win'
trade.settlementPrice = 42000;
trade.settledAt = new Date();
await trade.save();
```

## 📦 Configuration Variables

### Required

- `JWT_SECRET` - Secret for JWT signing
- `MONGO_URI` - MongoDB connection string
- `PORT` - Server port (default: 5000)

### Optional

- `PLATFORM_PAYOUT_RATIO` - Payout % (default: 0.85)
- `MIN_STAKE` - Min stake (default: 1)
- `MAX_STAKE` - Max stake (default: 10000)
- `TRADES_PER_MINUTE` - Rate limit (default: 10)
- `TRADES_PER_HOUR` - Rate limit (default: 100)
- `MAX_CONCURRENT_TRADES` - Active limit (default: 20)
- `LOG_LEVEL` - Logging level (default: info)
- `NODE_ENV` - Environment (development/production)

## 🎬 Example Flow

```javascript
// 1. Connect with authentication
const socket = io("http://localhost:5000", {
  auth: { token: jwt },
});

// 2. Subscribe to price feed
socket.emit("subscribeCandle", "btcusdt");

// 3. Wait for price updates
socket.on("candleUpdate", (candle) => {
  updateChart(candle);
});

// 4. Place trade when ready
socket.emit("placeTrade", {
  asset: "btcusdt",
  side: "call",
  stakeAmount: 10,
  expiryDuration: 60000,
});

// 5. Handle response
socket.on("tradePlaced", (response) => {
  if (response.isOk) {
    showSuccess(response.trade);
    updateBalance(response.balance);
  } else {
    showError(response.message);
  }
});

// 6. Trade auto-settles after 60 seconds
socket.on("balanceUpdate", (data) => {
  updateBalance(data.balance);
});
```

## 🆘 Emergency Commands

### Stop all settlements

```bash
# Comment out in code
// import "./cronjobs/tradeTime";
# Restart server
pm2 restart trading-backend
```

### Clear rate limits

```bash
# Restart server (clears memory)
pm2 restart trading-backend
```

### Check stuck trades

```javascript
const stuck = await Trade.find({
  status: "pending",
  expiryTime: { $lt: new Date(Date.now() - 3600000) }, // 1 hour ago
});
console.log("Stuck trades:", stuck.length);
```

---

**Need help?** Check:

1. `/health` endpoint
2. `/metrics` endpoint
3. Server logs (`pm2 logs`)
4. `MIGRATION_GUIDE.md`
5. `PRODUCTION_READY.md`
