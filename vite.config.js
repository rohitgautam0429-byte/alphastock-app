import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
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
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      },
      // Proxy Yahoo Finance Search API (fallback)
      '/api/yahoo-search': {
        target: 'https://query2.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo-search/, '/v1/finance/search'),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      },
      // Proxy Groww API for NSE/BSE stock search (comprehensive Indian stock coverage)
      '/api/groww-search': {
        target: 'https://groww.in',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/groww-search/, '/v1/api/search/v3/query/globalSearch'),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
      },
      // Proxy Groww API for stock price data
      '/api/groww-stocks': {
        target: 'https://groww.in',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/groww-stocks/, '/v1/api/stocks_data/v1'),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
            proxyReq.removeHeader('accept-encoding');
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            let body = '';
            proxyRes.on('data', (chunk) => { body += chunk; });
            proxyRes.on('end', () => {
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
                  const cleanTitle = title.replace(/<![CDATA[|]]>/g, '').trim();
                  const cleanLink = link.replace(/<![CDATA[|]]>/g, '').trim();
                  if (cleanTitle) {
                    items.push({ title: cleanTitle, link: cleanLink, pubDate: pubDate.trim(), source: source.replace(/<![CDATA[|]]>/g, '').trim() });
                  }
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ articles: items }));
              } catch (e) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ articles: [] }));
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
                  const cleanTitle = title.replace(/<![CDATA[|]]>/g, '').trim();
                  const cleanLink = link.replace(/<![CDATA[|]]>/g, '').trim();
                  if (cleanTitle) {
                    items.push({ title: cleanTitle, link: cleanLink, pubDate: pubDate.trim(), source: 'IPO Watch' });
                  }
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ articles: items }));
              } catch (e) {
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
