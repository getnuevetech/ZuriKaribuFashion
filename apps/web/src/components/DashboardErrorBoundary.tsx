import React from 'react';

type DashboardErrorBoundaryProps = {
  children: React.ReactNode;
};

type DashboardErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

export default class DashboardErrorBoundary extends React.Component<
  DashboardErrorBoundaryProps,
  DashboardErrorBoundaryState
> {
  state: DashboardErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): DashboardErrorBoundaryState {
    return {
      hasError: true,
      message: String(error?.message || 'Unknown dashboard render error'),
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    try {
      console.error('Dashboard render crash:', error, errorInfo);
    } catch {
      // Ignore logging failures.
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          <p className="text-sm font-semibold">Dashboard failed to render.</p>
          <p className="mt-1 text-sm">
            {this.state.message || 'An unexpected error occurred while rendering this page.'}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={this.handleRetry}
              className="rounded border border-red-300 bg-white px-3 py-1.5 text-sm text-red-800 hover:bg-red-100"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded border border-red-300 bg-white px-3 py-1.5 text-sm text-red-800 hover:bg-red-100"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
