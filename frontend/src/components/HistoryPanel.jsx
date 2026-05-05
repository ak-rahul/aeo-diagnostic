/**
 * HistoryPanel.jsx — Sidebar showing past diagnostic runs stored in localStorage.
 * 
 * Stores up to 10 full result payloads. Allows one-click re-load of past results
 * without re-running the API. Useful for brand owners comparing queries over time.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ChevronRight, Trash2, History } from 'lucide-react';

const KEY = 'aeo_result_history';
const MAX_HISTORY = 10;

export function saveToHistory(result) {
  if (!result?.query) return;
  try {
    const existing = JSON.parse(localStorage.getItem(KEY) || '[]');
    // Deduplicate by query + brand
    const filtered = existing.filter(
      r => !(r.query === result.query && r.user_brand === result.user_brand)
    );
    const entry = {
      id: result.id || Date.now().toString(),
      query: result.query,
      user_brand: result.user_brand,
      total_brands: result.leaderboard?.length || 0,
      top_brand: result.leaderboard?.[0]?.brand,
      top_score: result.leaderboard?.[0]?.total_score,
      generated_at: result.generated_at || new Date().toISOString(),
      // Store the full result for quick reload
      _result: result,
    };
    const updated = [entry, ...filtered].slice(0, MAX_HISTORY);
    localStorage.setItem(KEY, JSON.stringify(updated));
  } catch (e) { /* storage full or corrupt */ }
}

export function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch { return []; }
}

export function clearHistory() {
  localStorage.removeItem(KEY);
}

export default function HistoryPanel({ onLoad }) {
  const [entries, setEntries] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setEntries(loadHistory());
  }, [open]);

  const handleClear = () => {
    clearHistory();
    setEntries([]);
  };

  const handleLoad = (entry) => {
    onLoad(entry._result);
    setOpen(false);
  };

  if (entries.length === 0 && !open) return null;

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="btn-secondary"
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 10px', position: 'relative' }}
        title="Past diagnostic runs"
      >
        <History size={14} />
        History
        {entries.length > 0 && (
          <span style={{ background: 'var(--accent-cyan)', color: '#000', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
            {entries.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />

            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 8,
                width: 380,
                zIndex: 50,
                background: 'rgba(10,10,10,0.95)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-lg)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#FFF' }}>Past Diagnostics</span>
                <button onClick={handleClear} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                  <Trash2 size={12} /> Clear all
                </button>
              </div>

              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {entries.length === 0 ? (
                  <div style={{ padding: 24, color: 'var(--text-muted)', textAlign: 'center', fontSize: 13 }}>No history yet.</div>
                ) : entries.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => handleLoad(entry)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                      padding: '12px 16px', background: 'transparent', border: 'none',
                      borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer',
                      textAlign: 'left', transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <Clock size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: '#FFF', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.query}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {entry.user_brand && <span style={{ color: 'var(--accent-cyan)' }}>{entry.user_brand} · </span>}
                        {entry.total_brands} brands · {new Date(entry.generated_at).toLocaleDateString()}
                      </div>
                    </div>
                    <ChevronRight size={14} color="var(--text-muted)" />
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
