import { MACD, BollingerBands, EMA, Stochastic, ATR, RSI, ADX, OBV } from 'technicalindicators';

// Probability helper: maps a value to a 0-1 score asymptotically
// (e.g., if MACD histogram is huge, score approaches 1, but never crosses it)
function asymptoticScore(value, scale) {
  return (2 / (1 + Math.exp(-value / scale))) - 1;
}

// Route through our own Express proxy to avoid rate-limiting & CORS issues.
// In dev mode (Vite), the proxy is at localhost:5173/api/...
// In server mode (node server.js), we call localhost:4000/api/...
const API_BASE = process.env.SERVER_INTERNAL
  ? 'http://localhost:4000'
  : (typeof window !== 'undefined' ? '' : 'http://localhost:4000');

export async function fetchLiveCandles(symbol) {
  // Use .NS suffix for NSE stocks; strip existing suffix first
  const cleanSymbol = symbol.replace(/\.(NS|BO)$/, '');
  const yahooSymbol = `${cleanSymbol}.NS`;
  const url = `${API_BASE}/api/yahoo-chart/${yahooSymbol}?interval=1d&range=3mo&includePrePost=false`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.chart?.result?.[0];
    if (!result) return null;
    
    const indicators = result.indicators?.quote?.[0] || {};
    return {
      close: indicators.close || [],
      high: indicators.high || [],
      low: indicators.low || [],
      volume: indicators.volume || []
    };
  } catch (e) {
    console.error(`Fetch failed for ${symbol}: ${e.message}`);
    return null;
  }
}

export async function evaluateAdvancedSwingScore(stock) {
  let scoreObj = {
    total: 0,
    breakdown: { trend: 0, momentum: 0, volatility: 0, oscillator: 0, volume: 0 }
  };
  
  const candles = await fetchLiveCandles(stock.id);
  if (!candles || candles.close.length < 30) {
    scoreObj.total = 30; // Fallback
    return scoreObj;
  }

  // Filter out nulls
  const validClose = candles.close.filter(c => c !== null);
  const validHigh = candles.high.filter(c => c !== null);
  const validLow = candles.low.filter(c => c !== null);
  const validVol = candles.volume.filter(c => c !== null);
  
  if (validClose.length < 30) return scoreObj;

  const currentPrice = validClose[validClose.length - 1];

  // 1. TREND (EMA Crossovers + ADX) -> Max 25 pts
  let trendScore = 0;
  try {
    const ema9 = EMA.calculate({ period: 9, values: validClose });
    const ema21 = EMA.calculate({ period: 21, values: validClose });
    const currentEma9 = ema9[ema9.length - 1];
    const currentEma21 = ema21[ema21.length - 1];
    
    if (currentEma9 > currentEma21) {
      const spreadPct = ((currentEma9 - currentEma21) / currentEma21) * 100;
      trendScore = 6 + (9 * asymptoticScore(Math.max(0, spreadPct), 4));
    } else {
      trendScore = 2; 
    }

    // ADX integration for Trend Strength confirmation (Scale 10 pts)
    const adxData = ADX.calculate({ high: validHigh, low: validLow, close: validClose, period: 14 });
    const currentADX = adxData.length > 0 ? adxData[adxData.length - 1].adx : 0;
    if (currentADX > 25) trendScore += 10; // Strong trend
    else if (currentADX > 20) trendScore += 5; // Developing trend
  } catch(e) {}
  scoreObj.breakdown.trend = parseFloat(trendScore.toFixed(2));

  // 2. MOMENTUM (MACD + RSI) -> Max 30 pts
  let momentumScore = 0;
  try {
    const macdSeries = MACD.calculate({ fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false, values: validClose });
    if (macdSeries.length > 0) {
      const currentMacd = macdSeries[macdSeries.length - 1];
      const prevMacd = macdSeries[macdSeries.length - 2] || currentMacd;
      const hist = currentMacd.histogram;
      const prevHist = prevMacd.histogram;
      
      if (hist > 0) {
        momentumScore += 10;
        if (hist > prevHist) momentumScore += 10 * asymptoticScore(hist, currentPrice * 0.01);
      } else if (hist < 0 && hist > prevHist) {
        momentumScore += 8;
      } else {
         momentumScore += 2;
      }
    }
    
    // RSI integration (Scale 10 pts)
    const rsiData = RSI.calculate({ period: 14, values: validClose });
    const currentRSI = rsiData.length > 0 ? rsiData[rsiData.length - 1] : 50;
    if (currentRSI >= 50 && currentRSI <= 68) momentumScore += 10; // Sweet breakout spot
    else if (currentRSI < 35 && currentRSI > 1) momentumScore += 8; // Deep oversold reversal
  } catch (e) { /* ignore */ }
  scoreObj.breakdown.momentum = parseFloat(momentumScore.toFixed(2));

  // 3. VOLATILITY (Bollinger Bands %B Breakout) -> Max 15 pts
  let volScore = 0;
  try {
    const bb = BollingerBands.calculate({ period: 20, stdDev: 2, values: validClose });
    if (bb.length > 0) {
      const currentBB = bb[bb.length - 1];
      const pctB = (currentPrice - currentBB.lower) / (currentBB.upper - currentBB.lower);
      
      if (pctB >= 0.5 && pctB <= 0.85) volScore = 15 + (0 * (1 - Math.abs(pctB - 0.7) * 2)); // normalized out to max 15
      else if (pctB > 0.85) volScore = 8;
      else if (pctB < 0.2) volScore = 12;
      else volScore = 5;
      volScore = Math.min(volScore, 15);
    }
  } catch (e) { /* ignore */ }
  scoreObj.breakdown.volatility = parseFloat(volScore.toFixed(2));

  // 4. OSCILLATOR (Stochastic) -> Max 15 pts
  let oscScore = 0;
  try {
    const stoch = Stochastic.calculate({ high: validHigh, low: validLow, close: validClose, period: 14, signalPeriod: 3 });
    if (stoch.length > 0) {
      const currentStoch = stoch[stoch.length - 1];
      const k = currentStoch.k;
      const d = currentStoch.d;
      
      if (k > d && k < 40 && d < 40) oscScore = 15; 
      else if (k > d && k >= 40 && k <= 80) oscScore = 10; 
      else if (k > 80) oscScore = 3; 
      else oscScore = 5;
    }
  } catch (e) { /* ignore */ }
  scoreObj.breakdown.oscillator = parseFloat(oscScore.toFixed(2));

  // 5. VOLUME (OBV Accumulation) -> Max 15 pts
  let volAccScore = 0;
  try {
    if (validVol.length >= validClose.length) {
       const obvData = OBV.calculate({ close: validClose, volume: validVol });
       if (obvData.length > 5) {
          const currentOBV = obvData[obvData.length - 1];
          const prevOBV5 = obvData[obvData.length - 5];
          if (currentOBV > prevOBV5) volAccScore = 15; // Positive accumulation over last week
          else volAccScore = 4; // Distribution phase
       }
    }
  } catch(e) {}
  scoreObj.breakdown.volume = parseFloat(volAccScore.toFixed(2));

  scoreObj.total = parseFloat((trendScore + momentumScore + volScore + oscScore + volAccScore).toFixed(2));
  
  // TARGET CALCULATION (Dynamic Short Term & Long Term)
  let shortTermTarget = currentPrice * 1.04;
  let longTermTarget = currentPrice * 1.12; 
  try {
    const atrSeries = ATR.calculate({ high: validHigh, low: validLow, close: validClose, period: 14 });
    if (atrSeries.length > 0) {
      const currentATR = atrSeries[atrSeries.length - 1];
      shortTermTarget = currentPrice + (currentATR * 1.5);
      const threeMonthHigh = Math.max(...validHigh);
      if (currentPrice >= threeMonthHigh * 0.98) {
         longTermTarget = currentPrice + (currentATR * 4);
      } else {
         longTermTarget = Math.max(threeMonthHigh, currentPrice + (currentATR * 2.5));
      }
    }
  } catch(e) {}

  scoreObj.targets = {
    shortTerm: parseFloat(shortTermTarget.toFixed(1)),
    longTerm: parseFloat(longTermTarget.toFixed(1))
  };
  scoreObj.livePrice = parseFloat(currentPrice.toFixed(1));
  
  return scoreObj;
}
