import { BrowserRouter, Route, Routes } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import CaseManagementRoutes from "./routes/caseManagementRoutes";
import Dashboard from "./pages/Dashboard";
import AccidentReconstructionPage from "./pages/AccidentReconstructionPage";
import SceneMapPage from "./pages/SceneMapPage";
import EvidencePage from "./pages/EvidencePage";
import ReportsPage from "./pages/ReportsPage";
import FootagePage from "./pages/FootagePage";
import AnalyticsPage from "./pages/AnalyticsPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="cases/*" element={<CaseManagementRoutes />} />
          <Route path="reconstruction" element={<AccidentReconstructionPage />} />
          <Route path="scene-map" element={<SceneMapPage />} />
          <Route path="evidence" element={<EvidencePage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="footage" element={<FootagePage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
