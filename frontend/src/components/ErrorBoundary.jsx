import { Component } from 'react';

/**
 * ErrorBoundary — wraps any result section so a render crash in one
 * component (e.g. unexpected null in gap_analysis.gaps) shows a fallback
 * UI instead of blanking the entire page.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Unknown error' };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '20px 24px',
            borderRadius: 12,
            border: '1px solid var(--danger)',
            background: 'rgba(239,68,68,0.06)',
            color: 'var(--text-secondary)',
            fontSize: 13,
          }}
        >
          <strong style={{ color: 'var(--danger)', display: 'block', marginBottom: 6 }}>
            ⚠ This section failed to render
          </strong>
          <code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{this.state.message}</code>
        </div>
      );
    }
    return this.props.children;
  }
}
