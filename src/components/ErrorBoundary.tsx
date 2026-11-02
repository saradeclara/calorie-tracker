"use client";

import { Component, ReactNode } from "react";

/** Shows a recoverable screen (with the actual error) instead of a blank app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="pt-safe mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-6">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted">Your data is safe. Here&apos;s what broke, in case you want to pass it on:</p>
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-2xl bg-card p-4 text-xs">{this.state.error.message}</pre>
        <button className="h-12 rounded-2xl bg-ink font-semibold text-bg" onClick={() => location.reload()}>
          Reload the app
        </button>
      </div>
    );
  }
}
