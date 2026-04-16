import { useCommodityPrices } from '../services/marketData';
import { useNavigate } from 'react-router-dom';

export default function CommodityDashboard() {
  const { commodities, loading } = useCommodityPrices(30000);
  const navigate = useNavigate();

  const commodityList = commodities
    ? Object.values(commodities)
    : [
      { name: 'Gold', symbol: 'GC=F', price: 72100, changePercent: 0.5, currency: 'INR' },
      { name: 'Silver', symbol: 'SI=F', price: 83500, changePercent: 0.8, currency: 'INR' },
      { name: 'Crude Oil', symbol: 'CL=F', price: 6580, changePercent: -1.2, currency: 'INR' },
      { name: 'Natural Gas', symbol: 'NG=F', price: 215, changePercent: -0.5, currency: 'INR' },
      { name: 'Copper', symbol: 'HG=F', price: 850, changePercent: 0.3, currency: 'INR' },
    ];

  const getEmoji = (name) => {
    const map = { Gold: '🥇', Silver: '🥈', 'Crude Oil': '🛢️', 'Natural Gas': '🔥', Copper: '🔶' };
    return map[name] || '📊';
  };

  return (
    <div>
      <div className="section-header animate-in">
        <div>
          <div className="section-title">Live Commodity Prices</div>
          <div className="section-subtitle">Real-time global commodity prices via Yahoo Finance</div>
        </div>
        <div className="live-indicator"><div className="live-pulse" /><span>LIVE</span></div>
      </div>

      {loading && (
        <div className="glass-card animate-in" style={{ textAlign: 'center', padding: 40 }}>
          <div className="loading-shimmer" style={{ height: 24, width: 200, margin: '0 auto', borderRadius: 8 }} />
          <div style={{ marginTop: 12, color: 'var(--text-muted)' }}>Fetching live commodity prices...</div>
        </div>
      )}

      <div className="grid-3 animate-in" style={{ marginBottom: 24 }}>
        {commodityList.map((c, i) => {
          const isUp = (c.changePercent || 0) >= 0;
          return (
            <div 
              key={i} 
              className="glass-card" 
              style={{ borderTop: `2px solid ${isUp ? 'var(--accent-green)' : 'var(--accent-red)'}`, cursor: 'pointer' }}
              onClick={() => navigate(`/stock/${encodeURIComponent(c.symbol)}`)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: '2rem' }}>{getEmoji(c.name)}</span>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem' }}>{c.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.symbol}</div>
                  </div>
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700, marginBottom: 8 }}>
                ₹{(c.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: isUp ? 'var(--accent-green)' : 'var(--accent-red)',
                }}>
                  {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{(c.changePercent || 0).toFixed(2)}%
                </span>
                {c.change != null && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    ({isUp ? '+' : ''}{c.change?.toFixed(2)})
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Commodity Info */}
      <div className="glass-card animate-in">
        <div className="card-title" style={{ marginBottom: 16 }}>📊 Commodity Market Overview</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ padding: 16, background: 'var(--bg-glass)', borderRadius: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--accent-gold)' }}>Gold & Silver</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Gold serves as the primary inflation hedge and safe haven in the portfolio. Silver offers higher beta exposure with industrial demand catalysts (EV, solar). Track real-time MCX prices to optimize entry/exit.
            </div>
          </div>
          <div style={{ padding: 16, background: 'var(--bg-glass)', borderRadius: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--accent-red)' }}>Energy Complex</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Crude oil impacts India's import bill and fiscal deficit. Natural gas drives fertilizer and power costs. Monitor OPEC+ decisions and US inventory data for signals.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
