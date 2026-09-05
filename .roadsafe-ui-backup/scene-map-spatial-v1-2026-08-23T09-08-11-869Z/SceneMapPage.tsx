import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Crosshair,
  Download,
  Filter,
  Map,
  MapPin,
  RotateCcw,
  ShieldAlert,
  Skull,
  SlidersHorizontal,
  Users,
} from "../components/icons/materialIcons";

import AccidentMap, {
  type VisualizationMode,
} from "../components/map/AccidentMap";
import { AccidentFilterService } from "../services/accidentFilterService";
import { AccidentService } from "../services/accidentService";
import { JunctionService } from "../services/junctionService";
import type { Accident } from "../types/accident";
import {
  createDefaultHeatmapFilters,
  type AccidentHeatmapFilters,
} from "../types/heatmap";

interface MetricCardProps {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Activity;
  tone?: "blue" | "amber" | "red" | "green";
}

const metricToneClasses = {
  blue: "border-[#494949] bg-[#303030] text-[#c4c4c4]",
  amber: "border-[#6d5523] bg-[#303030] text-[#d9bd78]",
  red: "border-[#713646] bg-[#21101a] text-[#e28b9d]",
  green: "border-[#494949] bg-[#303030] text-[#c4c4c4]",
} as const;

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "blue",
}: MetricCardProps) {
  return (
    <article
      className={`min-w-0 rounded-md border p-3 ${metricToneClasses[tone]}`}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[8px] font-bold uppercase tracking-[0.1em] text-slate-600">
            {label}
          </p>
          <p className="mt-2 font-mono text-xl font-bold leading-none text-slate-100">
            {value}
          </p>
          <p className="mt-2 truncate text-[8px] text-slate-600" title={detail}>
            {detail}
          </p>
        </div>

        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-current/30 bg-black/10">
          <Icon size={15} strokeWidth={1.8} />
        </span>
      </div>
    </article>
  );
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value || "Unknown";

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function escapeCsv(value: string | number): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadAccidentCsv(accidents: Accident[]): void {
  const header = [
    "Accident ID",
    "Junction ID",
    "Date",
    "Time",
    "Severity",
    "Fatalities",
    "Injuries",
    "Vehicles involved",
    "Cause",
    "Weather",
  ];

  const rows = accidents.map((accident) => [
    accident.id,
    accident.junctionId,
    accident.date,
    accident.time,
    accident.severity,
    accident.fatalities,
    accident.injuries,
    accident.vehiclesInvolved,
    accident.cause,
    accident.weather,
  ]);

  const csv = [
    header.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ].join("\n");

  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `roadsafe-scene-map-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function countActiveFilters(filters: AccidentHeatmapFilters): number {
  return [
    filters.startDate,
    filters.endDate,
    filters.severity !== "All" ? filters.severity : "",
    filters.weather !== "All" ? filters.weather : "",
    filters.cause !== "All" ? filters.cause : "",
  ].filter(Boolean).length;
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

export default function SceneMapPage() {
  const [mode, setMode] = useState<VisualizationMode>("markers");
  const [filters, setFilters] = useState<AccidentHeatmapFilters>(() =>
    createDefaultHeatmapFilters(),
  );

  const allAccidents = useMemo(() => AccidentService.getAll(), []);
  const allJunctionsWithRisk = useMemo(
    () =>
      [...JunctionService.getAllWithRisk()].sort(
        (first, second) =>
          second.risk.riskScore - first.risk.riskScore ||
          second.risk.totalAccidents - first.risk.totalAccidents,
      ),
    [],
  );

  const filterOptions = useMemo(
    () => AccidentFilterService.getOptions(allAccidents),
    [allAccidents],
  );

  const filteredAccidents = useMemo(
    () => AccidentFilterService.filter(allAccidents, filters),
    [allAccidents, filters],
  );

  const totals = useMemo(() => {
    const fatalities = filteredAccidents.reduce(
      (sum, accident) => sum + accident.fatalities,
      0,
    );
    const injuries = filteredAccidents.reduce(
      (sum, accident) => sum + accident.injuries,
      0,
    );
    const seriousOrFatal = filteredAccidents.filter(
      (accident) =>
        accident.severity === "Serious" || accident.severity === "Fatal",
    ).length;
    const affectedJunctions = new Set(
      filteredAccidents.map((accident) => accident.junctionId),
    ).size;

    return {
      fatalities,
      injuries,
      seriousOrFatal,
      affectedJunctions,
    };
  }, [filteredAccidents]);

  const recentAccidents = useMemo(
    () =>
      [...filteredAccidents]
        .sort((first, second) =>
          `${second.date}T${second.time}`.localeCompare(
            `${first.date}T${first.time}`,
          ),
        )
        .slice(0, 6),
    [filteredAccidents],
  );

  const activeFilterCount = countActiveFilters(filters);
  const invalidDateRange =
    AccidentFilterService.hasInvalidDateRange(filters);
  const highRiskCount = allJunctionsWithRisk.filter(
    (item) => item.risk.riskLevel === "High",
  ).length;

  const updateFilter = <Key extends keyof AccidentHeatmapFilters>(
    key: Key,
    value: AccidentHeatmapFilters[Key],
  ) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const resetFilters = () => {
    setFilters(createDefaultHeatmapFilters());
  };

  return (
    <div className="scene-map-page min-w-0 space-y-3">
      <section className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Visible records"
          value={filteredAccidents.length}
          detail={`${allAccidents.length} total accident records`}
          icon={Activity}
        />
        <MetricCard
          label="Affected junctions"
          value={totals.affectedJunctions}
          detail={`${JunctionService.getAll().length} mapped junctions`}
          icon={MapPin}
          tone="blue"
        />
        <MetricCard
          label="Serious or fatal"
          value={totals.seriousOrFatal}
          detail="High-severity records in view"
          icon={ShieldAlert}
          tone="amber"
        />
        <MetricCard
          label="Fatalities"
          value={totals.fatalities}
          detail="Recorded fatalities in filter"
          icon={Skull}
          tone="red"
        />
        <MetricCard
          label="Injuries"
          value={totals.injuries}
          detail={`${highRiskCount} high-risk junctions overall`}
          icon={Users}
          tone="green"
        />
      </section>

      <div className="grid min-w-0 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="ui-panel min-w-0 overflow-hidden">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-[#494949] px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[#494949] bg-[#303030] text-[#c4c4c4]">
                <Map size={17} strokeWidth={1.8} />
              </div>

              <div className="min-w-0">
                <h2 className="ui-panel-title truncate">
                  Road-safety intelligence map
                </h2>
                <p className="mt-1 truncate text-[9px] text-slate-500">
                  Junction risk, accident density and selected-area analysis
                </p>
              </div>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded border border-[#494949] bg-[#303030] px-2 py-1 text-[8px] font-bold uppercase tracking-[0.08em] text-[#c4c4c4]">
                <Activity size={10} strokeWidth={2} />
                {mode === "markers" ? "Junction markers" : "Accident heatmap"}
              </span>

              {activeFilterCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded border border-[#6d5523] bg-[#241d10] px-2 py-1 text-[8px] font-bold uppercase tracking-[0.08em] text-[#d9bd78]">
                  <Filter size={10} strokeWidth={2} />
                  {activeFilterCount} active filter
                  {activeFilterCount === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>

          <div className="relative h-[clamp(540px,calc(100vh-275px),850px)] min-w-0 overflow-hidden bg-[#303030]">
            <AccidentMap
              visualizationMode={mode}
              onVisualizationModeChange={setMode}
              heatmapFilters={filters}
              compactSelectionPanel
            />
          </div>
        </section>

        <aside className="min-w-0 space-y-3 xl:max-h-[calc(100vh-92px)] xl:overflow-y-auto xl:overscroll-contain xl:pr-1 [scrollbar-color:#555555_#202020] [scrollbar-width:thin]">
          <section className="ui-panel min-w-0 overflow-hidden">
            <div className="ui-panel-header gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <SlidersHorizontal
                  size={15}
                  strokeWidth={1.8}
                  className="shrink-0 text-[#c4c4c4]"
                />
                <div className="min-w-0">
                  <h2 className="ui-panel-title truncate">
                    Accident intelligence filters
                  </h2>
                  <p className="mt-1 truncate text-[8px] text-slate-600">
                    Filters update the heatmap and summary panels
                  </p>
                </div>
              </div>

              <span className="shrink-0 rounded border border-[#494949] bg-[#303030] px-2 py-1 font-mono text-[8px] font-bold text-[#c4c4c4]">
                {filteredAccidents.length}
              </span>
            </div>

            <div className="space-y-3 p-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="min-w-0 text-[8px] font-bold text-slate-500">
                  Start date
                  <input
                    type="date"
                    min={filterOptions.minimumDate || undefined}
                    max={filterOptions.maximumDate || undefined}
                    value={filters.startDate}
                    onChange={(event) =>
                      updateFilter("startDate", event.target.value)
                    }
                    className="ui-input mt-1.5 w-full min-w-0 px-2 text-[9px]"
                  />
                </label>

                <label className="min-w-0 text-[8px] font-bold text-slate-500">
                  End date
                  <input
                    type="date"
                    min={filterOptions.minimumDate || undefined}
                    max={filterOptions.maximumDate || undefined}
                    value={filters.endDate}
                    onChange={(event) =>
                      updateFilter("endDate", event.target.value)
                    }
                    className="ui-input mt-1.5 w-full min-w-0 px-2 text-[9px]"
                  />
                </label>
              </div>

              <label className="block min-w-0 text-[8px] font-bold text-slate-500">
                Severity
                <select
                  value={filters.severity}
                  onChange={(event) =>
                    updateFilter(
                      "severity",
                      event.target.value as AccidentHeatmapFilters["severity"],
                    )
                  }
                  className="ui-input mt-1.5 w-full min-w-0"
                >
                  {["All", "Minor", "Serious", "Fatal"].map((severity) => (
                    <option key={severity} value={severity}>
                      {severity === "All" ? "All severities" : severity}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block min-w-0 text-[8px] font-bold text-slate-500">
                Weather
                <select
                  value={filters.weather}
                  onChange={(event) =>
                    updateFilter("weather", event.target.value)
                  }
                  className="ui-input mt-1.5 w-full min-w-0"
                >
                  <option value="All">All weather conditions</option>
                  {filterOptions.weatherConditions.map((weather) => (
                    <option key={weather} value={weather}>
                      {weather}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block min-w-0 text-[8px] font-bold text-slate-500">
                Reported cause
                <select
                  value={filters.cause}
                  onChange={(event) =>
                    updateFilter("cause", event.target.value)
                  }
                  className="ui-input mt-1.5 w-full min-w-0"
                >
                  <option value="All">All reported causes</option>
                  {filterOptions.causes.map((cause) => (
                    <option key={cause} value={cause}>
                      {cause}
                    </option>
                  ))}
                </select>
              </label>

              {invalidDateRange && (
                <div className="flex items-start gap-2 rounded-md border border-[#713646] bg-[#321722] px-3 py-2.5">
                  <AlertTriangle
                    size={12}
                    strokeWidth={1.8}
                    className="mt-0.5 shrink-0 text-[#e28b9d]"
                  />
                  <p className="text-[8px] leading-4 text-[#e28b9d]">
                    The start date must be earlier than or equal to the end date.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={resetFilters}
                  disabled={activeFilterCount === 0}
                  className="ui-button min-w-0 px-2 py-2 text-[9px] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <RotateCcw size={11} strokeWidth={1.8} />
                  Reset
                </button>

                <button
                  type="button"
                  onClick={() => downloadAccidentCsv(filteredAccidents)}
                  disabled={filteredAccidents.length === 0}
                  className="ui-button-primary min-w-0 px-2 py-2 text-[9px] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Download size={11} strokeWidth={1.8} />
                  Export CSV
                </button>
              </div>
            </div>
          </section>

          <section className="ui-panel min-w-0 overflow-hidden">
            <div className="ui-panel-header gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <BarChart3
                  size={15}
                  strokeWidth={1.8}
                  className="shrink-0 text-[#d9bd78]"
                />
                <div className="min-w-0">
                  <h2 className="ui-panel-title truncate">
                    Highest-risk junctions
                  </h2>
                  <p className="mt-1 truncate text-[8px] text-slate-600">
                    Current deterministic risk ranking
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2 p-3">
              {allJunctionsWithRisk.slice(0, 5).map((item, index) => (
                <article
                  key={item.junction.id}
                  className="min-w-0 rounded-md border border-[#494949] bg-[#303030] px-3 py-3"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[#494949] bg-[#303030] font-mono text-[8px] font-bold text-[#c4c4c4]">
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p
                            className="truncate text-[9px] font-bold text-slate-300"
                            title={item.junction.name}
                          >
                            {item.junction.name}
                          </p>
                          <p className="mt-1 truncate text-[7px] text-slate-600">
                            {item.junction.city} · {item.junction.roadType}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded border px-1.5 py-0.5 text-[6px] font-bold uppercase tracking-[0.08em] ${getRiskClasses(
                            item.risk.riskLevel,
                          )}`}
                        >
                          {item.risk.riskLevel}
                        </span>
                      </div>

                      <div className="mt-2 grid grid-cols-3 gap-1.5">
                        {[
                          ["Score", item.risk.riskScore],
                          ["Crashes", item.risk.totalAccidents],
                          ["Casualties", item.risk.fatalities + item.risk.injuries],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="min-w-0 rounded border border-[#494949] bg-[#303030] px-1.5 py-1.5 text-center"
                          >
                            <p className="truncate font-mono text-[8px] font-bold text-slate-300">
                              {value}
                            </p>
                            <p className="mt-0.5 truncate text-[6px] uppercase tracking-[0.05em] text-slate-600">
                              {label}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="ui-panel min-w-0 overflow-hidden">
            <div className="ui-panel-header gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <CalendarDays
                  size={15}
                  strokeWidth={1.8}
                  className="shrink-0 text-[#c4c4c4]"
                />
                <div className="min-w-0">
                  <h2 className="ui-panel-title truncate">
                    Recent filtered incidents
                  </h2>
                  <p className="mt-1 truncate text-[8px] text-slate-600">
                    Latest accident records matching the filters
                  </p>
                </div>
              </div>
            </div>

            {recentAccidents.length === 0 ? (
              <div className="p-3">
                <div className="rounded-md border border-dashed border-[#494949] bg-[#303030] px-4 py-6 text-center">
                  <p className="text-[9px] font-bold text-slate-400">
                    No matching incidents
                  </p>
                  <p className="mt-1 text-[8px] leading-4 text-slate-600">
                    Reset or broaden the current accident filters.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-[#303030]">
                {recentAccidents.map((accident) => {
                  const junction = JunctionService.getById(accident.junctionId);

                  return (
                    <article
                      key={accident.id}
                      className="min-w-0 px-3 py-3 transition-colors hover:bg-[#303030]"
                    >
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p
                            className="truncate text-[9px] font-bold text-slate-300"
                            title={junction?.name ?? accident.junctionId}
                          >
                            {junction?.name ?? accident.junctionId}
                          </p>
                          <p className="mt-1 truncate text-[7px] text-slate-600">
                            {formatDate(accident.date)} · {accident.time}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded border px-1.5 py-0.5 text-[6px] font-bold uppercase tracking-[0.08em] ${
                            accident.severity === "Fatal"
                              ? "border-[#713646] bg-[#321722] text-[#e28b9d]"
                              : accident.severity === "Serious"
                                ? "border-[#6d5523] bg-[#241d10] text-[#d9bd78]"
                                : "border-[#494949] bg-[#303030] text-[#c4c4c4]"
                          }`}
                        >
                          {accident.severity}
                        </span>
                      </div>

                      <p className="mt-2 truncate text-[8px] text-slate-500">
                        {accident.cause} · {accident.weather}
                      </p>

                      <div className="mt-2 flex min-w-0 flex-wrap gap-2 text-[7px] text-slate-600">
                        <span>Fatalities: {accident.fatalities}</span>
                        <span>Injuries: {accident.injuries}</span>
                        <span>Vehicles: {accident.vehiclesInvolved}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-md border border-[#494949] bg-[#303030] px-3 py-3">
            <div className="flex items-start gap-2.5">
              <Crosshair
                size={13}
                strokeWidth={1.8}
                className="mt-0.5 shrink-0 text-[#d9bd78]"
              />
              <p className="text-[8px] leading-4 text-[#bba56f]">
                Accident filters affect the heatmap, statistics, export and
                incident list. Junction markers continue to represent the
                complete junction-risk register.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
