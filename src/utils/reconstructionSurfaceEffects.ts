import type {
  AccidentReconstruction,
  ReconstructionPosition,
  ReconstructionVehicle,
  SceneObjectSeverity,
} from "../types/reconstruction";

import { getReconstructionWorldDimensions } from "./reconstructionWorldScale";

export interface ParticipantPotholeEffect {
  active: boolean;
  objectId?: string;
  intensity: number;
  verticalMetres: number;
  pitchDegrees: number;
  rollDegrees: number;
  screenShakePixels: number;
}

const NO_POTHOLE_EFFECT: ParticipantPotholeEffect = {
  active: false,
  intensity: 0,
  verticalMetres: 0,
  pitchDegrees: 0,
  rollDegrees: 0,
  screenShakePixels: 0,
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function severityStrength(severity: SceneObjectSeverity): number {
  if (severity === "Critical") return 1;
  if (severity === "High") return 0.8;
  if (severity === "Medium") return 0.58;
  return 0.36;
}

function stablePhase(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return (Math.abs(hash) % 628) / 100;
}

export function getParticipantPotholeEffect(
  reconstruction: AccidentReconstruction,
  participant: ReconstructionVehicle,
  position: ReconstructionPosition,
  speedKmh: number,
  timeSeconds: number,
): ParticipantPotholeEffect {
  const potholes = reconstruction.sceneObjects.filter(
    (object) => object.visible && object.type === "Pothole",
  );
  if (potholes.length === 0 || speedKmh < 0.5) return NO_POTHOLE_EFFECT;

  const { widthMetres, heightMetres } =
    getReconstructionWorldDimensions(reconstruction);
  const participantRadius = Math.max(
    0.28,
    participant.physics?.collisionRadiusMetres ??
      (participant.physics?.widthMetres ?? 1.8) / 2,
  );

  let strongest: ParticipantPotholeEffect = NO_POTHOLE_EFFECT;

  potholes.forEach((pothole) => {
    const dx = ((position.x - pothole.position.x) / 100) * widthMetres;
    const dy = ((position.y - pothole.position.y) / 100) * heightMetres;
    const distanceMetres = Math.hypot(dx, dy);
    const diameter = Math.max(
      0.35,
      Number(
        pothole.widthMetres ??
          pothole.physics?.widthMetres ??
          pothole.scale * 1.8,
      ),
    );
    const interactionRadius = diameter / 2 + participantRadius * 0.72;
    if (distanceMetres > interactionRadius) return;

    const penetration = clamp(
      1 - distanceMetres / Math.max(0.05, interactionRadius),
      0,
      1,
    );
    const speedStrength = clamp(speedKmh / 45, 0.25, 1);
    const intensity =
      penetration * severityStrength(pothole.severity) * speedStrength;
    if (intensity <= strongest.intensity) return;

    const phase = timeSeconds * (17 + speedStrength * 7) +
      stablePhase(participant.id + pothole.id);
    const verticalWave = Math.abs(Math.sin(phase * 1.7));
    const pitchWave = Math.sin(phase);
    const rollWave = Math.sin(phase * 1.31 + 0.8);

    strongest = {
      active: true,
      objectId: pothole.id,
      intensity,
      verticalMetres: verticalWave * (0.05 + 0.16 * intensity),
      pitchDegrees: pitchWave * (1.4 + 5.2 * intensity),
      rollDegrees: rollWave * (0.8 + 3.8 * intensity),
      screenShakePixels: 0.6 + 4.2 * intensity,
    };
  });

  return strongest;
}
