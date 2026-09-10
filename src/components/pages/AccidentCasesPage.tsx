import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Archive,
  Boxes,
  CheckCircle2,
  Cloud,
  ClipboardList,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Filter,
  FolderKanban,
  ListChecks,
  LoaderCircle,
  Orbit,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
} from "../../components/icons/materialIcons";

import CaseStatusBadge from "../../components/cases/CaseStatusBadge";
import { useAuth } from "../../context/AuthContext";
import { useCaseSync } from "../../context/CaseSyncContext";
import { AccidentCaseService } from "../../services/accidentCaseService";
import type { AccidentCaseStatus } from "../../types/accidentCase";
import { ACCIDENT_CASE_STATUSES } from "../../types/accidentCase";

import "./AccidentCasesPage.css";

const LAST_RECONSTRUCTION_CASE_KEY =
  "roadsafe-ar-last-reconstruction-case-id";

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value || "Not recorded";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function rememberReconstructionCase(caseId: string): void {
  try {
    localStorage.setItem(LAST_RECONSTRUCTION_CASE_KEY, caseId);
  } catch (error) {
    console.warn("Unable to remember the selected reconstruction case.", error);
  }
}

export default function AccidentCasesPage() {
  const navigate = useNavigate();
  const { identity } = useAuth();
  const caseSync = useCaseSync();

  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"All" | AccidentCaseStatus>("All");
  const [view, setView] = useState<"table" | "cards">("table");
  const [importing, setImporting] = useState(false);

  void version;
  void caseSync.revision;

  const cases = AccidentCaseService.getAll();

  const isStationAdministrator =
    identity?.role === "station_admin";

  const canManageLifecycle =
    identity?.role === "supervisor" ||
    identity?.role === "station_admin";

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
    (total, record) =>
      total + AccidentCaseService.getStats(record).evidenceCount,
    0,
  );

  const archiveCase = (caseId: string) => {
    AccidentCaseService.archive(caseId);
    setVersion((current) => current + 1);
  };

  const deleteCase = (caseId: string, caseNumber: string) => {
    if (
      !window.confirm(
        `Delete ${caseNumber} and its linked reconstruction?`,
      )
    ) {
      return;
    }

    AccidentCaseService.delete(caseId);

    try {
      if (
        localStorage.getItem(LAST_RECONSTRUCTION_CASE_KEY) === caseId
      ) {
        localStorage.removeItem(LAST_RECONSTRUCTION_CASE_KEY);
      }
    } catch (error) {
      console.warn("Unable to clear the remembered reconstruction case.", error);
    }

    setVersion((current) => current + 1);
  };

  const importLegacyCases = async () => {
    if (
      !window.confirm(
        `Import ${caseSync.localOnlyCount} local case(s) into the shared station database? Existing cloud cases with the same case number will be skipped.`,
      )
    ) {
      return;
    }

    setImporting(true);

    try {
      await caseSync.importLocalCases();
    } finally {
      setImporting(false);
    }
  };


  const exportRegisterCsv = () => {
    const escapeCsv = (value: unknown) => {
      const text = String(value ?? "");

      return `"${text.replaceAll('"', '""')}"`;
    };

    const rows = filteredCases.map((record) => {
      const stats = AccidentCaseService.getStats(record);

      return [
        record.caseNumber,
        record.title,
        record.location,
        record.investigatingOfficer,
        record.accidentDate,
        record.accidentTime,
        record.status,
        stats.participantCount,
        stats.evidenceCount,
        stats.measurementCount,
        stats.photoCount,
        stats.footageCount,
      ];
    });

    const csv = [
      [
        "Case",
        "Title",
        "Location",
        "Officer",
        "Date",
        "Time",
        "Status",
        "Participants",
        "Evidence",
        "Measurements",
        "Photos",
        "Footage",
      ],
      ...rows,
    ]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `roadsafe-case-register-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  };

  const copyRegisterSummary = async () => {
    const summary = [
      "RoadSafe Accident Case Register",
      `All cases: ${cases.length}`,
      `Active: ${activeCount}`,
      `Completed: ${completedCount}`,
      `Evidence records: ${evidenceCount}`,
      `Visible after filters: ${filteredCases.length}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(summary);
    } catch (error) {
      console.warn("Unable to copy case register summary.", error);
    }
  };

  const syncLabel =
    caseSync.status === "loading"
      ? "Loading shared register"
      : caseSync.status === "syncing"
        ? "Synchronizing changes"
        : caseSync.status === "error"
          ? "Synchronization needs attention"
          : caseSync.status === "synced"
            ? "Shared register synchronized"
            : "Shared register waiting";

  return (
    <div className="roadsafe-cases-page mx-auto min-w-0 max-w-[1500px] space-y-3">
      <section className="roadsafe-cases-commandbar">
        <div className="roadsafe-cases-commandbar__title">
          <span className="roadsafe-cases-commandbar__eyebrow">
            Station register
          </span>
          <h1>Accident Cases</h1>
        </div>

        <div
          className="roadsafe-cases-commandbar__tools"
          aria-label="Case register tools"
        >
          <button
            type="button"
            className="roadsafe-cases-tool"
            onClick={() => void caseSync.refresh()}
            aria-label="Refresh case register"
            title="Refresh"
          >
            <RefreshCw size={17} />
          </button>

          <button
            type="button"
            className={
              view === "table"
                ? "roadsafe-cases-tool is-active"
                : "roadsafe-cases-tool"
            }
            onClick={() => setView("table")}
            aria-label="Table view"
            title="Table view"
          >
            <ListChecks size={17} />
          </button>

          <button
            type="button"
            className={
              view === "cards"
                ? "roadsafe-cases-tool is-active"
                : "roadsafe-cases-tool"
            }
            onClick={() => setView("cards")}
            aria-label="Card view"
            title="Card view"
          >
            <Boxes size={17} />
          </button>

          <Link
            to="/cases/new"
            className="roadsafe-cases-tool"
            aria-label="Create new case"
            title="New case"
          >
            <Plus size={18} />
          </Link>
        </div>

        <details className="roadsafe-cases-more">
          <summary>
            <SlidersHorizontal size={15} />
            <span>More Options</span>
          </summary>

          <div className="roadsafe-cases-more__menu">
            <div className="roadsafe-cases-more__status">
              <span>
                {caseSync.status === "error" ? (
                  <AlertTriangle size={15} />
                ) : caseSync.status === "loading" ||
                  caseSync.status === "syncing" ? (
                  <LoaderCircle className="animate-spin" size={15} />
                ) : caseSync.status === "synced" ? (
                  <CheckCircle2 size={15} />
                ) : (
                  <Cloud size={15} />
                )}
              </span>
              <span>{syncLabel}</span>
            </div>

            <button
              type="button"
              onClick={exportRegisterCsv}
            >
              <Download size={14} />
              Export register CSV
            </button>

            <button
              type="button"
              onClick={() => void copyRegisterSummary()}
            >
              <Copy size={14} />
              Copy register summary
            </button>

            <button
              type="button"
              onClick={() => {
                setQuery("");
                setStatus("Archived");
              }}
            >
              <Archive size={14} />
              View archived cases
            </button>

            <button
              type="button"
              disabled={
                !query &&
                status === "All"
              }
              onClick={() => {
                setQuery("");
                setStatus("All");
              }}
            >
              <Filter size={14} />
              Reset filters
            </button>

            <button
              type="button"
              disabled={
                !caseSync.canImportLocalCases ||
                caseSync.localOnlyCount <= 0 ||
                importing
              }
              onClick={() => void importLegacyCases()}
            >
              {importing ? (
                <LoaderCircle className="animate-spin" size={14} />
              ) : (
                <Upload size={14} />
              )}
              Import local cases
            </button>

            {caseSync.status === "error" && (
              <button
                type="button"
                onClick={caseSync.retryPending}
              >
                <RefreshCw size={14} />
                Retry synchronization
              </button>
            )}

            {caseSync.error && (
              <div className="roadsafe-cases-more__status is-error">
                <span>
                  <AlertTriangle size={14} />
                </span>
                <span>{caseSync.error}</span>
              </div>
            )}
          </div>
        </details>
      </section>

      <section
        className="roadsafe-cases-metrics"
        aria-label="Case register summary"
      >
        {[
          {
            label: "All Cases",
            value: cases.length,
            Icon: FolderKanban,
          },
          {
            label: "Active",
            value: activeCount,
            Icon: Activity,
          },
          {
            label: "Completed",
            value: completedCount,
            Icon: CheckCircle2,
          },
          {
            label: "Evidence Records",
            value: evidenceCount,
            Icon: ClipboardList,
          },
        ].map(({ label, value, Icon }) => (
          <article
            key={label}
            className="roadsafe-cases-metric"
          >
            <div className="roadsafe-cases-metric__copy">
              <span>{label}</span>
              <strong>{value}</strong>
            </div>

            <div
              className="roadsafe-cases-metric__icon"
              aria-hidden="true"
            >
              <Icon
                size={58}
                strokeWidth={1.55}
              />
            </div>
          </article>
        ))}
      </section>

      <section className="ui-panel min-w-0 overflow-hidden">
        <div className="ui-panel-header flex-wrap gap-3">
          <div className="min-w-0">
            <h2 className="ui-panel-title">Accident case register</h2>
            <p className="mt-1 truncate text-[9px] text-slate-600">
              Shared station cases with local reconstruction links.
            </p>
          </div>

        </div>

        <div className="grid min-w-0 gap-3 border-b border-[#494949] p-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <label className="relative min-w-0">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
              size={15}
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search case number, title, location or officer"
              className="ui-input w-full min-w-0 pl-9"
            />
          </label>

          <label className="relative min-w-0">
            <Filter
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
              size={14}
            />
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as "All" | AccidentCaseStatus)
              }
              className="ui-input w-full min-w-0 appearance-none pl-9"
            >
              <option value="All">All statuses</option>
              {ACCIDENT_CASE_STATUSES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>

        {filteredCases.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-slate-300">
              No cases match the current filters.
            </p>
            <p className="mt-2 text-[10px] text-slate-600">
              Create a new investigation or adjust the search.
            </p>
            <Link to="/cases/new" className="ui-button-primary mt-4">
              <Plus size={14} />
              Create case
            </Link>
          </div>
        ) : view === "table" ? (
          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[860px] table-fixed text-left text-[10px]">
              <colgroup>
                <col className="w-[20%]" />
                <col className="w-[19%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
                <col className="w-[13%]" />
                <col className="w-[22%]" />
              </colgroup>

              <thead className="bg-[#383838] text-slate-500">
                <tr>
                  {[
                    "Case",
                    "Location / officer",
                    "Date / time",
                    "Status",
                    "Scene records",
                    "Actions",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="px-3 py-3 font-semibold uppercase tracking-[0.08em]"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-[#202020]">
                {filteredCases.map((record) => {
                  const stats = AccidentCaseService.getStats(record);

                  return (
                    <tr
                      key={record.id}
                      className="transition-colors hover:bg-[#383838]"
                    >
                      <td className="min-w-0 px-3 py-3">
                        <Link
                          to={`/cases/${record.id}`}
                          className="block truncate font-semibold text-[#c4c4c4] hover:text-white"
                          title={record.caseNumber}
                        >
                          {record.caseNumber}
                        </Link>
                        <p
                          className="mt-1 truncate text-slate-400"
                          title={record.title}
                        >
                          {record.title}
                        </p>
                        <p className="mt-1 text-[8px] uppercase tracking-[0.08em] text-slate-700">
                          {record.cloudSyncState === "synced"
                            ? `Cloud v${record.cloudVersion ?? 1}`
                            : record.cloudSyncState === "error"
                              ? "Cloud error"
                              : "Pending sync"}
                        </p>
                      </td>

                      <td className="min-w-0 px-3 py-3">
                        <p
                          className="truncate text-slate-400"
                          title={record.location}
                        >
                          {record.location}
                        </p>
                        <p
                          className="mt-1 truncate text-slate-600"
                          title={
                            record.investigatingOfficer || "Not recorded"
                          }
                        >
                          {record.investigatingOfficer || "Not recorded"}
                        </p>
                      </td>

                      <td className="px-3 py-3 text-slate-500">
                        <p className="truncate">
                          {formatDate(record.accidentDate)}
                        </p>
                        <p className="mt-1 truncate">{record.accidentTime}</p>
                      </td>

                      <td className="min-w-0 px-3 py-3">
                        <CaseStatusBadge status={record.status} />
                      </td>

                      <td className="px-3 py-3">
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[9px] text-slate-500">
                          <span title="Participants">
                            P {stats.participantCount}
                          </span>
                          <span title="Evidence">
                            E {stats.evidenceCount}
                          </span>
                          <span title="Photos">
                            PH {stats.photoCount}
                          </span>
                          <span title="Footage">
                            V {stats.footageCount}
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex min-w-0 flex-nowrap items-center justify-end gap-1">
                          <Link
                            to={`/cases/${record.id}`}
                            className="ui-icon-button h-7 w-7 shrink-0"
                            title="Open case workspace"
                            aria-label={`Open ${record.caseNumber}`}
                          >
                            <ExternalLink size={13} strokeWidth={1.9} />
                          </Link>

                          <Link
                            to={`/cases/${record.id}/reconstruction`}
                            onClick={() =>
                              rememberReconstructionCase(record.id)
                            }
                            className="ui-icon-button h-7 w-7 shrink-0"
                            title="Open accident reconstruction"
                            aria-label={`Reconstruct ${record.caseNumber}`}
                          >
                            <Orbit size={14} strokeWidth={1.8} />
                          </Link>

                          <Link
                            to={`/cases/${record.id}/report`}
                            className="ui-icon-button h-7 w-7 shrink-0"
                            title="Open report"
                            aria-label={`Open report for ${record.caseNumber}`}
                          >
                            <FileText size={13} />
                          </Link>

                          <button
                            type="button"
                            className="ui-icon-button h-7 w-7 shrink-0"
                            title="Duplicate case"
                            aria-label={`Duplicate ${record.caseNumber}`}
                            onClick={() => {
                              const duplicate =
                                AccidentCaseService.duplicate(record.id);

                              if (duplicate) {
                                navigate(`/cases/${duplicate.id}/edit`);
                              }
                            }}
                          >
                            <Copy size={13} />
                          </button>

                          {canManageLifecycle &&
                            record.status !== "Archived" && (
                              <button
                                type="button"
                                className="ui-icon-button h-7 w-7 shrink-0"
                                title="Archive case"
                                aria-label={`Archive ${record.caseNumber}`}
                                onClick={() => archiveCase(record.id)}
                              >
                                <Archive size={13} />
                              </button>
                            )}

                          {isStationAdministrator && (
                            <button
                              type="button"
                              className="ui-icon-button h-7 w-7 shrink-0 text-red-400"
                              title="Delete case"
                              aria-label={`Delete ${record.caseNumber}`}
                              onClick={() =>
                                deleteCase(record.id, record.caseNumber)
                              }
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
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
                <article
                  key={record.id}
                  className="min-w-0 rounded-md border border-[#494949] bg-[#303030] p-4"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-bold text-[#c4c4c4]">
                        {record.caseNumber}
                      </p>
                      <h3 className="mt-1 truncate text-sm font-semibold text-slate-200">
                        {record.title}
                      </h3>
                    </div>
                    <CaseStatusBadge status={record.status} />
                  </div>

                  <p className="mt-3 truncate text-[10px] leading-5 text-slate-500">
                    {record.location}
                  </p>

                  <div className="mt-4 grid grid-cols-4 gap-2 border-y border-[#494949] py-3 text-center">
                    {[
                      ["P", stats.participantCount],
                      ["E", stats.evidenceCount],
                      ["M", stats.measurementCount],
                      ["V", stats.footageCount],
                    ].map(([label, value]) => (
                      <div key={label} className="min-w-0">
                        <p className="text-sm font-bold text-slate-200">
                          {value}
                        </p>
                        <p className="text-[8px] text-slate-600">
                          {label}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link
                      to={`/cases/${record.id}`}
                      className="ui-button min-w-0"
                    >
                      <ExternalLink size={13} />
                      Open
                    </Link>
                    <Link
                      to={`/cases/${record.id}/reconstruction`}
                      onClick={() =>
                        rememberReconstructionCase(record.id)
                      }
                      className="ui-button-primary min-w-0"
                    >
                      <Orbit size={14} />
                      Reconstruct
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
