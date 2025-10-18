import dotenv from "dotenv";
dotenv.config({ quiet: true });
import express, { Express } from "express";
const app: Express = express();
const PORT = process.env.PORT || 5000;
import cors from "cors";
import http from "http";
import { placeTrade } from "./SocketControllers/placeTrade";
import connectDB from "./config/connectDB";
import authRoutes from "./routes/auth.route";
import tradeRoutes from "./routes/trade.route";
import { Server, Socket } from "socket.io";
import WebSocket from "ws";
import { priceCache } from "./services/priceCache";
import { rateLimiter } from "./services/rateLimiter";
import { logger } from "./services/logger";
import { socketAuthMiddleware, AuthenticatedSocket } from "./middlewares/socket.middleware";
import { TRADING_CONFIG, isValidAsset } from "./config/tradingConfig";
// import "./cronjobs/tradeTime";


const corsOptions = {
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
        "Origin",
        "X-Requested-With",
        "Content-Type",
        "Accept",
        "Authorization",
        "Cache-Control",
        "X-Access-Token"
    ],
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));


app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/trade", tradeRoutes);

app.get("/", (req, res) => {
    res.json({ msg: "Routes Working Perfectly" })
});

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

connectDB();

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: true,
        methods: ["GET", "POST"],
        credentials: true,
    }
});

const binanceConnections: Record<string, WebSocket> = {};
const subscriberCount: Record<string, number> = {};
const socketSubscriptions: Map<string, Set<string>> = new Map(); // Track subscriptions per socket

// Apply authentication middleware to Socket.IO
io.use(socketAuthMiddleware);

io.on("connection", (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket;

    logger.info("Client connected", {
        socketId: authSocket.id,
        userId: authSocket.userId,
        email: authSocket.userEmail
    });

    // Initialize socket subscriptions tracking
    socketSubscriptions.set(authSocket.id, new Set());

    authSocket.on("subscribeCandle", (symbol: string) => {
        const lowerSymbol = symbol.toLowerCase();

        // Validate asset
        if (!isValidAsset(lowerSymbol)) {
            logger.warn("Invalid asset subscription attempt", {
                userId: authSocket.userId,
                symbol: lowerSymbol
            });
            authSocket.emit("error", { message: `Asset '${symbol}' is not supported` });
            return;
        }

        // Check rate limit
        const canSubscribe = rateLimiter.canSubscribe(authSocket.userId, lowerSymbol);
        if (!canSubscribe.allowed) {
            logger.warn("Subscription limit exceeded", {
                userId: authSocket.userId,
                symbol: lowerSymbol,
                reason: canSubscribe.reason
            });
            authSocket.emit("error", { message: canSubscribe.reason });
            return;
        }

        logger.info("Candle subscription", {
            userId: authSocket.userId,
            socketId: authSocket.id,
            symbol: lowerSymbol
        });

        // Track subscription for this socket
        const userSubs = socketSubscriptions.get(authSocket.id);
        if (userSubs) {
            userSubs.add(lowerSymbol);
        }

        // Record in rate limiter
        rateLimiter.recordSubscription(authSocket.userId, lowerSymbol);

        // Track subscriber count
        subscriberCount[lowerSymbol] = (subscriberCount[lowerSymbol] || 0) + 1;

        if (!binanceConnections[lowerSymbol]) {
            const ws = new WebSocket(
                `wss://stream.binance.com:9443/ws/${lowerSymbol}@kline_1m`
            );

            ws.on("open", () => {
                logger.info("Binance WebSocket connected", { symbol: lowerSymbol });
            });

            ws.on("close", () => {
                logger.warn("Binance WebSocket closed", { symbol: lowerSymbol });
                delete binanceConnections[lowerSymbol];

                // Attempt reconnection after delay
                setTimeout(() => {
                    if (subscriberCount[lowerSymbol] > 0 && !binanceConnections[lowerSymbol]) {
                        logger.info("Attempting to reconnect Binance WebSocket", { symbol: lowerSymbol });
                        // Re-trigger subscription (simplified - in production use more robust reconnection)
                    }
                }, TRADING_CONFIG.WEBSOCKET.RECONNECT_DELAY);
            });

            ws.on("error", (error) => {
                logger.error("Binance WebSocket error", error, { symbol: lowerSymbol });
            });

            ws.on("message", (msg) => {
                try {
                    const data = JSON.parse(msg.toString());
                    const k = data.k;
                    const currentPrice = parseFloat(k.c);

                    const candle = {
                        symbol: lowerSymbol.toUpperCase(),
                        time: Math.floor(k.t / 1000),
                        open: parseFloat(k.o),
                        high: parseFloat(k.h),
                        low: parseFloat(k.l),
                        close: currentPrice,
                        isFinal: k.x,
                        currentprice: currentPrice
                    };

                    // Update price cache for trade execution
                    priceCache.updatePrice(lowerSymbol, currentPrice);

                    logger.priceUpdate(lowerSymbol, currentPrice, "binance_websocket");
                    io.emit("candleUpdate", candle);
                } catch (error) {
                    logger.error("Error parsing Binance message", error, { symbol: lowerSymbol });
                }
            });

            binanceConnections[lowerSymbol] = ws;
        }
    });

    authSocket.on("unsubscribeCandle", (symbol: string) => {
        const lowerSymbol = symbol.toLowerCase();

        logger.info("Candle unsubscription", {
            userId: authSocket.userId,
            socketId: authSocket.id,
            symbol: lowerSymbol
        });

        // Remove from socket tracking
        const userSubs = socketSubscriptions.get(authSocket.id);
        if (userSubs) {
            userSubs.delete(lowerSymbol);
        }

        // Remove from rate limiter
        rateLimiter.removeSubscription(authSocket.userId, lowerSymbol);

        subscriberCount[lowerSymbol] = Math.max((subscriberCount[lowerSymbol] || 1) - 1, 0);

        // Close WebSocket if no more subscribers
        if (subscriberCount[lowerSymbol] === 0 && binanceConnections[lowerSymbol]) {
            logger.info("Closing Binance connection (no subscribers)", { symbol: lowerSymbol });
            binanceConnections[lowerSymbol].close();
            delete binanceConnections[lowerSymbol];
            delete subscriberCount[lowerSymbol];
        }
    });

    authSocket.on("placeTrade", async (data) => {
        const startTime = Date.now();

        // Add userId from authenticated socket
        const tradeData = {
            ...data,
            userId: authSocket.userId
        };

        logger.tradeEvent("requested", {
            userId: authSocket.userId,
            asset: data.asset,
            side: data.side,
            stakeAmount: data.stakeAmount
        });

        const response = await placeTrade(tradeData);

        const executionTime = Date.now() - startTime;
        logger.performanceMetric("socket_trade_execution", executionTime, "ms");

        authSocket.emit("tradePlaced", response);

        // Optionally broadcast to user's other sessions
        if (response.isOk) {
            io.to(authSocket.userId).emit("balanceUpdate", {
                balance: response.balance
            });
        }
    });

    authSocket.on("disconnect", () => {
        logger.info("Client disconnected", {
            socketId: authSocket.id,
            userId: authSocket.userId
        });

        // Clean up all subscriptions for this socket
        const userSubs = socketSubscriptions.get(authSocket.id);
        if (userSubs) {
            userSubs.forEach(symbol => {
                subscriberCount[symbol] = Math.max((subscriberCount[symbol] || 1) - 1, 0);

                // Close WebSocket if no more subscribers
                if (subscriberCount[symbol] === 0 && binanceConnections[symbol]) {
                    logger.info("Closing Binance connection on disconnect", { symbol });
                    binanceConnections[symbol].close();
                    delete binanceConnections[symbol];
                    delete subscriberCount[symbol];
                }
            });
            socketSubscriptions.delete(authSocket.id);
        }

        // Clear rate limiter subscriptions
        rateLimiter.clearUserSubscriptions(authSocket.userId);
    });
});

server.listen(PORT, () => {
    logger.info("Server started", {
        port: PORT,
        environment: process.env.NODE_ENV || "development",
        config: {
            minStake: TRADING_CONFIG.STAKE.MIN,
            maxStake: TRADING_CONFIG.STAKE.MAX,
            payoutRatio: TRADING_CONFIG.PAYOUT.RATIO,
            supportedAssets: TRADING_CONFIG.SUPPORTED_ASSETS.length
        }
    });
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`🌐 Socket.io server ready with authentication`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
