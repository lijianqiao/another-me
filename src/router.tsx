import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

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

function wrap(El: React.LazyExoticComponent<React.ComponentType>) {
  return (
    <Suspense fallback={<LazyFallback />}>
      <El />
    </Suspense>
  );
}

export const router = createBrowserRouter([
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
