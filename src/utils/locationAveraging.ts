import type {
  AveragedLocationResult,
  GeoCoordinate,
  RejectedGeoCoordinate,
} from "../types/fieldPlacement";
import {
  coordinateToLocalMetres,
  localOffsetToCoordinate,
} from "./geographicCoordinates";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function isValidCoordinate(sample: GeoCoordinate): boolean {
  return (
    Number.isFinite(sample.latitude) &&
    Number.isFinite(sample.longitude) &&
    Number.isFinite(sample.accuracyMetres) &&
    sample.latitude >= -90 &&
    sample.latitude <= 90 &&
    sample.longitude >= -180 &&
    sample.longitude <= 180
  );
}

export function averageGeoCoordinates(
  samples: GeoCoordinate[],
): AveragedLocationResult {
  if (samples.length === 0) {
    throw new Error("No location samples were collected.");
  }

  const validSamples = samples.filter(isValidCoordinate);
  if (validSamples.length === 0) {
    throw new Error("The device returned no valid geographic coordinates.");
  }

  const accuracyMedian = median(
    validSamples.map((sample) => Math.max(1, sample.accuracyMetres)),
  );
  const maximumAcceptedAccuracy = Math.min(
    30,
    Math.max(10, accuracyMedian * 2.5),
  );
  const rejectedSamples: RejectedGeoCoordinate[] = [];
  const accepted = validSamples.filter((sample) => {
    if (sample.accuracyMetres <= maximumAcceptedAccuracy) return true;
    rejectedSamples.push({ coordinate: sample, reason: "Poor accuracy" });
    return false;
  });

  samples
    .filter((sample) => !isValidCoordinate(sample))
    .forEach((sample) =>
      rejectedSamples.push({ coordinate: sample, reason: "Invalid coordinate" }),
    );

  const usingAccuracyFallback = accepted.length === 0;
  const usable = usingAccuracyFallback ? validSamples : accepted;
  const finalRejectedSamples = usingAccuracyFallback
    ? rejectedSamples.filter((sample) => sample.reason !== "Poor accuracy")
    : rejectedSamples;
  const origin = usable[0];
  const weighted = usable.reduce(
    (result, sample) => {
      const local = coordinateToLocalMetres(origin, sample);
      const weight = 1 / Math.max(1, sample.accuracyMetres) ** 2;
      result.east += local.eastMetres * weight;
      result.north += local.northMetres * weight;
      result.weight += weight;

      if (sample.altitudeMetres !== null && sample.altitudeMetres !== undefined) {
        result.altitude += sample.altitudeMetres * weight;
        result.altitudeWeight += weight;
      }
      return result;
    },
    { east: 0, north: 0, altitude: 0, altitudeWeight: 0, weight: 0 },
  );

  const eastMetres = weighted.east / weighted.weight;
  const northMetres = weighted.north / weighted.weight;
  const averagedCoordinate = localOffsetToCoordinate(
    origin,
    eastMetres,
    northMetres,
  );
  const offsets = usable.map((sample) => {
    const local = coordinateToLocalMetres(origin, sample);
    return Math.hypot(
      local.eastMetres - eastMetres,
      local.northMetres - northMetres,
    );
  });
  const observedSpreadMetres = Math.sqrt(
    offsets.reduce((sum, offset) => sum + offset * offset, 0) /
      Math.max(1, offsets.length),
  );
  const averageAccuracyMetres =
    usable.reduce((total, sample) => total + sample.accuracyMetres, 0) /
    usable.length;
  const bestAccuracyMetres = Math.min(
    ...usable.map((sample) => sample.accuracyMetres),
  );
  // Browser GPS errors are correlated; avoid claiming 1/sqrt(n) survey precision.
  const estimatedUncertaintyMetres = Math.max(
    bestAccuracyMetres,
    observedSpreadMetres * 2,
    averageAccuracyMetres * 0.65,
  );

  return {
    coordinate: {
      ...averagedCoordinate,
      accuracyMetres: Number(estimatedUncertaintyMetres.toFixed(2)),
      altitudeMetres:
        weighted.altitudeWeight > 0
          ? weighted.altitude / weighted.altitudeWeight
          : null,
      capturedAt: new Date().toISOString(),
    },
    sampleCount: usable.length,
    averageAccuracyMetres: Number(averageAccuracyMetres.toFixed(2)),
    bestAccuracyMetres: Number(bestAccuracyMetres.toFixed(2)),
    rejectedSampleCount: finalRejectedSamples.length,
    observedSpreadMetres: Number(observedSpreadMetres.toFixed(2)),
    estimatedUncertaintyMetres: Number(
      estimatedUncertaintyMetres.toFixed(2),
    ),
    rawSamples: [...samples],
    rejectedSamples: finalRejectedSamples,
  };
}
