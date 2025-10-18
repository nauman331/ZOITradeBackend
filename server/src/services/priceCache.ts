/**
 * Price Cache Service
 * Stores real-time prices from Binance WebSocket for instant trade execution
 */

interface PriceData {
    price: number;
    timestamp: number;
}

class PriceCache {
    private cache: Map<string, PriceData> = new Map();
    private readonly STALE_THRESHOLD = 60000; // 60 seconds

    /**
     * Update price in cache (called by WebSocket)
     */
    updatePrice(symbol: string, price: number): void {
        const normalizedSymbol = symbol.toLowerCase();
        this.cache.set(normalizedSymbol, {
            price,
            timestamp: Date.now()
        });
    }

    /**
     * Get cached price with staleness check
     */
    getPrice(symbol: string): number | null {
        const normalizedSymbol = symbol.toLowerCase();
        const data = this.cache.get(normalizedSymbol);

        if (!data) {
            return null;
        }

        // Check if price is stale
        const age = Date.now() - data.timestamp;
        if (age > this.STALE_THRESHOLD) {
            console.warn(`⚠️ Price for ${symbol} is stale (${age}ms old)`);
            return null;
        }

        return data.price;
    }

    /**
     * Check if we have a recent price
     */
    hasRecentPrice(symbol: string): boolean {
        return this.getPrice(symbol) !== null;
    }

    /**
     * Get all cached symbols
     */
    getCachedSymbols(): string[] {
        return Array.from(this.cache.keys());
    }

    /**
     * Clear stale prices
     */
    clearStale(): void {
        const now = Date.now();
        for (const [symbol, data] of this.cache.entries()) {
            if (now - data.timestamp > this.STALE_THRESHOLD) {
                this.cache.delete(symbol);
                console.log(`🗑️ Cleared stale price for ${symbol}`);
            }
        }
    }
}

export const priceCache = new PriceCache();

// Clean stale prices every 30 seconds
setInterval(() => {
    priceCache.clearStale();
}, 30000);
