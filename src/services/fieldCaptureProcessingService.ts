import type {
  GeoCoordinate,
  ProcessedWalkingTrace,
  RejectedGeoCoordinate,
} from "../types/fieldPlacement";
import {
  calculateTrackDistanceMetres,
  coordinateToLocalMetres,
  haversineDistanceMetres,
  localOffsetToCoordinate,
} from "../utils/geographicCoordinates";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function timestampMilliseconds(coordinate: GeoCoordinate): number {
  const value = new Date(coordinate.capturedAt).getTime();
  return Number.isFinite(value) ? value : 0;
}

function validCoordinate(coordinate: GeoCoordinate): boolean {
  return (
    Number.isFinite(coordinate.latitude) &&
    Number.isFinite(coordinate.longitude) &&
    Number.isFinite(coordinate.accuracyMetres) &&
    coordinate.latitude >= -90 &&
    coordinate.latitude <= 90 &&
    coordinate.longitude >= -180 &&
    coordinate.longitude <= 180
  );
}

function filterWalkingSamples(
  coordinates: GeoCoordinate[],
): {
  accepted: GeoCoordinate[];
  rejected: RejectedGeoCoordinate[];
} {
  const rejected: RejectedGeoCoordinate[] = [];
  const finite = coordinates.filter((coordinate) => {
    if (validCoordinate(coordinate)) return true;
    rejected.push({ coordinate, reason: "Invalid coordinate" });
    return false;
  });

  const medianAccuracy = median(
    finite.map((coordinate) => Math.max(1, coordinate.accuracyMetres)),
  );
  const maximumAccuracy = Math.min(30, Math.max(12, medianAccuracy * 2.5));
  const accepted: GeoCoordinate[] = [];

  finite.forEach((coordinate) => {
    if (coordinate.accuracyMetres > maximumAccuracy) {
      rejected.push({ coordinate, reason: "Poor accuracy" });
      return;
    }

    const previous = accepted[accepted.length - 1];
    if (!previous) {
      accepted.push(coordinate);
      return;
    }

    const currentTime = timestampMilliseconds(coordinate);
    const previousTime = timestampMilliseconds(previous);
    if (currentTime > 0 && previousTime > 0 && currentTime < previousTime) {
      rejected.push({ coordinate, reason: "Out-of-order timestamp" });
      return;
    }

    const distance = haversineDistanceMetres(previous, coordinate);
    if (distance < 0.25) {
      rejected.push({ coordinate, reason: "Duplicate sample" });
      return;
    }

    const deltaSeconds = Math.max(0.25, (currentTime - previousTime) / 1_000);
    const impliedSpeed = distance / deltaSeconds;
    if (distance > 8 && impliedSpeed > 7) {
      rejected.push({ coordinate, reason: "Impossible jump" });
      return;
    }

    accepted.push(coordinate);
  });

  return { accepted, rejected };
}

function smoothWalkingCoordinates(
  coordinates: GeoCoordinate[],
): GeoCoordinate[] {
  if (coordinates.length <= 2) return coordinates.map((coordinate) => ({ ...coordinate }));

  const origin = coordinates[0];
  const local = coordinates.map((coordinate) =>
    coordinateToLocalMetres(origin, coordinate),
  );

  return coordinates.map((coordinate, index) => {
    if (index === 0 || index === coordinates.length - 1) return { ...coordinate };

    const previous = local[index - 1];
    const current = local[index];
    const next = local[index + 1];
    // Preserve the walked curve while reducing small GPS zig-zags.
    const eastMetres =
      previous.eastMetres * 0.2 +
      current.eastMetres * 0.6 +
      next.eastMetres * 0.2;
    const northMetres =
      previous.northMetres * 0.2 +
      current.northMetres * 0.6 +
      next.northMetres * 0.2;
    const smoothed = localOffsetToCoordinate(origin, eastMetres, northMetres);

    return {
      ...coordinate,
      latitude: smoothed.latitude,
      longitude: smoothed.longitude,
    };
  });
}

function closeBoundary(coordinates: GeoCoordinate[]): GeoCoordinate[] {
  if (coordinates.length < 3) return coordinates;
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (haversineDistanceMetres(first, last) <= 0.25) return coordinates;
  return [...coordinates, { ...first, capturedAt: last.capturedAt }];
}

function polygonAreaSquareMetres(coordinates: GeoCoordinate[]): number {
  if (coordinates.length < 4) return 0;
  const origin = coordinates[0];
  const points = coordinates.map((coordinate) =>
    coordinateToLocalMetres(origin, coordinate),
  );
  let twiceArea = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    twiceArea +=
      current.eastMetres * next.northMetres -
      next.eastMetres * current.northMetres;
  }
  return Math.abs(twiceArea) / 2;
}

export function processWalkingTrace(input: {
  coordinates: GeoCoordinate[];
  captureMode: "Line" | "Boundary";
}): ProcessedWalkingTrace {
  if (input.coordinates.length < 2) {
    throw new Error("Record at least two GPS points before reviewing the trace.");
  }

  const { accepted, rejected } = filterWalkingSamples(input.coordinates);
  const minimumRequired = input.captureMode === "Boundary" ? 3 : 2;
  if (accepted.length < minimumRequired) {
    throw new Error(
      input.captureMode === "Boundary"
        ? "A boundary needs at least three usable GPS points."
        : "The line does not contain enough usable GPS points.",
    );
  }

  const smoothed =
    input.captureMode === "Boundary"
      ? accepted.map((coordinate) => ({ ...coordinate }))
      : smoothWalkingCoordinates(accepted);
  const processedCoordinates =
    input.captureMode === "Boundary" ? closeBoundary(smoothed) : smoothed;
  const averageAccuracyMetres =
    accepted.reduce((sum, coordinate) => sum + coordinate.accuracyMetres, 0) /
    accepted.length;
  const bestAccuracyMetres = Math.min(
    ...accepted.map((coordinate) => coordinate.accuracyMetres),
  );
  const estimatedUncertaintyMetres = Math.max(
    bestAccuracyMetres,
    median(accepted.map((coordinate) => coordinate.accuracyMetres)),
  );

  return {
    captureMode: input.captureMode,
    rawCoordinates: [...input.coordinates],
    acceptedCoordinates: accepted,
    rejectedCoordinates: rejected,
    processedCoordinates,
    rawDistanceMetres: calculateTrackDistanceMetres(input.coordinates),
    processedDistanceMetres: calculateTrackDistanceMetres(processedCoordinates),
    areaSquareMetres:
      input.captureMode === "Boundary"
        ? polygonAreaSquareMetres(processedCoordinates)
        : undefined,
    closedBoundary: input.captureMode === "Boundary",
    averageAccuracyMetres: Number(averageAccuracyMetres.toFixed(2)),
    bestAccuracyMetres: Number(bestAccuracyMetres.toFixed(2)),
    estimatedUncertaintyMetres: Number(
      estimatedUncertaintyMetres.toFixed(2),
    ),
    processingMethod:
      input.captureMode === "Boundary"
        ? "Accuracy gate + duplicate/jump rejection + exact boundary closure"
        : "Accuracy gate + duplicate/jump rejection + endpoint-preserving 3-point smoothing",
  };
}

export const FieldCaptureProcessingService = {
  processWalkingTrace,
};
