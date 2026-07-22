import type {
  AveragedLocationResult,
  GeoCoordinate,
} from "../types/fieldPlacement";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function averageGeoCoordinates(
  samples: GeoCoordinate[],
): AveragedLocationResult {
  if (samples.length === 0) {
    throw new Error("No location samples were collected.");
  }

  const accuracyMedian = median(
    samples.map((sample) => Math.max(1, sample.accuracyMetres)),
  );
  const maximumAcceptedAccuracy = Math.max(10, accuracyMedian * 2.5);

  let accepted = samples.filter(
    (sample) =>
      Number.isFinite(sample.latitude) &&
      Number.isFinite(sample.longitude) &&
      Number.isFinite(sample.accuracyMetres) &&
      sample.accuracyMetres <= maximumAcceptedAccuracy,
  );

  if (accepted.length === 0) accepted = samples;

  const weighted = accepted.reduce(
    (result, sample) => {
      const weight = 1 / Math.max(1, sample.accuracyMetres) ** 2;
      result.latitude += sample.latitude * weight;
      result.longitude += sample.longitude * weight;
      result.weight += weight;

      if (sample.altitudeMetres !== null && sample.altitudeMetres !== undefined) {
        result.altitude += sample.altitudeMetres * weight;
        result.altitudeWeight += weight;
      }

      return result;
    },
    {
      latitude: 0,
      longitude: 0,
      altitude: 0,
      altitudeWeight: 0,
      weight: 0,
    },
  );

  const averageAccuracyMetres =
    accepted.reduce((total, sample) => total + sample.accuracyMetres, 0) /
    accepted.length;
  const bestAccuracyMetres = Math.min(
    ...accepted.map((sample) => sample.accuracyMetres),
  );

  return {
    coordinate: {
      latitude: weighted.latitude / weighted.weight,
      longitude: weighted.longitude / weighted.weight,
      accuracyMetres: Number(averageAccuracyMetres.toFixed(2)),
      altitudeMetres:
        weighted.altitudeWeight > 0
          ? weighted.altitude / weighted.altitudeWeight
          : null,
      headingDegrees: null,
      speedMetresPerSecond: null,
      capturedAt: new Date().toISOString(),
    },
    sampleCount: accepted.length,
    averageAccuracyMetres: Number(averageAccuracyMetres.toFixed(2)),
    bestAccuracyMetres: Number(bestAccuracyMetres.toFixed(2)),
    rejectedSampleCount: samples.length - accepted.length,
  };
}
