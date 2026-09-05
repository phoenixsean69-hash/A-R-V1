import type { AreaAnalysis } from "../../types/areaAnalysis";
import type { Accident } from "../../types/accident";
import type { AccidentHeatmapFilters } from "../../types/heatmap";
import { AccidentFilterService } from "../../services/accidentFilterService";
import { AccidentService } from "../../services/accidentService";

interface AreaAnalysisResultsProps {
  analysis: AreaAnalysis;
  filters?: AccidentHeatmapFilters;
  compact?: boolean;
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function pct(numerator: number, denominator: number): number {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

function isSevere(accident: Accident): boolean {
  return accident.severity === "Serious" || accident.severity === "Fatal";
}

function topLabel(values: string[]): {
  label: string;
  count: number;
  sharePct: number;
} {
  if (!values.length) {
    return { label: "No data", count: 0, sharePct: 0 };
  }

  const counts = new Map<string, number>();

  values.forEach((value) => {
    const label = value.trim() || "Unknown";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  const [label, count] =
    Array.from(counts.entries()).sort(
      (left, right) => right[1] - left[1],
    )[0] ?? ["No data", 0];

  return {
    label,
    count,
    sharePct: round(pct(count, values.length)),
  };
}

function timeBand(accident: Accident): string {
  const hour = Number(accident.time.split(":")[0]);

  if (!Number.isFinite(hour)) return "Unknown";
  if (hour < 6) return "00:00–05:59";
  if (hour < 10) return "06:00–09:59";
  if (hour < 16) return "10:00–15:59";
  if (hour < 20) return "16:00–19:59";
  return "20:00–23:59";
}

function getRiskClasses(
  riskLevel: AreaAnalysis["overallRiskLevel"],
): string {
  switch (riskLevel) {
    case "High":
      return "border-[#713646] bg-[#321722] text-[#e28b9d]";
    case "Medium":
      return "border-[#6d5523] bg-[#241d10] text-[#d9bd78]";
    default:
      return "border-[#494949] bg-[#303030] text-[#c4c4c4]";
  }
}

export default function AreaAnalysisResults({
  analysis,
  filters,
  compact = false,
}: AreaAnalysisResultsProps) {
  const referenceAccidents = filters
    ? AccidentFilterService.filter(
        AccidentService.getAll(),
        filters,
      )
    : AccidentService.getAll();

  const severeAccidents = analysis.accidents.filter(isSevere).length;
  const severeRatePct = round(
    pct(severeAccidents, analysis.totalAccidents),
  );
  const casualties =
    analysis.totalFatalities + analysis.totalInjuries;
  const casualtyIntensity = round(
    casualties / Math.max(1, analysis.totalAccidents),
    2,
  );
  const crashDensity = round(
    analysis.totalAccidents /
      Math.max(0.001, analysis.areaSquareKilometres),
    2,
  );
  const referenceCasualties = referenceAccidents.reduce(
    (total, accident) =>
      total + accident.fatalities + accident.injuries,
    0,
  );
  const selectedCrashShare = round(
    pct(analysis.totalAccidents, referenceAccidents.length),
  );
  const selectedCasualtyShare = round(
    pct(casualties, referenceCasualties),
  );
  const topCause = topLabel(
    analysis.accidents.map((accident) => accident.cause),
  );
  const peakTime = topLabel(
    analysis.accidents.map(timeBand),
  );
  const riskRows = [...analysis.junctionRiskAnalyses].sort(
    (left, right) =>
      right.riskScore - left.riskScore ||
      right.totalAccidents - left.totalAccidents,
  );
  const highestRisk = riskRows[0];
  const highestRiskJunction = highestRisk
    ? analysis.junctions.find(
        (junction) => junction.id === highestRisk.junctionId,
      )
    : undefined;

  if (compact) {
    return (
      <div className="space-y-2.5">
        <div className="grid grid-cols-3 gap-1.5">
          <CompactMetric
            label="Crashes"
            value={analysis.totalAccidents}
          />
          <CompactMetric
            label="Severe"
            value={`${severeRatePct}%`}
          />
          <CompactMetric
            label="Risk avg"
            value={analysis.averageRiskScore}
          />
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <CompactMetric
            label="Casualties/crash"
            value={casualtyIntensity.toFixed(2)}
          />
          <CompactMetric
            label="Crashes/km²"
            value={crashDensity.toFixed(2)}
          />
        </div>

        <div className="rounded border border-[#494949] bg-[#292929] px-2.5 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[7px] uppercase tracking-[0.08em] text-slate-500">
              Overall filtered risk
            </span>
            <span
              className={`rounded border px-1.5 py-0.5 text-[7px] font-bold uppercase ${getRiskClasses(
                analysis.overallRiskLevel,
              )}`}
            >
              {analysis.overallRiskLevel}
            </span>
          </div>
          <p className="mt-1.5 truncate text-[8px] text-slate-400">
            Top cause: {topCause.label} · {topCause.sharePct}%
          </p>
          <p className="mt-1 truncate text-[8px] text-slate-500">
            Peak band: {peakTime.label}
          </p>
        </div>

        <div className="rounded border border-[#494949] bg-[#292929] px-2.5 py-2 text-[7px] leading-4 text-slate-500">
          Selected area contains {selectedCrashShare}% of crashes and{" "}
          {selectedCasualtyShare}% of casualties in the current filter sample.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-slate-300">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#e8872d]">
            Filter-aware spatial analysis
          </p>
          <h3 className="mt-1 text-sm font-bold text-slate-100">
            Selected area diagnostics
          </h3>
          <p className="mt-1 text-[8px] text-slate-500">
            Approx. {analysis.areaSquareKilometres.toFixed(3)} km² · current
            map filters applied
          </p>
        </div>

        <span
          className={`rounded border px-2 py-1 text-[8px] font-bold uppercase tracking-[0.08em] ${getRiskClasses(
            analysis.overallRiskLevel,
          )}`}
        >
          {analysis.overallRiskLevel} risk
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <ResultCard
          label="Filtered crashes"
          value={analysis.totalAccidents}
          detail={`${selectedCrashShare}% of current map sample`}
        />
        <ResultCard
          label="Severe share"
          value={`${severeRatePct}%`}
          detail={`${severeAccidents} serious / fatal`}
        />
        <ResultCard
          label="Casualty intensity"
          value={casualtyIntensity.toFixed(2)}
          detail={`${casualties} casualties`}
        />
        <ResultCard
          label="Descriptive density"
          value={`${crashDensity.toFixed(2)}/km²`}
          detail="Not an exposure-adjusted crash rate"
        />
      </div>

      <div className="grid gap-2 lg:grid-cols-3">
        <InsightCard
          label="Dominant recorded cause"
          value={topCause.label}
          detail={`${topCause.count}/${analysis.totalAccidents} · ${topCause.sharePct}%`}
        />
        <InsightCard
          label="Peak time band"
          value={peakTime.label}
          detail={`${peakTime.count}/${analysis.totalAccidents} filtered crash(es)`}
        />
        <InsightCard
          label="Highest filtered risk junction"
          value={highestRiskJunction?.name ?? "No junction"}
          detail={
            highestRisk
              ? `Score ${highestRisk.riskScore} · ${highestRisk.riskLevel}`
              : "No junction risk contribution"
          }
        />
      </div>

      <div className="rounded-md border border-[#494949] bg-[#292929] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[9px] font-bold text-slate-300">
              Selected-area contribution
            </p>
            <p className="mt-1 text-[8px] text-slate-600">
              Relative to the current filtered map sample
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-[8px]">
            <span className="rounded border border-[#494949] bg-[#303030] px-2 py-1 text-slate-400">
              {selectedCrashShare}% crashes
            </span>
            <span className="rounded border border-[#494949] bg-[#303030] px-2 py-1 text-slate-400">
              {selectedCasualtyShare}% casualties
            </span>
            <span className="rounded border border-[#494949] bg-[#303030] px-2 py-1 text-slate-400">
              {analysis.totalJunctions} junction(s)
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-[#494949] bg-[#292929] p-3">
        <p className="text-[9px] font-bold text-slate-300">
          Junction contribution inside selection
        </p>

        {riskRows.length === 0 ? (
          <p className="mt-3 text-[8px] text-slate-600">
            No monitored junctions fall inside the selected rectangle.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {riskRows.map((risk) => {
              const junction = analysis.junctions.find(
                (item) => item.id === risk.junctionId,
              );

              return (
                <div
                  key={risk.junctionId}
                  className="grid gap-2 rounded border border-[#414141] bg-[#303030] p-2.5 md:grid-cols-[1fr_70px_70px_80px] md:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[8px] font-bold text-slate-300">
                      {junction?.name ?? risk.junctionId}
                    </p>
                    <p className="mt-1 text-[7px] text-slate-600">
                      {junction?.roadType ?? "Mapped junction"}
                    </p>
                  </div>
                  <span className="text-[8px] text-slate-400">
                    {risk.totalAccidents} crash(es)
                  </span>
                  <span className="text-[8px] text-slate-400">
                    score {risk.riskScore}
                  </span>
                  <span
                    className={`w-fit rounded border px-1.5 py-0.5 text-[7px] font-bold ${getRiskClasses(
                      risk.riskLevel,
                    )}`}
                  >
                    {risk.riskLevel}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-md border border-[#6d5523] bg-[#241d10] p-3 text-[8px] leading-4 text-[#bba56f]">
        Spatial interpretation limit: accidents are attached to monitored junction
        IDs, not exact crash GPS points. The selected rectangle therefore includes a
        crash when its junction lies inside the rectangle. Crash density is descriptive
        only and must not be interpreted as an exposure-adjusted crash rate.
      </div>
    </div>
  );
}

function CompactMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded border border-[#494949] bg-[#292929] px-1.5 py-2 text-center">
      <p className="text-[11px] font-bold text-slate-100">{value}</p>
      <p className="mt-0.5 text-[6px] uppercase tracking-[0.06em] text-slate-500">
        {label}
      </p>
    </div>
  );
}

function ResultCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-[#494949] bg-[#303030] p-3">
      <p className="text-[7px] font-bold uppercase tracking-[0.08em] text-slate-600">
        {label}
      </p>
      <p className="mt-2 text-lg font-bold text-slate-100">{value}</p>
      <p className="mt-1 text-[7px] leading-4 text-slate-600">{detail}</p>
    </div>
  );
}

function InsightCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-[#494949] bg-[#303030] p-3">
      <p className="text-[7px] font-bold uppercase tracking-[0.08em] text-slate-600">
        {label}
      </p>
      <p className="mt-2 truncate text-[9px] font-bold text-slate-200" title={value}>
        {value}
      </p>
      <p className="mt-1 text-[7px] leading-4 text-slate-600">{detail}</p>
    </div>
  );
}
