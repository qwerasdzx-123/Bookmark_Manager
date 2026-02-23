import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('React 错误边界捕获到错误:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          backgroundColor: '#fee2e2',
          border: '2px solid #ef4444',
          borderRadius: '8px',
          margin: '20px'
        }}>
          <h2 style={{ color: '#dc2626', marginBottom: '16px' }}>
            应用发生错误
          </h2>
          <p style={{ color: '#991b1b', marginBottom: '12px' }}>
            {this.state.error?.message || '未知错误'}
          </p>
          <pre style={{
            backgroundColor: '#fef2f2',
            padding: '12px',
            borderRadius: '4px',
            overflow: 'auto',
            fontSize: '12px'
          }}>
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            重新加载页面
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
