import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AccidentCaseService } from "../services/accidentCaseService";
import ForensicInvestigationWorkspace from "../features/forensicReconstruction/ForensicInvestigationWorkspace";
import { ForensicInvestigationService } from "../features/forensicReconstruction/forensicInvestigationService";

export default function CaseReconstructionPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const accidentCase = useMemo(
    () => (caseId ? AccidentCaseService.getById(caseId) : null),
    [caseId],
  );

  const investigation = useMemo(
    () => (accidentCase ? ForensicInvestigationService.getOrCreate(accidentCase) : null),
    [accidentCase],
  );

  if (!caseId || !accidentCase || !investigation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#202020] p-4">
        <section className="ui-panel w-full max-w-2xl overflow-hidden text-center">
          <div className="border-b border-[#494949] p-6">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#e8872d]">
              RoadSafe Forensic Reconstruction V2
            </p>
            <h1 className="mt-3 text-xl font-bold text-slate-100">
              Unable to open forensic investigation
            </h1>
            <p className="mt-3 text-[10px] leading-5 text-slate-500">
              The requested accident case could not be found.
            </p>
          </div>
          <div className="p-4">
            <Link to="/cases" className="ui-button inline-flex">Return to cases</Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <ForensicInvestigationWorkspace
      accidentCase={accidentCase}
      initialInvestigation={investigation}
      onExit={() => navigate(`/cases/${caseId}`)}
    />
  );
}
