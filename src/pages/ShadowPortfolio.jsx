import { useState, useMemo, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Wallet, TrendingUp, TrendingDown, AlertTriangle, Award, Target } from 'lucide-react';
import { stocks } from '../data/stocks';
import { scoreAllStocks } from '../data/scoring';
import { stressScenarios, getVirtualPortfolio, saveVirtualPortfolio } from '../data/portfolio';
import { useStockPrices } from '../services/marketData';

export default function ShadowPortfolio() {
  const initialData = useMemo(() => getVirtualPortfolio(), []);
  const [capital, setCapital] = useState(initialData.capital);
  const [holdings, setHoldings] = useState(initialData.holdings);
  const [transactions, setTransactions] = useState(initialData.transactions);
  
  useEffect(() => {
    saveVirtualPortfolio({ capital, holdings, transactions });
  }, [capital, holdings, transactions]);

  const [activeTab, setActiveTab] = useState('portfolio');
  const [selectedScenario, setSelectedScenario] = useState(null);

  const scoredStocks = useMemo(() => scoreAllStocks(stocks), []);
  const stockIds = useMemo(() => stocks.map(s => s.id), []);
  const { prices: livePrices } = useStockPrices(stockIds, 30000);

  const invested = holdings.reduce((sum, h) => sum + h.buyPrice * h.qty, 0);
  const currentVal = holdings.reduce((sum, h) => {
    const livePrice = livePrices[h.id]?.price || stocks.find(s => s.id === h.id)?.price || h.buyPrice;
    return sum + livePrice * h.qty;
  }, 0);
  const pnl = currentVal - invested;
  const pnlPct = invested > 0 ? (pnl / invested * 100) : 0;
  const remaining = capital - invested;
  const winningTrades = holdings.filter(h => {
    const livePrice = livePrices[h.id]?.price || stocks.find(s => s.id === h.id)?.price || h.buyPrice;
    return livePrice > h.buyPrice;
  }).length;
  const winRate = holdings.length > 0 ? ((winningTrades / holdings.length) * 100).toFixed(0) : 0;

  const buyItem = (item) => {
    const qty = Math.floor(Math.min(remaining * 0.1, 50000) / item.price);
    if (qty <= 0 || item.price * qty > remaining) return;
    const existing = holdings.find(h => h.id === item.id);
    if (existing) {
      setHoldings(holdings.map(h => h.id === item.id ? { ...h, qty: h.qty + qty, buyPrice: ((h.buyPrice * h.qty) + (item.price * qty)) / (h.qty + qty) } : h));
    } else {
      setHoldings([...holdings, { id: item.id, name: item.name, qty, buyPrice: item.price, sector: item.sector, capSize: item.capSize }]);
    }
    setTransactions([{ id: item.id, name: item.name, type: 'BUY', qty, price: item.price, time: new Date().toLocaleTimeString('en-IN'), date: new Date().toLocaleDateString('en-IN') }, ...transactions]);
  };

  const sellItem = (holdingId) => {
    const h = holdings.find(x => x.id === holdingId);
    if (!h) return;
    const livePrice = livePrices[h.id]?.price || stocks.find(s => s.id === h.id)?.price || h.buyPrice;
    setTransactions([{ id: h.id, name: h.name, type: 'SELL', qty: h.qty, price: livePrice, time: new Date().toLocaleTimeString('en-IN'), date: new Date().toLocaleDateString('en-IN') }, ...transactions]);
    setHoldings(holdings.filter(x => x.id !== holdingId));
  };

  const perfData = [
    { month: 'M1', portfolio: 100, nifty: 100 },
    { month: 'M2', portfolio: 103, nifty: 102 },
    { month: 'M3', portfolio: 108, nifty: 105 },
    { month: 'M4', portfolio: 112, nifty: 108 },
    { month: 'M5', portfolio: 115, nifty: 110 },
    { month: 'M6', portfolio: 120, nifty: 114 },
    { month: 'M7', portfolio: 118, nifty: 112 },
    { month: 'M8', portfolio: 125, nifty: 118 },
    { month: 'M9', portfolio: 130, nifty: 120 },
    { month: 'M10', portfolio: 128, nifty: 119 },
    { month: 'M11', portfolio: 133, nifty: 124 },
    { month: 'M12', portfolio: 138, nifty: 126 },
  ];

  return (
    <div>
      <div className="section-header animate-in">
        <div>
          <div className="section-title">Shadow Portfolio</div>
          <div className="section-subtitle">Virtual investing • ₹10,00,000 starting capital • No real money at risk</div>
        </div>
        <div className="live-indicator"><div className="live-pulse" /><span>LIVE P&L</span></div>
      </div>

      {/* Stats */}
      <div className="grid-4 animate-in" style={{ marginBottom: 24 }}>
        <div className="glass-card" style={{ borderTop: '2px solid var(--accent-cyan)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Wallet size={16} color="var(--accent-cyan)" />
            <span className="card-subtitle">Virtual Capital</span>
          </div>
          <div className="capital-input-group">
            <span style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>₹</span>
            <input className="capital-input" type="number" value={capital} onChange={e => setCapital(Number(e.target.value))} style={{ width: '100%' }} />
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Remaining: <strong style={{ color: 'var(--accent-cyan)' }}>₹{remaining.toLocaleString('en-IN')}</strong></div>
        </div>
        <div className="glass-card" style={{ borderTop: '2px solid var(--accent-blue)' }}>
          <div className="card-subtitle" style={{ marginBottom: 8 }}>Total Invested</div>
          <div className="stat-value" style={{ color: 'var(--accent-blue)' }}>₹{invested.toLocaleString('en-IN')}</div>
          <div className="stat-label">{holdings.length} positions</div>
        </div>
        <div className="glass-card" style={{ borderTop: `2px solid ${pnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}` }}>
          <div className="card-subtitle" style={{ marginBottom: 8 }}>P&L (Real-Time)</div>
          <div className="stat-value" style={{ color: pnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            {pnl >= 0 ? '+' : ''}₹{Math.round(pnl).toLocaleString('en-IN')}
          </div>
          <div className="stat-change" style={{ color: pnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
          </div>
        </div>
        <div className="glass-card" style={{ borderTop: '2px solid var(--accent-gold)' }}>
          <div className="card-subtitle" style={{ marginBottom: 8 }}>Win Rate</div>
          <div className="stat-value" style={{ color: 'var(--accent-gold)' }}>{winRate}%</div>
          <div className="stat-label">{winningTrades}/{holdings.length} profitable</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs animate-in">
        {['portfolio', 'buy', 'performance', 'stress'].map(tab => (
          <button key={tab} className={`tab-btn ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab === 'portfolio' ? 'Portfolio' : tab === 'buy' ? 'Buy Stocks' : tab === 'performance' ? 'Performance' : 'Stress Test'}
          </button>
        ))}
      </div>

      {/* Portfolio Tab */}
      {activeTab === 'portfolio' && (
        <div className="glass-card animate-in">
          {holdings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <Wallet size={48} style={{ marginBottom: 12, opacity: 0.3 }} />
              <div style={{ fontSize: '1rem', marginBottom: 8 }}>No holdings yet</div>
              <div style={{ fontSize: '0.85rem' }}>Use the "Buy Stocks" tab to start building your virtual portfolio</div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Name</th><th>Qty</th><th>Buy Price</th><th>Current (Live)</th><th>P&L</th><th>Return</th><th>Action</th></tr>
              </thead>
              <tbody>
                {holdings.map(h => {
                  const livePrice = livePrices[h.id]?.price || stocks.find(s => s.id === h.id)?.price || h.buyPrice;
                  const hPnl = (livePrice - h.buyPrice) * h.qty;
                  const hReturn = ((livePrice - h.buyPrice) / h.buyPrice * 100);
                  return (
                    <tr key={h.id}>
                      <td><div style={{ fontWeight: 600 }}>{h.name}</div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{h.sector} • {h.capSize} Cap</div></td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{h.qty}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>₹{h.buyPrice.toLocaleString('en-IN')}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>₹{livePrice.toLocaleString('en-IN')}</td>
                      <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: hPnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {hPnl >= 0 ? '+' : ''}₹{Math.round(hPnl).toLocaleString('en-IN')}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: hReturn >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {hReturn >= 0 ? '+' : ''}{hReturn.toFixed(2)}%
                      </td>
                      <td><button className="btn btn-danger btn-sm" onClick={() => sellItem(h.id)}>Sell</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {transactions.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div className="card-title" style={{ marginBottom: 12 }}>Transaction Log</div>
              {transactions.slice(0, 10).map((t, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-glass)', fontSize: '0.82rem' }}>
                  <span className={`badge ${t.type === 'BUY' ? 'badge-buy' : 'badge-sell'}`}>{t.type}</span>
                  <span>{t.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{t.qty} × ₹{t.price.toLocaleString('en-IN')}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{t.date} {t.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Buy Stocks Tab */}
      {activeTab === 'buy' && (
        <div className="glass-card animate-in" style={{ overflow: 'auto' }}>
          <div className="card-header">
            <span className="card-title">Available Stocks — Top Scored</span>
            <span className="card-subtitle">Click Buy to add to virtual portfolio (auto-allocates ~10% of remaining capital)</span>
          </div>
          <table className="data-table">
            <thead><tr><th>Stock</th><th>Score</th><th>Live Price</th><th>Change</th><th>Sector</th><th>Cap</th><th>Action</th></tr></thead>
            <tbody>
              {scoredStocks.slice(0, 25).map(s => {
                const livePrice = livePrices[s.id]?.price || s.price;
                const liveChange = livePrices[s.id]?.changePercent ?? s.change;
                return (
                  <tr key={s.id}>
                    <td><div style={{ fontWeight: 600 }}>{s.id}</div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.name}</div></td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: s.score.total >= 65 ? 'var(--accent-cyan)' : 'var(--accent-gold)' }}>{s.score.total}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>₹{livePrice.toLocaleString('en-IN')}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: liveChange >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{liveChange >= 0 ? '+' : ''}{liveChange?.toFixed(2)}%</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{s.sector}</td>
                    <td>{s.capSize}</td>
                    <td><button className="btn btn-primary btn-sm" onClick={() => buyItem({ ...s, price: livePrice })}>Buy</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Performance Tab */}
      {activeTab === 'performance' && (
        <div className="glass-card animate-in">
          <div className="card-header">
            <span className="card-title">Performance vs Nifty 50 Benchmark (Simulated 1Y)</span>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={perfData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip contentStyle={{ background: '#0F1529', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: '0.8rem' }} />
              <Area type="monotone" dataKey="portfolio" name="Portfolio" stroke="#00D4FF" strokeWidth={2} fill="rgba(0,212,255,0.1)" />
              <Area type="monotone" dataKey="nifty" name="Nifty 50" stroke="#3b82f6" strokeWidth={1.5} fill="none" strokeDasharray="4 4" />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 24, marginTop: 16, fontSize: '0.8rem' }}>
            <span style={{ color: '#00D4FF' }}>● Your Portfolio +38%</span>
            <span style={{ color: '#3b82f6' }}>● Nifty 50 +26%</span>
          </div>
        </div>
      )}

      {/* Stress Test Tab */}
      {activeTab === 'stress' && (
        <div className="grid-2 animate-in">
          <div className="glass-card">
            <div className="card-title" style={{ marginBottom: 16 }}>Stress Test Scenarios</div>
            {stressScenarios.map(sc => (
              <div key={sc.id} className={`scenario-card ${selectedScenario?.id === sc.id ? 'active' : ''}`} onClick={() => setSelectedScenario(sc)} style={{ marginBottom: 8 }}>
                <div className="scenario-name">{sc.name}</div>
                <div className="scenario-desc">{sc.description}</div>
                <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--accent-red)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  Equity Impact: {sc.equityImpact}%
                </div>
              </div>
            ))}
          </div>
          <div className="glass-card">
            <div className="card-title" style={{ marginBottom: 16 }}>Impact Analysis</div>
            {selectedScenario ? (
              <div>
                <h3 style={{ color: 'var(--accent-cyan)', marginBottom: 16, fontFamily: 'var(--font-display)' }}>{selectedScenario.name}</h3>
                <div style={{ marginBottom: 20 }}>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={[{ name: 'Portfolio Impact', impact: selectedScenario.equityImpact }]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip contentStyle={{ background: '#0F1529', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                      <Bar dataKey="impact" name="Impact %">
                        <Cell fill="#ef4444" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="warning-box">
                  <div className="warning-title"><AlertTriangle size={16} /> Portfolio Impact</div>
                  <div className="warning-text">
                    Based on ₹{capital.toLocaleString('en-IN')} portfolio, estimated impact:<br />
                    <strong style={{ fontFamily: 'var(--font-mono)' }}>
                      Estimated loss: ₹{Math.abs(Math.round(capital * selectedScenario.equityImpact / 100)).toLocaleString('en-IN')} ({selectedScenario.equityImpact}%)
                    </strong>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                Select a scenario to see the impact analysis
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
