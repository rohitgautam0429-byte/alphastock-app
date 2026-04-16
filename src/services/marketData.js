// Real-time market data service
// Primary: Groww API (NSE/BSE stocks in INR)
// Fallback: Yahoo Finance v8 Chart API (with USD→INR conversion for commodities)

import { useState, useEffect, useCallback } from 'react';

// ══════ CONSTANTS ══════
const USD_INR_RATE_DEFAULT = 84.0;
let cachedUsdInrRate = USD_INR_RATE_DEFAULT;

// ══════ CORE FETCH ══════

async function fetchJSON(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Fetch failed:', url, err.message);
    return null;
  }
}

// ══════ USD→INR RATE (fetch once and cache) ══════

async function fetchUsdInrRate() {
  try {
    const data = await fetchJSON(`/api/yahoo-chart/USDINR=X?interval=1d&range=1d&includePrePost=true`);
    if (data?.chart?.result?.[0]?.meta?.regularMarketPrice) {
      cachedUsdInrRate = data.chart.result[0].meta.regularMarketPrice;
    }
  } catch (err) {
    console.warn('USD/INR fetch failed, using default:', cachedUsdInrRate);
  }
  return cachedUsdInrRate;
}

// Initialize rate on module load
fetchUsdInrRate();

// ══════ GROWW API — NSE Stock Price ══════

async function fetchGrowwStockPrice(symbol) {
  try {
    const isBSE = symbol.endsWith('.BO');
    const exchange = isBSE ? 'BSE' : 'NSE';
    const cleanSymbol = symbol.replace('.NS', '').replace('.BO', '');
    
    // Groww API endpoint for latest price
    const data = await fetchJSON(`/api/groww-stocks/accord_points/exchange/${exchange}/segment/CASH/latest_prices_ohlc/${cleanSymbol}`);
    
    if (data && data.ltp != null) {
      return {
        symbol: cleanSymbol + (isBSE ? '.BO' : '.NS'),
        price: data.ltp || 0,
        previousClose: data.close || data.ltp || 0,
        change: (data.ltp || 0) - (data.close || data.ltp || 0),
        changePercent: data.close ? (((data.ltp - data.close) / data.close) * 100) : 0,
        dayHigh: data.dayHigh || data.high,
        dayLow: data.dayLow || data.low,
        volume: data.volume,
        name: data.companyName || cleanSymbol,
        currency: 'INR',
        exchange: exchange,
        source: 'groww',
      };
    }
    return null;
  } catch (error) {
    console.warn(`Groww fetch error for ${symbol}:`, error.message);
    return null;
  }
}

// ══════ YAHOO FINANCE — Price Extraction (always convert to INR) ══════

function extractPriceFromChart(chartData, forceINR = true) {
  if (!chartData?.chart?.result?.[0]) return null;
  const result = chartData.chart.result[0];
  const meta = result.meta;
  
  let price = meta.regularMarketPrice ?? 0;
  let previousClose = meta.previousClose ?? meta.chartPreviousClose ?? 0;
  const isUSD = meta.currency === 'USD';
  
  // Convert USD prices to INR
  if (isUSD && forceINR) {
    price = price * cachedUsdInrRate;
    previousClose = previousClose * cachedUsdInrRate;
  }

  const change = price - previousClose;
  const changePercent = previousClose ? ((change / previousClose) * 100) : 0;

  return {
    symbol: meta.symbol,
    price,
    previousClose,
    change,
    changePercent,
    dayHigh: isUSD && forceINR ? (meta.regularMarketDayHigh || 0) * cachedUsdInrRate : meta.regularMarketDayHigh,
    dayLow: isUSD && forceINR ? (meta.regularMarketDayLow || 0) * cachedUsdInrRate : meta.regularMarketDayLow,
    volume: meta.regularMarketVolume,
    name: meta.shortName || meta.longName || meta.symbol,
    currency: 'INR',
    marketState: meta.marketState,
    exchange: meta.exchangeName,
    originalCurrency: meta.currency,
    usdInrRate: isUSD ? cachedUsdInrRate : null,
    source: 'yahoo',
  };
}

// Fetch single stock price — tries Groww first, then Yahoo
async function fetchSingleQuote(symbol) {
  // For Indian stocks (NSE/BSE), try Groww first
  const isIndian = symbol.endsWith('.NS') || symbol.endsWith('.BO') || (!symbol.includes('=') && !symbol.includes('^'));
  
  if (isIndian) {
    const growwData = await fetchGrowwStockPrice(symbol);
    if (growwData) return growwData;
  }
  
  // Fallback to Yahoo Finance (with INR conversion)
  const data = await fetchJSON(`/api/yahoo-chart/${symbol}?interval=1d&range=1d&includePrePost=true`);
  return extractPriceFromChart(data, true);
}

// Fetch multiple stock prices (parallel batches)
async function fetchBatchQuotes(symbols) {
  const results = {};
  const batchSize = 5;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const promises = batch.map(async (sym) => {
      const quote = await fetchSingleQuote(sym);
      if (quote) results[sym] = quote;
    });
    await Promise.all(promises);
    if (i + batchSize < symbols.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  return results;
}

// ══════ MARKET INDICES ══════

const INDEX_SYMBOLS = {
  '^NSEI': 'NIFTY 50',
  '^BSESN': 'SENSEX',
  '^NSEBANK': 'NIFTY BANK',
  '^INDIAVIX': 'INDIA VIX',
};

export async function fetchMarketIndices() {
  const symbols = Object.keys(INDEX_SYMBOLS);
  const results = {};
  
  for (const sym of symbols) {
    const data = await fetchJSON(`/api/yahoo-chart/${sym}?interval=1d&range=1d&includePrePost=true`);
    const quote = extractPriceFromChart(data, false); // Indices are already in INR
    if (quote) results[sym] = quote;
  }
  
  if (Object.keys(results).length === 0) return null;
  
  const indices = {};
  for (const [sym, quote] of Object.entries(results)) {
    indices[sym] = {
      name: INDEX_SYMBOLS[sym] || quote.name,
      value: quote.price,
      change: quote.change,
      changePercent: quote.changePercent,
      marketState: quote.marketState,
    };
  }
  return indices;
}

// ══════ COMMODITY PRICES (Always in INR) ══════

// Commodity map using reliable ETF/futures tickers
// GLD ETF = ~1/10 oz gold per share (exact ratio: 0.0965844 oz/share as of 2024)
// SLV ETF = ~1 oz silver per share
// CL=F = crude oil futures USD/barrel
// NG=F = natural gas futures USD/mmBtu
// HG=F = copper futures USD/lb
const COMMODITY_MAP = {
  'GLD':  { name: 'Gold',        unit: '10g',    conversion: (usd) => (usd / 0.0965844 / 31.1035) * 10 },
  'SLV':  { name: 'Silver',      unit: '1 kg',   conversion: (usd) => (usd / 31.1035) * 1000 },
  'CL=F': { name: 'Crude Oil',   unit: 'barrel', conversion: (usd) => usd },
  'NG=F': { name: 'Natural Gas', unit: 'mmBtu',  conversion: (usd) => usd },
  'HG=F': { name: 'Copper',      unit: 'kg',     conversion: (usd) => usd / 0.453592 },
};

export async function fetchCommodityPrices() {
  const currencyResults = {};
  const yahooSymbols = Object.keys(COMMODITY_MAP);

  for (const sym of yahooSymbols) {
    try {
      const data = await fetchJSON(`/api/yahoo-chart/${sym}?interval=1d&range=1d&includePrePost=true`);
      if (data?.chart?.result?.[0]) {
        const meta = data.chart.result[0].meta;
        const usdPrice   = meta.regularMarketPrice ?? 0;
        const prevClose  = meta.previousClose ?? meta.chartPreviousClose ?? 0;
        const info = COMMODITY_MAP[sym];

        const inrPrice    = info.conversion(usdPrice)  * cachedUsdInrRate;
        const inrPrevClose = info.conversion(prevClose) * cachedUsdInrRate;
        const change    = inrPrice - inrPrevClose;
        const changePct = inrPrevClose ? ((change / inrPrevClose) * 100) : 0;

        currencyResults[sym] = {
          name: info.name,
          symbol: sym,
          unit: info.unit,
          price: inrPrice,
          change,
          changePercent: changePct,
          currency: 'INR',
          source: 'yahoo',
        };
      }
    } catch (e) {
      console.warn(`Commodity fetch failed for ${sym}:`, e.message);
    }
  }

  return Object.keys(currencyResults).length > 0 ? currencyResults : null;
}

// ══════ FOREX / CURRENCY RATES ══════

const FOREX_PAIRS = [
  { symbol: 'USDINR=X', label: 'USD / INR', flag: '🇺🇸' },
  { symbol: 'EURINR=X', label: 'EUR / INR', flag: '🇪🇺' },
  { symbol: 'GBPINR=X', label: 'GBP / INR', flag: '🇬🇧' },
  { symbol: 'JPYINR=X', label: 'JPY / INR', flag: '🇯🇵' },
];

export async function fetchCurrencyRates() {
  const results = [];
  for (const pair of FOREX_PAIRS) {
    try {
      const data = await fetchJSON(`/api/yahoo-chart/${pair.symbol}?interval=1d&range=1d&includePrePost=true`);
      if (data?.chart?.result?.[0]) {
        const meta = data.chart.result[0].meta;
        const price      = meta.regularMarketPrice ?? 0;
        const prevClose  = meta.previousClose ?? meta.chartPreviousClose ?? price;
        const change     = price - prevClose;
        const changePct  = prevClose ? ((change / prevClose) * 100) : 0;
        results.push({
          symbol: pair.symbol,
          label:  pair.label,
          flag:   pair.flag,
          price,
          change,
          changePercent: changePct,
          isUp: changePct >= 0,
        });
      }
    } catch (e) {
      console.warn(`Forex fetch failed for ${pair.symbol}:`, e.message);
    }
  }
  return results;
}

// ══════ NSE STOCK SYMBOLS ══════

export const NSE_SYMBOL_MAP = {
  'RELIANCE': 'RELIANCE.NS',
  'TCS': 'TCS.NS',
  'HDFCBANK': 'HDFCBANK.NS',
  'INFY': 'INFY.NS',
  'ICICIBANK': 'ICICIBANK.NS',
  'BHARTIARTL': 'BHARTIARTL.NS',
  'SBIN': 'SBIN.NS',
  'LT': 'LT.NS',
  'HINDUNILVR': 'HINDUNILVR.NS',
  'SUNPHARMA': 'SUNPHARMA.NS',
  'BAJFINANCE': 'BAJFINANCE.NS',
  'MARUTI': 'MARUTI.NS',
  'HAL': 'HAL.NS',
  'TATASTEEL': 'TATASTEEL.NS',
  'NTPC': 'NTPC.NS',
  'TITAN': 'TITAN.NS',
  'WIPRO': 'WIPRO.NS',
  'ADANIENT': 'ADANIENT.NS',
  'BEL': 'BEL.NS',
  'COALINDIA': 'COALINDIA.NS',
  'TATAMOTORS': 'TMPV.NS',
  'ITC': 'ITC.NS',
  'DIXON': 'DIXON.NS',
  'PERSISTENT': 'PERSISTENT.NS',
  'SUZLON': 'SUZLON.NS',
  'TRENT': 'TRENT.NS',
  'CUMMINSIND': 'CUMMINSIND.NS',
  'PIIND': 'PIIND.NS',
  'SONACOMS': 'SONACOMS.NS',
  'DELHIVERY': 'DELHIVERY.NS',
  'CGPOWER': 'CGPOWER.NS',
  'POLYCAB': 'POLYCAB.NS',
  'HINDALCO': 'HINDALCO.NS',
  'VEDL': 'VEDL.NS',
  'OLECTRA': 'OLECTRA.NS',
  'APLAPOLLO': 'APLAPOLLO.NS',
  'KPITTECH': 'KPITTECH.NS',
  'KAYNES': 'KAYNES.NS',
  'PARAS': 'PARAS.NS',
  'KAVERISEED': 'KSCL.NS',
  'DEEPAKNITRITE': 'DEEPAKNTR.NS',
  'SYRMA': 'SYRMA.NS',
  'CESC': 'CESC.NS',
  'IEX': 'IEX.NS',
  'KNRCON': 'KNRCON.NS',
};

// ══════ REACT HOOKS ══════

export function useMarketIndices(refreshInterval = 30000) {
  const [indices, setIndices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const data = await fetchMarketIndices();
      if (data && Object.keys(data).length > 0) {
        setIndices(data);
        setLastUpdated(new Date());
        setError(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, refreshInterval);
    return () => clearInterval(timer);
  }, [fetchData, refreshInterval]);

  return { indices, loading, error, lastUpdated, refetch: fetchData };
}

export function useStockPrices(stockIds, refreshInterval = 60000) {
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async () => {
    if (!stockIds || stockIds.length === 0) return;
    try {
      const symbols = stockIds
        .map(id => NSE_SYMBOL_MAP[id])
        .filter(Boolean);

      if (symbols.length === 0) return;

      const allResults = await fetchBatchQuotes(symbols);

      // Map back to stock IDs
      const priceMap = {};
      for (const [id, sym] of Object.entries(NSE_SYMBOL_MAP)) {
        if (allResults[sym]) {
          priceMap[id] = allResults[sym];
        }
      }

      if (Object.keys(priceMap).length > 0) {
        setPrices(priceMap);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.warn('Stock price fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [stockIds]);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, refreshInterval);
    return () => clearInterval(timer);
  }, [fetchData, refreshInterval]);

  return { prices, loading, lastUpdated, refetch: fetchData };
}

export function useCommodityPrices(refreshInterval = 60000) {
  const [commodities, setCommodities] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const data = await fetchCommodityPrices();
      if (data && Object.keys(data).length > 0) {
        setCommodities(data);
      }
    } catch (err) {
      console.warn('Commodity fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, refreshInterval);
    return () => clearInterval(timer);
  }, [fetchData, refreshInterval]);

  return { commodities, loading, refetch: fetchData };
}

export function useCurrencyRates(refreshInterval = 60000) {
  const [rates, setRates]   = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const data = await fetchCurrencyRates();
      if (data && data.length > 0) setRates(data);
    } catch (err) {
      console.warn('Currency rates fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, refreshInterval);
    return () => clearInterval(timer);
  }, [fetchData, refreshInterval]);

  return { rates, loading, refetch: fetchData };
}

// Hook for fetching historical chart data (with INR conversion)
export function useStockHistory(symbol, range = '1mo', interval = '1d') {
  const [history, setHistory] = useState([]);
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchHistory() {
      if (!symbol) return;
      setLoading(true);
      try {
        // For NSE/BSE stocks, try Groww first for real-time price
        const isIndianStock = symbol.endsWith('.NS') || symbol.endsWith('.BO');
        let growwQuote = null;
        if (isIndianStock) {
          try {
            growwQuote = await fetchGrowwStockPrice(symbol);
          } catch (e) {
            console.warn('Groww live price fetch ignored in chart hook', e);
          }
        }

        // Use Groww quote if available, otherwise convert Yahoo data to INR
        let finalQuote = growwQuote;
        let chartData = [];
        
        try {
          const data = await fetchJSON(`/api/yahoo-chart/${symbol}?interval=${interval}&range=${range}&includePrePost=true`);
          if (data?.chart?.result?.[0]) {
            const result = data.chart.result[0];
            const meta = result.meta;
            const isUSD = meta.currency === 'USD';
            const conversionRate = isUSD ? cachedUsdInrRate : 1;
            
            let yahooQuote = extractPriceFromChart(data, true);
            let conversionScale = 1;
            if (COMMODITY_MAP[symbol]) {
              conversionScale = COMMODITY_MAP[symbol].conversion(1);
              yahooQuote.price *= conversionScale;
              yahooQuote.previousClose *= conversionScale;
              yahooQuote.change = yahooQuote.price - yahooQuote.previousClose;
              yahooQuote.dayHigh *= conversionScale;
              yahooQuote.dayLow *= conversionScale;
              yahooQuote.name = COMMODITY_MAP[symbol].name;
              yahooQuote.unit = COMMODITY_MAP[symbol].unit;
            }
            if (!finalQuote) finalQuote = yahooQuote;
            
            const timestamps = result.timestamp || [];
            const closePrices = result.indicators?.quote?.[0]?.close || [];
            const volumes = result.indicators?.quote?.[0]?.volume || [];
            
            for (let i = 0; i < timestamps.length; i++) {
              if (closePrices[i] !== null) {
                chartData.push({
                  time: new Date(timestamps[i] * 1000).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
                  price: closePrices[i] * conversionRate * conversionScale,
                  volume: volumes[i],
                });
              }
            }
          }
        } catch (yahooErr) {
          console.warn('Yahoo chart fetch failed:', yahooErr);
          // If we have a Groww quote, we can still render the page without the historical chart!
          if (!finalQuote) {
             throw new Error('Yahoo and Groww APIs both failed');
          }
        }

        setQuote(finalQuote);
        
        // If Yahoo failed but we have Groww, generate a flat pseudo-chart so visual components don't crash
        if (chartData.length === 0 && finalQuote) {
           chartData = [
             { time: '1M Ago', price: finalQuote.previousClose, volume: 0 },
             { time: 'Live', price: finalQuote.price, volume: finalQuote.volume || 0 }
           ];
        }
        
        setHistory(chartData);
        setError(null);
      } catch (err) {
        console.warn('Complete History block failure:', err);
        setError('Failed to fetch chart data');
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [symbol, range, interval]);

  return { history, quote, loading, error };
}

// ══════ MARKET STATUS HELPER ══════

export function getMarketStatus() {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const day = ist.getDay();
  const hours = ist.getHours();
  const minutes = ist.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  if (day === 0 || day === 6) {
    return { isOpen: false, status: 'Closed', statusText: 'Weekend' };
  }
  if (timeInMinutes >= 540 && timeInMinutes < 555) {
    return { isOpen: false, status: 'Pre-Market', statusText: 'Opens at 9:15 AM' };
  }
  if (timeInMinutes >= 555 && timeInMinutes <= 930) {
    return { isOpen: true, status: 'Market Open', statusText: 'Live Trading' };
  }
  if (timeInMinutes > 930 && timeInMinutes < 1080) {
    return { isOpen: false, status: 'Closed', statusText: 'After Hours' };
  }
  return { isOpen: false, status: 'Closed', statusText: 'Pre-Market' };
}
