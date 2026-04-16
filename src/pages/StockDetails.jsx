import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { useStockHistory, NSE_SYMBOL_MAP } from '../services/marketData';
import { Activity, BookOpen, AlertCircle, ArrowUpRight, ArrowDownRight, Globe, ShoppingBag, CheckCircle } from 'lucide-react';
import { getVirtualPortfolio, saveVirtualPortfolio } from '../data/portfolio';

export default function StockDetails() {
  const { symbol } = useParams();
  const decodedSymbol = decodeURIComponent(symbol);
  
  // Automatically apply .NS map so Indian stocks don't fail Yahoo Finance chart API
  const mappedSymbol = NSE_SYMBOL_MAP[decodedSymbol] || decodedSymbol;
  
  const { history, quote, loading, error } = useStockHistory(mappedSymbol, '6mo', '1d');
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);

  // Shadow Portfolio Integration
  const [buyQty, setBuyQty] = useState(1);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    async function fetchNews() {
      if (!decodedSymbol) return;
      try {
        const stockName = decodedSymbol.replace('.NS', '').replace('.BO', '').replace('=F', '');
        const res = await fetch(`/api/news?q=${encodeURIComponent(stockName)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.articles) {
            setNews(data.articles);
          }
        }
      } catch (err) {
        console.error('Failed to fetch news:', err);
      } finally {
        setNewsLoading(false);
      }
    }
    fetchNews();
  }, [decodedSymbol, mappedSymbol]);

  if (loading) {
    return (
      <div className="animate-in" style={{ padding: 40, textAlign: 'center' }}>
        <div className="loading-spinner" style={{ margin: '0 auto', marginBottom: 16 }} />
        <div style={{ color: 'var(--text-muted)' }}>Fetching deep analytics for {decodedSymbol}...</div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="animate-in glass-card" style={{ textAlign: 'center', padding: 40, color: 'var(--accent-red)' }}>
        <AlertCircle size={48} style={{ margin: '0 auto', marginBottom: 16, opacity: 0.5 }} />
        <div style={{ fontSize: '1.2rem', marginBottom: 8 }}>Unable to load data for {decodedSymbol}</div>
        <div style={{ color: 'var(--text-muted)' }}>The symbol might be invalid or untracked by Yahoo Finance.</div>
      </div>
    );
  }

  const isUp = quote.change >= 0;
  const color = isUp ? '#10b981' : '#ef4444';

  const formatLargeNum = (num) => {
    if (!num) return 'N/A';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toString();
  };

  // Generate a mock AI technical score based on recent trend
  const firstPrice = history[0]?.price || quote.price;
  const lastPrice = history[history.length - 1]?.price || quote.price;
  const trend6m = ((lastPrice - firstPrice) / firstPrice) * 100;
  
  let score = 50;
  if (trend6m > 20) score += 30;
  else if (trend6m > 5) score += 15;
  else if (trend6m < -20) score -= 30;
  else if (trend6m < -5) score -= 15;
  
  if (quote.changePercent > 2) score += 10;
  if (quote.changePercent < -2) score -= 10;
  
  score = Math.max(10, Math.min(99, Math.round(score)));

  const handleBuy = () => {
    if (!quote || buyQty <= 0) return;
    
    // Load current virtual portfolio
    const data = getVirtualPortfolio();
    const cost = quote.price * buyQty;
    
    // Check remaining capital constraint
    const invested = data.holdings.reduce((sum, h) => sum + h.buyPrice * h.qty, 0);
    const remaining = data.capital - invested;
    
    if (cost > remaining) {
      setToastMessage(`Insufficient virtual capital. Required: ₹${cost.toLocaleString('en-IN')}, Remaining: ₹${remaining.toLocaleString('en-IN')}`);
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }
    
    // Reconstruct asset name and details
    let assetSector = 'Market Asset';
    let assetCapSize = 'Unknown';
    if (quote.name === 'Gold' || quote.name === 'Silver') {
      assetSector = 'Precious Metals';
      assetCapSize = 'Commodity';
    } else if (symbol.includes('.NS') || symbol.includes('.BO')) {
      assetSector = 'Equities';
      assetCapSize = 'Mid';
    }

    // Add transaction and holding
    const existing = data.holdings.find(h => h.id === quote.symbol);
    if (existing) {
      existing.buyPrice = ((existing.buyPrice * existing.qty) + (quote.price * buyQty)) / (existing.qty + buyQty);
      existing.qty += buyQty;
    } else {
      data.holdings.push({
        id: quote.symbol,
        name: quote.name,
        qty: buyQty,
        buyPrice: quote.price,
        sector: assetSector,
        capSize: assetCapSize
      });
    }
    
    data.transactions.unshift({
      id: quote.symbol,
      name: quote.name,
      type: 'BUY',
      qty: buyQty,
      price: quote.price,
      time: new Date().toLocaleTimeString('en-IN'),
      date: new Date().toLocaleDateString('en-IN')
    });
    
    saveVirtualPortfolio(data);
    
    setToastMessage(`Successfully purchased ${buyQty} unit(s) of ${quote.name} at ₹${quote.price.toLocaleString('en-IN')}. Check Shadow Portfolio.`);
    setTimeout(() => setToastMessage(null), 3500);
    setBuyQty(1);
  };

  return (
    <div style={{ position: 'relative' }}>
      {toastMessage && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 100, background: 'var(--bg-secondary)', borderLeft: '4px solid var(--accent-cyan)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', padding: '16px 20px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500 }} className="animate-in">
          {toastMessage.includes('Insufficient') ? <AlertCircle color="var(--accent-red)" size={20} /> : <CheckCircle color="var(--accent-cyan)" size={20} />}
          {toastMessage}
        </div>
      )}
      {/* Header section */}
      <div className="section-header animate-in" style={{ alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <h1 style={{ fontSize: '2.5rem', fontFamily: 'var(--font-display)', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              {quote.name}
            </h1>
            <span className="badge" style={{ fontSize: '0.8rem', background: 'var(--bg-glass)', color: 'var(--text-muted)' }}>
              {quote.exchange || 'NSE'}
            </span>
          </div>
          <div style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            {quote.symbol}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '3rem', fontFamily: 'var(--font-mono)', fontWeight: 800, lineHeight: 1, color: 'var(--text-primary)' }}>
            ₹{quote.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <span style={{ fontSize: '1.25rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color, display: 'flex', alignItems: 'center' }}>
              {isUp ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
              {isUp ? '+' : ''}{quote.changePercent?.toFixed(2)}%
            </span>
            <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>
              ({isUp ? '+' : ''}{quote.change?.toFixed(2)})
            </span>
          </div>

          {/* Quick Buy Interface */}
          <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', padding: '12px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-glass)' }}>
              <button 
                onClick={() => setBuyQty(Math.max(1, buyQty - 1))}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '8px 12px', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 600 }}
              >-</button>
              <input 
                type="number" 
                value={buyQty} 
                onChange={(e) => setBuyQty(Math.max(1, Number(e.target.value) || 1))}
                style={{ width: 60, textAlign: 'center', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '1rem' }}
              />
              <button 
                onClick={() => setBuyQty(buyQty + 1)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '8px 12px', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 600 }}
              >+</button>
            </div>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '10px' }} onClick={handleBuy}>
              <ShoppingBag size={18} /> Buy {quote.unit ? `[${quote.unit}]` : ''}
            </button>
          </div>
        </div>
      </div>

      <div className="grid-3 animate-in">
        {/* Main Chart Area */}
        <div style={{ gridColumn: 'span 2' }}>
          <div className="glass-card" style={{ height: '100%' }}>
            <div className="card-title" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
              <span>Price Action (6M)</span>
              <span className="badge" style={{ background: `${color}15`, color }}>{trend6m >= 0 ? '+' : ''}{trend6m.toFixed(2)}% in 6 months</span>
            </div>
            {history.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={history} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={color} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={12} tickMargin={10} minTickGap={30} />
                  <YAxis domain={['dataMin', 'auto']} stroke="var(--text-muted)" fontSize={12} tickFormatter={v => v.toLocaleString()} />
                  <Tooltip 
                    contentStyle={{ background: '#0F1529', border: '1px solid var(--border-glass)', borderRadius: 8, fontFamily: 'var(--font-mono)' }}
                    itemStyle={{ color: 'var(--accent-cyan)' }}
                  />
                  <Area type="monotone" dataKey="price" stroke={color} strokeWidth={2.5} fillOpacity={1} fill="url(#colorPrice)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                Chart data unavailable
              </div>
            )}
          </div>
        </div>

        {/* Info & Score Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* AI Score */}
          <div className="glass-card" style={{ textAlign: 'center', padding: '32px 24px' }}>
            <div className="card-subtitle" style={{ marginBottom: 16 }}>AlphaBasket AI Score</div>
            <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto' }}>
              <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--bg-primary)" strokeWidth="12" />
                <circle cx="60" cy="60" r="50" fill="none" stroke={score >= 70 ? 'var(--accent-cyan)' : score >= 50 ? 'var(--accent-gold)' : 'var(--accent-red)'} strokeWidth="12" strokeDasharray={`${(score/100) * 314} 314`} strokeLinecap="round" />
              </svg>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                <span style={{ fontSize: '2rem', fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--text-primary)' }}>{score}</span>
              </div>
            </div>
            <div style={{ marginTop: 16, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {score >= 70 ? 'Strong Bullish momentum. Technicals align with buy thesis.' : score >= 40 ? 'Neutral action. Consolidating around moving averages.' : 'Bearish trend. Wait for reversal signals.'}
            </div>
          </div>

          {/* Actionable Insights */}
          <div className="glass-card" style={{ flex: 1 }}>
            <div className="card-title" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={18} color="var(--accent-cyan)" /> Actionable Insights
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Recommendation Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>AI Consensus</span>
                <span className={score >= 70 ? 'badge badge-buy' : score >= 40 ? 'badge badge-info' : 'badge badge-sell'} style={{ fontSize: '0.9rem', padding: '4px 12px' }}>
                  {score >= 70 ? 'STRONG BUY' : score >= 40 ? 'HOLD' : 'SELL'}
                </span>
              </div>

              {/* Targets */}
              <div style={{ background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Optimal Entry Range</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.85rem' }}>
                    ₹{(quote.price * 0.985).toFixed(1)} - ₹{quote.price.toFixed(1)}
                  </span>
                </div>
                <div style={{ height: 1, background: 'var(--border-glass)', margin: '8px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Short Term Target (1-3M)</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.85rem', color: score >= 50 ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                    ₹{(quote.price * (1 + (score > 50 ? 0.08 : -0.05))).toFixed(1)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Long Term Target (1Y+)</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.85rem', color: score >= 50 ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                    ₹{(quote.price * (1 + (score > 50 ? 0.22 : -0.15))).toFixed(1)}
                  </span>
                </div>
              </div>

              {/* Key Fundamentals (Compact) */}
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 8 }}>Market Data</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Day High</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 600 }}>{quote.dayHigh?.toLocaleString() || '-'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Day Low</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 600 }}>{quote.dayLow?.toLocaleString() || '-'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Prev Close</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 600 }}>{quote.previousClose?.toLocaleString() || '-'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Volume</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 600 }}>{formatLargeNum(quote.volume)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time News */}
      <div className="glass-card animate-in" style={{ marginTop: 24 }}>
        <div className="card-title" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Globe size={18} color="var(--accent-cyan)" /> Live Financial News
        </div>
        
        {newsLoading ? (
          <div style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>
            Loading latest headlines...
          </div>
        ) : news.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>
            No recent news found for {quote.name}.
          </div>
        ) : (
          <div className="grid-3">
            {news.slice(0, 3).map((item, i) => {
              const bgColors = ['var(--accent-blue)', 'var(--accent-gold)', 'var(--accent-green)'];
              const color = bgColors[i % bgColors.length];
              return (
                <a key={i} href={item.link} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ 
                    padding: 16, background: 'var(--bg-glass)', borderRadius: 12, 
                    borderLeft: `3px solid ${color}`, height: '100%',
                    transition: 'transform 0.2s', cursor: 'pointer'
                  }} className="news-card">
                    <div style={{ fontSize: '0.7rem', color: color, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>
                      Latest Update
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 12, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {item.source} • {new Date(item.pubDate).toLocaleDateString()}
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
