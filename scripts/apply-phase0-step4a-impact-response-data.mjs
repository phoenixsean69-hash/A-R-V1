import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root =
  process.cwd();

const files = {
  types:
    "src/types/reconstruction.ts",

  physics:
    "src/services/reconstructionPhysicsService.ts",

  impactResponse:
    "src/utils/reconstructionImpactResponse.ts",

  package:
    "package.json",
};

function absolute(
  relativePath,
) {
  return path.join(
    root,
    relativePath,
  );
}

function read(
  relativePath,
) {
  const target =
    absolute(relativePath);

  if (!fs.existsSync(target)) {
    throw new Error(
      `Required file is missing: ${relativePath}`,
    );
  }

  return fs
    .readFileSync(
      target,
      "utf8",
    )
    .replace(/\r\n/g, "\n");
}

function write(
  relativePath,
  content,
) {
  fs.writeFileSync(
    absolute(relativePath),
    content,
    "utf8",
  );
}

function replaceOnce(
  source,
  before,
  after,
  label,
) {
  const first =
    source.indexOf(before);

  if (first < 0) {
    throw new Error(
      `Could not apply "${label}". Expected source was not found.`,
    );
  }

  const second =
    source.indexOf(
      before,
      first + before.length,
    );

  if (second >= 0) {
    throw new Error(
      `Refusing ambiguous replacement for "${label}".`,
    );
  }

  return (
    source.slice(
      0,
      first,
    ) +
    after +
    source.slice(
      first +
        before.length,
    )
  );
}

function parse(
  relativePath,
  source,
) {
  return ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx")
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS,
  );
}

function findFunctionRange(
  relativePath,
  source,
  functionName,
) {
  const sourceFile =
    parse(
      relativePath,
      source,
    );

  const matches = [];

  function visit(
    node,
  ) {
    if (
      ts.isFunctionDeclaration(
        node,
      ) &&
      node.name?.text ===
        functionName
    ) {
      matches.push(node);
    }

    ts.forEachChild(
      node,
      visit,
    );
  }

  visit(sourceFile);

  if (
    matches.length !== 1
  ) {
    throw new Error(
      `Expected one ${functionName} function in ${relativePath}, found ${matches.length}.`,
    );
  }

  return {
    start:
      matches[0].getStart(
        sourceFile,
      ),

    end:
      matches[0].getEnd(),
  };
}

function replaceFunction(
  relativePath,
  source,
  functionName,
  transform,
) {
  const range =
    findFunctionRange(
      relativePath,
      source,
      functionName,
    );

  const original =
    source.slice(
      range.start,
      range.end,
    );

  const updated =
    transform(original);

  return (
    source.slice(
      0,
      range.start,
    ) +
    updated +
    source.slice(
      range.end,
    )
  );
}

let types =
  read(files.types);

let physics =
  read(files.physics);

if (
  types.includes(
    "[RoadSafe:CanonicalImpactResponseDataV1]",
  ) ||
  physics.includes(
    "[RoadSafe:CanonicalImpactResponseEventV1]",
  ) ||
  fs.existsSync(
    absolute(
      files.impactResponse,
    ),
  )
) {
  throw new Error(
    "Phase 0 Step 4A is already installed.",
  );
}

/*
 * Add the canonical response contract. It contains only solver-derived and
 * geometrically derived values. Vertical launch/fall animation assumptions
 * will remain separate in Step 4B.
 */
types =
  replaceOnce(
    types,
`export interface PhysicsCollisionEvent {`,
`/*
 * [RoadSafe:CanonicalImpactResponseDataV1]
 *
 * One participant-specific, solver-derived impact record shared by 3D, AR,
 * reports and later visual-response controllers.
 */
export type ParticipantImpactResponseClass =
  | "Rigid Vehicle"
  | "Two Wheeler"
  | "Human Body";

export type ParticipantImpactContactZone =
  | "Front"
  | "Rear"
  | "Left Side"
  | "Right Side"
  | "Centre";

export interface ParticipantImpactResponse {
  schemaVersion:
    "RoadSafe Impact Response V1";

  collisionEventId: string;
  participantId: string;
  participantType:
    ReconstructionEntityType;

  timeSeconds: number;
  responseClass:
    ParticipantImpactResponseClass;

  contactPoint:
    ReconstructionPosition;

  impactPosition:
    ReconstructionPosition;

  contactZone:
    ParticipantImpactContactZone;

  /**
   * Collision-manifold normal directed toward this participant's response.
   */
  participantNormal:
    PhysicsVector2D;

  /**
   * Direction of the participant's complete normal + friction impulse.
   */
  impulseDirection:
    PhysicsVector2D;

  impulseNs:
    PhysicsVector2D;

  impulseMagnitudeNs: number;

  incomingVelocityMps:
    PhysicsVector2D;

  outgoingVelocityMps:
    PhysicsVector2D;

  deltaVelocityMps:
    PhysicsVector2D;

  deltaVMetresPerSecond: number;

  angularVelocityChangeDegreesPerSecond:
    number;

  outcome:
    CollisionKinematicOutcome;

  relativeImpactSpeedKmh: number;
  estimatedEnergyKj: number;
}

export interface PhysicsCollisionEvent {`,
    "add canonical impact-response type contract",
  );

types =
  replaceOnce(
    types,
`  angularVelocityChangesDegPerSecond: Record<string, number>;
  kinematics?: CollisionKinematicsSummary;`,
`  angularVelocityChangesDegPerSecond: Record<string, number>;

  /**
   * Optional for compatibility with reconstructions saved before Response V1.
   * Every newly calculated collision event supplies this array.
   */
  impactResponses?:
    ParticipantImpactResponse[];

  kinematics?: CollisionKinematicsSummary;`,
    "attach responses to collision events",
  );

const impactResponseUtility =
`import type {
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
`;

write(
  files.impactResponse,
  impactResponseUtility,
);

/*
 * Connect exact solver results to the canonical response builder.
 */
physics =
  replaceOnce(
    physics,
`import { getReconstructionWorldDimensions } from "../utils/reconstructionWorldScale";

import {`,
`import { getReconstructionWorldDimensions } from "../utils/reconstructionWorldScale";
import { createParticipantImpactResponses } from "../utils/reconstructionImpactResponse";

import {`,
    "import canonical impact-response builder",
  );

physics =
  replaceOnce(
    physics,
`interface CollisionParticipantChange {
  participantId: string;
  massKg: number;`,
`interface CollisionParticipantChange {
  participantId: string;

  participantType:
    ReconstructionVehicle["type"];

  massKg: number;`,
    "retain participant type in collision changes",
  );

physics =
  replaceOnce(
    physics,
`        participantId: left.participant.id,
        massKg: left.profile.massKg,`,
`        participantId: left.participant.id,
        participantType:
          left.participant.type,
        massKg: left.profile.massKg,`,
    "store left participant type",
  );

physics =
  replaceOnce(
    physics,
`        participantId: right.participant.id,
        massKg: right.profile.massKg,`,
`        participantId: right.participant.id,
        participantType:
          right.participant.type,
        massKg: right.profile.massKg,`,
    "store right participant type",
  );

physics =
  replaceOnce(
    physics,
`        participantId: body.participant.id,
        massKg: body.profile.massKg,`,
`        participantId: body.participant.id,
        participantType:
          body.participant.type,
        massKg: body.profile.massKg,`,
    "store object-impact participant type",
  );

physics =
  replaceFunction(
    files.physics,
    physics,
    "createPhysicsCollisionEvent",
    (
      functionSource,
    ) => {
      let updated =
        replaceOnce(
          functionSource,
`  return {
    id: input.id,`,
`  /*
   * [RoadSafe:CanonicalImpactResponseEventV1]
   *
   * Preserve the exact solver result before any viewer-specific animation is
   * applied. Old saved events remain valid because impactResponses is optional.
   */
  const impactResponses =
    createParticipantImpactResponses({
      collisionEventId:
        input.id,

      timeSeconds:
        quantiseSimulationTime(
          input.timeSeconds,
        ),

      participantIds:
        input.participantIds,

      contactPoint:
        input.contactPoint,

      collisionNormal:
        input.normal,

      relativeImpactSpeedKmh:
        input.result
          .relativeSpeedKmh,

      estimatedEnergyKj:
        input.result
          .impactEnergyKj,

      widthMetres:
        input.width,

      heightMetres:
        input.height,

      changes:
        input.result
          .participantChanges
          .map(
            (change) => ({
              participantId:
                change.participantId,

              participantType:
                change.participantType,

              impactPositionMetres:
                change.impactPosition,

              incomingVelocityMps:
                change.incomingVelocity,

              outgoingVelocityMps:
                change.outgoingVelocity,

              impulseNs:
                change.impulseNs,

              angularVelocityChangeDegreesPerSecond:
                change
                  .outgoingAngularVelocityDegreesPerSecond -
                change
                  .incomingAngularVelocityDegreesPerSecond,

              outcome:
                change.outcome,
            }),
          ),
    });

  return {
    id: input.id,`,
          "build canonical participant impact responses",
        );

      updated =
        replaceOnce(
          updated,
`    angularVelocityChangesDegPerSecond:
      input.result.angularVelocityChangesDegPerSecond,
    kinematics,`,
`    angularVelocityChangesDegPerSecond:
      input.result.angularVelocityChangesDegPerSecond,
    impactResponses,
    kinematics,`,
          "attach canonical responses to collision event",
        );

      return updated;
    },
  );

const packageJson =
  JSON.parse(
    read(
      files.package,
    ),
  );

packageJson.scripts ??= {};

packageJson.scripts[
  "impact-response:verify"
] =
  "node scripts/verify-phase0-step4a-impact-response-data.mjs && tsc -p tsconfig.phase0.json";

write(
  files.types,
  types,
);

write(
  files.physics,
  physics,
);

write(
  files.package,
  `${JSON.stringify(
    packageJson,
    null,
    2,
  )}\n`,
);

console.log(
  "created src/utils/reconstructionImpactResponse.ts",
);

console.log(
  "updated src/types/reconstruction.ts",
);

console.log(
  "updated src/services/reconstructionPhysicsService.ts",
);

console.log(
  "updated package.json",
);

console.log(
  "Phase 0 Step 4A canonical impact-response data applied.",
);
