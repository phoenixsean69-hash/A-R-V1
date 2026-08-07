import { Link } from "react-router-dom";

import { AccidentCaseService } from "../../services/accidentCaseService";

export default function DashboardCasesCard() {
  const cases = AccidentCaseService.getAll();
  const activeCases = cases.filter(
    (record) =>
      record.status === "Open" || record.status === "Under Investigation",
  ).length;

  return (
    <section className="rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-blue-800 p-6 text-white shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-200">
            Investigation Workspace
          </p>
          <h2 className="mt-2 text-2xl font-black">Accident Case Management</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
            Create accident cases, continue reconstructions and generate printable
            investigation reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-sm bg-white/10 px-4 py-3 text-center">
            <p className="text-2xl font-black">{activeCases}</p>
            <p className="text-xs text-blue-100">Active cases</p>
          </div>
          <Link
            to="/cases"
            className="rounded-sm bg-white px-5 py-3 text-sm font-bold text-blue-900 transition hover:bg-blue-50"
          >
            Open Cases
          </Link>

          <Link
            to="cases/new"
            className="rounded-sm border border-white/30 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/20"
          >
            + New Case
          </Link>
        </div>
      </div>
    </section>
  );
}