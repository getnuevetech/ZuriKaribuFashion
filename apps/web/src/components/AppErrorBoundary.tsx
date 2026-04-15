import React from 'react';

type AppErrorBoundaryProps = {
  children: React.ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

export default class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      message: String(error?.message || 'Application render failure'),
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    try {
      console.error('Application render crash:', error, errorInfo);
    } catch {
      // Ignore console access failures.
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          background: '#f8f6f1',
          color: '#1a1a1a',
          fontFamily: 'Inter Tight, Inter, system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '560px',
            border: '1px solid rgba(220, 38, 38, 0.25)',
            background: '#fff7f7',
            borderRadius: '12px',
            padding: '16px',
          }}
        >
          <p style={{ margin: 0, fontWeight: 700, fontSize: '14px' }}>
            We hit an app error on this device.
          </p>
          <p style={{ margin: '8px 0 0', fontSize: '13px', lineHeight: 1.45 }}>
            {this.state.message || 'Unknown render error.'}
          </p>
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={this.handleRetry}
              style={{
                border: '1px solid #fca5a5',
                background: '#ffffff',
                color: '#991b1b',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              Retry render
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                border: '1px solid #fca5a5',
                background: '#ffffff',
                color: '#991b1b',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
