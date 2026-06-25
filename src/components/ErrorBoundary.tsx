import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  err: Error | null;
}

// 捕获渲染期异常，避免单个坏词条/坏状态把整页打白。
export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err: Error): ErrorBoundaryState {
    return { err };
  }
  componentDidCatch(err: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('App crashed:', err, info);
  }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          textAlign: 'center',
          color: '#e8e8e8',
          background: '#0c0c12',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div>
          <div style={{ fontSize: 19, marginBottom: 8 }}>出错了 😢</div>
          <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 18, maxWidth: 320 }}>
            {String(this.state.err?.message || this.state.err)}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => window.location.reload()}
              style={btn}
            >
              重新加载
            </button>
            <button
              onClick={() => {
                try {
                  localStorage.removeItem('wordquest:v1');
                } catch {
                  /* ignore */
                }
                window.location.reload();
              }}
              style={{ ...btn, borderColor: '#7a3b3b' }}
            >
              清除本地数据并重试
            </button>
          </div>
        </div>
      </div>
    );
  }
}

const btn = {
  cursor: 'pointer',
  padding: '10px 16px',
  borderRadius: 10,
  border: '1px solid #555',
  background: '#1c1c26',
  color: '#e8e8e8',
  fontSize: 14,
};
