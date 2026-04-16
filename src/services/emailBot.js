import nodemailer from 'nodemailer';
import cron from 'node-cron';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { stocks } from '../data/stocks.js';
import { calculateEquityScore } from '../data/scoring.js';
import { evaluateAdvancedSwingScore } from './quantEngine.js';

dotenv.config();

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

export const generateEmailContent = async () => {
  const history = loadHistory();
  const now = Date.now();
  const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

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

  // Apply exclusionary rotative penalties
  scoredStocks = scoredStocks.map(stock => {
    let penalty = 0;
    const sentData = history[stock.id];
    
    if (sentData && (now - sentData.timestamp) < THREE_DAYS) {
      if (stock.score.total < 90) {
        penalty = 25; // Block recent stocks unless highly favourable
      }
    }
    
    stock.finalRankScore = stock.score.total - penalty;
    return stock;
  });

  // Sort again by final penalized score
  scoredStocks.sort((a, b) => b.finalRankScore - a.finalRankScore);
  const topStocks = scoredStocks.slice(0, 5);

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
    history[stock.id] = { timestamp: now, score: stock.score.total };
  });
  saveHistory(history);

  let htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="background-color: #0f172a; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #38bdf8; margin: 0;">AlphaBasket Swing Radar</h1>
        <p style="color: #94a3b8; font-size: 14px; margin-top: 5px;">High-Probability Short Term Setups</p>
      </div>
      
      <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; margin-bottom: 24px;">The AI has rotated out previously sent tickers and identified the top Swing Trade setups primed for breakout based on Moving Average crossovers, optimal RSI entry zones, and high micro-momentum:</p>
  `;

  topStocks.forEach((stock, idx) => {
    const { total, breakdown } = stock.score;
    // Highlight factors with high scores
    const keyDrivers = Object.entries(breakdown)
      .sort((a, b) => b[1] - a[1]) // Sort factors by highest score
      .slice(0, 3) // Take top 3 factors driving the score
      .map(([key, _]) => key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim())
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
  const emailTo = process.env.EMAIL_TO || process.env.EMAIL_USER;
  
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
    subject: `Top 5 Stock Recommendations — ${dateStr}`,
    html: htmlContent,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ [${new Date().toLocaleTimeString()}] Daily stock report successfully sent to: ${emailTo} (MessageId: ${info.messageId})`);
  } catch (error) {
    console.error(`❌ [${new Date().toLocaleTimeString()}] FAILED to send daily report:`, error.message);
  }
};

// Schedule it to run every day at 07:00 AM IST (UTC+5:30 = 01:30 UTC)
export const startEmailBotScheduler = () => {
  // Set flag so quantEngine routes API calls through localhost:4000 internally
  process.env.SERVER_INTERNAL = 'true';
  
  console.log("🕒 Email Bot Scheduler Started: Reports will send daily at 7:00 AM IST (pre-market)");
  
  // '30 1 * * *' = 01:30 UTC = 07:00 AM IST (UTC+5:30)
  cron.schedule('30 1 * * 1-5', () => {
    console.log("⏱️ Cron Triggered [7:00 AM IST]: Starting pre-market stock analysis...");
    runDailyJob();
  });
};
