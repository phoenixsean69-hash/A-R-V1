import { reconstructionData } from "../data/reconstructionData";

import type {
  AccidentReconstruction,
  AccidentTimelineEvent,
  MovementPathPoint,
  ReconstructionSceneObject,
  ReconstructionVehicle,
  SceneMeasurement,
  EvidenceRecord,
  ScenePhotoAttachment,
  CollisionSetup,
  ReconstructionPhysicsSettings,
} from "../types/reconstruction";

import type {
  FieldPlacementRecord,
  FieldSceneCalibration,
  FieldWalkingTrack,
  GeoCoordinate,
} from "../types/fieldPlacement";

import { createDefaultRoadSceneSettings } from "../types/reconstruction";

import {
  DEFAULT_PHYSICS_SETTINGS,
  getDefaultParticipantPhysics,
  getDefaultSceneObjectPhysics,
} from "./reconstructionPhysicsService";

import {
  clamp,
  getPointsCentroid,
  isTraceableSceneObjectType,
  sortMovementPathPoints,
  syncLegacyParticipantFields,
} from "../utils/reconstructionGeometry";

const STORAGE_KEY = "roadsafe-ar-reconstructions";

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normaliseParticipant(
  participant: ReconstructionVehicle,
  durationSeconds: number,
): ReconstructionVehicle {
  const legacyCollisionTime = clamp(
    Number(participant.collisionTimeSeconds ?? durationSeconds / 2),
    0.1,
    durationSeconds,
  );

  const existingPoints = Array.isArray(participant.pathPoints)
    ? participant.pathPoints
    : [];

  const pathPoints: MovementPathPoint[] =
    existingPoints.length >= 2
      ? existingPoints.map((point, index) => ({
          id: point.id || createId("path-point"),
          label: point.label || `Path point ${index + 1}`,
          position: {
            x: clamp(Number(point.position?.x ?? 50), 0, 100),
            y: clamp(Number(point.position?.y ?? 50), 0, 100),
          },
          timeSeconds: clamp(Number(point.timeSeconds ?? index), 0, durationSeconds),
          speedKmh: Math.max(0, Number(point.speedKmh ?? participant.estimatedSpeedKmh ?? 0)),
          rotation: Number(point.rotation ?? 0),
          action: point.action ?? "Cruise",
          linkedSceneObjectId: point.linkedSceneObjectId,
          notes: point.notes ?? "",
        }))
      : [
          {
            id: createId("path-start"),
            label: "Start",
            position: participant.startPosition ?? { x: 10, y: 50 },
            timeSeconds: 0,
            speedKmh: Math.max(0, Number(participant.estimatedSpeedKmh ?? 0)),
            rotation: Number(participant.startRotation ?? 0),
            action: "Start",
            notes: "",
          },
          {
            id: createId("path-impact"),
            label: "Impact",
            position: participant.collisionPosition ?? { x: 50, y: 50 },
            timeSeconds: legacyCollisionTime,
            speedKmh: Math.max(
              0,
              Number(participant.estimatedSpeedKmh ?? 0) * 0.65,
            ),
            rotation: Number(participant.collisionRotation ?? 0),
            action: "Impact",
            notes: "",
          },
          {
            id: createId("path-final"),
            label: "Final position",
            position: participant.finalPosition ?? { x: 65, y: 50 },
            timeSeconds: durationSeconds,
            speedKmh: 0,
            rotation: Number(participant.finalRotation ?? 0),
            action: "Stop",
            notes: "",
          },
        ];

  return syncLegacyParticipantFields({
    ...participant,
    physics: {
      ...getDefaultParticipantPhysics(participant),
      ...(participant.physics ?? {}),
    },
    originLocation: participant.originLocation ?? "",
    destinationLocation: participant.destinationLocation ?? "",
    pathPoints: sortMovementPathPoints(pathPoints),
    startPosition: participant.startPosition ?? pathPoints[0].position,
    collisionPosition:
      participant.collisionPosition ?? pathPoints[Math.floor(pathPoints.length / 2)].position,
    finalPosition: participant.finalPosition ?? pathPoints[pathPoints.length - 1].position,
    startRotation: Number(participant.startRotation ?? pathPoints[0].rotation),
    collisionRotation: Number(
      participant.collisionRotation ?? pathPoints[Math.floor(pathPoints.length / 2)].rotation,
    ),
    finalRotation: Number(
      participant.finalRotation ?? pathPoints[pathPoints.length - 1].rotation,
    ),
    collisionTimeSeconds: legacyCollisionTime,
    estimatedSpeedKmh: Math.max(0, Number(participant.estimatedSpeedKmh ?? 0)),
  });
}

function normaliseSceneObject(
  object: ReconstructionSceneObject,
): ReconstructionSceneObject {
  const tracePoints = Array.isArray(object.tracePoints)
    ? object.tracePoints.map((point) => ({
        x: clamp(Number(point.x ?? 50), 0, 100),
        y: clamp(Number(point.y ?? 50), 0, 100),
      }))
    : undefined;

  const position =
    tracePoints && tracePoints.length > 0
      ? getPointsCentroid(tracePoints)
      : {
          x: clamp(Number(object.position?.x ?? 50), 0, 100),
          y: clamp(Number(object.position?.y ?? 50), 0, 100),
        };

  return {
    ...object,
    physics: {
      ...getDefaultSceneObjectPhysics(object),
      ...(object.physics ?? {}),
    },
    position,
    rotation: Number(object.rotation ?? 0),
    scale: Math.max(0.2, Number(object.scale ?? 1)),
    severity: object.severity ?? "Low",
    visible: object.visible ?? true,
    locked: object.locked ?? false,
    notes: object.notes ?? "",
    tracePoints,
    traceWidth: isTraceableSceneObjectType(object.type)
      ? Math.max(0.15, Number(object.traceWidth ?? 0.75))
      : object.traceWidth,
    traceStyle: object.traceStyle ?? (object.type === "Skid Mark" ? "Double" : "Single"),
    traceSmoothing: clamp(Number(object.traceSmoothing ?? 0.85), 0, 1),
  };
}

function normaliseTimelineEvent(
  event: AccidentTimelineEvent,
  durationSeconds: number,
): AccidentTimelineEvent {
  return {
    ...event,
    id: event.id || createId("timeline-event"),
    timeSeconds: clamp(Number(event.timeSeconds ?? 0), 0, durationSeconds),
    title: event.title || "Timeline event",
    description: event.description ?? "",
    type: event.type ?? "Observation",
  };
}


function calculateMeasurementDistance(
  measurement: Pick<SceneMeasurement, "start" | "end">,
  sceneWidthMetres: number,
  sceneHeightMetres: number,
): number {
  const deltaX = ((measurement.end.x - measurement.start.x) / 100) * sceneWidthMetres;
  const deltaY = ((measurement.end.y - measurement.start.y) / 100) * sceneHeightMetres;
  return Number(Math.hypot(deltaX, deltaY).toFixed(2));
}

function normaliseMeasurement(
  measurement: SceneMeasurement,
  index: number,
  sceneWidthMetres: number,
  sceneHeightMetres: number,
): SceneMeasurement {
  const start = {
    x: clamp(Number(measurement.start?.x ?? 40), 0, 100),
    y: clamp(Number(measurement.start?.y ?? 50), 0, 100),
  };
  const end = {
    x: clamp(Number(measurement.end?.x ?? 60), 0, 100),
    y: clamp(Number(measurement.end?.y ?? 50), 0, 100),
  };

  return {
    ...measurement,
    id: measurement.id || createId("measurement"),
    measurementNumber: Number(measurement.measurementNumber ?? index + 1),
    label: measurement.label || `Measurement ${index + 1}`,
    kind: measurement.kind ?? "Distance",
    start,
    end,
    distanceMetres: calculateMeasurementDistance(
      { start, end },
      sceneWidthMetres,
      sceneHeightMetres,
    ),
    colour: measurement.colour ?? "#0ea5e9",
    visible: measurement.visible ?? true,
    locked: measurement.locked ?? false,
    notes: measurement.notes ?? "",
  };
}

function normaliseEvidenceRecord(
  evidence: EvidenceRecord,
  index: number,
): EvidenceRecord {
  return {
    ...evidence,
    id: evidence.id || createId("evidence"),
    evidenceNumber: Number(evidence.evidenceNumber ?? index + 1),
    title: evidence.title || `Evidence ${index + 1}`,
    category: evidence.category ?? "Other",
    status: evidence.status ?? "Observed",
    description: evidence.description ?? "",
    notes: evidence.notes ?? "",
    position: {
      x: clamp(Number(evidence.position?.x ?? 50), 0, 100),
      y: clamp(Number(evidence.position?.y ?? 50), 0, 100),
    },
    recordedAt: evidence.recordedAt || new Date().toISOString(),
    recordedBy: evidence.recordedBy ?? "",
    measurementIds: Array.isArray(evidence.measurementIds)
      ? evidence.measurementIds
      : [],
    photoIds: Array.isArray(evidence.photoIds) ? evidence.photoIds : [],
  };
}

function normalisePhoto(photo: ScenePhotoAttachment): ScenePhotoAttachment {
  return {
    ...photo,
    id: photo.id || createId("photo"),
    filename: photo.filename || "scene-photo.jpg",
    mimeType: photo.mimeType || "image/jpeg",
    sizeBytes: Number(photo.sizeBytes ?? 0),
    dataUrl: photo.dataUrl ?? "",
    thumbnailDataUrl: photo.thumbnailDataUrl ?? photo.dataUrl ?? "",
    caption: photo.caption ?? "",
    takenAt: photo.takenAt || new Date().toISOString(),
    position: {
      x: clamp(Number(photo.position?.x ?? 50), 0, 100),
      y: clamp(Number(photo.position?.y ?? 50), 0, 100),
    },
    bearingDegrees: Number(photo.bearingDegrees ?? 0),
  };
}

function normaliseGeoCoordinate(
  coordinate: GeoCoordinate,
): GeoCoordinate {
  return {
    latitude: Number(coordinate.latitude ?? 0),
    longitude: Number(coordinate.longitude ?? 0),
    accuracyMetres: Math.max(0, Number(coordinate.accuracyMetres ?? 0)),
    altitudeMetres:
      coordinate.altitudeMetres === undefined
        ? null
        : coordinate.altitudeMetres,
    headingDegrees:
      coordinate.headingDegrees === undefined
        ? null
        : coordinate.headingDegrees,
    speedMetresPerSecond:
      coordinate.speedMetresPerSecond === undefined
        ? null
        : coordinate.speedMetresPerSecond,
    capturedAt: coordinate.capturedAt || new Date().toISOString(),
  };
}

function normaliseFieldCalibration(
  calibration: FieldSceneCalibration,
): FieldSceneCalibration {
  return {
    ...calibration,
    id: calibration.id || createId("field-calibration"),
    origin: normaliseGeoCoordinate(calibration.origin),
    directionReference: normaliseGeoCoordinate(calibration.directionReference),
    widthReference: calibration.widthReference
      ? normaliseGeoCoordinate(calibration.widthReference)
      : undefined,
    sceneWidthMetres: Math.max(1, Number(calibration.sceneWidthMetres ?? 60)),
    sceneHeightMetres: Math.max(1, Number(calibration.sceneHeightMetres ?? 60)),
    rotationDegrees: Number(calibration.rotationDegrees ?? 0),
    directionReferenceDistanceMetres: Math.max(
      0,
      Number(calibration.directionReferenceDistanceMetres ?? 0),
    ),
    widthReferenceDistanceMetres:
      calibration.widthReferenceDistanceMetres === undefined
        ? undefined
        : Math.max(0, Number(calibration.widthReferenceDistanceMetres)),
    yAxisSide: calibration.yAxisSide ?? "Left",
    createdAt: calibration.createdAt || new Date().toISOString(),
    createdBy: calibration.createdBy ?? "",
  };
}

function normaliseFieldPlacement(
  placement: FieldPlacementRecord,
): FieldPlacementRecord {
  return {
    ...placement,
    id: placement.id || createId("field-placement"),
    coordinate: normaliseGeoCoordinate(placement.coordinate),
    scenePosition: {
      x: clamp(Number(placement.scenePosition?.x ?? 50), 0, 100),
      y: clamp(Number(placement.scenePosition?.y ?? 50), 0, 100),
    },
    rawScenePosition: placement.rawScenePosition
      ? {
          x: Number(placement.rawScenePosition.x ?? placement.scenePosition?.x ?? 50),
          y: Number(placement.rawScenePosition.y ?? placement.scenePosition?.y ?? 50),
        }
      : undefined,
    sampleCount: Math.max(1, Number(placement.sampleCount ?? 1)),
    averageAccuracyMetres: Math.max(
      0,
      Number(placement.averageAccuracyMetres ?? placement.coordinate?.accuracyMetres ?? 0),
    ),
    bestAccuracyMetres: Math.max(
      0,
      Number(placement.bestAccuracyMetres ?? placement.coordinate?.accuracyMetres ?? 0),
    ),
    observedSpreadMetres:
      placement.observedSpreadMetres === undefined
        ? undefined
        : Math.max(0, Number(placement.observedSpreadMetres)),
    estimatedUncertaintyMetres:
      placement.estimatedUncertaintyMetres === undefined
        ? undefined
        : Math.max(0, Number(placement.estimatedUncertaintyMetres)),
    rawSamples: Array.isArray(placement.rawSamples)
      ? placement.rawSamples.map(normaliseGeoCoordinate)
      : undefined,
    rejectedSamples: Array.isArray(placement.rejectedSamples)
      ? placement.rejectedSamples.map((sample) => ({
          coordinate: normaliseGeoCoordinate(sample.coordinate),
          reason: sample.reason,
        }))
      : undefined,
    method: placement.method ?? "Single GPS",
    acceptedPoorAccuracy: placement.acceptedPoorAccuracy ?? false,
    manuallyAdjusted: placement.manuallyAdjusted ?? false,
    originalScenePosition: placement.originalScenePosition
      ? {
          x: clamp(Number(placement.originalScenePosition.x ?? 50), 0, 100),
          y: clamp(Number(placement.originalScenePosition.y ?? 50), 0, 100),
        }
      : undefined,
    confirmedAt: placement.confirmedAt || new Date().toISOString(),
    confirmedBy: placement.confirmedBy ?? "",
  };
}

function normaliseFieldWalkingTrack(
  track: FieldWalkingTrack,
): FieldWalkingTrack {
  return {
    ...track,
    id: track.id || createId("field-track"),
    captureMode: track.captureMode ?? "Line",
    coordinates: Array.isArray(track.coordinates)
      ? track.coordinates.map(normaliseGeoCoordinate)
      : [],
    rawCoordinates: Array.isArray(track.rawCoordinates)
      ? track.rawCoordinates.map(normaliseGeoCoordinate)
      : undefined,
    rejectedCoordinates: Array.isArray(track.rejectedCoordinates)
      ? track.rejectedCoordinates.map((sample) => ({
          coordinate: normaliseGeoCoordinate(sample.coordinate),
          reason: sample.reason,
        }))
      : undefined,
    scenePoints: Array.isArray(track.scenePoints)
      ? track.scenePoints.map((point) => ({
          x: clamp(Number(point.x ?? 50), 0, 100),
          y: clamp(Number(point.y ?? 50), 0, 100),
        }))
      : [],
    rawScenePoints: Array.isArray(track.rawScenePoints)
      ? track.rawScenePoints.map((point) => ({
          x: Number(point.x ?? 50),
          y: Number(point.y ?? 50),
        }))
      : undefined,
    startedAt: track.startedAt || new Date().toISOString(),
    completedAt: track.completedAt || new Date().toISOString(),
    distanceMetres: Math.max(0, Number(track.distanceMetres ?? 0)),
    rawDistanceMetres:
      track.rawDistanceMetres === undefined
        ? undefined
        : Math.max(0, Number(track.rawDistanceMetres)),
    areaSquareMetres:
      track.areaSquareMetres === undefined
        ? undefined
        : Math.max(0, Number(track.areaSquareMetres)),
    closedBoundary: track.closedBoundary ?? false,
    averageAccuracyMetres: Math.max(
      0,
      Number(track.averageAccuracyMetres ?? 0),
    ),
    bestAccuracyMetres: Math.max(0, Number(track.bestAccuracyMetres ?? 0)),
    estimatedUncertaintyMetres:
      track.estimatedUncertaintyMetres === undefined
        ? undefined
        : Math.max(0, Number(track.estimatedUncertaintyMetres)),
    processingMethod: track.processingMethod ?? "Legacy walking trace",
    recordedBy: track.recordedBy ?? "",
  };
}


function normaliseCollisionSetup(
  setup?: CollisionSetup,
): CollisionSetup {
  return {
    source: setup?.source ?? "Manual",
    confirmed: setup?.confirmed ?? false,
    locked: setup?.locked ?? false,
    toleranceMetres: Math.max(0.2, Number(setup?.toleranceMetres ?? 2)),
    notes: setup?.notes ?? "",
    lastCalculatedAt: setup?.lastCalculatedAt,
  };
}

function normalisePhysicsSettings(
  settings?: ReconstructionPhysicsSettings,
): ReconstructionPhysicsSettings {
  return {
    ...DEFAULT_PHYSICS_SETTINGS,
    ...(settings ?? {}),
    timeStepSeconds: clamp(
      Number(settings?.timeStepSeconds ?? DEFAULT_PHYSICS_SETTINGS.timeStepSeconds),
      0.04,
      0.5,
    ),
    collisionToleranceMetres: Math.max(
      0.2,
      Number(
        settings?.collisionToleranceMetres ??
          DEFAULT_PHYSICS_SETTINGS.collisionToleranceMetres,
      ),
    ),
    globalFrictionMultiplier: Math.max(
      0.1,
      Number(
        settings?.globalFrictionMultiplier ??
          DEFAULT_PHYSICS_SETTINGS.globalFrictionMultiplier,
      ),
    ),
    airDrag: Math.max(
      0,
      Number(settings?.airDrag ?? DEFAULT_PHYSICS_SETTINGS.airDrag),
    ),
    stopSpeedKmh: Math.max(
      0.5,
      Number(settings?.stopSpeedKmh ?? DEFAULT_PHYSICS_SETTINGS.stopSpeedKmh),
    ),
  };
}

function isReconstructionRecord(
  value: unknown,
): value is AccidentReconstruction {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof (value as Partial<AccidentReconstruction>).id === "string",
  );
}

function normaliseReconstruction(
  reconstruction: AccidentReconstruction,
): AccidentReconstruction {
  const durationSeconds = Math.max(2, Number(reconstruction.durationSeconds ?? 6));
  const scene = {
    ...createDefaultRoadSceneSettings(),
    ...(reconstruction.scene ?? {}),
  };

  return {
    ...reconstruction,
    durationSeconds,
    scene,
    vehicles: Array.isArray(reconstruction.vehicles)
      ? reconstruction.vehicles.map((participant) =>
          normaliseParticipant(participant, durationSeconds),
        )
      : [],
    sceneObjects: Array.isArray(reconstruction.sceneObjects)
      ? reconstruction.sceneObjects.map(normaliseSceneObject)
      : [],
    timelineEvents: Array.isArray(reconstruction.timelineEvents)
      ? reconstruction.timelineEvents.map((event) =>
          normaliseTimelineEvent(event, durationSeconds),
        )
      : [],
    measurements: Array.isArray(reconstruction.measurements)
      ? reconstruction.measurements.map((measurement, index) =>
          normaliseMeasurement(
            measurement,
            index,
            scene.sceneWidthMetres,
            scene.sceneHeightMetres,
          ),
        )
      : [],
    evidenceRecords: Array.isArray(reconstruction.evidenceRecords)
      ? reconstruction.evidenceRecords.map(normaliseEvidenceRecord)
      : [],
    photos: Array.isArray(reconstruction.photos)
      ? reconstruction.photos.map(normalisePhoto)
      : [],
    fieldCalibration: reconstruction.fieldCalibration
      ? normaliseFieldCalibration(reconstruction.fieldCalibration)
      : undefined,
    fieldPlacements: Array.isArray(reconstruction.fieldPlacements)
      ? reconstruction.fieldPlacements.map(normaliseFieldPlacement)
      : [],
    fieldWalkingTracks: Array.isArray(reconstruction.fieldWalkingTracks)
      ? reconstruction.fieldWalkingTracks.map(normaliseFieldWalkingTrack)
      : [],
    collisionSetup: normaliseCollisionSetup(reconstruction.collisionSetup),
    physicsSettings: normalisePhysicsSettings(reconstruction.physicsSettings),
    lastPhysicsSimulation: reconstruction.lastPhysicsSimulation,
  };
}

function readLocalReconstructions(): AccidentReconstruction[] {
  try {
    const storedValue = localStorage.getItem(STORAGE_KEY);

    if (!storedValue) {
      return [];
    }

    const parsedValue = JSON.parse(storedValue) as AccidentReconstruction[];

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.flatMap((record, index) => {
      if (!isReconstructionRecord(record)) {
        console.warn(
          `Ignoring corrupted reconstruction record at storage index ${index}.`,
          record,
        );
        return [];
      }

      try {
        return [normaliseReconstruction(record)];
      } catch (error) {
        console.warn(
          `Ignoring reconstruction ${record.id} because it could not be normalised.`,
          error,
        );
        return [];
      }
    });
  } catch (error) {
    console.error("Failed to read reconstructions:", error);
    return [];
  }
}

function writeLocalReconstructions(
  reconstructions: AccidentReconstruction[],
): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reconstructions));
}

export const ReconstructionService = {
  getAll(): AccidentReconstruction[] {
    const localRecords = readLocalReconstructions();
    const records = new Map<string, AccidentReconstruction>();

    reconstructionData.forEach((reconstruction, index) => {
      if (!isReconstructionRecord(reconstruction)) {
        console.warn(
          `Ignoring corrupted bundled reconstruction at index ${index}.`,
          reconstruction,
        );
        return;
      }

      try {
        records.set(reconstruction.id, normaliseReconstruction(reconstruction));
      } catch (error) {
        console.warn(
          `Ignoring bundled reconstruction ${reconstruction.id} because it could not be normalised.`,
          error,
        );
      }
    });

    localRecords.forEach((reconstruction) => {
      records.set(reconstruction.id, reconstruction);
    });

    return Array.from(records.values());
  },

  getById(reconstructionId: string): AccidentReconstruction | null {
    return (
      this.getAll().find(
        (reconstruction) => reconstruction.id === reconstructionId,
      ) ?? null
    );
  },

  save(reconstruction: AccidentReconstruction): AccidentReconstruction {
    const existingRecords = readLocalReconstructions();
    const now = new Date().toISOString();

    const updatedRecord = normaliseReconstruction({
      ...reconstruction,
      updatedAt: now,
      createdAt: reconstruction.createdAt || now,
    });

    const recordIndex = existingRecords.findIndex(
      (record) => record.id === reconstruction.id,
    );

    if (recordIndex >= 0) {
      existingRecords[recordIndex] = updatedRecord;
    } else {
      existingRecords.push(updatedRecord);
    }

    writeLocalReconstructions(existingRecords);
    return updatedRecord;
  },

  delete(reconstructionId: string): void {
    const remainingRecords = readLocalReconstructions().filter(
      (record) => record.id !== reconstructionId,
    );

    writeLocalReconstructions(remainingRecords);
  },
};