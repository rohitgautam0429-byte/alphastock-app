// Multi-factor scoring engine — Equities (6 pillars) + Commodities (3 factors)
// Pillars: Valuation, Financials, Momentum, Management, Sector Outlook, News Sentiment

// ══════ EQUITY SCORING (100 points total) ══════

function scoreValuation(stock) {
  // 18 points max — lower PE/PB = higher score
  let score = 0;
  if (stock.pe > 0 && stock.pe < 15) score += 7;
  else if (stock.pe >= 15 && stock.pe < 25) score += 5;
  else if (stock.pe >= 25 && stock.pe < 40) score += 3;
  else if (stock.pe >= 40 && stock.pe < 80) score += 2;
  else score += 1;

  if (stock.pb < 2) score += 5;
  else if (stock.pb < 5) score += 4;
  else if (stock.pb < 10) score += 3;
  else score += 1;

  const earningsYield = stock.pe > 0 ? (1 / stock.pe) * 100 : 0;
  if (earningsYield > 8) score += 6;
  else if (earningsYield > 5) score += 4;
  else if (earningsYield > 3) score += 2;
  else score += 1;

  return Math.min(score, 18);
}

function scoreFinancials(stock) {
  // 22 points max
  let score = 0;
  if (stock.roe > 25) score += 5;
  else if (stock.roe > 18) score += 4;
  else if (stock.roe > 12) score += 3;
  else score += 1;

  if (stock.roce > 25) score += 5;
  else if (stock.roce > 18) score += 4;
  else if (stock.roce > 12) score += 2;
  else score += 1;

  if (stock.debtEquity < 0.1) score += 4;
  else if (stock.debtEquity < 0.5) score += 3;
  else if (stock.debtEquity < 1) score += 2;
  else if (stock.debtEquity < 2) score += 1;
  else score += 0;

  if (stock.revenueCagr3y > 30) score += 4;
  else if (stock.revenueCagr3y > 20) score += 3;
  else if (stock.revenueCagr3y > 15) score += 2;
  else if (stock.revenueCagr3y > 10) score += 1;
  else score += 0;

  if (stock.ebitdaMargin > 30) score += 4;
  else if (stock.ebitdaMargin > 20) score += 3;
  else if (stock.ebitdaMargin > 15) score += 2;
  else score += 1;

  return Math.min(score, 22);
}

function scoreMomentum(stock) {
  // 18 points max
  let score = 0;
  if (stock.rsi >= 40 && stock.rsi <= 70) score += 7;
  else if (stock.rsi > 70) score += 4;
  else score += 3;

  if (stock.above200dma) score += 5;
  else score += 2;

  const returns = stock.historicalReturns;
  if (returns['3m'] > 15) score += 6;
  else if (returns['3m'] > 8) score += 4;
  else if (returns['3m'] > 0) score += 3;
  else score += 1;

  return Math.min(score, 18);
}

function scoreManagement(stock) {
  // 18 points max
  let score = 0;
  if (stock.promoterHolding > 60) score += 7;
  else if (stock.promoterHolding > 50) score += 5;
  else if (stock.promoterHolding > 30) score += 4;
  else score += 2;

  if (stock.analystRating >= 4.5) score += 6;
  else if (stock.analystRating >= 4.0) score += 5;
  else if (stock.analystRating >= 3.5) score += 3;
  else score += 1;

  if (stock.fcf > 10000) score += 5;
  else if (stock.fcf > 2000) score += 4;
  else if (stock.fcf > 0) score += 2;
  else score += 1;

  return Math.min(score, 18);
}

function scoreSectorOutlook(stock) {
  // 14 points max
  const highGrowthSectors = ['Defence', 'Electronics', 'Renewables', 'Capital Goods', 'Infrastructure', 'Auto Components'];
  const steadySectors = ['Banking', 'IT', 'Pharma', 'Energy', 'NBFC', 'Auto', 'Telecom'];
  const matureSectors = ['FMCG', 'Consumer', 'Metals', 'Conglomerate'];

  let score = 0;
  if (highGrowthSectors.includes(stock.sector)) score += 9;
  else if (steadySectors.includes(stock.sector)) score += 6;
  else if (matureSectors.includes(stock.sector)) score += 4;
  else score += 5;

  const ret1y = stock.historicalReturns['1y'];
  if (ret1y > 50) score += 5;
  else if (ret1y > 25) score += 4;
  else if (ret1y > 10) score += 3;
  else score += 1;

  return Math.min(score, 14);
}

function scoreNewsSentiment(stock) {
  // 10 points max — derived from analyst rating, recent returns, RSI momentum
  // Simulates news sentiment: strong analyst + positive returns = bullish news cycle
  let score = 0;
  
  // Analyst consensus as proxy for news sentiment
  if (stock.analystRating >= 4.5) score += 4;
  else if (stock.analystRating >= 4.0) score += 3;
  else if (stock.analystRating >= 3.5) score += 2;
  else score += 1;

  // Recent momentum as proxy for news-driven buying
  const ret1m = stock.historicalReturns['1m'];
  if (ret1m > 8) score += 3;
  else if (ret1m > 4) score += 2;
  else if (ret1m > 0) score += 1;
  else score += 0;

  // RSI-based sentiment — RSI 50-70 is bullish news range
  if (stock.rsi >= 50 && stock.rsi <= 70) score += 3;
  else if (stock.rsi > 70) score += 2; // overbought, mixed news
  else if (stock.rsi >= 40) score += 1;
  else score += 0;

  return Math.min(score, 10);
}

export function calculateEquityScore(stock) {
  const valuation = scoreValuation(stock);
  const financials = scoreFinancials(stock);
  const momentum = scoreMomentum(stock);
  const management = scoreManagement(stock);
  const sectorOutlook = scoreSectorOutlook(stock);
  const newsSentiment = scoreNewsSentiment(stock);
  const total = valuation + financials + momentum + management + sectorOutlook + newsSentiment;

  return {
    total,
    breakdown: { valuation, financials, momentum, management, sectorOutlook, newsSentiment },
    maxScores: { valuation: 18, financials: 22, momentum: 18, management: 18, sectorOutlook: 14, newsSentiment: 10 },
    grade: total >= 75 ? 'A+' : total >= 65 ? 'A' : total >= 55 ? 'B+' : total >= 45 ? 'B' : total >= 35 ? 'C' : 'D',
  };
}

// ══════ COMMODITY SCORING (100 points total) ══════

export function calculateCommodityScore(commodity) {
  const momentum = commodity.momentum || 50;
  const macroSignal = commodity.macroSignal || 50;
  const seasonalFactor = commodity.seasonalFactor || 50;

  // Weighted: Momentum 40%, Macro 35%, Seasonal 25%
  const total = Math.round(momentum * 0.4 + macroSignal * 0.35 + seasonalFactor * 0.25);

  return {
    total,
    breakdown: { momentum, macroSignal, seasonalFactor },
    weights: { momentum: 40, macroSignal: 35, seasonalFactor: 25 },
    grade: total >= 75 ? 'A+' : total >= 65 ? 'A' : total >= 55 ? 'B+' : total >= 45 ? 'B' : total >= 35 ? 'C' : 'D',
  };
}

export function calculateSwingScore(stock) {
  let score = 0;
  let breakdown = { momentum: 0, trendMA: 0, priceAction: 0, sentiment: 0 };
  
  // 1. RSI Optimization (30 pts) — 50-65 is algorithmic sweet spot for rapid momentum
  if (stock.rsi >= 50 && stock.rsi <= 65) breakdown.momentum += 30;
  else if (stock.rsi > 65 && stock.rsi <= 75) breakdown.momentum += 20;
  else if (stock.rsi > 75) breakdown.momentum += 8; // High risk of imminent pullback
  else if (stock.rsi <= 35 && stock.rsi > 10) breakdown.momentum += 25; // Oversold sharp reversal bounce
  else breakdown.momentum += 10;
  
  // 2. Trend & Short-term MA tracking (30 pts)
  const history = stock.priceHistory;
  if (history && history.length >= 10) {
    const prices = history.slice(-10);
    const ma5 = prices.slice(-5).reduce((a,b)=>a+b,0)/5;
    const ma10 = prices.reduce((a,b)=>a+b,0)/10;
    const currentPrice = prices[prices.length-1];
    
    if (ma5 > ma10) breakdown.trendMA += 15; // Golden cross on short timeframe
    if (currentPrice > ma5) breakdown.trendMA += 15; // Riding above immediate support
    else if (currentPrice > ma10) breakdown.trendMA += 5; 
  } else {
    // fallback
    if (stock.above200dma) breakdown.trendMA += 20;
  }
  
  // 3. Price Action Patterns (20 pts)
  if (history && history.length >= 3) {
    const p1 = history[history.length-1];
    const p2 = history[history.length-2];
    const p3 = history[history.length-3];
    
    // Higher Highs & Higher Lows forming
    if (p1 > p2 && p2 > p3) breakdown.priceAction += 20; 
    else if (p1 > p2) breakdown.priceAction += 10; 
  }
  
  // 4. Short-Term Confirmation & Sentiment (20 pts)
  if (stock.analystRating >= 4.2) breakdown.sentiment += 10;
  else if (stock.analystRating >= 3.8) breakdown.sentiment += 5;
  
  const ret1m = stock.historicalReturns['1m'];
  if (ret1m > 1 && ret1m < 12) breakdown.sentiment += 10; // Catching exactly out of base growth
  else if (ret1m >= 12) breakdown.sentiment += 4; // Approaching exhaustion zone
  
  const total = breakdown.momentum + breakdown.trendMA + breakdown.priceAction + breakdown.sentiment;
  
  return {
    total,
    breakdown,
    type: 'swing'
  };
}

export function scoreSwingStocks(stocks) {
  return stocks.map(stock => ({
    ...stock,
    score: calculateSwingScore(stock),
  })).sort((a, b) => b.score.total - a.score.total);
}

// Score all stocks and return sorted
export function scoreAllStocks(stocks) {
  return stocks.map(stock => ({
    ...stock,
    score: calculateEquityScore(stock),
  })).sort((a, b) => b.score.total - a.score.total);
}

export function scoreAllCommodities(commodities) {
  return commodities.map(commodity => ({
    ...commodity,
    score: calculateCommodityScore(commodity),
  })).sort((a, b) => b.score.total - a.score.total);
}
