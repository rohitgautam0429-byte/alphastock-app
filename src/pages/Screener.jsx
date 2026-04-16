import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import { stocks, sectors } from '../data/stocks';
import { scoreAllStocks } from '../data/scoring';
import { ScoreGauge, MiniChart, RadarScoreChart, getCapBadge, LivePrice } from '../components/Charts';
import { useStockPrices } from '../services/marketData';

export default function Screener() {
  const [sectorFilter, setSectorFilter] = useState('All');
  const [capFilter, setCapFilter] = useState('All');
  const [sortField, setSortField] = useState('score');
  const [sortDir, setSortDir] = useState('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedStock, setExpandedStock] = useState(null);
  const navigate = useNavigate();

  const scoredStocks = useMemo(() => scoreAllStocks(stocks), []);
  const stockIds = useMemo(() => stocks.map(s => s.id), []);
  const { prices: livePrices, loading } = useStockPrices(stockIds, 30000);

  const filtered = useMemo(() => {
    let result = scoredStocks.map(s => ({
      ...s,
      livePrice: livePrices[s.id]?.price || s.price,
      liveChange: livePrices[s.id]?.changePercent ?? s.change,
    }));
    if (sectorFilter !== 'All') result = result.filter(s => s.sector === sectorFilter);
    if (capFilter !== 'All') result = result.filter(s => s.capSize === capFilter);
    if (searchQuery) result = result.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.id.toLowerCase().includes(searchQuery.toLowerCase()));

    result.sort((a, b) => {
      let aVal, bVal;
      switch (sortField) {
        case 'score': aVal = a.score.total; bVal = b.score.total; break;
        case 'price': aVal = a.livePrice; bVal = b.livePrice; break;
        case 'change': aVal = a.liveChange; bVal = b.liveChange; break;
        case 'pe': aVal = a.pe; bVal = b.pe; break;
        case 'roe': aVal = a.roe; bVal = b.roe; break;
        case 'name': aVal = a.name; bVal = b.name; return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        default: aVal = a.score.total; bVal = b.score.total;
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return result;
  }, [scoredStocks, sectorFilter, capFilter, sortField, sortDir, searchQuery, livePrices]);

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const renderSortIcon = (field) => (
    sortField === field ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={10} style={{ opacity: 0.3 }} />
  );

  // Sector heatmap
  const sectorPerf = useMemo(() => {
    const map = {};
    stocks.forEach(s => {
      const liveChange = livePrices[s.id]?.changePercent ?? s.change;
      if (!map[s.sector]) map[s.sector] = { total: 0, count: 0 };
      map[s.sector].total += liveChange;
      map[s.sector].count++;
    });
    return Object.entries(map).map(([sector, data]) => ({
      sector,
      avgChange: data.total / data.count,
      count: data.count,
    })).sort((a, b) => b.avgChange - a.avgChange);
  }, [livePrices]);

  return (
    <div>
      <div className="section-header animate-in">
        <div>
          <div className="section-title">Stock Screener</div>
          <div className="section-subtitle">AI-powered multi-factor scoring across NSE & BSE universe</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="live-indicator"><div className="live-pulse" /><span>LIVE PRICES</span></div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--accent-cyan)' }}>{filtered.length}</strong> stocks
          </span>
        </div>
      </div>

      {/* Sector Heatmap */}
      <div className="glass-card animate-in" style={{ marginBottom: 24 }}>
        <div className="card-title" style={{ marginBottom: 16 }}>Sector Performance Heatmap</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {sectorPerf.map(sp => {
            const intensity = Math.min(Math.abs(sp.avgChange) * 30, 100);
            const bg = sp.avgChange >= 0
              ? `rgba(16, 185, 129, ${intensity / 100 * 0.5 + 0.1})`
              : `rgba(239, 68, 68, ${intensity / 100 * 0.5 + 0.1})`;
            return (
              <div
                key={sp.sector}
                onClick={() => setSectorFilter(sp.sector === sectorFilter ? 'All' : sp.sector)}
                style={{
                  background: bg, padding: '12px 18px', borderRadius: 10, cursor: 'pointer',
                  border: sectorFilter === sp.sector ? '2px solid var(--accent-cyan)' : '1px solid transparent',
                  transition: 'all 0.2s', minWidth: 100,
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>{sp.sector}</div>
                <div style={{ fontSize: '0.75rem', color: sp.avgChange >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  {sp.avgChange >= 0 ? '+' : ''}{sp.avgChange.toFixed(2)}%
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{sp.count} stocks</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar animate-in">
        <div className="filter-group">
          <span className="filter-label">Search</span>
          <input className="filter-input" placeholder="Stock name or ticker..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: 200 }} />
        </div>
        <div className="filter-group">
          <span className="filter-label">Sector</span>
          <select className="filter-select" value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}>
            <option value="All">All Sectors</option>
            {sectors.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <span className="filter-label">Market Cap</span>
          <select className="filter-select" value={capFilter} onChange={e => setCapFilter(e.target.value)}>
            <option value="All">All Caps</option>
            <option value="Large">Large Cap</option>
            <option value="Mid">Mid Cap</option>
            <option value="Small">Small Cap</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card animate-in" style={{ overflow: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('name')} className={sortField === 'name' ? 'sorted' : ''}>Stock {renderSortIcon('name')}</th>
              <th onClick={() => handleSort('score')} className={sortField === 'score' ? 'sorted' : ''}>Score {renderSortIcon('score')}</th>
              <th>Chart</th>
              <th onClick={() => handleSort('price')} className={sortField === 'price' ? 'sorted' : ''}>Price {renderSortIcon('price')}</th>
              <th onClick={() => handleSort('change')} className={sortField === 'change' ? 'sorted' : ''}>Change {renderSortIcon('change')}</th>
              <th onClick={() => handleSort('pe')} className={sortField === 'pe' ? 'sorted' : ''}>P/E {renderSortIcon('pe')}</th>
              <th onClick={() => handleSort('roe')} className={sortField === 'roe' ? 'sorted' : ''}>ROE {renderSortIcon('roe')}</th>
              <th>Cap</th>
              <th>Sector</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(stock => (
              <tr key={stock.id} onClick={() => setExpandedStock(expandedStock === stock.id ? null : stock.id)} style={{ cursor: 'pointer' }}>
                <td>
                  <div style={{ fontWeight: 600 }}>{stock.id}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{stock.name}</div>
                </td>
                <td><ScoreGauge score={stock.score.total} size={38} strokeWidth={3} /></td>
                <td 
                  onClick={(e) => { e.stopPropagation(); navigate(`/stock/${encodeURIComponent(stock.nseSymbol || stock.id)}`); }}
                  title="View full chart & details"
                  style={{ '&:hover': { opacity: 0.8 } }}
                >
                  <MiniChart data={stock.priceHistory} color={stock.liveChange >= 0 ? '#10b981' : '#ef4444'} height={30} width={80} />
                </td>
                <td><LivePrice price={stock.livePrice} showChange={false} /></td>
                <td style={{ color: stock.liveChange >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  {stock.liveChange >= 0 ? '+' : ''}{stock.liveChange?.toFixed(2)}%
                </td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{stock.pe.toFixed(1)}</td>
                <td style={{ color: stock.roe > 20 ? 'var(--accent-green)' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{stock.roe}%</td>
                <td>{getCapBadge(stock.capSize)}</td>
                <td><span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{stock.sector}</span></td>
              </tr>
            ))}
            {/* Expanded radar chart row - rendered separately to avoid nesting issues */}
            {filtered.map(stock => (
              expandedStock === stock.id && (
                <tr key={`${stock.id}-exp`}>
                  <td colSpan={9} style={{ background: 'var(--bg-card)', padding: 24 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: 24 }}>
                      <div className="radar-container">
                        <RadarScoreChart scores={stock.score.breakdown} maxScores={stock.score.maxScores} size={220} />
                      </div>
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 16 }}>
                          {Object.entries(stock.score.breakdown).map(([key, val]) => (
                            <div key={key} style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>{key}</div>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>{val}</div>
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>/ {stock.score.maxScores[key]}</div>
                              <div className="rebalance-bar" style={{ marginTop: 4 }}>
                                <div className="rebalance-fill" style={{ width: `${(val / stock.score.maxScores[key]) * 100}%`, background: 'var(--gradient-blue)' }} />
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <span>ROCE: <strong style={{ color: 'var(--accent-cyan)' }}>{stock.roce}%</strong></span>
                          <span>D/E: <strong>{stock.debtEquity}</strong></span>
                          <span>Rev CAGR: <strong>{stock.revenueCagr3y}%</strong></span>
                          <span>EBITDA: <strong>{stock.ebitdaMargin}%</strong></span>
                          <span>RSI: <strong>{stock.rsi}</strong></span>
                          <span>Promoter: <strong>{stock.promoterHolding}%</strong></span>
                          <span>1Y Return: <strong style={{ color: stock.historicalReturns['1y'] > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{stock.historicalReturns['1y']}%</strong></span>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
