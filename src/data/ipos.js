export const fallbackIpos = [
  {
    id: 'BAGMANE_PRIME_OFFICE_REIT',
    name: 'Bagmane Prime Office REIT',
    sector: 'Mainboard REIT',
    type: 'Mainboard',
    statusType: 'open',
    issuePrice: 'Rs 95 - 100',
    lotSize: '150',
    openDate: '05 May 2026',
    closeDate: '07 May 2026',
    listingDate: '15 May 2026',
    gmp: '+4',
    gmpPercent: 4,
    subscriptionStatus: 'Around 1.8x subscribed',
    source: 'Groww / Moneycontrol',
  },
  {
    id: 'RECODE_STUDIOS',
    name: 'Recode Studios',
    sector: 'SME - Beauty & Personal Care',
    type: 'SME',
    statusType: 'open',
    issuePrice: 'Rs 150 - 158',
    lotSize: '800',
    openDate: '05 May 2026',
    closeDate: '07 May 2026',
    listingDate: '12 May 2026',
    gmp: '+44',
    gmpPercent: 27.9,
    subscriptionStatus: 'Around 31x subscribed',
    source: 'Groww / IPO Cracker',
  },
  {
    id: 'SIMCA_ADVERTISING',
    name: 'Simca Advertising',
    sector: 'SME - Advertising',
    type: 'SME',
    statusType: 'upcoming',
    issuePrice: 'Rs 174 - 183',
    lotSize: '600',
    openDate: '08 May 2026',
    closeDate: '12 May 2026',
    listingDate: '15 May 2026',
    gmp: 'TBA',
    gmpPercent: 0,
    subscriptionStatus: 'Pre-apply / opens 08 May',
    source: 'Groww / Upstox',
  },
];

export function inferIpoStatus(ipo) {
  const statusText = `${ipo.statusType || ''} ${ipo.subscriptionStatus || ''} ${ipo.openDate || ''}`.toLowerCase();
  if (statusText.includes('closed') || statusText.includes('listed')) return 'closed';
  if (statusText.includes('upcoming') || statusText.includes('pre-apply') || statusText.includes('opens')) return 'upcoming';
  if (statusText.includes('open') || statusText.includes('close') || statusText.includes('subscribed')) return 'open';
  return ipo.statusType || 'open';
}

export function gradeIpo(ipo) {
  const gmpPercent = Number.isFinite(Number(ipo.gmpPercent)) ? Number(ipo.gmpPercent) : 0;
  const subMatch = `${ipo.subscriptionStatus || ''}`.match(/([\d.]+)\s*x/i);
  const subscriptionX = subMatch ? Number(subMatch[1]) : 0;
  const statusType = inferIpoStatus(ipo);
  const isSME = `${ipo.type || ipo.sector || ''}`.toLowerCase().includes('sme');

  let aiScore = 45;
  aiScore += Math.min(35, gmpPercent * 0.8);
  aiScore += Math.min(18, subscriptionX * 0.55);
  if (statusType === 'upcoming') aiScore = Math.max(55, aiScore - 8);
  if (isSME) aiScore -= 5;
  aiScore = Math.max(25, Math.min(96, Math.round(aiScore)));

  let aiRecommendation = 'WATCHLIST';
  let recommendationTone = 'info';
  let reasoning = 'Track subscription quality, GMP trend, and listing risk before applying.';

  if (statusType === 'upcoming') {
    aiRecommendation = 'WATCHLIST';
    reasoning = 'Upcoming issue. Wait for Day 1 subscription and GMP confirmation before applying.';
  } else if (aiScore >= 78) {
    aiRecommendation = isSME ? 'APPLY - HIGH RISK' : 'APPLY';
    recommendationTone = 'buy';
    reasoning = isSME
      ? 'Strong GMP and demand, but SME IPOs can be volatile. Suitable only for higher-risk capital.'
      : 'Healthy demand and GMP support a positive listing setup.';
  } else if (aiScore >= 58) {
    aiRecommendation = 'SELECTIVE APPLY';
    recommendationTone = 'info';
    reasoning = 'Demand is acceptable, but listing gains do not look decisive. Prefer conservative sizing.';
  } else {
    aiRecommendation = 'AVOID / WAIT';
    recommendationTone = 'sell';
    reasoning = 'Weak or missing GMP/subscription signals. Wait for better demand visibility.';
  }

  return {
    ...ipo,
    statusType,
    gmpPercent,
    subscriptionX,
    aiScore,
    aiRecommendation,
    recommendationTone,
    reasoning,
  };
}

export function gradeIpos(ipos = []) {
  return ipos.map(gradeIpo);
}
