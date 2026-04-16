import { useState } from 'react';
import { Link2, Bell, Shield, User, ExternalLink } from 'lucide-react';

const brokers = [
  { id: 'zerodha', name: 'Zerodha', subtitle: 'Kite Connect API', color: '#387ed1', logo: 'Z' },
  { id: 'angelone', name: 'Angel One', subtitle: 'SmartAPI', color: '#ef4444', logo: 'A' },
  { id: 'upstox', name: 'Upstox', subtitle: 'Upstox API v2', color: '#7c3aed', logo: 'U' },
  { id: 'groww', name: 'Groww', subtitle: 'Groww API', color: '#00d09c', logo: 'G' },
];

export default function Settings() {
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

  const toggleBroker = (id) => {
    setConnectedBrokers(prev => ({ ...prev, [id]: !prev[id] }));
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

  return (
    <div>
      <div className="section-header animate-in">
        <div>
          <div className="section-title">Settings</div>
          <div className="section-subtitle">Broker connections, notifications, and risk preferences</div>
        </div>
      </div>

      <div className="grid-2 animate-in">
        {/* Left Column */}
        <div>
          {/* Broker Connections */}
          <div className="glass-card" style={{ marginBottom: 24 }}>
            <div className="settings-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Link2 size={18} color="var(--accent-cyan)" />
                <div className="settings-section-title" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>Demat Account Integration</div>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                Connect your broker for real-time holdings sync and one-click order placement
              </div>
              {brokers.map(broker => (
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
                  <button
                    className={`btn btn-sm ${connectedBrokers[broker.id] ? 'btn-danger' : 'btn-outline'}`}
                    onClick={() => toggleBroker(broker.id)}
                  >
                    {connectedBrokers[broker.id] ? 'Disconnect' : 'Connect'}
                    {!connectedBrokers[broker.id] && <ExternalLink size={12} />}
                  </button>
                </div>
              ))}
              <div style={{ marginTop: 12, padding: 12, background: 'rgba(0,212,255,0.05)', borderRadius: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                🔒 OAuth-based secure connection. Your credentials are never stored on our servers.
              </div>
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
