import { Route, Routes } from "react-router-dom";

import AccidentCaseFormPage from "../pages/AccidentCaseFormPage";
import AccidentCasePage from "../pages/AccidentCasePage";
import AccidentCasesPage from "../pages/AccidentCasesPage";
import AccidentReportPage from "../pages/AccidentReportPage";
import CaseReconstructionPage from "../pages/CaseReconstructionPage";
import CaseFootagePage from "../pages/CaseFootagePage";
import FootagePlaybackPage from "../pages/FootagePlaybackPage";

export default function CaseManagementRoutes() {
  return (
    <Routes>
      <Route index element={<AccidentCasesPage />} />
      <Route path="new" element={<AccidentCaseFormPage />} />
      <Route path=":caseId" element={<AccidentCasePage />} />
      <Route path=":caseId/edit" element={<AccidentCaseFormPage />} />
      <Route
        path=":caseId/reconstruction"
        element={<CaseReconstructionPage />}
      />
      <Route path=":caseId/report" element={<AccidentReportPage />} />
      <Route path=":caseId/footage" element={<CaseFootagePage />} />
      <Route
        path=":caseId/footage/:footageId"
        element={<FootagePlaybackPage />}
      />
    </Routes>
  );
}
