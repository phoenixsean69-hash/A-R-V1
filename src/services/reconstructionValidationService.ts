import type {
  AccidentReconstruction,
  MovementPathPoint,
  ReconstructionVehicle,
} from "../types/reconstruction";
import { calculateSceneDistanceMetres } from "../utils/evidenceGeometry";
import { sortMovementPathPoints } from "../utils/reconstructionGeometry";
import { getDefaultParticipantPhysics } from "./reconstructionPhysicsService";

export type ValidationSeverity = "Critical" | "Warning" | "Advisory";

export interface ReconstructionValidationIssue {
  id: string;
  severity: ValidationSeverity;
  participantId?: string;
  title: string;
  detail: string;
}

export interface ValidationAssumptions {
  reactionTimeSeconds: number;
  frictionCoefficient: number;
}

export interface ParticipantForensicMetrics {
  participantId: string;
  participantName: string;
  pathDistanceMetres: number;
  impactSpeedKmh: number;
  maximumAccelerationMps2: number;
  maximumDecelerationMps2: number;
  reactionDistanceMetres: number;
  brakingDistanceMetres: number;
  stoppingDistanceMetres: number;
  stoppingDistanceRangeMetres: [number, number];
  availableBrakeDistanceMetres: number | null;
  estimatedPreBrakeSpeedKmh: number | null;
}

export interface ReconstructionValidationResult {
  issues: ReconstructionValidationIssue[];
  participants: ParticipantForensicMetrics[];
  impactTimeSpreadSeconds: number | null;
  passedChecks: number;
  totalChecks: number;
}

export function getSuggestedFrictionCoefficient(
  reconstruction: AccidentReconstruction,
): number {
  if (reconstruction.scene.roadSurface === "Wet") return 0.45;
  if (reconstruction.scene.roadSurface === "Damaged") return 0.55;
  return 0.75;
}

function distanceBetween(
  reconstruction: AccidentReconstruction,
  start: MovementPathPoint,
  end: MovementPathPoint,
): number {
  return calculateSceneDistanceMetres(start.position, end.position, reconstruction.scene);
}

function calculateParticipant(
  reconstruction: AccidentReconstruction,
  participant: ReconstructionVehicle,
  assumptions: ValidationAssumptions,
  issues: ReconstructionValidationIssue[],
): ParticipantForensicMetrics {
  const points = sortMovementPathPoints(participant.pathPoints);
  const profile = { ...getDefaultParticipantPhysics(participant), ...(participant.physics ?? {}) };
  let pathDistanceMetres = 0;
  let maximumAccelerationMps2 = 0;
  let maximumDecelerationMps2 = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const distance = distanceBetween(reconstruction, start, end);
    const duration = end.timeSeconds - start.timeSeconds;
    pathDistanceMetres += distance;

    if (duration <= 0) {
      issues.push({
        id: `${participant.id}-time-${index}`,
        severity: "Critical",
        participantId: participant.id,
        title: "Invalid point timing",
        detail: `${start.label} and ${end.label} must have increasing times.`,
      });
      continue;
    }

    const startSpeed = start.speedKmh / 3.6;
    const endSpeed = (end.action === "Stop" ? 0 : end.speedKmh) / 3.6;
    const acceleration = (endSpeed - startSpeed) / duration;
    maximumAccelerationMps2 = Math.max(maximumAccelerationMps2, acceleration);
    maximumDecelerationMps2 = Math.max(maximumDecelerationMps2, -acceleration);

    const expectedDistance = ((startSpeed + endSpeed) / 2) * duration;
    const mismatch = Math.abs(expectedDistance - distance);
    if (distance > 2 && mismatch > Math.max(5, distance * 0.45)) {
      issues.push({
        id: `${participant.id}-distance-${index}`,
        severity: "Warning",
        participantId: participant.id,
        title: "Speed and distance disagree",
        detail: `${start.label} → ${end.label} covers ${distance.toFixed(1)} m, but the entered speeds and timing imply about ${expectedDistance.toFixed(1)} m.`,
      });
    }
  }

  if (maximumAccelerationMps2 > 4.5) {
    issues.push({
      id: `${participant.id}-acceleration`,
      severity: "Warning",
      participantId: participant.id,
      title: "High acceleration",
      detail: `${participant.name} reaches ${maximumAccelerationMps2.toFixed(1)} m/s², above a typical road-vehicle acceleration range.`,
    });
  }
  if (maximumDecelerationMps2 > profile.brakingDecelerationMps2 * 1.2) {
    issues.push({
      id: `${participant.id}-deceleration`,
      severity: "Critical",
      participantId: participant.id,
      title: "Stopping demand exceeds profile",
      detail: `${maximumDecelerationMps2.toFixed(1)} m/s² is required; the configured braking capability is ${profile.brakingDecelerationMps2.toFixed(1)} m/s².`,
    });
  }

  const impact = points.find((point) => point.action === "Impact");
  const impactSpeedKmh = impact?.speedKmh ?? participant.estimatedSpeedKmh;
  const impactSpeedMps = impactSpeedKmh / 3.6;
  const reactionDistanceMetres = impactSpeedMps * assumptions.reactionTimeSeconds;
  const brakingDistanceMetres = (impactSpeedMps ** 2) / (2 * 9.81 * assumptions.frictionCoefficient);
  const lowFriction = Math.max(0.15, assumptions.frictionCoefficient - 0.12);
  const highFriction = Math.min(1.05, assumptions.frictionCoefficient + 0.12);
  const reactionLow = impactSpeedMps * Math.max(0.5, assumptions.reactionTimeSeconds - 0.5);
  const reactionHigh = impactSpeedMps * (assumptions.reactionTimeSeconds + 0.5);
  const stoppingRange: [number, number] = [
    reactionLow + impactSpeedMps ** 2 / (2 * 9.81 * highFriction),
    reactionHigh + impactSpeedMps ** 2 / (2 * 9.81 * lowFriction),
  ];

  const brakeIndex = points.findIndex((point) => point.action === "Brake");
  const stopIndex = points.findIndex((point, index) => index > brakeIndex && (point.action === "Impact" || point.action === "Stop"));
  let availableBrakeDistanceMetres: number | null = null;
  if (brakeIndex >= 0 && stopIndex > brakeIndex) {
    availableBrakeDistanceMetres = 0;
    for (let index = brakeIndex; index < stopIndex; index += 1) {
      availableBrakeDistanceMetres += distanceBetween(reconstruction, points[index], points[index + 1]);
    }
    if (availableBrakeDistanceMetres + 0.5 < brakingDistanceMetres) {
      issues.push({
        id: `${participant.id}-braking-distance`,
        severity: "Warning",
        participantId: participant.id,
        title: "Insufficient authored braking distance",
        detail: `${availableBrakeDistanceMetres.toFixed(1)} m is shown before ${points[stopIndex].action.toLowerCase()}, while the selected assumptions require about ${brakingDistanceMetres.toFixed(1)} m from ${impactSpeedKmh.toFixed(0)} km/h.`,
      });
    }
  }

  const finalSpeedMps = impact?.speedKmh ? impact.speedKmh / 3.6 : 0;
  const estimatedPreBrakeSpeedKmh = availableBrakeDistanceMetres === null
    ? null
    : Math.sqrt(finalSpeedMps ** 2 + 2 * 9.81 * assumptions.frictionCoefficient * availableBrakeDistanceMetres) * 3.6;

  return {
    participantId: participant.id,
    participantName: participant.name,
    pathDistanceMetres,
    impactSpeedKmh,
    maximumAccelerationMps2,
    maximumDecelerationMps2,
    reactionDistanceMetres,
    brakingDistanceMetres,
    stoppingDistanceMetres: reactionDistanceMetres + brakingDistanceMetres,
    stoppingDistanceRangeMetres: stoppingRange,
    availableBrakeDistanceMetres,
    estimatedPreBrakeSpeedKmh,
  };
}

export function validateReconstruction(
  reconstruction: AccidentReconstruction,
  assumptions: ValidationAssumptions,
): ReconstructionValidationResult {
  const issues: ReconstructionValidationIssue[] = [];
  const impactTimes = reconstruction.vehicles
    .map((participant) => sortMovementPathPoints(participant.pathPoints).find((point) => point.action === "Impact")?.timeSeconds)
    .filter((time): time is number => time !== undefined);
  const impactTimeSpreadSeconds = impactTimes.length > 1
    ? Math.max(...impactTimes) - Math.min(...impactTimes)
    : null;

  if (impactTimeSpreadSeconds !== null && impactTimeSpreadSeconds > 0.25) {
    issues.push({
      id: "impact-time-spread",
      severity: impactTimeSpreadSeconds > 1 ? "Critical" : "Warning",
      title: "Participants do not arrive together",
      detail: `Impact points are ${impactTimeSpreadSeconds.toFixed(2)} seconds apart. Align their impact times for a simultaneous collision.`,
    });
  }

  for (const participant of reconstruction.vehicles) {
    if (!participant.pathPoints.some((point) => point.action === "Impact")) {
      issues.push({
        id: `${participant.id}-missing-impact`,
        severity: "Advisory",
        participantId: participant.id,
        title: "No impact point",
        detail: `${participant.name} has no path point marked as Impact.`,
      });
    }
  }

  const participants = reconstruction.vehicles.map((participant) =>
    calculateParticipant(reconstruction, participant, assumptions, issues),
  );
  const totalChecks = Math.max(1, reconstruction.vehicles.length * 4 + 1);

  return {
    issues,
    participants,
    impactTimeSpreadSeconds,
    passedChecks: Math.max(0, totalChecks - issues.length),
    totalChecks,
  };
}
