import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { stocks } from '../data/stocks';
import { constructBasket, masterAllocation } from '../data/portfolio';
import { ScoreGauge, MiniChart, getCapBadge, LivePrice } from '../components/Charts';
import { useStockPrices } from '../services/marketData';

export default function Basket() {
  const stockIds = useMemo(() => stocks.map(s => s.id), []);
  const { prices: livePrices } = useStockPrices(stockIds, 30000);
  const basket = useMemo(() => constructBasket(stocks, livePrices), [livePrices]);

  const sectorDist = useMemo(() => {
    const map = {};
    basket.equityBasket.forEach(s => {
      map[s.sector] = (map[s.sector] || 0) + s.weight;
    });
    const colors = ['#3b82f6','#8b5cf6','#10b981','#F5C518','#ef4444','#00D4FF','#ec4899','#22c55e','#94a3b8','#f97316'];
    return Object.entries(map).map(([sector, weight], i) => ({ name: sector, value: Math.round(weight * 10) / 10, color: colors[i % colors.length] }));
  }, [basket]);

  const allocationOverview = [
    { name: 'Large Cap (50%)', value: masterAllocation.largeCap, color: '#3b82f6' },
    { name: 'Mid Cap (30%)', value: masterAllocation.midCap, color: '#8b5cf6' },
    { name: 'Small Cap (20%)', value: masterAllocation.smallCap, color: '#ec4899' },
  ];

  const basketTodayGain = useMemo(() => {
    let sum = 0;
    basket.equityBasket.forEach(stock => {
      const liveData = livePrices[stock.id];
      const changePct = liveData ? liveData.changePercent : 0;
      sum += (changePct * (stock.weight / 100));
    });
    return sum;
  }, [basket, livePrices]);

  const navigate = useNavigate();

  const renderRow = (stock) => {
    const reasons = stock.reasons || [];
    const isTopPick = stock.score.total >= 70;
    return (
      <tr 
        key={stock.id} 
        onClick={() => navigate(`/stock/${encodeURIComponent(stock.nseSymbol || stock.id)}`)} 
        style={{ cursor: 'pointer' }}
      >
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isTopPick && <span style={{ color: 'var(--accent-gold)', fontSize: '0.9rem' }}>★</span>}
            <div>
              <div style={{ fontWeight: 600 }}>{stock.id}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{stock.name}</div>
            </div>
          </div>
        </td>
        <td><ScoreGauge score={stock.score.total} size={36} strokeWidth={3} /></td>
        <td>{getCapBadge(stock.capSize)}</td>
        <td><LivePrice price={stock.livePrice || stock.price} changePercent={stock.liveChange ?? stock.change} /></td>
        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-cyan)' }}>{stock.weight}%</td>
        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          ₹{stock.buyZoneLow?.toLocaleString('en-IN')} – ₹{stock.buyZoneHigh?.toLocaleString('en-IN')}
        </td>
        <td><MiniChart data={stock.priceHistory} color={(stock.liveChange ?? stock.change) >= 0 ? '#10b981' : '#ef4444'} height={28} width={70} /></td>
        <td>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {reasons.slice(0, 2).map((r, j) => (
              <span key={j} style={{ background: 'rgba(0,212,255,0.1)', padding: '2px 8px', borderRadius: 6, fontSize: '0.68rem', color: 'var(--accent-cyan)' }}>{r}</span>
            ))}
          </div>
        </td>
      </tr>
    );
  };

  const largeCap = basket.equityBasket.filter(s => s.capSize === 'Large');
  const midCap = basket.equityBasket.filter(s => s.capSize === 'Mid');
  const smallCap = basket.equityBasket.filter(s => s.capSize === 'Small');

  return (
    <div>
      <div className="section-header animate-in">
        <div>
          <div className="section-title">AI-Constructed Portfolio Basket</div>
          <div className="section-subtitle">
            {basket.equityBasket.length} stocks • 50/30/20 allocation • {basket.metadata?.policy || 'AI-optimized weights'} • refreshed {basket.metadata?.refreshedAtLabel || 'live'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.5rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: basketTodayGain >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            {basketTodayGain >= 0 ? '+' : ''}{basketTodayGain.toFixed(2)}% Today
          </div>
          <div className="live-indicator" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <div className="live-pulse" /><span>LIVE</span>
          </div>
        </div>
      </div>

      {/* Allocation Overview */}
      <div className="grid-3 animate-in" style={{ marginBottom: 24 }}>
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <ResponsiveContainer width={140} height={140}>
            <PieChart>
              <Pie data={allocationOverview} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={4} dataKey="value" stroke="none">
                {allocationOverview.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#0F1529', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: '0.8rem' }} formatter={v => `${v}%`} />
            </PieChart>
          </ResponsiveContainer>
          <div>
            <div className="card-title" style={{ marginBottom: 12 }}>Basket Allocation</div>
            {allocationOverview.map(a => (
              <div key={a.name} className="legend-item" style={{ marginBottom: 6 }}>
                <span className="legend-label"><span className="legend-color" style={{ background: a.color }} />{a.name}</span>
                <span className="legend-value">{a.value}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <ResponsiveContainer width={140} height={140}>
            <PieChart>
              <Pie data={sectorDist} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value" stroke="none">
                {sectorDist.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#0F1529', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: '0.8rem' }} formatter={v => `${v}%`} />
            </PieChart>
          </ResponsiveContainer>
          <div>
            <div className="card-title" style={{ marginBottom: 12 }}>Sector Distribution</div>
            {sectorDist.slice(0, 5).map(s => (
              <div key={s.name} className="legend-item" style={{ marginBottom: 4, fontSize: '0.8rem' }}>
                <span className="legend-label"><span className="legend-color" style={{ background: s.color }} />{s.name}</span>
                <span className="legend-value">{s.value}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card">
          <div className="card-title" style={{ marginBottom: 16 }}>Basket Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Large Cap', count: largeCap.length, color: '#3b82f6' },
              { label: 'Mid Cap', count: midCap.length, color: '#8b5cf6' },
              { label: 'Small Cap', count: smallCap.length, color: '#ec4899' },
              { label: 'Cycle', count: basket.metadata?.rotationKey || basket.equityBasket.length, color: 'var(--accent-cyan)' },
            ].map(item => (
              <div key={item.label} style={{ textAlign: 'center', padding: 12, background: 'var(--bg-glass)', borderRadius: 10 }}>
                <div className="stat-value" style={{ fontSize: '1.5rem', color: item.color }}>{item.count}</div>
                <div className="stat-label">{item.label}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Next review: {basket.metadata?.nextReviewLabel || 'weekly'}. Replacements are pulled from the reserve list when score, momentum, or risk changes.
          </div>
        </div>
      </div>

      {/* Stock Tables by Cap */}
      {[
        { label: 'Large Cap Holdings', data: largeCap, pct: '50%', color: '#3b82f6' },
        { label: 'Mid Cap Holdings', data: midCap, pct: '30%', color: '#8b5cf6' },
        { label: 'Small Cap Holdings', data: smallCap, pct: '20%', color: '#ec4899' },
      ].map(section => (
        <div key={section.label} className="glass-card animate-in" style={{ marginBottom: 24, overflow: 'auto' }}>
          <div className="card-header">
            <span className="card-title">{section.label}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: section.color }}>{section.pct} allocation</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Stock</th><th>Score</th><th>Cap</th><th>Price</th><th>Weight</th><th>Buy Zone</th><th>Chart</th><th>Why Selected</th>
              </tr>
            </thead>
            <tbody>{section.data.map(renderRow)}</tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
