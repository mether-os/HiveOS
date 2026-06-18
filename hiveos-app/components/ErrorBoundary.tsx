"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });
    console.error("[ErrorBoundary] Unhandled UI Exception caught:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] w-full bg-[#080a0f] border border-[#f43f5e]/20 rounded-2xl p-8 text-neutral-300 font-mono text-xs max-w-2xl mx-auto my-12 select-text">
          <div className="flex items-center gap-2 text-rose-500 font-extrabold uppercase tracking-wider mb-4">
            <AlertTriangle className="w-5 h-5" />
            <span>UI Thread Crash Intercepted</span>
          </div>

          <div className="w-full bg-[#0c101b] border border-[#1e2533] rounded-xl p-4 mb-5 overflow-auto max-h-48 text-[11px] text-neutral-400 leading-relaxed scrollbar-thin">
            <div className="text-rose-400 font-bold mb-1">
              Error: {this.state.error?.message || "Unknown client error"}
            </div>
            {this.state.error?.stack && (
              <pre className="whitespace-pre-wrap font-mono opacity-80 mt-2 text-[10px]">
                {this.state.error.stack}
              </pre>
            )}
            {this.state.errorInfo?.componentStack && (
              <pre className="whitespace-pre-wrap font-mono opacity-60 mt-2 text-[9px] border-t border-[#1e2533]/50 pt-2">
                Component Stack:{this.state.errorInfo.componentStack}
              </pre>
            )}
          </div>

          <div className="flex flex-col items-center gap-3">
            <p className="text-center text-neutral-500 max-w-sm text-[10px] leading-relaxed uppercase">
              The layout engine prevented a full-screen blanking event. You can attempt to soft-reset the state machine below.
            </p>
            
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-4 py-2 bg-[#f5a623] hover:bg-[#f5a623]/90 text-[#080a0f] font-bold uppercase rounded-xl transition-all cursor-pointer select-none text-[10px] tracking-wider"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              <span>Soft-Reset Layout State</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
