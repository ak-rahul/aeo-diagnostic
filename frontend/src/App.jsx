import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Sparkles, Download, Search, AlertCircle, FileJson, Link } from 'lucide-react';
import './index.css';
import './app.css';

import QueryInput from './components/QueryInput';
import AIPanels from './components/AIPanels';
import Leaderboard from './components/Leaderboard';
import ScoreCard from './components/ScoreCard';
import GapAnalysis from './components/GapAnalysis';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider, useToast } from './components/Toast';
import HistoryPanel, { saveToHistory } from './components/HistoryPanel';
import { API_BASE, DEMO_RESULT } from './constants';

// --- Health Indicator ---
function SystemStatus() {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setStatus(data.apis?.openrouter ? 'ok' : 'warn'))
      .catch(() => setStatus('error'));
  }, []);

  const color = status === 'ok' ? 'var(--success)' : status === 'warn' ? 'var(--warning)' : 'var(--danger)';
  const label = status === 'ok' ? 'System Active' : status === 'warn' ? 'API Key Missing' : 'Backend Offline';

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 10px ${color}` }} />
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
    </div>
  );
}

// --- Inner App (needs toast context) ---
function AppInner() {
  const toast = useToast();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [brand, setBrand] = useState('');
  const [requestLatency, setRequestLatency] = useState(null);
  const abortControllerRef = useRef(null);
  const navRef = useRef(null);

  // Auto-run from URL parameters on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    const b = params.get('brand');
    if (q) {
      setTimeout(() => run({ query: q, userBrand: b || '' }), 500);
    }
  }, []);

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
      setStep(null);
    }
  }, []);

  const run = useCallback(async ({ query, userBrand }) => {
    setLoading(true);
    setResult(null);
    setErrorMsg(null);
    setBrand(userBrand);
    setStep('calling');
    setRequestLatency(null);

    // Update URL to make it shareable
    const params = new URLSearchParams();
    params.set('q', query);
    if (userBrand) params.set('brand', userBrand);
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);

    abortControllerRef.current = new AbortController();

    const timers = [
      setTimeout(() => setStep('extracting'), 5000),
      setTimeout(() => setStep('scoring'), 10000),
      setTimeout(() => setStep('analysing'), 14000),
    ];

    const t0 = performance.now();

    try {
      const res = await fetch(`${API_BASE}/api/diagnostic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, user_brand: userBrand, listing_text: '', use_demo: false }),
        signal: abortControllerRef.current.signal,
      });
      timers.forEach(clearTimeout);

      if (!res.ok) {
        let detail = `Server error (${res.status})`;
        try { const body = await res.json(); detail = body.detail || detail; } catch (_) {}
        throw new Error(detail);
      }

      const data = await res.json();
      const latency = ((performance.now() - t0) / 1000).toFixed(2);
      setRequestLatency(latency);
      setStep('done');
      setResult(data);
      saveToHistory(data);
      toast.success(`Analysis complete — ${data.leaderboard?.length || 0} brands ranked`);
    } catch (err) {
      timers.forEach(clearTimeout);
      if (err.name === 'AbortError') { setLoading(false); setStep(null); return; }
      setErrorMsg(err.message || 'Failed to connect to the diagnostic backend.');
      toast.error(err.message || 'Backend connection failed');
      setStep(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFromHistory = useCallback((histResult) => {
    setResult(histResult);
    setBrand(histResult.user_brand || '');
    setStep('done');
    setErrorMsg(null);
    setRequestLatency(null);
    toast.info('Loaded from history');
  }, []);

  const runDemo = useCallback(({ query, userBrand }) => {
    setLoading(false);
    setErrorMsg(null);
    setBrand(userBrand || 'Your Brand');
    const demo = structuredClone(DEMO_RESULT);
    demo.query = query || demo.query;
    demo.user_brand = userBrand || demo.user_brand;
    setResult(demo);
    setRequestLatency(null);
    setStep('done');
    toast.info('Showing sample demo data');
  }, []);

  const handleExportPDF = async () => {
    if (!result) return;
    try {
      const res = await fetch(`${API_BASE}/api/export/pdf-from-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      });
      if (!res.ok) throw new Error('Export Failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: 'aeo-report.pdf' });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
      toast.success('PDF report downloading...');
    } catch {
      toast.error('PDF export requires the FastAPI backend to be running.');
    }
  };

  const handleExportJSON = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `aeo-result-${Date.now()}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
    toast.success('JSON exported');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Shareable link copied to clipboard!');
  };

  const hasResults = Boolean(result && !loading);
  const showGap = hasResults && result.gap_analysis && brand;

  return (
    <div className="app-container">
      <div className="bg-grid" />

      {/* Navbar */}
      <nav className="navbar" ref={navRef} style={{ position: 'sticky', top: 0, zIndex: 100 }}>
        <div className="brand-logo">
          <Sparkles size={22} className="text-gradient-accent" />
          <span>AEO Diagnostic</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', position: 'relative' }}>
          {hasResults && (
            <HistoryPanel onLoad={loadFromHistory} />
          )}
          <SystemStatus />
        </div>
      </nav>

      {/* Hero */}
      <motion.section
        className="hero-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
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
            <button
              className="btn-secondary"
              style={{ fontSize: 12, padding: '4px 14px' }}
              onClick={() => runDemo({ query: 'best magnesium supplement for seniors', userBrand: '' })}
            >
              <Bot size={12} style={{ marginRight: 6 }} />
              View sample demo
            </button>
          </div>
        )}
      </motion.section>

      {/* Main Content */}
      <main className="main-content">
        <AnimatePresence>
          {errorMsg && !loading && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="glass"
              style={{ padding: 20, borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--danger)', display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}
            >
              <AlertCircle size={20} color="var(--danger)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ color: '#FFF', display: 'block', marginBottom: 4 }}>Diagnostic Failed</strong>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>{errorMsg}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Make sure your <code>OPENROUTER_API_KEY</code> is set in <code>.env</code> and the backend is running.
                </p>
              </div>
            </motion.div>
          )}

          {(loading || hasResults) && (
            <motion.section initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6 }}>
              <div className="section-header">
                <h2 className="section-title">
                  <Search size={20} /> Live AI Responses
                </h2>
                {hasResults && (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    {requestLatency && (
                      <span className="badge" style={{ fontSize: 11, background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                        ⏱ {requestLatency}s total
                      </span>
                    )}
                    {result?.from_cache && <span className="badge" style={{ fontSize: 11 }}>Cached</span>}
                    <button onClick={handleExportJSON} className="btn-secondary" title="Download raw JSON for debugging" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', fontSize: 12 }}>
                      <FileJson size={14} /> JSON
                    </button>
                  </div>
                )}
              </div>
              <ErrorBoundary>
                <AIPanels responses={result?.responses} isLoading={loading} />
              </ErrorBoundary>
            </motion.section>
          )}

          {hasResults && brand && (
            <motion.section initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }}>
              <div className="section-header">
                <h2 className="section-title">Visibility Dashboard</h2>
              </div>
              <div className="dashboard-grid">
                <ErrorBoundary><ScoreCard leaderboard={result.leaderboard} userBrand={brand} /></ErrorBoundary>
                <ErrorBoundary><Leaderboard leaderboard={result.leaderboard} userBrand={brand} isLoading={loading} /></ErrorBoundary>
              </div>
            </motion.section>
          )}

          {showGap && (
            <motion.section initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6 }}>
              <div className="section-header">
                <h2 className="section-title">
                  <Sparkles size={20} /> Competitive Gap Analysis
                </h2>
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
