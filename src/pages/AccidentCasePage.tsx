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
    <div className="min-h-screen bg-slate-100 p-4 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-black text-blue-700">{record.caseNumber}</p>
              <CaseStatusBadge status={record.status} />
            </div>
            <h1 className="mt-2 text-3xl font-black text-slate-950">
              {record.title}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {record.location} · {record.accidentDate} at {record.accidentTime}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Reconstruction last saved: {formatSavedAt(stats.reconstructionLastSavedAt)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              to="/cases"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700"
            >
              ← Cases
            </Link>
            <Link
              to={`/cases/${record.id}/edit`}
              className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700"
            >
              Edit Case
            </Link>
            <Link
              to={`/cases/${record.id}/reconstruction`}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white"
            >
              {stats.hasReconstruction ? "Continue Reconstruction" : "Create Reconstruction"}
            </Link>
            <Link
              to={`/cases/${record.id}/report`}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white"
            >
              Generate Report
            </Link>
          </div>
        </header>

        {statusMessage && (
          <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            {statusMessage}
          </div>
        )}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-9">
          {statCards.map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="break-words text-xl font-black text-slate-900">{value}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{label}</p>
            </div>
          ))}
        </section>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-5">
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black text-slate-950">Case Summary</h2>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {record.summary || "No case summary has been recorded."}
              </p>
            </section>

            <CaseCompletionChecklist completion={completion} />

            <CaseFootagePanel
              accidentCase={record}
              onChanged={() => setVersion((current) => current + 1)}
            />
          </div>

          <aside className="space-y-5">
            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="font-black text-slate-950">Investigation Details</h2>
              <dl className="mt-4 space-y-3 text-sm">
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

            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <label className="block text-sm font-bold text-slate-700">
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
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                >
                  {ACCIDENT_CASE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              {!completion.complete && (
                <p className="mt-3 text-xs leading-5 text-amber-700">
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
                className="mt-4 w-full rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700"
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
