/* global process */
// AlphaBasket Production Server
// Serves static React app + proxies Yahoo Finance & Groww APIs
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import { startEmailBotScheduler } from './src/services/emailBot.js';
import { fallbackIpos } from './src/data/ipos.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

// ── Startup .env Health Check ──
function checkEnvHealth() {
  const issues = [];
  if (!process.env.EMAIL_USER) issues.push('EMAIL_USER not set');
  if (!process.env.EMAIL_PASS) issues.push('EMAIL_PASS not set');
  if (issues.length > 0) {
    console.warn('\n  ⚠️  .env issues detected:');
    issues.forEach(i => console.warn(`     ✗ ${i}`));
    console.warn('  Email bot will be disabled until these are fixed.\n');
  } else {
    console.log(`  .env OK - Emails -> ${process.env.EMAIL_TO || 'rameshchand1858@gmail.com'}`);
  }
}

const YAHOO_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function decodeXmlText(value = '') {
  return value
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

async function resolvePublisherLink(link) {
  const cleanLink = decodeXmlText(link);
  if (!cleanLink.includes('news.google.com')) return cleanLink;

  try {
    const decodedLink = await decodeGoogleNewsArticle(cleanLink);
    if (decodedLink) return decodedLink;

    const response = await fetch(cleanLink, {
      redirect: 'follow',
      headers: { 'User-Agent': YAHOO_UA, 'Accept': 'text/html,application/xhtml+xml,*/*' },
    });
    if (response.url && !response.url.includes('news.google.com')) return response.url;

    const html = await response.text();
    const directMatch =
      html.match(/data-n-au="([^"]+)"/) ||
      html.match(/<a[^>]+href="(https?:\/\/(?!news\.google)[^"]+)"/);
    return directMatch ? decodeXmlText(directMatch[1]) : cleanLink;
  } catch {
    return cleanLink;
  }
}

function getGoogleNewsArticleId(link) {
  try {
    const url = new URL(link);
    if (!url.hostname.includes('news.google.com') || !url.pathname.includes('/articles/')) return null;
    return url.pathname.split('/').filter(Boolean).pop();
  } catch {
    return null;
  }
}

async function getGoogleNewsDecodeParams(articleId) {
  const candidateUrls = [
    `https://news.google.com/articles/${articleId}`,
    `https://news.google.com/rss/articles/${articleId}`,
  ];

  for (const url of candidateUrls) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': YAHOO_UA },
      });
      const html = await response.text();
      const signature = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
      const timestamp = html.match(/data-n-a-ts="([^"]+)"/)?.[1];
      if (signature && timestamp) return { signature, timestamp };
    } catch {
      // Try the next URL shape.
    }
  }

  return null;
}

async function decodeGoogleNewsArticle(link) {
  const articleId = getGoogleNewsArticleId(link);
  if (!articleId) return null;

  const params = await getGoogleNewsDecodeParams(articleId);
  if (!params) return null;

  const requestBody = [[[
    'Fbv4je',
    JSON.stringify([
      'garturlreq',
      [['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1], 'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0],
      articleId,
      Number(params.timestamp),
      params.signature,
    ]),
    null,
    'generic',
  ]]];

  try {
    const response = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'User-Agent': YAHOO_UA,
        'Referer': 'https://news.google.com/',
      },
      body: `f.req=${encodeURIComponent(JSON.stringify(requestBody))}`,
    });
    const text = await response.text();
    const jsonLine = text.split('\n').find(line => line.startsWith('[['));
    if (!jsonLine) return null;

    const outer = JSON.parse(jsonLine);
    const inner = JSON.parse(outer?.[0]?.[2] || '[]');
    return inner?.[1] ? decodeXmlText(inner[1]) : null;
  } catch {
    return null;
  }
}

// ── Simple in-memory TTL cache to survive transient upstream failures ──
const _cache = {};
function cacheGet(key) {
  const entry = _cache[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > entry.ttl) return null; // expired
  return entry.data;
}
function cacheSet(key, data, ttlMs) {
  _cache[key] = { data, ts: Date.now(), ttl: ttlMs };
}
function cacheGetStale(key) {
  return _cache[key]?.data ?? null; // always return last known, even if expired
}

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
  
  const cacheKey = `news:${searchTerm}`;
  const cached = cacheGet(cacheKey);
  if (cached) return res.json(cached);
  
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
      
      const cleanTitle = decodeXmlText(title);
      const cleanLink = decodeXmlText(link);
      
      if (cleanTitle) {
        items.push({
          title: cleanTitle,
          link: cleanLink,
          pubDate: pubDate.trim(),
          source: decodeXmlText(source),
        });
      }
    }
    
    const result = { articles: await Promise.all(items.map(async item => ({ ...item, link: await resolvePublisherLink(item.link) }))) };
    if (items.length > 0) cacheSet(cacheKey, result, 10 * 60 * 1000); // cache 10 min
    res.json(result);
  } catch (err) {
    console.error('News fetch error:', err.message);
    const stale = cacheGetStale(cacheKey);
    if (stale) { console.log('[NEWS] Serving stale cache'); return res.json(stale); }
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
      
      const cleanTitle = decodeXmlText(title);
      const cleanLink = decodeXmlText(link);
      
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
             statusType: status.toLowerCase().includes('closed') || status.toLowerCase().includes('listed')
               ? 'closed'
               : status.toLowerCase().includes('upcoming') ? 'upcoming' : 'open',
             source: 'IPO Watch live GMP',
             aiScore: 50 // We will grade this in the frontend
           });
        }
      }
    });
    
    // Sort by highest GMP% to bubble active grey markets to top of UI widget
    parsedIPOs.sort((a,b) => b.gmpPercent - a.gmpPercent);
    res.json({
      ipos: parsedIPOs.length ? parsedIPOs.slice(0, 15) : fallbackIpos,
      source: parsedIPOs.length ? 'IPO Watch live GMP' : 'Fallback market snapshot'
    });
  } catch (err) {
    console.error('IPO Scraper error:', err.message);
    res.json({ ipos: fallbackIpos, source: 'Fallback market snapshot', error: err.message });
  }
});

// ── Serve static React build ──
app.use(express.static(path.join(__dirname, 'dist')));

// ── SPA fallback (for React Router) ──
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }

  try {
    res.status(200).type('html').send(fs.readFileSync(path.join(__dirname, 'dist', 'index.html')));
  } catch (err) {
    res.status(500).send(`AlphaBasket build is missing: ${err.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`\n  🚀 AlphaBasket Production Server`);
  console.log(`     http://localhost:${PORT}`);
  console.log(`  📊 Proxying: Yahoo Finance + Groww APIs`);
  console.log(`  📁 Static: ./dist`);
  console.log(`  📧 Email Bot: Daily at 7:00 AM IST`);
  checkEnvHealth();
  
  startEmailBotScheduler();
});
