import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Archive,
  Copy,
  FileText,
  Filter,
  FolderOpen,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import CaseStatusBadge from "../components/cases/CaseStatusBadge";
import { AccidentCaseService } from "../services/accidentCaseService";
import type { AccidentCaseStatus } from "../types/accidentCase";
import { ACCIDENT_CASE_STATUSES } from "../types/accidentCase";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function AccidentCasesPage() {
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"All" | AccidentCaseStatus>("All");
  const [view, setView] = useState<"table" | "cards">("table");
  void version;

  const cases = AccidentCaseService.getAll();
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

  const activeCount = cases.filter((record) =>
    ["Open", "Under Investigation"].includes(record.status),
  ).length;
  const completedCount = cases.filter((record) =>
    ["Reconstruction Complete", "Closed"].includes(record.status),
  ).length;
  const evidenceCount = cases.reduce(
    (total, record) => total + AccidentCaseService.getStats(record).evidenceCount,
    0,
  );

  const archiveCase = (caseId: string) => {
    AccidentCaseService.archive(caseId);
    setVersion((current) => current + 1);
  };

  const deleteCase = (caseId: string, caseNumber: string) => {
    if (!window.confirm(`Delete ${caseNumber} and its linked reconstruction?`)) return;
    AccidentCaseService.delete(caseId);
    setVersion((current) => current + 1);
  };

  return (
    <div className="space-y-3">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["All cases", cases.length, "Complete investigation register"],
          ["Active", activeCount, "Open or under investigation"],
          ["Completed", completedCount, "Reconstruction complete or closed"],
          ["Evidence records", evidenceCount, "Across linked reconstructions"],
        ].map(([label, value, detail]) => (
          <article key={label} className="ui-panel p-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-100">{value}</p>
            <p className="mt-1 text-[9px] text-slate-600">{detail}</p>
          </article>
        ))}
      </section>

      <section className="ui-panel overflow-hidden">
        <div className="ui-panel-header flex-wrap gap-3">
          <div>
            <h2 className="ui-panel-title">Accident case register</h2>
            <p className="mt-1 text-[9px] text-slate-600">Every row is backed by a stored case record.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border border-[#1d2c4b] bg-[#080e1c] p-1">
              <button className={view === "table" ? "ui-button-primary py-1.5" : "ui-button py-1.5"} onClick={() => setView("table")}>Table</button>
              <button className={view === "cards" ? "ui-button-primary py-1.5" : "ui-button py-1.5"} onClick={() => setView("cards")}>Cards</button>
            </div>
            <Link to="/cases/new" className="ui-button-primary"><Plus size={14} />New case</Link>
          </div>
        </div>

        <div className="grid gap-3 border-b border-[#18243f] p-4 md:grid-cols-[1fr_240px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search case number, title, location or officer"
              className="ui-input w-full pl-9"
            />
          </label>
          <label className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as "All" | AccidentCaseStatus)}
              className="ui-input w-full appearance-none pl-9"
            >
              <option value="All">All statuses</option>
              {ACCIDENT_CASE_STATUSES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        </div>

        {filteredCases.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-slate-300">No cases match the current filters.</p>
            <p className="mt-2 text-[10px] text-slate-600">Create a new investigation or adjust the search.</p>
            <Link to="/cases/new" className="ui-button-primary mt-4"><Plus size={14} />Create case</Link>
          </div>
        ) : view === "table" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-[10px]">
              <thead className="bg-[#0c1426] text-slate-500">
                <tr>
                  {[
                    "Case",
                    "Location",
                    "Date / time",
                    "Status",
                    "Officer",
                    "Scene records",
                    "Actions",
                  ].map((heading) => (
                    <th key={heading} className="px-4 py-3 font-semibold uppercase tracking-[0.08em]">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#17243d]">
                {filteredCases.map((record) => {
                  const stats = AccidentCaseService.getStats(record);
                  return (
                    <tr key={record.id} className="hover:bg-[#0c1426]">
                      <td className="px-4 py-3">
                        <Link to={`/cases/${record.id}`} className="font-semibold text-[#8db8fb] hover:text-white">{record.caseNumber}</Link>
                        <p className="mt-1 max-w-[230px] truncate text-slate-400">{record.title}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{record.location}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(record.accidentDate)}<p className="mt-1">{record.accidentTime}</p></td>
                      <td className="px-4 py-3"><CaseStatusBadge status={record.status} /></td>
                      <td className="px-4 py-3 text-slate-400">{record.investigatingOfficer || "Not recorded"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-3 text-slate-500">
                          <span title="Participants">P {stats.participantCount}</span>
                          <span title="Evidence">E {stats.evidenceCount}</span>
                          <span title="Photos">PH {stats.photoCount}</span>
                          <span title="Footage">V {stats.footageCount}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link to={`/cases/${record.id}`} className="ui-icon-button h-8 w-8" title="Open case"><FolderOpen size={14} /></Link>
                          <Link to={`/cases/${record.id}/reconstruction`} className="ui-icon-button h-8 w-8" title="Open reconstruction"><ActivityIcon /></Link>
                          <Link to={`/cases/${record.id}/report`} className="ui-icon-button h-8 w-8" title="Open report"><FileText size={14} /></Link>
                          <button
                            className="ui-icon-button h-8 w-8"
                            title="Duplicate"
                            onClick={() => {
                              const duplicate = AccidentCaseService.duplicate(record.id);
                              if (duplicate) navigate(`/cases/${duplicate.id}/edit`);
                            }}
                          ><Copy size={14} /></button>
                          {record.status !== "Archived" && <button className="ui-icon-button h-8 w-8" title="Archive" onClick={() => archiveCase(record.id)}><Archive size={14} /></button>}
                          <button className="ui-icon-button h-8 w-8 text-red-400" title="Delete" onClick={() => deleteCase(record.id, record.caseNumber)}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredCases.map((record) => {
              const stats = AccidentCaseService.getStats(record);
              return (
                <article key={record.id} className="rounded-md border border-[#1a2946] bg-[#0a1121] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="text-[10px] font-bold text-[#8db8fb]">{record.caseNumber}</p><h3 className="mt-1 truncate text-sm font-semibold text-slate-200">{record.title}</h3></div>
                    <CaseStatusBadge status={record.status} />
                  </div>
                  <p className="mt-3 text-[10px] leading-5 text-slate-500">{record.location}</p>
                  <div className="mt-4 grid grid-cols-4 gap-2 border-y border-[#17243d] py-3 text-center">
                    {[["P", stats.participantCount], ["E", stats.evidenceCount], ["M", stats.measurementCount], ["V", stats.footageCount]].map(([label, value]) => <div key={label}><p className="text-sm font-bold text-slate-200">{value}</p><p className="text-[8px] text-slate-600">{label}</p></div>)}
                  </div>
                  <div className="mt-4 flex gap-2"><Link to={`/cases/${record.id}`} className="ui-button flex-1">Open</Link><Link to={`/cases/${record.id}/reconstruction`} className="ui-button-primary flex-1">Reconstruct</Link></div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function ActivityIcon() {
  return <span className="text-[11px] font-black">3D</span>;
}
