import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-8">
          <div className="glass-strong rounded-3xl p-8 shadow-elevated border border-border/50 max-w-lg w-full text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-critical/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-critical" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Something went wrong
            </h2>
            <p className="text-muted-foreground mb-6">
              An unexpected error occurred. This has been logged for investigation.
            </p>
            {this.state.error && (
              <div className="mb-6 p-3 bg-secondary rounded-xl text-left">
                <p className="text-xs font-mono text-muted-foreground break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}
            <div className="flex items-center justify-center gap-3">
              <Button
                onClick={this.handleReset}
                variant="outline"
                className="gap-2 rounded-xl"
              >
                Try Again
              </Button>
              <Button
                onClick={this.handleReload}
                className="gap-2 rounded-xl btn-primary-gradient"
              >
                <RefreshCw className="h-4 w-4" />
                Reload App
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
