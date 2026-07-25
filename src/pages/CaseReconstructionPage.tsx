import {
  Component,
  useEffect,
  useMemo,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, Orbit, RefreshCw } from "lucide-react";

import AccidentReconstructionEditor from "../components/reconstruction/AccidentReconstructionEditor";
import { AccidentCaseService } from "../services/accidentCaseService";

import type { AccidentCase } from "../types/accidentCase";
import type { AccidentReconstruction } from "../types/reconstruction";

const LAST_RECONSTRUCTION_CASE_KEY =
  "roadsafe-ar-last-reconstruction-case-id";

interface ReconstructionLoadResult {
  accidentCase: AccidentCase | null;
  reconstruction: AccidentReconstruction | null;
  error: string;
}

interface ReconstructionErrorBoundaryProps {
  children: ReactNode;
  casePath: string;
}

interface ReconstructionErrorBoundaryState {
  error: Error | null;
}

class ReconstructionErrorBoundary extends Component<
  ReconstructionErrorBoundaryProps,
  ReconstructionErrorBoundaryState
> {
  state: ReconstructionErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(
    error: Error,
  ): ReconstructionErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      "The reconstruction editor failed to render:",
      error,
      info,
    );
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#030714] p-4">
        <div className="ui-panel w-full max-w-3xl overflow-hidden">
          <div className="border-b border-[#18243f] p-5 text-center">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-md border border-[#713646] bg-[#321722] text-[#e28b9d]">
              <AlertTriangle size={20} strokeWidth={1.8} />
            </div>
            <p className="mt-4 text-[9px] font-bold uppercase tracking-[0.1em] text-[#e28b9d]">
              Reconstruction editor error
            </p>
            <h1 className="mt-2 text-xl font-bold text-slate-100">
              The editor could not be displayed
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-[10px] leading-5 text-slate-500">
              The accident case has not been deleted. Reload the editor or
              return to the case workspace.
            </p>
          </div>

          <pre className="m-4 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-[#713646] bg-[#180b12] p-4 text-[10px] leading-5 text-[#e28b9d]">
            {this.state.error.message ||
              "Unknown reconstruction editor error"}
          </pre>

          <div className="flex flex-wrap justify-center gap-3 border-t border-[#18243f] p-4">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="ui-button-primary"
            >
              <RefreshCw size={14} />
              Reload reconstruction
            </button>

            <Link to={this.props.casePath} className="ui-button">
              Return to case
            </Link>
          </div>
        </div>
      </div>
    );
  }
}

function rememberReconstructionCase(caseId: string): void {
  try {
    localStorage.setItem(LAST_RECONSTRUCTION_CASE_KEY, caseId);
  } catch (error) {
    console.warn("Unable to remember the reconstruction case.", error);
  }
}

function loadReconstruction(caseId?: string): ReconstructionLoadResult {
  if (!caseId) {
    return {
      accidentCase: null,
      reconstruction: null,
      error: "No accident case ID was supplied in the route.",
    };
  }

  try {
    const accidentCase = AccidentCaseService.getById(caseId);

    if (!accidentCase) {
      return {
        accidentCase: null,
        reconstruction: null,
        error: "The requested accident case could not be found.",
      };
    }

    const reconstruction =
      AccidentCaseService.getLinkedReconstruction(accidentCase) ??
      AccidentCaseService.ensureReconstruction(caseId);

    if (!reconstruction) {
      return {
        accidentCase,
        reconstruction: null,
        error:
          "The linked reconstruction could not be loaded or created. Browser storage may be full.",
      };
    }

    return {
      accidentCase,
      reconstruction,
      error: "",
    };
  } catch (error) {
    console.error("Failed to open the case reconstruction:", error);

    return {
      accidentCase: null,
      reconstruction: null,
      error:
        error instanceof Error
          ? error.message
          : "An unknown error occurred while loading the reconstruction.",
    };
  }
}

export default function CaseReconstructionPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const loadResult = useMemo(
    () => loadReconstruction(caseId),
    [caseId],
  );
  const { accidentCase, reconstruction, error } = loadResult;

  useEffect(() => {
    if (caseId && accidentCase && reconstruction) {
      rememberReconstructionCase(caseId);
    }
  }, [accidentCase, caseId, reconstruction]);

  if (!accidentCase || !reconstruction || !caseId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#030714] p-4">
        <section className="ui-panel w-full max-w-2xl overflow-hidden text-center">
          <div className="border-b border-[#18243f] p-6">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-md border border-[#713646] bg-[#321722] text-[#e28b9d]">
              <AlertTriangle size={20} strokeWidth={1.8} />
            </div>
            <h1 className="mt-4 text-xl font-bold text-slate-100">
              Unable to open reconstruction
            </h1>
            <p className="mt-3 text-[10px] leading-5 text-slate-500">
              {error ||
                "The accident case or its linked reconstruction could not be loaded."}
            </p>
          </div>

          <div className="p-4">
            <Link
              to={caseId ? `/cases/${caseId}` : "/reconstruction"}
              className="ui-button inline-flex"
            >
              <Orbit size={14} />
              {caseId ? "Return to case" : "Pick another scene"}
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <ReconstructionErrorBoundary casePath={`/cases/${caseId}`}>
      <AccidentReconstructionEditor
        key={reconstruction.id}
        reconstructionId={reconstruction.id}
        caseContext={{
          caseId,
          caseNumber: accidentCase.caseNumber,
          caseTitle: accidentCase.title,
          casePath: `/cases/${caseId}`,
          reportPath: `/cases/${caseId}/report`,
          footagePath: `/cases/${caseId}/footage`,
          recordedBy: accidentCase.investigatingOfficer,
        }}
        onReconstructionSaved={(savedReconstruction) => {
          AccidentCaseService.registerReconstructionSave(
            caseId,
            savedReconstruction,
          );
          rememberReconstructionCase(caseId);
        }}
        onFootageSaved={(footage) => {
          AccidentCaseService.registerFootage(
            caseId,
            footage.id,
            footage.isPrimary,
          );
        }}
      />
    </ReconstructionErrorBoundary>
  );
}
