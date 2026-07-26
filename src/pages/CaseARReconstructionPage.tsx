import {
  useMemo,
} from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ScanLine,
} from "lucide-react";

import ARReconstructionViewer from "../components/reconstruction/ar/ARReconstructionViewer";
import { AccidentCaseService } from "../services/accidentCaseService";

interface ARLoadResult {
  error: string;
  accidentCase:
    | ReturnType<
        typeof AccidentCaseService.getById
      >
    | null;
  reconstruction:
    | ReturnType<
        typeof AccidentCaseService.getLinkedReconstruction
      >
    | null;
}

function loadARScene(
  caseId?: string,
): ARLoadResult {
  if (!caseId) {
    return {
      error:
        "No accident case ID was supplied.",
      accidentCase: null,
      reconstruction: null,
    };
  }

  const accidentCase =
    AccidentCaseService.getById(
      caseId,
    );

  if (!accidentCase) {
    return {
      error:
        "The requested accident case could not be found.",
      accidentCase: null,
      reconstruction: null,
    };
  }

  const reconstruction =
    AccidentCaseService.getLinkedReconstruction(
      accidentCase,
    ) ??
    AccidentCaseService.ensureReconstruction(
      caseId,
    );

  if (!reconstruction) {
    return {
      error:
        "The linked reconstruction could not be loaded. Open and save the normal reconstruction first.",
      accidentCase,
      reconstruction: null,
    };
  }

  return {
    error: "",
    accidentCase,
    reconstruction,
  };
}

export default function CaseARReconstructionPage() {
  const { caseId } =
    useParams<{
      caseId: string;
    }>();

  const navigate =
    useNavigate();

  const result =
    useMemo(
      () =>
        loadARScene(
          caseId,
        ),
      [caseId],
    );

  if (
    !caseId ||
    !result.accidentCase ||
    !result.reconstruction
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#030714] p-4">
        <section className="ui-panel w-full max-w-2xl overflow-hidden text-center">
          <div className="border-b border-[#18243f] p-6">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-md border border-[#713646] bg-[#321722] text-[#e28b9d]">
              <AlertTriangle
                size={20}
              />
            </div>

            <h1 className="mt-4 text-xl font-bold text-slate-100">
              Unable to open AR reconstruction
            </h1>

            <p className="mt-3 text-[10px] leading-5 text-slate-500">
              {result.error}
            </p>
          </div>

          <div className="flex justify-center gap-2 p-4">
            <Link
              to={
                caseId
                  ? `/cases/${caseId}/reconstruction`
                  : "/reconstruction"
              }
              className="ui-button"
            >
              <ArrowLeft
                size={14}
              />
              Return
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <ARReconstructionViewer
      caseId={caseId}
      caseNumber={
        result.accidentCase
          .caseNumber
      }
      caseTitle={
        result.accidentCase
          .title
      }
      recordedBy={
        result.accidentCase
          .investigatingOfficer
      }
      reconstruction={
        result.reconstruction
      }
      onExit={() =>
        navigate(
          `/cases/${caseId}/reconstruction`,
        )
      }
    />
  );
}
