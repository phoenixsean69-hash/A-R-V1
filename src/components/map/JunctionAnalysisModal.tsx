import { useEffect, useMemo, type ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  ClipboardList,
  CloudSun,
  Crosshair,
  Lightbulb,
  MapPin,
  ShieldAlert,
  X,
} from "../icons/materialIcons";

import { JunctionAnalysisService } from "../../services/junctionAnalysisService";
import type {
  AnalysisBreakdownItem,
  RecommendationPriority,
} from "../../types/junctionAnalysis";

interface JunctionAnalysisModalProps {
  junctionId: string;
  onClose: () => void;
}

interface MetricCardProps {
  label: string;
  value: ReactNode;
  description?: string;
  tone?: "default" | "danger" | "warning";
}

function MetricCard({
  label,
  value,
  description,
  tone = "default",
}: MetricCardProps) {
  const toneClasses = {
    default: "border-[#494949] bg-[#303030]",
    danger: "border-[#713646] bg-[#21101a]",
    warning: "border-[#6d5523] bg-[#303030]",
  } as const;

  return (
    <div className={`min-w-0 rounded-md border p-3 ${toneClasses[tone]}`}>
      <p className="truncate text-[8px] font-bold uppercase tracking-[0.1em] text-slate-600">
        {label}
      </p>
      <div className="mt-2 break-words text-lg font-bold leading-tight text-slate-100">
        {value}
      </div>
      {description && (
        <p className="mt-1 text-[8px] leading-4 text-slate-600">
          {description}
        </p>
      )}
    </div>
  );
}

function getRiskClasses(riskLevel: "Low" | "Medium" | "High"): string {
  switch (riskLevel) {
    case "High":
      return "border-[#713646] bg-[#321722] text-[#e28b9d]";
    case "Medium":
      return "border-[#6d5523] bg-[#241d10] text-[#d9bd78]";
    case "Low":
      return "border-[#494949] bg-[#303030] text-[#c4c4c4]";
  }
}

function getPriorityClasses(priority: RecommendationPriority): string {
  switch (priority) {
    case "High":
      return "border-[#713646] bg-[#321722] text-[#e28b9d]";
    case "Medium":
      return "border-[#6d5523] bg-[#241d10] text-[#d9bd78]";
    case "Low":
      return "border-[#494949] bg-[#303030] text-[#c4c4c4]";
  }
}

function getSeverityClasses(severity: string): string {
  switch (severity) {
    case "Fatal":
      return "border-[#713646] bg-[#321722] text-[#e28b9d]";
    case "Serious":
      return "border-[#6d5523] bg-[#241d10] text-[#d9bd78]";
    default:
      return "border-[#494949] bg-[#303030] text-[#c4c4c4]";
  }
}

function formatDate(dateValue: string): string {
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateValue;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

interface BreakdownChartProps {
  title: string;
  items: AnalysisBreakdownItem[];
  emptyMessage?: string;
  icon: ReactNode;
}

function BreakdownChart({
  title,
  items,
  emptyMessage = "No records available.",
  icon,
}: BreakdownChartProps) {
  const nonEmptyItems = items.filter((item) => item.count > 0);

  return (
    <section className="min-w-0 rounded-md border border-[#494949] bg-[#303030] p-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="text-[#c4c4c4]" aria-hidden="true">
          {icon}
        </span>
        <h3 className="truncate text-[10px] font-bold text-slate-300">
          {title}
        </h3>
      </div>

      {nonEmptyItems.length === 0 ? (
        <p className="mt-4 text-[9px] text-slate-600">{emptyMessage}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {nonEmptyItems.map((item) => (
            <div key={item.label} className="min-w-0">
              <div className="mb-1.5 flex min-w-0 items-center justify-between gap-3 text-[8px]">
                <span className="truncate font-semibold text-slate-400">
                  {item.label}
                </span>
                <span className="shrink-0 font-mono text-slate-600">
                  {item.count} · {item.percentage}%
                </span>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full border border-[#494949] bg-[#303030]">
                <div
                  className="h-full rounded-full bg-[#80ACFF]"
                  style={{
                    width: `${Math.max(item.percentage, 3)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function JunctionAnalysisModal({
  junctionId,
  onClose,
}: JunctionAnalysisModalProps) {
  const analysis = useMemo(
    () => JunctionAnalysisService.analyse(junctionId),
    [junctionId],
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  if (!analysis) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4">
        <div className="ui-panel w-full max-w-md overflow-hidden text-center">
          <div className="border-b border-[#494949] p-5">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-md border border-[#713646] bg-[#321722] text-[#e28b9d]">
              <AlertTriangle size={18} strokeWidth={1.8} />
            </div>
            <h2 className="mt-3 text-sm font-bold text-slate-100">
              Junction not found
            </h2>
            <p className="mt-1 text-[9px] leading-4 text-slate-600">
              The selected junction record is unavailable.
            </p>
          </div>

          <div className="p-4">
            <button type="button" onClick={onClose} className="ui-button w-full">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { junction, summary, risk } = analysis;
  const maximumMonthlyAccidents = Math.max(
    ...analysis.monthlyTrend.map((item) => item.accidents),
    1,
  );

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-2.5 sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[94vh] min-w-0 w-full max-w-6xl flex-col overflow-hidden rounded-md border border-[#494949] bg-[#303030] shadow-[0_24px_70px_rgba(0,0,0,.5)]">
        <header className="flex min-w-0 items-start justify-between gap-4 border-b border-[#494949] bg-[#303030] px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-[#494949] bg-[#303030] text-[#c4c4c4]">
              <Crosshair size={18} strokeWidth={1.8} />
            </div>

            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="truncate text-base font-bold text-slate-100 sm:text-lg">
                  {junction.name}
                </h2>
                <span
                  className={`shrink-0 rounded border px-2 py-1 text-[8px] font-bold uppercase tracking-[0.08em] ${getRiskClasses(
                    risk.riskLevel,
                  )}`}
                >
                  {risk.riskLevel} risk
                </span>
              </div>

              <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[9px] text-slate-500">
                <MapPin size={10} className="shrink-0" />
                <span className="truncate">
                  {junction.city} · {junction.roadType}
                </span>
              </p>

              <p className="mt-2 max-w-3xl text-[9px] leading-4 text-slate-500">
                {junction.description}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ui-icon-button shrink-0"
            aria-label="Close junction analysis"
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        </header>

        <div className="min-w-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5 [scrollbar-color:#223656_#070d1a] [scrollbar-width:thin]">
          <section className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard
              label="Risk score"
              value={risk.riskScore}
              description="Rule-based assessment"
              tone={risk.riskLevel === "High" ? "danger" : "warning"}
            />
            <MetricCard
              label="Recorded accidents"
              value={summary.totalAccidents}
            />
            <MetricCard
              label="Fatalities"
              value={summary.fatalities}
              tone={summary.fatalities > 0 ? "danger" : "default"}
            />
            <MetricCard label="Injuries" value={summary.injuries} />
            <MetricCard
              label="Common cause"
              value={
                <span className="text-[12px] leading-4">
                  {summary.commonCause}
                </span>
              }
            />
          </section>

          <section className="mt-3 grid min-w-0 gap-2 sm:grid-cols-3">
            {analysis.severityBreakdown.map((item) => (
              <div
                key={item.label}
                className="min-w-0 rounded-md border border-[#494949] bg-[#303030] p-3"
              >
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <span
                    className={`truncate rounded border px-2 py-1 text-[7px] font-bold uppercase tracking-[0.08em] ${getSeverityClasses(
                      item.label,
                    )}`}
                  >
                    {item.label}
                  </span>
                  <span className="shrink-0 font-mono text-[8px] text-slate-600">
                    {item.percentage}%
                  </span>
                </div>

                <p className="mt-3 font-mono text-xl font-bold text-slate-100">
                  {item.count}
                </p>
                <p className="mt-1 text-[8px] text-slate-600">
                  Recorded accidents
                </p>
              </div>
            ))}
          </section>

          <section className="mt-3 min-w-0 rounded-md border border-[#494949] bg-[#303030] p-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <BarChart3
                size={15}
                strokeWidth={1.8}
                className="shrink-0 text-[#c4c4c4]"
              />
              <div className="min-w-0">
                <h3 className="truncate text-[10px] font-bold text-slate-300">
                  Accident trend by month
                </h3>
                <p className="mt-1 truncate text-[8px] text-slate-600">
                  Frequency, fatalities and injuries in the available records
                </p>
              </div>
            </div>

            {analysis.monthlyTrend.length === 0 ? (
              <p className="mt-4 text-[9px] text-slate-600">
                No monthly accident data is available.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {analysis.monthlyTrend.map((month) => (
                  <div
                    key={month.monthKey}
                    className="grid min-w-0 items-center gap-2 md:grid-cols-[90px_minmax(0,1fr)_180px]"
                  >
                    <span className="truncate text-[8px] font-semibold text-slate-400">
                      {month.monthLabel}
                    </span>

                    <div className="h-5 min-w-0 overflow-hidden rounded-md border border-[#494949] bg-[#303030]">
                      <div
                        className="flex h-full items-center rounded-sm bg-[#303030] px-2 font-mono text-[7px] font-bold text-white"
                        style={{
                          width: `${Math.max(
                            (month.accidents / maximumMonthlyAccidents) * 100,
                            8,
                          )}%`,
                        }}
                      >
                        {month.accidents}
                      </div>
                    </div>

                    <div className="flex min-w-0 gap-3 text-[7px] text-slate-600">
                      <span className="truncate">
                        Fatalities: {month.fatalities}
                      </span>
                      <span className="truncate">
                        Injuries: {month.injuries}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2">
            <BreakdownChart
              title="Common accident causes"
              items={analysis.causeBreakdown}
              icon={<ClipboardList size={15} strokeWidth={1.8} />}
            />
            <BreakdownChart
              title="Weather conditions"
              items={analysis.weatherBreakdown}
              icon={<CloudSun size={15} strokeWidth={1.8} />}
            />
          </div>

          <section className="mt-3 min-w-0 rounded-md border border-[#494949] bg-[#303030] p-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <CalendarClock
                size={15}
                strokeWidth={1.8}
                className="shrink-0 text-[#c4c4c4]"
              />
              <h3 className="truncate text-[10px] font-bold text-slate-300">
                High-risk times of day
              </h3>
            </div>

            <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {analysis.timeOfDayBreakdown.map((period) => (
                <div
                  key={period.label}
                  className="min-w-0 rounded-md border border-[#494949] bg-[#303030] p-3"
                >
                  <p className="truncate text-[9px] font-bold text-slate-300">
                    {period.label}
                  </p>
                  <p className="mt-1 truncate text-[7px] text-slate-600">
                    {period.timeRange}
                  </p>
                  <p className="mt-3 font-mono text-lg font-bold text-[#c4c4c4]">
                    {period.count}
                  </p>
                  <p className="mt-0.5 text-[7px] text-slate-600">
                    {period.percentage}% of records
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-3 min-w-0">
            <div className="flex min-w-0 items-start gap-2.5">
              <Lightbulb
                size={16}
                strokeWidth={1.8}
                className="mt-0.5 shrink-0 text-[#d9bd78]"
              />
              <div className="min-w-0">
                <h3 className="text-[11px] font-bold text-slate-300">
                  Recommended safety interventions
                </h3>
                <p className="mt-1 text-[8px] leading-4 text-slate-600">
                  Recommendations currently use deterministic rule-based
                  analysis. Predictive AI advice remains a later project phase.
                </p>
              </div>
            </div>

            <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2">
              {analysis.recommendations.map((recommendation) => (
                <article
                  key={recommendation.id}
                  className="min-w-0 rounded-md border border-[#494949] bg-[#303030] p-4"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <h4 className="min-w-0 text-[10px] font-bold leading-4 text-slate-300">
                      {recommendation.title}
                    </h4>
                    <span
                      className={`shrink-0 rounded border px-2 py-1 text-[7px] font-bold uppercase tracking-[0.08em] ${getPriorityClasses(
                        recommendation.priority,
                      )}`}
                    >
                      {recommendation.priority}
                    </span>
                  </div>

                  <p className="mt-2 text-[8px] leading-4 text-slate-500">
                    {recommendation.reason}
                  </p>

                  <div className="mt-3 space-y-2">
                    {recommendation.actions.map((action) => (
                      <div
                        key={action}
                        className="flex min-w-0 items-start gap-2 text-[8px] leading-4 text-slate-400"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#80ACFF]" />
                        <span className="min-w-0 break-words">{action}</span>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-3 min-w-0 overflow-hidden rounded-md border border-[#494949] bg-[#303030]">
            <div className="flex min-w-0 items-center gap-2.5 border-b border-[#494949] px-4 py-3">
              <ShieldAlert
                size={15}
                strokeWidth={1.8}
                className="shrink-0 text-[#d9bd78]"
              />
              <div className="min-w-0">
                <h3 className="truncate text-[10px] font-bold text-slate-300">
                  Recent accident records
                </h3>
                <p className="mt-1 truncate text-[8px] text-slate-600">
                  Latest incidents linked to this junction
                </p>
              </div>
            </div>

            {analysis.recentAccidents.length === 0 ? (
              <p className="p-4 text-[9px] text-slate-600">
                No accidents have been recorded for this junction.
              </p>
            ) : (
              <div className="max-w-full overflow-x-auto">
                <table className="min-w-[760px] w-full text-left text-[8px]">
                  <thead className="border-b border-[#494949] bg-[#303030]">
                    <tr className="text-slate-600">
                      {[
                        "Date",
                        "Severity",
                        "Cause",
                        "Weather",
                        "Fatalities",
                        "Injuries",
                      ].map((heading) => (
                        <th
                          key={heading}
                          className="whitespace-nowrap px-4 py-2.5 font-bold uppercase tracking-[0.08em]"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#111e36]">
                    {analysis.recentAccidents.map((accident) => (
                      <tr
                        key={accident.id}
                        className="transition-colors hover:bg-[#303030]"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                          {formatDate(accident.date)}
                          <span className="ml-2 text-slate-600">
                            {accident.time}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded border px-2 py-1 text-[7px] font-bold ${getSeverityClasses(
                              accident.severity,
                            )}`}
                          >
                            {accident.severity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {accident.cause}
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {accident.weather}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-300">
                          {accident.fatalities}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-300">
                          {accident.injuries}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
