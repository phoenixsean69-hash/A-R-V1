import {
  BrowserRouter,
  Route,
  Routes,
} from "react-router-dom";

import CaseManagementRoutes from "./routes/caseManagementRoutes";
import Dashboard from "./pages/Dashboard";
import AccidentReconstructionPage from "./pages/AccidentReconstructionPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Dashboard />}
        />

        <Route
          path="/cases/*"
          element={<CaseManagementRoutes />}
        />

        <Route
          path="/reconstruction"
          element={
            <AccidentReconstructionPage />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}