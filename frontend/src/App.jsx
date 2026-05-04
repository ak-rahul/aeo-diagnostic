import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Sparkles, Download, Search, AlertCircle, RefreshCw } from 'lucide-react';
import './index.css';
import './app.css';

import QueryInput from './components/QueryInput';
import AIPanels from './components/AIPanels';
import Leaderboard from './components/Leaderboard';
import ScoreCard from './components/ScoreCard';
import GapAnalysis from './components/GapAnalysis';
import ErrorBoundary from './components/ErrorBoundary';
// API_BASE sourced from a single location — no more dual definition
import { API_BASE, DEMO_RESULT } from './constants';

export default function App() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);  // explicit error state
  const [brand, setBrand] = useState('');
  const abortControllerRef = useRef(null);

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

    abortControllerRef.current = new AbortController();

    const timers = [
      setTimeout(() => setStep('extracting'), 5000),
      setTimeout(() => setStep('scoring'), 10000),
      setTimeout(() => setStep('analysing'), 14000),
    ];

    try {
      const res = await fetch(`${API_BASE}/api/diagnostic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, user_brand: userBrand, listing_text: '', use_demo: false }),
        signal: abortControllerRef.current.signal,
      });
      timers.forEach(clearTimeout);

      if (!res.ok) {
        // Surface the actual error from the backend
        let detail = `Server error (${res.status})`;
        try {
          const body = await res.json();
          detail = body.detail || detail;
        } catch (_) { /* ignore parse failure */ }
        throw new Error(detail);
      }

      const data = await res.json();
      setStep('done');
      setResult(data);
    } catch (err) {
      timers.forEach(clearTimeout);

      if (err.name === 'AbortError') {
        // User manually cancelled — show nothing, don't fall into demo
        setLoading(false);
        setStep(null);
        return;
      }

      // Real error: show a clear error state instead of silently showing demo
      setErrorMsg(err.message || 'Failed to connect to the diagnostic backend.');
      setStep(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const runDemo = useCallback(({ query, userBrand }) => {
    // Demo is now opt-in only
    setLoading(false);
    setErrorMsg(null);
    setBrand(userBrand || 'Your Brand');
    const demo = structuredClone(DEMO_RESULT);
    demo.query = query || demo.query;
    demo.user_brand = userBrand || demo.user_brand;
    setResult(demo);
    setStep('done');
  }, []);

  const handleExport = async () => {
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
      // Revoke to prevent memory leak
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch {
      alert('PDF export requires the FastAPI backend to be running.');
    }
  };

  const hasResults = Boolean(result && !loading);
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
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 10px var(--success)' }} />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>System Active</span>
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

        {/* Opt-in demo button */}
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
          {/* Explicit error state — never silently shows fake data */}
          {errorMsg && !loading && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
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
            <motion.section
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
            >
              <div className="section-header">
                <h2 className="section-title">
                  <Search size={20} /> Live AI Responses
                </h2>
                {result?.from_cache && (
                  <span className="badge" style={{ fontSize: 11 }}>Cached result</span>
                )}
              </div>
              <ErrorBoundary>
                <AIPanels responses={result?.responses} isLoading={loading} />
              </ErrorBoundary>
            </motion.section>
          )}

          {hasResults && brand && (
            <motion.section
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <div className="section-header">
                <h2 className="section-title">Visibility Dashboard</h2>
              </div>
              <div className="dashboard-grid">
                <ErrorBoundary>
                  <ScoreCard leaderboard={result.leaderboard} userBrand={brand} />
                </ErrorBoundary>
                <ErrorBoundary>
                  <Leaderboard leaderboard={result.leaderboard} userBrand={brand} isLoading={loading} />
                </ErrorBoundary>
              </div>
            </motion.section>
          )}

          {showGap && (
            <motion.section
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <div className="section-header">
                <h2 className="section-title">
                  <Sparkles size={20} /> Competitive Gap Analysis
                </h2>
                <button onClick={handleExport} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Download size={14} /> Export Report
                </button>
              </div>
              <ErrorBoundary>
                <GapAnalysis gapAnalysis={result.gap_analysis} />
              </ErrorBoundary>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
