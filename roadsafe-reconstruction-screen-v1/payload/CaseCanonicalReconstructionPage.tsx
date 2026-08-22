import { useMemo } from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";
import AccidentReconstructionEditor from "../components/reconstruction/AccidentReconstructionEditor";
import { AccidentCaseService } from "../services/accidentCaseService";

export default function CaseCanonicalReconstructionPage() {
  const { caseId } =
    useParams<{
      caseId: string;
    }>();

  const navigate =
    useNavigate();

  const accidentCase =
    useMemo(
      () =>
        caseId
          ? AccidentCaseService.getById(
              caseId,
            )
          : null,
      [caseId],
    );

  const reconstruction =
    useMemo(
      () =>
        caseId
          ? AccidentCaseService.ensureReconstruction(
              caseId,
            )
          : null,
      [caseId],
    );

  if (
    !caseId ||
    !accidentCase ||
    !reconstruction
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#202020] p-4">
        <section className="ui-panel w-full max-w-2xl overflow-hidden text-center">
          <div className="border-b border-[#494949] p-6">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#e8872d]">
              RoadSafe Canonical Reconstruction
            </p>

            <h1 className="mt-3 text-xl font-bold text-slate-100">
              Unable to open canonical reconstruction
            </h1>

            <p className="mt-3 text-[10px] leading-5 text-slate-500">
              The case or its linked reconstruction could not be loaded.
            </p>
          </div>

          <div className="p-4">
            <Link
              to={
                caseId
                  ? `/cases/${caseId}/reconstruction`
                  : "/cases"
              }
              className="ui-button inline-flex"
            >
              Return
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <AccidentReconstructionEditor
      reconstructionId={
        reconstruction.id
      }
      caseContext={{
        caseId,
        caseNumber:
          accidentCase.caseNumber,
        caseTitle:
          accidentCase.title,
        casePath:
          `/cases/${caseId}`,
        reportPath:
          `/cases/${caseId}/report`,
        footagePath:
          `/cases/${caseId}/footage`,
        recordedBy:
          accidentCase.investigatingOfficer,
      }}
      onReconstructionSaved={() => {
        AccidentCaseService.registerReconstructionSave(
          caseId,
        );
      }}
    />
  );
}
