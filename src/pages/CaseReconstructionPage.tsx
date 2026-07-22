import {
  Component,
  useMemo,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { Link, useParams } from "react-router-dom";

import AccidentReconstructionEditor from "../components/reconstruction/AccidentReconstructionEditor";
import { AccidentCaseService } from "../services/accidentCaseService";

import type { AccidentCase } from "../types/accidentCase";
import type { AccidentReconstruction } from "../types/reconstruction";

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
    console.error("The reconstruction editor failed to render:", error, info);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-slate-100 p-4 lg:p-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-black uppercase tracking-wide text-red-600">
            Reconstruction editor error
          </p>
          <h1 className="mt-2 text-2xl font-black text-slate-950">
            The editor could not be displayed
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Your case has not been deleted. Reload the editor after replacing
            the affected files. The technical message is shown below instead of
            leaving a blank white screen.
          </p>

          <pre className="mt-5 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-xs leading-5 text-red-200">
            {this.state.error.message || "Unknown reconstruction editor error"}
          </pre>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white"
            >
              Reload Reconstruction
            </button>

            <Link
              to={this.props.casePath}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700"
            >
              Return to Case
            </Link>
          </div>
        </div>
      </div>
    );
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

    // Reading an existing reconstruction avoids the old render-time save.
    // ensureReconstruction is used only when the case genuinely has no record.
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
  const loadResult = useMemo(() => loadReconstruction(caseId), [caseId]);
  const { accidentCase, reconstruction, error } = loadResult;

  if (!accidentCase || !reconstruction || !caseId) {
    return (
      <div className="min-h-screen bg-slate-100 p-4 lg:p-8">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-10 text-center shadow-sm">
          <h1 className="text-2xl font-black text-slate-900">
            Unable to open reconstruction
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {error ||
              "The accident case or its linked reconstruction could not be loaded."}
          </p>
          <Link
            to={caseId ? `/cases/${caseId}` : "/cases"}
            className="mt-5 inline-block font-bold text-blue-700"
          >
            {caseId ? "Return to case" : "Return to cases"}
          </Link>
        </div>
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