import { createBrowserRouter, Navigate } from "react-router-dom";

import AppShell from "./components/layout/AppShell";
import HistoryPage from "./pages/HistoryPage";
import HomePage from "./pages/HomePage";
import LifeMapPage from "./pages/LifeMapPage";
import OnboardingPage from "./pages/OnboardingPage";
import SettingsPage from "./pages/SettingsPage";
import SimulatePage from "./pages/SimulatePage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "onboarding", element: <OnboardingPage /> },
      { path: "simulate", element: <SimulatePage /> },
      { path: "history", element: <HistoryPage /> },
      { path: "lifemap", element: <LifeMapPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
