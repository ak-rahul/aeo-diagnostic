import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Sparkles, Download, Search, AlertCircle, FileJson, Link, RefreshCw } from 'lucide-react';
import './index.css';
import './app.css';

import QueryInput from './components/QueryInput';
import AIPanels from './components/AIPanels';
import Leaderboard from './components/Leaderboard';
import ScoreCard from './components/ScoreCard';
import GapAnalysis from './components/GapAnalysis';
import InsightsCard from './components/InsightsCard';
import RelatedQueries from './components/RelatedQueries';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider, useToast } from './components/Toast';
import HistoryPanel, { saveToHistory } from './components/HistoryPanel';
import { API_BASE, DEMO_RESULT } from './constants';

// ── Live health indicator ──────────────────────────────────────────────────────
function SystemStatus() {
  const [status, setStatus] = useState('checking');
  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setStatus(data.apis?.openrouter ? 'ok' : 'warn'))
      .catch(() => setStatus('error'));
  }, []);
  const color = { ok: 'var(--success)', warn: 'var(--warning)', error: 'var(--danger)', checking: 'var(--text-muted)' }[status];
  const label = { ok: 'System Active', warn: 'API Key Missing', error: 'Backend Offline', checking: 'Connecting…' }[status];
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: status !== 'checking' ? `0 0 10px ${color}` : 'none', transition: 'all 0.3s' }} />
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
    </div>
  );
}

// ── Main App (wrapped in ToastProvider) ───────────────────────────────────────
function AppInner() {
  const toast = useToast();

  const [result, setResult]               = useState(null);
  const [loading, setLoading]             = useState(false);
  const [step, setStep]                   = useState(null);
  const [errorMsg, setErrorMsg]           = useState(null);
  const [brand, setBrand]                 = useState('');
  const [lastQuery, setLastQuery]         = useState('');
  const [lastBrand, setLastBrand]         = useState('');
  const [requestLatency, setRequestLatency] = useState(null);
  const abortRef = useRef(null);

  // Auto-run from URL on mount
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const q = p.get('q'), b = p.get('brand');
    if (q) setTimeout(() => run({ query: q, userBrand: b || '' }), 400);
  }, []);

  // ── Core run ────────────────────────────────────────────────────────────────
  const run = useCallback(async ({ query, userBrand }) => {
    setLoading(true); setResult(null); setErrorMsg(null);
    setBrand(userBrand); setLastQuery(query); setLastBrand(userBrand);
    setStep('calling'); setRequestLatency(null);

    // Sync URL
    const p = new URLSearchParams();
    p.set('q', query);
    if (userBrand) p.set('brand', userBrand);
    window.history.replaceState({}, '', `?${p.toString()}`);

    abortRef.current = new AbortController();
    const timers = [
      setTimeout(() => setStep('extracting'),  5000),
      setTimeout(() => setStep('scoring'),     10000),
      setTimeout(() => setStep('analysing'),   14000),
    ];
    const t0 = performance.now();

    try {
      const res = await fetch(`${API_BASE}/api/diagnostic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, user_brand: userBrand, listing_text: '', use_demo: false }),
        signal: abortRef.current.signal,
      });
      timers.forEach(clearTimeout);

      if (!res.ok) {
        let detail = `Server error (${res.status})`;
        try { const b = await res.json(); detail = b.detail || detail; } catch (_) {}
        throw new Error(detail);
      }

      const data = await res.json();
      setRequestLatency(((performance.now() - t0) / 1000).toFixed(2));
      setStep('done');
      setResult(data);
      saveToHistory(data);
      toast.success(`Analysis complete — ${data.leaderboard?.length || 0} brands ranked`);
    } catch (err) {
      timers.forEach(clearTimeout);
      if (err.name === 'AbortError') { setLoading(false); setStep(null); return; }
      setErrorMsg(err.message || 'Failed to connect to backend.');
      toast.error(err.message || 'Backend connection failed');
      setStep(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRerun = useCallback(() => {
    if (lastQuery) run({ query: lastQuery, userBrand: lastBrand });
  }, [lastQuery, lastBrand, run]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false); setStep(null);
  }, []);

  const loadFromHistory = useCallback((histResult) => {
    setResult(histResult);
    setBrand(histResult.user_brand || '');
    setLastQuery(histResult.query || '');
    setLastBrand(histResult.user_brand || '');
    setStep('done'); setErrorMsg(null); setRequestLatency(null);
    toast.info('Loaded from history');
  }, []);

  const runDemo = useCallback(({ query, userBrand }) => {
    const demo = structuredClone(DEMO_RESULT);
    demo.query = query || demo.query;
    demo.user_brand = userBrand || '';
    setResult(demo); setBrand(demo.user_brand);
    setLastQuery(demo.query); setLastBrand(demo.user_brand);
    setStep('done'); setLoading(false); setErrorMsg(null); setRequestLatency(null);
    toast.info('Showing sample demo data');
  }, []);

  const handleExportPDF = async () => {
    if (!result) return;
    try {
      const res = await fetch(`${API_BASE}/api/export/pdf-from-result`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      Object.assign(document.createElement('a'), { href: url, download: 'aeo-report.pdf' }).click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
      toast.success('PDF report downloading…');
    } catch {
      toast.error('PDF export requires the FastAPI backend to be running.');
    }
  };

  const handleExportJSON = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: `aeo-${Date.now()}.json` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
    toast.success('Raw JSON exported');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Shareable link copied!');
  };

  const hasResults = Boolean(result && !loading);
  const showDashboard = hasResults && result.leaderboard?.length > 0;
  const showGap = hasResults && result.gap_analysis && brand;

  return (
    <div className="app-container">
      <div className="bg-grid" />

      {/* Navbar */}
      <nav className="navbar">
        <div className="brand-logo">
          <Sparkles size={22} className="text-gradient-accent" />
          <span>AEO Diagnostic</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', position: 'relative' }}>
          {hasResults && <HistoryPanel onLoad={loadFromHistory} />}
          <SystemStatus />
        </div>
      </nav>

      {/* Hero */}
      <motion.section className="hero-section"
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="hero-badge">
          <Sparkles size={14} className="text-gradient-accent" />
          <span className="text-gradient">Real-time Answer Engine Optimization</span>
        </div>
        <h1 className="hero-title">
          Is your brand invisible to <span className="text-gradient-accent">AI Search?</span>
        </h1>
        <p className="hero-subtitle">
          Discover exactly how ChatGPT, Claude &amp; Gemini rank your products,
          and uncover the actionable gaps keeping you off the AI leaderboard.
        </p>

        <QueryInput onSubmit={run} onCancel={handleCancel} isLoading={loading} step={step} />

        {!loading && !hasResults && (
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <button className="btn-secondary" style={{ fontSize: 12, padding: '4px 14px' }}
              onClick={() => runDemo({ query: 'best magnesium supplement for seniors', userBrand: '' })}>
              <Bot size={12} style={{ marginRight: 6 }} /> View sample demo
            </button>
          </div>
        )}
      </motion.section>

      {/* Main Content */}
      <main className="main-content">
        <AnimatePresence>

          {/* Error */}
          {errorMsg && !loading && (
            <motion.div key="error"
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="glass"
              style={{ padding: 20, borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--danger)', display: 'flex', gap: 16, alignItems: 'flex-start' }}
            >
              <AlertCircle size={20} color="var(--danger)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <strong style={{ color: '#FFF', display: 'block', marginBottom: 4 }}>Diagnostic Failed</strong>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>{errorMsg}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Ensure <code>OPENROUTER_API_KEY</code> is set in <code>.env</code> and the backend is running on port 8000.
                </p>
              </div>
              {lastQuery && (
                <button onClick={handleRerun} className="btn-secondary" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <RefreshCw size={13} /> Retry
                </button>
              )}
            </motion.div>
          )}

          {/* Section 1: Live AI Responses */}
          {(loading || hasResults) && (
            <motion.section key="ai-panels"
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6 }}>
              <div className="section-header">
                <h2 className="section-title"><Search size={20} /> Live AI Responses</h2>
                {hasResults && (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    {requestLatency && (
                      <span className="badge" style={{ fontSize: 11, background: 'rgba(16,185,129,0.1)', color: 'var(--success)', borderColor: 'rgba(16,185,129,0.2)' }}>
                        ⏱ {requestLatency}s
                      </span>
                    )}
                    {result?.from_cache && <span className="badge" style={{ fontSize: 11 }}>Cached</span>}
                    <button onClick={handleRerun} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 10px' }}>
                      <RefreshCw size={13} /> Re-run
                    </button>
                    <button onClick={handleExportJSON} className="btn-secondary" title="Download raw JSON payload" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', fontSize: 12 }}>
                      <FileJson size={14} /> JSON
                    </button>
                  </div>
                )}
              </div>
              <ErrorBoundary>
                {/* Pass userBrand for highlighting */}
                <AIPanels responses={result?.responses} isLoading={loading} userBrand={brand} />
              </ErrorBoundary>
            </motion.section>
          )}

          {/* Section 2: Insights at a Glance */}
          {showDashboard && (
            <motion.section key="insights"
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6 }}>
              <ErrorBoundary>
                <InsightsCard
                  leaderboard={result.leaderboard}
                  userBrand={brand}
                  gapAnalysis={result.gap_analysis}
                  duration={requestLatency || result.duration_seconds}
                />
              </ErrorBoundary>
            </motion.section>
          )}

          {/* Section 3: Visibility Dashboard — shows even without brand */}
          {showDashboard && (
            <motion.section key="dashboard"
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }}>
              <div className="section-header">
                <h2 className="section-title">Brand Visibility Dashboard</h2>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {result.leaderboard.length} brands · {result.responses?.filter(r => !r.error).length || 0} engines
                </span>
              </div>
              <div className="dashboard-grid">
                {brand && (
                  <ErrorBoundary>
                    <ScoreCard leaderboard={result.leaderboard} userBrand={brand} />
                  </ErrorBoundary>
                )}
                <ErrorBoundary>
                  <Leaderboard leaderboard={result.leaderboard} userBrand={brand} isLoading={loading} />
                </ErrorBoundary>
              </div>
            </motion.section>
          )}

          {/* Section 4: Gap Analysis */}
          {showGap && (
            <motion.section key="gap"
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6 }}>
              <div className="section-header">
                <h2 className="section-title"><Sparkles size={20} /> Competitive Gap Analysis</h2>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={handleCopyLink} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Link size={14} /> Share
                  </button>
                  <button onClick={handleExportPDF} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Download size={14} /> Export PDF
                  </button>
                </div>
              </div>
              <ErrorBoundary><GapAnalysis gapAnalysis={result.gap_analysis} /></ErrorBoundary>
            </motion.section>
          )}

          {/* Section 5: Related Queries */}
          {hasResults && lastQuery && (
            <motion.section key="related"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5 }}>
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 40 }}>
                <RelatedQueries
                  query={lastQuery}
                  onSelect={(q) => run({ query: q, userBrand: lastBrand })}
                />
              </div>
            </motion.section>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}
