import { TRADING_CONFIG } from "../config/tradingConfig";

export const PLATFORM_PAYOUT_RATIO = TRADING_CONFIG.PAYOUT.RATIO;

/**
 * Calculate binary options payout
 * @param stakeAmount - Amount staked by user
 * @param payoutRatio - Payout ratio (default from config)
 * @param isWin - Whether trade was won
 * @returns Payout details
 */
export function calculateBinaryOptionsPayout(
    stakeAmount: number,
    payoutRatio: number = PLATFORM_PAYOUT_RATIO,
    isWin: boolean = false
) {
    // Validate inputs
    if (stakeAmount <= 0) {
        throw new Error("Stake amount must be positive");
    }

    if (payoutRatio < 0 || payoutRatio > 1) {
        throw new Error("Payout ratio must be between 0 and 1");
    }

    if (!isWin) {
        return {
            payout: 0,
            profit: -stakeAmount, // User loses their stake
            platformProfit: stakeAmount
        };
    }

    const profit = Number((stakeAmount * payoutRatio).toFixed(2));
    const totalPayout = Number((stakeAmount + profit).toFixed(2)); // Return stake + profit
    const platformLoss = Number(profit.toFixed(2)); // Platform pays out the profit

    return {
        payout: totalPayout,
        profit: profit,
        platformProfit: -platformLoss // Negative because platform pays out
    };
}

/**
 * Calculate platform profit/loss for a period
 */
export function calculatePlatformPnL(trades: Array<{ stakeAmount: number; payout: number }>) {
    return trades.reduce((total, trade) => {
        const stakeIn = trade.stakeAmount;
        const payoutOut = trade.payout;
        return total + (stakeIn - payoutOut);
    }, 0);
}

/**
 * Calculate user win rate
 */
export function calculateWinRate(wins: number, total: number): number {
    if (total === 0) return 0;
    return Number(((wins / total) * 100).toFixed(2));
}