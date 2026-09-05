import type { Accident } from "../types/accident";
import { JunctionService } from "./junctionService";

export interface SceneMapSpatialJunctionRow {
  junctionId: string;
  name: string;
  city: string;
  roadType: string;
  latitude: number;
  longitude: number;
  accidents: number;
  crashSharePct: number;
  severeAccidents: number;
  severeRatePct: number;
  fatalities: number;
  injuries: number;
  casualtiesPerAccident: number;
  riskScore: number;
  riskLevel: "Low" | "Medium" | "High";
  riskContributionPct: number;
  topCause: string;
  topCauseSharePct: number;
  peakTimeBand: string;
  priority: "Immediate review" | "Priority review" | "Monitor" | "Routine";
}

export interface SceneMapSpatialFinding {
  id: string;
  level: "Critical" | "High" | "Moderate" | "Info";
  title: string;
  statement: string;
  evidence: string;
}

export interface SceneMapSpatialModel {
  totalAccidents: number;
  affectedJunctions: number;
  mappedAccidentSharePct: number;
  severeAccidents: number;
  severeRatePct: number;
  fatalities: number;
  injuries: number;
  casualtiesPerAccident: number;
  topJunctionCrashSharePct: number;
  topTwoJunctionCrashSharePct: number;
  topRiskContributionPct: number;
  concentrationIndex: number;
  concentrationLabel: "No data" | "Distributed" | "Moderately concentrated" | "Highly concentrated";
  approximateNetworkSpanKm: number;
  approximateWeightedCentroid: {
    latitude: number;
    longitude: number;
  } | null;
  junctions: SceneMapSpatialJunctionRow[];
  findings: SceneMapSpatialFinding[];
}

const RISK_WEIGHTS = {
  fatality: 10,
  seriousAccident: 5,
  minorAccident: 2,
  injury: 2,
  accident: 1,
} as const;

const TIME_BANDS = [
  { label: "00:00–05:59", start: 0, end: 5 },
  { label: "06:00–09:59", start: 6, end: 9 },
  { label: "10:00–15:59", start: 10, end: 15 },
  { label: "16:00–19:59", start: 16, end: 19 },
  { label: "20:00–23:59", start: 20, end: 23 },
] as const;

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

function riskScore(records: Accident[]): number {
  const fatalities = records.reduce(
    (total, accident) => total + accident.fatalities,
    0,
  );
  const injuries = records.reduce(
    (total, accident) => total + accident.injuries,
    0,
  );
  const serious = records.filter(
    (accident) => accident.severity === "Serious",
  ).length;
  const minor = records.filter(
    (accident) => accident.severity === "Minor",
  ).length;

  return (
    fatalities * RISK_WEIGHTS.fatality +
    serious * RISK_WEIGHTS.seriousAccident +
    minor * RISK_WEIGHTS.minorAccident +
    injuries * RISK_WEIGHTS.injury +
    records.length * RISK_WEIGHTS.accident
  );
}

function riskLevel(score: number): "Low" | "Medium" | "High" {
  if (score >= 25) return "High";
  if (score >= 10) return "Medium";
  return "Low";
}

function topLabel(values: string[]): {
  label: string;
  count: number;
  sharePct: number;
} {
  if (!values.length) {
    return {
      label: "No data",
      count: 0,
      sharePct: 0,
    };
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

  if (!Number.isFinite(hour)) return "Unknown time";

  return (
    TIME_BANDS.find(
      (band) => hour >= band.start && hour <= band.end,
    )?.label ?? "Unknown time"
  );
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const radiusKm = 6371.0088;
  const toRadians = (value: number) => (value * Math.PI) / 180;

  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(deltaLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return radiusKm * c;
}

function networkSpan(
  rows: SceneMapSpatialJunctionRow[],
): number {
  let maximum = 0;

  for (let first = 0; first < rows.length; first += 1) {
    for (let second = first + 1; second < rows.length; second += 1) {
      maximum = Math.max(
        maximum,
        haversineKm(
          rows[first].latitude,
          rows[first].longitude,
          rows[second].latitude,
          rows[second].longitude,
        ),
      );
    }
  }

  return round(maximum, 2);
}

function concentrationLabel(
  index: number,
  count: number,
): SceneMapSpatialModel["concentrationLabel"] {
  if (count === 0) return "No data";
  if (count === 1 || index >= 0.5) return "Highly concentrated";
  if (index >= 0.3) return "Moderately concentrated";
  return "Distributed";
}

function buildFindings(
  model: Omit<SceneMapSpatialModel, "findings">,
): SceneMapSpatialFinding[] {
  if (model.totalAccidents === 0) {
    return [
      {
        id: "no-spatial-sample",
        level: "Info",
        title: "No spatial sample",
        statement: "No accidents match the current map filters.",
        evidence:
          "Broaden the filters to restore a geographic analytical sample.",
      },
    ];
  }

  const findings: SceneMapSpatialFinding[] = [];
  const top = model.junctions[0];

  if (top) {
    findings.push({
      id: "dominant-junction",
      level:
        top.priority === "Immediate review"
          ? "Critical"
          : top.riskLevel === "High"
            ? "High"
            : "Moderate",
      title: "Highest filtered spatial risk",
      statement: `${top.name} contributes ${top.riskContributionPct}% of the filtered weighted junction risk.`,
      evidence: `${top.accidents} crash(es), ${top.severeRatePct}% serious/fatal, ${top.casualtiesPerAccident.toFixed(
        2,
      )} casualties per crash, filtered risk score ${top.riskScore}.`,
    });
  }

  findings.push({
    id: "crash-concentration",
    level:
      model.topJunctionCrashSharePct >= 50
        ? "High"
        : model.topJunctionCrashSharePct >= 30
          ? "Moderate"
          : "Info",
    title: "Crash concentration",
    statement: `The leading junction contains ${model.topJunctionCrashSharePct}% of filtered crashes; the leading two contain ${model.topTwoJunctionCrashSharePct}%.`,
    evidence: `Concentration index ${model.concentrationIndex.toFixed(
      3,
    )} (${model.concentrationLabel.toLowerCase()}).`,
  });

  const severeHotspot = [...model.junctions]
    .filter((row) => row.accidents >= 2)
    .sort(
      (left, right) =>
        right.severeRatePct - left.severeRatePct ||
        right.riskScore - left.riskScore,
    )[0];

  if (severeHotspot && severeHotspot.severeRatePct > model.severeRatePct) {
    findings.push({
      id: "severity-hotspot",
      level:
        severeHotspot.severeRatePct - model.severeRatePct >= 30
          ? "High"
          : "Moderate",
      title: "Severity hotspot",
      statement: `${severeHotspot.name} has a ${severeHotspot.severeRatePct}% severe-outcome share, above the filtered network average of ${model.severeRatePct}%.`,
      evidence: `${severeHotspot.severeAccidents} serious/fatal crash(es) from ${severeHotspot.accidents} recorded crash(es).`,
    });
  }

  const recurringCause = [...model.junctions]
    .filter((row) => row.accidents >= 2 && row.topCauseSharePct >= 50)
    .sort(
      (left, right) =>
        right.topCauseSharePct - left.topCauseSharePct ||
        right.accidents - left.accidents,
    )[0];

  if (recurringCause) {
    findings.push({
      id: "cause-cluster",
      level:
        recurringCause.topCauseSharePct >= 65 ? "High" : "Moderate",
      title: "Recurring cause cluster",
      statement: `${recurringCause.topCause} accounts for ${recurringCause.topCauseSharePct}% of filtered crashes at ${recurringCause.name}.`,
      evidence: `This is a recorded concentration at one mapped junction, not proof of causation.`,
    });
  }

  const topTime = topLabel(
    model.junctions.flatMap((row) =>
      Array.from({ length: row.accidents }, () => row.peakTimeBand),
    ),
  );

  if (topTime.count > 0) {
    findings.push({
      id: "time-cluster",
      level: topTime.sharePct >= 50 ? "Moderate" : "Info",
      title: "Spatial time pattern",
      statement: `${topTime.label} is the most common peak time band across affected junction summaries.`,
      evidence: `This describes junction-level peak bands, not exact-event spatial coordinates.`,
    });
  }

  if (model.approximateWeightedCentroid) {
    findings.push({
      id: "spatial-extent",
      level: "Info",
      title: "Approximate geographic footprint",
      statement: `Affected junctions span approximately ${model.approximateNetworkSpanKm.toFixed(
        2,
      )} km in the filtered sample.`,
      evidence: `Junction-weighted crash centroid ≈ ${model.approximateWeightedCentroid.latitude.toFixed(
        5,
      )}, ${model.approximateWeightedCentroid.longitude.toFixed(5)}.`,
    });
  }

  return findings.slice(0, 6);
}

export const SceneMapSpatialAnalysisService = {
  analyse(records: Accident[]): SceneMapSpatialModel {
    const junctions = JunctionService.getAll();
    const mappedIds = new Set(junctions.map((junction) => junction.id));
    const mappedRecords = records.filter((accident) =>
      mappedIds.has(accident.junctionId),
    );

    const groupedRows = junctions
      .map((junction) => {
        const group = mappedRecords.filter(
          (accident) => accident.junctionId === junction.id,
        );

        if (!group.length) return null;

        const score = riskScore(group);
        const severeAccidents = group.filter(isSevere).length;
        const fatalities = group.reduce(
          (total, accident) => total + accident.fatalities,
          0,
        );
        const injuries = group.reduce(
          (total, accident) => total + accident.injuries,
          0,
        );
        const cause = topLabel(group.map((accident) => accident.cause));
        const peak = topLabel(group.map(timeBand));
        const severeRatePct = round(pct(severeAccidents, group.length));
        const level = riskLevel(score);

        const priority: SceneMapSpatialJunctionRow["priority"] =
          level === "High" &&
          (fatalities > 0 || severeRatePct >= 50 || score / group.length >= 10)
            ? "Immediate review"
            : level === "High"
              ? "Priority review"
              : level === "Medium"
                ? "Monitor"
                : "Routine";

        return {
          junctionId: junction.id,
          name: junction.name,
          city: junction.city,
          roadType: junction.roadType,
          latitude: junction.latitude,
          longitude: junction.longitude,
          accidents: group.length,
          crashSharePct: 0,
          severeAccidents,
          severeRatePct,
          fatalities,
          injuries,
          casualtiesPerAccident: round(
            (fatalities + injuries) / group.length,
            2,
          ),
          riskScore: score,
          riskLevel: level,
          riskContributionPct: 0,
          topCause: cause.label,
          topCauseSharePct: cause.sharePct,
          peakTimeBand: peak.label,
          priority,
        } satisfies SceneMapSpatialJunctionRow;
      })
      .filter(
        (row): row is SceneMapSpatialJunctionRow => row !== null,
      );

    const totalRiskScore = groupedRows.reduce(
      (total, row) => total + row.riskScore,
      0,
    );

    const rows = groupedRows
      .map((row) => ({
        ...row,
        crashSharePct: round(pct(row.accidents, mappedRecords.length)),
        riskContributionPct: round(
          pct(row.riskScore, totalRiskScore),
        ),
      }))
      .sort(
        (left, right) =>
          right.riskScore - left.riskScore ||
          right.accidents - left.accidents,
      );

    const severeAccidents = mappedRecords.filter(isSevere).length;
    const fatalities = mappedRecords.reduce(
      (total, accident) => total + accident.fatalities,
      0,
    );
    const injuries = mappedRecords.reduce(
      (total, accident) => total + accident.injuries,
      0,
    );

    const shares = rows.map(
      (row) => row.accidents / Math.max(1, mappedRecords.length),
    );
    const concentrationIndex = round(
      shares.reduce((total, share) => total + share ** 2, 0),
      3,
    );

    const topTwoJunctionCrashSharePct = round(
      rows
        .slice(0, 2)
        .reduce((total, row) => total + row.crashSharePct, 0),
    );

    const weightedCentroid =
      mappedRecords.length > 0
        ? {
            latitude:
              rows.reduce(
                (total, row) => total + row.latitude * row.accidents,
                0,
              ) / mappedRecords.length,
            longitude:
              rows.reduce(
                (total, row) => total + row.longitude * row.accidents,
                0,
              ) / mappedRecords.length,
          }
        : null;

    const modelWithoutFindings: Omit<
      SceneMapSpatialModel,
      "findings"
    > = {
      totalAccidents: mappedRecords.length,
      affectedJunctions: rows.length,
      mappedAccidentSharePct: round(
        pct(mappedRecords.length, records.length),
      ),
      severeAccidents,
      severeRatePct: round(pct(severeAccidents, mappedRecords.length)),
      fatalities,
      injuries,
      casualtiesPerAccident: round(
        (fatalities + injuries) / Math.max(1, mappedRecords.length),
        2,
      ),
      topJunctionCrashSharePct: rows[0]?.crashSharePct ?? 0,
      topTwoJunctionCrashSharePct,
      topRiskContributionPct: rows[0]?.riskContributionPct ?? 0,
      concentrationIndex,
      concentrationLabel: concentrationLabel(
        concentrationIndex,
        rows.length,
      ),
      approximateNetworkSpanKm: networkSpan(rows),
      approximateWeightedCentroid: weightedCentroid
        ? {
            latitude: round(weightedCentroid.latitude, 6),
            longitude: round(weightedCentroid.longitude, 6),
          }
        : null,
      junctions: rows,
    };

    return {
      ...modelWithoutFindings,
      findings: buildFindings(modelWithoutFindings),
    };
  },
};
