import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Clock3,
  ExternalLink,
  MapPin,
  Orbit,
  Plus,
  Search,
  ShieldCheck,
} from "../components/icons/materialIcons";

import CaseStatusBadge from "../components/cases/CaseStatusBadge";
import { AccidentCaseService } from "../services/accidentCaseService";

const LAST_RECONSTRUCTION_CASE_KEY =
  "roadsafe-ar-last-reconstruction-case-id";

function readRememberedCaseId(): string {
  try {
    return localStorage.getItem(LAST_RECONSTRUCTION_CASE_KEY) ?? "";
  } catch (error) {
    console.warn("Unable to read the remembered reconstruction case.", error);
    return "";
  }
}

function rememberCase(caseId: string): void {
  try {
    localStorage.setItem(LAST_RECONSTRUCTION_CASE_KEY, caseId);
  } catch (error) {
    console.warn("Unable to remember the selected reconstruction case.", error);
  }
}

function clearRememberedCase(): void {
  try {
    localStorage.removeItem(LAST_RECONSTRUCTION_CASE_KEY);
  } catch (error) {
    console.warn("Unable to clear the remembered reconstruction case.", error);
  }
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Update time unavailable";
  }

  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AccidentReconstructionPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const rememberedCaseId = useMemo(() => readRememberedCaseId(), []);
  const cases = useMemo(
    () =>
      [...AccidentCaseService.getAll()].sort(
        (first, second) =>
          new Date(second.updatedAt).getTime() -
          new Date(first.updatedAt).getTime(),
      ),
    [],
  );

  const rememberedCase = useMemo(
    () =>
      rememberedCaseId
        ? cases.find((record) => record.id === rememberedCaseId) ?? null
        : null,
    [cases, rememberedCaseId],
  );

  useEffect(() => {
    if (!rememberedCaseId) return;

    if (!rememberedCase) {
      clearRememberedCase();
      return;
    }

    navigate(`/cases/${rememberedCase.id}/reconstruction`, {
      replace: true,
    });
  }, [navigate, rememberedCase, rememberedCaseId]);

  const filteredCases = useMemo(() => {
    const normalisedQuery = query.trim().toLowerCase();

    if (!normalisedQuery) {
      return cases;
    }

    return cases.filter(
      (record) =>
        record.caseNumber.toLowerCase().includes(normalisedQuery) ||
        record.title.toLowerCase().includes(normalisedQuery) ||
        record.location.toLowerCase().includes(normalisedQuery) ||
        record.investigatingOfficer
          .toLowerCase()
          .includes(normalisedQuery),
    );
  }, [cases, query]);

  const openCase = (caseId: string) => {
    rememberCase(caseId);
    navigate(`/cases/${caseId}/reconstruction`);
  };

  if (rememberedCase) {
    return (
      <div className="flex min-h-[calc(100vh-32px)] items-center justify-center p-4">
        <section className="ui-panel w-full max-w-lg overflow-hidden text-center">
          <div className="border-b border-[#18243f] p-6">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-md border border-[#315b91] bg-[#0b1b38] text-[#8ebcff]">
              <Orbit size={23} strokeWidth={1.8} />
            </div>
            <h1 className="mt-4 text-lg font-bold text-slate-100">
              Restoring your reconstruction
            </h1>
            <p className="mt-2 text-[10px] leading-5 text-slate-500">
              Opening {rememberedCase.caseNumber} · {rememberedCase.title}
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 p-4 text-[9px] font-semibold text-[#8ebcff]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#80ACFF]" />
            Loading the last selected scene
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-w-0 bg-[#030714] p-3 sm:p-4 lg:p-5">
      <div className="mx-auto min-w-0 max-w-[1400px] space-y-3">
        <header className="ui-panel flex min-w-0 flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-[#315b91] bg-[#0b1b38] text-[#8ebcff]">
              <Orbit size={21} strokeWidth={1.8} />
            </div>

            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#80ACFF]">
                Reconstruction workspace
              </p>
              <h1 className="mt-1 text-xl font-bold text-slate-100">
                Pick a scene to reconstruct
              </h1>
              <p className="mt-1 max-w-2xl text-[10px] leading-5 text-slate-500">
                Select an accident case to start or continue its linked
                reconstruction. RoadSafe AR will remember the last selected
                case and restore it when you return here.
              </p>
            </div>
          </div>

          <Link to="/cases/new" className="ui-button-primary">
            <Plus size={14} />
            New accident case
          </Link>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          {[
            {
              label: "Available cases",
              value: cases.length,
              detail: "Stored investigation records",
              icon: ExternalLink,
            },
            {
              label: "Existing reconstructions",
              value: cases.filter(
                (record) =>
                  AccidentCaseService.getStats(record).hasReconstruction,
              ).length,
              detail: "Ready to continue",
              icon: Orbit,
            },
            {
              label: "Workspace memory",
              value: "Ready",
              detail: "Last scene will be restored",
              icon: ShieldCheck,
            },
          ].map(({ label, value, detail, icon: Icon }) => (
            <article key={label} className="ui-panel min-w-0 p-4">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[9px] font-bold uppercase tracking-[0.1em] text-slate-600">
                    {label}
                  </p>
                  <p className="mt-2 text-xl font-bold text-slate-100">
                    {value}
                  </p>
                  <p className="mt-1 truncate text-[9px] text-slate-600">
                    {detail}
                  </p>
                </div>

                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[#284a7b] bg-[#112241] text-[#8ebcff]">
                  <Icon size={15} strokeWidth={1.8} />
                </span>
              </div>
            </article>
          ))}
        </section>

        <section className="ui-panel min-w-0 overflow-hidden">
          <div className="ui-panel-header flex-wrap gap-3">
            <div className="min-w-0">
              <h2 className="ui-panel-title">Investigation scenes</h2>
              <p className="mt-1 text-[9px] text-slate-600">
                Choose the case whose accident scene you need to reconstruct.
              </p>
            </div>

            <label className="relative min-w-[240px] flex-1 sm:max-w-md">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search cases or locations"
                className="ui-input w-full min-w-0 pl-9"
              />
            </label>
          </div>

          {cases.length === 0 ? (
            <div className="p-5">
              <div className="rounded-md border border-dashed border-[#29446f] bg-[#070d1a] px-5 py-12 text-center">
                <div className="mx-auto grid h-11 w-11 place-items-center rounded-md border border-[#315b91] bg-[#0b1b38] text-[#8ebcff]">
                  <Orbit size={20} />
                </div>
                <h2 className="mt-4 text-sm font-bold text-slate-300">
                  No accident cases are available
                </h2>
                <p className="mx-auto mt-2 max-w-md text-[10px] leading-5 text-slate-600">
                  Create an accident case first. Its reconstruction scene will
                  then become available here.
                </p>
                <Link to="/cases/new" className="ui-button-primary mt-4">
                  <Plus size={14} />
                  Create first case
                </Link>
              </div>
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-semibold text-slate-300">
                No scenes match the current search.
              </p>
              <p className="mt-2 text-[10px] text-slate-600">
                Search using another case number, title, location or officer.
              </p>
            </div>
          ) : (
            <div className="grid min-w-0 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredCases.map((record) => {
                const stats = AccidentCaseService.getStats(record);

                return (
                  <article
                    key={record.id}
                    className="min-w-0 overflow-hidden rounded-md border border-[#1a2946] bg-[#070d1a] transition-colors hover:border-[#29446f]"
                  >
                    <div className="min-w-0 border-b border-[#18243f] p-4">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[9px] font-bold uppercase tracking-[0.1em] text-[#80ACFF]">
                            {record.caseNumber}
                          </p>
                          <h3
                            className="mt-1 truncate text-sm font-bold text-slate-200"
                            title={record.title}
                          >
                            {record.title}
                          </h3>
                        </div>

                        <CaseStatusBadge status={record.status} />
                      </div>

                      <div className="mt-3 space-y-2">
                        <p className="flex min-w-0 items-center gap-2 text-[9px] text-slate-500">
                          <MapPin size={11} className="shrink-0" />
                          <span className="truncate" title={record.location}>
                            {record.location}
                          </span>
                        </p>

                        <p className="flex min-w-0 items-center gap-2 text-[9px] text-slate-600">
                          <Clock3 size={11} className="shrink-0" />
                          <span className="truncate">
                            Updated {formatUpdatedAt(record.updatedAt)}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-3">
                      {[
                        ["Participants", stats.participantCount],
                        ["Evidence", stats.evidenceCount],
                        ["Footage", stats.footageCount],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="min-w-0 rounded-md border border-[#182849] bg-[#050b17] px-2 py-2 text-center"
                        >
                          <p className="font-mono text-[11px] font-bold text-slate-300">
                            {value}
                          </p>
                          <p className="mt-1 truncate text-[7px] uppercase tracking-[0.06em] text-slate-600">
                            {label}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="flex min-w-0 items-center justify-between gap-3 border-t border-[#18243f] px-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-[8px] font-bold uppercase tracking-[0.08em] text-slate-600">
                          Reconstruction
                        </p>
                        <p
                          className={`mt-1 truncate text-[9px] font-semibold ${
                            stats.hasReconstruction
                              ? "text-[#8ed6ca]"
                              : "text-[#d9bd78]"
                          }`}
                        >
                          {stats.hasReconstruction
                            ? stats.reconstructionStatus
                            : "Not created"}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => openCase(record.id)}
                        className="ui-button-primary shrink-0"
                      >
                        {stats.hasReconstruction ? "Continue" : "Start"}
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
