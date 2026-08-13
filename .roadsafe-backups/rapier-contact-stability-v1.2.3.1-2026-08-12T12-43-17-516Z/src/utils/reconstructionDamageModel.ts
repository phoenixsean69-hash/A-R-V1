/*
 * [RoadSafe:RapierBodyDamageVisualV1]
 *
 * This module derives a conservative VISUAL damage cue after Rapier has
 * confirmed a real rigid-body contact. It does not claim to predict real
 * structural crush, repair cost, injury, or crashworthiness.
 */

import type {
  ParticipantImpactResponse,
  ParticipantVisualDamageState,
  PhysicsSimulationSummary,
  ReconstructionVehicle,
} from "../types/reconstruction";

import {
  getParticipantPhysicalDimensions,
} from "../engine/assets/participantAssetCatalog";

interface DamageDerivationOptions {
  summary:
    PhysicsSimulationSummary | undefined;
  participants:
    ReconstructionVehicle[];
  participantIdsWithRigidBodyContact:
    ReadonlySet<string>;
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      value,
    ),
  );
}

function isRigidVehicle(
  participant:
    ReconstructionVehicle,
): boolean {
  return (
    participant.type ===
      "Car" ||
    participant.type ===
      "Bus" ||
    participant.type ===
      "Truck" ||
    participant.type ===
      "Motorcycle" ||
    participant.type ===
      "Bicycle"
  );
}

function findEarliestResponse(
  summary:
    PhysicsSimulationSummary,
  participantId: string,
): {
  collisionEventId: string;
  response:
    ParticipantImpactResponse;
} | null {
  const events =
    [...summary.collisionEvents]
      .sort(
        (left, right) =>
          left.timeSeconds -
          right.timeSeconds,
      );

  for (
    const event
    of events
  ) {
    const response =
      event
        .impactResponses
        ?.find(
          (candidate) =>
            candidate
              .participantId ===
            participantId,
        );

    if (response) {
      return {
        collisionEventId:
          event.id,
        response,
      };
    }
  }

  return null;
}

function damageSeverity(
  response:
    ParticipantImpactResponse,
): ParticipantVisualDamageState["severity"] {
  const deltaV =
    response
      .deltaVMetresPerSecond;

  const energy =
    response
      .estimatedEnergyKj;

  /*
   * These thresholds are deliberately conservative and exist only to make
   * RoadSafe's visual feedback scale with an already-computed impact response.
   * They are not an accident-reconstruction damage standard.
   */
  if (
    deltaV >= 10 ||
    energy >= 95
  ) {
    return "Critical";
  }

  if (
    deltaV >= 6 ||
    energy >= 45
  ) {
    return "Severe";
  }

  if (
    deltaV >= 3 ||
    energy >= 16
  ) {
    return "Moderate";
  }

  return "Minor";
}

function crushDepth(
  participant:
    ReconstructionVehicle,
  response:
    ParticipantImpactResponse,
  severity:
    ParticipantVisualDamageState["severity"],
): number {
  const length =
    Math.max(
      0.5,
      getParticipantPhysicalDimensions(
        participant,
      ).lengthMetres,
    );

  const base =
    severity ===
      "Critical"
      ? 0.62
      : severity ===
          "Severe"
        ? 0.4
        : severity ===
            "Moderate"
          ? 0.22
          : 0.08;

  const deltaVFactor =
    clamp(
      response
        .deltaVMetresPerSecond /
        12,
      0,
      1,
    );

  const energyFactor =
    clamp(
      response
        .estimatedEnergyKj /
        120,
      0,
      1,
    );

  const scaled =
    base *
    (
      0.72 +
      Math.max(
        deltaVFactor,
        energyFactor,
      ) *
        0.55
    );

  return Number(
    clamp(
      scaled,
      0.04,
      length *
        0.18,
    ).toFixed(3),
  );
}

export function deriveParticipantVisualDamage({
  summary,
  participants,
  participantIdsWithRigidBodyContact,
}: DamageDerivationOptions):
  ParticipantVisualDamageState[] {
  if (!summary) {
    return [];
  }

  const damage:
    ParticipantVisualDamageState[] =
      [];

  participants.forEach(
    (participant) => {
      if (
        !isRigidVehicle(
          participant,
        ) ||
        !participantIdsWithRigidBodyContact.has(
          participant.id,
        )
      ) {
        return;
      }

      const matched =
        findEarliestResponse(
          summary,
          participant.id,
        );

      if (!matched) {
        return;
      }

      const severity =
        damageSeverity(
          matched.response,
        );

      damage.push({
        participantId:
          participant.id,

        collisionEventId:
          matched
            .collisionEventId,

        timeSeconds:
          matched
            .response
            .timeSeconds,

        contactZone:
          matched
            .response
            .contactZone,

        severity,

        crushDepthMetres:
          crushDepth(
            participant,
            matched.response,
            severity,
          ),

        deltaVMetresPerSecond:
          Number(
            matched
              .response
              .deltaVMetresPerSecond
              .toFixed(3),
          ),

        impulseMagnitudeNs:
          Number(
            matched
              .response
              .impulseMagnitudeNs
              .toFixed(2),
          ),

        estimatedEnergyKj:
          Number(
            matched
              .response
              .estimatedEnergyKj
              .toFixed(3),
          ),

        source:
          "Rapier Body Contact + RoadSafe Forensic Response",

        visualOnly:
          true,
      });
    },
  );

  return damage;
}
