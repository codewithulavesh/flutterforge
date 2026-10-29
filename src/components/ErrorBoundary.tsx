import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** App-level crash guard: a render error in any route shows a recoverable
 *  full-page state instead of a blank white screen. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[FlutterForge] Unhandled UI error:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--ff-bg)]">
        <div className="ff-card max-w-md w-full p-8 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-lg font-semibold text-[var(--ff-text)] mb-2">Something went wrong</h1>
          <p className="text-sm text-[var(--ff-text-muted)] mb-1">
            An unexpected error interrupted the app. Your projects are safe.
          </p>
          <p className="text-xs text-[var(--ff-text-dim)] mb-6 font-mono break-all">
            {error.message.slice(0, 200)}
          </p>
          <div className="flex gap-2 justify-center">
            <button
              className="ff-btn-primary px-4 py-2 rounded-lg text-sm"
              onClick={() => window.location.reload()}
            >
              Reload the app
            </button>
            <button
              className="ff-btn-ghost px-4 py-2 rounded-lg text-sm"
              onClick={() => {
                this.setState({ error: null });
                window.location.assign('/');
              }}
            >
              Go home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
