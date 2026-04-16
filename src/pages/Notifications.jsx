import { useState } from 'react';
import { Bell, TrendingUp, BarChart3, AlertTriangle, RefreshCw, Filter } from 'lucide-react';
import { notifications } from '../data/notifications';

const typeIcons = {
  buy_signal: { icon: '🟢', color: 'var(--accent-green)' },
  volume_surge: { icon: '📊', color: 'var(--accent-blue)' },
  sector_upgrade: { icon: '🔼', color: 'var(--accent-cyan)' },
  earnings_update: { icon: '📈', color: 'var(--accent-gold)' },
  score_drop: { icon: '🔴', color: 'var(--accent-red)' },
  macro_alert: { icon: '🌍', color: 'var(--accent-purple)' },
  rebalance: { icon: '🔄', color: 'var(--accent-cyan)' },
};

export default function Notifications() {
  const [filter, setFilter] = useState('all');
  const [notifs, setNotifs] = useState(notifications);

  const filtered = filter === 'all' ? notifs
    : filter === 'unread' ? notifs.filter(n => !n.read)
    : notifs.filter(n => n.category === filter);

  const markRead = (id) => {
    setNotifs(notifs.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = () => {
    setNotifs(notifs.map(n => ({ ...n, read: true })));
  };

  const unreadCount = notifs.filter(n => !n.read).length;

  return (
    <div>
      <div className="section-header animate-in">
        <div>
          <div className="section-title">Notification Centre</div>
          <div className="section-subtitle">Buy/sell signals, sector updates, earnings alerts, and macro intelligence</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {unreadCount > 0 && (
            <button className="btn btn-outline btn-sm" onClick={markAllRead}>Mark all read</button>
          )}
          <span className="badge badge-sell">{unreadCount} unread</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="tabs animate-in">
        {[
          { key: 'all', label: `All (${notifs.length})` },
          { key: 'unread', label: `Unread (${unreadCount})` },
          { key: 'buy_signal', label: 'Buy Signals' },
          { key: 'volume_surge', label: 'Volume' },
          { key: 'sector_upgrade', label: 'Sector' },
          { key: 'earnings_update', label: 'Earnings' },
          { key: 'macro_alert', label: 'Macro' },
        ].map(tab => (
          <button key={tab.key} className={`tab-btn ${filter === tab.key ? 'active' : ''}`} onClick={() => setFilter(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notification List */}
      <div className="animate-in">
        {filtered.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            <Bell size={48} style={{ marginBottom: 12, opacity: 0.3 }} />
            <div>No notifications in this category</div>
          </div>
        ) : (
          filtered.map(notif => {
            const typeInfo = typeIcons[notif.category] || { icon: '📌', color: 'var(--text-muted)' };
            return (
              <div
                key={notif.id}
                className={`notif-item ${!notif.read ? 'unread' : ''}`}
                onClick={() => markRead(notif.id)}
                style={{ cursor: 'pointer' }}
              >
                <div className="notif-icon" style={{ background: `${typeInfo.color}15`, color: typeInfo.color, fontSize: '1.2rem' }}>
                  {typeInfo.icon}
                </div>
                <div className="notif-content">
                  <div className="notif-title">{notif.title}</div>
                  <div className="notif-message" style={{ whiteSpace: 'pre-line' }}>{notif.message}</div>
                  <div className="notif-meta">
                    <span>{notif.time}</span>
                    {notif.score && (
                      <span className="badge badge-info" style={{ marginLeft: 8 }}>Score: {notif.score}</span>
                    )}
                    {notif.sector && (
                      <span style={{ color: 'var(--text-muted)' }}>• {notif.sector}</span>
                    )}
                    {notif.channels && (
                      <div className="notif-channel">
                        {notif.channels.map(ch => (
                          <span key={ch} className="notif-channel-badge">{ch}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {notif.allocation && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: '0.78rem' }}>
                      <span style={{ color: 'var(--accent-cyan)' }}>Allocation: {notif.allocation}</span>
                      <span style={{ color: 'var(--accent-gold)' }}>Entry: {notif.entryRange}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
