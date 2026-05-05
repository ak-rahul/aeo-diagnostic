import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Search, ChevronUp, ChevronDown } from 'lucide-react';

export default function Leaderboard({ leaderboard, userBrand, isLoading }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'rank', direction: 'asc' });

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

  const sortedAndFiltered = useMemo(() => {
    let result = [...leaderboard];
    
    // Filter
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(item => item.brand.toLowerCase().includes(lowerSearch));
    }

    // Sort
    result.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      // Handle custom rag_status weighting
      if (sortConfig.key === 'rag_status') {
        const weight = { 'green': 3, 'amber': 2, 'red': 1 };
        aVal = weight[aVal] || 0;
        bVal = weight[bVal] || 0;
      }

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [leaderboard, searchTerm, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <span style={{ width: 14, display: 'inline-block' }} />; // placeholder to maintain layout
    return sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  const handleExportCSV = () => {
    const header = ['Rank', 'Brand', 'Visibility Score', 'GPT-5.1 Score', 'Claude Score', 'Gemini Score', 'Status'];
    const rows = leaderboard.map(item => [
      item.rank,
      item.brand.replace(/,/g, ''),
      item.total_score,
      item.breakdown?.['GPT-5.1']?.score || 0,
      item.breakdown?.['Claude Sonnet']?.score || 0,
      item.breakdown?.['Gemini Pro Latest']?.score || 0,
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
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  return (
    <motion.div 
      className="glass-card" 
      style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', flexWrap: 'wrap', gap: 12 }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.5)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', flex: 1, maxWidth: 300 }}>
          <Search size={14} color="var(--text-muted)" />
          <input 
            type="text" 
            placeholder="Search brands..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: '#FFF', outline: 'none', fontSize: 13, width: '100%' }}
          />
        </div>

        <button onClick={handleExportCSV} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 12px' }}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div style={{ overflowX: 'auto', maxHeight: '600px', overflowY: 'auto' }}>
        <table className="data-table">
          <thead style={{ position: 'sticky', top: 0, background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(10px)', zIndex: 10 }}>
            <tr>
              <th style={{ width: 80, cursor: 'pointer' }} onClick={() => requestSort('rank')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Rank {getSortIcon('rank')}</div>
              </th>
              <th style={{ cursor: 'pointer' }} onClick={() => requestSort('brand')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Brand {getSortIcon('brand')}</div>
              </th>
              <th style={{ cursor: 'pointer' }} onClick={() => requestSort('total_score')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Visibility Score {getSortIcon('total_score')}</div>
              </th>
              <th style={{ cursor: 'pointer' }} onClick={() => requestSort('ais_mentioned_in')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Coverage {getSortIcon('ais_mentioned_in')}</div>
              </th>
              <th style={{ cursor: 'pointer' }} onClick={() => requestSort('rag_status')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Status {getSortIcon('rag_status')}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {sortedAndFiltered.map((item, idx) => {
                const isMe = userBrand && item.brand.toLowerCase() === userBrand.toLowerCase();
                return (
                  <motion.tr 
                    key={item.brand}
                    className={isMe ? 'row-highlight' : ''}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
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
                        <div style={{ width: 100, height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
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
            </AnimatePresence>
            
            {sortedAndFiltered.length === 0 && (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  No brands match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
