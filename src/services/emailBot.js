/* global process */
import nodemailer from 'nodemailer';
import cron from 'node-cron';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { stocks } from '../data/stocks.js';
import { calculateEquityScore } from '../data/scoring.js';
import { evaluateAdvancedSwingScore } from './quantEngine.js';

dotenv.config();

const DEFAULT_EMAIL_TO = 'rameshchand1858@gmail.com';
const DAY_MS = 24 * 60 * 60 * 1000;
const SHORT_TERM_COOLDOWN_MS = 7 * DAY_MS;
const LONG_TERM_COOLDOWN_MS = 14 * DAY_MS;
const HIGH_CONVICTION_SHORT_SCORE = 88;
const HIGH_CONVICTION_LONG_SCORE = 82;

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const HISTORY_FILE = path.join(process.cwd(), 'src', 'data', 'sentHistory.json');

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to load sent history', e);
  }
  return {};
}

function saveHistory(history) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (e) {
    console.error('Failed to save sent history', e);
  }
}

function getHistoryEntry(history, stockId, bucket) {
  const entry = history[stockId];
  if (!entry || typeof entry !== 'object') return null;
  return entry[bucket] || entry;
}

function getRotationStatus(history, stockId, bucket, now, cooldownMs, score, highConvictionScore) {
  const entry = getHistoryEntry(history, stockId, bucket);
  const timestamp = entry?.timestamp || 0;
  const age = timestamp ? now - timestamp : Infinity;
  const isRecent = age < cooldownMs;
  const daysLeft = isRecent ? Math.ceil((cooldownMs - age) / DAY_MS) : 0;
  const highConviction = score >= highConvictionScore;

  return {
    isRecent,
    daysLeft,
    highConviction,
    penalty: isRecent && !highConviction ? 55 + daysLeft * 2 : isRecent ? 8 : 0,
    label: isRecent
      ? highConviction
        ? `Repeated only because conviction stayed above ${highConvictionScore}/100. Cooldown left: ${daysLeft}d.`
        : `Recently mailed. Cooling down for ${daysLeft}d.`
      : 'Fresh idea: not mailed inside the cooldown window.',
  };
}

function pickRotatedStocks(candidates, count, bucket, cooldownMs, highConvictionScore, now, scoreGetter, history) {
  const ranked = candidates
    .map(stock => {
      const rawScore = scoreGetter(stock);
      const rotation = getRotationStatus(history, stock.id, bucket, now, cooldownMs, rawScore, highConvictionScore);
      return {
        ...stock,
        rotationStatus: rotation,
        finalRankScore: rawScore - rotation.penalty,
      };
    })
    .sort((a, b) => b.finalRankScore - a.finalRankScore);

  const preferred = ranked.filter(stock => !stock.rotationStatus.isRecent || stock.rotationStatus.highConviction);
  const picked = preferred.slice(0, count);

  if (picked.length < count) {
    const pickedIds = new Set(picked.map(stock => stock.id));
    picked.push(...ranked.filter(stock => !pickedIds.has(stock.id)).slice(0, count - picked.length));
  }

  return picked;
}

function markSent(history, stock, bucket, now, score) {
  const previous = history[stock.id] && typeof history[stock.id] === 'object' ? history[stock.id] : {};
  const previousBucket = previous[bucket] || {};
  history[stock.id] = {
    ...previous,
    [bucket]: {
      timestamp: now,
      score,
      sentCount: (previousBucket.sentCount || 0) + 1,
    },
    timestamp: now,
    score,
  };
}

export const generateEmailContent = async () => {
  const history = loadHistory();
  const now = Date.now();

  console.log('🛡️ Guillotine Filter Initiated: Assessing fundamentals...');
  
  // 1. CANSLIM Quality Filter
  const highQualityStocks = stocks.filter(stock => {
     const fundScore = calculateEquityScore(stock);
     
     // Automatic Rejection if Debt or FCF metrics strictly fail
     if (fundScore.breakdown.financials < 5) return false; 
     
     // Cap-Size Constraints
     if (stock.capSize === 'Small' || stock.capSize === 'Micro') {
        // Small Caps MUST be basically perfect fundamentally (>60)
        if (fundScore.total < 60) return false;
        if (stock.debtEquity > 0.5) return false;
        if (stock.roe < 15) return false;
        if (stock.promoterHolding < 50) return false;
     } else {
        // Mid/Large Caps (> 45 requirement)
        if (fundScore.total < 45) return false;
        if (stock.debtEquity > 1.5) return false;
     }
     
     return true;
  });

  console.log(`✅ ${highQualityStocks.length} stocks survived the fundamental guillotine filter.`);
  console.log('🤖 Quant Engine Initiated: Fetching live OHLC data for survivors...');
  
  let scoredStocks = [];
  // Process in small batches of 5 to avoid IP blocking
  for (let i = 0; i < highQualityStocks.length; i += 5) {
    const batch = highQualityStocks.slice(i, i + 5);
    const promises = batch.map(async (stock) => {
      const advancedScore = await evaluateAdvancedSwingScore(stock);
      return {
        ...stock,
        score: advancedScore
      };
    });
    const results = await Promise.all(promises);
    scoredStocks.push(...results);
  }

  const topStocks = pickRotatedStocks(
    scoredStocks,
    5,
    'shortTerm',
    SHORT_TERM_COOLDOWN_MS,
    HIGH_CONVICTION_SHORT_SCORE,
    now,
    stock => stock.score.total,
    history
  );

  const longTermCandidates = highQualityStocks
    .map(stock => {
      const longTermScore = calculateEquityScore(stock);
      return {
        ...stock,
        longTermScore,
        longTermRank:
          longTermScore.total +
          Math.max(0, stock.revenueCagr3y || 0) * 0.25 +
          Math.max(0, stock.roe || 0) * 0.2 +
          Math.max(0, stock.historicalReturns?.['1y'] || 0) * 0.12,
      };
    })
    .sort((a, b) => b.longTermRank - a.longTermRank);

  const longTermStocks = pickRotatedStocks(
    longTermCandidates,
    5,
    'longTerm',
    LONG_TERM_COOLDOWN_MS,
    HIGH_CONVICTION_LONG_SCORE,
    now,
    stock => stock.longTermScore.total,
    history
  );

  // Failsafe: if less than 1 survives, drop out
  if (topStocks.length === 0) {
     console.warn('⚠️ No stocks survived the dual-filter. Sending defensive mode email.');
     return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; text-align: center;">
        <h1 style="color: #ef4444;">Market Danger Warning</h1>
        <p>Zero stocks survived the CANSLIM funnel today. The AI advises holding massive cash positions defensively until setups form.</p>
      </div>`;
  }

  // Update history database
  topStocks.forEach(stock => {
    markSent(history, stock, 'shortTerm', now, stock.score.total);
  });
  longTermStocks.forEach(stock => {
    markSent(history, stock, 'longTerm', now, stock.longTermScore.total);
  });
  saveHistory(history);

  let htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="background-color: #0f172a; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #38bdf8; margin: 0;">AlphaBasket Daily Radar</h1>
        <p style="color: #94a3b8; font-size: 14px; margin-top: 5px;">Short-term and long-term stock recommendations</p>
      </div>
      
      <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; margin-bottom: 24px;">The AI has identified near-term momentum setups and durable long-term compounders based on fundamentals, trend strength, valuation quality, risk filters, and cooldown-aware rotation. Recently mailed stocks are skipped unless conviction is unusually high.</p>
        <h2 style="color:#0f172a; font-size:20px; margin:0 0 16px 0;">Short Term Ideas (1-12 weeks)</h2>
  `;

  topStocks.forEach((stock, idx) => {
    const { total, breakdown } = stock.score;
    // Highlight factors with high scores
    const keyDrivers = Object.entries(breakdown)
      .sort((a, b) => b[1] - a[1]) // Sort factors by highest score
      .slice(0, 3) // Take top 3 factors driving the score
      .map(([key]) => key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim())
      .join(', ');

    htmlContent += `
        <div style="margin-bottom: 24px; padding: 16px; background-color: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 4px;">
          <h2 style="margin: 0 0 8px 0; color: #1e293b; font-size: 18px;">
            ${idx + 1}. ${stock.name} (${stock.id})
          </h2>
          <div style="display: flex; gap: 10px; margin-bottom: 12px; font-size: 14px;">
            <span style="background-color: #dbeafe; color: #1d4ed8; padding: 4px 8px; border-radius: 4px; font-weight: bold;">Score: ${total.toFixed(1)}/100</span>
            <span style="background-color: #e2e8f0; color: #475569; padding: 4px 8px; border-radius: 4px;">${stock.sector}</span>
            <span style="background-color: #e2e8f0; color: #475569; padding: 4px 8px; border-radius: 4px;">₹${(stock.score.livePrice || stock.price).toLocaleString('en-IN')}</span>
          </div>
          <div style="display: flex; gap: 10px; margin-bottom: 12px; font-size: 13px;">
            <span style="border: 1px solid #10b981; color: #047857; padding: 2px 6px; border-radius: 4px;">🎯 ST Target: ₹${stock.score.targets?.shortTerm?.toLocaleString('en-IN') || 'N/A'}</span>
            <span style="border: 1px solid #8b5cf6; color: #5b21b6; padding: 2px 6px; border-radius: 4px;">📈 LT Target: ₹${stock.score.targets?.longTerm?.toLocaleString('en-IN') || 'N/A'}</span>
          </div>
          <p style="margin: 0; font-size: 14px; color: #64748b;">
            <strong>Key Growth Drivers:</strong> ${keyDrivers}
          </p>
          <p style="margin: 10px 0 0 0; font-size: 12px; color: #64748b;">
            <strong>Rotation:</strong> ${stock.rotationStatus?.label || 'Fresh idea.'}
          </p>
        </div>
    `;
  });

  htmlContent += `
        <h2 style="color:#0f172a; font-size:20px; margin:28px 0 16px 0;">Long Term Ideas (1 year+)</h2>
  `;

  longTermStocks.forEach((stock, idx) => {
    const score = stock.longTermScore;
    htmlContent += `
        <div style="margin-bottom: 18px; padding: 16px; background-color: #f0fdf4; border-left: 4px solid #10b981; border-radius: 4px;">
          <h2 style="margin: 0 0 8px 0; color: #14532d; font-size: 18px;">
            ${idx + 1}. ${stock.name} (${stock.id})
          </h2>
          <div style="display: flex; gap: 10px; margin-bottom: 12px; font-size: 14px; flex-wrap: wrap;">
            <span style="background-color: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 4px; font-weight: bold;">Quality Score: ${score.total.toFixed(1)}/100</span>
            <span style="background-color: #e2e8f0; color: #475569; padding: 4px 8px; border-radius: 4px;">ROE: ${stock.roe}%</span>
            <span style="background-color: #e2e8f0; color: #475569; padding: 4px 8px; border-radius: 4px;">3Y Revenue CAGR: ${stock.revenueCagr3y}%</span>
          </div>
          <p style="margin: 0; font-size: 14px; color: #475569;">
            Long-term thesis: strong financial quality, trend resilience, and sector positioning. Prefer staggered buying and review after quarterly results.
          </p>
          <p style="margin: 10px 0 0 0; font-size: 12px; color: #64748b;">
            <strong>Rotation:</strong> ${stock.rotationStatus?.label || 'Fresh idea.'}
          </p>
        </div>
    `;
  });

  htmlContent += `
      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 30px;">
        Disclaimer: This report is for educational purposes and is automatically generated by AlphaBasket algorithms. Please do your own research before trading.
      </p>
      </div>
    </div>
  `;

  return htmlContent;
};

export const runDailyJob = async (isTest = false) => {
  const emailTo = process.env.EMAIL_TO || DEFAULT_EMAIL_TO || process.env.EMAIL_USER;
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    if (isTest) {
       console.error("❌ ERROR: Email credentials totally missing. Please set EMAIL_USER and EMAIL_PASS in your .env file!");
    } else {
       console.warn("⚠️ Warning: Daily Email Bot is skipped because .env credentials are not configured properly.");
    }
    return;
  }

  const htmlContent = await generateEmailContent();
  const dateStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' });

  const mailOptions = {
    from: `"AlphaBasket AI" <${process.env.EMAIL_USER}>`,
    to: emailTo,
    subject: `AlphaBasket Daily Stock Recommendations - ${dateStr}`,
    html: htmlContent,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ [${new Date().toLocaleTimeString()}] Daily stock report successfully sent to: ${emailTo} (MessageId: ${info.messageId})`);
  } catch (error) {
    console.error(`❌ [${new Date().toLocaleTimeString()}] FAILED to send daily report:`, error.message);
  }
};

// Schedule it to run every day at 07:00 AM IST.
export const startEmailBotScheduler = () => {
  // Set flag so quantEngine routes API calls through localhost:4000 internally
  process.env.SERVER_INTERNAL = 'true';
  
  console.log(`Email Bot Scheduler Started: Reports will send daily at 7:00 AM IST to ${process.env.EMAIL_TO || DEFAULT_EMAIL_TO}`);
  
  cron.schedule('0 7 * * *', () => {
    console.log("Cron Triggered [7:00 AM IST]: Starting daily stock analysis...");
    runDailyJob();
  }, {
    timezone: 'Asia/Kolkata',
  });
};
