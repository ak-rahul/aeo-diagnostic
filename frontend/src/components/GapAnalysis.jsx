import { motion } from 'framer-motion';
import { Lightbulb, AlertTriangle, Zap, Copy, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

export default function GapAnalysis({ gapAnalysis }) {
  const [copied, setCopied] = useState(false);
  
  if (!gapAnalysis) return null;
  const { gaps = [], overall_verdict, quick_win, estimated_score_if_fixed } = gapAnalysis;
  const sorted = [...gaps].sort((a, b) => {
    const o = { high: 0, medium: 1, low: 2 };
    return (o[a.priority] ?? 2) - (o[b.priority] ?? 2);
  });

  const handleCopy = () => {
    const text = `AEO Gap Analysis\n\nVerdict: ${overall_verdict || 'N/A'}\nQuick Win: ${quick_win || 'N/A'}\n\nGaps:\n` + 
                 sorted.map((g, i) => `${i+1}. [${g.priority.toUpperCase()}] ${g.gap}\n   Action: ${g.action}`).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: -16 }}>
        <button onClick={handleCopy} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 10px' }}>
          {copied ? <CheckCircle2 size={14} color="var(--success)"/> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy Analysis'}
        </button>
      </div>
      {/* Verdict & Quick Win */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {overall_verdict && (
          <motion.div 
            className="glass-card" 
            style={{ padding: 24, borderTop: '2px solid rgba(255,255,255,0.2)' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, marginBottom: 12, color: '#FFF' }}>
              <Target size={18} /> Strategic Verdict
            </h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{overall_verdict}</p>
            {estimated_score_if_fixed && (
              <div style={{ marginTop: 16 }}>
                <span className="badge badge-success">Potential Score: {estimated_score_if_fixed}/100</span>
              </div>
            )}
          </motion.div>
        )}

        {quick_win && (
          <motion.div 
            className="glass-card" 
            style={{ padding: 24, borderTop: '2px solid var(--accent-cyan)' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, marginBottom: 12, color: '#FFF' }}>
              <Zap size={18} color="var(--accent-cyan)" /> Highest Impact Action
            </h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: 15 }}>{quick_win}</p>
          </motion.div>
        )}
      </div>

      {/* Gaps List */}
      <motion.div 
        className="glass-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {sorted.map((gap, i) => (
          <motion.div 
            key={i} 
            className="gap-item"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + (i * 0.1) }}
          >
            <div className="gap-number">0{i + 1}</div>
            <div className="gap-content" style={{ flex: 1 }}>
              <h4>{gap.gap}</h4>
              <p>
                <strong style={{ color: '#FFF' }}>Action:</strong> {gap.action}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className={`badge ${gap.priority === 'high' ? 'badge-danger' : gap.priority === 'medium' ? 'badge-warning' : 'badge-success'}`}>
                  {gap.priority === 'high' ? <AlertTriangle size={12}/> : <Lightbulb size={12}/>}
                  {gap.priority.toUpperCase()} PRIORITY
                </span>
                {gap.impact && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{gap.impact}</span>}
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

// Target icon is missing in lucide import, let's add it inline
const Target = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
);
