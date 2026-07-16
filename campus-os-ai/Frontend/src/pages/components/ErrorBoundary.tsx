import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Catches render-time errors anywhere in the tree below it and shows a
// recoverable fallback instead of a blank white screen. This only catches
// React render/lifecycle errors — it does not catch errors inside event
// handlers or async code (those already go through try/catch + api.ts's
// ApiRequestError / AuthEventHandler path).
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("CampusOS render error:", error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.assign("/dashboard");
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0A0A0F] px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 ring-1 ring-red-500/20">
          <span className="text-2xl">⚠️</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Something went wrong</p>
          <p className="mt-1 text-xs text-[#64748B] max-w-xs">
            An unexpected error occurred. You can try heading back to the dashboard.
          </p>
        </div>
        <button
          type="button"
          onClick={this.handleReload}
          className="rounded-xl bg-[#6C63FF] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#7C6FFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF]"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }
}
