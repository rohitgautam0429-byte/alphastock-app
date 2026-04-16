import { AlertTriangle, Globe, Shield, TrendingUp } from 'lucide-react';
import { trendingThemes, globalMacroSignals, policyTracker } from '../data/themes';

export default function TrendsRadar() {
  return (
    <div>
      <div className="section-header animate-in">
        <div>
          <div className="section-title">Macro Radar & Sector Trends</div>
          <div className="section-subtitle">AI-curated trending sectors, policy tracker, and global macro intelligence</div>
        </div>
      </div>

      {/* Global Macro Signals */}
      <div className="glass-card animate-in" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">🌍 Global Macro Overlay</span>
          <span className="card-subtitle">Risk flags impacting Indian markets</span>
        </div>
        <div className="grid-3">
          {globalMacroSignals.map((signal, i) => (
            <div key={i} style={{ padding: 16, background: 'var(--bg-glass)', borderRadius: 12, border: `1px solid ${signal.color}30`, borderLeft: `3px solid ${signal.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{signal.signal}</div>
                <span className="badge" style={{ background: `${signal.color}15`, color: signal.color }}>{signal.status}</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{signal.impact}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Policy Tracker */}
      <div className="glass-card animate-in" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">📋 Policy Tracker</span>
          <span className="card-subtitle">Budget, RBI, PLI schemes — auto-tagged to relevant stocks</span>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>Policy</th><th>Date</th><th>Status</th><th>Impact</th><th>Affected Sectors</th></tr>
          </thead>
          <tbody>
            {policyTracker.map((policy, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{policy.policy}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{policy.date}</td>
                <td>
                  <span className="badge" style={{
                    background: policy.status === 'Announced' ? 'rgba(16,185,129,0.15)' : 'rgba(0,212,255,0.15)',
                    color: policy.status === 'Announced' ? 'var(--accent-green)' : 'var(--accent-cyan)',
                  }}>{policy.status}</span>
                </td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: 300 }}>{policy.impact}</td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {policy.affectedSectors.map(s => (
                      <span key={s} className="theme-play-tag">{s}</span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Trending Sector Themes */}
      <div className="section-header animate-in">
        <div className="section-title">🔥 Trending Sector Themes</div>
        <span className="card-subtitle">Updated monthly • AI rebalancing suggestions</span>
      </div>
      <div className="grid-2 animate-in">
        {trendingThemes.map(theme => (
          <div key={theme.id} className="theme-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="theme-icon" style={{ background: `${theme.color}15` }}>
                {theme.icon}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span className="badge" style={{ background: `${theme.color}15`, color: theme.color }}>{theme.outlook}</span>
                <span className="badge" style={{ background: 'var(--bg-glass)', color: 'var(--text-muted)' }}>{theme.timeframe}</span>
              </div>
            </div>
            <div className="theme-name" style={{ color: theme.color }}>{theme.name}</div>
            <div className="theme-desc">{theme.description}</div>
            <div style={{ marginBottom: 12, padding: 10, background: 'var(--bg-glass)', borderRadius: 8, fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>
              <strong>Catalyst:</strong> {theme.catalyst}
            </div>
            <div className="theme-plays">
              <div className="theme-play-label">Key Plays</div>
              <div className="theme-play-list">
                {theme.plays.map(play => (
                  <span key={play} className="theme-play-tag" style={{ borderLeft: `2px solid ${theme.color}` }}>{play}</span>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 12, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Tailwind Multiplier: <strong style={{ color: theme.color, fontFamily: 'var(--font-mono)' }}>{theme.tailwindMultiplier}x</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
