import { User, IUser } from "../models/User";
import { Trade, ITrade } from "../models/Trade";
import { Transaction, ITransaction } from "../models/Transaction";
import { calculateBinaryOptionsPayout, PLATFORM_PAYOUT_RATIO } from "../utils/finance";
import { getCoinPrice } from "../services/getcoins";
import { rateLimiter } from "../services/rateLimiter";
import { logger } from "../services/logger";
import { TRADING_CONFIG, isValidAsset, isValidExpiry, isValidStake } from "../config/tradingConfig";

interface TradeData {
    userId: string;
    asset: string;
    side: 'call' | 'put';
    stakeAmount: number;
    expiryDuration: number;
}

interface TradeResponse {
    message: string;
    isOk: boolean;
    trade?: ITrade;
    transaction?: ITransaction;
    stakeAmount?: number;
    balance?: number;
    entryPrice?: number;
    expiryTime?: Date;
    potentialPayout?: number;
}

export const placeTrade = async (data: TradeData): Promise<TradeResponse> => {
    const startTime = Date.now();
    const { userId, asset, side, stakeAmount, expiryDuration } = data;

    try {
        // 1. VALIDATE REQUIRED FIELDS
        if (!userId || !asset || !side || !stakeAmount || !expiryDuration) {
            logger.warn("Trade validation failed: Missing fields", { userId, asset });
            return { message: "Missing required fields", isOk: false };
        }

        // 2. VALIDATE SIDE
        if (!['call', 'put'].includes(side)) {
            logger.warn("Invalid trade side", { userId, asset, side });
            return { message: "Side must be 'call' or 'put'", isOk: false };
        }

        // 3. VALIDATE ASSET
        if (!isValidAsset(asset)) {
            logger.warn("Invalid asset", { userId, asset });
            return { message: `Asset '${asset}' is not supported`, isOk: false };
        }

        // 4. VALIDATE EXPIRY DURATION
        if (!isValidExpiry(expiryDuration)) {
            logger.warn("Invalid expiry duration", { userId, asset, expiryDuration });
            return {
                message: `Expiry must be between ${TRADING_CONFIG.EXPIRY.MIN / 1000}s and ${TRADING_CONFIG.EXPIRY.MAX / 1000}s`,
                isOk: false
            };
        }

        // 5. CHECK RATE LIMITING
        const rateLimitCheck = rateLimiter.canPlaceTrade(userId);
        if (!rateLimitCheck.allowed) {
            logger.securityEvent("Rate limit exceeded", {
                userId,
                reason: rateLimitCheck.reason,
                resetIn: rateLimitCheck.resetIn
            });
            return {
                message: rateLimitCheck.reason || "Rate limit exceeded",
                isOk: false
            };
        }

        // 6. GET USER & VALIDATE
        const user: IUser | null = await User.findById(userId);
        if (!user) {
            logger.error("User not found", null, { userId });
            return { message: "User not found", isOk: false };
        }

        if (!user.isActive) {
            logger.securityEvent("Inactive user attempted trade", { userId, email: user.email });
            return { message: "Account is not active", isOk: false };
        }

        // 7. VALIDATE STAKE AMOUNT
        const stakeValidation = isValidStake(stakeAmount, user.balance);
        if (!stakeValidation.valid) {
            logger.warn("Invalid stake amount", {
                userId,
                stakeAmount,
                balance: user.balance,
                reason: stakeValidation.reason
            });
            return { message: stakeValidation.reason || "Invalid stake amount", isOk: false };
        }

        if (stakeAmount > user.balance) {
            logger.warn("Insufficient balance", { userId, stakeAmount, balance: user.balance });
            return { message: "Insufficient balance", isOk: false };
        }

        // 8. CHECK CONCURRENT TRADES LIMIT
        const activeTrades = await Trade.countDocuments({
            userId: user._id,
            status: "pending"
        });

        if (activeTrades >= TRADING_CONFIG.RATE_LIMITS.MAX_CONCURRENT_TRADES) {
            logger.warn("Max concurrent trades reached", { userId, activeTrades });
            return {
                message: `Maximum ${TRADING_CONFIG.RATE_LIMITS.MAX_CONCURRENT_TRADES} active trades allowed`,
                isOk: false
            };
        }

        // 9. GET CURRENT PRICE
        const currentPrice = await getCoinPrice(asset);
        if (!currentPrice || currentPrice <= 0) {
            logger.error("Failed to fetch price", null, { asset, currentPrice });
            return { message: "Failed to fetch asset price. Please try again.", isOk: false };
        }

        // 10. VALIDATE PRICE IS RECENT (slippage protection)
        const priceAge = Date.now() - startTime;
        if (priceAge > TRADING_CONFIG.PRICE.CACHE_STALE_THRESHOLD) {
            logger.warn("Price too old", { asset, priceAge });
            return { message: "Price data is stale. Please try again.", isOk: false };
        }

        // 11. DEDUCT BALANCE
        user.balance = Number(user.balance - stakeAmount);
        await user.save();

        // 12. CALCULATE EXPIRY TIME
        const entryTime = new Date();
        const expiryTime = new Date(Date.now() + expiryDuration);

        // 13. CREATE TRADE
        const trade: ITrade = new Trade({
            userId,
            asset: asset.toLowerCase(),
            side,
            stakeAmount,
            entryPrice: currentPrice,
            payoutRatio: TRADING_CONFIG.PAYOUT.RATIO,
            entryTime,
            expiryTime,
            status: "pending"
        });
        await trade.save();

        // 14. CREATE TRANSACTION RECORD
        const stakeTransaction: ITransaction = new Transaction({
            userId,
            type: "trade_fee",
            amount: stakeAmount,
            status: "completed",
            meta: {
                tradeId: trade._id,
                type: 'stake',
                asset: asset.toLowerCase(),
                side,
                entryPrice: currentPrice
            }
        });
        await stakeTransaction.save();

        // 15. RECORD RATE LIMIT
        rateLimiter.recordTrade(userId);

        // 16. CALCULATE POTENTIAL PAYOUT
        const potentialPayout = calculateBinaryOptionsPayout(stakeAmount, TRADING_CONFIG.PAYOUT.RATIO, true).payout;

        // 17. LOG SUCCESS
        const executionTime = Date.now() - startTime;
        logger.tradeEvent("placed", {
            tradeId: String(trade._id),
            userId: userId,
            asset: asset.toLowerCase(),
            side,
            stakeAmount,
            entryPrice: currentPrice,
            expiryDuration,
            executionTime
        });

        logger.performanceMetric("trade_execution_time", executionTime, "ms");

        return {
            message: "Trade placed successfully",
            trade,
            transaction: stakeTransaction,
            stakeAmount,
            balance: user.balance,
            entryPrice: currentPrice,
            expiryTime,
            potentialPayout,
            isOk: true
        };

    } catch (error: any) {
        logger.error("Trade placement failed", error, {
            userId,
            asset,
            side,
            stakeAmount
        });
        return {
            message: "Failed to place trade. Please try again.",
            isOk: false
        };
    }
};