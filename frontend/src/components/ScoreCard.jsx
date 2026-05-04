import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Target } from 'lucide-react';
import { ENGINE_CONFIG } from '../constants';

const ENGINES = [
  { id: 'GPT-4o', label: ENGINE_CONFIG['GPT-4o'].label, color: ENGINE_CONFIG['GPT-4o'].color },
  { id: 'Claude Sonnet', label: ENGINE_CONFIG['Claude Sonnet'].label, color: ENGINE_CONFIG['Claude Sonnet'].color },
  { id: 'Gemini Pro Latest', label: ENGINE_CONFIG['Gemini Pro Latest'].label, color: ENGINE_CONFIG['Gemini Pro Latest'].color }
];

function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let startTime;
    const duration = 1200;
    const animate = (time) => {
      if (!startTime) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(easeOut * value));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);
  return <>{display}</>;
}

export default function ScoreCard({ leaderboard, userBrand }) {
  const me = leaderboard?.find(b => b.brand.toLowerCase() === userBrand?.toLowerCase());
  if (!me) return null;

  return (
    <motion.div 
      className="glass-card"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
      style={{ overflow: 'hidden' }}
    >
      <div className="score-hero">
        <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', fontWeight: 600 }}>
          Brand Visibility Score
        </div>
        
        <div className="score-number">
          <AnimatedNumber value={me.total_score} />
        </div>
        
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <span className="badge badge-glow" style={{ fontSize: 14, padding: '6px 16px', background: 'rgba(255,255,255,0.05)', color: '#FFF' }}>
            {me.brand}
          </span>
          <span className={`badge ${me.rag_status === 'green' ? 'badge-success' : me.rag_status === 'amber' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: 14, padding: '6px 16px' }}>
            <Target size={14} /> Rank #{me.rank}
          </span>
        </div>
      </div>

      <div style={{ padding: 24, borderTop: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Engine Breakdown</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Score capped at 100</span>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {ENGINES.map(eng => {
            const data = me.breakdown?.[eng.id];
            const score = data?.score || 0;
            const pct = (score / 47) * 100; // 47 is the internal per-engine cap
            
            return (
              <div key={eng.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#FFF', fontWeight: 500 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: eng.color, boxShadow: `0 0 10px ${eng.color}` }} />
                    {eng.label}
                  </div>
                  <span style={{ fontWeight: 600, color: data?.mentioned ? '#FFF' : 'var(--text-muted)' }}>{score} pts</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(pct, 100)}%` }}
                    transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
                    style={{ height: '100%', background: eng.color, borderRadius: 99, boxShadow: `0 0 10px ${eng.color}` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
