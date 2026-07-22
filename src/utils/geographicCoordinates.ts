import type {
  FieldAccuracyQuality,
  FieldSceneCalibration,
  FieldScenePosition,
  GeoCoordinate,
} from "../types/fieldPlacement";

const EARTH_RADIUS_METRES = 6_371_008.8;
const DEGREES_TO_RADIANS = Math.PI / 180;
const RADIANS_TO_DEGREES = 180 / Math.PI;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function getAccuracyQuality(
  accuracyMetres: number,
): FieldAccuracyQuality {
  if (accuracyMetres <= 3) return "Excellent";
  if (accuracyMetres <= 5) return "Good";
  if (accuracyMetres <= 10) return "Acceptable";
  return "Poor";
}

export function haversineDistanceMetres(
  first: Pick<GeoCoordinate, "latitude" | "longitude">,
  second: Pick<GeoCoordinate, "latitude" | "longitude">,
): number {
  const firstLatitude = first.latitude * DEGREES_TO_RADIANS;
  const secondLatitude = second.latitude * DEGREES_TO_RADIANS;
  const latitudeDelta =
    (second.latitude - first.latitude) * DEGREES_TO_RADIANS;
  const longitudeDelta =
    (second.longitude - first.longitude) * DEGREES_TO_RADIANS;

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    2 *
    EARTH_RADIUS_METRES *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

export function initialBearingDegrees(
  first: Pick<GeoCoordinate, "latitude" | "longitude">,
  second: Pick<GeoCoordinate, "latitude" | "longitude">,
): number {
  const firstLatitude = first.latitude * DEGREES_TO_RADIANS;
  const secondLatitude = second.latitude * DEGREES_TO_RADIANS;
  const longitudeDelta =
    (second.longitude - first.longitude) * DEGREES_TO_RADIANS;

  const y = Math.sin(longitudeDelta) * Math.cos(secondLatitude);
  const x =
    Math.cos(firstLatitude) * Math.sin(secondLatitude) -
    Math.sin(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.cos(longitudeDelta);

  return (Math.atan2(y, x) * RADIANS_TO_DEGREES + 360) % 360;
}

export function coordinateToLocalMetres(
  origin: Pick<GeoCoordinate, "latitude" | "longitude">,
  coordinate: Pick<GeoCoordinate, "latitude" | "longitude">,
): { eastMetres: number; northMetres: number } {
  const meanLatitude =
    ((origin.latitude + coordinate.latitude) / 2) * DEGREES_TO_RADIANS;

  const northMetres =
    (coordinate.latitude - origin.latitude) *
    DEGREES_TO_RADIANS *
    EARTH_RADIUS_METRES;

  const eastMetres =
    (coordinate.longitude - origin.longitude) *
    DEGREES_TO_RADIANS *
    EARTH_RADIUS_METRES *
    Math.cos(meanLatitude);

  return { eastMetres, northMetres };
}

export function coordinateToScenePosition(
  coordinate: Pick<GeoCoordinate, "latitude" | "longitude">,
  calibration: FieldSceneCalibration,
  clampToScene = true,
): FieldScenePosition {
  const directionVector = coordinateToLocalMetres(
    calibration.origin,
    calibration.directionReference,
  );

  const directionLength = Math.max(
    0.001,
    Math.hypot(directionVector.eastMetres, directionVector.northMetres),
  );

  const xAxis = {
    east: directionVector.eastMetres / directionLength,
    north: directionVector.northMetres / directionLength,
  };

  const leftYAxis = {
    east: -xAxis.north,
    north: xAxis.east,
  };

  const yAxis =
    calibration.yAxisSide === "Left"
      ? leftYAxis
      : { east: -leftYAxis.east, north: -leftYAxis.north };

  const local = coordinateToLocalMetres(calibration.origin, coordinate);

  const xMetres =
    local.eastMetres * xAxis.east + local.northMetres * xAxis.north;
  const yMetres =
    local.eastMetres * yAxis.east + local.northMetres * yAxis.north;

  const rawPosition = {
    x: (xMetres / Math.max(0.1, calibration.sceneWidthMetres)) * 100,
    y:
      100 -
      (yMetres / Math.max(0.1, calibration.sceneHeightMetres)) * 100,
  };

  if (!clampToScene) return rawPosition;

  return {
    x: clamp(rawPosition.x, 0, 100),
    y: clamp(rawPosition.y, 0, 100),
  };
}

export function calculateTrackDistanceMetres(
  coordinates: Array<Pick<GeoCoordinate, "latitude" | "longitude">>,
): number {
  return coordinates.reduce((distance, coordinate, index) => {
    if (index === 0) return distance;
    return distance + haversineDistanceMetres(coordinates[index - 1], coordinate);
  }, 0);
}

export function getDistanceAndBearing(
  current: Pick<GeoCoordinate, "latitude" | "longitude">,
  target: Pick<GeoCoordinate, "latitude" | "longitude">,
): { distanceMetres: number; bearingDegrees: number; directionLabel: string } {
  const bearingDegrees = initialBearingDegrees(current, target);
  const directions = [
    "north",
    "north-east",
    "east",
    "south-east",
    "south",
    "south-west",
    "west",
    "north-west",
  ];
  const directionIndex = Math.round(bearingDegrees / 45) % 8;

  return {
    distanceMetres: haversineDistanceMetres(current, target),
    bearingDegrees,
    directionLabel: directions[directionIndex],
  };
}

export function createAccuracyCircleGeoJson(
  coordinate: Pick<GeoCoordinate, "latitude" | "longitude" | "accuracyMetres">,
  segments = 48,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const latitudeRadians = coordinate.latitude * DEGREES_TO_RADIANS;
  const points: number[][] = [];

  for (let index = 0; index <= segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    const north = Math.cos(angle) * coordinate.accuracyMetres;
    const east = Math.sin(angle) * coordinate.accuracyMetres;

    const latitude =
      coordinate.latitude +
      (north / EARTH_RADIUS_METRES) * RADIANS_TO_DEGREES;
    const longitude =
      coordinate.longitude +
      (east /
        (EARTH_RADIUS_METRES * Math.max(0.001, Math.cos(latitudeRadians)))) *
        RADIANS_TO_DEGREES;

    points.push([longitude, latitude]);
  }

  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [points],
    },
  };
}

export function sampleSceneTrack(
  scenePoints: FieldScenePosition[],
  count: number,
): FieldScenePosition[] {
  if (count <= 0 || scenePoints.length === 0) return [];
  if (scenePoints.length === 1) {
    return Array.from({ length: count }, () => ({ ...scenePoints[0] }));
  }

  const cumulativeDistances = [0];

  for (let index = 1; index < scenePoints.length; index += 1) {
    const previous = scenePoints[index - 1];
    const current = scenePoints[index];
    cumulativeDistances.push(
      cumulativeDistances[index - 1] +
        Math.hypot(current.x - previous.x, current.y - previous.y),
    );
  }

  const totalDistance = cumulativeDistances[cumulativeDistances.length - 1];

  if (totalDistance <= 0.0001) {
    return Array.from({ length: count }, () => ({ ...scenePoints[0] }));
  }

  return Array.from({ length: count }, (_, outputIndex) => {
    const targetDistance =
      count === 1 ? 0 : (outputIndex / (count - 1)) * totalDistance;

    let segmentIndex = 1;
    while (
      segmentIndex < cumulativeDistances.length - 1 &&
      cumulativeDistances[segmentIndex] < targetDistance
    ) {
      segmentIndex += 1;
    }

    const segmentStartDistance = cumulativeDistances[segmentIndex - 1];
    const segmentEndDistance = cumulativeDistances[segmentIndex];
    const segmentLength = Math.max(
      0.0001,
      segmentEndDistance - segmentStartDistance,
    );
    const ratio = (targetDistance - segmentStartDistance) / segmentLength;
    const start = scenePoints[segmentIndex - 1];
    const end = scenePoints[segmentIndex];

    return {
      x: start.x + (end.x - start.x) * ratio,
      y: start.y + (end.y - start.y) * ratio,
    };
  });
}
