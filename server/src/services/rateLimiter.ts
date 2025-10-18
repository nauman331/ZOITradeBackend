/**
 * Rate Limiter Service
 * Prevents abuse by limiting user actions
 */

import { TRADING_CONFIG } from '../config/tradingConfig';

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

class RateLimiter {
    private tradeMinuteLimits: Map<string, RateLimitEntry> = new Map();
    private tradeHourLimits: Map<string, RateLimitEntry> = new Map();
    private subscriptionLimits: Map<string, Set<string>> = new Map();

    /**
     * Check if user can place a trade (per minute limit)
     */
    canPlaceTrade(userId: string): { allowed: boolean; reason?: string; resetIn?: number } {
        const now = Date.now();

        // Check minute limit
        const minuteKey = `${userId}:minute`;
        const minuteEntry = this.tradeMinuteLimits.get(minuteKey);

        if (minuteEntry && minuteEntry.resetAt > now) {
            if (minuteEntry.count >= TRADING_CONFIG.RATE_LIMITS.TRADES_PER_MINUTE) {
                return {
                    allowed: false,
                    reason: 'Too many trades per minute. Please wait.',
                    resetIn: Math.ceil((minuteEntry.resetAt - now) / 1000),
                };
            }
        }

        // Check hour limit
        const hourKey = `${userId}:hour`;
        const hourEntry = this.tradeHourLimits.get(hourKey);

        if (hourEntry && hourEntry.resetAt > now) {
            if (hourEntry.count >= TRADING_CONFIG.RATE_LIMITS.TRADES_PER_HOUR) {
                return {
                    allowed: false,
                    reason: 'Hourly trade limit reached. Please wait.',
                    resetIn: Math.ceil((hourEntry.resetAt - now) / 1000),
                };
            }
        }

        return { allowed: true };
    }

    /**
     * Record a trade for rate limiting
     */
    recordTrade(userId: string): void {
        const now = Date.now();

        // Record minute limit
        const minuteKey = `${userId}:minute`;
        const minuteEntry = this.tradeMinuteLimits.get(minuteKey);

        if (!minuteEntry || minuteEntry.resetAt <= now) {
            this.tradeMinuteLimits.set(minuteKey, {
                count: 1,
                resetAt: now + 60000, // 1 minute
            });
        } else {
            minuteEntry.count++;
        }

        // Record hour limit
        const hourKey = `${userId}:hour`;
        const hourEntry = this.tradeHourLimits.get(hourKey);

        if (!hourEntry || hourEntry.resetAt <= now) {
            this.tradeHourLimits.set(hourKey, {
                count: 1,
                resetAt: now + 3600000, // 1 hour
            });
        } else {
            hourEntry.count++;
        }
    }

    /**
     * Check if user can subscribe to more symbols
     */
    canSubscribe(userId: string, symbol: string): { allowed: boolean; reason?: string } {
        let userSubs = this.subscriptionLimits.get(userId);

        if (!userSubs) {
            userSubs = new Set();
            this.subscriptionLimits.set(userId, userSubs);
        }

        if (userSubs.has(symbol)) {
            return { allowed: true }; // Already subscribed
        }

        if (userSubs.size >= TRADING_CONFIG.RATE_LIMITS.WEBSOCKET_SUBSCRIPTIONS_PER_USER) {
            return {
                allowed: false,
                reason: `Maximum ${TRADING_CONFIG.RATE_LIMITS.WEBSOCKET_SUBSCRIPTIONS_PER_USER} subscriptions allowed`,
            };
        }

        return { allowed: true };
    }

    /**
     * Record a subscription
     */
    recordSubscription(userId: string, symbol: string): void {
        let userSubs = this.subscriptionLimits.get(userId);
        if (!userSubs) {
            userSubs = new Set();
            this.subscriptionLimits.set(userId, userSubs);
        }
        userSubs.add(symbol.toLowerCase());
    }

    /**
     * Remove a subscription
     */
    removeSubscription(userId: string, symbol: string): void {
        const userSubs = this.subscriptionLimits.get(userId);
        if (userSubs) {
            userSubs.delete(symbol.toLowerCase());
            if (userSubs.size === 0) {
                this.subscriptionLimits.delete(userId);
            }
        }
    }

    /**
     * Clear all subscriptions for a user (on disconnect)
     */
    clearUserSubscriptions(userId: string): void {
        this.subscriptionLimits.delete(userId);
    }

    /**
     * Get user's subscribed symbols
     */
    getUserSubscriptions(userId: string): string[] {
        const subs = this.subscriptionLimits.get(userId);
        return subs ? Array.from(subs) : [];
    }

    /**
     * Clean up expired entries
     */
    cleanup(): void {
        const now = Date.now();

        // Clean minute limits
        for (const [key, entry] of this.tradeMinuteLimits.entries()) {
            if (entry.resetAt <= now) {
                this.tradeMinuteLimits.delete(key);
            }
        }

        // Clean hour limits
        for (const [key, entry] of this.tradeHourLimits.entries()) {
            if (entry.resetAt <= now) {
                this.tradeHourLimits.delete(key);
            }
        }
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            activeMinuteLimits: this.tradeMinuteLimits.size,
            activeHourLimits: this.tradeHourLimits.size,
            activeSubscriptions: this.subscriptionLimits.size,
            totalSubscriptions: Array.from(this.subscriptionLimits.values())
                .reduce((sum, set) => sum + set.size, 0),
        };
    }
}

export const rateLimiter = new RateLimiter();

// Clean up expired entries every minute
setInterval(() => {
    rateLimiter.cleanup();
}, 60000);
