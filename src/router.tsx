import { lazy, Suspense, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { createHashRouter, Navigate } from "react-router-dom";

import AppShell from "./components/layout/AppShell";
import HomePage from "./pages/HomePage";

const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const SimulatePage = lazy(() => import("./pages/SimulatePage"));
const ResultsPage = lazy(() => import("./pages/ResultsPage"));
const HistoryPage = lazy(() => import("./pages/HistoryPage"));
const LifeMapPage = lazy(() => import("./pages/LifeMapPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const ModelManagerPage = lazy(() => import("./pages/ModelManagerPage"));

function LazyFallback() {
  return <div className="lazy-loading" />;
}

interface EBState {
  hasError: boolean;
  message: string;
}

/** 捕获懒加载失败，避免整个应用白屏 */
class RouteErrorBoundary extends Component<
  { children: ReactNode },
  EBState
> {
  state: EBState = { hasError: false, message: "" };

  static getDerivedStateFromError(err: Error): EBState {
    return { hasError: true, message: err.message };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error("路由懒加载失败：", err, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
          <p className="text-destructive font-medium">页面加载失败</p>
          <p className="text-sm text-muted-foreground">{this.state.message}</p>
          <button
            className="text-sm underline text-primary"
            onClick={() => window.location.reload()}
          >
            刷新重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function wrap(El: React.LazyExoticComponent<React.ComponentType>) {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<LazyFallback />}>
        <El />
      </Suspense>
    </RouteErrorBoundary>
  );
}

export const router = createHashRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "onboarding", element: wrap(OnboardingPage) },
      { path: "simulate", element: wrap(SimulatePage) },
      { path: "results", element: wrap(ResultsPage) },
      { path: "history", element: wrap(HistoryPage) },
      { path: "lifemap", element: wrap(LifeMapPage) },
      { path: "settings", element: wrap(SettingsPage) },
      { path: "models", element: wrap(ModelManagerPage) },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
