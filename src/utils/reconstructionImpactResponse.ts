import type {
  CollisionKinematicOutcome,
  ParticipantImpactContactZone,
  ParticipantImpactResponse,
  ParticipantImpactResponseClass,
  PhysicsVector2D,
  ReconstructionEntityType,
  ReconstructionPosition,
} from "../types/reconstruction";

/*
 * [RoadSafe:CanonicalImpactResponseBuilderV1]
 *
 * Converts the exact planar collision result into one deterministic,
 * participant-specific record. It introduces no additional displacement and
 * does not invent vertical motion. 3D and AR will consume this same record.
 */

export interface ImpactResponseParticipantChange {
  participantId: string;

  participantType:
    ReconstructionEntityType;

  impactPositionMetres:
    PhysicsVector2D;

  incomingVelocityMps:
    PhysicsVector2D;

  outgoingVelocityMps:
    PhysicsVector2D;

  impulseNs:
    PhysicsVector2D;

  angularVelocityChangeDegreesPerSecond:
    number;

  outcome:
    CollisionKinematicOutcome;
}

export interface CreateParticipantImpactResponsesInput {
  collisionEventId: string;
  timeSeconds: number;

  participantIds:
    readonly string[];

  contactPoint:
    ReconstructionPosition;

  collisionNormal:
    PhysicsVector2D;

  relativeImpactSpeedKmh:
    number;

  estimatedEnergyKj:
    number;

  widthMetres: number;
  heightMetres: number;

  changes:
    readonly ImpactResponseParticipantChange[];
}

const HUMAN_TYPES =
  new Set<ReconstructionEntityType>([
    "Pedestrian",
    "Officer",
    "Witness",
  ]);

const TWO_WHEELER_TYPES =
  new Set<ReconstructionEntityType>([
    "Bicycle",
    "Motorcycle",
  ]);

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

function finite(
  value: number,
  fallback = 0,
): number {
  return Number.isFinite(value)
    ? value
    : fallback;
}

function round(
  value: number,
  digits = 4,
): number {
  const factor =
    10 ** digits;

  return (
    Math.round(
      finite(value) *
        factor,
    ) /
    factor
  );
}

function magnitude(
  vector: PhysicsVector2D,
): number {
  return Math.hypot(
    finite(vector.x),
    finite(vector.y),
  );
}

function normalise(
  vector: PhysicsVector2D,
  fallback: PhysicsVector2D = {
    x: 1,
    y: 0,
  },
): PhysicsVector2D {
  const vectorLength =
    magnitude(vector);

  if (
    vectorLength >
    0.000001
  ) {
    return {
      x:
        vector.x /
        vectorLength,

      y:
        vector.y /
        vectorLength,
    };
  }

  const fallbackLength =
    magnitude(fallback);

  if (
    fallbackLength >
    0.000001
  ) {
    return {
      x:
        fallback.x /
        fallbackLength,

      y:
        fallback.y /
        fallbackLength,
    };
  }

  return {
    x: 1,
    y: 0,
  };
}

function dot(
  left: PhysicsVector2D,
  right: PhysicsVector2D,
): number {
  return (
    left.x *
      right.x +
    left.y *
      right.y
  );
}

function roundVector(
  vector: PhysicsVector2D,
  digits = 4,
): PhysicsVector2D {
  return {
    x:
      round(
        vector.x,
        digits,
      ),

    y:
      round(
        vector.y,
        digits,
      ),
  };
}

function scenePositionToMetres(
  position: ReconstructionPosition,
  widthMetres: number,
  heightMetres: number,
): PhysicsVector2D {
  return {
    x:
      (
        finite(
          position.x,
        ) /
        100
      ) *
      widthMetres,

    y:
      (
        finite(
          position.y,
        ) /
        100
      ) *
      heightMetres,
  };
}

function metresToScenePosition(
  position: PhysicsVector2D,
  widthMetres: number,
  heightMetres: number,
): ReconstructionPosition {
  return {
    x:
      round(
        clamp(
          (
            finite(
              position.x,
            ) /
            widthMetres
          ) *
            100,
          0,
          100,
        ),
        5,
      ),

    y:
      round(
        clamp(
          (
            finite(
              position.y,
            ) /
            heightMetres
          ) *
            100,
          0,
          100,
        ),
        5,
      ),
  };
}

function responseClassFor(
  participantType:
    ReconstructionEntityType,
): ParticipantImpactResponseClass {
  if (
    HUMAN_TYPES.has(
      participantType,
    )
  ) {
    return "Human Body";
  }

  if (
    TWO_WHEELER_TYPES.has(
      participantType,
    )
  ) {
    return "Two Wheeler";
  }

  return "Rigid Vehicle";
}

function resolveContactZone(
  change:
    ImpactResponseParticipantChange,

  contactPoint:
    ReconstructionPosition,

  participantNormal:
    PhysicsVector2D,

  widthMetres: number,
  heightMetres: number,
): ParticipantImpactContactZone {
  const contactMetres =
    scenePositionToMetres(
      contactPoint,
      widthMetres,
      heightMetres,
    );

  const offset = {
    x:
      contactMetres.x -
      change
        .impactPositionMetres
        .x,

    y:
      contactMetres.y -
      change
        .impactPositionMetres
        .y,
  };

  if (
    magnitude(
      offset,
    ) <= 0.08
  ) {
    return "Centre";
  }

  const outgoingFallback =
    magnitude(
      change
        .outgoingVelocityMps,
    ) > 0.05
      ? change
          .outgoingVelocityMps
      : {
          x:
            -participantNormal.x,

          y:
            -participantNormal.y,
        };

  const forward =
    normalise(
      change
        .incomingVelocityMps,
      outgoingFallback,
    );

  /*
   * Reconstruction world Y increases down-screen. Rotating the forward vector
   * clockwise therefore produces the participant's physical right side.
   */
  const right = {
    x:
      -forward.y,

    y:
      forward.x,
  };

  const longitudinal =
    dot(
      offset,
      forward,
    );

  const lateral =
    dot(
      offset,
      right,
    );

  const longitudinalMagnitude =
    Math.abs(
      longitudinal,
    );

  const lateralMagnitude =
    Math.abs(
      lateral,
    );

  if (
    longitudinalMagnitude >=
      Math.max(
        0.08,
        lateralMagnitude *
          0.85,
      )
  ) {
    return longitudinal >= 0
      ? "Front"
      : "Rear";
  }

  if (
    lateralMagnitude >=
    0.08
  ) {
    return lateral >= 0
      ? "Right Side"
      : "Left Side";
  }

  return "Centre";
}

export function createParticipantImpactResponses(
  input:
    CreateParticipantImpactResponsesInput,
): ParticipantImpactResponse[] {
  const widthMetres =
    Math.max(
      0.001,
      finite(
        input.widthMetres,
        1,
      ),
    );

  const heightMetres =
    Math.max(
      0.001,
      finite(
        input.heightMetres,
        1,
      ),
    );

  const eventNormal =
    normalise(
      input.collisionNormal,
    );

  return input.changes.map(
    (
      change,
    ) => {
      const participantIndex =
        input.participantIds.indexOf(
          change.participantId,
        );

      /*
       * The manifold normal points from participant A toward participant B.
       * A receives the opposite normal; B receives the forward normal.
       * Static-object events contain only A, which also receives the opposite.
       */
      const participantNormal =
        participantIndex <= 0
          ? {
              x:
                -eventNormal.x,

              y:
                -eventNormal.y,
            }
          : {
              ...eventNormal,
            };

      const impulseMagnitudeNs =
        magnitude(
          change.impulseNs,
        );

      const impulseDirection =
        normalise(
          change.impulseNs,
          participantNormal,
        );

      const deltaVelocityMps = {
        x:
          change
            .outgoingVelocityMps
            .x -
          change
            .incomingVelocityMps
            .x,

        y:
          change
            .outgoingVelocityMps
            .y -
          change
            .incomingVelocityMps
            .y,
      };

      return {
        schemaVersion:
          "RoadSafe Impact Response V1",

        collisionEventId:
          input.collisionEventId,

        participantId:
          change.participantId,

        participantType:
          change.participantType,

        timeSeconds:
          round(
            input.timeSeconds,
            4,
          ),

        responseClass:
          responseClassFor(
            change.participantType,
          ),

        contactPoint: {
          x:
            round(
              input
                .contactPoint
                .x,
              5,
            ),

          y:
            round(
              input
                .contactPoint
                .y,
              5,
            ),
        },

        impactPosition:
          metresToScenePosition(
            change
              .impactPositionMetres,
            widthMetres,
            heightMetres,
          ),

        contactZone:
          resolveContactZone(
            change,
            input.contactPoint,
            participantNormal,
            widthMetres,
            heightMetres,
          ),

        participantNormal:
          roundVector(
            participantNormal,
            5,
          ),

        impulseDirection:
          roundVector(
            impulseDirection,
            5,
          ),

        impulseNs:
          roundVector(
            change.impulseNs,
            2,
          ),

        impulseMagnitudeNs:
          round(
            impulseMagnitudeNs,
            2,
          ),

        incomingVelocityMps:
          roundVector(
            change
              .incomingVelocityMps,
            4,
          ),

        outgoingVelocityMps:
          roundVector(
            change
              .outgoingVelocityMps,
            4,
          ),

        deltaVelocityMps:
          roundVector(
            deltaVelocityMps,
            4,
          ),

        deltaVMetresPerSecond:
          round(
            magnitude(
              deltaVelocityMps,
            ),
            4,
          ),

        angularVelocityChangeDegreesPerSecond:
          round(
            change
              .angularVelocityChangeDegreesPerSecond,
            3,
          ),

        outcome:
          change.outcome,

        relativeImpactSpeedKmh:
          round(
            input
              .relativeImpactSpeedKmh,
            2,
          ),

        estimatedEnergyKj:
          round(
            input
              .estimatedEnergyKj,
            2,
          ),
      };
    },
  );
}
