import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Download,
  Eye,
  FileJson,
  FileText,
  Printer,
} from "lucide-react";
import { AccidentReportService } from "../services/accidentReportService";
import { WorkspaceDataService } from "../services/workspaceDataService";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function ReportsPage() {
  const reports = WorkspaceDataService.getReports();
  const [selectedCaseId, setSelectedCaseId] = useState(reports[0]?.accidentCase.id ?? "");
  const [message, setMessage] = useState("");

  const selected = reports.find((report) => report.accidentCase.id === selectedCaseId) ?? null;

  const buildSelectedReport = () => {
    if (!selected) return null;
    return AccidentReportService.build(
      selected.accidentCase,
      selected.reconstruction,
    );
  };

  return (
    <div className="space-y-3">
      <section className="ui-panel overflow-hidden">
        <div className="ui-panel-header flex-wrap gap-3">
          <div>
            <h2 className="ui-panel-title">Investigation report register</h2>
            <p className="mt-1 text-[9px] text-slate-600">Reports are generated on demand from each stored case and reconstruction.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={selectedCaseId}
              onChange={(event) => setSelectedCaseId(event.target.value)}
              className="ui-input min-w-56"
              disabled={reports.length === 0}
            >
              {reports.length === 0 && <option>No cases available</option>}
              {reports.map((report) => (
                <option key={report.id} value={report.accidentCase.id}>
                  {report.accidentCase.caseNumber} — {report.accidentCase.title}
                </option>
              ))}
            </select>
            {selected && (
              <Link to={`/cases/${selected.accidentCase.id}/report`} className="ui-button-primary"><Eye size={14} />Open report</Link>
            )}
          </div>
        </div>

        {message && <div className="border-b border-[#18243f] bg-[#0d1a31] px-4 py-3 text-[10px] text-[#9fc4ff]">{message}</div>}

        {reports.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto text-slate-700" size={36} strokeWidth={1.3} />
            <h2 className="mt-4 text-sm font-semibold text-slate-300">No case reports can be generated yet</h2>
            <p className="mx-auto mt-2 max-w-md text-[10px] leading-5 text-slate-600">Create an accident case first. This page no longer invents report rows.</p>
            <Link to="/cases/new" className="ui-button-primary mt-5">Create case</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-[10px]">
              <thead className="bg-[#0c1426] text-slate-500">
                <tr>
                  {[
                    "Report",
                    "Case",
                    "Updated",
                    "Investigator",
                    "Readiness",
                    "Actions",
                  ].map((heading) => (
                    <th key={heading} className="px-4 py-3 font-semibold uppercase tracking-wide">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#17243d]">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-[#0c1426]">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-300">{report.title}</p>
                      <p className="mt-1 text-[9px] text-slate-600">{report.reconstruction ? `${report.reconstruction.vehicles.length} participant(s) · ${report.reconstruction.evidenceRecords.length} evidence record(s)` : "No reconstruction linked"}</p>
                    </td>
                    <td className="px-4 py-3"><Link to={`/cases/${report.accidentCase.id}`} className="font-semibold text-[#8db8fb]">{report.accidentCase.caseNumber}</Link><p className="mt-1 text-slate-500">{report.accidentCase.location}</p></td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(report.generatedAt)}</td>
                    <td className="px-4 py-3 text-slate-400">{report.accidentCase.investigatingOfficer || "Not recorded"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded bg-[#17243d]"><div className="h-full bg-[#4f8ce6]" style={{ width: `${report.readiness}%` }} /></div>
                        <span className="text-slate-400">{report.readiness}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Link to={`/cases/${report.accidentCase.id}/report`} className="ui-icon-button h-8 w-8" title="View report"><Eye size={13} /></Link>
                        <button
                          className="ui-icon-button h-8 w-8"
                          title="Download Word report"
                          onClick={() => {
                            const model = AccidentReportService.build(report.accidentCase, report.reconstruction);
                            AccidentReportService.downloadWord(model);
                            setMessage(`${report.accidentCase.caseNumber} Word report downloaded.`);
                          }}
                        ><Download size={13} /></button>
                        <button
                          className="ui-icon-button h-8 w-8"
                          title="Export JSON"
                          onClick={() => {
                            const model = AccidentReportService.build(report.accidentCase, report.reconstruction);
                            AccidentReportService.downloadJson(model);
                            setMessage(`${report.accidentCase.caseNumber} JSON exported.`);
                          }}
                        ><FileJson size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <section className="grid gap-3 lg:grid-cols-[1fr_320px]">
          <article className="ui-panel p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#79adfa]">Selected report</p>
                <h2 className="mt-2 text-lg font-semibold text-slate-200">{selected.accidentCase.caseNumber}</h2>
                <p className="mt-1 text-[10px] text-slate-500">{selected.accidentCase.title}</p>
              </div>
              <span className="ui-badge">{selected.accidentCase.status}</span>
            </div>
            <p className="mt-5 whitespace-pre-wrap text-[10px] leading-6 text-slate-400">{selected.accidentCase.summary || "No case summary has been recorded."}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                ["Participants", selected.reconstruction?.vehicles.length ?? 0],
                ["Evidence", selected.reconstruction?.evidenceRecords.length ?? 0],
                ["Measurements", selected.reconstruction?.measurements.length ?? 0],
              ].map(([label, value]) => <div key={label} className="rounded-md border border-[#1a2946] bg-[#0a1121] p-3"><p className="text-lg font-bold text-slate-200">{value}</p><p className="mt-1 text-[8px] uppercase tracking-wide text-slate-600">{label}</p></div>)}
            </div>
          </article>
          <aside className="ui-panel p-4">
            <h2 className="ui-panel-title">Export actions</h2>
            <div className="mt-4 space-y-2">
              <Link to={`/cases/${selected.accidentCase.id}/report`} className="ui-button-primary w-full"><Eye size={14} />Open full report</Link>
              <button
                className="ui-button w-full"
                onClick={() => {
                  const model = buildSelectedReport();
                  if (!model) return;
                  AccidentReportService.downloadWord(model);
                  setMessage("Word report downloaded.");
                }}
              ><Download size={14} />Download Word</button>
              <button
                className="ui-button w-full"
                onClick={() => {
                  const model = buildSelectedReport();
                  if (!model) return;
                  AccidentReportService.downloadJson(model);
                  setMessage("JSON report exported.");
                }}
              ><FileJson size={14} />Export JSON</button>
              <Link to={`/cases/${selected.accidentCase.id}/report`} className="ui-button w-full"><Printer size={14} />Print / Save PDF</Link>
            </div>
          </aside>
        </section>
      )}
    </div>
  );
}
