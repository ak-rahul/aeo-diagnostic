import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Loader2, Clock } from 'lucide-react';

const DEMO_QUERIES = [
  'best magnesium supplement for seniors',
  'best collagen powder for women over 40',
  'top rated standing desks under $500',
];

const STEPS = [
  { id: 'calling', label: 'Interrogating Engines' },
  { id: 'extracting', label: 'Extracting Brands' },
  { id: 'scoring', label: 'Computing Visibility' },
  { id: 'analysing', label: 'Synthesizing Gaps' },
];

export default function QueryInput({ onSubmit, isLoading, step }) {
  const [query, setQuery] = useState('');
  const [brand, setBrand] = useState('');
  const [history, setHistory] = useState([]);
  const taRef = useRef(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('pixii_history') || '[]');
      if (Array.isArray(saved)) setHistory(saved.slice(0, 5));
    } catch (e) {}
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery || isLoading) return;
    
    const newHistory = [cleanQuery, ...history.filter(q => q !== cleanQuery)].slice(0, 5);
    setHistory(newHistory);
    localStorage.setItem('pixii_history', JSON.stringify(newHistory));
    
    onSubmit({ query: cleanQuery, userBrand: brand.trim() });
  };

  const stepIdx = STEPS.findIndex(s => s.id === step);

  return (
    <div className="search-container">
      <form onSubmit={handleSubmit} className="search-glass">
        <div className="search-input-wrapper">
          <textarea
            ref={taRef}
            className="search-textarea"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What are your customers asking AI? (e.g., 'best magnesium supplement')"
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
            }}
          />
        </div>
        
        <div className="search-footer">
          <div className="brand-target">
            <span>Target Brand</span>
            <input
              type="text"
              className="input-premium"
              style={{ background: 'transparent', boxShadow: 'none', border: 'none', borderBottom: '1px solid var(--border-subtle)', borderRadius: 0, padding: '4px 8px', flex: 1 }}
              placeholder="e.g., Pure Encapsulations"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              disabled={isLoading}
            />
          </div>
          
          <button type="submit" className="btn-primary" disabled={!query.trim() || isLoading}>
            {isLoading ? (
              <><Loader2 className="animate-spin" size={16} /> Processing</>
            ) : (
              <><Search size={16} /> Run Diagnostic</>
            )}
          </button>
        </div>
      </form>

      {!isLoading && (
        <motion.div className="demo-chips" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          {history.length > 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)', paddingTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12}/> Recent:</span>}
          {history.map(q => (
            <div key={`hist-${q}`} className="demo-chip" onClick={() => { setQuery(q); taRef.current?.focus(); }} style={{ borderColor: 'var(--border-glow)' }}>
              {q}
            </div>
          ))}
          {history.length === 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)', paddingTop: 6 }}>Try:</span>}
          {(history.length === 0 ? DEMO_QUERIES : []).map(q => (
            <div key={q} className="demo-chip" onClick={() => { setQuery(q); taRef.current?.focus(); }}>
              {q}
            </div>
          ))}
        </motion.div>
      )}

      {isLoading && (
        <motion.div 
          className="demo-chips"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {STEPS.map((s, i) => {
            const isActive = i === stepIdx;
            const isDone = i < stepIdx;
            return (
              <div 
                key={s.id} 
                style={{
                  padding: '6px 14px',
                  borderRadius: 99,
                  fontSize: 12,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: isActive ? 'rgba(255,255,255,0.1)' : isDone ? 'var(--success-bg)' : 'transparent',
                  color: isActive ? '#FFF' : isDone ? 'var(--success)' : 'var(--text-muted)',
                  border: `1px solid ${isActive ? 'rgba(255,255,255,0.2)' : isDone ? 'rgba(16,185,129,0.3)' : 'transparent'}`,
                  transition: 'all 0.3s'
                }}
              >
                {isActive && <Loader2 size={12} className="animate-spin" />}
                {isDone && '✓'}
                {!isActive && !isDone && <div style={{width: 4, height: 4, borderRadius: '50%', background: 'currentColor'}}/>}
                {s.label}
              </div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
