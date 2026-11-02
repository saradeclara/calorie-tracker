import { App } from "@/components/App";
import { ErrorBoundary, GlobalErrorCapture } from "@/components/ErrorBoundary";

export default function Page() {
  return (
    <ErrorBoundary>
      <GlobalErrorCapture />
      <App />
    </ErrorBoundary>
  );
}
