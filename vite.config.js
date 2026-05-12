import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import * as cheerio from 'cheerio'
import { fallbackIpos } from './src/data/ipos.js'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

function decodeXmlText(value = '') {
  return value
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

async function resolvePublisherLink(link) {
  const cleanLink = decodeXmlText(link)
  if (!cleanLink.includes('news.google.com')) return cleanLink

  try {
    const decodedLink = await decodeGoogleNewsArticle(cleanLink)
    if (decodedLink) return decodedLink

    const response = await fetch(cleanLink, {
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,*/*',
      },
    })

    if (response.url && !response.url.includes('news.google.com')) return response.url

    const html = await response.text()
    const directMatch =
      html.match(/data-n-au="([^"]+)"/) ||
      html.match(/<a[^>]+href="(https?:\/\/(?!news\.google)[^"]+)"/)

    return directMatch ? decodeXmlText(directMatch[1]) : cleanLink
  } catch {
    return cleanLink
  }
}

function getGoogleNewsArticleId(link) {
  try {
    const url = new URL(link)
    if (!url.hostname.includes('news.google.com') || !url.pathname.includes('/articles/')) return null
    return url.pathname.split('/').filter(Boolean).pop()
  } catch {
    return null
  }
}

async function getGoogleNewsDecodeParams(articleId) {
  const candidateUrls = [
    `https://news.google.com/articles/${articleId}`,
    `https://news.google.com/rss/articles/${articleId}`,
  ]

  for (const url of candidateUrls) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
      })
      const html = await response.text()
      const signature = html.match(/data-n-a-sg="([^"]+)"/)?.[1]
      const timestamp = html.match(/data-n-a-ts="([^"]+)"/)?.[1]
      if (signature && timestamp) return { signature, timestamp }
    } catch {
      // Try the next URL shape.
    }
  }

  return null
}

async function decodeGoogleNewsArticle(link) {
  const articleId = getGoogleNewsArticleId(link)
  if (!articleId) return null

  const params = await getGoogleNewsDecodeParams(articleId)
  if (!params) return null

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
  ]]]

  try {
    const response = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'User-Agent': USER_AGENT,
        'Referer': 'https://news.google.com/',
      },
      body: `f.req=${encodeURIComponent(JSON.stringify(requestBody))}`,
    })
    const text = await response.text()
    const jsonLine = text.split('\n').find(line => line.startsWith('[['))
    if (!jsonLine) return null

    const outer = JSON.parse(jsonLine)
    const inner = JSON.parse(outer?.[0]?.[2] || '[]')
    return inner?.[1] ? decodeXmlText(inner[1]) : null
  } catch {
    return null
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    host: true,
    allowedHosts: true,
    cors: true,
    proxy: {
      // Proxy Yahoo Finance v8 chart API for price data
      '/api/yahoo-chart': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo-chart/, '/v8/finance/chart'),
        headers: {
          'User-Agent': USER_AGENT,
        },
      },
      // Proxy Yahoo Finance Search API (fallback)
      '/api/yahoo-search': {
        target: 'https://query2.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo-search/, '/v1/finance/search'),
        headers: {
          'User-Agent': USER_AGENT,
        },
      },
      // Proxy Groww API for NSE/BSE stock search (comprehensive Indian stock coverage)
      '/api/groww-search': {
        target: 'https://groww.in',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/groww-search/, '/v1/api/search/v3/query/globalSearch'),
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json',
        },
      },
      // Proxy Groww API for stock price data
      '/api/groww-stocks': {
        target: 'https://groww.in',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/groww-stocks/, '/v1/api/stocks_data/v1'),
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json',
        },
      },
      // Proxy Google News RSS for live market & stock-specific news
      '/api/news': {
        target: 'https://news.google.com',
        changeOrigin: true,
        selfHandleResponse: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const url = new URL(req.url, 'http://localhost');
            const q = url.searchParams.get('q') || 'indian stock market';
            const searchTerm = encodeURIComponent(q.replace('.NS', '').replace('.BO', '') + ' stock India');
            const rssPath = `/rss/search?q=${searchTerm}&hl=en-IN&gl=IN&ceid=IN:en`;
            proxyReq.path = rssPath;
            proxyReq.setHeader('Accept', 'application/xml, text/xml, */*');
            proxyReq.setHeader('User-Agent', USER_AGENT);
            proxyReq.removeHeader('accept-encoding');
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            let body = '';
            proxyRes.on('data', (chunk) => { body += chunk; });
            proxyRes.on('end', async () => {
              try {
                const items = [];
                const itemRegex = /<item>([\s\S]*?)<\/item>/g;
                let match;
                while ((match = itemRegex.exec(body)) !== null && items.length < 8) {
                  const itemXml = match[1];
                  const title = (itemXml.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
                  const link = (itemXml.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
                  const pubDate = (itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
                  const source = (itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || 'News';
                  const cleanTitle = decodeXmlText(title);
                  const cleanLink = decodeXmlText(link);
                  if (cleanTitle) {
                    items.push({ title: cleanTitle, link: cleanLink, pubDate: pubDate.trim(), source: decodeXmlText(source) });
                  }
                }
                const resolvedItems = await Promise.all(items.map(async item => ({
                  ...item,
                  link: await resolvePublisherLink(item.link),
                })));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ articles: resolvedItems }));
              } catch {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ articles: [] }));
              }
            });
          });
        },
      },
      // Proxy IPO Watch GMP page and convert it into card-ready JSON
      '/api/ipos/gmp': {
        target: 'https://ipowatch.in',
        changeOrigin: true,
        selfHandleResponse: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.path = '/ipo-grey-market-premium-latest-ipo-gmp/';
            proxyReq.setHeader('User-Agent', USER_AGENT);
            proxyReq.setHeader('Accept', 'text/html,application/xhtml+xml');
            proxyReq.removeHeader('accept-encoding');
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            let body = '';
            proxyRes.on('data', (chunk) => { body += chunk; });
            proxyRes.on('end', () => {
              try {
                const $ = cheerio.load(body);
                const parsedIPOs = [];
                $('table').slice(0, 2).find('tr').each((index, element) => {
                  if (index === 0) return;
                  const cols = $(element).find('td');
                  if (cols.length >= 6) {
                    const name = $(cols[0]).text().trim();
                    const gmp = $(cols[1]).text().trim();
                    const issuePrice = $(cols[3]).text().trim();
                    const estListing = $(cols[4]).text().trim();
                    const dates = $(cols[5]).text().trim();
                    const type = $(cols[6]).text().trim();
                    const status = $(cols[7]).text().trim();
                    if (name) {
                      parsedIPOs.push({
                        id: name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase(),
                        name,
                        sector: type || 'IPO',
                        type: type || 'IPO',
                        issuePrice: issuePrice || 'TBA',
                        lotSize: 'Auto',
                        openDate: dates || 'TBA',
                        closeDate: 'TBA',
                        listingDate: 'TBA',
                        gmp: gmp || 'TBA',
                        gmpPercent: parseFloat((estListing.match(/\(([^)]+)%\)/) || [])[1]) || 0,
                        subscriptionStatus: status || 'Live GMP tracked',
                        statusType: status.toLowerCase().includes('closed') || status.toLowerCase().includes('listed')
                          ? 'closed'
                          : status.toLowerCase().includes('upcoming') ? 'upcoming' : 'open',
                        source: 'IPO Watch live GMP',
                      });
                    }
                  }
                });
                parsedIPOs.sort((a, b) => b.gmpPercent - a.gmpPercent);
                const ipos = parsedIPOs.length ? parsedIPOs.slice(0, 15) : fallbackIpos;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ipos, source: parsedIPOs.length ? 'IPO Watch live GMP' : 'Fallback market snapshot' }));
              } catch (error) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ipos: fallbackIpos, source: 'Fallback market snapshot', error: error.message }));
              }
            });
          });
        },
      },
      // Proxy IPO Watch RSS
      '/api/ipos': {
        target: 'https://ipowatch.in',
        changeOrigin: true,
        selfHandleResponse: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.path = '/feed/';
            proxyReq.setHeader('Accept', 'application/xml, text/xml, */*');
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            let body = '';
            proxyRes.on('data', (chunk) => { body += chunk; });
            proxyRes.on('end', () => {
              try {
                const items = [];
                const itemRegex = /<item>([\s\S]*?)<\/item>/g;
                let match;
                while ((match = itemRegex.exec(body)) !== null && items.length < 10) {
                  const itemXml = match[1];
                  const title = (itemXml.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
                  const link = (itemXml.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
                  const pubDate = (itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
                  const cleanTitle = decodeXmlText(title);
                  const cleanLink = decodeXmlText(link);
                  if (cleanTitle) {
                    items.push({ title: cleanTitle, link: cleanLink, pubDate: pubDate.trim(), source: 'IPO Watch' });
                  }
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ articles: items }));
              } catch {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ articles: [] }));
              }
            });
          });
        },
      },
    },
  },
})
