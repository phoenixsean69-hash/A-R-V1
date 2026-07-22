import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import CaseStatusBadge from "../components/cases/CaseStatusBadge";
import { AccidentCaseService } from "../services/accidentCaseService";
import type { AccidentCaseStatus } from "../types/accidentCase";
import { ACCIDENT_CASE_STATUSES } from "../types/accidentCase";

export default function AccidentCasesPage() {
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"All" | AccidentCaseStatus>("All");

  const cases = useMemo(() => AccidentCaseService.getAll(), [version]);

  const filteredCases = useMemo(() => {
    const normalisedQuery = query.trim().toLowerCase();

    return cases.filter((record) => {
      const matchesStatus = status === "All" || record.status === status;
      const matchesQuery =
        !normalisedQuery ||
        record.caseNumber.toLowerCase().includes(normalisedQuery) ||
        record.title.toLowerCase().includes(normalisedQuery) ||
        record.location.toLowerCase().includes(normalisedQuery) ||
        record.investigatingOfficer.toLowerCase().includes(normalisedQuery);

      return matchesStatus && matchesQuery;
    });
  }, [cases, query, status]);

  const activeCount = cases.filter(
    (record) =>
      record.status === "Open" || record.status === "Under Investigation",
  ).length;
  const completedCount = cases.filter(
    (record) => record.status === "Reconstruction Complete",
  ).length;
  const archivedCount = cases.filter(
    (record) => record.status === "Archived",
  ).length;

  return (
    <div className="min-h-screen bg-slate-100 p-4 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">
              RoadSafe AR
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">
              Accident Cases
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Manage investigations, reconstructions, evidence and reports.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              ← Dashboard
            </Link>
            <Link
              to="/cases/new"
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow hover:bg-blue-700"
            >
              + New Case
            </Link>
          </div>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["All cases", cases.length],
            ["Active", activeCount],
            ["Reconstruction complete", completedCount],
            ["Archived", archivedCount],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[1fr_260px]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search case number, title, location or officer..."
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
            />

            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as "All" | AccidentCaseStatus)
              }
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
            >
              <option value="All">All statuses</option>
              {ACCIDENT_CASE_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="mt-6 space-y-4">
          {filteredCases.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <h2 className="text-xl font-black text-slate-900">No cases found</h2>
              <p className="mt-2 text-sm text-slate-500">
                Create the first accident case or change the current filters.
              </p>
            </div>
          ) : (
            filteredCases.map((record) => {
              const stats = AccidentCaseService.getStats(record);

              return (
                <article
                  key={record.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-sm font-black text-blue-700">
                          {record.caseNumber}
                        </p>
                        <CaseStatusBadge status={record.status} />
                      </div>
                      <h2 className="mt-2 text-xl font-black text-slate-950">
                        {record.title}
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        {record.location} · {record.accidentDate} at {record.accidentTime}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Officer: {record.investigatingOfficer || "Not recorded"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        to={`/cases/${record.id}`}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Open Case
                      </Link>
                      <Link
                        to={`/cases/${record.id}/reconstruction`}
                        className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
                      >
                        Continue Reconstruction
                      </Link>
                      <Link
                        to={`/cases/${record.id}/report`}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                      >
                        Generate Report
                      </Link>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-6">
                    {[
                      ["Participants", stats.participantCount],
                      ["Evidence", stats.evidenceCount],
                      ["Measurements", stats.measurementCount],
                      ["Photos", stats.photoCount],
                      ["Objects", stats.sceneObjectCount],
                      ["Timeline", stats.timelineEventCount],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-lg font-black text-slate-900">{value}</p>
                        <p className="text-[11px] font-semibold text-slate-500">{label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const duplicate = AccidentCaseService.duplicate(record.id);
                        if (duplicate) navigate(`/cases/${duplicate.id}/edit`);
                      }}
                      className="text-xs font-bold text-slate-600 hover:text-blue-700"
                    >
                      Duplicate
                    </button>
                    {record.status !== "Archived" && (
                      <button
                        type="button"
                        onClick={() => {
                          AccidentCaseService.archive(record.id);
                          setVersion((current) => current + 1);
                        }}
                        className="text-xs font-bold text-slate-600 hover:text-amber-700"
                      >
                        Archive
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm(`Delete ${record.caseNumber}?`)) return;
                        AccidentCaseService.delete(record.id);
                        setVersion((current) => current + 1);
                      }}
                      className="text-xs font-bold text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}
