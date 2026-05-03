import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Sparkles, Download, Search } from 'lucide-react';
import './index.css';
import './app.css';

import QueryInput from './components/QueryInput';
import AIPanels from './components/AIPanels';
import Leaderboard from './components/Leaderboard';
import ScoreCard from './components/ScoreCard';
import GapAnalysis from './components/GapAnalysis';
import { DEMO_RESULT } from './constants';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function App() {
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep]       = useState(null);
  const [isDemo, setIsDemo]   = useState(false);
  const [brand, setBrand]     = useState('');

  const run = useCallback(async ({ query, userBrand }) => {
    setLoading(true);
    setResult(null);
    setIsDemo(false);
    setBrand(userBrand);
    setStep('calling');

    const timers = [
      setTimeout(() => setStep('extracting'), 5000),
      setTimeout(() => setStep('scoring'),    10000),
      setTimeout(() => setStep('analysing'),  14000),
    ];

    try {
      const res = await fetch(`${API_BASE}/api/diagnostic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, user_brand: userBrand, listing_text: '', use_demo: false }),
      });
      timers.forEach(clearTimeout);
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      setStep('done');
      setResult(data);
    } catch (err) {
      timers.forEach(clearTimeout);
      const demo = structuredClone(DEMO_RESULT);
      demo.query = query;
      demo.user_brand = userBrand;
      if (userBrand && !demo.leaderboard.find(b => b.brand.toLowerCase() === userBrand.toLowerCase())) {
        demo.leaderboard.push({
          rank: demo.leaderboard.length + 1,
          brand: userBrand,
          total_score: 0,
          rag_status: 'red',
          ais_mentioned_in: 0,
          breakdown: { 'GPT-4o': { score: 0 }, 'Claude Sonnet': { score: 0 }, 'Gemini 1.5 Pro': { score: 0 } },
        });
      }
      setStep('done');
      setResult(demo);
      setIsDemo(true);
    } finally {
      setLoading(false);
    }
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
      const a = Object.assign(document.createElement('a'), { href: url, download: 'pixii-aeo-report.pdf' });
      a.click();
    } catch {
      alert('PDF export requires the FastAPI backend running.');
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
          <Bot size={24} />
          <span>pixii.ai</span>
          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/</span>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>AEO Diagnostic</span>
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
          Discover exactly how ChatGPT, Claude & Gemini rank your products, 
          and uncover the actionable gaps keeping you off the AI leaderboard.
        </p>

        <QueryInput onSubmit={run} isLoading={loading} step={step} />
      </motion.section>

      {/* Main Content */}
      <main className="main-content">
        <AnimatePresence>
          {isDemo && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="glass" 
              style={{ padding: 16, borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--warning)', display: 'flex', gap: 12, alignItems: 'center' }}
            >
              <span style={{ fontSize: 20 }}>⚠️</span>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                <strong style={{ color: '#FFF' }}>Demo Mode Active.</strong> The backend API keys were not found. Showing simulated data for demonstration.
              </p>
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
              </div>
              <AIPanels responses={result?.responses} isLoading={loading} />
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
                <ScoreCard leaderboard={result.leaderboard} userBrand={brand} />
                <Leaderboard leaderboard={result.leaderboard} userBrand={brand} />
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
              <GapAnalysis gapAnalysis={result.gap_analysis} />
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
