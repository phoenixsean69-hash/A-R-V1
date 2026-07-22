import type {
  AccidentReconstruction,
  MovementPathPoint,
  ReconstructionPosition,
} from "../types/reconstruction";
import type {
  AveragedLocationResult,
  FieldPlacementRecord,
  FieldPlacementTarget,
  FieldSceneCalibration,
  FieldWalkingTrack,
  FieldWalkingTrackTargetType,
  GeoCoordinate,
} from "../types/fieldPlacement";

import {
  calculateTrackDistanceMetres,
  coordinateToLocalMetres,
  coordinateToScenePosition,
  haversineDistanceMetres,
  initialBearingDegrees,
  sampleSceneTrack,
} from "../utils/geographicCoordinates";
import {
  getPointsCentroid,
  shiftSceneObjectTrace,
  sortMovementPathPoints,
  syncLegacyParticipantFields,
} from "../utils/reconstructionGeometry";
import { updateMeasurementDistance } from "../utils/evidenceGeometry";

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createFieldCalibration(input: {
  origin: GeoCoordinate;
  directionReference: GeoCoordinate;
  widthReference?: GeoCoordinate;
  sceneWidthMetres: number;
  sceneHeightMetres: number;
  createdBy: string;
}): FieldSceneCalibration {
  const directionDistance = haversineDistanceMetres(
    input.origin,
    input.directionReference,
  );

  if (directionDistance < 3) {
    throw new Error(
      "The road-direction reference must be at least 3 metres from the origin.",
    );
  }

  const directionLocal = coordinateToLocalMetres(
    input.origin,
    input.directionReference,
  );
  const directionLength = Math.hypot(
    directionLocal.eastMetres,
    directionLocal.northMetres,
  );
  const xAxis = {
    east: directionLocal.eastMetres / directionLength,
    north: directionLocal.northMetres / directionLength,
  };
  const leftYAxis = { east: -xAxis.north, north: xAxis.east };

  let yAxisSide: "Left" | "Right" = "Left";
  let widthReferenceDistanceMetres: number | undefined;

  if (input.widthReference) {
    const widthLocal = coordinateToLocalMetres(
      input.origin,
      input.widthReference,
    );
    const projectionOnLeft =
      widthLocal.eastMetres * leftYAxis.east +
      widthLocal.northMetres * leftYAxis.north;
    yAxisSide = projectionOnLeft >= 0 ? "Left" : "Right";
    widthReferenceDistanceMetres = haversineDistanceMetres(
      input.origin,
      input.widthReference,
    );
  }

  return {
    id: createId("field-calibration"),
    origin: input.origin,
    directionReference: input.directionReference,
    widthReference: input.widthReference,
    sceneWidthMetres: Math.max(1, input.sceneWidthMetres),
    sceneHeightMetres: Math.max(1, input.sceneHeightMetres),
    rotationDegrees: initialBearingDegrees(
      input.origin,
      input.directionReference,
    ),
    directionReferenceDistanceMetres: Number(directionDistance.toFixed(2)),
    widthReferenceDistanceMetres:
      widthReferenceDistanceMetres === undefined
        ? undefined
        : Number(widthReferenceDistanceMetres.toFixed(2)),
    yAxisSide,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
  };
}

function createPlacementRecord(input: {
  target: FieldPlacementTarget;
  coordinate: GeoCoordinate;
  scenePosition: ReconstructionPosition;
  capture: AveragedLocationResult;
  method: "Single GPS" | "Averaged GPS";
  confirmedBy: string;
  acceptedPoorAccuracy: boolean;
}): FieldPlacementRecord {
  return {
    id: createId("field-placement"),
    targetType: input.target.type,
    targetId: input.target.targetId,
    subTargetId: input.target.subTargetId,
    targetLabel: input.target.label,
    coordinate: input.coordinate,
    scenePosition: input.scenePosition,
    sampleCount: input.capture.sampleCount,
    averageAccuracyMetres: input.capture.averageAccuracyMetres,
    bestAccuracyMetres: input.capture.bestAccuracyMetres,
    method: input.method,
    acceptedPoorAccuracy: input.acceptedPoorAccuracy,
    manuallyAdjusted: false,
    confirmedAt: new Date().toISOString(),
    confirmedBy: input.confirmedBy,
  };
}

function appendPlacement(
  placements: FieldPlacementRecord[],
  nextRecord: FieldPlacementRecord,
): FieldPlacementRecord[] {
  return [...placements, nextRecord];
}


export function applyFieldPlacement(input: {
  reconstruction: AccidentReconstruction;
  target: FieldPlacementTarget;
  capture: AveragedLocationResult;
  method: "Single GPS" | "Averaged GPS";
  confirmedBy: string;
  acceptedPoorAccuracy?: boolean;
}): AccidentReconstruction {
  const calibration = input.reconstruction.fieldCalibration;

  if (!calibration) {
    throw new Error("Calibrate the scene before placing field items.");
  }

  const scenePosition = coordinateToScenePosition(
    input.capture.coordinate,
    calibration,
  );
  const record = createPlacementRecord({
    target: input.target,
    coordinate: input.capture.coordinate,
    scenePosition,
    capture: input.capture,
    method: input.method,
    confirmedBy: input.confirmedBy,
    acceptedPoorAccuracy: input.acceptedPoorAccuracy ?? false,
  });

  let reconstruction: AccidentReconstruction = {
    ...input.reconstruction,
    fieldPlacements: appendPlacement(
      input.reconstruction.fieldPlacements,
      record,
    ),
  };

  switch (input.target.type) {
    case "ParticipantPathPoint": {
      reconstruction = {
        ...reconstruction,
        vehicles: reconstruction.vehicles.map((participant) => {
          if (participant.id !== input.target.targetId) return participant;

          const pathPoints = sortMovementPathPoints(
            participant.pathPoints.map((point) =>
              point.id === input.target.subTargetId
                ? { ...point, position: scenePosition }
                : point,
            ),
          );

          return syncLegacyParticipantFields({ ...participant, pathPoints });
        }),
      };
      break;
    }

    case "SceneObject": {
      reconstruction = {
        ...reconstruction,
        sceneObjects: reconstruction.sceneObjects.map((object) =>
          object.id === input.target.targetId
            ? {
                ...object,
                position: scenePosition,
                tracePoints: shiftSceneObjectTrace(object, scenePosition),
              }
            : object,
        ),
      };
      break;
    }

    case "EvidenceRecord": {
      reconstruction = {
        ...reconstruction,
        evidenceRecords: reconstruction.evidenceRecords.map((evidence) =>
          evidence.id === input.target.targetId
            ? { ...evidence, position: scenePosition }
            : evidence,
        ),
      };
      break;
    }

    case "MeasurementStart":
    case "MeasurementEnd": {
      const endpoint =
        input.target.type === "MeasurementStart" ? "start" : "end";
      reconstruction = {
        ...reconstruction,
        measurements: reconstruction.measurements.map((measurement) =>
          measurement.id === input.target.targetId
            ? updateMeasurementDistance(
                { ...measurement, [endpoint]: scenePosition },
                reconstruction.scene,
              )
            : measurement,
        ),
      };
      break;
    }

    case "CollisionPoint": {
      reconstruction = { ...reconstruction, collisionPoint: scenePosition };
      break;
    }
  }

  return reconstruction;
}

function getAverageAccuracy(coordinates: GeoCoordinate[]): number {
  if (coordinates.length === 0) return 0;
  return Number(
    (
      coordinates.reduce(
        (total, coordinate) => total + coordinate.accuracyMetres,
        0,
      ) / coordinates.length
    ).toFixed(2),
  );
}

export function applyWalkingTrack(input: {
  reconstruction: AccidentReconstruction;
  targetType: FieldWalkingTrackTargetType;
  targetId: string;
  targetLabel: string;
  coordinates: GeoCoordinate[];
  startedAt: string;
  recordedBy: string;
}): AccidentReconstruction {
  const calibration = input.reconstruction.fieldCalibration;

  if (!calibration) {
    throw new Error("Calibrate the scene before recording a walking trace.");
  }

  if (input.coordinates.length < 2) {
    throw new Error("A walking trace needs at least two usable GPS points.");
  }

  const scenePoints = input.coordinates.map((coordinate) =>
    coordinateToScenePosition(coordinate, calibration),
  );

  const track: FieldWalkingTrack = {
    id: createId("field-track"),
    targetType: input.targetType,
    targetId: input.targetId,
    targetLabel: input.targetLabel,
    coordinates: input.coordinates,
    scenePoints,
    startedAt: input.startedAt,
    completedAt: new Date().toISOString(),
    distanceMetres: Number(
      calculateTrackDistanceMetres(input.coordinates).toFixed(2),
    ),
    averageAccuracyMetres: getAverageAccuracy(input.coordinates),
    bestAccuracyMetres: Number(
      Math.min(...input.coordinates.map((item) => item.accuracyMetres)).toFixed(
        2,
      ),
    ),
    recordedBy: input.recordedBy,
  };

  let reconstruction: AccidentReconstruction = {
    ...input.reconstruction,
    fieldWalkingTracks: [
      ...input.reconstruction.fieldWalkingTracks.filter(
        (existing) =>
          !(
            existing.targetType === input.targetType &&
            existing.targetId === input.targetId
          ),
      ),
      track,
    ],
  };

  if (input.targetType === "ParticipantPath") {
    reconstruction = {
      ...reconstruction,
      vehicles: reconstruction.vehicles.map((participant) => {
        if (participant.id !== input.targetId) return participant;

        const sampled = sampleSceneTrack(
          scenePoints,
          Math.max(2, participant.pathPoints.length),
        );
        const pathPoints: MovementPathPoint[] = participant.pathPoints.map(
          (point, index) => ({
            ...point,
            position: sampled[index] ?? point.position,
          }),
        );

        return syncLegacyParticipantFields({
          ...participant,
          pathPoints: sortMovementPathPoints(pathPoints),
        });
      }),
    };
  } else {
    reconstruction = {
      ...reconstruction,
      sceneObjects: reconstruction.sceneObjects.map((object) =>
        object.id === input.targetId
          ? {
              ...object,
              tracePoints: scenePoints,
              position: getPointsCentroid(scenePoints),
              lengthMetres: track.distanceMetres,
            }
          : object,
      ),
    };
  }

  return reconstruction;
}

export function getFieldPlacementTargets(
  reconstruction: AccidentReconstruction,
): FieldPlacementTarget[] {
  const targets: FieldPlacementTarget[] = [
    {
      type: "CollisionPoint",
      targetId: "collision-point",
      label: "Main collision point",
    },
  ];

  reconstruction.vehicles.forEach((participant) => {
    participant.pathPoints.forEach((point) => {
      targets.push({
        type: "ParticipantPathPoint",
        targetId: participant.id,
        subTargetId: point.id,
        label: `${participant.name} — ${point.label} (${point.action})`,
      });
    });
  });

  reconstruction.sceneObjects.forEach((object) => {
    targets.push({
      type: "SceneObject",
      targetId: object.id,
      label: `Scene object — ${object.label}`,
    });
  });

  reconstruction.evidenceRecords.forEach((evidence) => {
    targets.push({
      type: "EvidenceRecord",
      targetId: evidence.id,
      label: `E-${String(evidence.evidenceNumber).padStart(2, "0")} — ${evidence.title}`,
    });
  });

  reconstruction.measurements.forEach((measurement) => {
    targets.push(
      {
        type: "MeasurementStart",
        targetId: measurement.id,
        label: `M-${String(measurement.measurementNumber).padStart(2, "0")} — start point`,
      },
      {
        type: "MeasurementEnd",
        targetId: measurement.id,
        label: `M-${String(measurement.measurementNumber).padStart(2, "0")} — end point`,
      },
    );
  });

  return targets;
}

export function markFieldPlacementManuallyAdjusted(input: {
  reconstruction: AccidentReconstruction;
  targetType: FieldPlacementRecord["targetType"];
  targetId: string;
  subTargetId?: string;
  reason?: string;
}): AccidentReconstruction {
  const matchingPlacement = [...input.reconstruction.fieldPlacements]
    .reverse()
    .find(
      (placement) =>
        placement.targetType === input.targetType &&
        placement.targetId === input.targetId &&
        placement.subTargetId === input.subTargetId,
    );

  if (!matchingPlacement) return input.reconstruction;

  return {
    ...input.reconstruction,
    fieldPlacements: input.reconstruction.fieldPlacements.map((placement) =>
      placement.id === matchingPlacement.id
        ? {
            ...placement,
            manuallyAdjusted: true,
            originalScenePosition:
              placement.originalScenePosition ?? placement.scenePosition,
            adjustmentReason:
              input.reason ??
              "Position changed in the 2D reconstruction editor after field GPS capture.",
          }
        : placement,
    ),
  };
}

export const FieldPlacementService = {
  createCalibration: createFieldCalibration,
  applyPlacement: applyFieldPlacement,
  applyWalkingTrack,
  getTargets: getFieldPlacementTargets,
  markManuallyAdjusted: markFieldPlacementManuallyAdjusted,
};
