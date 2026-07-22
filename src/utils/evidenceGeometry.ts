import type {
  ReconstructionPosition,
  RoadSceneSettings,
  SceneMeasurement,
} from "../types/reconstruction";

export function calculateSceneDistanceMetres(
  start: ReconstructionPosition,
  end: ReconstructionPosition,
  scene: Pick<RoadSceneSettings, "sceneWidthMetres" | "sceneHeightMetres">,
): number {
  const deltaX = ((end.x - start.x) / 100) * scene.sceneWidthMetres;
  const deltaY = ((end.y - start.y) / 100) * scene.sceneHeightMetres;
  return Number(Math.hypot(deltaX, deltaY).toFixed(2));
}

export function updateMeasurementDistance(
  measurement: SceneMeasurement,
  scene: Pick<RoadSceneSettings, "sceneWidthMetres" | "sceneHeightMetres">,
): SceneMeasurement {
  return {
    ...measurement,
    distanceMetres: calculateSceneDistanceMetres(
      measurement.start,
      measurement.end,
      scene,
    ),
  };
}

export function getMeasurementMidpoint(
  measurement: SceneMeasurement,
): ReconstructionPosition {
  return {
    x: (measurement.start.x + measurement.end.x) / 2,
    y: (measurement.start.y + measurement.end.y) / 2,
  };
}