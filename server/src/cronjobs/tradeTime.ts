import { schedule } from "node-cron";
import { Trade } from "../models/Trade";
import { User } from "../models/User";
import { Transaction } from "../models/Transaction";
import { calculateBinaryOptionsPayout } from "../utils/finance";
import { getCoinPrice } from "../services/getcoins";
import { logger } from "../services/logger";
import { TRADING_CONFIG } from "../config/tradingConfig";

let isProcessing = false;
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 5;

/**
 * Settle a single trade with retry logic
 */
async function settleTrade(trade: any, retryCount = 0): Promise<boolean> {
    try {
        const user = await User.findById(trade.userId);
        if (!user) {
            logger.error("User not found for trade settlement", null, {
                tradeId: trade._id.toString(),
                userId: trade.userId.toString()
            });
            return false;
        }

        // Get settlement price
        let currentPrice: number;
        try {
            currentPrice = await getCoinPrice(trade.asset);
        } catch (priceError) {
            if (retryCount < TRADING_CONFIG.SETTLEMENT.RETRY_ATTEMPTS) {
                logger.warn("Price fetch failed, retrying", {
                    tradeId: trade._id.toString(),
                    asset: trade.asset,
                    retry: retryCount + 1
                });
                await new Promise(resolve => setTimeout(resolve, TRADING_CONFIG.SETTLEMENT.RETRY_DELAY));
                return settleTrade(trade, retryCount + 1);
            }
            throw priceError;
        }

        if (!currentPrice || currentPrice <= 0) {
            logger.error("Invalid settlement price", null, {
                tradeId: trade._id.toString(),
                asset: trade.asset,
                price: currentPrice
            });
            return false;
        }

        // Determine win/loss
        let isWin = false;
        let result: "win" | "loss" = "loss";

        if (trade.side === "call" && currentPrice > trade.entryPrice) {
            isWin = true;
            result = "win";
        } else if (trade.side === "put" && currentPrice < trade.entryPrice) {
            isWin = true;
            result = "win";
        }

        // Calculate payout
        const payoutCalculation = calculateBinaryOptionsPayout(
            trade.stakeAmount,
            TRADING_CONFIG.PAYOUT.RATIO,
            isWin
        );

        // Update user balance if won
        if (payoutCalculation.payout > 0) {
            user.balance += payoutCalculation.payout;
            await user.save();

            // Create payout transaction
            const payoutTransaction = new Transaction({
                userId: trade.userId,
                type: "trade_fee",
                amount: payoutCalculation.payout,
                status: "completed",
                meta: {
                    tradeId: trade._id,
                    type: 'payout',
                    profit: payoutCalculation.profit,
                    entryPrice: trade.entryPrice,
                    settlementPrice: currentPrice
                }
            });
            await payoutTransaction.save();
        }

        // Update trade
        trade.status = result;
        trade.settlementPrice = currentPrice;
        trade.settledAt = new Date();
        trade.payout = payoutCalculation.payout;
        await trade.save();

        logger.tradeEvent("settled", {
            tradeId: trade._id.toString(),
            userId: trade.userId.toString(),
            asset: trade.asset,
            side: trade.side,
            result,
            entryPrice: trade.entryPrice,
            settlementPrice: currentPrice,
            stake: trade.stakeAmount,
            payout: payoutCalculation.payout,
            profit: payoutCalculation.profit,
            userBalance: user.balance,
            platformProfit: payoutCalculation.platformProfit
        });

        return true;
    } catch (error: any) {
        logger.error("Trade settlement failed", error, {
            tradeId: trade._id.toString(),
            asset: trade.asset,
            retry: retryCount
        });
        return false;
    }
}

/**
 * Process expired trades
 */
schedule(TRADING_CONFIG.SETTLEMENT.CHECK_INTERVAL, async () => {
    // Prevent concurrent execution
    if (isProcessing) {
        logger.warn("Settlement job already running, skipping");
        return;
    }

    // Circuit breaker - stop if too many consecutive errors
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        logger.error("Too many consecutive settlement errors, pausing job", null, {
            consecutiveErrors
        });
        // Reset after 5 minutes
        setTimeout(() => {
            consecutiveErrors = 0;
            logger.info("Settlement error counter reset");
        }, 300000);
        return;
    }

    isProcessing = true;
    const startTime = Date.now();

    try {
        const now = new Date();

        // Find expired pending trades
        const pendingTrades = await Trade.find({
            status: "pending",
            expiryTime: { $lte: now }
        })
            .limit(TRADING_CONFIG.SETTLEMENT.BATCH_SIZE)
            .lean();

        if (pendingTrades.length === 0) {
            isProcessing = false;
            return;
        }

        logger.info("Processing expired trades", {
            count: pendingTrades.length
        });

        let successCount = 0;
        let failureCount = 0;

        // Process trades sequentially to avoid overwhelming the price API
        for (const trade of pendingTrades) {
            const success = await settleTrade(trade);
            if (success) {
                successCount++;
            } else {
                failureCount++;
            }
        }

        const executionTime = Date.now() - startTime;

        logger.info("Settlement batch completed", {
            total: pendingTrades.length,
            success: successCount,
            failed: failureCount,
            executionTime
        });

        logger.performanceMetric("settlement_batch_time", executionTime, "ms");

        // Reset error counter on success
        if (failureCount === 0) {
            consecutiveErrors = 0;
        } else {
            consecutiveErrors++;
        }

    } catch (error: any) {
        consecutiveErrors++;
        logger.error("Settlement job failed", error, {
            consecutiveErrors
        });
    } finally {
        isProcessing = false;
    }
});

logger.info("Trade settlement cron job initialized", {
    interval: TRADING_CONFIG.SETTLEMENT.CHECK_INTERVAL,
    batchSize: TRADING_CONFIG.SETTLEMENT.BATCH_SIZE
});
