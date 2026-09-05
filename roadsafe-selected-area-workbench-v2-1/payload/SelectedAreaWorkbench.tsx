import { useMemo, useState } from "react";

import { AccidentFilterService } from "../../services/accidentFilterService";
import { AccidentService } from "../../services/accidentService";
import { JunctionService } from "../../services/junctionService";

import type { AreaAnalysis } from "../../types/areaAnalysis";
import type { Accident } from "../../types/accident";
import type { AccidentHeatmapFilters } from "../../types/heatmap";
import type { MapBounds } from "../../types/map";

interface Props {
  analysis: AreaAnalysis;
  bounds: MapBounds;
  filters: AccidentHeatmapFilters;
  compact?: boolean;
  onExpand?(): void;
  onClose?(): void;
  onSelectAgain?(): void;
}

interface Row {
  label: string;
  count: number;
  sharePct: number;
  severeRatePct: number;
  casualties: number;
}

const round = (value: number, digits = 1) => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

const isSevere = (a: Accident) =>
  a.severity === "Serious" || a.severity === "Fatal";

const casualtyCount = (records: Accident[]) =>
  records.reduce(
    (sum, a) => sum + a.fatalities + a.injuries,
    0,
  );

function timeBand(a: Accident): string {
  const hour = Number(a.time.split(":")[0]);
  if (!Number.isFinite(hour)) return "Unknown";
  if (hour < 6) return "00:00–05:59";
  if (hour < 10) return "06:00–09:59";
  if (hour < 16) return "10:00–15:59";
  if (hour < 20) return "16:00–19:59";
  return "20:00–23:59";
}

function breakdown(
  records: Accident[],
  labelFor: (a: Accident) => string,
): Row[] {
  const groups = new Map<string, Accident[]>();

  records.forEach((a) => {
    const label = labelFor(a).trim() || "Unknown";
    groups.set(label, [...(groups.get(label) ?? []), a]);
  });

  return Array.from(groups.entries())
    .map(([label, group]) => ({
      label,
      count: group.length,
      sharePct: round(pct(group.length, records.length)),
      severeRatePct: round(
        pct(group.filter(isSevere).length, group.length),
      ),
      casualties: casualtyCount(group),
    }))
    .sort(
      (a, b) =>
        b.count - a.count || b.severeRatePct - a.severeRatePct,
    );
}

function riskClass(level: "Low" | "Medium" | "High") {
  if (level === "High")
    return "border-[#713646] bg-[#321722] text-[#e28b9d]";
  if (level === "Medium")
    return "border-[#6d5523] bg-[#241d10] text-[#d9bd78]";
  return "border-[#494949] bg-[#303030] text-slate-400";
}

function geometry(bounds: MapBounds) {
  const midLat = (bounds.north + bounds.south) / 2;
  const heightKm = Math.abs(bounds.north - bounds.south) * 111.32;
  const widthKm =
    Math.abs(bounds.east - bounds.west) *
    111.32 *
    Math.cos((midLat * Math.PI) / 180);

  return {
    widthKm: round(widthKm, 3),
    heightKm: round(heightKm, 3),
    lat: round(midLat, 6),
    lng: round((bounds.east + bounds.west) / 2, 6),
  };
}

function escapeCsv(value: string | number): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function exportCsv(analysis: AreaAnalysis, bounds: MapBounds) {
  const header = [
    "Accident ID",
    "Junction ID",
    "Junction",
    "Date",
    "Time",
    "Severity",
    "Fatalities",
    "Injuries",
    "Vehicles",
    "Cause",
    "Weather",
    "North",
    "South",
    "East",
    "West",
  ];

  const rows = analysis.accidents.map((a) => [
    a.id,
    a.junctionId,
    JunctionService.getById(a.junctionId)?.name ?? a.junctionId,
    a.date,
    a.time,
    a.severity,
    a.fatalities,
    a.injuries,
    a.vehiclesInvolved,
    a.cause,
    a.weather,
    bounds.north,
    bounds.south,
    bounds.east,
    bounds.west,
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
  anchor.download = `roadsafe-selected-area-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function SelectedAreaWorkbench({
  analysis,
  bounds,
  filters,
  compact = false,
  onExpand,
  onClose,
  onSelectAgain,
}: Props) {
  const [copied, setCopied] = useState("");

  const network = useMemo(
    () =>
      AccidentFilterService.filter(
        AccidentService.getAll(),
        filters,
      ),
    [filters],
  );

  const severe = analysis.accidents.filter(isSevere).length;
  const severeRate = round(pct(severe, analysis.totalAccidents));
  const areaCasualties = casualtyCount(analysis.accidents);
  const networkCasualties = casualtyCount(network);
  const casualtyIntensity = round(
    areaCasualties / Math.max(1, analysis.totalAccidents),
    2,
  );
  const density = round(
    analysis.totalAccidents /
      Math.max(0.001, analysis.areaSquareKilometres),
    2,
  );
  const crashShare = round(
    pct(analysis.totalAccidents, network.length),
  );
  const casualtyShare = round(
    pct(areaCasualties, networkCasualties),
  );
  const networkSevereRate = round(
    pct(network.filter(isSevere).length, network.length),
  );
  const severeDelta = round(severeRate - networkSevereRate);

  const causes = useMemo(
    () => breakdown(analysis.accidents, (a) => a.cause),
    [analysis.accidents],
  );
  const weather = useMemo(
    () => breakdown(analysis.accidents, (a) => a.weather),
    [analysis.accidents],
  );
  const times = useMemo(
    () => breakdown(analysis.accidents, timeBand),
    [analysis.accidents],
  );

  const risks = useMemo(() => {
    const total = analysis.junctionRiskAnalyses.reduce(
      (sum, r) => sum + r.riskScore,
      0,
    );

    return [...analysis.junctionRiskAnalyses]
      .filter((risk) => risk.totalAccidents > 0)
      .sort(
        (a, b) =>
          b.riskScore - a.riskScore ||
          b.totalAccidents - a.totalAccidents,
      )
      .map((risk) => {
        const junction = analysis.junctions.find(
          (j) => j.id === risk.junctionId,
        );

        return {
          risk,
          junction,
          sharePct: round(pct(risk.riskScore, total)),
        };
      });
  }, [analysis]);

  const topCause = causes[0];
  const peakTime = times[0];
  const topRisk = risks[0];
  const geo = geometry(bounds);

  const brief = [
    "RoadSafe selected-area analytical brief",
    `Area: ${analysis.areaSquareKilometres.toFixed(3)} km²`,
    `Crashes: ${analysis.totalAccidents}`,
    `Severe share: ${severeRate}%`,
    `Fatalities: ${analysis.totalFatalities}`,
    `Injuries: ${analysis.totalInjuries}`,
    `Casualties/crash: ${casualtyIntensity}`,
    `Descriptive density: ${density}/km²`,
    `Overall risk: ${analysis.overallRiskLevel}`,
    `Average risk score: ${analysis.averageRiskScore}`,
    `Dominant cause: ${topCause?.label ?? "No data"} (${topCause?.sharePct ?? 0}%)`,
    `Peak time: ${peakTime?.label ?? "No data"}`,
    `Highest-risk junction: ${topRisk?.junction?.name ?? "No data"}`,
    `Filtered crash share: ${crashShare}%`,
    `Filtered casualty share: ${casualtyShare}%`,
    `Centre: ${geo.lat}, ${geo.lng}`,
  ].join("\n");

  const copy = async (name: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(name);
      window.setTimeout(() => setCopied(""), 1400);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

  if (compact) {
    return (
      <div className="space-y-2.5">
        <div className="grid grid-cols-3 gap-1.5">
          <Mini label="Crashes" value={analysis.totalAccidents} />
          <Mini label="Severe" value={`${severeRate}%`} />
          <Mini label="Casualties" value={areaCasualties} />
          <Mini
            label="Area"
            value={`${analysis.areaSquareKilometres.toFixed(2)} km²`}
          />
          <Mini label="Crashes/km²" value={density.toFixed(1)} />
          <Mini label="Risk avg" value={analysis.averageRiskScore} />
        </div>

        <div className="rounded border border-[#494949] bg-[#292929] p-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[8px] font-bold text-slate-300">
              {topRisk?.junction?.name ?? "No junction in selection"}
            </p>
            <span
              className={`shrink-0 rounded border px-1.5 py-0.5 text-[7px] font-bold uppercase ${riskClass(
                analysis.overallRiskLevel,
              )}`}
            >
              {analysis.overallRiskLevel}
            </span>
          </div>
          <p className="mt-1.5 truncate text-[7px] text-slate-500">
            Cause: {topCause?.label ?? "No data"} ·{" "}
            {topCause?.sharePct ?? 0}%
          </p>
          <p className="mt-1 truncate text-[7px] text-slate-500">
            Peak: {peakTime?.label ?? "No data"} · Area has{" "}
            {crashShare}% of filtered crashes
          </p>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={onExpand}
            className="rounded border border-[#8c6039] bg-[#3a2c21] px-2 py-1.5 text-[8px] font-bold text-[#f0c49a]"
          >
            Workbench
          </button>
          <button
            type="button"
            onClick={() => exportCsv(analysis, bounds)}
            disabled={analysis.totalAccidents === 0}
            className="rounded border border-[#494949] bg-[#303030] px-2 py-1.5 text-[8px] font-semibold text-slate-300 disabled:opacity-40"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => copy("brief", brief)}
            className="rounded border border-[#494949] bg-[#303030] px-2 py-1.5 text-[8px] font-semibold text-slate-300"
          >
            {copied === "brief" ? "Copied" : "Copy brief"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={onSelectAgain}
            className="rounded border border-[#494949] bg-[#303030] px-2 py-1.5 text-[8px] font-semibold text-slate-300"
          >
            Select again
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-[#494949] bg-[#303030] px-2 py-1.5 text-[8px] font-semibold text-slate-300"
          >
            Clear area
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
      <main className="min-w-0 space-y-3">
        <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Filtered crashes"
            value={analysis.totalAccidents}
            detail={`${crashShare}% of filtered network`}
          />
          <Metric
            label="Severe-outcome share"
            value={`${severeRate}%`}
            detail={`${severeDelta >= 0 ? "+" : ""}${severeDelta} pp vs network`}
          />
          <Metric
            label="Casualty intensity"
            value={casualtyIntensity.toFixed(2)}
            detail={`${areaCasualties} casualties`}
          />
          <Metric
            label="Descriptive density"
            value={`${density.toFixed(2)}/km²`}
            detail="Not exposure-adjusted"
          />
        </section>

        <section className="grid gap-3 lg:grid-cols-3">
          <Insight
            label="Highest risk contributor"
            value={topRisk?.junction?.name ?? "No data"}
            detail={
              topRisk
                ? `Score ${topRisk.risk.riskScore} · ${topRisk.sharePct}% of area risk`
                : "No mapped junction"
            }
          />
          <Insight
            label="Dominant recorded cause"
            value={topCause?.label ?? "No data"}
            detail={
              topCause
                ? `${topCause.count}/${analysis.totalAccidents} · ${topCause.sharePct}% · severe ${topCause.severeRatePct}%`
                : "No cause records"
            }
          />
          <Insight
            label="Peak time band"
            value={peakTime?.label ?? "No data"}
            detail={
              peakTime
                ? `${peakTime.count}/${analysis.totalAccidents} · severe ${peakTime.severeRatePct}%`
                : "No time records"
            }
          />
        </section>

        <SeverityBlock analysis={analysis} />

        <div className="grid gap-3 lg:grid-cols-2">
          <Breakdown title="Cause diagnostic" rows={causes} />
          <Breakdown title="Weather diagnostic" rows={weather} />
        </div>

        <Breakdown title="Time-of-day diagnostic" rows={times} />

        <section className="overflow-hidden rounded-md border border-[#494949] bg-[#292929]">
          <Head eyebrow="Risk contribution" title="Junctions in selected area" />
          {risks.length === 0 ? (
            <div className="p-4 text-[8px] text-slate-600">
              No monitored junctions inside this selection.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-[8px]">
                <thead className="bg-[#303030] uppercase tracking-[0.07em] text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Junction</th>
                    <th className="px-3 py-2">Crashes</th>
                    <th className="px-3 py-2">Serious</th>
                    <th className="px-3 py-2">Fatal</th>
                    <th className="px-3 py-2">Casualties</th>
                    <th className="px-3 py-2">Risk</th>
                    <th className="px-3 py-2">Area risk share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#202020]">
                  {risks.map((row, index) => (
                    <tr key={row.risk.junctionId}>
                      <td className="px-3 py-3">
                        <p className="font-bold text-slate-300">
                          #{index + 1} ·{" "}
                          {row.junction?.name ?? row.risk.junctionId}
                        </p>
                        <p className="mt-1 text-[7px] text-slate-600">
                          {row.junction?.roadType ?? "Mapped junction"} ·{" "}
                          {row.junction?.city ?? ""}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-slate-400">
                        {row.risk.totalAccidents}
                      </td>
                      <td className="px-3 py-3 text-slate-400">
                        {row.risk.seriousAccidents}
                      </td>
                      <td className="px-3 py-3 text-slate-400">
                        {row.risk.fatalAccidents}
                      </td>
                      <td className="px-3 py-3 text-slate-400">
                        {row.risk.fatalities + row.risk.injuries}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded border px-1.5 py-0.5 font-bold ${riskClass(
                            row.risk.riskLevel,
                          )}`}
                        >
                          {row.risk.riskScore} · {row.risk.riskLevel}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-400">
                        {row.sharePct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      <aside className="min-w-0 space-y-3">
        <section className="overflow-hidden rounded-md border border-[#494949] bg-[#292929]">
          <Head eyebrow="Network comparison" title="Area contribution" />
          <div className="space-y-2 p-3">
            <Compare
              label="Filtered crash share"
              value={`${crashShare}%`}
              detail={`${analysis.totalAccidents} of ${network.length}`}
            />
            <Compare
              label="Filtered casualty share"
              value={`${casualtyShare}%`}
              detail={`${areaCasualties} of ${networkCasualties}`}
            />
            <Compare
              label="Severe-rate difference"
              value={`${severeDelta >= 0 ? "+" : ""}${severeDelta} pp`}
              detail={`${severeRate}% area vs ${networkSevereRate}% network`}
            />
            <Compare
              label="Average junction risk"
              value={String(analysis.averageRiskScore)}
              detail={`${analysis.totalRiskScore} total weighted points`}
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-md border border-[#494949] bg-[#292929]">
          <Head eyebrow="Geometry" title="Selected zone measurements" />
          <dl className="p-3 text-[8px]">
            <Geo label="Area" value={`${analysis.areaSquareKilometres.toFixed(3)} km²`} />
            <Geo label="Width" value={`${geo.widthKm.toFixed(3)} km`} />
            <Geo label="Height" value={`${geo.heightKm.toFixed(3)} km`} />
            <Geo label="Centre" value={`${geo.lat.toFixed(6)}, ${geo.lng.toFixed(6)}`} />
            <Geo label="North" value={bounds.north.toFixed(6)} />
            <Geo label="South" value={bounds.south.toFixed(6)} />
            <Geo label="East" value={bounds.east.toFixed(6)} />
            <Geo label="West" value={bounds.west.toFixed(6)} />
          </dl>
        </section>

        <section className="overflow-hidden rounded-md border border-[#494949] bg-[#292929]">
          <Head eyebrow="Tools" title="Selected-area actions" />
          <div className="grid gap-2 p-3">
            <button
              type="button"
              onClick={() => exportCsv(analysis, bounds)}
              disabled={analysis.totalAccidents === 0}
              className="ui-button-primary w-full disabled:opacity-40"
            >
              Export selected-area CSV
            </button>
            <button
              type="button"
              onClick={() =>
                copy(
                  "center",
                  `${geo.lat.toFixed(6)}, ${geo.lng.toFixed(6)}`,
                )
              }
              className="ui-button w-full"
            >
              {copied === "center" ? "Centre copied" : "Copy centre"}
            </button>
            <button
              type="button"
              onClick={() =>
                copy(
                  "bounds",
                  `N ${bounds.north.toFixed(6)}, S ${bounds.south.toFixed(
                    6,
                  )}, E ${bounds.east.toFixed(6)}, W ${bounds.west.toFixed(
                    6,
                  )}`,
                )
              }
              className="ui-button w-full"
            >
              {copied === "bounds" ? "Bounds copied" : "Copy bounds"}
            </button>
            <button
              type="button"
              onClick={() => copy("brief", brief)}
              className="ui-button w-full"
            >
              {copied === "brief"
                ? "Brief copied"
                : "Copy analytical brief"}
            </button>
            {onSelectAgain && (
              <button
                type="button"
                onClick={onSelectAgain}
                className="ui-button w-full"
              >
                Draw another area
              </button>
            )}
          </div>
        </section>

        <section className="rounded-md border border-[#6d5523] bg-[#241d10] p-3">
          <p className="text-[8px] font-bold text-[#d9bd78]">
            Spatial interpretation guardrail
          </p>
          <p className="mt-1 text-[7px] leading-4 text-[#bba56f]">
            Accident records are junction-linked rather than exact crash GPS
            points. A crash enters the rectangle when its mapped junction lies
            inside it. Crashes/km² is descriptive density only, not an
            exposure-adjusted crash rate.
          </p>
        </section>
      </aside>
    </div>
  );
}

function Mini({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="min-w-0 rounded border border-[#494949] bg-[#292929] p-2 text-center">
      <p className="truncate text-[11px] font-bold text-slate-100">{value}</p>
      <p className="mt-0.5 truncate text-[6px] uppercase tracking-[0.06em] text-slate-500">
        {label}
      </p>
    </div>
  );
}

function Metric({
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
      <p className="mt-2 text-lg font-bold text-slate-100">{value}</p>
      <p className="mt-1 text-[7px] text-slate-600">{detail}</p>
    </div>
  );
}

function Insight({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-[#494949] bg-[#292929] p-3">
      <p className="text-[7px] font-bold uppercase tracking-[0.08em] text-[#e8872d]">
        {label}
      </p>
      <p className="mt-2 truncate text-[10px] font-bold text-slate-200">
        {value}
      </p>
      <p className="mt-1 text-[7px] leading-4 text-slate-600">{detail}</p>
    </div>
  );
}

function Head({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="border-b border-[#414141] px-3 py-2.5">
      <p className="text-[7px] font-bold uppercase tracking-[0.08em] text-[#e8872d]">
        {eyebrow}
      </p>
      <p className="mt-1 text-[9px] font-bold text-slate-300">{title}</p>
    </div>
  );
}

function SeverityBlock({
  analysis,
}: {
  analysis: AreaAnalysis;
}) {
  const rows = ["Fatal", "Serious", "Minor"].map((label) => {
    const count = analysis.accidents.filter(
      (a) => a.severity === label,
    ).length;
    return {
      label,
      count,
      share: round(pct(count, analysis.totalAccidents)),
    };
  });

  return (
    <section className="overflow-hidden rounded-md border border-[#494949] bg-[#292929]">
      <Head eyebrow="Selected-area profile" title="Severity distribution" />
      <div className="grid gap-2 p-3 sm:grid-cols-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="rounded border border-[#414141] bg-[#303030] p-3"
          >
            <p className="text-[8px] font-bold text-slate-300">
              {row.label}
            </p>
            <p className="mt-2 text-xl font-bold text-slate-100">
              {row.count}
            </p>
            <p className="mt-1 text-[7px] text-slate-600">
              {row.share}% of selected crashes
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: Row[];
}) {
  return (
    <section className="overflow-hidden rounded-md border border-[#494949] bg-[#292929]">
      <Head eyebrow="Distribution + severity" title={title} />
      {rows.length === 0 ? (
        <div className="p-3 text-[8px] text-slate-600">No records.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[470px] text-left text-[8px]">
            <thead className="bg-[#303030] uppercase tracking-[0.06em] text-slate-600">
              <tr>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Crashes</th>
                <th className="px-3 py-2">Share</th>
                <th className="px-3 py-2">Severe</th>
                <th className="px-3 py-2">Casualties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#202020]">
              {rows.map((row) => (
                <tr key={row.label}>
                  <td className="px-3 py-2 font-semibold text-slate-300">
                    {row.label}
                  </td>
                  <td className="px-3 py-2 text-slate-400">{row.count}</td>
                  <td className="px-3 py-2 text-slate-400">{row.sharePct}%</td>
                  <td className="px-3 py-2 text-slate-400">{row.severeRatePct}%</td>
                  <td className="px-3 py-2 text-slate-400">{row.casualties}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Compare({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 rounded border border-[#414141] bg-[#303030] p-2.5">
      <div>
        <p className="text-[8px] font-semibold text-slate-400">{label}</p>
        <p className="mt-1 text-[7px] text-slate-600">{detail}</p>
      </div>
      <strong className="self-center text-[10px] text-slate-200">
        {value}
      </strong>
    </div>
  );
}

function Geo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[90px_1fr] gap-3 border-t border-[#383838] py-2 first:border-t-0">
      <dt className="text-slate-600">{label}</dt>
      <dd className="m-0 text-right font-mono text-slate-400">{value}</dd>
    </div>
  );
}
