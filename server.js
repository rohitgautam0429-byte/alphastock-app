/* eslint-env node */
// AlphaBasket Production Server
// Serves static React app + proxies Yahoo Finance & Groww APIs
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import { startEmailBotScheduler } from './src/services/emailBot.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

// ── Startup .env Health Check ──
function checkEnvHealth() {
  const issues = [];
  if (!process.env.EMAIL_USER) issues.push('EMAIL_USER not set');
  if (!process.env.EMAIL_PASS) issues.push('EMAIL_PASS not set');
  if (!process.env.EMAIL_TO)   issues.push('EMAIL_TO not set (will default to EMAIL_USER)');
  if (issues.length > 0) {
    console.warn('\n  ⚠️  .env issues detected:');
    issues.forEach(i => console.warn(`     ✗ ${i}`));
    console.warn('  Email bot will be disabled until these are fixed.\n');
  } else {
    console.log(`  ✅ .env OK — Emails → ${process.env.EMAIL_TO}`);
  }
}

const YAHOO_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ── Generic proxy helper ──
async function proxyRequest(targetUrl, res, extraHeaders = {}) {
  try {
    const headers = { 'User-Agent': YAHOO_UA, 'Accept': 'application/json', ...extraHeaders };
    const response = await fetch(targetUrl, { headers });
    const contentType = response.headers.get('content-type') || 'application/json';
    res.set('Content-Type', contentType);
    const text = await response.text();
    res.status(response.status).send(text);
  } catch (err) {
    console.error('Proxy error:', targetUrl, err.message);
    res.status(502).json({ error: 'Proxy fetch failed', details: err.message });
  }
}

// ── CORS headers for every response ──
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── Yahoo Finance Chart API ──
// Frontend calls: /api/yahoo-chart/RELIANCE.NS?interval=1d&range=1d&includePrePost=true
app.use('/api/yahoo-chart', (req, res) => {
  // req.url = "/RELIANCE.NS?interval=1d&range=1d..."
  const target = `https://query1.finance.yahoo.com/v8/finance/chart${req.url}`;
  console.log('[YAHOO CHART]', target);
  proxyRequest(target, res);
});

// ── Yahoo Finance Search API ──
// Frontend calls: /api/yahoo-search?q=TCS&quotesCount=8&newsCount=0
app.use('/api/yahoo-search', (req, res) => {
  const target = `https://query2.finance.yahoo.com/v1/finance/search${req.url}`;
  console.log('[YAHOO SEARCH]', target);
  proxyRequest(target, res);
});

// ── Groww Stock Search API ──
// Frontend calls: /api/groww-search/st_query?page=0&query=TCS&size=10&web=true
app.use('/api/groww-search', (req, res) => {
  const target = `https://groww.in/v1/api/search/v3/query/globalSearch${req.url}`;
  console.log('[GROWW SEARCH]', target);
  proxyRequest(target, res, { 'Referer': 'https://groww.in/', 'Origin': 'https://groww.in' });
});

// ── Groww Stock Price API ──
// Frontend calls: /api/groww-stocks/accord_points/exchange/NSE/segment/CASH/latest_prices_ohlc/RELIANCE
app.use('/api/groww-stocks', (req, res) => {
  const target = `https://groww.in/v1/api/stocks_data/v1${req.url}`;
  console.log('[GROWW PRICE]', target);
  proxyRequest(target, res, { 'Referer': 'https://groww.in/', 'Origin': 'https://groww.in' });
});

// ── Google News RSS Proxy (for real stock news) ──
// Frontend calls: /api/news?q=RELIANCE
app.get('/api/news', async (req, res) => {
  const query = req.query.q || '';
  const stockName = query.replace('.NS', '').replace('.BO', '');
  
  // Fix: Don't artificially append stock India if query already defines market intent
  let searchTerm;
  if (stockName.toLowerCase().includes('stock market') || stockName.toLowerCase().includes('nifty') || stockName === '') {
     searchTerm = encodeURIComponent(stockName || 'indian stock market latest');
  } else {
     searchTerm = encodeURIComponent(`${stockName} stock India`);
  }
  
  const rssUrl = `https://news.google.com/rss/search?q=${searchTerm}&hl=en-IN&gl=IN&ceid=IN:en`;
  
  console.log('[NEWS]', rssUrl);
  
  try {
    const response = await fetch(rssUrl, {
      headers: { 'User-Agent': YAHOO_UA, 'Accept': 'application/xml, text/xml, */*' }
    });
    const xml = await response.text();
    
    // Parse RSS XML into JSON
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 6) {
      const itemXml = match[1];
      const title = (itemXml.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
      const link = (itemXml.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
      const pubDate = (itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
      const source = (itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || 'News';
      
      // Clean CDATA
      const cleanTitle = title.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      const cleanLink = link.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      
      if (cleanTitle) {
        items.push({
          title: cleanTitle,
          link: cleanLink,
          pubDate: pubDate.trim(),
          source: source.replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
        });
      }
    }
    
    res.json({ articles: items });
  } catch (err) {
    console.error('News fetch error:', err.message);
    res.status(502).json({ articles: [], error: err.message });
  }
});

// ── IPO Watch Live Feed Proxy ──
// Frontend calls: /api/ipos
app.get('/api/ipos', async (req, res) => {
  const rssUrl = 'https://ipowatch.in/feed/';
  console.log('[IPO WATCH]', rssUrl);
  
  try {
    const response = await fetch(rssUrl, {
      headers: { 'User-Agent': YAHOO_UA, 'Accept': 'application/xml, text/xml, */*' }
    });
    const xml = await response.text();
    
    // Parse RSS XML into JSON
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 10) {
      const itemXml = match[1];
      const title = (itemXml.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
      const link = (itemXml.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
      const pubDate = (itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
      
      const cleanTitle = title.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      const cleanLink = link.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      
      if (cleanTitle) {
        items.push({
          title: cleanTitle,
          link: cleanLink,
          pubDate: pubDate.trim(),
          source: 'IPO Watch'
        });
      }
    }
    
    res.json({ articles: items });
  } catch (err) {
    console.error('IPO Watch fetch error:', err.message);
    res.status(502).json({ articles: [], error: err.message });
  }
});

// ── IPO Watch GMP Scraper ──
// Frontend calls: /api/ipos/gmp
app.get('/api/ipos/gmp', async (req, res) => {
  const gmpUrl = 'https://ipowatch.in/ipo-grey-market-premium-latest-ipo-gmp/';
  console.log('[IPO GMP SCRAPER]', gmpUrl);
  
  try {
    const response = await fetch(gmpUrl, {
      headers: { 'User-Agent': YAHOO_UA }
    });
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const parsedIPOs = [];
    
    // Select the first standard table that IPOWatch uses for Mainboard and SME IPOs
    $('table').first().find('tr').each((index, element) => {
      if (index === 0) return; // Skip headers
      
      const cols = $(element).find('td');
      if (cols.length >= 8) {
        // [0]Name [1]GMP [2]Trend [3]Price Band [4]EstListing [5]Date [6]Type [7]Status
        const nameNode = $(cols[0]).text().trim();
        const gmp = $(cols[1]).text().trim(); // e.g. "₹65" or "-"
        const priceBand = $(cols[3]).text().trim();
        const estListing = $(cols[4]).text().trim();
        const dates = $(cols[5]).text().trim(); // "28-Feb"
        const type = $(cols[6]).text().trim();
        const status = $(cols[7]).text().trim();
        
        if (nameNode && gmp) {
           parsedIPOs.push({
             id: nameNode.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase(),
             name: nameNode,
             sector: type, // "Mainboard" or "SME"
             issuePrice: priceBand,
             lotSize: 'Auto',
             openDate: dates,
             gmp: gmp,
             gmpPercent: parseFloat((estListing.match(/\(([^)]+)%\)/) || [])[1]) || 0,
             subscriptionStatus: status,
             aiScore: 50 // We will grade this in the frontend
           });
        }
      }
    });
    
    // Sort by highest GMP% to bubble active grey markets to top of UI widget
    parsedIPOs.sort((a,b) => b.gmpPercent - a.gmpPercent);
    res.json({ ipos: parsedIPOs.slice(0, 15) });
  } catch (err) {
    console.error('IPO Scraper error:', err.message);
    res.status(502).json({ ipos: [], error: err.message });
  }
});

// ── Serve static React build ──
app.use(express.static(path.join(__dirname, 'dist')));

// ── SPA fallback (for React Router) ──
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  🚀 AlphaBasket Production Server`);
  console.log(`     http://localhost:${PORT}`);
  console.log(`  📊 Proxying: Yahoo Finance + Groww APIs`);
  console.log(`  📁 Static: ./dist`);
  console.log(`  📧 Email Bot: Daily at 7:00 AM IST (weekdays only)`);
  checkEnvHealth();
  
  startEmailBotScheduler();
});
