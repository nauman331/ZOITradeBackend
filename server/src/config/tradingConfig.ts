/**
 * Trading Configuration
 * Centralized configuration for all trading parameters
 * Following Quotex-like binary options platform standards
 */

export const TRADING_CONFIG = {
    // Stake Limits
    STAKE: {
        MIN: parseFloat(process.env.MIN_STAKE || '1'),
        MAX: parseFloat(process.env.MAX_STAKE || '10000'),
        DEFAULT: parseFloat(process.env.DEFAULT_STAKE || '10'),
    },

    // Expiry Duration Limits (in milliseconds)
    EXPIRY: {
        MIN: parseInt(process.env.MIN_EXPIRY || '60000'), // 1 minute
        MAX: parseInt(process.env.MAX_EXPIRY || '3600000'), // 1 hour
        ALLOWED_DURATIONS: [
            60000,      // 1 min
            120000,     // 2 min
            300000,     // 5 min
            900000,     // 15 min
            1800000,    // 30 min
            3600000,    // 1 hour
        ],
    },

    // Payout Configuration
    PAYOUT: {
        RATIO: parseFloat(process.env.PLATFORM_PAYOUT_RATIO || '0.85'), // 85% payout
        MIN_RATIO: 0.7,
        MAX_RATIO: 0.95,
    },

    // Price & Slippage
    PRICE: {
        MAX_SLIPPAGE_PERCENT: parseFloat(process.env.MAX_SLIPPAGE || '0.5'), // 0.5%
        CACHE_STALE_THRESHOLD: 60000, // 60 seconds
        PRICE_PRECISION: 8, // Decimal places
    },

    // Rate Limiting
    RATE_LIMITS: {
        TRADES_PER_MINUTE: parseInt(process.env.TRADES_PER_MINUTE || '10'),
        TRADES_PER_HOUR: parseInt(process.env.TRADES_PER_HOUR || '100'),
        MAX_CONCURRENT_TRADES: parseInt(process.env.MAX_CONCURRENT_TRADES || '20'),
        WEBSOCKET_SUBSCRIPTIONS_PER_USER: parseInt(process.env.MAX_SUBSCRIPTIONS || '10'),
    },

    // Balance & Account
    BALANCE: {
        MIN_BALANCE_TO_TRADE: parseFloat(process.env.MIN_BALANCE || '1'),
        MAX_BALANCE_RISK_PER_TRADE: parseFloat(process.env.MAX_RISK || '0.2'), // 20% of balance
        DEMO_INITIAL_BALANCE: parseFloat(process.env.DEMO_BALANCE || '10000'),
    },

    // Trade Settlement
    SETTLEMENT: {
        CHECK_INTERVAL: '*/10 * * * * *', // Every 10 seconds
        BATCH_SIZE: parseInt(process.env.SETTLEMENT_BATCH_SIZE || '100'),
        RETRY_ATTEMPTS: parseInt(process.env.SETTLEMENT_RETRIES || '3'),
        RETRY_DELAY: 5000, // 5 seconds
    },

    // WebSocket Configuration
    WEBSOCKET: {
        PING_INTERVAL: 30000, // 30 seconds
        PING_TIMEOUT: 5000,
        MAX_RECONNECT_ATTEMPTS: 5,
        RECONNECT_DELAY: 5000,
    },

    // Supported Assets
    SUPPORTED_ASSETS: [
        'btcusdt',
        'ethusdt',
        'bnbusdt',
        'xrpusdt',
        'adausdt',
        'dogeusdt',
        'solusdt',
        'dotusdt',
        'maticusdt',
        'ltcusdt',
        'linkusdt',
        'uniusdt',
        'avaxusdt',
    ] as const,

    // Risk Management
    RISK: {
        MAX_DAILY_LOSS_PER_USER: parseFloat(process.env.MAX_DAILY_LOSS || '5000'),
        MAX_DAILY_WIN_PER_USER: parseFloat(process.env.MAX_DAILY_WIN || '50000'),
        CIRCUIT_BREAKER_THRESHOLD: 100, // Pause trading after X consecutive losses
        PRICE_CHANGE_ALERT_THRESHOLD: 0.1, // 10% price change
    },

    // KYC & Verification
    KYC: {
        WITHDRAWAL_THRESHOLD: parseFloat(process.env.KYC_THRESHOLD || '1000'),
        DAILY_WITHDRAWAL_LIMIT_UNVERIFIED: parseFloat(process.env.UNVERIFIED_WITHDRAWAL || '100'),
        DAILY_WITHDRAWAL_LIMIT_VERIFIED: parseFloat(process.env.VERIFIED_WITHDRAWAL || '50000'),
    },

    // Maintenance & System
    SYSTEM: {
        MAINTENANCE_MODE: process.env.MAINTENANCE_MODE === 'true',
        ENABLE_DEMO_TRADING: process.env.ENABLE_DEMO !== 'false',
        LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    },
} as const;

// Asset validation helper
export function isValidAsset(asset: string): boolean {
    return TRADING_CONFIG.SUPPORTED_ASSETS.includes(asset.toLowerCase() as any);
}

// Expiry validation helper
export function isValidExpiry(duration: number): boolean {
    return (
        duration >= TRADING_CONFIG.EXPIRY.MIN &&
        duration <= TRADING_CONFIG.EXPIRY.MAX &&
        TRADING_CONFIG.EXPIRY.ALLOWED_DURATIONS.includes(duration as any)
    );
}

// Stake validation helper
export function isValidStake(amount: number, userBalance?: number): { valid: boolean; reason?: string } {
    if (amount < TRADING_CONFIG.STAKE.MIN) {
        return { valid: false, reason: `Minimum stake is $${TRADING_CONFIG.STAKE.MIN}` };
    }
    if (amount > TRADING_CONFIG.STAKE.MAX) {
        return { valid: false, reason: `Maximum stake is $${TRADING_CONFIG.STAKE.MAX}` };
    }
    if (userBalance && amount > userBalance) {
        return { valid: false, reason: 'Insufficient balance' };
    }
    if (userBalance && amount > userBalance * TRADING_CONFIG.BALANCE.MAX_BALANCE_RISK_PER_TRADE) {
        return { valid: false, reason: `Cannot risk more than ${TRADING_CONFIG.BALANCE.MAX_BALANCE_RISK_PER_TRADE * 100}% of balance per trade` };
    }
    return { valid: true };
}

export type SupportedAsset = typeof TRADING_CONFIG.SUPPORTED_ASSETS[number];
