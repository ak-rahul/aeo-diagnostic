import { motion } from 'framer-motion';
import { Download } from 'lucide-react';

const ENGINES = ['GPT-4o', 'Claude Sonnet', 'Gemini 1.5 Pro'];

export default function Leaderboard({ leaderboard, userBrand, isLoading }) {
  // Distinguish: null = still loading, [] = loaded but empty, populated = results
  if (isLoading) {
    return (
      <div className="glass-card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton-pulse" style={{ height: 36, borderRadius: 8 }} />
          ))}
        </div>
      </div>
    );
  }

  if (!leaderboard) return null;

  if (leaderboard.length === 0) {
    return (
      <div className="glass-card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
        No brands detected in AI responses.
      </div>
    );
  }

  const handleExportCSV = () => {
    const header = ['Rank', 'Brand', 'Visibility Score', 'GPT-4o Score', 'Claude Score', 'Gemini Score', 'Status'];
    const rows = leaderboard.map(item => [
      item.rank,
      item.brand.replace(/,/g, ''),
      item.total_score,
      item.breakdown?.['GPT-4o']?.score || 0,
      item.breakdown?.['Claude Sonnet']?.score || 0,
      item.breakdown?.['Gemini 1.5 Pro']?.score || 0,
      item.rag_status
    ]);
    
    const csvContent = [header, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "aeo_leaderboard.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Fix: revoke blob URL after click to prevent memory leak
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  return (
    <motion.div 
      className="glass-card" 
      style={{ overflow: 'hidden' }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)' }}>
        <button onClick={handleExportCSV} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 10px' }}>
          <Download size={14} /> Export CSV
        </button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>Rank</th>
              <th>Brand</th>
              <th>Visibility Score</th>
              <th>Coverage</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((item, idx) => {
              const isMe = userBrand && item.brand.toLowerCase() === userBrand.toLowerCase();
              return (
                <motion.tr 
                  key={item.brand}
                  className={isMe ? 'row-highlight' : ''}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 + 0.3 }}
                >
                  <td style={{ color: item.rank <= 3 ? '#FFF' : 'var(--text-muted)', fontWeight: 600 }}>
                    #{item.rank}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, color: '#FFF' }}>
                      {item.brand}
                      {isMe && <span className="badge" style={{ background: 'rgba(255,255,255,0.1)', color: '#FFF' }}>YOU</span>}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 60, height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            width: `${item.total_score}%`, height: '100%', 
                            background: item.rag_status === 'green' ? 'var(--success)' : item.rag_status === 'amber' ? 'var(--warning)' : 'var(--danger)',
                            borderRadius: 99 
                          }} 
                        />
                      </div>
                      <span style={{ fontWeight: 600 }}>{item.total_score}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[0, 1, 2].map(i => (
                        <div 
                          key={i} 
                          style={{ 
                            width: 8, height: 8, borderRadius: '50%', 
                            background: i < item.ais_mentioned_in ? '#FFF' : 'rgba(255,255,255,0.1)',
                            boxShadow: i < item.ais_mentioned_in ? '0 0 8px rgba(255,255,255,0.5)' : 'none'
                          }} 
                        />
                      ))}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${item.rag_status === 'green' ? 'badge-success' : item.rag_status === 'amber' ? 'badge-warning' : 'badge-danger'}`}>
                      {item.rag_status === 'green' ? 'High' : item.rag_status === 'amber' ? 'Partial' : 'Low'}
                    </span>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
