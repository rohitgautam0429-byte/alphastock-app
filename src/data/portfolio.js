// Portfolio allocation, basket construction, regime detection, rebalancing
// AlphaBasket — 50/30/20 Large/Mid/Small allocation per spec

import { scoreAllStocks } from './scoring';

// ══════ MASTER ALLOCATION (Equity Only — per AlphaBasket spec) ══════
export const masterAllocation = {
  largeCap: 50,
  midCap: 30,
  smallCap: 20,
};

// ══════ MARKET REGIMES ══════
export const regimes = {
  bull: { name: 'Bull Market', emoji: '🟢', color: '#10B981', equity: 90, cash: 10, triggers: 'Nifty > 200 DMA, VIX < 15, FII buying' },
  neutral: { name: 'Neutral / Sideways', emoji: '🟡', color: '#F5C518', equity: 80, cash: 20, triggers: 'Nifty near 200 DMA, VIX 15–20' },
  bear: { name: 'Bear Market', emoji: '🔴', color: '#EF4444', equity: 60, cash: 40, triggers: 'Nifty < 200 DMA, VIX > 20, FII selling' },
  crisis: { name: 'Crisis / Black Swan', emoji: '⚫', color: '#6B7280', equity: 40, cash: 60, triggers: 'VIX > 30, circuit breakers, macro shock' },
};

// Detect current regime from market data
export function detectRegime(vix, niftyAbove200dma, fiiFlow) {
  if (vix > 30) return regimes.crisis;
  if (vix > 20 || !niftyAbove200dma) return regimes.bear;
  if (vix < 15 && niftyAbove200dma && fiiFlow > 0) return regimes.bull;
  return regimes.neutral;
}

// ══════ BASKET CONSTRUCTION ══════
function getYearWeekKey(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date - start) / (24 * 60 * 60 * 1000)) + 1;
  return `${date.getFullYear()}-W${Math.ceil((dayOfYear + start.getDay()) / 7)}`;
}

function getStableStockSeed(id = '') {
  return [...id].reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 3), 0);
}

function getWeeklyRotationScore(stock, weekKey) {
  const weekSeed = [...weekKey].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return ((getStableStockSeed(stock.id) + weekSeed * 7) % 11) - 3;
}

function getLiveMomentumScore(pct) {
  if (Number.isNaN(pct) || pct == null) return 0;
  if (pct >= 5) return 14;
  if (pct >= 3) return 10;
  if (pct >= 1.5) return 6;
  if (pct >= 0.5) return 3;
  if (pct <= -5) return -18;
  if (pct <= -3) return -12;
  if (pct <= -1.5) return -6;
  return 0;
}

export function constructBasket(stocks, livePrices = {}) {
  const scoredStocks = scoreAllStocks(stocks);
  const rotationKey = getYearWeekKey();
  const refreshedAt = new Date();

  // Apply Live Momentum to base scores & Re-Rank
  scoredStocks.forEach(stock => {
    const liveData = livePrices[stock.id];
    const pct = liveData?.changePercent ?? stock.change;
    
    const baseScore = stock.score.total;
    const momentumBoost = getLiveMomentumScore(pct);
    const weeklyRotationBoost = getWeeklyRotationScore(stock, rotationKey);
    const riskPenalty = (pct ?? 0) <= -4 || (stock.rsi || 50) > 82 || (stock.rsi || 50) < 24 ? 8 : 0;

    stock.score.total += momentumBoost + weeklyRotationBoost - riskPenalty;
    stock.score.total = Math.max(10, Math.min(99, stock.score.total));
    stock.score.baseTotal = baseScore;
    stock.score.liveMomentumScore = momentumBoost;
    stock.score.weeklyRotationScore = weeklyRotationBoost;
    
    // Add dynamic reasons
    if (!stock.dynamicReasons) stock.dynamicReasons = [];
    if (weeklyRotationBoost >= 5) stock.dynamicReasons.push('Weekly rotation candidate');
    if (pct >= 2) stock.dynamicReasons.push('Strong daily momentum');
    if (momentumBoost >= 10) stock.dynamicReasons.push('Momentum breakout pick');
    if (pct >= 2) stock.dynamicReasons.push('Strong Daily Momentum 🚀');
    if (momentumBoost >= 15) stock.dynamicReasons.push('Momentum Breakout Pick 🔥');
    if (pct <= -3) stock.dynamicReasons.push('Selloff Avoidance');
    if (riskPenalty) stock.dynamicReasons.push('Risk-adjusted review');
  });

  // Sort by highest AI score to dynamically construct the best daily portfolio
  scoredStocks.sort((a, b) => b.score.total - a.score.total);

  // Filter: minimum composite score of 50 to qualify
  const qualified = scoredStocks.filter(s => s.score.total >= 50);

  // Select top active stocks: 5 Large, 3 Mid, 2 Small (Exactly 10 for focused basket)
  const large = qualified.filter(s => s.capSize === 'Large').slice(0, 5);
  const mid = qualified.filter(s => s.capSize === 'Mid').slice(0, 3);
  const small = qualified.filter(s => s.capSize === 'Small').slice(0, 2);

  // Weight assignment within sub-category
  const assignWeights = (list, totalWeight, maxWeight) => {
    const totalScore = list.reduce((sum, s) => sum + s.score.total, 0);
    return list.map(s => {
      let weight = totalScore > 0 ? (s.score.total / totalScore) * totalWeight : 0;
      weight = Math.min(weight, maxWeight);
      // Apply live price if available
      const live = livePrices[s.id];
      const currentPrice = live?.price || s.price;
      const currentChange = live?.changePercent ?? s.change;
      
      // Calculate buy zone (±2% from current price)
      const buyZoneLow = Math.round(currentPrice * 0.98 * 100) / 100;
      const buyZoneHigh = Math.round(currentPrice * 1.02 * 100) / 100;
      
      const reasons = getSelectionReason(s);
      if (s.dynamicReasons) reasons.unshift(...s.dynamicReasons);

      return {
        ...s,
        weight: Math.round(weight * 100) / 100,
        livePrice: currentPrice,
        liveChange: currentChange,
        buyZoneLow,
        buyZoneHigh,
        reasons,
      };
    });
  };

  const equityBasket = [
    ...assignWeights(large, masterAllocation.largeCap, 12),
    ...assignWeights(mid, masterAllocation.midCap, 8),
    ...assignWeights(small, masterAllocation.smallCap, 6),
  ];
  const selectedIds = new Set(equityBasket.map(stock => stock.id));

  return {
    equityBasket,
    leaderboard: qualified,
    reserves: qualified.filter(stock => !selectedIds.has(stock.id)).slice(0, 8),
    metadata: {
      rotationKey,
      refreshedAtLabel: refreshedAt.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
      nextReviewLabel: getNextMondayReviewLabel(),
      policy: 'Weekly rotation + live momentum + early risk triggers',
    },
  };
}

// ══════ DRIFT DETECTION ══════
export function calculateDrift(currentWeights, targetWeights) {
  const drifts = [];
  for (const key in targetWeights) {
    const current = currentWeights[key] || 0;
    const target = targetWeights[key];
    const drift = current - target;
    drifts.push({ asset: key, current, target, drift, needsRebalance: Math.abs(drift) > 5 });
  }
  return drifts;
}

function getNextMondayReviewLabel() {
  const date = new Date();
  const day = date.getDay();
  const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7 || 1;
  date.setDate(date.getDate() + daysUntilMonday);
  date.setHours(7, 0, 0, 0);
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) + ' at 7:00 AM';
}

export function getRebalanceSignal(equityBasket = []) {
  const allocationRows = [
    { key: 'Large', label: 'Large Cap', target: masterAllocation.largeCap },
    { key: 'Mid', label: 'Mid Cap', target: masterAllocation.midCap },
    { key: 'Small', label: 'Small Cap', target: masterAllocation.smallCap },
  ].map(row => {
    const current = equityBasket
      .filter(stock => stock.capSize === row.key)
      .reduce((sum, stock) => sum + (stock.weight || 0), 0);

    return {
      ...row,
      current: Math.round(current * 10) / 10,
      ok: Math.abs(current - row.target) <= 5,
    };
  });

  const earlyTriggers = equityBasket.flatMap(stock => {
    const triggers = [];
    if ((stock.score?.total || 0) < 60) triggers.push(`${stock.id}: score below 60`);
    if ((stock.liveChange ?? stock.change ?? 0) <= -4) triggers.push(`${stock.id}: price shock over 4%`);
    if ((stock.rsi || 50) > 78) triggers.push(`${stock.id}: overheated RSI`);
    if ((stock.rsi || 50) < 28) triggers.push(`${stock.id}: oversold RSI`);
    if ((stock.debtEquity || 0) > 1.5 && stock.capSize !== 'Large') triggers.push(`${stock.id}: debt risk`);
    if ((stock.roe || 0) < 8) triggers.push(`${stock.id}: weak ROE`);
    return triggers;
  });

  const driftCount = allocationRows.filter(row => !row.ok).length;
  const needsRebalance = driftCount > 0 || earlyTriggers.length > 0;
  const healthScore = Math.max(55, 96 - driftCount * 12 - Math.min(earlyTriggers.length, 5) * 5);

  return {
    allocationRows,
    earlyTriggers,
    needsRebalance,
    healthScore,
    nextReviewLabel: getNextMondayReviewLabel(),
    message: needsRebalance
      ? `Review early: ${earlyTriggers[0] || 'allocation drift is above the allowed band'}.`
      : 'No emergency rebalance. Basket will still be reviewed weekly and after material stock-level changes.',
  };
}

// ══════ REBALANCING RULES ══════
export const rebalancingRules = [
  { condition: 'Any stock score drops below 60', action: 'Remove from basket, replace with next highest scorer' },
  { condition: 'Weekly rebalance cycle', action: 'Refresh fundamentals, technical scores, drift, and watchlist replacements every Monday pre-market' },
  { condition: 'Major earnings miss (score drop > 15pts)', action: 'Immediate basket re-evaluation' },
  { condition: 'Single-stock fall greater than 4% or RSI moves outside 28-78', action: 'Run early technical risk review before the weekly cycle' },
  { condition: 'Debt, ROE, margin, or promoter-quality deterioration', action: 'Run early fundamental review and reduce/remove weak names' },
  { condition: 'Sector downgrade by AI', action: 'Reduce allocation to affected sector stocks' },
  { condition: 'Any allocation drifts > ±5% from target', action: 'Auto-alert for rebalancing' },
];

export const rebalancingCalendar = [
  { frequency: 'Weekly', action: 'Full basket review every Monday pre-market' },
  { frequency: 'Monthly', action: 'Full score recalculation, regime check' },
  { frequency: 'Quarterly', action: 'Deep rebalancing — replace underperformers' },
  { frequency: 'Event-driven', action: 'Earnings miss, price shock, RSI extremes, RBI policy, Budget, OPEC, US Fed -> early reassessment' },
];

// ══════ WHY SELECTED REASONING ══════
export function getSelectionReason(item) {
  if (item.score) {
    const s = item.score;
    const reasons = [];
    if (s.breakdown) {
      const bd = s.breakdown;
      if (bd.financials >= 17) reasons.push('Strong financials');
      if (bd.momentum >= 13) reasons.push('Positive momentum');
      if (bd.valuation >= 12) reasons.push('Attractive valuation');
      if (bd.management >= 13) reasons.push('Quality management');
      if (bd.sectorOutlook >= 9) reasons.push('High-growth sector');
      if (bd.newsSentiment >= 7) reasons.push('Bullish news sentiment');
    }
    if (reasons.length === 0) reasons.push('Diversification benefit');
    return reasons;
  }
  return ['Portfolio diversification'];
}

// ══════ STRESS TEST SCENARIOS ══════
export const stressScenarios = [
  { id: '2008_crash', name: '2008 Financial Crisis', equityImpact: -55, description: 'Global banking collapse, Lehman Brothers, credit freeze' },
  { id: 'covid_2020', name: 'COVID-19 Crash (Mar 2020)', equityImpact: -38, description: 'Pandemic lockdown, market circuit breakers, oil price war' },
  { id: 'taper_2013', name: '2013 Taper Tantrum', equityImpact: -18, description: 'US Fed tapering announcement, rupee depreciation, FII outflows' },
  { id: 'rate_hike', name: 'Aggressive Rate Hike Cycle', equityImpact: -12, description: 'RBI raises rates 200bps, bond yields spike, PE compression' },
  { id: 'china_shock', name: 'China Slowdown Contagion', equityImpact: -15, description: 'China GDP slows to 3%, commodity crash, EM outflows' },
];

// ══════ XIRR CALCULATION ══════
export function calculateXIRR(transactions) {
  // Simplified XIRR approximation
  if (!transactions || transactions.length < 2) return 0;
  const firstDate = new Date(transactions[transactions.length - 1].date);
  const lastDate = new Date(transactions[0].date);
  const years = (lastDate - firstDate) / (365.25 * 24 * 60 * 60 * 1000);
  if (years <= 0) return 0;
  
  const totalInvested = transactions.filter(t => t.type === 'BUY').reduce((s, t) => s + t.amount, 0);
  const totalSold = transactions.filter(t => t.type === 'SELL').reduce((s, t) => s + t.amount, 0);
  const currentValue = totalInvested - totalSold; // simplified
  
  return totalInvested > 0 ? ((currentValue / totalInvested) ** (1 / years) - 1) * 100 : 0;
}

// ══════ VIRTUAL PORTFOLIO STATE ══════
export function getVirtualPortfolio() {
  try {
    const data = localStorage.getItem('ab_virtual_portfolio');
    if (data) return JSON.parse(data);
  } catch (e) {
    console.warn('Could not read virtual portfolio from local storage', e);
  }
  return {
    capital: 1000000,
    holdings: [],
    transactions: []
  };
}

export function saveVirtualPortfolio(data) {
  try {
    localStorage.setItem('ab_virtual_portfolio', JSON.stringify(data));
  } catch (e) {
    console.warn('Could not save virtual portfolio to local storage', e);
  }
}
