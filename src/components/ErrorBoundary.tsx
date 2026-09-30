import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/login';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 text-center shadow-lg space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-foreground">Terjadi Kendala pada Halaman</h2>
              <p className="text-xs text-muted-foreground">
                Sistem mendeteksi galat saat memuat komponen tampilan.
              </p>
            </div>

            {this.state.error && (
              <div className="text-left bg-muted/60 p-3 rounded-xl border border-border overflow-auto max-h-36">
                <p className="font-mono text-[11px] text-destructive break-words">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                onClick={this.handleReload}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs rounded-xl gap-1.5 h-9"
              >
                <RotateCw className="w-3.5 h-3.5" />
                Muat Ulang Halaman
              </Button>
              <Button
                variant="outline"
                onClick={this.handleGoHome}
                className="border-border text-foreground text-xs rounded-xl gap-1.5 h-9"
              >
                <Home className="w-3.5 h-3.5" />
                Ke Halaman Login
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
