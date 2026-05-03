import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const ENGINES = [
  { id: 'GPT-4o', label: 'GPT-4o', orbClass: 'gpt' },
  { id: 'Claude Sonnet', label: 'Claude 3.5', orbClass: 'claude' },
  { id: 'Gemini 1.5 Pro', label: 'Gemini Pro', orbClass: 'gemini' }
];

function StreamText({ text }) {
  const ref = useRef(null);
  const done = useRef(false);

  useEffect(() => {
    if (!ref.current || !text || done.current) return;
    done.current = true;
    const words = text.split(' ');
    let i = 0;
    ref.current.textContent = '';
    const iv = setInterval(() => {
      if (!ref.current || i >= words.length) {
        clearInterval(iv);
        if (ref.current) {
          ref.current.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #FFF">$1</strong>');
        }
        return;
      }
      ref.current.textContent = words.slice(0, i + 1).join(' ') + ' ▋';
      i += Math.floor(Math.random() * 5) + 1;
    }, 40);
    return () => clearInterval(iv);
  }, [text]);

  return <div ref={ref} style={{ whiteSpace: 'pre-wrap' }} />;
}

export default function AIPanels({ responses, isLoading }) {
  return (
    <div className="ai-panels-grid">
      {ENGINES.map((eng, idx) => {
        const resp = responses?.find(r => r.engine === eng.id);
        const isReady = Boolean(resp && resp.text);
        const hasError = Boolean(resp?.error);

        return (
          <motion.div 
            key={eng.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1, duration: 0.5 }}
            className="glass-card"
            style={{ 
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
              borderColor: (isLoading && !isReady) ? 'rgba(255,255,255,0.2)' : isReady ? 'var(--border-subtle)' : 'var(--border-subtle)'
            }}
          >
            <div style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
              padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)',
              background: 'rgba(0,0,0,0.3)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, color: '#FFF' }}>
                <div className={`orb ${eng.orbClass}`} style={{ animation: (isLoading && !isReady) ? 'pulse 1.5s infinite' : 'none' }} />
                {eng.label}
              </div>
              <div>
                {isLoading && !isReady && <span className="badge badge-glow" style={{ color: '#FFF' }}>Streaming</span>}
                {isReady && <span className="badge badge-success">Complete</span>}
                {hasError && <span className="badge badge-danger">Failed</span>}
                {!isLoading && !isReady && !hasError && <span className="badge">Standby</span>}
              </div>
            </div>

            <div className="panel-content">
              {hasError && <div style={{ color: 'var(--danger)' }}>{resp.error}</div>}
              {isReady && <StreamText text={resp.text} />}
              {isLoading && !isReady && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="skeleton-pulse" style={{ height: 12, width: '90%' }} />
                  <div className="skeleton-pulse" style={{ height: 12, width: '70%' }} />
                  <div className="skeleton-pulse" style={{ height: 12, width: '85%' }} />
                  <div className="skeleton-pulse" style={{ height: 12, width: '40%' }} />
                </div>
              )}
              {!isLoading && !isReady && !hasError && (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--border-strong)' }}>
                  Awaiting Input
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
