import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Search, Briefcase, LineChart, BarChart3, Compass, Bell, Menu, X, TrendingUp, Settings, PieChart, ShieldCheck, Activity, Zap, User, Rocket } from 'lucide-react';
import { getMarketStatus } from '../services/marketData';
import GlobalSearch from './GlobalSearch';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/screener', icon: Search, label: 'Stock Screener' },
  { to: '/basket', icon: Briefcase, label: 'My Basket' },
  { to: '/shadow', icon: LineChart, label: 'Shadow Portfolio' },
  { to: '/commodities', icon: BarChart3, label: 'Commodities' },
  { to: '/trends', icon: Compass, label: 'Macro Radar' },
  { to: '/ipos', icon: Rocket, label: 'Upcoming IPOs' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const pageNames = {
  '/': 'Portfolio Dashboard',
  '/screener': 'Stock Screener — NSE & BSE Universe',
  '/basket': 'AI-Constructed Basket',
  '/shadow': 'Shadow Portfolio',
  '/commodities': 'Commodity Dashboard',
  '/trends': 'Macro Radar & Sector Trends',
  '/ipos': 'Upcoming IPOs & GMP Tracker',
  '/notifications': 'Notification Centre',
  '/settings': 'Settings',
};

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const marketStatus = getMarketStatus();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="app-layout">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-icon"><TrendingUp size={18} color="white" /></div>
          <h1>AlphaBasket</h1>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => isActive ? 'active' : ''}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-glass)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 6 }}>MARKET STATUS</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {marketStatus.isOpen ? (
              <div className="live-pulse" />
            ) : (
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-red)' }} />
            )}
            <span style={{ fontSize: '0.8rem', color: marketStatus.isOpen ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {marketStatus.status}
            </span>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>{marketStatus.statusText}</div>
        </div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <GlobalSearch />
            <span className="topbar-title">{pageNames[location.pathname] || 'AlphaBasket'}</span>
          </div>
          <div className="topbar-right">
            <div className="live-indicator">
              <div className="live-pulse" />
              <span>LIVE</span>
            </div>
          </div>
        </header>
        <div className="page-content">
          <Outlet />
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
          border: '1px solid #f59e0b',
          borderRadius: '10px',
          padding: '14px 20px',
          margin: '24px 0 12px',
          fontSize: '0.82rem',
          lineHeight: 1.6,
          color: '#78350f',
          boxShadow: '0 2px 8px rgba(245, 158, 11, 0.15)',
        }}>
          <strong style={{ color: '#b45309', fontSize: '0.85rem' }}>⚠️ SEBI Disclaimer:</strong>{' '}
          This platform is for <strong>educational and research purposes only</strong>. It does not constitute SEBI-registered investment advice. All recommendations are labeled as "Research Insights" and not buy/sell advice. Investments in securities market are subject to market risks. Read all scheme-related documents carefully before investing.
        </div>
      </div>

      {sidebarOpen && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90 }} onClick={() => setSidebarOpen(false)} />}
    </div>
  );
}
