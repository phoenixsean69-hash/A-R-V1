import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import CaseCompletionChecklist from "../components/cases/CaseCompletionChecklist";
import CaseFootagePanel from "../components/footage/CaseFootagePanel";
import CaseStatusBadge from "../components/cases/CaseStatusBadge";
import { AccidentCaseService } from "../services/accidentCaseService";
import type { AccidentCaseStatus } from "../types/accidentCase";
import { ACCIDENT_CASE_STATUSES } from "../types/accidentCase";

function formatSavedAt(value?: string): string {
  if (!value) return "Not saved";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

export default function AccidentCasePage() {
  const navigate = useNavigate();
  const { caseId } = useParams<{ caseId: string }>();
  const [version, setVersion] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  void version;

  const record = caseId ? AccidentCaseService.getById(caseId) : null;

  if (!record) {
    return (
      <div className="ui-panel mx-auto max-w-3xl p-10 text-center">
          <h1 className="text-2xl font-black text-slate-900">Case not found</h1>
          <Link to="/cases" className="mt-5 inline-block font-bold text-blue-700">
            Return to cases
          </Link>
      </div>
    );
  }

  const stats = AccidentCaseService.getStats(record);
  const completion = AccidentCaseService.getCompletion(record);

  const statCards: Array<[string, string | number]> = [
    ["Participants", stats.participantCount],
    ["Movement points", stats.movementPointCount],
    ["Evidence", stats.evidenceCount],
    ["Measurements", stats.measurementCount],
    ["Photos", stats.photoCount],
    ["Scene objects", stats.sceneObjectCount],
    ["Timeline events", stats.timelineEventCount],
    ["Footage", stats.footageCount],
    ["Reconstruction", stats.reconstructionStatus],
  ];

  return (
    <div className="case-workspace space-y-3">
      <div className="mx-auto max-w-[1600px] space-y-3">
        <header className="ui-panel flex flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[10px] font-bold tracking-[0.08em] text-[#79adfa]">{record.caseNumber}</p>
              <CaseStatusBadge status={record.status} />
            </div>
            <h1 className="mt-1 text-lg font-bold text-slate-100">
              {record.title}
            </h1>
            <p className="mt-1 text-[10px] text-slate-500">
              {record.location} · {record.accidentDate} at {record.accidentTime}
            </p>
            <p className="mt-1 text-[9px] font-semibold text-slate-600">
              Reconstruction last saved: {formatSavedAt(stats.reconstructionLastSavedAt)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              to="/cases"
              className="ui-button"
            >
              ← Cases
            </Link>
            <Link
              to={`/cases/${record.id}/edit`}
              className="ui-button"
            >
              Edit Case
            </Link>
            <Link
              to={`/cases/${record.id}/reconstruction`}
              className="ui-button-primary"
            >
              {stats.hasReconstruction ? "Continue Reconstruction" : "Create Reconstruction"}
            </Link>
            <Link
              to={`/cases/${record.id}/report`}
              className="ui-button"
            >
              Generate Report
            </Link>
          </div>
        </header>

        {statusMessage && (
          <div className="rounded-md border border-[#6d5523] bg-[#241d10] p-3 text-[10px] font-semibold text-[#d9bd78]">
            {statusMessage}
          </div>
        )}

        <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-9">
          {statCards.map(([label, value]) => (
            <div key={label} className="ui-panel p-3">
              <p className="break-words text-lg font-bold text-slate-100">{value}</p>
              <p className="mt-1 text-[9px] font-semibold text-slate-600">{label}</p>
            </div>
          ))}
        </section>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-3">
            <section className="ui-panel p-4">
              <h2 className="ui-panel-title">Case summary</h2>
              <p className="mt-3 whitespace-pre-wrap text-[11px] leading-6 text-slate-400">
                {record.summary || "No case summary has been recorded."}
              </p>
            </section>

            <CaseCompletionChecklist completion={completion} />

            <CaseFootagePanel
              accidentCase={record}
              onChanged={() => setVersion((current) => current + 1)}
            />
          </div>

          <aside className="space-y-3">
            <section className="ui-panel p-4">
              <h2 className="ui-panel-title">Investigation details</h2>
              <dl className="mt-4 space-y-3 text-[10px]">
                <div>
                  <dt className="font-semibold text-slate-500">Officer</dt>
                  <dd className="text-slate-900">
                    {record.investigatingOfficer || "Not recorded"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Police station</dt>
                  <dd className="text-slate-900">
                    {record.policeStation || "Not recorded"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Junction ID</dt>
                  <dd className="text-slate-900">
                    {record.junctionId || "Not linked"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Reconstruction ID</dt>
                  <dd className="break-all text-xs text-slate-900">
                    {record.reconstructionId || "Not linked"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="ui-panel p-4">
              <label className="block text-[10px] font-bold text-slate-400">
                Update status
                <select
                  value={record.status}
                  onChange={(event) => {
                    const result = AccidentCaseService.setStatus(
                      record.id,
                      event.target.value as AccidentCaseStatus,
                    );

                    if (!result) return;

                    if (result.blocked) {
                      setStatusMessage(result.message ?? "Status update blocked.");
                      setVersion((current) => current + 1);
                      return;
                    }

                    setStatusMessage("Case status updated successfully.");
                    setVersion((current) => current + 1);
                  }}
                  className="ui-input mt-2 w-full"
                >
                  {ACCIDENT_CASE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              {!completion.complete && (
                <p className="mt-3 text-[9px] leading-5 text-[#d9bd78]">
                  Reconstruction Complete remains blocked until all checklist items pass.
                </p>
              )}

              <button
                type="button"
                onClick={() => {
                  if (!window.confirm(`Delete ${record.caseNumber}?`)) return;
                  AccidentCaseService.delete(record.id);
                  navigate("/cases");
                }}
                className="mt-4 w-full rounded-md border border-[#713646] bg-[#321722] px-4 py-2.5 text-[10px] font-bold text-[#e28b9d] transition-colors hover:bg-[#3b1b28]"
              >
                Delete Case
              </button>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
