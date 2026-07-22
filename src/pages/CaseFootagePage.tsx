import { Link, useParams } from "react-router-dom";

import CaseFootagePanel from "../components/footage/CaseFootagePanel";
import { AccidentCaseService } from "../services/accidentCaseService";

export default function CaseFootagePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const accidentCase = caseId ? AccidentCaseService.getById(caseId) : null;

  if (!accidentCase) {
    return (
      <div className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-10 text-center shadow-sm">
          <h1 className="text-2xl font-black text-slate-900">Case not found</h1>
          <Link to="/cases" className="mt-5 inline-block font-bold text-blue-700">
            Return to cases
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-black text-rose-600">{accidentCase.caseNumber}</p>
            <h1 className="mt-1 text-3xl font-black text-slate-950">
              Reconstruction Footage Library
            </h1>
            <p className="mt-2 text-sm text-slate-600">{accidentCase.title}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/cases/${accidentCase.id}`}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-700"
            >
              ← Back to Case
            </Link>
            <Link
              to={`/cases/${accidentCase.id}/reconstruction`}
              className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-black text-white"
            >
              ● Record Another Version
            </Link>
          </div>
        </header>

        <CaseFootagePanel accidentCase={accidentCase} showAllLink={false} />
      </div>
    </div>
  );
}
