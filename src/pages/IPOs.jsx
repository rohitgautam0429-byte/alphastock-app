import { useState, useEffect } from 'react';
import { Rocket, Info, TrendingUp, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

// Dynamic scraper fetches this array natively from the backend now

export default function IPOs() {
  const [activeTab, setActiveTab] = useState('upcoming');
  const [liveIpos, setLiveIpos] = useState([]);
  const [scrapedIpos, setScrapedIpos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'active', 'alpha'

  useEffect(() => {
    async function fetchIpos() {
      try {
        // Fetch Live Grey Market Data
        const gmpRes = await fetch('/api/ipos/gmp');
        if (gmpRes.ok) {
           const gmpData = await gmpRes.json();
           const processed = (gmpData.ipos || []).map(ipo => {
              // Dynamic AI grading based mathematically on scraped GMP velocity
              let aiScore = 40;
              let rec = 'AVOID';
              let reason = 'Negative or flat GMP detected. No short-term momentum.';
              
              if (ipo.gmpPercent > 40) { aiScore = 95; rec = 'STRONG BUY'; reason = 'Massive listing premium identified. Extremely high retail demand.'; }
              else if (ipo.gmpPercent > 20) { aiScore = 80; rec = 'BUY'; reason = 'Solid oversubscription matrix visible in grey market pricing.'; }
              else if (ipo.gmpPercent > 10) { aiScore = 65; rec = 'HOLD'; reason = 'Moderate grey market activity. Acceptable for long-term holds but short term pop is limited.'; }
              else if (ipo.gmpPercent > 0) { aiScore = 50; rec = 'NEUTRAL'; reason = 'Very tight listing projected. Avoid applying for listing gains.'; }
              
              return { ...ipo, aiScore, aiRecommendation: rec, reasoning: reason };
           });
           setScrapedIpos(processed);
        }

        // Fetch Live News Articles
        const res = await fetch('/api/ipos');
        if (res.ok) {
          const data = await res.json();
          setLiveIpos(data.articles || []);
        }
      } catch (err) {
        console.error('Failed to fetch IPO endpoints', err);
      } finally {
        setLoading(false);
      }
    }
    fetchIpos();
  }, []);

  return (
    <div>
      <div className="section-header animate-in">
        <div>
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Rocket color="var(--accent-cyan)" /> Upcoming IPOs & GMP Tracker
          </div>
          <div className="section-subtitle">Real-time Grey Market Premium (GMP) and AI subscription analysis</div>
        </div>
      </div>

      <div className="grid-3 animate-in" style={{ marginBottom: 24 }}>
        <div 
          className={`glass-card clickable ${filter === 'all' ? 'active-filter' : ''}`} 
          onClick={() => { setFilter('all'); setActiveTab('upcoming'); }}
          style={{ cursor: 'pointer', border: filter === 'all' ? '1px solid var(--accent-cyan)' : '1px solid transparent' }}
        >
          <div className="card-subtitle" style={{ marginBottom: 8 }}>Total Tracked</div>
          <div className="stat-value" style={{ color: 'var(--accent-green)' }}>{scrapedIpos.length}</div>
          <div className="stat-label">Live IPOs detected on IPOWatch</div>
        </div>
        <div 
          className={`glass-card clickable ${filter === 'active' ? 'active-filter' : ''}`} 
          onClick={() => { setFilter('active'); setActiveTab('upcoming'); }}
          style={{ cursor: 'pointer', border: filter === 'active' ? '1px solid var(--accent-cyan)' : '1px solid transparent' }}
        >
          <div className="card-subtitle" style={{ marginBottom: 8 }}>High GMP Status</div>
          <div className="stat-value" style={{ color: 'var(--accent-cyan)' }}>{scrapedIpos.filter(i => i.gmpPercent > 20).length}</div>
          <div className="stat-label">IPOs showing 20%+ Listing Prem</div>
        </div>
        <div 
          className={`glass-card clickable ${filter === 'alpha' ? 'active-filter' : ''}`} 
          onClick={() => { setFilter('alpha'); setActiveTab('upcoming'); }}
          style={{ cursor: 'pointer', border: filter === 'alpha' ? '1px solid var(--accent-gold)' : '1px solid transparent' }}
        >
          <div className="card-subtitle" style={{ marginBottom: 8 }}>AI Alpha Pick</div>
          {scrapedIpos.filter(i => i.aiScore >= 80).length > 0 ? (
             <>
               <div className="stat-value" style={{ color: 'var(--accent-gold)', fontSize: '1.2rem', textOverflow:'ellipsis', overflow:'hidden', whiteSpace:'nowrap' }}>{scrapedIpos.find(i => i.aiScore >= 80)?.name}</div>
               <div className="stat-label">Highest conviction IPO right now</div>
             </>
          ) : (
             <>
               <div className="stat-value" style={{ color: 'var(--accent-gold)', fontSize: '1.2rem' }}>None</div>
               <div className="stat-label">No hyper-growth IPOs detected</div>
             </>
          )}
        </div>
      </div>

      <div className="tabs animate-in">
        <button className={`tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`} onClick={() => setActiveTab('upcoming')}>
          AI IPO Analysis
        </button>
        <button className={`tab-btn ${activeTab === 'live' ? 'active' : ''}`} onClick={() => setActiveTab('live')}>
          Live from IPO Watch
        </button>
      </div>

      {activeTab === 'upcoming' && (
        <div className="grid-2 animate-in">
          {scrapedIpos.length === 0 ? (
            <div style={{color:'var(--text-muted)'}}>Scraping active market details...</div>
          ) : scrapedIpos
            .filter(ipo => {
              if (filter === 'active') return ipo.gmpPercent > 20;
              if (filter === 'alpha') return ipo.aiScore >= 80;
              return true;
            })
            .map((ipo) => (
            <div key={ipo.id} className="glass-card" style={{ borderTop: `3px solid ${ipo.aiScore >= 70 ? 'var(--accent-green)' : ipo.aiScore >= 50 ? 'var(--accent-gold)' : 'var(--accent-red)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: 4 }}>{ipo.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{ipo.sector}</div>
                </div>
                <div className={`badge ${ipo.aiScore >= 70 ? 'badge-buy' : ipo.aiScore >= 50 ? 'badge-info' : 'badge-sell'}`} style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
                  {ipo.aiRecommendation} ({ipo.aiScore}/100)
                </div>
              </div>

              <div style={{ background: 'var(--bg-glass)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <Info size={20} color="var(--accent-cyan)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>AI Insight:</strong> {ipo.reasoning}
                  </div>
                </div>
              </div>

              <div className="grid-2" style={{ gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Live GMP</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{ipo.gmp}</span>
                    {ipo.gmpPercent !== null && (
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: ipo.gmpPercent > 20 ? 'var(--accent-green)' : ipo.gmpPercent > 5 ? 'var(--accent-gold)' : 'var(--accent-red)' }}>
                        (+{ipo.gmpPercent}%)
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Status</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{ipo.subscriptionStatus}</div>
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--border-glass)', margin: '16px 0' }} />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, fontSize: '0.8rem' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Price Band</div>
                  <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{ipo.issuePrice}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Min Order Qty</div>
                  <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{ipo.lotSize} Shares</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Dates</div>
                  <div style={{ fontWeight: 600 }}>{ipo.openDate}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'live' && (
        <div className="grid-2 animate-in" style={{ gap: 20 }}>
          {loading ? (
            <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              Loading latest data from IPO Watch...
            </div>
          ) : liveIpos.length === 0 ? (
            <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <Clock size={48} style={{ margin: '0 auto', marginBottom: 16, opacity: 0.3 }} />
              Unable to load live data.
            </div>
          ) : (
            liveIpos.map((article, i) => (
              <a 
                href={article.link} 
                target="_blank" 
                rel="noreferrer" 
                key={i} 
                className="glass-card" 
                style={{ textDecoration: 'none', transition: 'transform 0.2s', display: 'flex', flexDirection: 'column', gap: 12, borderLeft: '3px solid var(--accent-gold)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <img src="https://ipowatch.in/wp-content/uploads/2021/10/cropped-favicon-32x32.png" width="16" height="16" alt="IPO Watch" style={{ borderRadius: 4 }} />
                  {article.source} • {new Date(article.pubDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                  {article.title}
                </div>
                <div style={{ marginTop: 'auto', fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                  Read Full Details →
                </div>
              </a>
            ))
          )}
        </div>
      )}
    </div>
  );
}
