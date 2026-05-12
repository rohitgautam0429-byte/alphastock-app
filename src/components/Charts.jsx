// Reusable chart components: ScoreGauge, MiniChart, RadarScoreChart, AllocationDonut, LivePrice
import { PieChart, Pie, Cell, AreaChart, Area, ResponsiveContainer, Tooltip, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

export function ScoreGauge({ score, size = 64, strokeWidth = 5, grade }) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;
  const color = score >= 70 ? '#00D4FF' : score >= 55 ? '#F5C518' : score >= 40 ? '#f97316' : '#ef4444';

  return (
    <div className="score-gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={circumference - filled} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <span className="score-text" style={{ color, fontSize: size * 0.25 }}>{score}</span>
      {grade && <span className="score-grade">{grade}</span>}
    </div>
  );
}

export function MiniChart({ data, color = '#10b981', height = 40, width = 100 }) {
  const chartData = data.map((v, i) => ({ v, i }));
  return (
    <ResponsiveContainer width={width} height={height}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id={`mc-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#mc-${color.replace('#', '')})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function RadarScoreChart({ scores, maxScores, size = 250 }) {
  const labels = {
    valuation: 'Valuation',
    financials: 'Financials',
    momentum: 'Momentum',
    management: 'Management',
    sectorOutlook: 'Sector',
  };
  
  const data = Object.entries(scores).map(([key, value]) => ({
    subject: labels[key] || key,
    score: Math.round((value / (maxScores[key] || 1)) * 100),
    fullMark: 100,
  }));

  return (
    <ResponsiveContainer width={size} height={size}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
        <PolarGrid stroke="rgba(255,255,255,0.08)" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11 }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
        <Radar name="Score" dataKey="score" stroke="#00D4FF" fill="#00D4FF" fillOpacity={0.2} strokeWidth={2} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function AllocationDonut({ data, size = 200 }) {
  return (
    <PieChart width={size} height={size}>
      <Pie
        data={[{ name: 'Total', value: 100 }]}
        cx={size / 2}
        cy={size / 2}
        innerRadius={size * 0.32}
        outerRadius={size * 0.44}
        dataKey="value"
        fill="#E2E8F0"
        stroke="none"
        isAnimationActive={false}
      />
      <Pie data={data} cx={size / 2} cy={size / 2} innerRadius={size * 0.32} outerRadius={size * 0.44} paddingAngle={3} dataKey="value" stroke="none" isAnimationActive={false}>
        {data.map((entry, i) => (
          <Cell key={i} fill={entry.color} />
        ))}
      </Pie>
      <text x={size / 2} y={size / 2 - 4} textAnchor="middle" fill="#0F172A" fontSize={size * 0.14} fontWeight="700">100%</text>
      <text x={size / 2} y={size / 2 + 15} textAnchor="middle" fill="#64748B" fontSize={size * 0.07} fontWeight="600">allocated</text>
      <Tooltip
        contentStyle={{ background: '#0F1529', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: '0.8rem' }}
        formatter={(value) => [`${value}%`, 'Allocation']}
      />
    </PieChart>
  );
}

export function LivePrice({ price, change, changePercent, showChange = true }) {
  const isUp = (changePercent ?? change ?? 0) >= 0;
  const changeAmount = change ?? (price != null && changePercent != null ? (price * changePercent) / 100 : null);

  return (
    <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, transition: 'background-color 0.2s', padding: '2px 6px', margin: '-2px -6px' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1rem' }}>
        ₹{price?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '—'}
      </span>
      {showChange && changePercent != null && (
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: isUp ? 'var(--accent-green)' : 'var(--accent-red)',
        }}>
          {isUp ? '+' : ''}{changeAmount?.toFixed(2)} ({isUp ? '+' : ''}{changePercent?.toFixed(2)}%)
        </span>
      )}
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function formatCurrency(num) {
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)}K`;
  return `₹${num?.toLocaleString('en-IN') || 0}`;
}

// eslint-disable-next-line react-refresh/only-export-components
export function formatNumber(num) {
  return num?.toLocaleString('en-IN') || '0';
}

// eslint-disable-next-line react-refresh/only-export-components
export function getChangeColor(val) {
  return val >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
}

// eslint-disable-next-line react-refresh/only-export-components
export function getCapBadge(capSize) {
  const cls = capSize === 'Large' ? 'badge-large' : capSize === 'Mid' ? 'badge-mid' : 'badge-small';
  return <span className={`badge ${cls}`}>{capSize} Cap</span>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function getCategoryBadge(category) {
  const map = {
    'Precious Metals': 'badge-precious',
    'Energy': 'badge-energy',
    'Agricultural': 'badge-agricultural',
    'Base Metals': 'badge-basemetals',
  };
  return <span className={`badge ${map[category] || ''}`}>{category}</span>;
}
