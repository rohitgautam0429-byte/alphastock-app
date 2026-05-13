import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link2, Bell, Shield, User, ExternalLink, CheckCircle, AlertCircle, Wallet, TrendingUp, Package } from 'lucide-react';

export default function Settings() {
  const [searchParams] = useSearchParams();
  const [upstoxStatus, setUpstoxStatus] = useState({ connected: false, apiKeyConfigured: false });
  const [upstoxProfile, setUpstoxProfile] = useState(null);
  const [upstoxHoldings, setUpstoxHoldings] = useState(null);
  const [upstoxFunds, setUpstoxFunds] = useState(null);
  const [loadingUpstox, setLoadingUpstox] = useState(true);
  const [toast, setToast] = useState(null);

  const [connectedBrokers, setConnectedBrokers] = useState({});
  const [notifPrefs, setNotifPrefs] = useState({
    buySignals: true,
    volumeSurge: true,
    earningsUpdates: true,
    sectorUpgrades: true,
    macroAlerts: false,
    rebalanceAlerts: true,
  });
  const [channels, setChannels] = useState({
    inApp: true,
    push: true,
    email: false,
    sms: false,
  });
  const [riskProfile, setRiskProfile] = useState('moderate');

  // Check Upstox connection status on load
  useEffect(() => {
    async function checkUpstox() {
      try {
        const statusRes = await fetch('/api/upstox/status');
        const status = await statusRes.json();
        setUpstoxStatus(status);

        if (status.connected) {
          setConnectedBrokers(prev => ({ ...prev, upstox: true }));
          
          // Fetch profile, holdings, funds in parallel
          const [profileRes, holdingsRes, fundsRes] = await Promise.all([
            fetch('/api/upstox/profile').then(r => r.json()).catch(() => null),
            fetch('/api/upstox/holdings').then(r => r.json()).catch(() => null),
            fetch('/api/upstox/funds').then(r => r.json()).catch(() => null),
          ]);
          
          setUpstoxProfile(profileRes?.data || null);
          setUpstoxHoldings(holdingsRes?.data || []);
          setUpstoxFunds(fundsRes?.data || null);
        }
      } catch (err) {
        console.error('Upstox status check failed:', err);
      } finally {
        setLoadingUpstox(false);
      }
    }
    checkUpstox();
  }, []);

  // Handle OAuth callback messages
  useEffect(() => {
    const upstoxParam = searchParams.get('upstox');
    if (upstoxParam === 'connected') {
      setToast({ type: 'success', message: '✅ Upstox connected successfully! Your portfolio is now synced.' });
      setTimeout(() => setToast(null), 5000);
      // Refresh status
      fetch('/api/upstox/status').then(r => r.json()).then(s => setUpstoxStatus(s));
    } else if (upstoxParam === 'error') {
      const msg = searchParams.get('msg') || 'Connection failed';
      setToast({ type: 'error', message: `❌ Upstox error: ${msg}` });
      setTimeout(() => setToast(null), 5000);
    }
  }, [searchParams]);

  const handleUpstoxConnect = () => {
    window.location.href = '/api/upstox/login';
  };

  const toggleNotif = (key) => {
    setNotifPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleChannel = (key) => {
    setChannels(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const Toggle = ({ active, onClick }) => (
    <button className={`toggle ${active ? 'active' : ''}`} onClick={onClick}>
      <div className="toggle-knob" />
    </button>
  );

  const totalHoldingsValue = upstoxHoldings?.reduce((sum, h) => sum + (h.last_price * h.quantity), 0) || 0;
  const totalInvestment = upstoxHoldings?.reduce((sum, h) => sum + (h.average_price * h.quantity), 0) || 0;
  const totalPnL = totalHoldingsValue - totalInvestment;
  const totalPnLPercent = totalInvestment > 0 ? (totalPnL / totalInvestment * 100) : 0;

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 100,
          background: toast.type === 'success' ? 'var(--bg-secondary)' : 'var(--bg-secondary)',
          borderLeft: `4px solid ${toast.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)'}`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)', padding: '16px 20px', borderRadius: 8,
          display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500,
        }} className="animate-in">
          {toast.type === 'success' ? <CheckCircle color="var(--accent-green)" size={20} /> : <AlertCircle color="var(--accent-red)" size={20} />}
          {toast.message}
        </div>
      )}

      <div className="section-header animate-in">
        <div>
          <div className="section-title">Settings</div>
          <div className="section-subtitle">Broker connections, notifications, and risk preferences</div>
        </div>
      </div>

      {/* ═══ UPSTOX INTEGRATION CARD — Full Width ═══ */}
      <div className="glass-card animate-in" style={{ marginBottom: 24, border: upstoxStatus.connected ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(124,58,237,0.3)', background: upstoxStatus.connected ? 'linear-gradient(135deg, rgba(16,185,129,0.05) 0%, rgba(15,23,42,0.9) 100%)' : 'linear-gradient(135deg, rgba(124,58,237,0.05) 0%, rgba(15,23,42,0.9) 100%)' }}>
        <div className="card-header" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#7c3aed20', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed', fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800 }}>U</div>
            <div>
              <span className="card-title" style={{ fontSize: '1.1rem' }}>Upstox Trading Account</span>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {upstoxStatus.connected 
                  ? `Connected${upstoxProfile ? ` • ${upstoxProfile.user_name || upstoxProfile.user_id}` : ''}` 
                  : 'Connect your Upstox demat for live portfolio sync'}
              </div>
            </div>
          </div>
          {upstoxStatus.connected ? (
            <span className="badge badge-buy" style={{ fontSize: '0.8rem' }}>● Connected</span>
          ) : (
            <button className="btn btn-primary" onClick={handleUpstoxConnect} style={{ gap: 8 }}>
              <Link2 size={16} /> Connect Upstox
            </button>
          )}
        </div>

        {upstoxStatus.connected && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 8 }}>
            {/* Portfolio Value */}
            <div style={{ padding: 16, background: 'var(--bg-glass)', borderRadius: 10, border: '1px solid var(--border-glass)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Wallet size={16} color="var(--accent-cyan)" />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Portfolio Value</span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3rem', fontWeight: 700 }}>
                ₹{totalHoldingsValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
            </div>

            {/* Total P&L */}
            <div style={{ padding: 16, background: 'var(--bg-glass)', borderRadius: 10, border: '1px solid var(--border-glass)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <TrendingUp size={16} color={totalPnL >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Total P&L</span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3rem', fontWeight: 700, color: totalPnL >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {totalPnL >= 0 ? '+' : ''}₹{totalPnL.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                <span style={{ fontSize: '0.8rem', marginLeft: 6 }}>({totalPnLPercent >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%)</span>
              </div>
            </div>

            {/* Holdings Count */}
            <div style={{ padding: 16, background: 'var(--bg-glass)', borderRadius: 10, border: '1px solid var(--border-glass)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Package size={16} color="var(--accent-gold)" />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Holdings</span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3rem', fontWeight: 700 }}>
                {upstoxHoldings?.length || 0} stocks
              </div>
            </div>

            {/* Available Margin */}
            <div style={{ padding: 16, background: 'var(--bg-glass)', borderRadius: 10, border: '1px solid var(--border-glass)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Wallet size={16} color="#3b82f6" />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Available Margin</span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3rem', fontWeight: 700 }}>
                ₹{(upstoxFunds?.equity?.available_margin || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
        )}

        {/* Holdings Table */}
        {upstoxStatus.connected && upstoxHoldings && upstoxHoldings.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>
              Your Holdings
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem' }}>Stock</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem' }}>Qty</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem' }}>Avg Price</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem' }}>LTP</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem' }}>P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {upstoxHoldings.map((h, i) => {
                    const pnl = (h.last_price - h.average_price) * h.quantity;
                    const pnlPct = h.average_price > 0 ? ((h.last_price - h.average_price) / h.average_price * 100) : 0;
                    const isUp = pnl >= 0;
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{h.tradingsymbol || h.trading_symbol || 'N/A'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{h.quantity}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>₹{h.average_price?.toFixed(2)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>₹{h.last_price?.toFixed(2)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: isUp ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600 }}>
                          {isUp ? '+' : ''}₹{pnl.toFixed(0)} ({isUp ? '+' : ''}{pnlPct.toFixed(2)}%)
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!upstoxStatus.connected && !loadingUpstox && (
          <div style={{ marginTop: 12, padding: 14, background: 'rgba(124,58,237,0.06)', borderRadius: 10, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            🔐 <strong>How it works:</strong> Click "Connect Upstox" → Login to your Upstox account → Authorize AlphaBasket → Your portfolio syncs automatically. OAuth-based secure connection — your password is never shared.
          </div>
        )}
      </div>

      <div className="grid-2 animate-in">
        {/* Left Column */}
        <div>
          {/* Other Brokers */}
          <div className="glass-card" style={{ marginBottom: 24 }}>
            <div className="settings-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Link2 size={18} color="var(--accent-cyan)" />
                <div className="settings-section-title" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>Other Brokers (Coming Soon)</div>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                Zerodha, Angel One, and Groww integration coming soon
              </div>
              {[
                { id: 'zerodha', name: 'Zerodha', subtitle: 'Kite Connect API', color: '#387ed1', logo: 'Z' },
                { id: 'angelone', name: 'Angel One', subtitle: 'SmartAPI', color: '#ef4444', logo: 'A' },
                { id: 'groww', name: 'Groww', subtitle: 'Groww API', color: '#00d09c', logo: 'G' },
              ].map(broker => (
                <div key={broker.id} className="broker-card">
                  <div className="broker-info">
                    <div className="broker-logo" style={{ background: `${broker.color}20`, color: broker.color, fontFamily: 'var(--font-display)' }}>
                      {broker.logo}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{broker.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{broker.subtitle}</div>
                    </div>
                  </div>
                  <span className="badge" style={{ background: 'var(--bg-glass)', color: 'var(--text-muted)', fontSize: '0.7rem' }}>Coming Soon</span>
                </div>
              ))}
            </div>
          </div>

          {/* Risk Profile */}
          <div className="glass-card">
            <div className="settings-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Shield size={18} color="var(--accent-gold)" />
                <div className="settings-section-title" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>Risk Profile</div>
              </div>
              {[
                { id: 'conservative', label: 'Conservative', desc: 'Focus on large cap bluechips. Max 10% small cap.', color: '#3b82f6' },
                { id: 'moderate', label: 'Moderate', desc: 'Balanced 50/30/20 allocation. Standard basket.', color: '#F5C518' },
                { id: 'aggressive', label: 'Aggressive', desc: 'Higher small/mid cap. Theme-heavy allocation.', color: '#ef4444' },
              ].map(profile => (
                <div
                  key={profile.id}
                  onClick={() => setRiskProfile(profile.id)}
                  style={{
                    padding: 16,
                    background: riskProfile === profile.id ? `${profile.color}10` : 'var(--bg-glass)',
                    border: `1px solid ${riskProfile === profile.id ? profile.color + '50' : 'var(--border-glass)'}`,
                    borderRadius: 10,
                    marginBottom: 8,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: riskProfile === profile.id ? profile.color : 'var(--text-primary)' }}>{profile.label}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{profile.desc}</div>
                    </div>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%',
                      border: `2px solid ${riskProfile === profile.id ? profile.color : 'var(--border-glass)'}`,
                      background: riskProfile === profile.id ? profile.color : 'transparent',
                      transition: 'all 0.2s',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div>
          {/* Notification Preferences */}
          <div className="glass-card" style={{ marginBottom: 24 }}>
            <div className="settings-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Bell size={18} color="var(--accent-cyan)" />
                <div className="settings-section-title" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>Notification Preferences</div>
              </div>
              {[
                { key: 'buySignals', label: 'Buy Signals', desc: 'When a stock enters the AI basket (score ≥ 70)' },
                { key: 'volumeSurge', label: 'Volume Surge', desc: 'When volume exceeds 1.5x average' },
                { key: 'earningsUpdates', label: 'Earnings Updates', desc: 'Post-result commentary score changes' },
                { key: 'sectorUpgrades', label: 'Sector Upgrades', desc: 'Sector trend changes and policy impacts' },
                { key: 'macroAlerts', label: 'Macro Alerts', desc: 'RBI policy, Fed decisions, global signals' },
                { key: 'rebalanceAlerts', label: 'Rebalance Alerts', desc: 'Quarterly and event-driven rebalancing' },
              ].map(pref => (
                <div key={pref.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-glass)' }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{pref.label}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{pref.desc}</div>
                  </div>
                  <Toggle active={notifPrefs[pref.key]} onClick={() => toggleNotif(pref.key)} />
                </div>
              ))}
            </div>
          </div>

          {/* Notification Channels */}
          <div className="glass-card">
            <div className="settings-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Bell size={18} color="var(--accent-gold)" />
                <div className="settings-section-title" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>Delivery Channels</div>
              </div>
              {[
                { key: 'inApp', label: 'In-App Notifications', desc: 'Bell icon notification feed' },
                { key: 'push', label: 'Push Notifications', desc: 'Browser push via Firebase' },
                { key: 'email', label: 'Email (SendGrid)', desc: 'Stock summary cards via email' },
                { key: 'sms', label: 'SMS (Twilio)', desc: 'Urgent alerts via SMS' },
              ].map(ch => (
                <div key={ch.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-glass)' }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{ch.label}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{ch.desc}</div>
                  </div>
                  <Toggle active={channels[ch.key]} onClick={() => toggleChannel(ch.key)} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
