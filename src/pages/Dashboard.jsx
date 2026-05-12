import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, Shield, Activity, ArrowUpRight, Rocket, Target, Briefcase, BellRing } from 'lucide-react';
import { stocks, marketIndices } from '../data/stocks';
import { constructBasket, detectRegime, getRebalanceSignal, masterAllocation } from '../data/portfolio';
import { fallbackIpos, gradeIpos } from '../data/ipos';
import { ScoreGauge, MiniChart, AllocationDonut, LivePrice } from '../components/Charts';
import { useMarketIndices, useStockPrices, useCommodityPrices, useCurrencyRates } from '../services/marketData';

const portfolioPerformance = [
  { month: 'Apr', portfolio: 100, nifty: 100 },
  { month: 'May', portfolio: 103.2, nifty: 102.5 },
  { month: 'Jun', portfolio: 107.5, nifty: 105.8 },
  { month: 'Jul', portfolio: 112.8, nifty: 108.2 },
  { month: 'Aug', portfolio: 110.5, nifty: 106.5 },
  { month: 'Sep', portfolio: 115.2, nifty: 110.8 },
  { month: 'Oct', portfolio: 118.5, nifty: 113.2 },
  { month: 'Nov', portfolio: 122.8, nifty: 115.8 },
  { month: 'Dec', portfolio: 125.2, nifty: 118.5 },
  { month: 'Jan', portfolio: 128.5, nifty: 120.2 },
  { month: 'Feb', portfolio: 132.8, nifty: 123.5 },
  { month: 'Mar', portfolio: 135.2, nifty: 125.8 },
];

const getArticleLink = (item) => (item?.link || '').replaceAll('&amp;', '&');

export default function Dashboard() {
  const { indices: liveIndices, loading: indicesLoading, lastUpdated } = useMarketIndices(30000);
  const stockIds = useMemo(() => stocks.map(s => s.id), []);
  const { prices: livePrices } = useStockPrices(stockIds, 30000);
  const { commodities: liveCommodities } = useCommodityPrices(60000);
  const { rates: liveForex } = useCurrencyRates(60000);
  const navigate = useNavigate();

  const basket = useMemo(() => constructBasket(stocks, livePrices), [livePrices]);
  const rebalanceSignal = useMemo(() => getRebalanceSignal(basket.equityBasket), [basket]);

  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  
  const [scrapedIpos, setScrapedIpos] = useState([]);

  useEffect(() => {
    async function fetchIpos() {
      try {
        const res = await fetch('/api/ipos/gmp');
        if (res.ok) {
           const data = await res.json();
           const ipos = gradeIpos(data.ipos || []);
           setScrapedIpos(ipos.length ? ipos : gradeIpos(fallbackIpos));
        }
      } catch {
        setScrapedIpos(gradeIpos(fallbackIpos));
      }
    }
    fetchIpos();
  }, []);

  useEffect(() => {
    async function fetchNews() {
      try {
        const res = await fetch('/api/news?q=indian+stock+market');
        if (res.ok) {
          const data = await res.json();
          if (data.articles) {
            setNews(data.articles);
          }
        }
      } catch (err) {
        console.error('Failed to fetch dashboard news:', err);
      } finally {
        setNewsLoading(false);
      }
    }
    fetchNews();
  }, []);


  const allocationData = [
    { name: 'Large Cap', value: masterAllocation.largeCap, color: '#3b82f6' },
    { name: 'Mid Cap', value: masterAllocation.midCap, color: '#8b5cf6' },
    { name: 'Small Cap', value: masterAllocation.smallCap, color: '#ec4899' },
  ];

  // Dynamic leaderboard from the same weekly-rotated basket engine.
  const topMovers = (basket.leaderboard || basket.equityBasket).slice(0, 5).map(s => ({
    ...s,
    livePrice: livePrices[s.id]?.price || s.price,
    liveChange: livePrices[s.id]?.changePercent ?? s.change,
  }));



  // Build indices display from live data or fallback
  const indicesDisplay = liveIndices
    ? Object.values(liveIndices)
    : Object.values(marketIndices);

  // Live commodity display
  const commodityDisplay = liveCommodities
    ? Object.values(liveCommodities).slice(0, 4)
    : [
      { name: 'Gold', price: 137100, changePercent: 0.8 },
      { name: 'Silver', price: 221500, changePercent: 1.2 },
      { name: 'Crude Oil', price: 6580, changePercent: -1.5 },
      { name: 'Natural Gas', price: 215.40, changePercent: -0.3 },
    ];

  const regime = detectRegime(
    liveIndices?.['^INDIAVIX']?.value || 13.85,
    true,
    2500
  );

  const positiveIndices = indicesDisplay.filter(idx => (idx.changePercent || idx.change || 0) >= 0).length;
  const topSignal = topMovers[0];
  const briefStats = [
    { label: 'Portfolio XIRR', value: '+35.2%', tone: 'positive', detail: 'vs Nifty +25.8%' },
    { label: 'Health Score', value: '92/100', tone: 'positive', detail: 'Drift inside band' },
    { label: 'Market Breadth', value: `${positiveIndices}/${indicesDisplay.length}`, tone: positiveIndices >= 3 ? 'positive' : 'negative', detail: 'Major indices green' },
  ];
  const commandQueue = [
    { icon: Target, label: 'Highest score', value: topSignal ? `${topSignal.id} ${topSignal.score.total}/100` : 'Loading', to: topSignal ? `/stock/${encodeURIComponent(topSignal.nseSymbol || topSignal.id)}` : '/screener' },
    { icon: Briefcase, label: 'Basket refresh', value: basket.metadata?.rotationKey || 'Weekly cycle', to: '/basket' },
    { icon: BellRing, label: 'Alerts', value: news.length ? `${news.length} live headlines` : 'News feed ready', to: '/notifications' },
  ];

  return (
    <div>
      {/* Live Data Banner */}
      {lastUpdated && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="live-pulse" />
            Last updated: {lastUpdated.toLocaleTimeString('en-IN')}
          </div>
        </div>
      )}

      <section className="dashboard-command animate-in">
        <div className="command-main">
          <div className="command-kicker">
            <Activity size={16} />
            Live research desk
          </div>
          <h2>AlphaBasket market cockpit</h2>
          <p>
            {regime.name} regime, {positiveIndices} of {indicesDisplay.length} major indices positive, and {topSignal ? topSignal.name : 'the basket'} leading the current score table.
          </p>
          <div className="command-actions">
            <button className="btn btn-primary" onClick={() => navigate('/basket')}>
              <Briefcase size={16} /> Open Basket
            </button>
            <button className="btn btn-outline" onClick={() => navigate('/screener')}>
              <Target size={16} /> Run Screener
            </button>
          </div>
        </div>

        <div className="command-panel">
          <div className="command-panel-header">
            <span>Command Queue</span>
            <span className="badge badge-info">Today</span>
          </div>
          {commandQueue.map((item) => (
            <button key={item.label} className="command-queue-item" onClick={() => navigate(item.to)}>
              <span className="command-icon"><item.icon size={16} /></span>
              <span>
                <span className="command-label">{item.label}</span>
                <strong>{item.value}</strong>
              </span>
              <ArrowUpRight size={15} />
            </button>
          ))}
        </div>

        <div className="command-stats">
          {briefStats.map((stat) => (
            <div key={stat.label} className="command-stat">
              <span>{stat.label}</span>
              <strong className={stat.tone}>{stat.value}</strong>
              <small>{stat.detail}</small>
            </div>
          ))}
        </div>
      </section>

      {/* Market Indices */}
      <div className="grid-5 animate-in" style={{ marginBottom: 24 }}>
        {indicesDisplay.map((idx, i) => (
          <div key={i} className="index-card">
            <div className="index-name">{idx.name}</div>
            <div className="index-value" style={{ color: (idx.changePercent || idx.change) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {(idx.value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className={`index-change ${(idx.changePercent || idx.change) >= 0 ? 'positive' : 'negative'}`}>
              {(idx.changePercent || idx.change) >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {(idx.changePercent || idx.change) >= 0 ? '+' : ''}{(idx.changePercent || idx.change || 0).toFixed(2)}%
            </div>
            {indicesLoading && <div className="loading-shimmer" style={{ height: 4, marginTop: 8, borderRadius: 2 }} />}
          </div>
        ))}
      </div>

      <div className="grid-3" style={{ marginBottom: 24 }}>
        {/* Portfolio Performance */}
        <div className="glass-card animate-in">
          <div className="card-header">
            <span className="card-title">Portfolio Performance</span>
            <span className="badge badge-info">1Y</span>
          </div>
          <div style={{ display: 'flex', gap: 32, marginBottom: 16 }}>
            <div>
              <div className="stat-value positive">+35.2%</div>
              <div className="stat-label">XIRR</div>
            </div>
            <div>
              <div className="stat-value" style={{ color: 'var(--accent-cyan)' }}>1.85</div>
              <div className="stat-label">Sharpe Ratio</div>
            </div>
            <div>
              <div className="stat-value negative">-8.2%</div>
              <div className="stat-label">Max Drawdown</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={portfolioPerformance}>
              <defs>
                <linearGradient id="pgCyan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00D4FF" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#00D4FF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <Area type="monotone" dataKey="portfolio" stroke="#00D4FF" strokeWidth={2} fill="url(#pgCyan)" dot={false} />
              <Area type="monotone" dataKey="nifty" stroke="#3b82f6" strokeWidth={1} fill="none" dot={false} strokeDasharray="4 4" />
              <Tooltip contentStyle={{ background: '#0F1529', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: '0.8rem' }} />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 2, background: '#00D4FF', display: 'inline-block' }} /> Portfolio</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 2, background: '#3b82f6', display: 'inline-block', borderTop: '1px dashed #3b82f6' }} /> Nifty 50</span>
          </div>
        </div>

        {/* Allocation Donut */}
        <div className="glass-card animate-in">
          <div className="card-header">
            <span className="card-title">Basket Allocation</span>
            <div className="regime-badge" style={{ background: `${regime.color}15`, borderColor: `${regime.color}40`, color: regime.color, fontSize: '0.7rem' }}>
              {regime.emoji} {regime.name}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <AllocationDonut data={allocationData} size={160} />
            <div className="allocation-legend">
              {allocationData.map((item, i) => (
                <div key={i} className="legend-item">
                  <span className="legend-label"><span className="legend-color" style={{ background: item.color }} />{item.name}</span>
                  <span className="legend-value">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rebalancing Health */}
        <div className="glass-card animate-in">
          <div className="card-header">
            <span className="card-title">Rebalancing Health</span>
            <Shield size={18} color={rebalanceSignal.needsRebalance ? 'var(--accent-gold)' : 'var(--accent-green)'} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 6 }}>
              <span style={{ color: 'var(--text-muted)' }}>Portfolio Health Score</span>
              <span style={{ color: rebalanceSignal.needsRebalance ? 'var(--accent-gold)' : 'var(--accent-green)', fontWeight: 600 }}>{rebalanceSignal.healthScore}/100</span>
            </div>
            <div className="rebalance-bar">
              <div className="rebalance-fill" style={{ width: `${rebalanceSignal.healthScore}%`, background: rebalanceSignal.needsRebalance ? 'var(--gradient-gold)' : 'var(--gradient-green)' }} />
            </div>
          </div>
          {rebalanceSignal.allocationRows.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-glass)', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
              <div style={{ display: 'flex', gap: 16 }}>
                <span style={{ color: 'var(--text-muted)' }}>Target: {item.target}%</span>
                <span style={{ color: item.ok ? 'var(--accent-green)' : 'var(--accent-gold)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{item.current}%</span>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 16, padding: 12, background: rebalanceSignal.needsRebalance ? 'rgba(217,119,6,0.1)' : 'rgba(16,185,129,0.08)', borderRadius: 8, fontSize: '0.8rem', color: rebalanceSignal.needsRebalance ? 'var(--accent-gold)' : 'var(--accent-green)' }}>
            {rebalanceSignal.message}
          </div>
          <div style={{ marginTop: 10, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Weekly review: {rebalanceSignal.nextReviewLabel}. Early rebalance triggers: score below 60, price shock over 4%, RSI extremes, or fundamental deterioration.
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Top Scored Stocks */}
        <div className="glass-card animate-in">
          <div className="card-header">
            <span className="card-title">Top Scored Stocks</span>
            <div className="live-indicator"><div className="live-pulse" /><span>LIVE</span></div>
          </div>
          {topMovers.map((stock, i) => (
            <div 
              key={stock.id} 
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 4 ? '1px solid var(--border-glass)' : 'none', cursor: 'pointer' }}
              onClick={() => navigate(`/stock/${encodeURIComponent(stock.nseSymbol || stock.id)}`)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <ScoreGauge score={stock.score.total} size={40} strokeWidth={3} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{stock.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{stock.sector} • {stock.capSize} Cap</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <LivePrice price={stock.livePrice} changePercent={stock.liveChange} />
              </div>
            </div>
          ))}
        </div>

        {/* Live Market News */}
        <div className="glass-card animate-in">
          <div className="card-header">
            <span className="card-title">Live Market News</span>
            <span className="badge badge-info">{news.length > 0 ? news.length + ' stories' : 'Live'}</span>
          </div>
          {newsLoading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading latest headlines...</div>
          ) : news.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No recent news found.</div>
          ) : (
            news.slice(0, 4).map((item, idx) => (
              <a 
                href={getArticleLink(item)}
                target="_blank" 
                rel="noreferrer"
                key={idx} 
                className="notif-item unread news-link-card"
                style={{ padding: 12, marginBottom: 8, display: 'block', textDecoration: 'none', color: 'inherit', transition: 'transform 0.2s, background 0.2s', borderLeft: '3px solid var(--accent-cyan)' }}
              >
                <div className="notif-content">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div className="notif-title" style={{ fontSize: '0.85rem', lineHeight: 1.4, flex: 1, paddingRight: 8 }}>{item.title}</div>
                    <ArrowUpRight size={14} style={{ opacity: 0.5, color: 'var(--accent-cyan)', flexShrink: 0, marginTop: 2 }} />
                  </div>
                  <div className="notif-meta" style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{item.source} • {new Date(item.pubDate).toLocaleDateString()}</span>
                    <span style={{ color: 'var(--accent-cyan)' }}>Read Article →</span>
                  </div>
                </div>
              </a>
            ))
          )}
        </div>
      </div>
      
      {/* Missing Layout Fixes: Upcoming IPOs miniaturized widget */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="glass-card animate-in" style={{ background: 'linear-gradient(135deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.9) 100%)', border: '1px solid rgba(0, 212, 255, 0.2)' }}>
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Rocket size={18} color="var(--accent-cyan)" /> Upcoming IPOs
            </span>
            <span className="badge badge-buy" style={{ cursor: 'pointer' }} onClick={() => navigate('/ipos')}>View All →</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {scrapedIpos.length === 0 ? (
               <div style={{color:'var(--text-muted)', fontSize:'0.85rem', padding:12}}>Loading live GMP data...</div>
            ) : scrapedIpos.slice(0, 2).map((ipo, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, borderLeft: `3px solid ${ipo.gmpPercent > 20 ? 'var(--accent-green)' : 'var(--accent-gold)'}` }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>{ipo.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Est. GMP: {ipo.gmp} ({ipo.gmpPercent ? `+${ipo.gmpPercent}%` : 'TBD'})</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.85rem', color: ipo.gmpPercent > 20 ? 'var(--accent-green)' : 'var(--accent-gold)', fontWeight: 600 }}>
                    {ipo.gmpPercent > 20 ? 'STRONG BUY' : ipo.gmpPercent > 10 ? 'BUY' : 'HOLD'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{ipo.subscriptionStatus}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Currencies Market Overview */}
        <div className="glass-card animate-in">
          <div className="card-header">
            <span className="card-title">FOREX / Currencies</span>
            <div className="live-indicator"><div className="live-pulse" /><span>LIVE</span></div>
          </div>
          {liveForex.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading live rates...</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {liveForex.map((pair, i) => (
                <div key={i} style={{ flex: '1 1 45%', padding: 14, background: 'var(--bg-glass)', borderRadius: 8, border: '1px solid var(--border-glass)', borderTop: `2px solid ${pair.isUp ? 'var(--accent-green)' : 'var(--accent-red)'}` }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>{pair.flag} {pair.label}</div>
                  <div style={{ fontSize: '1.15rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    {pair.price.toFixed(pair.label.includes('JPY') ? 4 : 2)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: pair.isUp ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600, marginTop: 2 }}>
                    {pair.isUp ? '▲ +' : '▼ '}{pair.changePercent.toFixed(2)}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Live Commodity Prices */}
      <div className="glass-card animate-in">
        <div className="card-header">
          <span className="card-title">Live Commodity Prices</span>
          <div className="live-indicator"><div className="live-pulse" /><span>REAL-TIME</span></div>
        </div>
        <div className="grid-5">
          {commodityDisplay.map((c, i) => {
            const isUp = (c.changePercent || 0) >= 0;
            const emojis = { Gold: '🥇', Silver: '🥈', 'Crude Oil': '🛢️', 'Natural Gas': '🔥', Copper: '🔶' };
            return (
              <div 
                key={i} 
                style={{ padding: 16, background: 'var(--bg-glass)', borderRadius: 12, border: '1px solid var(--border-glass)', cursor: 'pointer', borderTop: `2px solid ${isUp ? 'var(--accent-green)' : 'var(--accent-red)'}`, transition: 'transform 0.2s, box-shadow 0.2s' }}
                onClick={() => navigate(`/stock/${encodeURIComponent(c.symbol)}`)}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: '1.3rem' }}>{emojis[c.name] || '📊'}</span>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.name}</div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 700, marginBottom: 4 }}>
                  ₹{(c.price || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: isUp ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    {isUp ? '▲ +' : '▼ '}{(c.changePercent || 0).toFixed(2)}%
                  </div>
                  {c.unit && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>/{c.unit}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Full-Width Market News Feed */}
      <div className="glass-card animate-in" style={{ marginTop: 24 }}>
        <div className="card-header" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Activity size={20} color="var(--accent-cyan)" />
            <span className="card-title">📰 Market News Feed</span>
          </div>
          <div className="live-indicator"><div className="live-pulse" /><span>LIVE</span></div>
        </div>
        
        {/* Scrolling headline ticker */}
        {news.length > 0 && (
          <div style={{ overflow: 'hidden', marginBottom: 20, padding: '10px 0', borderTop: '1px solid var(--border-glass)', borderBottom: '1px solid var(--border-glass)' }}>
            <div style={{ display: 'flex', gap: 40, animation: 'ticker 30s linear infinite', whiteSpace: 'nowrap' }}>
              {news.map((item, idx) => (
                <a key={idx} href={getArticleLink(item)} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 500, textDecoration: 'none' }}>
                  📌 {item.title} <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>— {item.source}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {newsLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ padding: 20, background: 'var(--bg-glass)', borderRadius: 12 }}>
                <div className="loading-shimmer" style={{ height: 16, width: '80%', borderRadius: 6, marginBottom: 12 }} />
                <div className="loading-shimmer" style={{ height: 12, width: '60%', borderRadius: 6, marginBottom: 8 }} />
                <div className="loading-shimmer" style={{ height: 12, width: '40%', borderRadius: 6 }} />
              </div>
            ))}
          </div>
        ) : news.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            <Activity size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
            <div>No market news available at the moment.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {news.slice(0, 6).map((item, idx) => {
              const accentColors = ['var(--accent-cyan)', 'var(--accent-gold)', 'var(--accent-green)', '#8b5cf6', '#ec4899', '#f97316'];
              const accent = accentColors[idx % accentColors.length];
              return (
                <a 
                  key={idx} 
                  href={getArticleLink(item)}
                  target="_blank" 
                  rel="noreferrer" 
                  className="news-link-card"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div style={{ 
                    padding: 20, background: 'var(--bg-glass)', borderRadius: 12, 
                    borderLeft: `3px solid ${accent}`, height: '100%',
                    transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${accent}20`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: '0.65rem', color: accent, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
                          {idx === 0 ? '🔴 BREAKING' : idx < 3 ? '📊 TRENDING' : '📰 LATEST'}
                        </span>
                        <ArrowUpRight size={14} style={{ color: accent, opacity: 0.6 }} />
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 12, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {item.title}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {item.source} • {new Date(item.pubDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                      </span>
                      <span style={{ color: accent, fontWeight: 600 }}>Read →</span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
