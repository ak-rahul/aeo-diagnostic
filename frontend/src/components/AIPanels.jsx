import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, CheckCircle2 } from 'lucide-react';
import { ENGINE_CONFIG } from '../constants';

const ENGINES = [
  { id: 'GPT-4o',           label: ENGINE_CONFIG['GPT-4o'].label,           orbClass: ENGINE_CONFIG['GPT-4o'].dotClass },
  { id: 'Claude Sonnet',    label: ENGINE_CONFIG['Claude Sonnet'].label,    orbClass: ENGINE_CONFIG['Claude Sonnet'].dotClass },
  { id: 'Gemini Pro Latest',label: ENGINE_CONFIG['Gemini Pro Latest'].label, orbClass: ENGINE_CONFIG['Gemini Pro Latest'].dotClass },
];

/** Escape HTML and highlight a brand name in text with a glowing span */
function highlightBrand(text, brand) {
  if (!brand || !text) return escapeHtml(text || '');
  const safe = escapeHtml(text);
  const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(
    new RegExp(escaped, 'gi'),
    m => `<mark style="background:rgba(0,229,255,0.15);color:#00E5FF;border-radius:3px;padding:0 3px;font-weight:600;">${m}</mark>`
  );
}

function escapeHtml(t) {
  return t
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#FFF">$1</strong>');
}

function StreamText({ text, userBrand }) {
  const ref = useRef(null);
  const ivRef = useRef(null);

  useEffect(() => {
    if (!ref.current || !text) return;
    if (ivRef.current) clearInterval(ivRef.current);

    const words = text.split(' ');
    let i = 0;
    ref.current.textContent = '';

    ivRef.current = setInterval(() => {
      if (!ref.current || i >= words.length) {
        clearInterval(ivRef.current);
        if (ref.current) {
          const safe = highlightBrand(text, userBrand);
          ref.current.innerHTML = safe;
        }
        return;
      }
      ref.current.textContent = words.slice(0, i + 1).join(' ') + ' ▋';
      i += Math.floor(Math.random() * 5) + 1;
    }, 40);

    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, [text]);

  return <div ref={ref} style={{ whiteSpace: 'pre-wrap' }} />;
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  if (!text) return null;
  return (
    <button onClick={handle} className="btn-secondary" title="Copy response" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', fontSize: 11 }}>
      {copied ? <CheckCircle2 size={12} color="var(--success)" /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function AIPanels({ responses, isLoading, userBrand }) {
  return (
    <div className="ai-panels-grid">
      {ENGINES.map((eng, idx) => {
        const resp = responses?.find(r => r.engine === eng.id);
        const isReady = Boolean(resp && resp.text);
        const hasError = Boolean(resp?.error);
        const latency = resp?.latency_s;

        return (
          <motion.div
            key={eng.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1, duration: 0.5 }}
            className="glass-card"
            style={{
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
              borderColor: (isLoading && !isReady) ? 'rgba(255,255,255,0.2)' : 'var(--border-subtle)'
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {latency && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{latency}s</span>}
                <CopyButton text={resp?.text} />
                {isLoading && !isReady && <span className="badge badge-glow" style={{ color: '#FFF' }}>Streaming</span>}
                {isReady && <span className="badge badge-success">Complete</span>}
                {hasError && <span className="badge badge-danger">Failed</span>}
                {!isLoading && !isReady && !hasError && <span className="badge">Standby</span>}
              </div>
            </div>

            <div className="panel-content">
              {hasError && <div style={{ color: 'var(--danger)' }}>{resp.error}</div>}
              {isReady && <StreamText text={resp.text} userBrand={userBrand} />}
              {isLoading && !isReady && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[90, 70, 85, 40].map((w, i) => (
                    <div key={i} className="skeleton-pulse" style={{ height: 12, width: `${w}%` }} />
                  ))}
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
