/**
 * InsightsCard.jsx — At-a-glance summary written in plain English.
 *
 * This is the first thing a non-technical brand owner should see after results load.
 * It answers: "What do my results mean?" without forcing them to read a table.
 *
 * Shows:
 *   - Total score vs benchmark
 *   - Engine coverage (1/3, 2/3, 3/3)
 *   - Rank among discovered brands
 *   - RAG status with human-readable label
 *   - Quick win from gap analysis
 *   - A simple recharts RadialBarChart for visual impact
 */
import { motion } from 'framer-motion';
import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';
import { Trophy, Radio, TrendingUp, Zap, BarChart2 } from 'lucide-react';

function ScoreArc({ score, color }) {
  const data = [{ value: score, fill: color }];
  const bg   = [{ value: 100,   fill: 'rgba(255,255,255,0.05)' }];
  return (
    <div style={{ width: 140, height: 140, position: 'relative', flexShrink: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%"
          startAngle={225} endAngle={-45} data={bg} barSize={10}>
          <RadialBar dataKey="value" cornerRadius={6} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div style={{ position: 'absolute', inset: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%"
            startAngle={225} endAngle={225 - (score / 100) * 270} data={data} barSize={10}>
            <RadialBar dataKey="value" cornerRadius={6} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
      }}>
        <span style={{ fontSize: 28, fontWeight: 800, color: '#FFF', lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>/ 100</span>
      </div>
    </div>
  );
}

const RAG_META = {
  green: { label: 'High Visibility',    color: 'var(--success)', bg: 'var(--success-bg)', msg: "You're well-represented across AI search. Focus on staying #1." },
  amber: { label: 'Partial Visibility', color: 'var(--warning)', bg: 'var(--warning-bg)', msg: "You appear in some AI results but are missing from others. Significant opportunity." },
  red:   { label: 'Low Visibility',     color: 'var(--danger)',  bg: 'var(--danger-bg)',  msg: "AI shoppers can't find you. This is costing you sales every day." },
};

export default function InsightsCard({ leaderboard, userBrand, gapAnalysis, duration }) {
  if (!leaderboard?.length) return null;

  const me = userBrand
    ? leaderboard.find(b => b.brand.toLowerCase() === userBrand.toLowerCase())
    : null;
  
  const total = leaderboard.length;
  const top = leaderboard[0];
  const rag = me ? RAG_META[me.rag_status] || RAG_META.red : null;
  const scoreColor = me ? rag.color : 'var(--accent-cyan)';

  return (
    <motion.div
      className="glass-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      style={{ overflow: 'hidden' }}
    >
      {/* Header strip */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <BarChart2 size={16} color="var(--text-muted)" />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Results at a Glance</span>
        {duration && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>Completed in {duration}s</span>}
      </div>

      <div style={{ padding: '24px 32px', display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Score arc (only if user brand) */}
        {me && <ScoreArc score={me.total_score} color={scoreColor} />}

        {/* Plain-English stats */}
        <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {me ? (
            <>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Your Brand</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#FFF' }}>{me.brand}</div>
                <div style={{ marginTop: 6 }}>
                  <span style={{ background: rag.bg, color: rag.color, border: `1px solid ${rag.color}33`, padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600 }}>
                    {rag.label}
                  </span>
                </div>
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{rag.msg}</p>
            </>
          ) : (
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#FFF', marginBottom: 4 }}>
                {total} brands found
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Enter your brand name above to see your personal visibility score and competitive gap analysis.
              </p>
            </div>
          )}
        </div>

        {/* Key stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, minWidth: 240 }}>
          {me && (
            <StatBox icon={<Trophy size={14} />} label="Your Rank" value={`#${me.rank} / ${total}`} highlight={me.rank === 1} />
          )}
          <StatBox icon={<Radio size={14} />} label="Brands Found" value={total} />
          <StatBox
            icon={<TrendingUp size={14} />}
            label="Top Brand"
            value={top.brand}
            sub={`Score ${top.total_score}`}
          />
          {me && (
            <StatBox
              icon={<Radio size={14} />}
              label="Engine Coverage"
              value={`${me.ais_mentioned_in} / 3`}
              highlight={me.ais_mentioned_in === 3}
            />
          )}
        </div>
      </div>

      {/* Quick win banner */}
      {gapAnalysis?.quick_win && (
        <div style={{ padding: '16px 32px', background: 'rgba(0, 229, 255, 0.04)', borderTop: '1px solid rgba(0,229,255,0.12)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <Zap size={16} color="var(--accent-cyan)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <span style={{ fontSize: 11, color: 'var(--accent-cyan)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Highest-Impact Action</span>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.5 }}>{gapAnalysis.quick_win}</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function StatBox({ icon, label, value, sub, highlight }) {
  return (
    <div style={{
      background: highlight ? 'rgba(16, 185, 129, 0.07)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${highlight ? 'rgba(16,185,129,0.2)' : 'var(--border-subtle)'}`,
      borderRadius: 10, padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', marginBottom: 6 }}>
        {icon}
        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: highlight ? 'var(--success)' : '#FFF', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}
