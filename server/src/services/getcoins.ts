import { priceCache } from "./priceCache";

/**
 * Get current price for a symbol
 * Priority: 1. Cached Binance price, 2. Binance REST API, 3. CoinGecko fallback
 */
export const getCoinPrice = async (symbol: string): Promise<number> => {
    // Try cached price first (from WebSocket)
    const cachedPrice = priceCache.getPrice(symbol);
    if (cachedPrice) {
        console.log(`✅ Using cached Binance price for ${symbol}: $${cachedPrice}`);
        return cachedPrice;
    }

    // Fallback 1: Binance REST API
    try {
        const binanceSymbol = symbol.toUpperCase().replace('USDT', ''); // e.g., btcusdt -> BTC
        const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}USDT`);
        const data = await response.json();

        if (data.price) {
            const price = parseFloat(data.price);
            // Update cache for future use
            priceCache.updatePrice(symbol, price);
            console.log(`📊 Using Binance REST API for ${symbol}: $${price}`);
            return price;
        }
    } catch (error) {
        console.warn(`⚠️ Binance API failed for ${symbol}:`, error);
    }

    // Fallback 2: CoinGecko (last resort)
    try {
        const coinGeckoId = mapSymbolToCoinGeckoId(symbol);
        const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoId}&vs_currencies=usd`);
        const data = await response.json();
        const price = data[coinGeckoId]?.usd;

        if (price) {
            console.log(`🦎 Using CoinGecko fallback for ${symbol}: $${price}`);
            return price;
        }
    } catch (error) {
        console.error(`❌ CoinGecko failed for ${symbol}:`, error);
    }

    throw new Error(`Unable to fetch price for ${symbol} from any source`);
};

/**
 * Map trading symbols to CoinGecko IDs
 */
function mapSymbolToCoinGeckoId(symbol: string): string {
    const symbolMap: Record<string, string> = {
        'btcusdt': 'bitcoin',
        'ethusdt': 'ethereum',
        'bnbusdt': 'binancecoin',
        'xrpusdt': 'ripple',
        'adausdt': 'cardano',
        'dogeusdt': 'dogecoin',
        'solusdt': 'solana',
        'dotusdt': 'polkadot',
        'maticusdt': 'matic-network',
        'ltcusdt': 'litecoin',
    };

    return symbolMap[symbol.toLowerCase()] || symbol.toLowerCase().replace('usdt', '');
}