import { useMemo, useState } from "react";

import { AccidentService } from "../../services/accidentService";
import { JunctionService } from "../../services/junctionService";

import type { Accident } from "../../types/accident";

interface JunctionAnalysisModalProps {
  junctionId: string;
  onClose: () => void;
}

interface DistributionRow {
  label: string;
  count: number;
  sharePct: number;
}

interface JunctionAnalysisModel {
  score: number;
  riskLevel: "Low" | "Medium" | "High";
  totalAccidents: number;
  fatalities: number;
  injuries: number;
  casualties: number;
  totalVehicles: number;
  averageVehiclesPerCrash: number;
  severeCount: number;
  severeSharePct: number;
  fatalCount: number;
  seriousCount: number;
  minorCount: number;
  averageCasualtiesPerCrash: number;
  topCause: string;
  topCauseSharePct: number;
  topWeather: string;
  topWeatherSharePct: number;
  peakTimeBand: string;
  peakTimeBandSharePct: number;
  latestRecordLabel: string;
  months: DistributionRow[];
  severities: DistributionRow[];
  causes: DistributionRow[];
  weather: DistributionRow[];
  timeBands: DistributionRow[];
  recentRecords: Accident[];
  findings: string[];
}

const RISK_WEIGHTS = {
  fatality: 10,
  seriousAccident: 5,
  minorAccident: 2,
  injury: 2,
  accident: 1,
} as const;

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function pct(value: number, total: number): number {
  return total > 0 ? (value / total) * 100 : 0;
}

function formatDate(dateValue: string): string {
  const parsed = new Date(dateValue);

  if (Number.isNaN(parsed.getTime())) {
    return dateValue;
  }

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function timeBand(time: string): string {
  const hour = Number(time.split(":")[0]);

  if (!Number.isFinite(hour)) return "Unknown";

  if (hour < 6) return "00:00–05:59";
  if (hour < 10) return "06:00–09:59";
  if (hour < 16) return "10:00–15:59";
  if (hour < 20) return "16:00–19:59";
  return "20:00–23:59";
}

function severityOrder(label: string): number {
  if (label === "Fatal") return 0;
  if (label === "Serious") return 1;
  if (label === "Minor") return 2;
  return 3;
}

function buildDistribution(
  labels: string[],
  options?: {
    sort?: "count" | "severity" | "month";
  },
): DistributionRow[] {
  const counts = new Map<string, number>();

  labels.forEach((value) => {
    const label = value.trim() || "Unknown";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  const rows = Array.from(counts.entries()).map(([label, count]) => ({
    label,
    count,
    sharePct: round(pct(count, labels.length)),
  }));

  if (options?.sort === "severity") {
    return rows.sort(
      (left, right) =>
        severityOrder(left.label) - severityOrder(right.label),
    );
  }

  if (options?.sort === "month") {
    const order = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    return rows.sort(
      (left, right) =>
        order.indexOf(left.label) - order.indexOf(right.label),
    );
  }

  return rows.sort(
    (left, right) =>
      right.count - left.count || left.label.localeCompare(right.label),
  );
}

function riskLevel(score: number): "Low" | "Medium" | "High" {
  if (score >= 25) return "High";
  if (score >= 10) return "Medium";
  return "Low";
}

function riskClasses(level: "Low" | "Medium" | "High"): string {
  if (level === "High") {
    return "border-[#713646] bg-[#321722] text-[#f09aae]";
  }

  if (level === "Medium") {
    return "border-[#6d5523] bg-[#241d10] text-[#dfc27f]";
  }

  return "border-[#415244] bg-[#132019] text-[#9ed4ae]";
}

function buildFindings(model: JunctionAnalysisModel): string[] {
  if (model.totalAccidents === 0) {
    return [
      "No recorded accidents are attached to this junction in the current dataset.",
    ];
  }

  const findings = [
    `${model.topCause} is the most common recorded cause, contributing ${model.topCauseSharePct}% of accidents at this junction.`,
    `${model.peakTimeBand} is the most active time band in the available records, representing ${model.peakTimeBandSharePct}% of accidents.`,
    `${model.severeSharePct}% of the recorded accidents are serious or fatal outcomes.`,
  ];

  if (model.fatalities > 0) {
    findings.push(
      `${model.fatalities} fatality/fatalities are recorded across the available accident history.`,
    );
  } else {
    findings.push(
      "No fatalities are recorded in the current dataset for this junction, but injuries and serious crashes remain material.",
    );
  }

  findings.push(
    `Average casualty intensity is ${model.averageCasualtiesPerCrash.toFixed(2)} casualties per accident.`,
  );

  return findings.slice(0, 5);
}

function sortRecent(left: Accident, right: Accident): number {
  const leftValue = new Date(`${left.date}T${left.time || "00:00"}`).getTime();
  const rightValue = new Date(`${right.date}T${right.time || "00:00"}`).getTime();

  if (Number.isNaN(leftValue) || Number.isNaN(rightValue)) {
    return right.date.localeCompare(left.date) || right.time.localeCompare(left.time);
  }

  return rightValue - leftValue;
}

function buildModel(records: Accident[]): JunctionAnalysisModel {
  const sortedRecords = [...records].sort(sortRecent);
  const totalAccidents = sortedRecords.length;
  const fatalCount = sortedRecords.filter((item) => item.severity === "Fatal").length;
  const seriousCount = sortedRecords.filter((item) => item.severity === "Serious").length;
  const minorCount = sortedRecords.filter((item) => item.severity === "Minor").length;
  const severeCount = fatalCount + seriousCount;
  const fatalities = sortedRecords.reduce((sum, item) => sum + item.fatalities, 0);
  const injuries = sortedRecords.reduce((sum, item) => sum + item.injuries, 0);
  const casualties = fatalities + injuries;
  const totalVehicles = sortedRecords.reduce(
    (sum, item) => sum + item.vehiclesInvolved,
    0,
  );

  const score =
    fatalities * RISK_WEIGHTS.fatality +
    seriousCount * RISK_WEIGHTS.seriousAccident +
    minorCount * RISK_WEIGHTS.minorAccident +
    injuries * RISK_WEIGHTS.injury +
    totalAccidents * RISK_WEIGHTS.accident;

  const severityRows = buildDistribution(
    sortedRecords.map((item) => item.severity),
    { sort: "severity" },
  );

  const causeRows = buildDistribution(
    sortedRecords.map((item) => item.cause || "Unknown"),
  );

  const weatherRows = buildDistribution(
    sortedRecords.map((item) => item.weather || "Unknown"),
  );

  const timeRows = buildDistribution(
    sortedRecords.map((item) => timeBand(item.time)),
  );

  const monthRows = buildDistribution(
    sortedRecords.map((item) => {
      const parsed = new Date(item.date);
      if (Number.isNaN(parsed.getTime())) return "Unknown";
      return parsed.toLocaleDateString(undefined, { month: "short" });
    }),
    { sort: "month" },
  );

  const latest = sortedRecords[0];

  const model: JunctionAnalysisModel = {
    score,
    riskLevel: riskLevel(score),
    totalAccidents,
    fatalities,
    injuries,
    casualties,
    totalVehicles,
    averageVehiclesPerCrash: round(totalVehicles / Math.max(1, totalAccidents), 2),
    severeCount,
    severeSharePct: round(pct(severeCount, totalAccidents)),
    fatalCount,
    seriousCount,
    minorCount,
    averageCasualtiesPerCrash: round(casualties / Math.max(1, totalAccidents), 2),
    topCause: causeRows[0]?.label ?? "No data",
    topCauseSharePct: causeRows[0]?.sharePct ?? 0,
    topWeather: weatherRows[0]?.label ?? "No data",
    topWeatherSharePct: weatherRows[0]?.sharePct ?? 0,
    peakTimeBand: timeRows[0]?.label ?? "No data",
    peakTimeBandSharePct: timeRows[0]?.sharePct ?? 0,
    latestRecordLabel: latest
      ? `${formatDate(latest.date)}${latest.time ? ` · ${latest.time}` : ""}`
      : "No record",
    months: monthRows,
    severities: severityRows,
    causes: causeRows,
    weather: weatherRows,
    timeBands: timeRows,
    recentRecords: sortedRecords.slice(0, 6),
    findings: [],
  };

  model.findings = buildFindings(model);

  return model;
}

export default function JunctionAnalysisModal({
  junctionId,
  onClose,
}: JunctionAnalysisModalProps) {
  const [expanded, setExpanded] = useState(false);

  const junction = useMemo(
    () => JunctionService.getById(junctionId),
    [junctionId],
  );

  const records = useMemo(
    () =>
      AccidentService.getAll().filter(
        (accident) => accident.junctionId === junctionId,
      ),
    [junctionId],
  );

  const model = useMemo(
    () => buildModel(records),
    [records],
  );

  if (!junction) {
    return (
      <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-md rounded-md border border-[#494949] bg-[#202020] p-5 shadow-[0_30px_80px_rgba(0,0,0,.6)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#e8872d]">
                Junction analysis
              </p>
              <h3 className="mt-1 text-base font-bold text-slate-100">
                Junction not found
              </h3>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="ui-button"
            >
              Close
            </button>
          </div>

          <p className="mt-4 text-sm text-slate-400">
            RoadSafe could not load the requested junction record.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {!expanded && (
        <div className="absolute inset-0 z-[75] pointer-events-none">
          <aside className="pointer-events-auto absolute bottom-3 right-3 top-3 flex w-[min(420px,calc(100%-24px))] flex-col overflow-hidden rounded-md border border-[#494949] bg-[#202020]/[0.98] shadow-[0_26px_70px_rgba(0,0,0,.58)] backdrop-blur-sm">
            <header className="border-b border-[#494949] bg-[#303030] px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#e8872d]">
                    Junction brief
                  </p>
                  <h3 className="mt-1 truncate text-lg font-bold text-slate-100">
                    {junction.name}
                  </h3>
                  <p className="mt-1 text-[9px] text-slate-500">
                    {junction.city} · {junction.roadType}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="rounded border border-[#494949] bg-[#292929] px-2 py-1 text-[8px] font-semibold text-slate-300 transition hover:bg-[#333333]"
                >
                  Close
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded border px-2 py-1 text-[8px] font-bold uppercase tracking-[0.08em] ${riskClasses(
                    model.riskLevel,
                  )}`}
                >
                  {model.riskLevel} risk
                </span>

                <span className="rounded border border-[#494949] bg-[#292929] px-2 py-1 text-[8px] font-semibold text-slate-300">
                  Score: {model.score}
                </span>

                <span className="rounded border border-[#494949] bg-[#292929] px-2 py-1 text-[8px] text-slate-400">
                  {junction.riskLevel} register level
                </span>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 [scrollbar-color:#555555_#202020] [scrollbar-width:thin]">
              <section className="grid gap-2 sm:grid-cols-2">
                <MetricCard
                  label="Recorded accidents"
                  value={model.totalAccidents}
                  detail={`${model.severeSharePct}% serious/fatal`}
                />
                <MetricCard
                  label="Casualties"
                  value={model.casualties}
                  detail={`${model.averageCasualtiesPerCrash.toFixed(2)} per accident`}
                />
                <MetricCard
                  label="Fatalities"
                  value={model.fatalities}
                  detail={`${model.fatalCount} fatal crash(es)`}
                />
                <MetricCard
                  label="Injuries"
                  value={model.injuries}
                  detail={`${model.seriousCount} serious crash(es)`}
                />
              </section>

              <section className="mt-3 rounded-md border border-[#494949] bg-[#292929] p-3">
                <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-[#e8872d]">
                  Quick situation view
                </p>

                <dl className="mt-3 space-y-2">
                  <DataRow
                    label="Common cause"
                    value={`${model.topCause} · ${model.topCauseSharePct}%`}
                  />
                  <DataRow
                    label="Peak time band"
                    value={`${model.peakTimeBand} · ${model.peakTimeBandSharePct}%`}
                  />
                  <DataRow
                    label="Latest record"
                    value={model.latestRecordLabel}
                  />
                  <DataRow
                    label="Weather pattern"
                    value={`${model.topWeather} · ${model.topWeatherSharePct}%`}
                  />
                </dl>
              </section>

              <section className="mt-3 rounded-md border border-[#494949] bg-[#292929] p-3">
                <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-[#e8872d]">
                  Key findings
                </p>

                <ul className="mt-2 space-y-2 text-[8px] leading-4 text-slate-400">
                  {model.findings.map((finding) => (
                    <li
                      key={finding}
                      className="rounded border border-[#414141] bg-[#303030] px-2.5 py-2"
                    >
                      {finding}
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <footer className="grid grid-cols-2 gap-2 border-t border-[#494949] bg-[#202020] p-4">
              <button
                type="button"
                onClick={onClose}
                className="ui-button"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="ui-button-primary"
              >
                View full analysis
              </button>
            </footer>
          </aside>
        </div>
      )}

      {expanded && (
        <div className="absolute inset-0 z-[85] flex min-w-0 flex-col bg-black/80 p-2 sm:p-4">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-[#494949] bg-[#202020] shadow-[0_30px_90px_rgba(0,0,0,.65)]">
            <header className="border-b border-[#494949] bg-[#303030] px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#e8872d]">
                    Junction analysis
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-xl font-bold text-slate-100">
                      {junction.name}
                    </h3>

                    <span
                      className={`rounded border px-2 py-1 text-[8px] font-bold uppercase tracking-[0.08em] ${riskClasses(
                        model.riskLevel,
                      )}`}
                    >
                      {model.riskLevel} risk
                    </span>

                    <span className="rounded border border-[#494949] bg-[#292929] px-2 py-1 text-[8px] font-semibold text-slate-300">
                      Score {model.score}
                    </span>
                  </div>

                  <p className="mt-2 text-[9px] text-slate-500">
                    {junction.city} · {junction.roadType}
                    {junction.description ? ` · ${junction.description}` : ""}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setExpanded(false)}
                    className="ui-button"
                  >
                    Back
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="ui-button-primary"
                  >
                    Close
                  </button>
                </div>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 [scrollbar-color:#555555_#202020] [scrollbar-width:thin]">
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <MetricCard
                  label="Recorded accidents"
                  value={model.totalAccidents}
                  detail={`${model.minorCount} minor · ${model.seriousCount} serious · ${model.fatalCount} fatal`}
                />
                <MetricCard
                  label="Weighted risk score"
                  value={model.score}
                  detail={`${model.riskLevel} priority`}
                />
                <MetricCard
                  label="Casualties"
                  value={model.casualties}
                  detail={`${model.averageCasualtiesPerCrash.toFixed(2)} per accident`}
                />
                <MetricCard
                  label="Vehicles involved"
                  value={model.totalVehicles}
                  detail={`${model.averageVehiclesPerCrash.toFixed(2)} avg per accident`}
                />
                <MetricCard
                  label="Latest record"
                  value={model.latestRecordLabel}
                  detail="Most recent crash in dataset"
                />
              </section>

              <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
                <section className="space-y-4">
                  <Panel title="Severity composition" subtitle="Outcome mix across recorded accidents">
                    <div className="grid gap-2 sm:grid-cols-3">
                      {model.severities.map((row) => (
                        <SeverityCard
                          key={row.label}
                          label={row.label}
                          count={row.count}
                          sharePct={row.sharePct}
                        />
                      ))}
                    </div>
                  </Panel>

                  <Panel title="Time pattern" subtitle="When recorded accidents tend to happen">
                    <div className="space-y-2">
                      {model.timeBands.length === 0 ? (
                        <EmptyState text="No time-band records available." />
                      ) : (
                        model.timeBands.map((row) => (
                          <DistributionBar
                            key={row.label}
                            label={row.label}
                            count={row.count}
                            sharePct={row.sharePct}
                          />
                        ))
                      )}
                    </div>
                  </Panel>

                  <Panel title="Recorded accidents by month" subtitle="Simple temporal spread from the available records">
                    <div className="space-y-2">
                      {model.months.length === 0 ? (
                        <EmptyState text="No month-level records available." />
                      ) : (
                        model.months.map((row) => (
                          <DistributionBar
                            key={row.label}
                            label={row.label}
                            count={row.count}
                            sharePct={row.sharePct}
                          />
                        ))
                      )}
                    </div>
                  </Panel>

                  <Panel title="Recent accident records" subtitle="Most recent entries attached to this junction">
                    {model.recentRecords.length === 0 ? (
                      <EmptyState text="No accident records available." />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[700px] text-left text-[8px]">
                          <thead className="bg-[#303030] uppercase tracking-[0.06em] text-slate-600">
                            <tr>
                              <th className="px-3 py-2">Date</th>
                              <th className="px-3 py-2">Time</th>
                              <th className="px-3 py-2">Severity</th>
                              <th className="px-3 py-2">Fatalities</th>
                              <th className="px-3 py-2">Injuries</th>
                              <th className="px-3 py-2">Cause</th>
                              <th className="px-3 py-2">Weather</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#202020]">
                            {model.recentRecords.map((record) => (
                              <tr key={record.id}>
                                <td className="px-3 py-2 text-slate-300">
                                  {formatDate(record.date)}
                                </td>
                                <td className="px-3 py-2 text-slate-400">
                                  {record.time || "—"}
                                </td>
                                <td className="px-3 py-2">
                                  <span
                                    className={`rounded border px-1.5 py-0.5 text-[7px] font-bold ${riskClasses(
                                      record.severity === "Fatal"
                                        ? "High"
                                        : record.severity === "Serious"
                                          ? "Medium"
                                          : "Low",
                                    )}`}
                                  >
                                    {record.severity}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-slate-400">
                                  {record.fatalities}
                                </td>
                                <td className="px-3 py-2 text-slate-400">
                                  {record.injuries}
                                </td>
                                <td className="px-3 py-2 text-slate-400">
                                  {record.cause}
                                </td>
                                <td className="px-3 py-2 text-slate-400">
                                  {record.weather}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Panel>
                </section>

                <aside className="space-y-4">
                  <Panel title="Analytical findings" subtitle="Deterministic summary of the available accident history">
                    <div className="space-y-2">
                      {model.findings.map((finding) => (
                        <div
                          key={finding}
                          className="rounded border border-[#414141] bg-[#303030] px-3 py-2 text-[8px] leading-4 text-slate-400"
                        >
                          {finding}
                        </div>
                      ))}
                    </div>
                  </Panel>

                  <Panel title="Cause distribution" subtitle="Which causes dominate this junction">
                    <div className="space-y-2">
                      {model.causes.length === 0 ? (
                        <EmptyState text="No cause records available." />
                      ) : (
                        model.causes.map((row) => (
                          <DistributionBar
                            key={row.label}
                            label={row.label}
                            count={row.count}
                            sharePct={row.sharePct}
                          />
                        ))
                      )}
                    </div>
                  </Panel>

                  <Panel title="Weather conditions" subtitle="Road-weather context in recorded events">
                    <div className="space-y-2">
                      {model.weather.length === 0 ? (
                        <EmptyState text="No weather records available." />
                      ) : (
                        model.weather.map((row) => (
                          <DistributionBar
                            key={row.label}
                            label={row.label}
                            count={row.count}
                            sharePct={row.sharePct}
                          />
                        ))
                      )}
                    </div>
                  </Panel>

                  <Panel title="Operational context" subtitle="Useful quick-reference indicators">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <MicroMetric
                        label="Common cause"
                        value={model.topCause}
                        detail={`${model.topCauseSharePct}% share`}
                      />
                      <MicroMetric
                        label="Peak time"
                        value={model.peakTimeBand}
                        detail={`${model.peakTimeBandSharePct}% share`}
                      />
                      <MicroMetric
                        label="Common weather"
                        value={model.topWeather}
                        detail={`${model.topWeatherSharePct}% share`}
                      />
                      <MicroMetric
                        label="Avg casualties"
                        value={model.averageCasualtiesPerCrash.toFixed(2)}
                        detail="Per accident"
                      />
                    </div>
                  </Panel>
                </aside>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-md border border-[#494949] bg-[#292929]">
      <div className="border-b border-[#414141] px-4 py-3">
        <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#e8872d]">
          {title}
        </p>
        <p className="mt-1 text-[8px] text-slate-500">
          {subtitle}
        </p>
      </div>

      <div className="p-4">{children}</div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-[#494949] bg-[#292929] p-3">
      <p className="text-[7px] font-bold uppercase tracking-[0.08em] text-slate-600">
        {label}
      </p>
      <p className="mt-2 text-lg font-bold text-slate-100">
        {value}
      </p>
      <p className="mt-1 text-[7px] leading-4 text-slate-600">
        {detail}
      </p>
    </div>
  );
}

function MicroMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded border border-[#414141] bg-[#303030] p-3">
      <p className="text-[7px] font-bold uppercase tracking-[0.06em] text-slate-600">
        {label}
      </p>
      <p className="mt-2 truncate text-[10px] font-bold text-slate-200">
        {value}
      </p>
      <p className="mt-1 text-[7px] text-slate-600">
        {detail}
      </p>
    </div>
  );
}

function SeverityCard({
  label,
  count,
  sharePct,
}: {
  label: string;
  count: number;
  sharePct: number;
}) {
  const tone =
    label === "Fatal"
      ? "border-[#713646] bg-[#321722] text-[#f09aae]"
      : label === "Serious"
        ? "border-[#6d5523] bg-[#241d10] text-[#dfc27f]"
        : "border-[#494949] bg-[#303030] text-slate-300";

  return (
    <div className="rounded-md border border-[#494949] bg-[#303030] p-3">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`rounded border px-1.5 py-0.5 text-[7px] font-bold uppercase ${tone}`}
        >
          {label}
        </span>

        <span className="text-[8px] text-slate-500">
          {sharePct}%
        </span>
      </div>

      <p className="mt-3 text-2xl font-bold text-slate-100">
        {count}
      </p>

      <p className="mt-1 text-[7px] text-slate-600">
        Recorded accidents
      </p>
    </div>
  );
}

function DistributionBar({
  label,
  count,
  sharePct,
}: DistributionRow) {
  return (
    <div className="rounded border border-[#414141] bg-[#303030] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[8px] font-semibold text-slate-300">
          {label}
        </p>

        <p className="shrink-0 text-[7px] text-slate-500">
          {count} · {sharePct}%
        </p>
      </div>

      <div className="mt-2 h-2 rounded-full bg-[#202020]">
        <div
          className="h-2 rounded-full bg-[#e8872d]"
          style={{
            width: `${Math.max(6, sharePct)}%`,
          }}
        />
      </div>
    </div>
  );
}

function DataRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-3 border-t border-[#3d3d3d] pt-2 first:border-t-0 first:pt-0">
      <dt className="text-[7px] font-bold uppercase tracking-[0.06em] text-slate-600">
        {label}
      </dt>
      <dd className="m-0 text-[8px] text-slate-300">
        {value}
      </dd>
    </div>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="rounded border border-[#414141] bg-[#303030] px-3 py-2 text-[8px] text-slate-500">
      {text}
    </div>
  );
}
