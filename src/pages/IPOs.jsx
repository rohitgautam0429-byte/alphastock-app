import { useState, useEffect, useMemo } from 'react';
import { Rocket, Info, Clock, ExternalLink, TrendingUp, CalendarDays } from 'lucide-react';
import { fallbackIpos, gradeIpos } from '../data/ipos';

export default function IPOs() {
  const [activeTab, setActiveTab] = useState('open');
  const [liveIpos, setLiveIpos] = useState([]);
  const [scrapedIpos, setScrapedIpos] = useState(gradeIpos(fallbackIpos));
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState('Fallback market snapshot');

  useEffect(() => {
    async function fetchIpos() {
      try {
        const gmpRes = await fetch('/api/ipos/gmp');
        if (gmpRes.ok) {
          const gmpData = await gmpRes.json();
          const live = gradeIpos(gmpData.ipos || []);
          if (live.length) {
            setScrapedIpos(live);
            setDataSource(gmpData.source || 'Live IPO GMP feed');
          }
        }

        const res = await fetch('/api/ipos');
        if (res.ok) {
          const data = await res.json();
          setLiveIpos(data.articles || []);
        }
      } catch (err) {
        console.error('Failed to fetch IPO endpoints', err);
        setScrapedIpos(gradeIpos(fallbackIpos));
      } finally {
        setLoading(false);
      }
    }
    fetchIpos();
  }, []);

  const openIpos = useMemo(() => scrapedIpos.filter(ipo => ipo.statusType === 'open'), [scrapedIpos]);
  const upcomingIpos = useMemo(() => scrapedIpos.filter(ipo => ipo.statusType === 'upcoming'), [scrapedIpos]);
  const alphaPick = useMemo(() => [...scrapedIpos].filter(ipo => ipo.statusType !== 'closed').sort((a, b) => b.aiScore - a.aiScore)[0], [scrapedIpos]);
  const selectedIpos = activeTab === 'open' ? openIpos : upcomingIpos;

  const renderIpoCard = (ipo) => (
    <div key={ipo.id || ipo.name} className="glass-card ipo-card" style={{ borderTop: `3px solid ${ipo.recommendationTone === 'buy' ? 'var(--accent-green)' : ipo.recommendationTone === 'sell' ? 'var(--accent-red)' : 'var(--accent-cyan)'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-display)', marginBottom: 4 }}>{ipo.name}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{ipo.sector || ipo.type}</div>
        </div>
        <div className={`badge ${ipo.recommendationTone === 'buy' ? 'badge-buy' : ipo.recommendationTone === 'sell' ? 'badge-sell' : 'badge-info'}`} style={{ padding: '6px 12px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
          {ipo.aiRecommendation} ({ipo.aiScore}/100)
        </div>
      </div>

      <div style={{ background: 'var(--bg-glass)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <Info size={18} color="var(--accent-cyan)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Recommendation:</strong> {ipo.reasoning}
          </div>
        </div>
      </div>

      <div className="ipo-metric-grid">
        <div>
          <span>GMP</span>
          <strong>{ipo.gmp || 'TBA'} {ipo.gmpPercent ? `(${ipo.gmpPercent > 0 ? '+' : ''}${ipo.gmpPercent}%)` : ''}</strong>
        </div>
        <div>
          <span>Subscription</span>
          <strong>{ipo.subscriptionStatus || 'TBA'}</strong>
        </div>
        <div>
          <span>Price Band</span>
          <strong>{ipo.issuePrice || 'TBA'}</strong>
        </div>
        <div>
          <span>Lot Size</span>
          <strong>{ipo.lotSize || 'TBA'}</strong>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 16, fontSize: '0.78rem' }}>
        <div>
          <div style={{ color: 'var(--text-muted)' }}>Open</div>
          <strong>{ipo.openDate || 'TBA'}</strong>
        </div>
        <div>
          <div style={{ color: 'var(--text-muted)' }}>Close</div>
          <strong>{ipo.closeDate || 'TBA'}</strong>
        </div>
        <div>
          <div style={{ color: 'var(--text-muted)' }}>Listing</div>
          <strong>{ipo.listingDate || 'TBA'}</strong>
        </div>
      </div>

      <div style={{ marginTop: 14, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        Source: {ipo.source || dataSource}
      </div>
    </div>
  );

  return (
    <div>
      <div className="section-header animate-in">
        <div>
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Rocket color="var(--accent-cyan)" /> IPO Centre
          </div>
          <div className="section-subtitle">Open issues, upcoming IPOs, GMP, subscriptions, and AlphaBasket recommendations</div>
        </div>
        <div className="badge badge-info">{dataSource}</div>
      </div>

      <div className="grid-3 animate-in" style={{ marginBottom: 24 }}>
        <button className={`glass-card metric-button ${activeTab === 'open' ? 'active-filter' : ''}`} onClick={() => setActiveTab('open')}>
          <span className="card-subtitle">Open IPOs</span>
          <strong className="stat-value" style={{ color: 'var(--accent-green)' }}>{openIpos.length}</strong>
          <span className="stat-label">Available for subscription now</span>
        </button>
        <button className={`glass-card metric-button ${activeTab === 'upcoming' ? 'active-filter' : ''}`} onClick={() => setActiveTab('upcoming')}>
          <span className="card-subtitle">Upcoming IPOs</span>
          <strong className="stat-value" style={{ color: 'var(--accent-cyan)' }}>{upcomingIpos.length}</strong>
          <span className="stat-label">Watch before applying</span>
        </button>
        <div className="glass-card">
          <div className="card-subtitle" style={{ marginBottom: 8 }}>Best Current Setup</div>
          <div style={{ color: 'var(--accent-gold)', fontWeight: 800, fontFamily: 'var(--font-display)', fontSize: '1rem', marginBottom: 6 }}>
            {alphaPick?.name || 'No IPOs tracked'}
          </div>
          <div className="stat-label">{alphaPick ? `${alphaPick.aiRecommendation} - ${alphaPick.aiScore}/100` : 'Waiting for data'}</div>
        </div>
      </div>

      <div className="tabs animate-in">
        <button className={`tab-btn ${activeTab === 'open' ? 'active' : ''}`} onClick={() => setActiveTab('open')}>
          <TrendingUp size={15} /> Present Open IPOs
        </button>
        <button className={`tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`} onClick={() => setActiveTab('upcoming')}>
          <CalendarDays size={15} /> Upcoming IPOs
        </button>
        <button className={`tab-btn ${activeTab === 'live' ? 'active' : ''}`} onClick={() => setActiveTab('live')}>
          <ExternalLink size={15} /> IPO News Links
        </button>
      </div>

      {(activeTab === 'open' || activeTab === 'upcoming') && (
        <div className="grid-2 animate-in">
          {selectedIpos.length === 0 ? (
            <div className="glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)' }}>
              No {activeTab} IPOs found. The fallback data will refresh when the live feed returns.
            </div>
          ) : selectedIpos.map(renderIpoCard)}
        </div>
      )}

      {activeTab === 'live' && (
        <div className="grid-2 animate-in" style={{ gap: 20 }}>
          {loading ? (
            <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              Loading latest IPO links...
            </div>
          ) : liveIpos.length === 0 ? (
            <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <Clock size={48} style={{ margin: '0 auto', marginBottom: 16, opacity: 0.3 }} />
              Unable to load live IPO links.
            </div>
          ) : (
            liveIpos.map((article, i) => (
              <a
                href={article.link}
                target="_blank"
                rel="noreferrer"
                key={i}
                className="glass-card news-link-card"
                style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 12, borderLeft: '3px solid var(--accent-gold)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {article.source} - {new Date(article.pubDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                  {article.title}
                </div>
                <div style={{ marginTop: 'auto', fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                  Open article <ExternalLink size={13} />
                </div>
              </a>
            ))
          )}
        </div>
      )}
    </div>
  );
}
