import type {
  AccidentReconstruction,
  ReconstructionPosition,
  ScenePhotoAttachment,
  ScenePhotoConstraint,
  ScenePhotoConstraintKind,
} from "../types/reconstruction";

import {
  updateParticipantAuthoredPoint,
  updateReconstructionCollisionPoint,
} from "../utils/reconstructionPointZIntegration";

import {
  clamp,
} from "../utils/reconstructionGeometry";

export interface ApplyPhotoConstraintResult {
  reconstruction: AccidentReconstruction;
  constraint: ScenePhotoConstraint;
  message: string;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalisePoint(
  point: ReconstructionPosition,
): ReconstructionPosition {
  return {
    x: clamp(Number(point.x ?? 50), 0, 100),
    y: clamp(Number(point.y ?? 50), 0, 100),
  };
}

function describePoint(
  point: ReconstructionPosition,
): string {
  return `(${point.x.toFixed(2)}, ${point.y.toFixed(2)})`;
}

export function createScenePhotoConstraint({
  photo,
  kind = "Primary Impact Point",
  index = 0,
}: {
  photo: ScenePhotoAttachment;
  kind?: ScenePhotoConstraintKind;
  index?: number;
}): ScenePhotoConstraint {
  return {
    id: createId("photo-constraint"),
    photoId: photo.id,
    kind,
    label: `Photo observation ${index + 1}`,
    status: "Draft",
    confidence: "Medium",
    imagePoint: { x: 50, y: 50 },
    scenePosition: normalisePoint(photo.position ?? { x: 50, y: 50 }),
    notes: "",
    createdAt: new Date().toISOString(),
  };
}

function replaceConstraint(
  reconstruction: AccidentReconstruction,
  updatedConstraint: ScenePhotoConstraint,
): AccidentReconstruction {
  const current = reconstruction.photoConstraints ?? [];

  return {
    ...reconstruction,
    photoConstraints: current.some(
      (constraint) => constraint.id === updatedConstraint.id,
    )
      ? current.map((constraint) =>
          constraint.id === updatedConstraint.id
            ? updatedConstraint
            : constraint,
        )
      : [...current, updatedConstraint],
  };
}

export function applyScenePhotoConstraint({
  reconstruction,
  constraint,
}: {
  reconstruction: AccidentReconstruction;
  constraint: ScenePhotoConstraint;
}): ApplyPhotoConstraintResult {
  if (constraint.status !== "Confirmed") {
    throw new Error(
      "Confirm the photo observation before applying it to the reconstruction.",
    );
  }

  const appliedAt = new Date().toISOString();
  const scenePosition = normalisePoint(constraint.scenePosition);
  let next = reconstruction;
  let summary = "";

  switch (constraint.kind) {
    case "Primary Impact Point": {
      const before = reconstruction.collisionPoint;

      next = updateReconstructionCollisionPoint({
        reconstruction,
        collisionPosition: scenePosition,
        source: "Manual",
        confirmed: true,
        locked: reconstruction.collisionSetup?.locked ?? false,
      });

      summary =
        `Photo-confirmed primary impact point changed from ${describePoint(before)} ` +
        `to ${describePoint(scenePosition)}.`;
      break;
    }

    case "Participant Path Point": {
      if (!constraint.participantId || !constraint.pathPointId) {
        throw new Error(
          "Choose both a participant and one of its path points before applying this photo observation.",
        );
      }

      const participant = reconstruction.vehicles.find(
        (item) => item.id === constraint.participantId,
      );
      const point = participant?.pathPoints.find(
        (item) => item.id === constraint.pathPointId,
      );

      if (!participant || !point) {
        throw new Error(
          "The participant path point linked to this photo observation no longer exists.",
        );
      }

      next = updateParticipantAuthoredPoint({
        reconstruction,
        participantId: participant.id,
        pointId: point.id,
        updates: {
          position: scenePosition,
        },
      });

      summary =
        `${participant.name} · ${point.label} moved from ${describePoint(point.position)} ` +
        `to ${describePoint(scenePosition)} from confirmed photo evidence.`;
      break;
    }

    case "Participant Heading": {
      if (!constraint.participantId || !constraint.pathPointId) {
        throw new Error(
          "Choose both a participant and one of its path points before applying a photo heading.",
        );
      }

      const participant = reconstruction.vehicles.find(
        (item) => item.id === constraint.participantId,
      );
      const point = participant?.pathPoints.find(
        (item) => item.id === constraint.pathPointId,
      );

      if (!participant || !point) {
        throw new Error(
          "The participant path point linked to this photo heading no longer exists.",
        );
      }

      const heading = ((Number(constraint.headingDegrees ?? point.rotation) % 360) + 360) % 360;

      next = updateParticipantAuthoredPoint({
        reconstruction,
        participantId: participant.id,
        pointId: point.id,
        updates: {
          rotation: heading,
        },
      });

      summary =
        `${participant.name} · ${point.label} heading changed from ${point.rotation.toFixed(1)}° ` +
        `to ${heading.toFixed(1)}° from confirmed photo evidence.`;
      break;
    }

    case "Scene Object Position": {
      if (!constraint.sceneObjectId) {
        throw new Error(
          "Choose a scene object before applying this photo observation.",
        );
      }

      const object = reconstruction.sceneObjects.find(
        (item) => item.id === constraint.sceneObjectId,
      );

      if (!object) {
        throw new Error(
          "The scene object linked to this photo observation no longer exists.",
        );
      }

      next = {
        ...reconstruction,
        lastPhysicsSimulation: undefined,
        sceneObjects: reconstruction.sceneObjects.map((item) =>
          item.id === object.id
            ? {
                ...item,
                position: scenePosition,
              }
            : item,
        ),
      };

      summary =
        `${object.label} moved from ${describePoint(object.position)} ` +
        `to ${describePoint(scenePosition)} from confirmed photo evidence.`;
      break;
    }

    case "Evidence Position": {
      if (!constraint.evidenceId) {
        throw new Error(
          "Choose an evidence record before applying this photo observation.",
        );
      }

      const evidence = reconstruction.evidenceRecords.find(
        (item) => item.id === constraint.evidenceId,
      );

      if (!evidence) {
        throw new Error(
          "The evidence record linked to this photo observation no longer exists.",
        );
      }

      next = {
        ...reconstruction,
        evidenceRecords: reconstruction.evidenceRecords.map((item) =>
          item.id === evidence.id
            ? {
                ...item,
                position: scenePosition,
              }
            : item,
        ),
      };

      summary =
        `Evidence E-${evidence.evidenceNumber} moved from ${describePoint(evidence.position)} ` +
        `to ${describePoint(scenePosition)} from confirmed photo evidence.`;
      break;
    }

    default: {
      const exhaustive: never = constraint.kind;
      throw new Error(`Unsupported photo constraint: ${String(exhaustive)}`);
    }
  }

  const appliedConstraint: ScenePhotoConstraint = {
    ...constraint,
    scenePosition,
    status: "Applied",
    appliedAt,
    applicationSummary: summary,
  };

  next = replaceConstraint(next, appliedConstraint);

  return {
    reconstruction: next,
    constraint: appliedConstraint,
    message: summary,
  };
}
