/**
 * Structured Logging Service
 * Provides consistent logging across the application
 */

enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
}

interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    context?: Record<string, any>;
    userId?: string;
    tradeId?: string;
    error?: any;
}

class Logger {
    private logLevel: LogLevel;

    constructor() {
        const level = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
        this.logLevel = LogLevel[level as keyof typeof LogLevel] || LogLevel.INFO;
    }

    private log(level: LogLevel, levelName: string, message: string, context?: Record<string, any>): void {
        if (level > this.logLevel) return;

        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: levelName,
            message,
            ...context,
        };

        const output = JSON.stringify(entry);

        switch (level) {
            case LogLevel.ERROR:
                console.error(output);
                break;
            case LogLevel.WARN:
                console.warn(output);
                break;
            default:
                console.log(output);
        }
    }

    error(message: string, error?: any, context?: Record<string, any>): void {
        this.log(LogLevel.ERROR, 'ERROR', message, {
            ...context,
            error: error?.message || error,
            stack: error?.stack,
        });
    }

    warn(message: string, context?: Record<string, any>): void {
        this.log(LogLevel.WARN, 'WARN', message, context);
    }

    info(message: string, context?: Record<string, any>): void {
        this.log(LogLevel.INFO, 'INFO', message, context);
    }

    debug(message: string, context?: Record<string, any>): void {
        this.log(LogLevel.DEBUG, 'DEBUG', message, context);
    }

    // Specialized logging methods
    tradeEvent(event: string, tradeData: Record<string, any>): void {
        this.info(`Trade ${event}`, {
            event: `trade_${event}`,
            ...tradeData,
        });
    }

    priceUpdate(symbol: string, price: number, source: string): void {
        this.debug('Price update', {
            event: 'price_update',
            symbol,
            price,
            source,
        });
    }

    wsEvent(event: string, details: Record<string, any>): void {
        this.debug(`WebSocket ${event}`, {
            event: `ws_${event}`,
            ...details,
        });
    }

    securityEvent(event: string, details: Record<string, any>): void {
        this.warn(`Security: ${event}`, {
            event: `security_${event}`,
            ...details,
        });
    }

    performanceMetric(metric: string, value: number, unit: string): void {
        this.info(`Performance: ${metric}`, {
            event: 'performance',
            metric,
            value,
            unit,
        });
    }
}

export const logger = new Logger();
