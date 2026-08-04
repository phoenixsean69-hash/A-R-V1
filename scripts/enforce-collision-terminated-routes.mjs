import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const relativePath =
  "src/utils/participantRouteAuthoring.ts";

const absolutePath =
  path.join(
    projectRoot,
    relativePath,
  );

if (!fs.existsSync(absolutePath)) {
  throw new Error(
    `Missing required file: ${relativePath}`,
  );
}

const original =
  fs.readFileSync(
    absolutePath,
    "utf8",
  );

let updated = original;

const patchMarker =
  "[RoadSafe:CollisionTerminatedRouteV1]";

function replaceOnce(
  content,
  search,
  replacement,
  label,
) {
  const index =
    content.indexOf(search);

  if (index < 0) {
    throw new Error(
      `Could not locate ${label}.`,
    );
  }

  return (
    content.slice(0, index) +
    replacement +
    content.slice(
      index + search.length,
    )
  );
}

if (!updated.includes(patchMarker)) {
  const helperMarker =
    "export function createLockedParticipantRoute({";

  const helperIndex =
    updated.indexOf(helperMarker);

  if (helperIndex < 0) {
    throw new Error(
      "Could not locate createLockedParticipantRoute().",
    );
  }

  const helperCode = `
/*
 * ${patchMarker}
 *
 * Point Z is the authoritative end of every investigator-authored approach.
 * Auto-generated road points may never continue through the collision and
 * return from the opposite side.
 */
function collisionRouteTolerance(
  participantType:
    ReconstructionVehicleType,
): number {
  switch (participantType) {
    case "Bus":
    case "Truck":
      return 1.65;

    case "Motorcycle":
    case "Bicycle":
      return 1.05;

    default:
      return 1.3;
  }
}

function routeTravelDotToCollision(
  start: ReconstructionPosition,
  end: ReconstructionPosition,
  collisionPosition:
    ReconstructionPosition,
): number {
  const travelX =
    end.x - start.x;

  const travelY =
    end.y - start.y;

  const collisionX =
    collisionPosition.x -
    start.x;

  const collisionY =
    collisionPosition.y -
    start.y;

  return (
    travelX * collisionX +
    travelY * collisionY
  );
}

function enforceCollisionTerminatedRoute(
  route: MovementPathPoint[],
  collisionPosition:
    ReconstructionPosition,
  participantType:
    ReconstructionVehicleType,
): MovementPathPoint[] {
  if (route.length < 2) {
    return route;
  }

  let pointZIndex =
    route.findIndex(isPointZ);

  if (pointZIndex < 0) {
    pointZIndex =
      route.findIndex(
        (point) =>
          point.action ===
          "Impact",
      );
  }

  if (pointZIndex < 1) {
    pointZIndex =
      route.length - 1;
  }

  const pointZSource =
    route[pointZIndex];

  /*
   * Discard every authored point after Point Z regardless of its label, time
   * or origin. Physics points are handled separately before this function.
   */
  let approach =
    route
      .slice(
        0,
        pointZIndex,
      )
      .filter(
        (point) =>
          !isPointZ(point) &&
          point.action !==
            "Impact",
      );

  if (approach.length === 0) {
    approach = [
      route[0],
    ];
  }

  const automaticRoadRoute =
    approach.some(
      (point) =>
        point.notes?.includes(
          AUTO_ROAD_CURVE_NOTE_MARKER,
        ) === true,
    );

  if (automaticRoadRoute) {
    const tolerance =
      collisionRouteTolerance(
        participantType,
      );

    /*
     * Stop at the first route segment that reaches or crosses the collision.
     * Everything after that segment represents an overshoot.
     */
    for (
      let index = 0;
      index <
      approach.length - 1;
      index += 1
    ) {
      const contactDistance =
        distanceFromPointToSegment(
          collisionPosition,
          approach[index]
            .position,
          approach[index + 1]
            .position,
        );

      if (
        contactDistance <=
        tolerance
      ) {
        approach =
          approach.slice(
            0,
            index + 1,
          );

        break;
      }
    }

    /*
     * Remove generated anchors that reverse away from Point Z. Small lateral
     * movements remain valid for lane alignment and curved approaches.
     */
    const forwardOnly:
      MovementPathPoint[] = [
      approach[0],
    ];

    let bestCollisionDistance =
      distance(
        approach[0].position,
        collisionPosition,
      );

    for (
      let index = 1;
      index <
      approach.length;
      index += 1
    ) {
      const point =
        approach[index];

      const previous =
        forwardOnly[
          forwardOnly.length - 1
        ];

      const segmentLength =
        distance(
          previous.position,
          point.position,
        );

      if (segmentLength < 0.22) {
        continue;
      }

      const collisionDistance =
        distance(
          point.position,
          collisionPosition,
        );

      const movesAway =
        collisionDistance >
          bestCollisionDistance +
            0.65 &&
        routeTravelDotToCollision(
          previous.position,
          point.position,
          collisionPosition,
        ) < 0;

      if (movesAway) {
        continue;
      }

      forwardOnly.push(point);

      bestCollisionDistance =
        Math.min(
          bestCollisionDistance,
          collisionDistance,
        );
    }

    approach =
      forwardOnly;
  }

  const pointZ:
    MovementPathPoint = {
    ...pointZSource,
    position: {
      ...collisionPosition,
    },
    action: "Impact",
    notes: normaliseNotes(
      pointZSource.notes,
      POINT_Z_NOTE_MARKER,
    ),
  };

  let terminatedRoute = [
    ...approach,
    pointZ,
  ];

  /*
   * Remove minor polygon corners after trimming while retaining real road
   * bends. The final Point Z remains protected as the endpoint.
   */
  if (
    automaticRoadRoute &&
    terminatedRoute.length > 3
  ) {
    terminatedRoute =
      simplifyRouteSection(
        terminatedRoute,
        getRouteSimplificationTolerance(
          participantType,
          true,
        ),
      );

    terminatedRoute =
      markAutomaticRoadTurns(
        terminatedRoute,
      );
  }

  return terminatedRoute;
}

`;

  updated =
    updated.slice(
      0,
      helperIndex,
    ) +
    helperCode +
    updated.slice(
      helperIndex,
    );
}

/*
 * Apply the invariant when a participant is first spawned.
 */
if (
  !updated.includes(
    "const collisionTerminated =\n    enforceCollisionTerminatedRoute(",
  )
) {
  const createRouteOld = `  const stabilised =
    stabiliseAuthoredVehicleRoute(
      roadAligned,
      participantType,
    );

  return alignAuthoredOnlyToTangents(
    redistributeAuthoredTimes(
      relabelPointZRoute(
        stabilised,
      ),
      durationSeconds,
    ),
  );`;

  const createRouteNew = `  const stabilised =
    stabiliseAuthoredVehicleRoute(
      roadAligned,
      participantType,
    );

  const collisionTerminated =
    enforceCollisionTerminatedRoute(
      stabilised,
      collisionPosition,
      participantType,
    );

  return alignAuthoredOnlyToTangents(
    redistributeAuthoredTimes(
      relabelPointZRoute(
        collisionTerminated,
      ),
      durationSeconds,
    ),
  );`;

  updated =
    replaceOnce(
      updated,
      createRouteOld,
      createRouteNew,
      "spawned participant route return",
    );
}

/*
 * Apply the invariant whenever an existing case is loaded, edited or
 * normalized.
 */
if (
  !updated.includes(
    "const collisionTerminatedRoute =\n    enforceCollisionTerminatedRoute(",
  )
) {
  const normaliseOld = `  const finalRoute =
    stabiliseAuthoredVehicleRoute(
      roadAligned,
      participantType,
    );

  const authored =
    alignAuthoredOnlyToTangents(
      redistributeAuthoredTimes(
        relabelPointZRoute(
          finalRoute,
        ),
        durationSeconds,
      ),
    );`;

  const normaliseNew = `  const finalRoute =
    stabiliseAuthoredVehicleRoute(
      roadAligned,
      participantType,
    );

  const collisionTerminatedRoute =
    enforceCollisionTerminatedRoute(
      finalRoute,
      pointZPosition,
      participantType,
    );

  const authored =
    alignAuthoredOnlyToTangents(
      redistributeAuthoredTimes(
        relabelPointZRoute(
          collisionTerminatedRoute,
        ),
        durationSeconds,
      ),
    );`;

  updated =
    replaceOnce(
      updated,
      normaliseOld,
      normaliseNew,
      "existing participant route normalization",
    );
}

const timestamp =
  new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replaceAll(".", "-");

const backupPath =
  path.join(
    projectRoot,
    ".roadsafe-patch-backups",
    `collision-terminated-${timestamp}`,
    relativePath,
  );

fs.mkdirSync(
  path.dirname(backupPath),
  {
    recursive: true,
  },
);

fs.writeFileSync(
  backupPath,
  original,
  "utf8",
);

fs.writeFileSync(
  absolutePath,
  updated,
  "utf8",
);

const verification =
  fs.readFileSync(
    absolutePath,
    "utf8",
  );

const requiredMarkers = [
  patchMarker,
  "function enforceCollisionTerminatedRoute(",
  "const collisionTerminated =",
  "const collisionTerminatedRoute =",
  "distanceFromPointToSegment(",
];

for (const marker of requiredMarkers) {
  if (!verification.includes(marker)) {
    throw new Error(
      `Verification failed: ${marker}`,
    );
  }
}

console.log("");
console.log(
  "Collision-terminated route invariant installed.",
);

console.log(
  `Backup: ${path.relative(
    projectRoot,
    backupPath,
  )}`,
);