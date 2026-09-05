import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Gauge,
  MapPinned,
  type LucideIcon,
} from "../components/icons/materialIcons";
import {
  AnalyticsAnalysisService,
  type AnalyticsFilters,
  type AnalyticsSeverityFilter,
} from "../services/analyticsAnalysisService";

ChartJS.register(
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
);

const chartText = "#9a9a9a";
const chartGrid = "rgba(255,255,255,0.08)";
const orange = "#e8872d";
const orangeSoft = "rgba(232,135,45,0.16)";
const neutral = "#8d99a6";
const danger = "#c56f74";

const commonPlugins = {
  legend: {
    labels: {
      color: chartText,
      boxWidth: 10,
      boxHeight: 10,
      font: { size: 10 },
    },
  },
  tooltip: {
    backgroundColor: "#202020",
    borderColor: "#4a4a4a",
    borderWidth: 1,
    titleColor: "#eeeeee",
    bodyColor: "#b9b9b9",
  },
};

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)} pp`;
}

function changeText(value: number | null): string {
  if (value === null) return "No baseline";
  if (value === 0) return "No change";
  return `${Math.abs(value).toFixed(1)}% ${value > 0 ? "higher" : "lower"}`;
}

export default function AnalyticsPage() {
  const [filters, setFilters] = useState<AnalyticsFilters>(
    AnalyticsAnalysisService.emptyFilters(),
  );

  const model = useMemo(
    () => AnalyticsAnalysisService.analyse(filters),
    [filters],
  );

  const updateFilter = <K extends keyof AnalyticsFilters>(
    key: K,
    value: AnalyticsFilters[K],
  ) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const metricCards: Array<{
    label: string;
    value: string;
    note: string;
    icon: LucideIcon;
  }> = [
    {
      label: "Filtered crashes",
      value: String(model.kpis.totalAccidents),
      note: `${model.kpis.severeAccidents} serious / fatal`,
      icon: Activity,
    },
    {
      label: "Severe-outcome share",
      value: `${model.kpis.severeRatePct}%`,
      note: "Serious + fatal crashes / filtered crashes",
      icon: AlertTriangle,
    },
    {
      label: "Casualty intensity",
      value: model.kpis.casualtiesPerAccident.toFixed(2),
      note: `${model.kpis.casualties} casualties / ${model.kpis.totalAccidents || 0} crashes`,
      icon: Gauge,
    },
    {
      label: "Severity index",
      value: `${model.kpis.severityIndex.toFixed(2)} / 5`,
      note: "Minor=1 · Serious=3 · Fatal=5",
      icon: MapPinned,
    },
  ];

  return (
    <div className="space-y-3">
      <section className="ui-panel overflow-hidden">
        <div className="ui-panel-header flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-[#e8872d]">
              Traffic safety analytical workbench
            </p>
            <h1 className="mt-1 text-base font-bold text-slate-200">
              Diagnose patterns, severity, concentration and junction risk
            </h1>
            <p className="mt-1 max-w-4xl text-[9px] leading-4 text-slate-500">
              Charts are supporting evidence only. The analytical layer below computes
              filtered rates, severity uplift, comparable-period change, recurring
              patterns, weighted junction risk and data-quality limitations.
            </p>
          </div>

          <div className="rounded-md border border-[#574638] bg-[#30271f] px-3 py-2 text-right">
            <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#e8a669]">
              Data sufficiency
            </p>
            <p className="mt-1 text-xs font-bold text-slate-200">
              {model.dataSufficiency.label}
            </p>
            <p className="mt-1 max-w-[260px] text-[8px] leading-4 text-slate-500">
              {model.dataSufficiency.description}
            </p>
          </div>
        </div>

        <div className="grid gap-2 border-t border-[#202020] p-3 md:grid-cols-2 xl:grid-cols-7">
          <FilterField label="Junction">
            <select
              value={filters.junctionId}
              onChange={(event) => updateFilter("junctionId", event.target.value)}
            >
              <option value="">All junctions</option>
              {model.filterOptions.junctions.map((junction) => (
                <option key={junction.id} value={junction.id}>
                  {junction.name}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Severity">
            <select
              value={filters.severity}
              onChange={(event) =>
                updateFilter(
                  "severity",
                  event.target.value as AnalyticsSeverityFilter,
                )
              }
            >
              <option value="All">All severities</option>
              <option value="Minor">Minor</option>
              <option value="Serious">Serious</option>
              <option value="Fatal">Fatal</option>
            </select>
          </FilterField>

          <FilterField label="Cause">
            <select
              value={filters.cause}
              onChange={(event) => updateFilter("cause", event.target.value)}
            >
              <option value="">All causes</option>
              {model.filterOptions.causes.map((cause) => (
                <option key={cause} value={cause}>
                  {cause}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Weather">
            <select
              value={filters.weather}
              onChange={(event) => updateFilter("weather", event.target.value)}
            >
              <option value="">All weather</option>
              {model.filterOptions.weather.map((weather) => (
                <option key={weather} value={weather}>
                  {weather}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="From">
            <input
              type="date"
              value={filters.startDate}
              onChange={(event) => updateFilter("startDate", event.target.value)}
            />
          </FilterField>

          <FilterField label="To">
            <input
              type="date"
              value={filters.endDate}
              onChange={(event) => updateFilter("endDate", event.target.value)}
            />
          </FilterField>

          <div className="flex items-end">
            <button
              type="button"
              className="ui-button w-full"
              onClick={() => setFilters(AnalyticsAnalysisService.emptyFilters())}
            >
              Reset filters
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-[#202020] px-3 py-2 text-[8px] text-slate-600">
          <span>
            Analytical sample:{" "}
            <b className="text-slate-400">{model.kpis.totalAccidents}</b> of{" "}
            {model.totalDatasetAccidents} accident records
          </span>
          <span>
            Prototype/demo register — replace with verified research records for
            substantive conclusions
          </span>
          <span>
            No traffic-volume/exposure denominator is currently available
          </span>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map(({ label, value, note, icon: Icon }) => (
          <article key={label} className="ui-panel flex items-center gap-3 p-4">
            <div className="grid h-10 w-10 place-items-center rounded-md border border-[#584536] bg-[#30271f] text-[#e8872d]">
              <Icon size={18} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-600">
                {label}
              </p>
              <p className="mt-1 text-xl font-bold text-slate-200">{value}</p>
              <p className="mt-1 text-[8px] text-slate-600">{note}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.15fr_.85fr]">
        <section className="ui-panel overflow-hidden">
          <div className="ui-panel-header">
            <div>
              <h2 className="ui-panel-title">Analytical findings</h2>
              <p className="mt-1 text-[9px] text-slate-600">
                Deterministic findings generated from the current filtered sample
              </p>
            </div>
          </div>

          <div className="divide-y divide-[#202020]">
            {model.findings.map((finding) => (
              <article
                key={finding.id}
                className="grid gap-3 px-4 py-3 md:grid-cols-[90px_1fr]"
              >
                <div>
                  <span
                    className={`inline-flex rounded border px-2 py-1 text-[8px] font-bold uppercase tracking-[0.08em] ${
                      finding.level === "Critical"
                        ? "border-red-900/60 bg-red-950/25 text-red-300"
                        : finding.level === "High"
                          ? "border-[#744d31] bg-[#33271e] text-[#e8a669]"
                          : finding.level === "Moderate"
                            ? "border-[#555] bg-[#303030] text-slate-300"
                            : "border-[#444] bg-[#292929] text-slate-500"
                    }`}
                  >
                    {finding.level}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-200">
                    {finding.title}
                  </p>
                  <p className="mt-1 text-[9px] leading-4 text-slate-400">
                    {finding.statement}
                  </p>
                  <p className="mt-1 text-[8px] leading-4 text-slate-600">
                    Evidence: {finding.evidence}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="ui-panel overflow-hidden">
          <div className="ui-panel-header">
            <div>
              <h2 className="ui-panel-title">Comparable-period diagnostic</h2>
              <p className="mt-1 text-[9px] text-slate-600">
                Latest year through the latest available date versus the same
                prior-year period
              </p>
            </div>
          </div>

          {model.comparablePeriod.latestYear === null ? (
            <EmptyBlock text="No dated records in the current analytical sample." />
          ) : (
            <div className="grid gap-2 p-3">
              <ComparisonRow
                label="Crash count"
                latest={model.comparablePeriod.latestAccidents}
                previous={model.comparablePeriod.previousAccidents}
                change={model.comparablePeriod.accidentChangePct}
              />
              <ComparisonRow
                label="Serious + fatal"
                latest={model.comparablePeriod.latestSevere}
                previous={model.comparablePeriod.previousSevere}
                change={model.comparablePeriod.severeChangePct}
              />
              <ComparisonRow
                label="Casualties"
                latest={model.comparablePeriod.latestCasualties}
                previous={model.comparablePeriod.previousCasualties}
                change={model.comparablePeriod.casualtyChangePct}
              />

              <div className="mt-1 rounded-md border border-[#494949] bg-[#292929] p-3 text-[8px] leading-4 text-slate-600">
                Comparing {model.comparablePeriod.latestYear} with{" "}
                {model.comparablePeriod.previousYear} through{" "}
                {model.comparablePeriod.cutoffLabel}. This compares recorded counts,
                not exposure-adjusted crash rates.
              </div>
            </div>
          )}
        </section>
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.1fr_.9fr]">
        <ChartPanel
          title="Monthly crash and severe-outcome trend"
          subtitle="Trend evidence supporting the diagnostic layer"
        >
          {model.monthly.length ? (
            <Line
              data={{
                labels: model.monthly.map((item) => item.label),
                datasets: [
                  {
                    label: "All crashes",
                    data: model.monthly.map((item) => item.accidents),
                    borderColor: orange,
                    backgroundColor: orangeSoft,
                    fill: true,
                    tension: 0.25,
                    pointRadius: 2,
                  },
                  {
                    label: "Serious + fatal",
                    data: model.monthly.map((item) => item.severeAccidents),
                    borderColor: danger,
                    backgroundColor: "rgba(197,111,116,.08)",
                    tension: 0.25,
                    pointRadius: 2,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: commonPlugins,
                scales: {
                  x: {
                    ticks: { color: chartText, font: { size: 10 } },
                    grid: { color: chartGrid },
                  },
                  y: {
                    beginAtZero: true,
                    ticks: {
                      color: chartText,
                      precision: 0,
                      font: { size: 10 },
                    },
                    grid: { color: chartGrid },
                  },
                },
              }}
            />
          ) : (
            <EmptyChart text="No monthly trend for the current filters." />
          )}
        </ChartPanel>

        <section className="ui-panel overflow-hidden">
          <div className="ui-panel-header">
            <div>
              <h2 className="ui-panel-title">Time-of-day concentration</h2>
              <p className="mt-1 text-[9px] text-slate-600">
                Frequency and severity are shown separately
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[9px]">
              <thead className="bg-[#292929] text-[8px] uppercase tracking-[0.08em] text-slate-600">
                <tr>
                  <th className="px-3 py-2">Time band</th>
                  <th className="px-3 py-2">Crashes</th>
                  <th className="px-3 py-2">Share</th>
                  <th className="px-3 py-2">Severe rate</th>
                  <th className="px-3 py-2">Severity index</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#202020]">
                {model.timeBands.map((row) => (
                  <tr key={row.label}>
                    <td className="px-3 py-2 font-semibold text-slate-300">
                      {row.label}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{row.accidents}</td>
                    <td className="px-3 py-2 text-slate-400">
                      {row.sharePct}%
                    </td>
                    <td className="px-3 py-2 text-slate-400">
                      {row.severeRatePct}%
                    </td>
                    <td className="px-3 py-2 text-slate-400">
                      {row.severityIndex.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section className="grid gap-3 xl:grid-cols-[1fr_1fr]">
        <section className="ui-panel overflow-hidden">
          <div className="ui-panel-header">
            <div>
              <h2 className="ui-panel-title">Cause diagnostic</h2>
              <p className="mt-1 text-[9px] text-slate-600">
                Frequency alone can hide severity; compare share, severe rate and
                casualty intensity
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[9px]">
              <thead className="bg-[#292929] text-[8px] uppercase tracking-[0.08em] text-slate-600">
                <tr>
                  <th className="px-3 py-2">Cause</th>
                  <th className="px-3 py-2">Crashes</th>
                  <th className="px-3 py-2">Share</th>
                  <th className="px-3 py-2">Severe</th>
                  <th className="px-3 py-2">Uplift</th>
                  <th className="px-3 py-2">Casualties/crash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#202020]">
                {model.causes.map((row) => (
                  <tr key={row.label}>
                    <td className="px-3 py-2 font-semibold text-slate-300">
                      {row.label}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{row.accidents}</td>
                    <td className="px-3 py-2 text-slate-400">
                      {row.sharePct}%
                    </td>
                    <td className="px-3 py-2 text-slate-400">
                      {row.severeRatePct}%
                    </td>
                    <td
                      className={`px-3 py-2 ${
                        row.severeRateDeltaPct > 0
                          ? "text-[#e8a669]"
                          : "text-slate-500"
                      }`}
                    >
                      {signed(row.severeRateDeltaPct)}
                    </td>
                    <td className="px-3 py-2 text-slate-400">
                      {row.casualtiesPerAccident.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <ChartPanel
          title="Cause frequency versus severe outcomes"
          subtitle="Side-by-side counts prevent high-frequency low-severity causes from dominating interpretation"
        >
          {model.causes.length ? (
            <Bar
              data={{
                labels: model.causes.slice(0, 8).map((item) => item.label),
                datasets: [
                  {
                    label: "All crashes",
                    data: model.causes.slice(0, 8).map((item) => item.accidents),
                    backgroundColor: orange,
                    borderRadius: 3,
                  },
                  {
                    label: "Serious + fatal",
                    data: model.causes
                      .slice(0, 8)
                      .map((item) => item.severeAccidents),
                    backgroundColor: danger,
                    borderRadius: 3,
                  },
                ],
              }}
              options={{
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: commonPlugins,
                scales: {
                  x: {
                    beginAtZero: true,
                    ticks: {
                      color: chartText,
                      precision: 0,
                      font: { size: 10 },
                    },
                    grid: { color: chartGrid },
                  },
                  y: {
                    ticks: { color: chartText, font: { size: 10 } },
                    grid: { display: false },
                  },
                },
              }}
            />
          ) : (
            <EmptyChart text="No cause data for the current filters." />
          )}
        </ChartPanel>
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <SeverityMatrix
          title="Cause × severity matrix"
          subtitle="Cross-tabulation of recorded causes and crash severity"
          rows={model.matrices.causeSeverity.map((row) => ({
            label: row.cause,
            minor: row.minor,
            serious: row.serious,
            fatal: row.fatal,
            total: row.total,
          }))}
        />

        <SeverityMatrix
          title="Weather × severity matrix"
          subtitle="Cross-tabulation reveals whether weather categories differ mainly in frequency or severity"
          rows={model.matrices.weatherSeverity.map((row) => ({
            label: row.weather,
            minor: row.minor,
            serious: row.serious,
            fatal: row.fatal,
            total: row.total,
          }))}
        />
      </section>

      <section className="ui-panel overflow-hidden">
        <div className="ui-panel-header">
          <div>
            <h2 className="ui-panel-title">Junction risk diagnostics</h2>
            <p className="mt-1 text-[9px] text-slate-600">
              Uses the same RoadSafe prototype risk weighting: fatality ×10,
              serious crash ×5, minor crash ×2, injury ×2, each crash ×1
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-[9px]">
            <thead className="bg-[#292929] text-[8px] uppercase tracking-[0.08em] text-slate-600">
              <tr>
                <th className="px-3 py-2">Rank / junction</th>
                <th className="px-3 py-2">Risk score</th>
                <th className="px-3 py-2">Risk intensity</th>
                <th className="px-3 py-2">Crashes</th>
                <th className="px-3 py-2">Severe rate</th>
                <th className="px-3 py-2">Casualties/crash</th>
                <th className="px-3 py-2">Recurring cause</th>
                <th className="px-3 py-2">Peak time</th>
                <th className="px-3 py-2">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#202020]">
              {model.junctions.map((junction, index) => (
                <tr key={junction.id}>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <span className="text-slate-600">#{index + 1}</span>
                      <div>
                        <p className="font-semibold text-slate-300">
                          {junction.name}
                        </p>
                        <p className="mt-1 text-[8px] text-slate-600">
                          {junction.roadType} · {junction.city}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <b
                      className={
                        junction.riskLevel === "High"
                          ? "text-[#e8a669]"
                          : "text-slate-300"
                      }
                    >
                      {junction.riskScore}
                    </b>
                    <p className="mt-1 text-[8px] text-slate-600">
                      {junction.riskLevel}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-slate-400">
                    {junction.riskScorePerAccident.toFixed(2)} pts/crash
                  </td>
                  <td className="px-3 py-3 text-slate-400">
                    {junction.accidents}
                  </td>
                  <td className="px-3 py-3 text-slate-400">
                    {junction.severeRatePct}%
                  </td>
                  <td className="px-3 py-3 text-slate-400">
                    {junction.casualtiesPerAccident.toFixed(2)}
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-slate-300">{junction.topCause}</p>
                    <p className="mt-1 text-[8px] text-slate-600">
                      {junction.topCauseCount}/{junction.accidents} ·{" "}
                      {junction.topCauseSharePct}%
                    </p>
                  </td>
                  <td className="px-3 py-3 text-slate-400">
                    {junction.peakTimeBand}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded border px-2 py-1 text-[8px] font-bold ${
                        junction.priority === "Immediate review"
                          ? "border-red-900/60 bg-red-950/25 text-red-300"
                          : junction.priority === "Priority review"
                            ? "border-[#744d31] bg-[#33271e] text-[#e8a669]"
                            : "border-[#494949] bg-[#303030] text-slate-400"
                      }`}
                    >
                      {junction.priority}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[1fr_1fr]">
        <section className="ui-panel overflow-hidden">
          <div className="ui-panel-header">
            <div>
              <h2 className="ui-panel-title">Day-of-week diagnostic</h2>
              <p className="mt-1 text-[9px] text-slate-600">
                Reveals whether high frequency and high severity occur on the same
                days
              </p>
            </div>
          </div>

          <div className="divide-y divide-[#202020]">
            {model.dayOfWeek.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[1fr_55px_75px_75px] gap-2 px-4 py-2 text-[9px]"
              >
                <span className="font-semibold text-slate-300">{row.label}</span>
                <span className="text-right text-slate-400">{row.accidents}</span>
                <span className="text-right text-slate-500">
                  {row.sharePct}% share
                </span>
                <span className="text-right text-slate-500">
                  {row.severeRatePct}% severe
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="ui-panel overflow-hidden">
          <div className="ui-panel-header">
            <div>
              <h2 className="ui-panel-title">Analytical limits / data quality</h2>
              <p className="mt-1 text-[9px] text-slate-600">
                Guardrails against over-interpreting a small prototype dataset
              </p>
            </div>
          </div>

          <div className="grid gap-2 p-3">
            {[
              [
                "Prototype register",
                "The current accident file explicitly contains demonstration records. Verified police/research records must replace them before substantive findings are reported.",
              ],
              [
                "No exposure denominator",
                "The repo does not currently store traffic volume, pedestrian exposure or vehicle-kilometres. Junction comparisons are counts and weighted severity scores, not true crash rates.",
              ],
              [
                "Association is not causation",
                "Cause, weather and time comparisons identify recorded associations. They do not prove a road/environment variable caused the crash.",
              ],
              [
                "Small categories are unstable",
                "Categories with one or two crashes can show 0% or 100% severe rates very easily. Use the sample counts next to every rate.",
              ],
              [
                "Risk score is a prototype heuristic",
                "RoadSafe's risk weights are explicit and reproducible, but they still require validation against police records, expert judgement or transport-safety standards.",
              ],
              [
                "AI should remain secondary",
                "Any future AI insight should explain or prioritise deterministic analytics—not replace the underlying counts, formulas, filters or evidence trail.",
              ],
            ].map(([title, text]) => (
              <article
                key={title}
                className="rounded-md border border-[#494949] bg-[#292929] p-3"
              >
                <p className="text-[9px] font-bold text-slate-300">{title}</p>
                <p className="mt-1 text-[8px] leading-4 text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1 text-[8px] font-bold uppercase tracking-[0.08em] text-slate-600 [&_input]:min-h-9 [&_input]:rounded-md [&_input]:border [&_input]:border-[#494949] [&_input]:bg-[#292929] [&_input]:px-2 [&_input]:text-[10px] [&_input]:font-medium [&_input]:normal-case [&_input]:tracking-normal [&_input]:text-slate-300 [&_select]:min-h-9 [&_select]:rounded-md [&_select]:border [&_select]:border-[#494949] [&_select]:bg-[#292929] [&_select]:px-2 [&_select]:text-[10px] [&_select]:font-medium [&_select]:normal-case [&_select]:tracking-normal [&_select]:text-slate-300">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ComparisonRow({
  label,
  latest,
  previous,
  change,
}: {
  label: string;
  latest: number;
  previous: number;
  change: number | null;
}) {
  return (
    <article className="grid grid-cols-[1fr_auto] gap-3 rounded-md border border-[#494949] bg-[#292929] p-3">
      <div>
        <p className="text-[9px] font-bold text-slate-300">{label}</p>
        <p className="mt-1 text-[8px] text-slate-600">
          {latest} current-period · {previous} prior-period
        </p>
      </div>
      <span
        className={`self-center text-[9px] font-bold ${
          change !== null && change > 0 ? "text-[#e8a669]" : "text-slate-400"
        }`}
      >
        {changeText(change)}
      </span>
    </article>
  );
}

function ChartPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="ui-panel p-4">
      <h2 className="ui-panel-title">{title}</h2>
      <p className="mt-1 text-[9px] text-slate-600">{subtitle}</p>
      <div className="mt-4 h-72">{children}</div>
    </section>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="grid h-full place-items-center rounded-md border border-dashed border-[#494949] text-center text-[10px] text-slate-600">
      {text}
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return <div className="p-4 text-[9px] text-slate-600">{text}</div>;
}

function SeverityMatrix({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: Array<{
    label: string;
    minor: number;
    serious: number;
    fatal: number;
    total: number;
  }>;
}) {
  return (
    <section className="ui-panel overflow-hidden">
      <div className="ui-panel-header">
        <div>
          <h2 className="ui-panel-title">{title}</h2>
          <p className="mt-1 text-[9px] text-slate-600">{subtitle}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyBlock text="No records match the current filters." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[9px]">
            <thead className="bg-[#292929] text-[8px] uppercase tracking-[0.08em] text-slate-600">
              <tr>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Minor</th>
                <th className="px-3 py-2">Serious</th>
                <th className="px-3 py-2">Fatal</th>
                <th className="px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#202020]">
              {rows.map((row) => (
                <tr key={row.label}>
                  <td className="px-3 py-2 font-semibold text-slate-300">
                    {row.label}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{row.minor}</td>
                  <td
                    className={`px-3 py-2 ${
                      row.serious > 0 ? "text-[#e8a669]" : "text-slate-600"
                    }`}
                  >
                    {row.serious}
                  </td>
                  <td
                    className={`px-3 py-2 ${
                      row.fatal > 0 ? "text-red-300" : "text-slate-600"
                    }`}
                  >
                    {row.fatal}
                  </td>
                  <td className="px-3 py-2 font-bold text-slate-300">
                    {row.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
