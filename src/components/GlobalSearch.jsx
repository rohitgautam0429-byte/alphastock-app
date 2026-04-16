import { useState, useEffect, useRef } from 'react';
import { Search, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { stocks } from '../data/stocks';
import { commodities } from '../data/commodities';

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [growwResults, setGrowwResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Local NSE/BSE stock search (instant, always works - our 50+ curated stocks)
  const localStockResults = query.trim()
    ? stocks.filter(s => {
        const q = query.toLowerCase();
        return s.id.toLowerCase().includes(q) ||
               s.name.toLowerCase().includes(q) ||
               s.sector.toLowerCase().includes(q);
      }).slice(0, 10)
    : [];

  // Local commodity search (instant)
  const localCommodityResults = query.trim()
    ? commodities.filter(c => {
        const q = query.toLowerCase();
        return c.name.toLowerCase().includes(q) ||
               c.id.toLowerCase().includes(q) ||
               c.category.toLowerCase().includes(q) ||
               c.exchange.toLowerCase().includes(q);
      })
    : [];

  // Robust search for ALL NSE/BSE listed stocks (5000+)
  useEffect(() => {
    const performSearch = async () => {
      const q = query.trim();
      if (!q || q.length < 2) {
        setGrowwResults([]);
        return;
      }
      setLoading(true);
      try {
        // We now primarily use Yahoo Search but with "Indian Stock Hints"
        // This is much more reliable for 5000+ stocks than Groww's web API
        const cleanQ = q.replace(/\s+/g, '');
        const searchQueries = [
          q, // As is (D MART)
          cleanQ, // Stripped spaces (DMART)
          `${cleanQ}.NS`, // Force NSE (DMART.NS)
          `${cleanQ}.BO`, // Force BSE (DMART.BO)
        ].filter(Boolean);

        const results = [];
        const seenSymbols = new Set(localStockResults.map(s => s.id + '.NS'));

        // Try Yahoo Search for each hint (in parallel)
        const searchPromises = searchQueries.map(async (sq) => {
          try {
            const res = await fetch(`/api/yahoo-search?q=${encodeURIComponent(sq)}&quotesCount=6&newsCount=0`);
            if (res.ok) {
              const data = await res.json();
              return data.quotes || [];
            }
          } catch (e) { return []; }
        });

        const allQuotes = (await Promise.all(searchPromises)).flat();

        // Filter for Indian Equities and remove duplicates
        allQuotes.forEach(item => {
          if ((item.quoteType === 'EQUITY' || item.quoteType === 'ETF') && 
              (item.symbol.endsWith('.NS') || item.symbol.endsWith('.BO'))) {
            if (!seenSymbols.has(item.symbol)) {
              seenSymbols.add(item.symbol);
              results.push({
                nse_scrip_code: item.symbol.replace('.NS', '').replace('.BO', ''),
                company_name: item.shortname || item.longname || item.symbol,
                logo_url: null,
                exchange: item.symbol.endsWith('.NS') ? 'NSE' : 'BSE',
                _isYahoo: true,
                _symbol: item.symbol,
              });
            }
          }
        });

        setGrowwResults(results.slice(0, 20));
      } catch (err) {
        console.warn('Search service error:', err);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(performSearch, 500);
    return () => clearTimeout(debounceTimer);
  }, [query, localStockResults]);

  const handleSelectLocalStock = (stockId) => {
    setShowDropdown(false);
    setQuery('');
    navigate(`/stock/${encodeURIComponent(stockId + '.NS')}`);
  };

  const handleSelectGrowwStock = (stock) => {
    setShowDropdown(false);
    setQuery('');
    const symbol = stock._symbol || (stock.nse_scrip_code ? stock.nse_scrip_code + '.NS' : stock.bse_scrip_code + '.BO');
    navigate(`/stock/${encodeURIComponent(symbol)}`);
  };

  const handleSelectCommodity = () => {
    setShowDropdown(false);
    setQuery('');
    navigate(`/commodities`);
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'Precious Metals': return '🥇';
      case 'Energy': return '⚡';
      case 'Agricultural': return '🌾';
      case 'Base Metals': return '🔩';
      default: return '📦';
    }
  };

  const getCapBadgeColor = (cap) => {
    if (cap === 'Large') return '#3b82f6';
    if (cap === 'Mid') return '#8b5cf6';
    return '#ec4899';
  };

  const showStocks = activeTab !== 'commodities';
  const showCommodities = activeTab !== 'stocks';
  const hasLocalStocks = showStocks && localStockResults.length > 0;
  const hasGroww = showStocks && growwResults.length > 0;
  const hasCommodities = showCommodities && localCommodityResults.length > 0;
  const hasResults = hasLocalStocks || hasGroww || hasCommodities;

  return (
    <div className="search-container" ref={dropdownRef} style={{ position: 'relative', width: '100%', maxWidth: '440px' }}>
      <div style={{ position: 'relative' }}>
        <Search size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
        <input
          type="text"
          placeholder="Search 5000+ NSE / BSE stocks (e.g. RELIANCE, ZOMATO)..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => { if (query.trim()) setShowDropdown(true); }}
          style={{
            width: '100%',
            padding: '11px 16px 11px 44px',
            background: '#ffffff',
            border: '1.5px solid #d1d5db',
            borderRadius: '24px',
            color: '#111827',
            fontSize: '0.9rem',
            outline: 'none',
            transition: 'all 0.25s ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            fontWeight: 500,
          }}
        />
        {loading && <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />}
      </div>

      {showDropdown && query.trim().length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px',
          background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '14px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.12)', zIndex: 100,
          maxHeight: '480px', overflowY: 'auto', overflowX: 'hidden',
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
            {[
              { key: 'all', label: 'All' },
              { key: 'stocks', label: `Stocks (${localStockResults.length + growwResults.length})` },
              { key: 'commodities', label: `Commodities (${localCommodityResults.length})` },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  flex: 1, padding: '10px 8px',
                  background: activeTab === tab.key ? '#f0f7ff' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === tab.key ? '2px solid #3b82f6' : '2px solid transparent',
                  color: activeTab === tab.key ? '#3b82f6' : '#6b7280',
                  fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {hasResults ? (
            <div style={{ padding: '4px 0' }}>

              {/* LOCAL curated NSE/BSE stocks (instant) */}
              {hasLocalStocks && (
                <>
                  <div style={{ padding: '8px 16px 4px', fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
                    ⭐ Basket-Tracked Stocks
                  </div>
                  {localStockResults.map((stock) => (
                    <div
                      key={`local-${stock.id}`}
                      onClick={() => handleSelectLocalStock(stock.id)}
                      style={{
                        padding: '10px 16px', display: 'flex', alignItems: 'center',
                        gap: 12, cursor: 'pointer', borderBottom: '1px solid #f3f4f6',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f0f7ff'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{
                        width: 34, height: 34, borderRadius: 8, background: '#eff6ff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6',
                      }}>
                        <Activity size={16} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>{stock.id}</span>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{
                              fontSize: '0.65rem', padding: '2px 6px', borderRadius: 4,
                              fontWeight: 700, color: '#fff',
                              background: getCapBadgeColor(stock.capSize),
                            }}>{stock.capSize}</span>
                            <span style={{ fontSize: '0.68rem', background: '#f3f4f6', padding: '2px 8px', borderRadius: 6, color: '#6b7280', fontWeight: 600 }}>NSE</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.78rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                            {stock.name}
                          </span>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#111827', fontFamily: 'var(--font-mono)' }}>
                              ₹{stock.price.toLocaleString('en-IN')}
                            </span>
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: stock.change >= 0 ? '#16a34a' : '#dc2626' }}>
                              {stock.change >= 0 ? '+' : ''}{stock.change}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* GROWW API results — all other NSE/BSE stocks */}
              {hasGroww && (
                <>
                  <div style={{ padding: '10px 16px 4px', fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
                    📈 All NSE / BSE Stocks
                  </div>
                  {growwResults.map((item, idx) => (
                    <div
                      key={`groww-${idx}`}
                      onClick={() => handleSelectGrowwStock(item)}
                      style={{
                        padding: '10px 16px', display: 'flex', alignItems: 'center',
                        gap: 12, cursor: 'pointer', borderBottom: '1px solid #f3f4f6',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f0f7ff'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{
                        width: 34, height: 34, borderRadius: 8, overflow: 'hidden',
                        background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {item.logo_url ? (
                          <img src={item.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display='none'; e.target.parentElement.innerHTML = '📊'; }} />
                        ) : (
                          <Activity size={16} color="#6b7280" />
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>
                            {item.nse_scrip_code || item.bse_scrip_code || item.company_name}
                          </span>
                          <span style={{ fontSize: '0.68rem', background: '#f3f4f6', padding: '2px 8px', borderRadius: 6, color: '#6b7280', fontWeight: 600 }}>
                            {item.nse_scrip_code ? 'NSE' : 'BSE'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.company_name || item.long_name || ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* COMMODITY Results */}
              {hasCommodities && (
                <>
                  <div style={{ padding: '10px 16px 4px', fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
                    📦 Commodities (MCX / NCDEX)
                  </div>
                  {localCommodityResults.map((item, idx) => (
                    <div
                      key={`commodity-${idx}`}
                      onClick={handleSelectCommodity}
                      style={{
                        padding: '10px 16px', display: 'flex', alignItems: 'center',
                        gap: 12, cursor: 'pointer',
                        borderBottom: idx < localCommodityResults.length - 1 ? '1px solid #f3f4f6' : 'none',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f0fdf4'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{
                        width: 34, height: 34, borderRadius: 8, background: '#f0fdf4',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem',
                      }}>
                        {getCategoryIcon(item.category)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>{item.name}</span>
                          <span style={{ fontSize: '0.68rem', background: '#f3f4f6', padding: '2px 8px', borderRadius: 6, color: '#6b7280', fontWeight: 600 }}>{item.exchange}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>{item.category}</span>
                          <span style={{ fontSize: '0.75rem', color: item.changePercent >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                            {item.changePercent >= 0 ? '+' : ''}{item.changePercent}%
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#111827', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                            ₹{item.price.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          ) : !loading ? (
            <div style={{ padding: 28, textAlign: 'center', color: '#9ca3af' }}>
              No results found for "{query}"
            </div>
          ) : (
            <div style={{ padding: 28, textAlign: 'center', color: '#9ca3af' }}>
              Searching NSE / BSE...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
