/**
 * Toast.jsx — Lightweight, accessible toast notification system.
 * Replaces alert() with proper non-blocking UI feedback.
 * 
 * Usage:
 *   import { useToast, Toaster } from './Toast';
 *   const toast = useToast();
 *   toast.success('Copied!');
 *   toast.error('Export failed.');
 */

import { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

let _id = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((type, message, duration = 3500) => {
    const id = ++_id;
    setToasts(t => [...t, { id, type, message }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration);
  }, []);

  const dismiss = useCallback((id) => setToasts(t => t.filter(x => x.id !== id)), []);

  const toast = {
    success: (msg, dur) => push('success', msg, dur),
    error:   (msg, dur) => push('error',   msg, dur),
    info:    (msg, dur) => push('info',    msg, dur),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

const ICONS = { success: CheckCircle2, error: XCircle, info: Info };
const COLORS = { success: 'var(--success)', error: 'var(--danger)', info: 'var(--accent-cyan)' };
const BG = { success: 'var(--success-bg)', error: 'var(--danger-bg)', info: 'rgba(0, 229, 255, 0.07)' };

function Toaster({ toasts, onDismiss }) {
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none' }}>
      <AnimatePresence>
        {toasts.map(({ id, type, message }) => {
          const Icon = ICONS[type] || Info;
          return (
            <motion.div
              key={id}
              initial={{ opacity: 0, x: 60, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.95 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              style={{
                pointerEvents: 'all',
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'rgba(10, 10, 10, 0.92)',
                border: `1px solid ${COLORS[type]}33`,
                borderLeft: `3px solid ${COLORS[type]}`,
                borderRadius: '10px',
                padding: '12px 16px',
                backdropFilter: 'blur(16px)',
                boxShadow: `0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)`,
                minWidth: 260,
                maxWidth: 380,
              }}
            >
              <Icon size={18} color={COLORS[type]} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 14, color: '#FFF', flex: 1, lineHeight: 1.4 }}>{message}</span>
              <button
                onClick={() => onDismiss(id)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
