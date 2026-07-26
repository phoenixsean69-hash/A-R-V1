import {
  BrowserRouter,
  Route,
  Routes,
} from "react-router-dom";

import {
  ClientHomeRedirect,
  PublicOnlyRoute,
  RequireAuth,
  RequireRole,
} from "./components/auth/AuthRoutes";
import AppShell from "./components/layout/AppShell";
import { AuthProvider } from "./context/AuthContext";
import { CaseSyncProvider } from "./context/CaseSyncContext";
import AccidentReconstructionPage from "./pages/AccidentReconstructionPage";
import AccessPendingPage from "./pages/AccessPendingPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import Dashboard from "./pages/Dashboard";
import EvidencePage from "./pages/EvidencePage";
import FieldDashboardPage from "./pages/FieldDashboardPage";
import FootagePage from "./pages/FootagePage";
import LoginPage from "./pages/LoginPage";
import OfficerManagementPage from "./pages/OfficerManagementPage";
import ReportsPage from "./pages/ReportsPage";
import SceneMapPage from "./pages/SceneMapPage";
import SettingsPage from "./pages/SettingsPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import CaseManagementRoutes from "./routes/caseManagementRoutes";

const ALL_ASSIGNED_ROLES = [
  "field_officer",
  "supervisor",
  "station_admin",
] as const;

const STATION_ROLES = [
  "supervisor",
  "station_admin",
] as const;

export default function App() {
  return (
    <AuthProvider>
      <CaseSyncProvider>
        <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  <LoginPage />
                </PublicOnlyRoute>
              }
            />

            <Route element={<RequireAuth />}>
              <Route
                path="/change-password"
                element={<ChangePasswordPage />}
              />

              <Route
                path="/access-pending"
                element={<AccessPendingPage />}
              />

              <Route element={<AppShell />}>
                <Route
                  index
                  element={<ClientHomeRedirect />}
                />

                <Route
                  element={
                    <RequireRole
                      roles={[
                        ...ALL_ASSIGNED_ROLES,
                      ]}
                    />
                  }
                >
                  <Route
                    path="cases/*"
                    element={<CaseManagementRoutes />}
                  />
                  <Route
                    path="reconstruction"
                    element={
                      <AccidentReconstructionPage />
                    }
                  />
                  <Route
                    path="scene-map"
                    element={<SceneMapPage />}
                  />
                  <Route
                    path="evidence"
                    element={<EvidencePage />}
                  />
                  <Route
                    path="reports"
                    element={<ReportsPage />}
                  />
                  <Route
                    path="footage"
                    element={<FootagePage />}
                  />
                </Route>

                <Route
                  element={
                    <RequireRole
                      roles={[
                        "field_officer",
                      ]}
                    />
                  }
                >
                  <Route
                    path="field"
                    element={<FieldDashboardPage />}
                  />
                </Route>

                <Route
                  element={
                    <RequireRole
                      roles={[
                        ...STATION_ROLES,
                      ]}
                    />
                  }
                >
                  <Route
                    path="station"
                    element={<Dashboard />}
                  />
                  <Route
                    path="analytics"
                    element={<AnalyticsPage />}
                  />
                  <Route
                    path="settings"
                    element={<SettingsPage />}
                  />
                </Route>

                <Route
                  element={
                    <RequireRole
                      roles={[
                        "station_admin",
                      ]}
                    />
                  }
                >
                  <Route
                    path="officers"
                    element={<OfficerManagementPage />}
                  />
                </Route>

                <Route
                  path="unauthorized"
                  element={<UnauthorizedPage />}
                />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </CaseSyncProvider>
    </AuthProvider>
  );
}
