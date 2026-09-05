import type { Accident } from "../types/accident";
import type { Junction } from "../types/junction";
import { AccidentService } from "./accidentService";
import { JunctionService } from "./junctionService";

export type AnalyticsSeverityFilter = "All" | Accident["severity"];

export interface AnalyticsFilters {
  junctionId: string;
  severity: AnalyticsSeverityFilter;
  cause: string;
  weather: string;
  startDate: string;
  endDate: string;
}

export interface AnalyticsDistributionRow {
  label: string;
  accidents: number;
  sharePct: number;
  severeAccidents: number;
  severeRatePct: number;
  fatalities: number;
  injuries: number;
  casualtiesPerAccident: number;
  severityIndex: number;
  severeRateDeltaPct: number;
}

export interface AnalyticsTimeRow extends AnalyticsDistributionRow {
  order: number;
}

export interface AnalyticsMonthlyRow {
  key: string;
  label: string;
  accidents: number;
  severeAccidents: number;
  casualties: number;
}

export interface AnalyticsJunctionRow {
  id: string;
  name: string;
  city: string;
  roadType: string;
  accidents: number;
  fatalities: number;
  injuries: number;
  severeAccidents: number;
  severeRatePct: number;
  casualtiesPerAccident: number;
  severityIndex: number;
  riskScore: number;
  riskScorePerAccident: number;
  riskLevel: "Low" | "Medium" | "High";
  riskBreakdown: {
    fatalitiesScore: number;
    seriousAccidentsScore: number;
    minorAccidentsScore: number;
    injuriesScore: number;
    totalAccidentsScore: number;
  };
  topCause: string;
  topCauseCount: number;
  topCauseSharePct: number;
  peakTimeBand: string;
  priority: "Immediate review" | "Priority review" | "Monitor" | "Routine";
}

export interface AnalyticsPatternFinding {
  id: string;
  level: "Critical" | "High" | "Moderate" | "Info";
  title: string;
  statement: string;
  evidence: string;
  basis: "Deterministic";
}

export interface AnalyticsComparablePeriod {
  latestYear: number | null;
  previousYear: number | null;
  cutoffLabel: string;
  latestAccidents: number;
  previousAccidents: number;
  accidentChangePct: number | null;
  latestSevere: number;
  previousSevere: number;
  severeChangePct: number | null;
  latestCasualties: number;
  previousCasualties: number;
  casualtyChangePct: number | null;
  comparable: boolean;
}

export interface AnalyticsModel {
  totalDatasetAccidents: number;
  filteredAccidents: Accident[];
  filters: AnalyticsFilters;
  filterOptions: {
    junctions: Junction[];
    causes: string[];
    weather: string[];
  };
  dataSufficiency: {
    label: "No data" | "Very limited" | "Limited" | "Moderate" | "Stronger";
    description: string;
  };
  kpis: {
    totalAccidents: number;
    severeAccidents: number;
    severeRatePct: number;
    fatalities: number;
    injuries: number;
    casualties: number;
    casualtiesPerAccident: number;
    averageVehicles: number;
    multiVehicleAccidents: number;
    multiVehicleRatePct: number;
    severityIndex: number;
  };
  monthly: AnalyticsMonthlyRow[];
  causes: AnalyticsDistributionRow[];
  weather: AnalyticsDistributionRow[];
  dayOfWeek: AnalyticsTimeRow[];
  timeBands: AnalyticsTimeRow[];
  junctions: AnalyticsJunctionRow[];
  comparablePeriod: AnalyticsComparablePeriod;
  findings: AnalyticsPatternFinding[];
  matrices: {
    causeSeverity: Array<{
      cause: string;
      minor: number;
      serious: number;
      fatal: number;
      total: number;
    }>;
    weatherSeverity: Array<{
      weather: string;
      minor: number;
      serious: number;
      fatal: number;
      total: number;
    }>;
  };
}

const SEVERITY_WEIGHTS: Record<Accident["severity"], number> = {
  Minor: 1,
  Serious: 3,
  Fatal: 5,
};

const RISK_WEIGHTS = {
  fatality: 10,
  seriousAccident: 5,
  minorAccident: 2,
  injury: 2,
  accident: 1,
} as const;

const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const TIME_BANDS = [
  { label: "00:00–05:59", start: 0, end: 5, order: 0 },
  { label: "06:00–09:59", start: 6, end: 9, order: 1 },
  { label: "10:00–15:59", start: 10, end: 15, order: 2 },
  { label: "16:00–19:59", start: 16, end: 19, order: 3 },
  { label: "20:00–23:59", start: 20, end: 23, order: 4 },
] as const;

function pct(numerator: number, denominator: number): number {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function casualties(accident: Accident): number {
  return accident.fatalities + accident.injuries;
}

function isSevere(accident: Accident): boolean {
  return accident.severity === "Serious" || accident.severity === "Fatal";
}

function severityIndex(records: Accident[]): number {
  if (!records.length) return 0;
  return round(
    records.reduce(
      (total, accident) => total + SEVERITY_WEIGHTS[accident.severity],
      0,
    ) / records.length,
    2,
  );
}

function dateValue(date: string): number {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function monthKey(date: string): string {
  return date.slice(0, 7);
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function hourOf(accident: Accident): number {
  const hour = Number(accident.time.split(":")[0]);
  return Number.isFinite(hour) ? hour : -1;
}

function filterRecords(
  records: Accident[],
  filters: AnalyticsFilters,
): Accident[] {
  const start = filters.startDate ? dateValue(filters.startDate) : null;
  const end = filters.endDate ? dateValue(filters.endDate) : null;

  return records.filter((accident) => {
    if (filters.junctionId && accident.junctionId !== filters.junctionId) {
      return false;
    }
    if (filters.severity !== "All" && accident.severity !== filters.severity) {
      return false;
    }
    if (filters.cause && accident.cause !== filters.cause) {
      return false;
    }
    if (filters.weather && accident.weather !== filters.weather) {
      return false;
    }

    const date = dateValue(accident.date);
    if (start !== null && date < start) return false;
    if (end !== null && date > end) return false;

    return true;
  });
}

function buildDistribution(
  records: Accident[],
  getLabel: (accident: Accident) => string,
  overallSevereRate: number,
): AnalyticsDistributionRow[] {
  const groups = new Map<string, Accident[]>();

  records.forEach((accident) => {
    const label = getLabel(accident) || "Unknown";
    const current = groups.get(label) ?? [];
    current.push(accident);
    groups.set(label, current);
  });

  return Array.from(groups.entries())
    .map(([label, group]) => {
      const severeAccidents = group.filter(isSevere).length;
      const fatalities = group.reduce(
        (total, accident) => total + accident.fatalities,
        0,
      );
      const injuries = group.reduce(
        (total, accident) => total + accident.injuries,
        0,
      );
      const severeRatePct = pct(severeAccidents, group.length);

      return {
        label,
        accidents: group.length,
        sharePct: round(pct(group.length, records.length)),
        severeAccidents,
        severeRatePct: round(severeRatePct),
        fatalities,
        injuries,
        casualtiesPerAccident: round(
          (fatalities + injuries) / Math.max(1, group.length),
          2,
        ),
        severityIndex: severityIndex(group),
        severeRateDeltaPct: round(severeRatePct - overallSevereRate),
      };
    })
    .sort(
      (left, right) =>
        right.accidents - left.accidents ||
        right.severeRatePct - left.severeRatePct,
    );
}

function getTimeBand(accident: Accident): (typeof TIME_BANDS)[number] | null {
  const hour = hourOf(accident);
  return (
    TIME_BANDS.find((band) => hour >= band.start && hour <= band.end) ?? null
  );
}

function riskFor(records: Accident[]) {
  const fatalAccidents = records.filter(
    (accident) => accident.severity === "Fatal",
  ).length;
  const seriousAccidents = records.filter(
    (accident) => accident.severity === "Serious",
  ).length;
  const minorAccidents = records.filter(
    (accident) => accident.severity === "Minor",
  ).length;
  const fatalities = records.reduce(
    (total, accident) => total + accident.fatalities,
    0,
  );
  const injuries = records.reduce(
    (total, accident) => total + accident.injuries,
    0,
  );

  const breakdown = {
    fatalitiesScore: fatalities * RISK_WEIGHTS.fatality,
    seriousAccidentsScore:
      seriousAccidents * RISK_WEIGHTS.seriousAccident,
    minorAccidentsScore: minorAccidents * RISK_WEIGHTS.minorAccident,
    injuriesScore: injuries * RISK_WEIGHTS.injury,
    totalAccidentsScore: records.length * RISK_WEIGHTS.accident,
  };

  const score = Object.values(breakdown).reduce(
    (total, value) => total + value,
    0,
  );

  return {
    score,
    level: score >= 25 ? ("High" as const) : score >= 10 ? ("Medium" as const) : ("Low" as const),
    breakdown,
    fatalAccidents,
    seriousAccidents,
    minorAccidents,
    fatalities,
    injuries,
  };
}

function buildJunctionRows(
  records: Accident[],
  junctions: Junction[],
): AnalyticsJunctionRow[] {
  return junctions
    .map((junction) => {
      const group = records.filter(
        (accident) => accident.junctionId === junction.id,
      );

      if (!group.length) return null;

      const risk = riskFor(group);
      const severeAccidents = group.filter(isSevere).length;
      const causeRows = buildDistribution(
        group,
        (accident) => accident.cause,
        pct(severeAccidents, group.length),
      );
      const timeRows = buildDistribution(
        group,
        (accident) => getTimeBand(accident)?.label ?? "Unknown time",
        pct(severeAccidents, group.length),
      );

      const topCause = causeRows[0];
      const peakTime = timeRows[0];

      const severeRatePct = pct(severeAccidents, group.length);
      const riskScorePerAccident = risk.score / group.length;

      const priority: AnalyticsJunctionRow["priority"] =
        risk.level === "High" &&
        (risk.fatalities > 0 || severeRatePct >= 50 || riskScorePerAccident >= 10)
          ? "Immediate review"
          : risk.level === "High"
            ? "Priority review"
            : risk.level === "Medium"
              ? "Monitor"
              : "Routine";

      return {
        id: junction.id,
        name: junction.name,
        city: junction.city,
        roadType: junction.roadType,
        accidents: group.length,
        fatalities: risk.fatalities,
        injuries: risk.injuries,
        severeAccidents,
        severeRatePct: round(severeRatePct),
        casualtiesPerAccident: round(
          (risk.fatalities + risk.injuries) / group.length,
          2,
        ),
        severityIndex: severityIndex(group),
        riskScore: risk.score,
        riskScorePerAccident: round(riskScorePerAccident, 2),
        riskLevel: risk.level,
        riskBreakdown: risk.breakdown,
        topCause: topCause?.label ?? "No cause",
        topCauseCount: topCause?.accidents ?? 0,
        topCauseSharePct: topCause?.sharePct ?? 0,
        peakTimeBand: peakTime?.label ?? "No time pattern",
        priority,
      } satisfies AnalyticsJunctionRow;
    })
    .filter((row): row is AnalyticsJunctionRow => row !== null)
    .sort(
      (left, right) =>
        right.riskScore - left.riskScore ||
        right.severeRatePct - left.severeRatePct,
    );
}

function comparablePeriod(records: Accident[]): AnalyticsComparablePeriod {
  if (!records.length) {
    return {
      latestYear: null,
      previousYear: null,
      cutoffLabel: "No data",
      latestAccidents: 0,
      previousAccidents: 0,
      accidentChangePct: null,
      latestSevere: 0,
      previousSevere: 0,
      severeChangePct: null,
      latestCasualties: 0,
      previousCasualties: 0,
      casualtyChangePct: null,
      comparable: false,
    };
  }

  const years = Array.from(
    new Set(
      records
        .map((record) => Number(record.date.slice(0, 4)))
        .filter(Number.isFinite),
    ),
  ).sort((a, b) => a - b);

  const latestYear = years.length ? years[years.length - 1] : null;
  const previousYear = latestYear === null ? null : latestYear - 1;

  if (latestYear === null || previousYear === null) {
    return {
      latestYear,
      previousYear,
      cutoffLabel: "No comparable period",
      latestAccidents: 0,
      previousAccidents: 0,
      accidentChangePct: null,
      latestSevere: 0,
      previousSevere: 0,
      severeChangePct: null,
      latestCasualties: 0,
      previousCasualties: 0,
      casualtyChangePct: null,
      comparable: false,
    };
  }

  const latestYearRows = records.filter(
    (record) => Number(record.date.slice(0, 4)) === latestYear,
  );

  if (!latestYearRows.length) {
    return {
      latestYear,
      previousYear,
      cutoffLabel: "No comparable period",
      latestAccidents: 0,
      previousAccidents: 0,
      accidentChangePct: null,
      latestSevere: 0,
      previousSevere: 0,
      severeChangePct: null,
      latestCasualties: 0,
      previousCasualties: 0,
      casualtyChangePct: null,
      comparable: false,
    };
  }

  const cutoffCandidates = latestYearRows
    .map((record) => record.date.slice(5))
    .sort();
  const cutoffMonthDay =
    cutoffCandidates.length > 0
      ? cutoffCandidates[cutoffCandidates.length - 1]
      : "12-31";

  const latest = records.filter(
    (record) =>
      Number(record.date.slice(0, 4)) === latestYear &&
      record.date.slice(5) <= cutoffMonthDay,
  );

  const previous = records.filter(
    (record) =>
      Number(record.date.slice(0, 4)) === previousYear &&
      record.date.slice(5) <= cutoffMonthDay,
  );

  const latestSevere = latest.filter(isSevere).length;
  const previousSevere = previous.filter(isSevere).length;
  const latestCasualties = latest.reduce(
    (total, accident) => total + casualties(accident),
    0,
  );
  const previousCasualties = previous.reduce(
    (total, accident) => total + casualties(accident),
    0,
  );

  const change = (latestValue: number, previousValue: number): number | null =>
    previousValue > 0
      ? round(((latestValue - previousValue) / previousValue) * 100)
      : null;

  const [month, day] = cutoffMonthDay.split("-").map(Number);
  const cutoffLabel =
    month && day
      ? new Intl.DateTimeFormat(undefined, {
          month: "short",
          day: "numeric",
        }).format(new Date(latestYear, month - 1, day))
      : cutoffMonthDay;

  return {
    latestYear,
    previousYear,
    cutoffLabel,
    latestAccidents: latest.length,
    previousAccidents: previous.length,
    accidentChangePct: change(latest.length, previous.length),
    latestSevere,
    previousSevere,
    severeChangePct: change(latestSevere, previousSevere),
    latestCasualties,
    previousCasualties,
    casualtyChangePct: change(latestCasualties, previousCasualties),
    comparable: previous.length > 0,
  };
}

function dataSufficiency(count: number): AnalyticsModel["dataSufficiency"] {
  if (count === 0) {
    return {
      label: "No data",
      description: "No records match the current filters.",
    };
  }
  if (count < 10) {
    return {
      label: "Very limited",
      description:
        "Use patterns only as descriptive signals; the filtered sample is very small.",
    };
  }
  if (count < 30) {
    return {
      label: "Limited",
      description:
        "Useful for descriptive pattern detection, but too small for strong statistical claims.",
    };
  }
  if (count < 100) {
    return {
      label: "Moderate",
      description:
        "Enough records for more stable descriptive comparisons, still without exposure adjustment.",
    };
  }
  return {
    label: "Stronger",
    description:
      "Larger descriptive sample, but causal or rate claims still require suitable exposure and study design.",
  };
}

function buildFindings(
  model: Omit<AnalyticsModel, "findings">,
): AnalyticsPatternFinding[] {
  const findings: AnalyticsPatternFinding[] = [];
  const n = model.kpis.totalAccidents;

  if (!n) {
    return [
      {
        id: "no-data",
        level: "Info",
        title: "No analytical sample",
        statement: "The current filters return no accident records.",
        evidence: "Adjust the date, junction, severity, cause or weather filters.",
        basis: "Deterministic",
      },
    ];
  }

  const topJunction = model.junctions[0];
  if (topJunction) {
    findings.push({
      id: "top-risk-junction",
      level:
        topJunction.priority === "Immediate review"
          ? "Critical"
          : topJunction.riskLevel === "High"
            ? "High"
            : "Moderate",
      title: "Highest weighted junction risk",
      statement: `${topJunction.name} ranks first in the current filtered sample with a weighted risk score of ${topJunction.riskScore}.`,
      evidence: `${topJunction.accidents} crash(es), ${topJunction.severeAccidents} serious/fatal, ${topJunction.fatalities} fatality/fatalities, ${topJunction.injuries} injury/injuries; ${topJunction.riskScorePerAccident} risk points per crash.`,
      basis: "Deterministic",
    });
  }

  const topCause = model.causes[0];
  if (topCause) {
    findings.push({
      id: "cause-concentration",
      level: topCause.sharePct >= 30 ? "High" : "Moderate",
      title: "Leading recorded cause",
      statement: `${topCause.label} accounts for ${topCause.sharePct}% of crashes in the current sample.`,
      evidence: `${topCause.accidents} crash(es); severe-outcome rate ${topCause.severeRatePct}% (${topCause.severeRateDeltaPct >= 0 ? "+" : ""}${topCause.severeRateDeltaPct} percentage points versus the filtered average).`,
      basis: "Deterministic",
    });
  }

  const elevatedCause = model.causes
    .filter((row) => row.accidents >= 2)
    .sort(
      (left, right) =>
        right.severeRateDeltaPct - left.severeRateDeltaPct ||
        right.accidents - left.accidents,
    )[0];

  if (elevatedCause && elevatedCause.severeRateDeltaPct >= 15) {
    findings.push({
      id: "severity-uplift-cause",
      level: elevatedCause.severeRateDeltaPct >= 30 ? "High" : "Moderate",
      title: "Cause associated with elevated severity",
      statement: `${elevatedCause.label} has a severe-outcome rate ${elevatedCause.severeRateDeltaPct} percentage points above the filtered average.`,
      evidence: `${elevatedCause.severeAccidents} severe crash(es) out of ${elevatedCause.accidents}; casualty intensity ${elevatedCause.casualtiesPerAccident} per crash.`,
      basis: "Deterministic",
    });
  }

  const peakTime = [...model.timeBands].sort(
    (left, right) => right.accidents - left.accidents,
  )[0];

  if (peakTime) {
    findings.push({
      id: "time-concentration",
      level: peakTime.sharePct >= 35 ? "High" : "Moderate",
      title: "Time-of-day concentration",
      statement: `${peakTime.label} contains the largest share of crashes at ${peakTime.sharePct}%.`,
      evidence: `${peakTime.accidents} crash(es), severe-outcome rate ${peakTime.severeRatePct}%, severity index ${peakTime.severityIndex}/5.`,
      basis: "Deterministic",
    });
  }

  const weatherRisk = model.weather
    .filter((row) => row.accidents >= 2)
    .sort(
      (left, right) =>
        right.severeRateDeltaPct - left.severeRateDeltaPct ||
        right.casualtiesPerAccident - left.casualtiesPerAccident,
    )[0];

  if (weatherRisk && weatherRisk.severeRateDeltaPct > 0) {
    findings.push({
      id: "weather-severity",
      level: weatherRisk.severeRateDeltaPct >= 25 ? "High" : "Moderate",
      title: "Weather severity signal",
      statement: `${weatherRisk.label} records show a severe-outcome rate ${weatherRisk.severeRateDeltaPct} percentage points above the filtered average.`,
      evidence: `${weatherRisk.accidents} crash(es), ${weatherRisk.fatalities + weatherRisk.injuries} casualty/casualties, severity index ${weatherRisk.severityIndex}/5.`,
      basis: "Deterministic",
    });
  }

  if (
    model.comparablePeriod.comparable &&
    model.comparablePeriod.accidentChangePct !== null
  ) {
    const change = model.comparablePeriod.accidentChangePct;
    findings.push({
      id: "comparable-period",
      level: Math.abs(change) >= 25 ? "High" : "Info",
      title: "Comparable-period change",
      statement: `Recorded crashes are ${Math.abs(change)}% ${change >= 0 ? "higher" : "lower"} in ${model.comparablePeriod.latestYear} through ${model.comparablePeriod.cutoffLabel} than in the same period of ${model.comparablePeriod.previousYear}.`,
      evidence: `${model.comparablePeriod.latestAccidents} versus ${model.comparablePeriod.previousAccidents} crash(es). This is a count comparison, not an exposure-adjusted crash rate.`,
      basis: "Deterministic",
    });
  }

  if (model.kpis.multiVehicleAccidents > 0) {
    findings.push({
      id: "multi-vehicle",
      level: model.kpis.multiVehicleRatePct >= 25 ? "Moderate" : "Info",
      title: "Three-or-more-vehicle involvement",
      statement: `${model.kpis.multiVehicleRatePct}% of crashes involved at least three vehicles.`,
      evidence: `${model.kpis.multiVehicleAccidents} of ${model.kpis.totalAccidents} crash(es).`,
      basis: "Deterministic",
    });
  }

  return findings.slice(0, 7);
}

function buildSeverityMatrix(
  records: Accident[],
  getLabel: (accident: Accident) => string,
  keyName: "cause" | "weather",
) {
  const groups = new Map<
    string,
    { minor: number; serious: number; fatal: number; total: number }
  >();

  records.forEach((accident) => {
    const label = getLabel(accident) || "Unknown";
    const row = groups.get(label) ?? {
      minor: 0,
      serious: 0,
      fatal: 0,
      total: 0,
    };

    if (accident.severity === "Minor") row.minor += 1;
    if (accident.severity === "Serious") row.serious += 1;
    if (accident.severity === "Fatal") row.fatal += 1;
    row.total += 1;
    groups.set(label, row);
  });

  return Array.from(groups.entries())
    .map(([label, values]) => ({
      [keyName]: label,
      ...values,
    }))
    .sort((a, b) => b.total - a.total);
}

export const AnalyticsAnalysisService = {
  emptyFilters(): AnalyticsFilters {
    return {
      junctionId: "",
      severity: "All",
      cause: "",
      weather: "",
      startDate: "",
      endDate: "",
    };
  },

  analyse(filters: AnalyticsFilters): AnalyticsModel {
    const allAccidents = AccidentService.getAll();
    const allJunctions = JunctionService.getAll();
    const records = filterRecords(allAccidents, filters);

    const severeAccidents = records.filter(isSevere).length;
    const severeRate = pct(severeAccidents, records.length);
    const fatalities = records.reduce(
      (total, accident) => total + accident.fatalities,
      0,
    );
    const injuries = records.reduce(
      (total, accident) => total + accident.injuries,
      0,
    );
    const multiVehicleAccidents = records.filter(
      (accident) => accident.vehiclesInvolved >= 3,
    ).length;

    const causes = buildDistribution(
      records,
      (accident) => accident.cause,
      severeRate,
    );
    const weather = buildDistribution(
      records,
      (accident) => accident.weather,
      severeRate,
    );

    const dayGroups = new Map<number, Accident[]>();
    records.forEach((accident) => {
      const date = new Date(`${accident.date}T00:00:00`);
      if (Number.isNaN(date.getTime())) return;
      const day = date.getDay();
      const current = dayGroups.get(day) ?? [];
      current.push(accident);
      dayGroups.set(day, current);
    });

    const dayOfWeek: AnalyticsTimeRow[] = DAY_LABELS.map((label, order) => {
      const group = dayGroups.get(order) ?? [];
      const severe = group.filter(isSevere).length;
      const groupFatalities = group.reduce(
        (total, accident) => total + accident.fatalities,
        0,
      );
      const groupInjuries = group.reduce(
        (total, accident) => total + accident.injuries,
        0,
      );
      const rate = pct(severe, group.length);

      return {
        label,
        order,
        accidents: group.length,
        sharePct: round(pct(group.length, records.length)),
        severeAccidents: severe,
        severeRatePct: round(rate),
        fatalities: groupFatalities,
        injuries: groupInjuries,
        casualtiesPerAccident: round(
          (groupFatalities + groupInjuries) / Math.max(1, group.length),
          2,
        ),
        severityIndex: severityIndex(group),
        severeRateDeltaPct: round(rate - severeRate),
      };
    });

    const timeBands: AnalyticsTimeRow[] = TIME_BANDS.map((band) => {
      const group = records.filter(
        (accident) => getTimeBand(accident)?.label === band.label,
      );
      const severe = group.filter(isSevere).length;
      const groupFatalities = group.reduce(
        (total, accident) => total + accident.fatalities,
        0,
      );
      const groupInjuries = group.reduce(
        (total, accident) => total + accident.injuries,
        0,
      );
      const rate = pct(severe, group.length);

      return {
        label: band.label,
        order: band.order,
        accidents: group.length,
        sharePct: round(pct(group.length, records.length)),
        severeAccidents: severe,
        severeRatePct: round(rate),
        fatalities: groupFatalities,
        injuries: groupInjuries,
        casualtiesPerAccident: round(
          (groupFatalities + groupInjuries) / Math.max(1, group.length),
          2,
        ),
        severityIndex: severityIndex(group),
        severeRateDeltaPct: round(rate - severeRate),
      };
    });

    const monthlyMap = new Map<string, Accident[]>();
    records.forEach((accident) => {
      const key = monthKey(accident.date);
      const current = monthlyMap.get(key) ?? [];
      current.push(accident);
      monthlyMap.set(key, current);
    });

    const monthly: AnalyticsMonthlyRow[] = Array.from(monthlyMap.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, group]) => ({
        key,
        label: monthLabel(key),
        accidents: group.length,
        severeAccidents: group.filter(isSevere).length,
        casualties: group.reduce(
          (total, accident) => total + casualties(accident),
          0,
        ),
      }));

    const modelWithoutFindings: Omit<AnalyticsModel, "findings"> = {
      totalDatasetAccidents: allAccidents.length,
      filteredAccidents: records,
      filters,
      filterOptions: {
        junctions: allJunctions,
        causes: Array.from(new Set(allAccidents.map((accident) => accident.cause))).sort(),
        weather: Array.from(new Set(allAccidents.map((accident) => accident.weather))).sort(),
      },
      dataSufficiency: dataSufficiency(records.length),
      kpis: {
        totalAccidents: records.length,
        severeAccidents,
        severeRatePct: round(severeRate),
        fatalities,
        injuries,
        casualties: fatalities + injuries,
        casualtiesPerAccident: round(
          (fatalities + injuries) / Math.max(1, records.length),
          2,
        ),
        averageVehicles: round(
          records.reduce(
            (total, accident) => total + accident.vehiclesInvolved,
            0,
          ) / Math.max(1, records.length),
          2,
        ),
        multiVehicleAccidents,
        multiVehicleRatePct: round(
          pct(multiVehicleAccidents, records.length),
        ),
        severityIndex: severityIndex(records),
      },
      monthly,
      causes,
      weather,
      dayOfWeek,
      timeBands,
      junctions: buildJunctionRows(records, allJunctions),
      comparablePeriod: comparablePeriod(records),
      matrices: {
        causeSeverity: buildSeverityMatrix(
          records,
          (accident) => accident.cause,
          "cause",
        ) as AnalyticsModel["matrices"]["causeSeverity"],
        weatherSeverity: buildSeverityMatrix(
          records,
          (accident) => accident.weather,
          "weather",
        ) as AnalyticsModel["matrices"]["weatherSeverity"],
      },
    };

    return {
      ...modelWithoutFindings,
      findings: buildFindings(modelWithoutFindings),
    };
  },
};
